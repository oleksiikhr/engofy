import { GrammarGroupBy } from '../enums/grammar-group-by.enum.js';
import { groupConstructions } from './grammar-grouping.js';

const item = (categoryName: string, cefrLevel: string | null, id: string) => ({
  categoryName,
  cefrLevel,
  id,
});

const ITEMS = [
  item('ADJECTIVES', 'B1', 'adj'),
  item('FUTURE', 'A2', 'fut'),
  item('MODALITY', 'A1', 'mod'),
  item('PAST', 'B2', 'past-1'),
  item('PRESENT', 'A1', 'pres'),
  item('PAST', null, 'past-2'),
];

const ids = (
  groups: ReturnType<typeof groupConstructions<(typeof ITEMS)[0]>>,
) => groups.map((g) => [g.key, g.items.map((i) => i.id)]);

describe('groupConstructions', () => {
  it('groups by category in first-appearance order', () => {
    expect(ids(groupConstructions(ITEMS, GrammarGroupBy.Category))).toEqual([
      ['ADJECTIVES', ['adj']],
      ['FUTURE', ['fut']],
      ['MODALITY', ['mod']],
      ['PAST', ['past-1', 'past-2']],
      ['PRESENT', ['pres']],
    ]);
  });

  it('groups by time block, with off-axis categories in Other last', () => {
    const groups = groupConstructions(ITEMS, GrammarGroupBy.Time);
    expect(ids(groups)).toEqual([
      ['past', ['past-1', 'past-2']],
      ['present', ['pres']],
      ['future', ['fut']],
      ['other', ['adj', 'mod']],
    ]);
    expect(groups.map((g) => g.name)).toEqual([
      'Past',
      'Present',
      'Future',
      'Other',
    ]);
  });

  it('groups by CEFR easiest-first, with level-less constructions in Other last', () => {
    expect(ids(groupConstructions(ITEMS, GrammarGroupBy.Cefr))).toEqual([
      ['A1', ['mod', 'pres']],
      ['A2', ['fut']],
      ['B1', ['adj']],
      ['B2', ['past-1']],
      ['other', ['past-2']],
    ]);
  });

  it('drops empty groups and handles an empty list', () => {
    expect(groupConstructions([], GrammarGroupBy.Time)).toEqual([]);
    expect(
      groupConstructions([item('PAST', 'A1', 'x')], GrammarGroupBy.Time).map(
        (g) => g.key,
      ),
    ).toEqual(['past']);
  });
});
