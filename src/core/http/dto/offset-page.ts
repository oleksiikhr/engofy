// Shared shape for offset-paginated list endpoints (PLAN.md §4): the page's
// items plus the offset to pass back for the next page (`null` on the last
// page). Concrete response DTOs declare `items: XDto[]` and otherwise match
// this so every list endpoint reads the same way on the wire.
export interface OffsetPage<T> {
  items: T[];
  nextOffset: number | null;
}

export function toOffsetPage<T>(
  items: T[],
  nextOffset: number | null,
): OffsetPage<T> {
  return { items, nextOffset };
}
