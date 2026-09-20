import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Post } from '../../entities/post.entity.js';
import { PostRead } from '../../entities/post-read.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { UnmarkPostReadCommand } from './unmark-post-read.command.js';

// Reverts `MarkPostReadCommand` — the reader's "Mark as unread" control.
// Idempotent: a post that isn't marked read is a silent no-op.
@CommandHandler(UnmarkPostReadCommand)
export class UnmarkPostReadHandler
  implements ICommandHandler<UnmarkPostReadCommand>
{
  constructor(private readonly em: EntityManager) {}

  async execute({ userId, shortId }: UnmarkPostReadCommand): Promise<void> {
    const post = await this.em.findOne(Post, {
      shortId,
      status: PostStatus.Published,
    });
    if (!post) {
      throw new PostNotFoundError();
    }

    const read = await this.em.findOne(PostRead, { userId, postId: post.id });
    if (read) {
      this.em.remove(read);
    }
  }
}
