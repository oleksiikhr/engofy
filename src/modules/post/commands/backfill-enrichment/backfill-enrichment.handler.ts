import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import type { PostAiEnrichmentJobData } from '../enrich-lexicon/enrich-lexicon.handler.js';
import {
  BackfillEnrichmentCommand,
  type BackfillEnrichmentResult,
} from './backfill-enrichment.command.js';

// One-off backfill (PLAN.md §17 Track A — A3): the `enrichment` stage was
// added after some posts had already been published, and `publish`'s branch
// gate (D6/F3-style) only re-checks a post still mid-pipeline — it never
// revisits one that's already `published`. This enqueues `post-ai-enrichment`
// for every published post that isn't already Completed for that stage.
// Re-running this is harmless: a stage retry is the same row-level gap-fill
// as a fresh post (enrich-lexicon.handler.ts), never a re-bill of an
// already-enriched word/phrase.
@CommandHandler(BackfillEnrichmentCommand)
export class BackfillEnrichmentHandler
  implements ICommandHandler<BackfillEnrichmentCommand>
{
  private readonly logger = new Logger(BackfillEnrichmentHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(): Promise<BackfillEnrichmentResult> {
    const publishedPostIds = (
      await this.em.find(
        Post,
        { status: PostStatus.Published },
        { fields: ['id'] },
      )
    ).map((post) => post.id);

    if (publishedPostIds.length === 0) {
      return { enqueued: 0 };
    }

    const completedRuns = await this.em.find(PostPipelineRun, {
      postId: { $in: publishedPostIds },
      stage: PostPipelineStage.Enrichment,
      status: PostPipelineRunStatus.Completed,
    });
    const completedPostIds = new Set(completedRuns.map((run) => run.postId));

    const pending = publishedPostIds.filter((id) => !completedPostIds.has(id));

    for (const postId of pending) {
      this.outbox.send<PostAiEnrichmentJobData>(
        this.em,
        QueueName.PostAiEnrichment,
        { postId },
        { singletonKey: postId },
      );
    }

    this.logger.log(
      { published: publishedPostIds.length, enqueued: pending.length },
      'ai_enrichment backfill enqueued',
    );

    return { enqueued: pending.length };
  }
}
