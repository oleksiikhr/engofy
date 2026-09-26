import type { GrammarLexiconEntry } from './reader-lexicon';

// Slice 1 of the grammar-usage-point-exercises plan: three throwaway UI
// variants for showing a construction's other usage points next to the one
// matched in the sentence, compared on static mock data. Whichever variant
// the developer picks gets its real implementation (real sibling data from
// the backend) in slice 4 — this file and the `?gupVariant=` switch go away
// then; the other two variants are deleted, not kept behind the flag.

export type GupVariant = 1 | 2 | 3;

const GUP_VARIANT_PARAM = 'gupVariant';

export function readGupVariant(search: string): GupVariant | undefined {
  const value = new URLSearchParams(search).get(GUP_VARIANT_PARAM);
  return value === '1' || value === '2' || value === '3'
    ? (Number(value) as GupVariant)
    : undefined;
}

export interface MockUsagePoint {
  id: string;
  guideword: string;
  detail: string;
  example: string;
  matched: boolean;
}

// Generic stand-ins for a construction's other usage points — plausible
// enough to judge the layout, not tied to any real construction.
const MOCK_SIBLING_POOL: Omit<MockUsagePoint, 'id' | 'matched'>[] = [
  {
    guideword: 'Habits',
    detail: 'Describes something that happens regularly, as a routine.',
    example: 'She checks her email every morning.',
  },
  {
    guideword: 'General truths',
    detail: 'States something that is always true, not tied to one moment.',
    example: 'Water boils at 100°C.',
  },
  {
    guideword: 'Timetables and schedules',
    detail: 'Describes a fixed future event, like a train or a class.',
    example: 'The train leaves at nine.',
  },
  {
    guideword: 'Instructions and directions',
    detail: 'Used in step-by-step directions or recipes.',
    example: 'You turn left at the corner.',
  },
];

// The real matched usage point, dropped into a fixed slot among the mock
// siblings so the active pill isn't always first or last.
export function mockUsagePoints(
  entry: GrammarLexiconEntry,
  guideword: string,
  detail: string,
): MockUsagePoint[] {
  const matched: MockUsagePoint = {
    id: entry.id,
    guideword,
    detail,
    example: entry.examples[0] ?? '',
    matched: true,
  };
  const others = MOCK_SIBLING_POOL.map((point, index) => ({
    ...point,
    id: `mock-usage-point-${index}`,
    matched: false,
  }));
  return [others[0], matched, ...others.slice(1)];
}
