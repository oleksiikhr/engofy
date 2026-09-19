import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { loadExcerpts } from '../load-excerpts.js';
import { GetPostsListQuery } from './get-posts-list.query.js';
import {
  decodePostsListCursor,
  encodePostsListCursor,
} from './posts-list-cursor.js';
import type { PostsListItemView, PostsListView } from './posts-list-view.js';

interface PostRow {
  id: string;
  short_id: string;
  slug: string | null;
  title: string | null;
  cefr_level: CefrLevel | null;
  // Raw driver output for a `timestamp with time zone` column is text, not a
  // JS `Date` — `LuxonTimestampType.convertToJSValue` handles the same shape.
  published_at: string;
  source_attribution_text: string;
  source_type: string;
  source_link: string | null;
}

// Backs `/posts` (posts-list-page §1): published posts, newest first,
// keyset-paginated on `(published_at, id)` — the pagination model the TODO
// in `get-feed` describes but never migrated to (that endpoint is untouched
// by this plan). CEFR multi-select and "unread only" (LEFT JOIN
// `post_reads`, only when `userId` is set — Post has no ORM relation to
// PostRead) are set-based filters the ORM can't express cheaply, so this is
// one raw query (DP5) rather than `em.find`.
@QueryHandler(GetPostsListQuery)
export class GetPostsListHandler implements IQueryHandler<GetPostsListQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
    options,
  }: GetPostsListQuery): Promise<PostsListView> {
    const cursor = decodePostsListCursor(options.cursor);
    const cefrLevels = options.cefrLevels ?? [];
    const joinUnread = Boolean(options.unreadOnly && userId);

    const params: unknown[] = [];
    let joinSql = '';
    if (joinUnread) {
      joinSql =
        'LEFT JOIN post_reads pr ON pr.post_id = p.id AND pr.user_id = ?';
      params.push(userId);
    }

    const conditions = ['p.status = ?'];
    params.push(PostStatus.Published);

    if (cefrLevels.length > 0) {
      conditions.push(
        `p.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`,
      );
      params.push(...cefrLevels);
    }

    if (joinUnread) {
      conditions.push('pr.id IS NULL');
    }

    if (cursor) {
      conditions.push('(p.published_at, p.id) < (?::timestamptz, ?)');
      params.push(cursor.publishedAt, cursor.id);
    }

    params.push(options.limit + 1);

    const rows = await this.em.getConnection().execute<PostRow[]>(
      `SELECT p.id, p.short_id, p.slug, p.title, p.cefr_level, p.published_at,
              p.source_attribution_text, p.source_type, p.source_link
         FROM posts p
         ${joinSql}
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.published_at DESC, p.id DESC
        LIMIT ?`,
      params,
      'all',
      this.em.getTransactionContext(),
    );

    const hasMore = rows.length > options.limit;
    const page = hasMore ? rows.slice(0, options.limit) : rows;

    const excerpts = await loadExcerpts(
      this.em,
      page.map((row) => row.id),
    );

    const items: PostsListItemView[] = page.map((row) => ({
      shortId: row.short_id,
      slug: row.slug,
      title: row.title,
      cefrLevel: row.cefr_level,
      publishedAt: toIso(row.published_at),
      excerpt: excerpts.get(row.id) ?? '',
      attributionText: row.source_attribution_text,
      sourceType: row.source_type,
      sourceLink: row.source_link,
    }));

    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? encodePostsListCursor({
            publishedAt: toIso(last.published_at),
            id: last.id,
          })
        : null;

    return { items, nextCursor };
  }
}

function toIso(value: string): string {
  const dateTime = DateTime.fromSQL(value, { zone: 'utc' });
  return dateTime.toISO() ?? dateTime.toString();
}
