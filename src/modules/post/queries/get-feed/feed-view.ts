import type { CefrLevel } from '../../enums/cefr-level.enum.js';

export interface FeedItemView {
  shortId: string;
  slug: string | null;
  title: string | null;
  cefrLevel: CefrLevel | null;
  // ISO-8601.
  publishedAt: string;
  // Plain-text opening of the post, trimmed to ~280 chars.
  excerpt: string;
  // Human-readable source credit for the card footer (PLAN.md §9). Always set.
  attributionText: string;
  // How the text relates to its origin (`original` | `excerpt` | …).
  sourceType: string;
  // Link back to the original; null when the text is original / has no url.
  sourceLink: string | null;
}

export interface FeedView {
  items: FeedItemView[];
  // Offset to pass back as `?offset=` for the next page; null when the last
  // page has been reached.
  nextOffset: number | null;
}
