import type { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type AuthConfig from '../config/auth.config.js';
import { InvalidGoogleCredentialError } from '../errors/invalid-google-credential.error.js';
import { GoogleIdTokenVerifierService } from './google-id-token-verifier.service.js';

describe('GoogleIdTokenVerifierService', () => {
  const config = {
    googleClientId: 'client-id',
  } as ConfigType<typeof AuthConfig>;

  let verifyIdToken: ReturnType<typeof vi.spyOn>;
  let service: GoogleIdTokenVerifierService;

  beforeEach(() => {
    service = new GoogleIdTokenVerifierService(config);
    verifyIdToken = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the normalized Google identity for a verified token', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'User@Example.com',
        email_verified: true,
      }),
    } as never);

    await expect(service.verify('id-token')).resolves.toEqual({
      googleSub: 'google-sub-1',
      email: 'user@example.com',
    });
  });

  it('throws without calling Google when no client ID is configured', async () => {
    const unconfigured = new GoogleIdTokenVerifierService({
      googleClientId: '',
    } as ConfigType<typeof AuthConfig>);

    await expect(unconfigured.verify('id-token')).rejects.toThrow(
      InvalidGoogleCredentialError,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('throws when token verification rejects', async () => {
    verifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(service.verify('bad-token')).rejects.toThrow(
      InvalidGoogleCredentialError,
    );
  });

  it('throws when the payload has no sub', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'user@example.com',
        email_verified: true,
      }),
    } as never);

    await expect(service.verify('id-token')).rejects.toThrow(
      InvalidGoogleCredentialError,
    );
  });

  it('throws when the email is not verified', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'user@example.com',
        email_verified: false,
      }),
    } as never);

    await expect(service.verify('id-token')).rejects.toThrow(
      InvalidGoogleCredentialError,
    );
  });
});
