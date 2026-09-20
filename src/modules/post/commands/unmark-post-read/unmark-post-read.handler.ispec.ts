import type { EntityManager } from '@mikro-orm/postgresql';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostRead } from '../../entities/post-read.entity.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostNotFoundError } from '../../errors/post-not-found.error.js';
import { PostModule } from '../../post.module.js';
import { MarkPostReadCommand } from '../mark-post-read/mark-post-read.command.js';
import { UnmarkPostReadCommand } from './unmark-post-read.command.js';

async function seedPost(
  em: EntityManager,
  status: PostStatus,
): Promise<string> {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.rawText = 'Some text.';
  const post = new Post();
  post.source = source;
  post.status = status;
  em.persist(post);
  await em.flush();
  return post.shortId;
}

describe('UnmarkPostReadHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('removes the post_reads row for the user and post', async () => {
    const shortId = await seedPost(suite.orm.em, PostStatus.Published);
    const userId = uuidv7();
    await suite.command(new MarkPostReadCommand(userId, shortId));

    await suite.command(new UnmarkPostReadCommand(userId, shortId));

    const post = await suite.orm.em.findOneOrFail(Post, { shortId });
    expect(
      await suite.orm.em.count(PostRead, { userId, postId: post.id }),
    ).toBe(0);
  });

  it("leaves another user's read record alone", async () => {
    const shortId = await seedPost(suite.orm.em, PostStatus.Published);
    const userId = uuidv7();
    const otherUserId = uuidv7();
    await suite.command(new MarkPostReadCommand(userId, shortId));
    await suite.command(new MarkPostReadCommand(otherUserId, shortId));

    await suite.command(new UnmarkPostReadCommand(userId, shortId));

    const post = await suite.orm.em.findOneOrFail(Post, { shortId });
    expect(
      await suite.orm.em.count(PostRead, {
        userId: otherUserId,
        postId: post.id,
      }),
    ).toBe(1);
  });

  it('is idempotent — unmarking a post that was never read is a no-op', async () => {
    const shortId = await seedPost(suite.orm.em, PostStatus.Published);

    await suite.command(new UnmarkPostReadCommand(uuidv7(), shortId));
    await suite.command(new UnmarkPostReadCommand(uuidv7(), shortId));
  });

  it('throws PostNotFoundError for an unpublished post', async () => {
    const shortId = await seedPost(suite.orm.em, PostStatus.Pending);

    await expect(
      suite.command(new UnmarkPostReadCommand(uuidv7(), shortId)),
    ).rejects.toThrow(PostNotFoundError);
  });
});
