import { Query } from '@nestjs/cqrs';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type { PostsListView } from './posts-list-view.js';

export interface GetPostsListOptions {
  // Restrict to these CEFR levels; omit/empty = every level.
  cefrLevels?: CefrLevel[];
  // Excludes posts the user has already read (`post_reads`). Ignored when
  // `userId` is null — a guest has no read state to filter on.
  unreadOnly?: boolean;
  // Keep only posts that contain this word (any inflected form, matched via
  // its lemma) or phrase; case-insensitive exact match on `words.lemma` /
  // `phrases.phrase_text`. Blank = no filter.
  term?: string;
  cursor?: string;
  limit: number;
}

export class GetPostsListQuery extends Query<PostsListView> {
  constructor(
    readonly userId: string | null,
    readonly options: GetPostsListOptions,
  ) {
    super();
  }
}
