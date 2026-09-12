import type { EntityManager } from '@mikro-orm/postgresql';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { BackfillEnrichmentCommand } from './backfill-enrichment.command.js';

async function seedPost(
  em: EntityManager,
  opts: { status: PostStatus; enrichmentCompleted?: boolean },
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = opts.status;
  em.persist(post);

  if (opts.enrichmentCompleted) {
    const run = new PostPipelineRun();
    run.postId = post.id;
    run.stage = PostPipelineStage.Enrichment;
    run.status = PostPipelineRunStatus.Completed;
    em.persist(run);
  }

  await em.flush();
  return post.id;
}

describe('BackfillEnrichmentHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });
  const queue = useQueueSpy(suite);

  it('enqueues enrichment for a published post with no completed run', async () => {
    const postId = await seedPost(suite.orm.em, {
      status: PostStatus.Published,
    });

    const result = await suite.command(new BackfillEnrichmentCommand());

    expect(result.enqueued).toBeGreaterThanOrEqual(1);
    queue.assertSent<{ postId: string }>(
      QueueName.PostAiEnrichment,
      (d) => d.postId === postId,
    );
  });

  it('skips a published post whose enrichment run is already completed', async () => {
    const postId = await seedPost(suite.orm.em, {
      status: PostStatus.Published,
      enrichmentCompleted: true,
    });

    await suite.command(new BackfillEnrichmentCommand());

    expect(() =>
      queue.assertSent<{ postId: string }>(
        QueueName.PostAiEnrichment,
        (d) => d.postId === postId,
      ),
    ).toThrow();
  });

  it('ignores posts that are not published', async () => {
    const postId = await seedPost(suite.orm.em, { status: PostStatus.Pending });

    await suite.command(new BackfillEnrichmentCommand());

    expect(() =>
      queue.assertSent<{ postId: string }>(
        QueueName.PostAiEnrichment,
        (d) => d.postId === postId,
      ),
    ).toThrow();
  });
});
