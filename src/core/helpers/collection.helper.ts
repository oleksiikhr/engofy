import type { Collection } from '@mikro-orm/core';

export interface Orderable {
  position: number;
}

/**
 * Move entity inside the ordered collection and normalize order.
 */
export function moveInCollection<T extends Orderable>(
  collection: Collection<T>,
  target: T,
  newIndex: number,
): void {
  const items = collection
    .getItems()
    .toSorted((a, b) => a.position - b.position);

  const from = items.indexOf(target);
  if (from === -1) {
    return;
  }

  const to = clamp(newIndex, 0, items.length - 1);
  if (from === to) {
    return;
  }

  items.splice(from, 1);
  items.splice(to, 0, target);

  normalizeOrder(items);

  collection.set(items);
}

/**
 * Remove entity and normalize order.
 */
export function removeFromCollection<T extends Orderable>(
  collection: Collection<T>,
  target: T,
): void {
  collection.remove(target);

  const items = collection
    .getItems()
    .toSorted((a, b) => a.position - b.position);

  normalizeOrder(items);

  collection.set(items);
}

/**
 * Assign sequential order 0..N.
 */
export function normalizeOrder<T extends Orderable>(items: T[]): void {
  items.forEach((item, index) => {
    item.position = index;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
