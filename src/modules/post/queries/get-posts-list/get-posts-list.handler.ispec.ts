import { randomUUID } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostRead } from '../../entities/post-read.entity.js';
import { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostSourceType } from '../../enums/post-source-type.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { InvalidPostsListCursorError } from '../../errors/invalid-posts-list-cursor.error.js';
import { PostModule } from '../../post.module.js';
import { GetPostsListQuery } from './get-posts-list.query.js';

function seedPost(
  em: EntityManager,
  opts: {
    title: string;
    status?: PostStatus;
    cefrLevel?: CefrLevel;
    publishedAt?: DateTime;
  },
): Post {
  const source = new PostSource();
  source.format = PostSourceFormat.Text;
  source.type = PostSourceType.Original;
  source.rawText = 'seed';
  source.attributionText = 'Original content';

  const post = new Post();
  post.source = source;
  post.title = opts.title;
  post.status = opts.status ?? PostStatus.Published;
  post.cefrLevel = opts.cefrLevel;
  if (opts.publishedAt) {
    post.publishedAt = opts.publishedAt;
  }
  em.persist(post);

  em.create(PostPart, {
    postId: post.id,
    blockIndex: 0,
    kind: PostPartKind.Paragraph,
    body: { type: 'paragraph', children: [{ type: 'text', text: opts.title }] },
  });

  return post;
}

describe('GetPostsListHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns only published posts, newest first, breaking a publishedAt tie by id desc', async () => {
    const em = suite.orm.em;
    const at = DateTime.now().minus({ minutes: 5 });

    seedPost(em, { title: 'draft', status: PostStatus.Pending });
    const older = seedPost(em, {
      title: 'older',
      publishedAt: DateTime.now().minus({ hours: 1 }),
    });
    const tieA = seedPost(em, { title: 'tie-a', publishedAt: at });
    const tieB = seedPost(em, { title: 'tie-b', publishedAt: at });
    await em.flush();
    em.clear();

    const view = await suite.query(new GetPostsListQuery(null, { limit: 10 }));

    expect(view.items.map((i) => i.title)).not.toContain('draft');
    const [first, second, third] = view.items;
    const higherTieId = tieA.id > tieB.id ? 'tie-a' : 'tie-b';
    const lowerTieId = tieA.id > tieB.id ? 'tie-b' : 'tie-a';
    expect(first.title).toBe(higherTieId);
    expect(second.title).toBe(lowerTieId);
    expect(third.title).toBe('older');
    expect(third.shortId).toBe(older.shortId);
    expect(view.nextCursor).toBeNull();
    expect(first.excerpt).toBeTruthy();
  });

  it('filters by a CEFR multi-select', async () => {
    const em = suite.orm.em;
    seedPost(em, { title: 'a1-post', cefrLevel: CefrLevel.A1 });
    seedPost(em, { title: 'b1-post', cefrLevel: CefrLevel.B1 });
    seedPost(em, { title: 'c1-post', cefrLevel: CefrLevel.C1 });
    await em.flush();
    em.clear();

    const view = await suite.query(
      new GetPostsListQuery(null, {
        cefrLevels: [CefrLevel.A1, CefrLevel.B1],
        limit: 10,
      }),
    );

    expect(view.items.map((i) => i.title).sort()).toEqual([
      'a1-post',
      'b1-post',
    ]);
  });

  it('paginates by cursor with no gaps or duplicates across pages', async () => {
    const em = suite.orm.em;
    const titles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const title = `post-${i}`;
      titles.push(title);
      seedPost(em, {
        title,
        publishedAt: DateTime.now().minus({ minutes: i }),
      });
    }
    await em.flush();
    em.clear();

    const firstPage = await suite.query(
      new GetPostsListQuery(null, { limit: 2 }),
    );
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await suite.query(
      new GetPostsListQuery(null, {
        limit: 2,
        cursor: firstPage.nextCursor ?? undefined,
      }),
    );
    expect(secondPage.items).toHaveLength(2);
    expect(secondPage.nextCursor).not.toBeNull();

    const thirdPage = await suite.query(
      new GetPostsListQuery(null, {
        limit: 2,
        cursor: secondPage.nextCursor ?? undefined,
      }),
    );
    expect(thirdPage.items).toHaveLength(1);
    expect(thirdPage.nextCursor).toBeNull();

    // `post-0` is published most recently (offset `minutes: 0`), `post-4`
    // least recently — `titles` is already newest-first insertion order.
    const seenTitles = [
      ...firstPage.items,
      ...secondPage.items,
      ...thirdPage.items,
    ].map((i) => i.title);
    expect(seenTitles).toEqual(titles);
  });

  it('excludes already-read posts only when unreadOnly is requested for a logged-in user', async () => {
    const em = suite.orm.em;
    const userId = randomUUID();
    const read = seedPost(em, { title: 'read-post' });
    seedPost(em, { title: 'unread-post' });
    await em.flush();
    em.create(PostRead, { userId, postId: read.id, readAt: DateTime.now() });
    await em.flush();
    em.clear();

    const guestView = await suite.query(
      new GetPostsListQuery(null, { unreadOnly: true, limit: 10 }),
    );
    expect(guestView.items.map((i) => i.title).sort()).toEqual([
      'read-post',
      'unread-post',
    ]);

    const loggedInAll = await suite.query(
      new GetPostsListQuery(userId, { limit: 10 }),
    );
    expect(loggedInAll.items.map((i) => i.title).sort()).toEqual([
      'read-post',
      'unread-post',
    ]);

    const unreadOnly = await suite.query(
      new GetPostsListQuery(userId, { unreadOnly: true, limit: 10 }),
    );
    expect(unreadOnly.items.map((i) => i.title)).toEqual(['unread-post']);
  });

  it('throws InvalidPostsListCursorError on a garbage cursor', async () => {
    await expect(
      suite.query(
        new GetPostsListQuery(null, { cursor: 'not-a-real-cursor', limit: 10 }),
      ),
    ).rejects.toThrow(InvalidPostsListCursorError);
  });
});
