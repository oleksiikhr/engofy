import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { PostStatus } from '../../enums/post-status.enum.js';
import { POSTS_SITEMAP_PAGE_SIZE } from '../posts-sitemap-page-size.js';
import { GetPostsSitemapPageQuery } from './get-posts-sitemap-page.query.js';
import type { PostsSitemapPageView } from './posts-sitemap-page-view.js';

interface PostRow {
  slug: string | null;
  short_id: string;
  content_updated_at: string;
}

// One sitemap page: published posts oldest-first, sliced by offset. The order
// is stable under inserts (new posts land at the end), unlike newest-first —
// see `GetPostsSitemapIndexHandler`. Served by the
// `(status, published_at, id)` index. Raw SQL (DP5) to select three columns
// without hydrating entities.
@QueryHandler(GetPostsSitemapPageQuery)
export class GetPostsSitemapPageHandler
  implements IQueryHandler<GetPostsSitemapPageQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    page,
  }: GetPostsSitemapPageQuery): Promise<PostsSitemapPageView> {
    const rows = await this.em.getConnection().execute<PostRow[]>(
      `SELECT slug, short_id, content_updated_at
         FROM posts
        WHERE status = ?
        ORDER BY published_at, id
        LIMIT ? OFFSET ?`,
      [
        PostStatus.Published,
        POSTS_SITEMAP_PAGE_SIZE,
        (page - 1) * POSTS_SITEMAP_PAGE_SIZE,
      ],
      'all',
      this.em.getTransactionContext(),
    );

    return {
      items: rows.map((row) => ({
        slug: row.slug,
        shortId: row.short_id,
        lastmod: toIso(row.content_updated_at),
      })),
    };
  }
}

function toIso(value: string): string {
  const dateTime = DateTime.fromSQL(value, { zone: 'utc' });
  return dateTime.toISO() ?? dateTime.toString();
}
