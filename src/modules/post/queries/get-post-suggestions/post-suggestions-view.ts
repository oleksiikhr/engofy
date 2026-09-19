export interface PostSuggestionView {
  type: 'word' | 'phrase';
  // `words.lemma` / `phrases.phrase_text` — pass back as the `/posts` `term`.
  text: string;
}

export interface PostSuggestionsView {
  items: PostSuggestionView[];
}
