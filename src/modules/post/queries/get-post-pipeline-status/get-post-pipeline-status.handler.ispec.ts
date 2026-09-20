import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { GetPostPipelineStatusQuery } from './get-post-pipeline-status.query.js';

function seedPost(
  em: EntityManager,
  status: PostStatus,
  createdAt: DateTime,
): Post {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'seed';
  const post = new Post();
  post.source = source;
  post.title = `status ${randomUUID().slice(0, 8)}`;
  post.status = status;
  post.createdAt = createdAt;
  em.persist(post);
  return post;
}

describe('GetPostPipelineStatusHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns one post by id in any status, with its stages in pipeline order', async () => {
    const em = suite.orm.em;
    const post = seedPost(em, PostStatus.Published, DateTime.now());
    // Inserted out of pipeline order on purpose.
    em.create(PostPipelineRun, {
      postId: post.id,
      stage: PostPipelineStage.Publish,
      status: PostPipelineRunStatus.Completed,
    });
    em.create(PostPipelineRun, {
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
    const older = seedPost(em, PostStatus.Processing, now.plus({ years: 50 }));
    const failed = seedPost(
      em,
      PostStatus.Failed,
      now.plus({ years: 50, days: 1 }),
    );
    seedPost(em, PostStatus.Published, now.plus({ years: 50, days: 2 }));
    seedPost(em, PostStatus.Pending, now.plus({ years: 50, days: 3 }));
    em.create(PostPipelineRun, {
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
