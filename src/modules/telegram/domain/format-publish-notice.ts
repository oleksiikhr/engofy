// Plain-text admin notice sent when a post lands in `published`.

import {
  type AnnouncementPost,
  postPublicPath,
} from './format-announcement.js';

const TRAILING_SLASH = /\/+$/;

export function formatPublishNotice(
  post: AnnouncementPost,
  publicUrl: string,
): string {
  const base = publicUrl.replace(TRAILING_SLASH, '');
  return [
    `Post published: ${post.title?.trim() || post.shortId}`,
    `${base}${postPublicPath(post)}`,
  ].join('\n');
}
