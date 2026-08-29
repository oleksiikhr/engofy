// The public reader URL is `/posts/{slug}-{shortId}`, or `/posts/{shortId}`
// when the post has no title-derived slug. parseSlugId on the API side takes
// the trailing segment either way.
export function postUrl(post: {
  slug: string | null;
  shortId: string;
}): string {
  return post.slug
    ? `/posts/${post.slug}-${post.shortId}`
    : `/posts/${post.shortId}`;
}
