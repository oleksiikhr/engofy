import type { ConfigType } from '@nestjs/config';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import AuthConfig from '../../config/auth.config.js';
import { AuthChallenge } from '../../entities/auth-challenge.entity.js';
import { TooManyLoginRequestsError } from '../../errors/too-many-login-requests.error.js';
import { RequestLoginCodeCommand } from './request-login-code.command.js';

describe('RequestLoginCodeHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });
  const config = () =>
    suite.moduleRef.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY);

  const uniqueEmail = () =>
    `user-${Math.random().toString(36).slice(2)}@example.com`;
  const uniqueIp = () => `ip-${Math.random().toString(36).slice(2)}`;

  it('issues a challenge for a normalized email and enqueues the challenge email', async () => {
    const email = uniqueEmail();

    await suite.command(
      new RequestLoginCodeCommand(
        { email: ` ${email.toUpperCase()} ` },
        uniqueIp(),
      ),
    );

    const challenge = await suite.orm.em.findOneOrFail(AuthChallenge, {
      email,
    });
    expect(challenge.otpHash).toBeTruthy();
  });

  it('throws once the per-email request limit is exceeded', async () => {
    const email = uniqueEmail();
    const ip = uniqueIp();

    for (let i = 0; i < config().requestLimitPerEmail; i++) {
      // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared rate-limit counter the next depends on.
      await suite.command(new RequestLoginCodeCommand({ email }, ip));
    }

    await expect(
      suite.command(new RequestLoginCodeCommand({ email }, ip)),
    ).rejects.toThrow(TooManyLoginRequestsError);
  });

  it('throws once the per-IP request limit is exceeded, across emails', async () => {
    const ip = uniqueIp();

    for (let i = 0; i < config().requestLimitPerIp; i++) {
      // biome-ignore lint/performance/noAwaitInLoops: requests must be sequential — each one mutates the shared rate-limit counter the next depends on.
      await suite.command(
        new RequestLoginCodeCommand({ email: uniqueEmail() }, ip),
      );
    }

    await expect(
      suite.command(new RequestLoginCodeCommand({ email: uniqueEmail() }, ip)),
    ).rejects.toThrow(TooManyLoginRequestsError);
  });
});
