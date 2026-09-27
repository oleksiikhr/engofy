import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { User } from '../../entities/user.entity.js';
import { SetDailyNewCardLimitCommand } from './set-daily-new-card-limit.command.js';

describe('SetDailyNewCardLimitHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('defaults a new user to no override and sets the override', async () => {
    const user = suite.factories.user.makeOne({
      email: `user-${randomUUID()}@example.com`,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    expect(
      (await suite.orm.em.findOneOrFail(User, { id: user.id }))
        .dailyNewCardLimitOverride,
    ).toBeNull();

    const result = await suite.command(
      new SetDailyNewCardLimitCommand(user.id, 40),
    );

    expect(result).toBe(40);

    const updated = await suite.orm.em.findOneOrFail(User, { id: user.id });
    expect(updated.dailyNewCardLimitOverride).toBe(40);
  });
});
