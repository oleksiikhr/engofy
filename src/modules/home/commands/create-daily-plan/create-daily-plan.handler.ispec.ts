import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { DailyPlan } from '../../entities/daily-plan.entity.js';
import { HomeModule } from '../../home.module.js';
import { CreateDailyPlanCommand } from './create-daily-plan.command.js';

describe('CreateDailyPlanHandler', () => {
  const suite = createIntegrationSuite({ imports: [HomeModule] });

  it('creates a daily_plans row for today', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    const postId = (await suite.factories.post.createOne()).id;
    const grammarUsagePointId = uuidv7();

    await suite.command(
      new CreateDailyPlanCommand(userId, postId, grammarUsagePointId),
    );

    const plan = await suite.orm.em.findOneOrFail(DailyPlan, { userId });
    expect(plan.postId).toBe(postId);
    expect(plan.grammarUsagePointId).toBe(grammarUsagePointId);
    expect(plan.planDate.toISODate()).toBe(DateTime.now().toUTC().toISODate());
    expect(plan.completedAt).toBeFalsy();
  });

  it('allows a null grammar usage point', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    const postId = (await suite.factories.post.createOne()).id;

    await suite.command(new CreateDailyPlanCommand(userId, postId, null));

    const plan = await suite.orm.em.findOneOrFail(DailyPlan, { userId });
    expect(plan.grammarUsagePointId).toBeFalsy();
  });

  it('is idempotent — a second call the same day keeps the first selection', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    const firstPost = await suite.factories.post.createOne();
    const secondPost = await suite.factories.post.createOne();

    await suite.command(new CreateDailyPlanCommand(userId, firstPost.id, null));
    await suite.command(
      new CreateDailyPlanCommand(userId, secondPost.id, null),
    );

    expect(await suite.orm.em.count(DailyPlan, { userId })).toBe(1);
    const plan = await suite.orm.em.findOneOrFail(DailyPlan, { userId });
    expect(plan.postId).toBe(firstPost.id);
  });
});
