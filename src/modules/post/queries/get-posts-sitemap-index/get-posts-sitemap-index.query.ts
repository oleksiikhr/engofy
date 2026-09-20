import { Query } from '@nestjs/cqrs';
import type { PostsSitemapIndexView } from './posts-sitemap-index-view.js';

export class GetPostsSitemapIndexQuery extends Query<PostsSitemapIndexView> {}
