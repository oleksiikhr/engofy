import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { Post } from '../../entities/post.entity.js';
import { PostRead } from '../../entities/post-read.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { MarkPostReadCommand } from './mark-post-read.command.js';

// Marks a post read by the current user (PLAN.md §16/§17 Track B) — the
// reader's "Mark as read" button, scrolling to the end of the article, or
// finishing study mode; never a score. Idempotent: a re-submit is a silent no-op, the original
// `readAt` is kept. No consumer reads `post_reads` yet (groundwork for feed
// dedup); this never touches SRS.
@CommandHandler(MarkPostReadCommand)
export class MarkPostReadHandler
  implements ICommandHandler<MarkPostReadCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({ userId, shortId }: MarkPostReadCommand): Promise<void> {
    const post = await this.em.findOne(Post, {
      shortId,
      status: PostStatus.Published,
    });
    if (!post) {
      throw new PostNotFoundError();
    }

    await this.em.upsert(
      PostRead,
      { id: uuidv7(), userId, postId: post.id, readAt: DateTime.now() },
      { onConflictFields: ['userId', 'postId'], onConflictAction: 'ignore' },
    );
  }
}
