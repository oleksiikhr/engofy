import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostPublication } from '../../entities/post-publication.entity.js';
import { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PublicationPlatform } from '../../enums/publication-platform.enum.js';
import { PublicationStatus } from '../../enums/publication-status.enum.js';
import { PublishPostCommand } from './publish-post.command.js';

export interface PostPublishJobData {
  postId: string;
}

// How long to wait before re-checking the annotation branch when publish is
// still gated (D6).
const PUBLISH_GATE_RETRY_SECONDS = 30;

// publish stage (PLAN.md §5): the terminal pipeline step. Flips
// posts.status = published and enqueues a pending post_publications row per
// target channel — V1 only telegram (§3.8, §10); the actual send is the
// Telegram bot's job (Slice 5). Idempotent via the stage-level
// PostPipelineRun row (§12); the publication upsert is 'ignore' on conflict
// so a re-run never resets a row a later send step already advanced.
//
// publish sits at the end of the ai_* branch, but the parallel annotation
// and enrichment branches (word/phrase inline markup, word/phrase
// definitions) fan out from spacy_parse/annotation completion and never
// rejoin on their own. So publish is where all branches meet: it no-ops and
// re-queues itself until BOTH the annotation stage (D6) and the enrichment
// stage (PLAN.md §17 Track A) have Completed, otherwise a post could go
// feed-visible with its inline annotations or lexicon definitions still
// missing / failed.
@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  private readonly logger = new Logger(PublishPostHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: PublishPostCommand): Promise<void> {
    const { postId } = command;

    const existingRun = await this.em.findOne(PostPipelineRun, {
      postId,
      stage: PostPipelineStage.Publish,
    });
    if (existingRun?.status === PostPipelineRunStatus.Completed) {
      return;
    }

    const [annotationRun, enrichmentRun] = await Promise.all([
      this.em.findOne(PostPipelineRun, {
        postId,
        stage: PostPipelineStage.Annotation,
      }),
      this.em.findOne(PostPipelineRun, {
        postId,
        stage: PostPipelineStage.Enrichment,
      }),
    ]);
    if (
      annotationRun?.status !== PostPipelineRunStatus.Completed ||
      enrichmentRun?.status !== PostPipelineRunStatus.Completed
    ) {
      // One of the branches hasn't finished — don't publish yet. Re-queue a
      // delayed publish so every branch rejoins once it does.
      this.outbox.send<PostPublishJobData>(
        this.em,
        QueueName.PostPublish,
        { postId },
        { singletonKey: postId, startAfter: PUBLISH_GATE_RETRY_SECONDS },
      );
      this.logger.log(
        { postId },
        'publish gated on annotation/enrichment branches',
      );
      return;
    }

    const post = await this.em.findOneOrFail(Post, postId);
    post.status = PostStatus.Published;
    post.publishedAt = DateTime.now();

    await this.em.upsert(
      PostPublication,
      {
        id: uuidv7(),
        postId,
        platform: PublicationPlatform.Telegram,
        status: PublicationStatus.Pending,
      },
      {
        onConflictFields: ['postId', 'platform'],
        onConflictAction: 'ignore',
      },
    );

    this.logger.log({ postId }, 'post published');

    const run = existingRun ?? new PostPipelineRun();
    run.postId = postId;
    run.stage = PostPipelineStage.Publish;
    run.status = PostPipelineRunStatus.Completed;
    run.completedAt = DateTime.now();
    this.em.persist(run);
  }
}
