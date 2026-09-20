export interface PostsSitemapPageItemView {
  // Null when the post has no title to derive it from.
  slug: string | null;
  shortId: string;
  // ISO-8601 `contentUpdatedAt`.
  lastmod: string;
}

export interface PostsSitemapPageView {
  // Empty when `page` is past the last page.
  items: PostsSitemapPageItemView[];
}
