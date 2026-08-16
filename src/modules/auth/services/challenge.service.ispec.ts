import { type ConfigType } from '@nestjs/config';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../auth.module.js';
import AuthConfig from '../config/auth.config.js';
import { InvalidOrExpiredChallengeError } from '../errors/invalid-or-expired-challenge.error.js';
import { TooManyAttemptsError } from '../errors/too-many-attempts.error.js';
import { ChallengeService } from './challenge.service.js';

describe('ChallengeService', () => {
  let challenges: ChallengeService;
  let config: ConfigType<typeof AuthConfig>;

  const suite = createIntegrationSuite({
    imports: [AuthModule],
  });

  beforeAll(async () => {
    challenges = suite.moduleRef.get(ChallengeService);
    config = suite.moduleRef.get(AuthConfig.KEY);
  });

  const uniqueEmail = () =>
    `user-${Math.random().toString(36).slice(2)}@example.com`;

  describe('issue + consumeByOtp', () => {
    it('redeems a freshly issued code exactly once', async () => {
      const email = uniqueEmail();
      const issued = await challenges.issue(email);
      await suite.orm.em.flush();

      const redeemed = await challenges.consumeByOtp(email, issued.otp);
      expect(redeemed.email).toBe(email);

      await expect(challenges.consumeByOtp(email, issued.otp)).rejects.toThrow(
        InvalidOrExpiredChallengeError,
      );
    });

    it('rejects a wrong code without consuming the challenge', async () => {
      const email = uniqueEmail();
      const issued = await challenges.issue(email);
      await suite.orm.em.flush();

      await expect(challenges.consumeByOtp(email, '000000')).rejects.toThrow(
        InvalidOrExpiredChallengeError,
      );

      // The challenge is still live — the right code still works.
      await expect(challenges.consumeByOtp(email, issued.otp)).resolves.toEqual(
        { email },
      );
    });

    it('invalidates the challenge after the max attempts of wrong codes', async () => {
      const email = uniqueEmail();
      const issued = await challenges.issue(email);
      await suite.orm.em.flush();

      for (let i = 0; i < config.otpMaxAttempts; i++) {
        // biome-ignore lint/performance/noAwaitInLoops: attempts must be sequential — each one mutates the shared attempts counter the next depends on.
        await expect(challenges.consumeByOtp(email, '000000')).rejects.toThrow(
          InvalidOrExpiredChallengeError,
        );
      }

      await expect(challenges.consumeByOtp(email, '000000')).rejects.toThrow(
        TooManyAttemptsError,
      );

      // Even the correct code no longer works — the challenge was deleted.
      await expect(challenges.consumeByOtp(email, issued.otp)).rejects.toThrow(
        InvalidOrExpiredChallengeError,
      );
    });
  });

  describe('allowRequest', () => {
    it('allows up to the per-email request limit, then denies', async () => {
      const email = uniqueEmail();

      for (let i = 0; i < config.requestLimitPerEmail; i++) {
        // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared rate-limit counter the next depends on.
        await expect(challenges.allowRequest(email)).resolves.toBe(true);
      }

      await expect(challenges.allowRequest(email)).resolves.toBe(false);
    });

    it('tracks each email independently', async () => {
      const emailA = uniqueEmail();
      const emailB = uniqueEmail();

      for (let i = 0; i < config.requestLimitPerEmail; i++) {
        // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared rate-limit counter the next depends on.
        await challenges.allowRequest(emailA);
      }

      await expect(challenges.allowRequest(emailA)).resolves.toBe(false);
      await expect(challenges.allowRequest(emailB)).resolves.toBe(true);
    });
  });
});
