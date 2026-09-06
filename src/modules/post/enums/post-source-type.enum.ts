// How the post text relates to its original source, shown alongside
// `attributionText` on the post page (PLAN.md §3.2, §9 — copyright). Only short
// excerpts are published, always with a clear link back to the original.
export enum PostSourceType {
  // Text written for engofy, no external source.
  Original = 'original',
  // A short excerpt from a longer work (a book, a long-form article).
  Excerpt = 'excerpt',
  // A comment quoted from Reddit or a similar discussion site.
  RedditComment = 'reddit_comment',
  // A short extract from a news article.
  NewsSnippet = 'news_snippet',
}
