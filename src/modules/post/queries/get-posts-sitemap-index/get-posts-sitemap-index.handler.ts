import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { PostStatus } from '../../enums/post-status.enum.js';
import { POSTS_SITEMAP_PAGE_SIZE } from '../posts-sitemap-page-size.js';
import { GetPostsSitemapIndexQuery } from './get-posts-sitemap-index.query.js';
import type { PostsSitemapIndexView } from './posts-sitemap-index-view.js';

interface PageRow {
  page: number;
  // Raw driver output for a `timestamp with time zone` aggregate is text.
  lastmod: string;
}

// Backs the sitemap index: published posts are numbered oldest-first (the same
// order `GetPostsSitemapPageHandler` slices by) and bucketed into fixed-size
// pages, so a page's URL and boundaries stay put as newer posts append to the
// last one. Raw SQL (DP5): a window function + GROUP BY the ORM can't express.
@QueryHandler(GetPostsSitemapIndexQuery)
export class GetPostsSitemapIndexHandler
  implements IQueryHandler<GetPostsSitemapIndexQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute(): Promise<PostsSitemapIndexView> {
    const rows = await this.em.getConnection().execute<PageRow[]>(
      `SELECT (numbered.rn - 1) / ? + 1 AS page,
              max(numbered.content_updated_at) AS lastmod
         FROM (SELECT content_updated_at,
                      row_number() OVER (ORDER BY published_at, id) AS rn
                 FROM posts
                WHERE status = ?) numbered
        GROUP BY 1
        ORDER BY 1`,
      [POSTS_SITEMAP_PAGE_SIZE, PostStatus.Published],
      'all',
      this.em.getTransactionContext(),
    );

    return {
      pages: rows.map((row) => ({
        page: Number(row.page),
        lastmod: toIso(row.lastmod),
      })),
    };
  }
}

function toIso(value: string): string {
  const dateTime = DateTime.fromSQL(value, { zone: 'utc' });
  return dateTime.toISO() ?? dateTime.toString();
}
