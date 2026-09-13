import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { DailyPlan } from '../../entities/daily-plan.entity.js';
import { DailyPlanNotFoundError } from '../../errors/daily-plan-not-found.error.js';
import { HomeModule } from '../../home.module.js';
import { CompleteDailyPlanCommand } from './complete-daily-plan.command.js';

describe('CompleteDailyPlanHandler', () => {
  const suite = createIntegrationSuite({ imports: [HomeModule] });

  it('throws when no daily plan was selected today', async () => {
    await expect(
      suite.command(new CompleteDailyPlanCommand(uuidv7())),
    ).rejects.toThrow(DailyPlanNotFoundError);
  });

  it('sets completedAt on the first call', async () => {
    const userId = uuidv7();
    suite.orm.em.create(DailyPlan, {
      userId,
      planDate: DateTime.now(),
      postId: uuidv7(),
      grammarUsagePointId: null,
    });
    await suite.orm.em.flush();

    const completedAt = await suite.command(
      new CompleteDailyPlanCommand(userId),
    );

    expect(completedAt).toBeInstanceOf(DateTime);
    const plan = await suite.orm.em.findOneOrFail(DailyPlan, { userId });
    expect(plan.completedAt?.toMillis()).toBe(completedAt.toMillis());
  });

  it('is idempotent — a second call keeps the first completion time', async () => {
    const userId = uuidv7();
    suite.orm.em.create(DailyPlan, {
      userId,
      planDate: DateTime.now(),
      postId: uuidv7(),
      grammarUsagePointId: null,
    });
    await suite.orm.em.flush();

    const first = await suite.command(new CompleteDailyPlanCommand(userId));
    const second = await suite.command(new CompleteDailyPlanCommand(userId));

    expect(second.toMillis()).toBe(first.toMillis());
  });
});
