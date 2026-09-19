import { GrammarGroupBy } from '../enums/grammar-group-by.enum.js';
import { CEFR_LEVELS } from './cefr-order.js';

export interface GroupableConstruction {
  categoryName: string;
  // Easiest CEFR level among the construction's usage points; null when it
  // has none.
  cefrLevel: string | null;
}

export interface ConstructionGroup<T> {
  key: string;
  name: string;
  items: T[];
}

const OTHER_KEY = 'other';
const OTHER_NAME = 'Other';

// The tense axis of the `time` grouping: hardcoded EGP category name → block.
// Categories off this axis (MODALITY, CLAUSES, …) land in "Other".
const TIME_BLOCKS: readonly { key: string; name: string; category: string }[] =
  [
    { key: 'past', name: 'Past', category: 'PAST' },
    { key: 'present', name: 'Present', category: 'PRESENT' },
    { key: 'future', name: 'Future', category: 'FUTURE' },
  ];

// Groups an already-ordered list into the requested axis. Item order is kept
// within a group; groups come back in the axis's own order (category: first
// appearance, i.e. category sort order; time: Past → Present → Future →
// Other; cefr: A1 → C2 → Other). Empty groups are dropped.
export function groupConstructions<T extends GroupableConstruction>(
  items: readonly T[],
  groupBy: GrammarGroupBy,
): ConstructionGroup<T>[] {
  const groups = new Map<string, ConstructionGroup<T>>();
  for (const item of items) {
    const { key, name } = groupOf(item, groupBy);
    const group = groups.get(key) ?? { key, name, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  const order = axisOrder(groupBy);
  if (!order) {
    return [...groups.values()];
  }
  return order.flatMap((key) => groups.get(key) ?? []);
}

function groupOf(
  item: GroupableConstruction,
  groupBy: GrammarGroupBy,
): { key: string; name: string } {
  switch (groupBy) {
    case GrammarGroupBy.Category:
      return { key: item.categoryName, name: item.categoryName };
    case GrammarGroupBy.Time: {
      const block = TIME_BLOCKS.find(
        (b) => b.category === item.categoryName.toUpperCase(),
      );
      return block
        ? { key: block.key, name: block.name }
        : { key: OTHER_KEY, name: OTHER_NAME };
    }
    case GrammarGroupBy.Cefr:
      return item.cefrLevel
        ? { key: item.cefrLevel, name: item.cefrLevel }
        : { key: OTHER_KEY, name: OTHER_NAME };
  }
}

// Fixed key order for the axes that have one; null = first-appearance order.
function axisOrder(groupBy: GrammarGroupBy): string[] | null {
  switch (groupBy) {
    case GrammarGroupBy.Category:
      return null;
    case GrammarGroupBy.Time:
      return [...TIME_BLOCKS.map((b) => b.key), OTHER_KEY];
    case GrammarGroupBy.Cefr:
      return [...CEFR_LEVELS, OTHER_KEY];
  }
}
