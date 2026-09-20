import { DateTime } from 'luxon';
import { factories } from '../../../../../test/factories/factories.js';
import { seedPublishedPosts } from '../../../../../test/helpers/seed-published-posts.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { PostModule } from '../../post.module.js';
import { POSTS_SITEMAP_PAGE_SIZE } from '../posts-sitemap-page-size.js';
import { GetPostsSitemapIndexQuery } from './get-posts-sitemap-index.query.js';

describe('GetPostsSitemapIndexHandler', () => {
  const suite = createIntegrationSuite({ imports: [PostModule] });

  it('has no pages without published posts', async () => {
    factories(suite.orm.em).post.makeOne({ status: PostStatus.Pending });
    await suite.orm.em.flush();

    const view = await suite.query(new GetPostsSitemapIndexQuery());

    expect(view.pages).toEqual([]);
  });

  it('gives one page with the newest contentUpdatedAt while posts fit in a page', async () => {
    const em = suite.orm.em;
    const edited = DateTime.fromISO('2026-03-01T00:00:00Z');
    factories(em).post.makeOne({
      publishedAt: DateTime.fromISO('2026-01-01T00:00:00Z'),
      contentUpdatedAt: edited,
    });
    factories(em).post.makeOne({
      publishedAt: DateTime.fromISO('2026-02-01T00:00:00Z'),
      contentUpdatedAt: DateTime.fromISO('2026-02-01T00:00:00Z'),
    });
    await em.flush();

    const view = await suite.query(new GetPostsSitemapIndexQuery());

    expect(view.pages).toEqual([{ page: 1, lastmod: edited.toUTC().toISO() }]);
  });

  it('opens a new page every POSTS_SITEMAP_PAGE_SIZE posts', async () => {
    await seedPublishedPosts(suite.orm.em, POSTS_SITEMAP_PAGE_SIZE + 1);

    const view = await suite.query(new GetPostsSitemapIndexQuery());

    expect(view.pages.map((entry) => entry.page)).toEqual([1, 2]);
  });
});
