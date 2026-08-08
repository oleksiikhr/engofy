export function sortByIds<T extends { id: string }>(
  entities: T[],
  ids: string[],
): T[] {
  const orderMap = new Map<string, number>();
  for (let i = 0; i < ids.length; i++) {
    if (!orderMap.has(ids[i])) {
      orderMap.set(ids[i], i);
    }
  }

  const tailRank = ids.length;

  return entities.toSorted(
    (a, b) =>
      (orderMap.get(a.id) ?? tailRank) - (orderMap.get(b.id) ?? tailRank),
  );
}
