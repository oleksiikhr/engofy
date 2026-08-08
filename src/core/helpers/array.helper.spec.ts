import { sortByIds } from './array.helper.js';

function items(...ids: string[]) {
  return ids.map((id) => ({ id }));
}

describe('sortByIds', () => {
  it('returns entities in the same order as ids', () => {
    const entities = items('a', 'b', 'c');
    expect(sortByIds(entities, ['c', 'a', 'b']).map((e) => e.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('returns an empty array when entities is empty', () => {
    expect(sortByIds([], ['a', 'b'])).toEqual([]);
  });

  it('returns the array unchanged when ids is empty', () => {
    const entities = items('a', 'b');
    expect(sortByIds(entities, []).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('places entities with unknown ids after all known ids', () => {
    const known = { id: 'known' };
    const unknown = { id: 'unknown' };
    const result = sortByIds([unknown, known], ['known']);
    expect(result[0].id).toBe('known');
    expect(result[1].id).toBe('unknown');
  });

  it('groups multiple unknown ids at the tail without interleaving known ids', () => {
    const ids = sortByIds(items('x', 'a', 'y', 'b'), ['b', 'a']).map(
      (e) => e.id,
    );
    expect(ids).toEqual(['b', 'a', 'x', 'y']);
  });

  it('preserves extra fields on the entity objects', () => {
    const entities = [
      { id: 'b', name: 'Beta' },
      { id: 'a', name: 'Alpha' },
    ];
    const result = sortByIds(entities, ['a', 'b']);
    expect(result[0]).toEqual({ id: 'a', name: 'Alpha' });
    expect(result[1]).toEqual({ id: 'b', name: 'Beta' });
  });

  it('handles a single entity correctly', () => {
    const result = sortByIds([{ id: 'only' }], ['only']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('only');
  });

  it('is stable for entities that share the same rank (unknown ids)', () => {
    const result = sortByIds([{ id: 'u1' }, { id: 'k' }, { id: 'u2' }], ['k']);
    expect(result.map((e) => e.id)).toEqual(['k', 'u1', 'u2']);
  });
});
