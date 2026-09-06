import { PostSourceType } from '../enums/post-source-type.enum.js';

// `attribution_text` is NOT NULL (PLAN.md §9): every post must state where its
// text came from. When the ingest caller does not pass an explicit line, fall
// back to the source link, then to a generic label keyed on the source type so
// the stored value is always non-empty and readable on the page.
const FALLBACK_BY_TYPE: Record<PostSourceType, string> = {
  [PostSourceType.Original]: 'Original content',
  [PostSourceType.Excerpt]: 'Excerpt (source unknown)',
  [PostSourceType.RedditComment]: 'Reddit comment',
  [PostSourceType.NewsSnippet]: 'News snippet (source unknown)',
};

export function deriveAttributionText(input: {
  attributionText?: string | null;
  link?: string | null;
  sourceType: PostSourceType;
}): string {
  const explicit = input.attributionText?.trim();
  if (explicit) {
    return explicit;
  }
  const link = input.link?.trim();
  if (link) {
    return link;
  }
  return FALLBACK_BY_TYPE[input.sourceType];
}
