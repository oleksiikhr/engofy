import { Query } from '@nestjs/cqrs';
import type { PostSuggestionsView } from './post-suggestions-view.js';

export class GetPostSuggestionsQuery extends Query<PostSuggestionsView> {
  constructor(
    // Prefix the learner has typed so far; matched case-insensitively.
    readonly prefix: string,
    readonly limit: number,
  ) {
    super();
  }
}
