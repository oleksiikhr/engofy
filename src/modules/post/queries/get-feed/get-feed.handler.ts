import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Post } from '../../entities/post.entity.js';
import { PostStatus } from '../../enums/post-status.enum.js';
import { loadExcerpts } from '../load-excerpts.js';
import type { FeedItemView, FeedView } from './feed-view.js';
import { GetFeedQuery } from './get-feed.query.js';

// Backs the `/` feed page (PLAN.md §4): published posts newest first, with a
// plain-text excerpt built from the leading blocks. Pagination is a plain
// LIMIT/OFFSET and is *not* stable: `publishedAt desc` means every new publish
// shifts all later rows down by one, so a client paging with `?offset=` can
// see an item twice or miss one across the boundary.
// TODO: switch to keyset pagination on `(publishedAt, id)` — the query already
// orders by that exact tuple, so the cursor is `WHERE (published_at, id) <
// (:cursorPublishedAt, :cursorId)`. `get-posts-list` already does this; this
// endpoint hasn't been migrated onto it.
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

    const excerpts = await loadExcerpts(
      this.em,
      posts.map((post) => post.id),
    );

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
}
