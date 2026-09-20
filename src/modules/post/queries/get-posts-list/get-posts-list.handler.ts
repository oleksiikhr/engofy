import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import type { PostTopic } from '../../enums/post-topic.enum.js';
import { escapeLike } from '../escape-like.js';
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
  topic: PostTopic | null;
  // Raw driver output for a `timestamp with time zone` column is text, not a
  // JS `Date` — `LuxonTimestampType.convertToJSValue` handles the same shape.
  published_at: string;
  source_attribution_text: string;
  source_type: string;
  source_link: string | null;
  // False for a guest (no `post_reads` join).
  is_read: boolean;
}

// Backs `/posts` (posts-list-page §1): published posts, newest first,
// keyset-paginated on `(published_at, id)`. CEFR and topic multi-selects, a `term`
// matching the title or a word/phrase (EXISTS over `sentence_tokens`,
// posts-list-page §2) and "unread only" (LEFT JOIN
// `post_reads`, only when `userId` is set — Post has no ORM relation to
// PostRead; the same join yields each item's `isRead`) are set-based filters the ORM can't express cheaply, so this is
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
    const topics = options.topics ?? [];
    const joinReads = Boolean(userId);

    const params: unknown[] = [];
    let joinSql = '';
    if (joinReads) {
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

    if (topics.length > 0) {
      conditions.push(`p.topic IN (${topics.map(() => '?').join(', ')})`);
      params.push(...topics);
    }

    if (joinReads && options.unreadOnly) {
      conditions.push('pr.id IS NULL');
    }

    const term = options.term?.trim().toLowerCase();
    if (term) {
      // Word/phrase -> posts: the same `sentence_tokens -> sentences` join
      // `GetDictionaryHandler.queryUsage` walks, in the other direction. Both
      // sides resolve through the `lower(...)` unique indexes on `words` /
      // `phrases`; `word_id` / `phrase_id` / `sentences.post_id` are indexed.
      conditions.push(
        `(lower(p.title) LIKE ? OR EXISTS (
           SELECT 1
             FROM sentences s
             JOIN sentence_tokens st ON st.sentence_id = s.id
            WHERE s.post_id = p.id
              AND (st.word_id IN (SELECT id FROM words WHERE lower(lemma) = ?)
                OR st.phrase_id IN (SELECT id FROM phrases WHERE lower(phrase_text) = ?))
         ))`,
      );
      params.push(`%${escapeLike(term)}%`, term, term);
    }

    if (cursor) {
      conditions.push('(p.published_at, p.id) < (?::timestamptz, ?)');
      params.push(cursor.publishedAt, cursor.id);
    }

    params.push(options.limit + 1);

    const rows = await this.em.getConnection().execute<PostRow[]>(
      `SELECT p.id, p.short_id, p.slug, p.title, p.cefr_level, p.topic, p.published_at,
              p.source_attribution_text, p.source_type, p.source_link,
              ${joinReads ? 'pr.id IS NOT NULL' : 'false'} AS is_read
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
      topic: row.topic,
      publishedAt: toIso(row.published_at),
      excerpt: excerpts.get(row.id) ?? '',
      attributionText: row.source_attribution_text,
      sourceType: row.source_type,
      sourceLink: row.source_link,
      isRead: row.is_read,
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
