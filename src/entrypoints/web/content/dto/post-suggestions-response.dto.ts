export class PostSuggestionDto {
  readonly type!: 'word' | 'phrase';

  // Pass back as the `/content/posts` `term` filter.
  readonly text!: string;
}

export class PostSuggestionsResponseDto {
  readonly items!: PostSuggestionDto[];
}
