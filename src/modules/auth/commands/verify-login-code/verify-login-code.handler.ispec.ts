import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { AuthChallenge } from '../../entities/auth-challenge.entity.js';
import { AuthSession } from '../../entities/auth-session.entity.js';
import { User } from '../../entities/user.entity.js';
import { InvalidOrExpiredChallengeError } from '../../errors/invalid-or-expired-challenge.error.js';
import { ChallengeService } from '../../services/challenge.service.js';
import { VerifyLoginCodeCommand } from './verify-login-code.command.js';

describe('VerifyLoginCodeHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  const uniqueEmail = () =>
    `user-${Math.random().toString(36).slice(2)}@example.com`;

  it('logs in and issues a session for a valid code', async () => {
    const challenges = suite.moduleRef.get(ChallengeService);
    const email = uniqueEmail();
    const issued = await challenges.issue(email);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    const result = await suite.command(
      new VerifyLoginCodeCommand({ email, code: issued.otp }),
    );

    expect(result.sessionToken).toBeTruthy();

    const user = await suite.orm.em.findOneOrFail(User, { id: result.userId });
    expect(user.email).toBe(email);

    await expect(
      suite.orm.em.findOneOrFail(AuthSession, { userId: result.userId }),
    ).resolves.toBeTruthy();

    await expect(
      suite.orm.em.findOne(AuthChallenge, { email }),
    ).resolves.toBeNull();
  });

  it('rejects a wrong code', async () => {
    const challenges = suite.moduleRef.get(ChallengeService);
    const email = uniqueEmail();
    await challenges.issue(email);
    await suite.orm.em.flush();
    suite.orm.em.clear();

    await expect(
      suite.command(new VerifyLoginCodeCommand({ email, code: '000000' })),
    ).rejects.toThrow(InvalidOrExpiredChallengeError);
  });
});
