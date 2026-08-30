import { contains, spansOverlap } from './span-range.js';

describe('spansOverlap', () => {
  it('is true for genuinely overlapping ranges', () => {
    expect(spansOverlap({ start: 0, end: 5 }, { start: 3, end: 8 })).toBe(true);
  });

  it('is false for touching ranges (half-open)', () => {
    expect(spansOverlap({ start: 0, end: 5 }, { start: 5, end: 9 })).toBe(
      false,
    );
  });

  it('is false for disjoint ranges', () => {
    expect(spansOverlap({ start: 0, end: 2 }, { start: 6, end: 9 })).toBe(
      false,
    );
  });

  it('is true when one range is nested inside the other', () => {
    expect(spansOverlap({ start: 0, end: 20 }, { start: 5, end: 8 })).toBe(
      true,
    );
  });

  it('is order-independent', () => {
    expect(spansOverlap({ start: 3, end: 8 }, { start: 0, end: 5 })).toBe(true);
  });
});

describe('contains', () => {
  it('is true when inner sits strictly inside outer', () => {
    expect(contains({ start: 0, end: 10 }, { start: 2, end: 7 })).toBe(true);
  });

  it('is true when the edges coincide', () => {
    expect(contains({ start: 0, end: 10 }, { start: 0, end: 10 })).toBe(true);
  });

  it('is false when inner spills past outer', () => {
    expect(contains({ start: 0, end: 10 }, { start: 8, end: 12 })).toBe(false);
  });

  it('is not symmetric', () => {
    expect(contains({ start: 2, end: 7 }, { start: 0, end: 10 })).toBe(false);
  });
});
