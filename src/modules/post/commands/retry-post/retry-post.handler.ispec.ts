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
import { RetryPostCommand } from './retry-post.command.js';

async function seedProcessedPost(em: EntityManager): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = PostStatus.Published;
  em.persist(post);

  for (const [stage, status] of [
    [PostPipelineStage.SpacyParse, PostPipelineRunStatus.Completed],
    [PostPipelineStage.AiGrammar, PostPipelineRunStatus.Failed],
  ] as const) {
    const run = new PostPipelineRun();
    run.postId = post.id;
    run.stage = stage;
    run.status = status;
    run.completedAt = DateTime.now();
    em.persist(run);
  }

  await em.flush();
  return post.id;
}

describe('RetryPostHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('clears the pipeline runs and resets the post to pending', async () => {
    const postId = await seedProcessedPost(suite.orm.em);

    await suite.command(new RetryPostCommand(postId));

    expect(await suite.orm.em.count(PostPipelineRun, { postId })).toBe(0);
    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Pending);
  });

  it('throws when the post does not exist', async () => {
    await expect(
      suite.command(
        new RetryPostCommand('01920000-0000-7000-8000-000000000000'),
      ),
    ).rejects.toThrow();
  });
});
