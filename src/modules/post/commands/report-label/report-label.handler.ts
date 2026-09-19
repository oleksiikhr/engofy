import { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Post } from '../../entities/post.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { ReportLabelCommand } from './report-label.command.js';

// A reader flagged a word/phrase/grammar label as wrong. Recorded only as a
// structured log event (no table) — the signal for reviewing bad enrichment.
@CommandHandler(ReportLabelCommand)
export class ReportLabelHandler implements ICommandHandler<ReportLabelCommand> {
  private readonly logger = new Logger(ReportLabelHandler.name);

  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    shortId,
    kind,
    targetId,
  }: ReportLabelCommand): Promise<void> {
    const post = await this.em.findOne(
      Post,
      { shortId, status: PostStatus.Published },
      { disableIdentityMap: true },
    );
    if (!post) {
      throw new PostNotFoundError();
    }

    this.logger.warn(
      { event: 'reader_label_report', postId: post.id, userId, kind, targetId },
      'reader label reported as a mistake',
    );
  }
}
