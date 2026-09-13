import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../../post/embeddables/post-source.embeddable.js';
import { GrammarUsagePoint } from '../../../post/entities/grammar-usage-point.entity.js';
import { Post } from '../../../post/entities/post.entity.js';
import { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import { PostSourceFormat } from '../../../post/enums/post-source-format.enum.js';
import { PostStatus } from '../../../post/enums/post-status.enum.js';
import { DailyPlan } from '../../entities/daily-plan.entity.js';
import { HomeModule } from '../../home.module.js';
import { GetDailyPlanQuery } from './get-daily-plan.query.js';

async function seedPost(em: EntityManager): Promise<Post> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = PostStatus.Published;
  post.title = 'A post';
  post.cefrLevel = CefrLevel.B1;
  em.persist(post);
  await em.flush();
  return post;
}

describe('GetDailyPlanHandler', () => {
  const suite = createIntegrationSuite({ imports: [HomeModule] });

  it('returns null when nothing has been selected today', async () => {
    const view = await suite.query(new GetDailyPlanQuery(uuidv7()));
    expect(view).toBeNull();
  });

  it('hydrates the selected post and grammar usage point', async () => {
    const post = await seedPost(suite.orm.em);
    const usagePoint = suite.orm.em.create(GrammarUsagePoint, {
      constructionId: uuidv7(),
      cefrLevel: CefrLevel.B1,
      guideword: 'USE: HABITS',
      canDoStatement: 'Can talk about habits.',
    });
    await suite.orm.em.flush();

    const userId = uuidv7();
    suite.orm.em.create(DailyPlan, {
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
      grammarUsagePointId: usagePoint.id,
      grammarGuideword: 'USE: HABITS',
      grammarCanDoStatement: 'Can talk about habits.',
      completedAt: null,
    });
  });

  it('leaves grammar fields null when no usage point was selected', async () => {
    const post = await seedPost(suite.orm.em);
    const userId = uuidv7();
    suite.orm.em.create(DailyPlan, {
      userId,
      planDate: DateTime.now(),
      postId: post.id,
      grammarUsagePointId: null,
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetDailyPlanQuery(userId));

    expect(view?.grammarUsagePointId).toBeNull();
    expect(view?.grammarGuideword).toBeNull();
    expect(view?.grammarCanDoStatement).toBeNull();
  });
});
