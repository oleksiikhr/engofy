import type { CursorPage } from '../../../../core/http/dto/cursor-page.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class PostsListItemDto {
  readonly shortId!: string;

  readonly slug!: string | null;

  readonly title!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  // ISO-8601.
  readonly publishedAt!: string;

  // Plain-text opening of the post.
  readonly excerpt!: string;

  // Human-readable source credit (PLAN.md §9); always set.
  readonly attributionText!: string;

  // `original` | `excerpt` | `reddit_comment` | `news_snippet`.
  readonly sourceType!: string;

  readonly sourceLink!: string | null;

  // The current user has read the post; always false for a guest.
  readonly isRead!: boolean;
}

export class PostsListResponseDto implements CursorPage<PostsListItemDto> {
  readonly items!: PostsListItemDto[];

  // Pass back as `?cursor=` for the next page; null on the last page.
  readonly nextCursor!: string | null;
}
