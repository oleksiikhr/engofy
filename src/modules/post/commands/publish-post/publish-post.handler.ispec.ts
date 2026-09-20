import type { EntityManager } from '@mikro-orm/postgresql';
import { factories } from '../../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
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
  opts: {
    annotationCompleted?: boolean;
    enrichmentCompleted?: boolean;
    status?: PostStatus;
  } = {},
): Promise<string> {
  const post = factories(em).post.makeOne({
    source: { format: PostSourceFormat.Text, rawText: 'Some text.' },
    status: opts.status ?? PostStatus.Pending,
  });

  if (opts.annotationCompleted) {
    const _run = factories(em).postPipelineRun.makeOne({
      postId: post.id,
      stage: PostPipelineStage.Annotation,
      status: PostPipelineRunStatus.Completed,
    });
  }
  if (opts.enrichmentCompleted) {
    const _run = factories(em).postPipelineRun.makeOne({
      postId: post.id,
      stage: PostPipelineStage.Enrichment,
      status: PostPipelineRunStatus.Completed,
    });
  }

  await em.flush();
  return post.id;
}

describe('PublishPostHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });
  const queue = useQueueSpy(suite);

  it('publishes the post and enqueues a pending telegram publication', async () => {
    const postId = await seedPost(suite.orm.em, {
      annotationCompleted: true,
      enrichmentCompleted: true,
    });

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Published);
    expect(post.publishedAt).toBeTruthy();
    expect(post.contentUpdatedAt.toMillis()).toBe(post.publishedAt.toMillis());

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
    const postId = await seedPost(suite.orm.em, {
      annotationCompleted: true,
      enrichmentCompleted: true,
    });

    await suite.command(new PublishPostCommand(postId));
    await suite.command(new PublishPostCommand(postId));

    expect(await suite.orm.em.count(PostPublication, { postId })).toBe(1);
  });

  it('no-ops and re-queues itself until both the annotation and enrichment branches have completed', async () => {
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

  it('stays gated while only the annotation branch has completed', async () => {
    const postId = await seedPost(suite.orm.em, { annotationCompleted: true });

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).not.toBe(PostStatus.Published);
  });

  it('stays gated while only the enrichment branch has completed', async () => {
    const postId = await seedPost(suite.orm.em, { enrichmentCompleted: true });

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).not.toBe(PostStatus.Published);
  });

  it('publishes once both the annotation and enrichment runs flip to completed', async () => {
    const postId = await seedPost(suite.orm.em);

    await suite.command(new PublishPostCommand(postId));

    const _annotationRun = suite.factories.postPipelineRun.makeOne({
      postId,
      stage: PostPipelineStage.Annotation,
      status: PostPipelineRunStatus.Completed,
    });

    const _enrichmentRun = suite.factories.postPipelineRun.makeOne({
      postId,
      stage: PostPipelineStage.Enrichment,
      status: PostPipelineRunStatus.Completed,
    });

    await suite.orm.em.flush();

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Published);
  });

  it('stops without re-queueing when the post has failed', async () => {
    const postId = await seedPost(suite.orm.em, {
      status: PostStatus.Failed,
      annotationCompleted: true,
    });

    await suite.command(new PublishPostCommand(postId));

    const post = await suite.orm.em.findOneOrFail(Post, postId);
    expect(post.status).toBe(PostStatus.Failed);
    expect(await suite.orm.em.count(PostPublication, { postId })).toBe(0);
    queue.assertNotSent(QueueName.PostPublish);
  });

  it('stops without re-queueing when the post no longer exists', async () => {
    await suite.command(
      new PublishPostCommand('01900000-0000-7000-8000-000000000000'),
    );

    queue.assertNotSent(QueueName.PostPublish);
  });

  it('keeps re-queueing while a branch run is failed but the post is still processing', async () => {
    const postId = await seedPost(suite.orm.em, {
      status: PostStatus.Processing,
      annotationCompleted: true,
    });
    const _run = suite.factories.postPipelineRun.makeOne({
      postId,
      stage: PostPipelineStage.Enrichment,
      status: PostPipelineRunStatus.Failed,
    });
    await suite.orm.em.flush();

    await suite.command(new PublishPostCommand(postId));

    queue.assertSent(
      QueueName.PostPublish,
      (data: { postId: string }) => data.postId === postId,
    );
  });
});
