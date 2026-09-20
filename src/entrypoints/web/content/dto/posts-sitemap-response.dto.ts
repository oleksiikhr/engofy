export class PostsSitemapIndexPageDto {
  // 1-based; pass back as the `page` path param.
  readonly page!: number;

  // ISO-8601; newest content change among the page's posts.
  readonly lastmod!: string;
}

export class PostsSitemapIndexResponseDto {
  readonly pages!: PostsSitemapIndexPageDto[];
}

export class PostsSitemapItemDto {
  // Null when the post has no title to derive a slug from.
  readonly slug!: string | null;

  readonly shortId!: string;

  // ISO-8601 time the post's content last changed.
  readonly lastmod!: string;
}

export class PostsSitemapPageResponseDto {
  readonly items!: PostsSitemapItemDto[];
}
