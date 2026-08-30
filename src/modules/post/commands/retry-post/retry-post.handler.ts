import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { Post } from '../../entities/post.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import type { PostSpacyParseJobData } from '../ingest-post/ingest-post.handler.js';
import { RetryPostCommand } from './retry-post.command.js';

// Full pipeline re-run for an existing post (PLAN.md §3.9 `/retry`). Every
// stage is idempotent on its PostPipelineRun row, so a clean re-run is just:
// drop those rows, reset status, re-enqueue the one entry-point job the
// ingest handler fires — spacy_parse, which fans out to annotation and the
// ai_* chain on completion (§5, §12).
@CommandHandler(RetryPostCommand)
export class RetryPostHandler implements ICommandHandler<RetryPostCommand> {
  private readonly logger = new Logger(RetryPostHandler.name);

  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: RetryPostCommand): Promise<void> {
    const { postId } = command;

    const post = await this.em.findOneOrFail(Post, postId);

    await this.em.nativeDelete(PostPipelineRun, { postId });
    post.status = PostStatus.Pending;

    this.outbox.send<PostSpacyParseJobData>(
      this.em,
      QueueName.PostSpacyParse,
      { postId },
      { singletonKey: postId },
    );

    this.logger.log({ postId }, 'pipeline re-run enqueued');
  }
}
