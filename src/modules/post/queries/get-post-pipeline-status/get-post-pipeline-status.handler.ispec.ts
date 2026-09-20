import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { factories } from '../../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { GetPostPipelineStatusQuery } from './get-post-pipeline-status.query.js';

describe('GetPostPipelineStatusHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns one post by id in any status, with its stages in pipeline order', async () => {
    const em = suite.orm.em;
    const post = factories(em).post.makeOne({
      status: PostStatus.Published,
      createdAt: DateTime.now(),
    });
    // Inserted out of pipeline order on purpose.
    factories(em).postPipelineRun.makeOne({
      postId: post.id,
      stage: PostPipelineStage.Publish,
      status: PostPipelineRunStatus.Completed,
    });
    factories(em).postPipelineRun.makeOne({
      postId: post.id,
      stage: PostPipelineStage.SpacyParse,
      status: PostPipelineRunStatus.Completed,
    });
    await em.flush();
    em.clear();

    const { items } = await suite.query(
      new GetPostPipelineStatusQuery(post.id, 1),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: post.id,
      shortId: post.shortId,
      status: PostStatus.Published,
    });
    expect(items[0].stages.map((stage) => stage.stage)).toEqual([
      PostPipelineStage.SpacyParse,
      PostPipelineStage.Publish,
    ]);
  });

  it('returns nothing for an unknown id', async () => {
    const { items } = await suite.query(
      new GetPostPipelineStatusQuery(randomUUID(), 1),
    );

    expect(items).toEqual([]);
  });

  it('without an id lists only processing and failed posts, newest first, with failure details', async () => {
    const em = suite.orm.em;
    const now = DateTime.now();
    const older = factories(em).post.makeOne({
      status: PostStatus.Processing,
      createdAt: now.plus({ years: 50 }),
    });
    const failed = factories(em).post.makeOne({
      status: PostStatus.Failed,
      createdAt: now.plus({ years: 50, days: 1 }),
    });
    factories(em).post.makeOne({
      status: PostStatus.Published,
      createdAt: now.plus({ years: 50, days: 2 }),
    });
    factories(em).post.makeOne({
      status: PostStatus.Pending,
      createdAt: now.plus({ years: 50, days: 3 }),
    });
    factories(em).postPipelineRun.makeOne({
      postId: failed.id,
      stage: PostPipelineStage.AiExercises,
      status: PostPipelineRunStatus.Failed,
      errorMessage: 'invalid payload',
      retryCount: 3,
    });
    await em.flush();
    em.clear();

    const { items } = await suite.query(
      new GetPostPipelineStatusQuery(null, 2),
    );

    expect(items.map((item) => item.id)).toEqual([failed.id, older.id]);
    expect(items[0].stages).toEqual([
      {
        stage: PostPipelineStage.AiExercises,
        status: PostPipelineRunStatus.Failed,
        retryCount: 3,
        errorMessage: 'invalid payload',
      },
    ]);
    expect(items[1].stages).toEqual([]);
  });
});
