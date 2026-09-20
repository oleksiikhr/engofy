import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { Post } from '../../entities/post.entity.js';
import { PostRead } from '../../entities/post-read.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { PostModule } from '../../post.module.js';
import { MarkPostReadCommand } from './mark-post-read.command.js';

describe('MarkPostReadHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('creates a post_reads row for the user and post', async () => {
    const { shortId } = await suite.factories.post.createOne({
      status: PostStatus.Published,
    });
    const userId = uuidv7();

    await suite.command(new MarkPostReadCommand(userId, shortId));

    const post = await suite.orm.em.findOneOrFail(Post, { shortId });
    const read = await suite.orm.em.findOneOrFail(PostRead, {
      userId,
      postId: post.id,
    });
    expect(read.readAt).toBeTruthy();
  });

  it('is idempotent — a second submit keeps one row', async () => {
    const { shortId } = await suite.factories.post.createOne({
      status: PostStatus.Published,
    });
    const userId = uuidv7();

    await suite.command(new MarkPostReadCommand(userId, shortId));
    await suite.command(new MarkPostReadCommand(userId, shortId));

    const post = await suite.orm.em.findOneOrFail(Post, { shortId });
    expect(
      await suite.orm.em.count(PostRead, { userId, postId: post.id }),
    ).toBe(1);
  });

  it('throws PostNotFoundError for an unpublished post', async () => {
    const { shortId } = await suite.factories.post.createOne({
      status: PostStatus.Pending,
    });

    await expect(
      suite.command(new MarkPostReadCommand(uuidv7(), shortId)),
    ).rejects.toThrow(PostNotFoundError);
  });
});
