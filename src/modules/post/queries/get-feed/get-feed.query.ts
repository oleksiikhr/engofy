import { Query } from '@nestjs/cqrs';
import type { FeedView } from './feed-view.js';

export class GetFeedQuery extends Query<FeedView> {
  constructor(
    readonly limit: number,
    readonly offset: number,
  ) {
    super();
  }
}
