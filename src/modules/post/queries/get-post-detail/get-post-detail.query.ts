import { Query } from '@nestjs/cqrs';
import type { PostDetailView } from './post-detail-view.js';

// `shortId` is the trailing segment of the public `/posts/{slug}-{shortId}`
// URL, already extracted by parseSlugId at the controller.
export class GetPostDetailQuery extends Query<PostDetailView | null> {
  constructor(readonly shortId: string) {
    super();
  }
}
