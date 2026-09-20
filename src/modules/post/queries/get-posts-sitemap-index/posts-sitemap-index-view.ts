export interface PostsSitemapIndexPageView {
  // 1-based, matches `GetPostsSitemapPageQuery.page`.
  page: number;
  // ISO-8601; the newest `contentUpdatedAt` among the page's posts.
  lastmod: string;
}

export interface PostsSitemapIndexView {
  pages: PostsSitemapIndexPageView[];
}
