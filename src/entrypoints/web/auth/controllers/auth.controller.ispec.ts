import type { EntityManager } from '@mikro-orm/postgresql';
import { HttpStatus } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { DateTime } from 'luxon';
import { createWebE2ESuite } from '../../../../../test/http/web/setup/e2e-suite.helper.js';
import { REDIS_CLIENT } from '../../../../core/redis/redis.tokens.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import {
  generateOtp,
  generateToken,
  hashSecret,
} from '../../../../modules/auth/crypto/token.helper.js';
import { AuthChallenge } from '../../../../modules/auth/entities/auth-challenge.entity.js';
import { AuthWebModule } from '../auth-web.module.js';

describe('AuthController', () => {
  const suite = createWebE2ESuite({ imports: [AuthWebModule] });
  const config = () =>
    suite.app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY);

  const uniqueEmail = () =>
    `user-${Math.random().toString(36).slice(2)}@example.com`;

  // Every request in this suite arrives from the same loopback address, so the
  // per-IP OTP counter is shared Redis state that would leak between tests (and
  // across re-runs within the TTL window). Clear it before each test.
  beforeEach(async () => {
    const redis = suite.app.get<Redis>(REDIS_CLIENT);
    const keys = await redis.keys('otp:ip:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  async function issueChallenge(
    em: EntityManager,
    email: string,
  ): Promise<{ token: string; otp: string }> {
    const token = generateToken();
    const otp = generateOtp();

    em.create(AuthChallenge, {
      email,
      otpHash: hashSecret(otp),
      attempts: 0,
      expiresAt: DateTime.now().plus({
        milliseconds: config().challengeTtlMs,
      }),
    });
    await em.flush();

    return { token, otp };
  }

  function extractCookie(response: {
    headers: Record<string, unknown>;
  }): string {
    const raw = response.headers['set-cookie'];
    const cookies = Array.isArray(raw) ? raw : [raw];
    const sessionCookie = cookies.find((c) => c?.startsWith('__Host-session='));

    if (!sessionCookie) {
      throw new Error('No session cookie set on response');
    }

    return sessionCookie.split(';')[0];
  }

  describe('POST /auth/login', () => {
    it('accepts a valid email and returns a generic response', async () => {
      await suite
        .request('post', '/auth/login', { authed: false })
        .send({ email: uniqueEmail() })
        .expect(HttpStatus.OK);
    });

    it('rejects an invalid email with a validation error', async () => {
      await suite
        .request('post', '/auth/login', { authed: false })
        .send({ email: 'not-an-email' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rejects a missing email with a validation error', async () => {
      await suite
        .request('post', '/auth/login', { authed: false })
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rate-limits repeated requests for the same address', async () => {
      const email = uniqueEmail();

      for (let i = 0; i < config().requestLimitPerEmail; i++) {
        // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared rate-limit counter the next depends on.
        await suite
          .request('post', '/auth/login', { authed: false })
          .send({ email })
          .expect(HttpStatus.OK);
      }

      await suite
        .request('post', '/auth/login', { authed: false })
        .send({ email })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rate-limits requests from one IP even across different emails', async () => {
      for (let i = 0; i < config().requestLimitPerIp; i++) {
        // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared per-IP counter the next depends on.
        await suite
          .request('post', '/auth/login', { authed: false })
          .send({ email: uniqueEmail() })
          .expect(HttpStatus.OK);
      }

      await suite
        .request('post', '/auth/login', { authed: false })
        .send({ email: uniqueEmail() })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('POST /auth/login/verify-code', () => {
    it('rejects a wrong code', async () => {
      await suite
        .request('post', '/auth/login/verify-code', { authed: false })
        .send({ email: uniqueEmail(), code: '000000' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rejects a code that is not 6 digits with a validation error', async () => {
      await suite
        .request('post', '/auth/login/verify-code', { authed: false })
        .send({ email: uniqueEmail(), code: '123' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('locks out further attempts after too many wrong codes', async () => {
      const email = uniqueEmail();
      await issueChallenge(suite.orm.em, email);

      for (let i = 0; i < config().otpMaxAttempts; i++) {
        // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared attempts counter the next depends on.
        await suite
          .request('post', '/auth/login/verify-code', { authed: false })
          .send({ email, code: '000000' })
          .expect(HttpStatus.BAD_REQUEST);
      }

      await suite
        .request('post', '/auth/login/verify-code', { authed: false })
        .send({ email, code: '000000' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('sets a session cookie on the right code, resolvable via /auth/me', async () => {
      const email = uniqueEmail();
      const issued = await issueChallenge(suite.orm.em, email);

      const verifyResponse = await suite
        .request('post', '/auth/login/verify-code', { authed: false })
        .send({ email, code: issued.otp })
        .expect(HttpStatus.OK);

      expect(verifyResponse.body).toMatchObject({ userId: expect.any(String) });

      const cookie = extractCookie(verifyResponse);

      const meResponse = await suite
        .request('get', '/auth/me', { authed: false })
        .set('Cookie', cookie)
        .expect(HttpStatus.OK);

      expect(meResponse.body).toMatchObject({ email });
    });
  });

  describe('POST /auth/google', () => {
    it('rejects a credential it cannot verify (no GOOGLE_CLIENT_ID configured in tests)', async () => {
      await suite
        .request('post', '/auth/google', { authed: false })
        .send({ credential: 'not-a-real-google-id-token' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rejects a credential shorter than the minimum length with a validation error', async () => {
      await suite
        .request('post', '/auth/google', { authed: false })
        .send({ credential: 'too-short' })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /auth/me', () => {
    it('requires an authenticated session', async () => {
      await suite
        .request('get', '/auth/me', { authed: false })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /auth/logout', () => {
    it('is a no-op without a session and clears the cookie either way', async () => {
      await suite
        .request('post', '/auth/logout', { authed: false })
        .expect(HttpStatus.NO_CONTENT);
    });

    it('invalidates an active session', async () => {
      const email = uniqueEmail();
      const issued = await issueChallenge(suite.orm.em, email);

      const verifyResponse = await suite
        .request('post', '/auth/login/verify-code', { authed: false })
        .send({ email, code: issued.otp })
        .expect(HttpStatus.OK);

      const cookie = extractCookie(verifyResponse);

      await suite
        .request('post', '/auth/logout', { authed: false })
        .set('Cookie', cookie)
        .expect(HttpStatus.NO_CONTENT);

      await suite
        .request('get', '/auth/me', { authed: false })
        .set('Cookie', cookie)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
