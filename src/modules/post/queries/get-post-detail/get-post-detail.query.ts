import { Query } from '@nestjs/cqrs';
import {
  type ContentLanguage,
  DEFAULT_CONTENT_LANGUAGE,
} from '../../enums/content-language.enum.js';
import type { PostDetailView } from './post-detail-view.js';

// `shortId` is the trailing segment of the public `/posts/{slug}-{shortId}`
// URL, already extracted by parseSlugId at the controller. `userId` is null
// for a guest (the route is @Public()) — the sidebar's per-entry state is
// then always LearningCardState.New, no LearningCard join. `lang` is the
// language translations are served in.
export class GetPostDetailQuery extends Query<PostDetailView | null> {
  constructor(
    readonly shortId: string,
    readonly userId: string | null = null,
    readonly lang: ContentLanguage = DEFAULT_CONTENT_LANGUAGE,
  ) {
    super();
  }
}
