import {
  decodeCursor,
  encodeCursor,
} from '../../../../core/helpers/cursor.helper.js';
import { InvalidPostsListCursorError } from '../../errors/invalid-posts-list-cursor.error.js';

const VERSION = 1;

// Keyset on `(published_at, id)` — the query's own ORDER BY, both desc.
export interface PostsListCursorPayload {
  publishedAt: string;
  id: string;
}

function isPayload(value: unknown): value is PostsListCursorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).publishedAt === 'string' &&
    typeof (value as Record<string, unknown>).id === 'string'
  );
}

export function encodePostsListCursor(payload: PostsListCursorPayload): string {
  return encodeCursor(VERSION, payload);
}

export function decodePostsListCursor(
  cursor: string | undefined,
): PostsListCursorPayload | undefined {
  try {
    return decodeCursor(cursor, VERSION, isPayload);
  } catch {
    throw new InvalidPostsListCursorError('Invalid pagination cursor');
  }
}
