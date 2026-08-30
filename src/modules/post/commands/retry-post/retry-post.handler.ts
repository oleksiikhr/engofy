import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { Exercise } from '../../entities/exercise.entity.js';
import { GrammarMatch } from '../../entities/grammar-match.entity.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPipelineRun } from '../../entities/post-pipeline-run.entity.js';
import { Sentence } from '../../entities/sentence.entity.js';
import { SentenceToken } from '../../entities/sentence-token.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import type { PostSpacyParseJobData } from '../ingest-post/ingest-post.handler.js';
import { RetryPostCommand } from './retry-post.command.js';

// Full pipeline re-run for an existing post (PLAN.md §3.9 `/retry`). A retry is
// always a from-scratch reprocess — never a resume of unfinished stages (D5).
// The stage-level idempotency guards (PostPipelineRun row) are not enough:
// spacy_parse skips a PostPart that already has Sentence rows and annotate
// skips a PostPart with `annotatedAt` set, so a bad parse / annotation would
// silently survive. So we drop every downstream artefact and null
// `PostPart.annotatedAt`, then re-enqueue the one entry-point job the ingest
// handler fires — spacy_parse, which fans back out to annotation and the ai_*
// chain on completion (§5, §12).
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

    const sentenceIds = (
      await this.em.find(Sentence, { postId }, { fields: ['id'] })
    ).map((sentence) => sentence.id);

    if (sentenceIds.length > 0) {
      await this.em.nativeDelete(SentenceToken, {
        sentenceId: { $in: sentenceIds },
      });
      await this.em.nativeDelete(GrammarMatch, {
        sentenceId: { $in: sentenceIds },
      });
    }
    await this.em.nativeDelete(Sentence, { postId });
    await this.em.nativeDelete(Exercise, { postId });
    await this.em.nativeDelete(PostPipelineRun, { postId });

    const parts = await this.em.find(PostPart, { postId });
    for (const part of parts) {
      part.annotatedAt = null;
    }

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
