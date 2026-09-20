import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { HomeModule } from '../../home.module.js';
import { GetDailyPlanQuery } from './get-daily-plan.query.js';

describe('GetDailyPlanHandler', () => {
  const suite = createIntegrationSuite({ imports: [HomeModule] });

  it('returns null when nothing has been selected today', async () => {
    const view = await suite.query(new GetDailyPlanQuery(uuidv7()));
    expect(view).toBeNull();
  });

  it('hydrates the selected post and grammar usage point', async () => {
    const post = await suite.factories.post.createOne();
    const construction = suite.factories.grammarConstruction.makeOne({
      categoryId: uuidv7(),
      name: 'present simple',
      slug: 'present-simple',
      sortOrder: 1,
    });
    const usagePoint = suite.factories.grammarUsagePoint.makeOne({
      constructionId: construction.id,
      cefrLevel: CefrLevel.B1,
      guideword: 'USE: HABITS',
      canDoStatement: 'Can talk about habits.',
      exampleText: 'She usually walks to work.',
    });
    await suite.orm.em.flush();

    const userId = uuidv7();
    suite.factories.dailyPlan.makeOne({
      userId,
      planDate: DateTime.now(),
      postId: post.id,
      grammarUsagePointId: usagePoint.id,
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetDailyPlanQuery(userId));

    expect(view).toMatchObject({
      postShortId: post.shortId,
      postTitle: 'A post',
      postCefrLevel: CefrLevel.B1,
      isRead: false,
      grammarUsagePointId: usagePoint.id,
      grammarGuideword: 'USE: HABITS',
      grammarConstructionSlug: 'present-simple',
      grammarCanDoStatement: 'Can talk about habits.',
      grammarExampleText: 'She usually walks to work.',
      completedAt: null,
    });
  });

  it('leaves grammar fields null when no usage point was selected', async () => {
    const post = await suite.factories.post.createOne();
    const userId = uuidv7();
    suite.factories.dailyPlan.makeOne({
      userId,
      planDate: DateTime.now(),
      postId: post.id,
      grammarUsagePointId: null,
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetDailyPlanQuery(userId));

    expect(view?.grammarUsagePointId).toBeNull();
    expect(view?.grammarGuideword).toBeNull();
    expect(view?.grammarConstructionSlug).toBeNull();
    expect(view?.grammarCanDoStatement).toBeNull();
    expect(view?.grammarExampleText).toBeNull();
  });

  it('reports isRead once a post_reads row exists for the plan post', async () => {
    const post = await suite.factories.post.createOne();
    const userId = uuidv7();
    suite.factories.dailyPlan.makeOne({
      userId,
      planDate: DateTime.now(),
      postId: post.id,
      grammarUsagePointId: null,
    });
    suite.factories.postRead.makeOne({
      userId,
      postId: post.id,
      readAt: DateTime.now(),
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetDailyPlanQuery(userId));

    expect(view?.isRead).toBe(true);
  });
});
