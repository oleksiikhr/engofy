import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostPartKind } from '../../enums/post-part-kind.enum.js';
import { PostSourceFormat } from '../../enums/post-source-format.enum.js';
import { PostSourceType } from '../../enums/post-source-type.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { GetFeedQuery } from './get-feed.query.js';

function seedPost(
  em: EntityManager,
  opts: {
    title: string;
    status?: PostStatus;
    publishedAt?: DateTime;
    blocks?: string[];
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
  if (opts.publishedAt) {
    post.publishedAt = opts.publishedAt;
  }
  em.persist(post);

  (opts.blocks ?? [opts.title]).forEach((text, index) => {
    em.create(PostPart, {
      postId: post.id,
      blockIndex: index,
      kind: PostPartKind.Paragraph,
      body: { type: 'paragraph', children: [{ type: 'text', text }] },
    });
  });

  return post;
}

describe('GetFeedHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('returns only published posts, newest first, breaking a publishedAt tie by id desc', async () => {
    const em = suite.orm.em;
    const at = DateTime.now().minus({ minutes: 5 });

    seedPost(em, { title: 'draft', status: PostStatus.Pending });
    const older = seedPost(em, {
      title: 'older',
      publishedAt: DateTime.now().minus({ hours: 1 }),
    });
    // Two posts published in the same instant — id desc is the tie-break.
    const tieA = seedPost(em, { title: 'tie-a', publishedAt: at });
    const tieB = seedPost(em, { title: 'tie-b', publishedAt: at });
    await em.flush();
    em.clear();

    const view = await suite.query(new GetFeedQuery(10, 0));

    expect(view.items.map((i) => i.title)).not.toContain('draft');
    const [first, second, third] = view.items;
    const higherTieId = tieA.id > tieB.id ? 'tie-a' : 'tie-b';
    const lowerTieId = tieA.id > tieB.id ? 'tie-b' : 'tie-a';
    expect(first.title).toBe(higherTieId);
    expect(second.title).toBe(lowerTieId);
    expect(third.title).toBe('older');
    expect(third.shortId).toBe(older.shortId);
  });

  it('computes nextOffset from the total, not the page size', async () => {
    const em = suite.orm.em;
    for (let i = 0; i < 3; i++) {
      seedPost(em, {
        title: `p${i}`,
        publishedAt: DateTime.now().minus({ minutes: i }),
      });
    }
    await em.flush();
    em.clear();

    const firstPage = await suite.query(new GetFeedQuery(2, 0));
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextOffset).toBe(2);

    const lastPage = await suite.query(new GetFeedQuery(2, 2));
    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.nextOffset).toBeNull();
  });

  it('builds the excerpt from the leading blocks and truncates on a word boundary', async () => {
    const em = suite.orm.em;
    const long = 'lorem ipsum dolor sit amet '.repeat(20).trim();
    const post = seedPost(em, {
      title: 'excerpted',
      publishedAt: DateTime.now(),
      blocks: ['First block.', long],
    });
    await em.flush();
    em.clear();

    const view = await suite.query(new GetFeedQuery(10, 0));
    const item = view.items.find((i) => i.shortId === post.shortId);

    expect(item?.excerpt.startsWith('First block. lorem ipsum')).toBe(true);
    expect(item?.excerpt.endsWith('…')).toBe(true);
    expect(item?.excerpt.length).toBeLessThanOrEqual(281);
    expect(item?.excerpt).not.toContain('  ');
  });
});
