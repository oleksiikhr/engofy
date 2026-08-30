import type { OffsetPage } from '../../../../core/http/dto/offset-page.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class FeedItemDto {
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
}

// Shares the `{ items, nextOffset }` envelope with every other offset-paginated
// list endpoint.
export class FeedResponseDto implements OffsetPage<FeedItemDto> {
  readonly items!: FeedItemDto[];

  // Pass back as `?offset=` for the next page; null on the last page.
  readonly nextOffset!: number | null;
}
