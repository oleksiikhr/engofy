import type { EntityManager } from '@mikro-orm/postgresql';
import { flattenPostPartUnits } from '../domain/flatten.js';
import { PostPart } from '../entities/post-part.entity.js';

const EXCERPT_MAX_CHARS = 280;

// Plain-text excerpt built from a post's leading blocks, truncated on a word
// boundary — shared by every list query that shows a post preview
// (`get-feed`, `get-posts-list`).
export async function loadExcerpts(
  em: EntityManager,
  postIds: string[],
): Promise<Map<string, string>> {
  if (postIds.length === 0) {
    return new Map();
  }

  const parts = await em.find(
    PostPart,
    { postId: { $in: postIds } },
    {
      orderBy: { postId: 'asc', blockIndex: 'asc' },
      disableIdentityMap: true,
    },
  );

  const byPost = new Map<string, string>();
  for (const part of parts) {
    const current = byPost.get(part.postId) ?? '';
    if (current.length >= EXCERPT_MAX_CHARS) {
      continue;
    }
    const blockText = flattenPostPartUnits(part.body)
      .map((unit) => unit.text)
      .join(' ')
      .trim();
    byPost.set(part.postId, current ? `${current} ${blockText}` : blockText);
  }

  for (const [postId, text] of byPost) {
    byPost.set(postId, truncate(text, EXCERPT_MAX_CHARS));
  }
  return byPost;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}
