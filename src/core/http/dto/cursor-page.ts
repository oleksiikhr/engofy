// Shared shape for cursor-paginated list endpoints, alongside `OffsetPage`
// (D14 #36) for the offset-paginated ones: the page's items plus an opaque
// cursor to pass back as `?cursor=` for the next page (`null` on the last
// page).
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function toCursorPage<T>(
  items: T[],
  nextCursor: string | null,
): CursorPage<T> {
  return { items, nextCursor };
}
