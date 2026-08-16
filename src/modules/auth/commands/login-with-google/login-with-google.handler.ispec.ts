import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { AuthSession } from '../../entities/auth-session.entity.js';
import { User } from '../../entities/user.entity.js';
import { InvalidGoogleCredentialError } from '../../errors/invalid-google-credential.error.js';
import { GoogleIdTokenVerifierService } from '../../services/google-id-token-verifier.service.js';
import { LoginWithGoogleCommand } from './login-with-google.command.js';

class FakeGoogleIdTokenVerifierService {
  async verify(idToken: string): Promise<{ googleSub: string; email: string }> {
    if (idToken === 'invalid-credential') {
      throw new InvalidGoogleCredentialError();
    }

    return JSON.parse(idToken);
  }
}

describe('LoginWithGoogleHandler', () => {
  const suite = createIntegrationSuite(
    { imports: [AuthModule] },
    {
      builderHook: (builder) =>
        builder
          .overrideProvider(GoogleIdTokenVerifierService)
          .useClass(FakeGoogleIdTokenVerifierService),
    },
  );

  const uniqueEmail = () =>
    `user-${Math.random().toString(36).slice(2)}@example.com`;

  const credentialFor = (email: string, googleSub: string) =>
    JSON.stringify({ email, googleSub });

  it('creates a new user and session on first Google login', async () => {
    const email = uniqueEmail();
    const googleSub = `sub-${randomUUID()}`;

    const result = await suite.command(
      new LoginWithGoogleCommand({
        credential: credentialFor(email, googleSub),
      }),
    );

    expect(result.sessionToken).toBeTruthy();

    const user = await suite.orm.em.findOneOrFail(User, { id: result.userId });
    expect(user.email).toBe(email);
    expect(user.googleSub).toBe(googleSub);

    const session = await suite.orm.em.findOneOrFail(AuthSession, {
      userId: result.userId,
    });
    expect(session).toBeTruthy();
  });

  it('backfills googleSub onto an existing user found by email', async () => {
    const email = uniqueEmail();
    const existing = suite.orm.em.create(User, { email, googleSub: null });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const googleSub = `sub-${randomUUID()}`;
    const result = await suite.command(
      new LoginWithGoogleCommand({
        credential: credentialFor(email, googleSub),
      }),
    );

    expect(result.userId).toBe(existing.id);

    const user = await suite.orm.em.findOneOrFail(User, { id: existing.id });
    expect(user.googleSub).toBe(googleSub);
  });

  it('propagates a rejection from the Google verifier without creating a user', async () => {
    await expect(
      suite.command(
        new LoginWithGoogleCommand({ credential: 'invalid-credential' }),
      ),
    ).rejects.toThrow(InvalidGoogleCredentialError);
  });
});
