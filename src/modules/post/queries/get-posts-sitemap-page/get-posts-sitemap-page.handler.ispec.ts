import { DateTime } from 'luxon';
import { factories } from '../../../../../test/factories/factories.js';
import { seedPublishedPosts } from '../../../../../test/helpers/seed-published-posts.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { POSTS_SITEMAP_PAGE_SIZE } from '../posts-sitemap-page-size.js';
import { GetPostsSitemapPageQuery } from './get-posts-sitemap-page.query.js';

describe('GetPostsSitemapPageHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('lists only published posts oldest-first, with lastmod from contentUpdatedAt', async () => {
    const em = suite.orm.em;
    const older = DateTime.fromISO('2026-01-01T00:00:00Z');
    const newer = DateTime.fromISO('2026-02-01T00:00:00Z');
    const edited = DateTime.fromISO('2026-03-01T00:00:00Z');

    const second = factories(em).post.makeOne({
      slug: 'second',
      publishedAt: newer,
      contentUpdatedAt: newer,
    });
    const first = factories(em).post.makeOne({
      slug: null,
      publishedAt: older,
      contentUpdatedAt: edited,
    });
    factories(em).post.makeOne({
      status: PostStatus.Pending,
      publishedAt: older,
    });
    factories(em).post.makeOne({
      status: PostStatus.Failed,
      publishedAt: older,
    });
    await em.flush();

    const view = await suite.query(new GetPostsSitemapPageQuery(1));

    expect(view.items).toEqual([
      { slug: null, shortId: first.shortId, lastmod: edited.toUTC().toISO() },
      {
        slug: 'second',
        shortId: second.shortId,
        lastmod: newer.toUTC().toISO(),
      },
    ]);
  });

  it('returns an empty page past the last one', async () => {
    factories(suite.orm.em).post.makeOne();
    await suite.orm.em.flush();

    const view = await suite.query(new GetPostsSitemapPageQuery(2));

    expect(view.items).toEqual([]);
  });

  it('slices by page size and keeps earlier pages stable as newer posts arrive', async () => {
    const em = suite.orm.em;
    await seedPublishedPosts(em, POSTS_SITEMAP_PAGE_SIZE + 1);

    const firstPage = await suite.query(new GetPostsSitemapPageQuery(1));
    const secondPage = await suite.query(new GetPostsSitemapPageQuery(2));
    expect(firstPage.items).toHaveLength(POSTS_SITEMAP_PAGE_SIZE);
    expect(secondPage.items).toHaveLength(1);

    const newest = factories(em).post.makeOne({
      publishedAt: DateTime.now().plus({ days: 1 }),
    });
    await em.flush();

    const firstAfter = await suite.query(new GetPostsSitemapPageQuery(1));
    const secondAfter = await suite.query(new GetPostsSitemapPageQuery(2));
    expect(firstAfter.items).toEqual(firstPage.items);
    expect(secondAfter.items.map((item) => item.shortId)).toEqual([
      secondPage.items[0]?.shortId,
      newest.shortId,
    ]);
  });
});
