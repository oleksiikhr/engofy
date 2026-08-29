// Builds the plain-text announcement the publish cron sends to the channel
// for a freshly published post (PLAN.md §3.8). Deliberately minimal — title,
// optional CEFR badge, and the public url.

export interface AnnouncementPost {
  title?: string | null;
  slug?: string | null;
  shortId: string;
  cefrLevel?: string | null;
}

const TRAILING_SLASH = /\/+$/;

export function postPublicPath(post: AnnouncementPost): string {
  return post.slug
    ? `/posts/${post.slug}-${post.shortId}`
    : `/posts/${post.shortId}`;
}

export function formatPostAnnouncement(
  post: AnnouncementPost,
  publicUrl: string,
): string {
  const base = publicUrl.replace(TRAILING_SLASH, '');
  const lines = [post.title?.trim() || 'New reading'];
  if (post.cefrLevel) {
    lines.push(`Level: ${post.cefrLevel}`);
  }
  lines.push(`${base}${postPublicPath(post)}`);
  return lines.join('\n\n');
}
