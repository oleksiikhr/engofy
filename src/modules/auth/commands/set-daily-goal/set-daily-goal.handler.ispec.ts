import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { User } from '../../entities/user.entity.js';
import { SetDailyGoalCommand } from './set-daily-goal.command.js';

describe('SetDailyGoalHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('defaults a new user to 10 and updates the daily goal', async () => {
    const user = suite.factories.user.makeOne({
      email: `user-${randomUUID()}@example.com`,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();

    expect(
      (await suite.orm.em.findOneOrFail(User, { id: user.id })).dailyGoal,
    ).toBe(10);

    const result = await suite.command(new SetDailyGoalCommand(user.id, 25));

    expect(result).toBe(25);

    const updated = await suite.orm.em.findOneOrFail(User, { id: user.id });
    expect(updated.dailyGoal).toBe(25);
  });
});
