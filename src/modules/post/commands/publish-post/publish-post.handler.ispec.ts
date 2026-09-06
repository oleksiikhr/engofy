import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
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

async function seedPost(
  em: EntityManager,
  opts: { annotationCompleted?: boolean } = {},
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  em.persist(post);

  if (opts.annotationCompleted) {
    const run = new PostPipelineRun();
    run.postId = post.id;
    run.stage = PostPipelineStage.Annotation;
    run.status = PostPipelineRunStatus.Completed;
    em.persist(run);
  }

  await em.flush();
  return post.id;
}

describe('PublishPostHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });
  const queue = useQueueSpy(suite);

  it('publishes the post and enqueues a pending telegram publication', async () => {
    const postId = await seedPost(suite.orm.em, { annotationCompleted: true });

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
    const postId = await seedPost(suite.orm.em, { annotationCompleted: true });

    await suite.command(new PublishPostCommand(postId));
    await suite.command(new PublishPostCommand(postId));

    expect(await suite.orm.em.count(PostPublication, { postId })).toBe(1);
  });

  it('no-ops and re-queues itself until the annotation branch has completed (D6)', async () => {
    const postId = await seedPost(suite.orm.em);

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).not.toBe(PostStatus.Published);
    expect(await suite.orm.em.count(PostPublication, { postId })).toBe(0);
    expect(
      await suite.orm.em.count(PostPipelineRun, {
        postId,
        stage: PostPipelineStage.Publish,
      }),
    ).toBe(0);

    queue.assertSent(
      QueueName.PostPublish,
      (data: { postId: string }) => data.postId === postId,
    );
  });

  it('publishes once the annotation run flips to completed', async () => {
    const postId = await seedPost(suite.orm.em);

    await suite.command(new PublishPostCommand(postId));

    const annotationRun = new PostPipelineRun();
    annotationRun.postId = postId;
    annotationRun.stage = PostPipelineStage.Annotation;
    annotationRun.status = PostPipelineRunStatus.Completed;
    suite.orm.em.persist(annotationRun);
    await suite.orm.em.flush();

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Published);
  });
});
