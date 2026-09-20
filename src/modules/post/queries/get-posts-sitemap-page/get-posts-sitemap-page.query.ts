import { Query } from '@nestjs/cqrs';
import type { PostsSitemapPageView } from './posts-sitemap-page-view.js';

export class GetPostsSitemapPageQuery extends Query<PostsSitemapPageView> {
  constructor(
    // 1-based page number from `GetPostsSitemapIndexQuery`.
    readonly page: number,
  ) {
    super();
  }
}
