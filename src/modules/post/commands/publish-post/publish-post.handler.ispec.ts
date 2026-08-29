import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPublication } from '../../entities/post-publication.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PublicationPlatform } from '../../enums/publication-platform.enum.js';
import { PublicationStatus } from '../../enums/publication-status.enum.js';
import { PostModule } from '../../post.module.js';
import { PublishPostCommand } from './publish-post.command.js';

async function seedPost(em: EntityManager): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  em.persist(post);
  await em.flush();
  return post.id;
}

describe('PublishPostHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('publishes the post and enqueues a pending telegram publication', async () => {
    const postId = await seedPost(suite.orm.em);

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Published);
    expect(post.publishedAt).toBeTruthy();

    const publications = await suite.orm.em.find(PostPublication, { postId });
    expect(publications).toHaveLength(1);
    expect(publications[0]).toMatchObject({
      platform: PublicationPlatform.Telegram,
      status: PublicationStatus.Pending,
    });

    const run = await suite.orm.em.findOneOrFail(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Publish,
    });
    expect(run.status).toBe(PostPipelineRunStatus.Completed);
  });

  it('is idempotent — a second run keeps one publication row', async () => {
    const postId = await seedPost(suite.orm.em);

    await suite.command(new PublishPostCommand(postId));
    await suite.command(new PublishPostCommand(postId));

    expect(await suite.orm.em.count(PostPublication, { postId })).toBe(1);
  });
});
