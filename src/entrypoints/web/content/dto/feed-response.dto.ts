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

  readonly sourceLink!: string | null;
}

export class FeedResponseDto {
  readonly items!: FeedItemDto[];

  // Pass back as `?offset=` for the next page; null on the last page.
  readonly nextOffset!: number | null;
}
