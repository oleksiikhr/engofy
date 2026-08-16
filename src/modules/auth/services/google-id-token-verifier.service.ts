import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import AuthConfig from '../config/auth.config.js';
import { normalizeEmail } from '../crypto/token.helper.js';
import { InvalidGoogleCredentialError } from '../errors/invalid-google-credential.error.js';

export interface GoogleIdentity {
  googleSub: string;
  email: string;
}

// TODO Add tests
@Injectable()
export class GoogleIdTokenVerifierService {
  private readonly client: OAuth2Client;

  constructor(
    @Inject(AuthConfig.KEY)
    private readonly config: ConfigType<typeof AuthConfig>,
  ) {
    this.client = new OAuth2Client(config.googleClientId || undefined);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.config.googleClientId) {
      throw new InvalidGoogleCredentialError();
    }

    const payload = await this.client
      .verifyIdToken({ idToken, audience: this.config.googleClientId })
      .then((ticket) => ticket.getPayload())
      .catch(() => undefined);

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new InvalidGoogleCredentialError();
    }

    return { googleSub: payload.sub, email: normalizeEmail(payload.email) };
  }
}
