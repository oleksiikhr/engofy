import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { flattenPostPartUnits } from '../../domain/flatten.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import type { FeedItemView, FeedView } from './feed-view.js';
import { GetFeedQuery } from './get-feed.query.js';

const EXCERPT_MAX_CHARS = 280;

// Backs the `/` feed page (PLAN.md §4): published posts newest first, with a
// plain-text excerpt built from the leading blocks. Pagination is a plain
// LIMIT/OFFSET and is *not* stable: `publishedAt desc` means every new publish
// shifts all later rows down by one, so a client paging with `?offset=` can
// see an item twice or miss one across the boundary.
// TODO: switch to keyset pagination on `(publishedAt, id)` — the query already
// orders by that exact tuple, so the cursor is `WHERE (published_at, id) <
// (:cursorPublishedAt, :cursorId)`.
@QueryHandler(GetFeedQuery)
export class GetFeedHandler implements IQueryHandler<GetFeedQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({ limit, offset }: GetFeedQuery): Promise<FeedView> {
    const [posts, total] = await this.em.findAndCount(
      Post,
      { status: PostStatus.Published },
      {
        orderBy: { publishedAt: 'desc', id: 'desc' },
        limit,
        offset,
        disableIdentityMap: true,
      },
    );

    const excerpts = await this.loadExcerpts(posts.map((post) => post.id));

    const items: FeedItemView[] = posts.map((post) => ({
      shortId: post.shortId,
      slug: post.slug ?? null,
      title: post.title ?? null,
      cefrLevel: post.cefrLevel ?? null,
      publishedAt: post.publishedAt.toISO() ?? post.publishedAt.toString(),
      excerpt: excerpts.get(post.id) ?? '',
      attributionText: post.source.attributionText,
      sourceType: post.source.type,
      sourceLink: post.source.link ?? null,
    }));

    return {
      items,
      nextOffset: offset + posts.length < total ? offset + limit : null,
    };
  }

  private async loadExcerpts(postIds: string[]): Promise<Map<string, string>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const parts = await this.em.find(
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
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}
