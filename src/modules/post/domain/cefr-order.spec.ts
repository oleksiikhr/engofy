import { CefrLevel } from '../../post/enums/cefr-level.enum.js';
import { cefrRank, emptyCefrRecord, minCefr } from './cefr-order.js';

describe('cefrRank', () => {
  it('orders A1 below C2', () => {
    expect(cefrRank(CefrLevel.A1)).toBeLessThan(cefrRank(CefrLevel.C2));
  });
});

describe('minCefr', () => {
  it('returns the easiest level regardless of input order', () => {
    expect(minCefr([CefrLevel.C1, CefrLevel.A2, CefrLevel.B2])).toBe(
      CefrLevel.A2,
    );
  });

  it('returns null for an empty list', () => {
    expect(minCefr([])).toBeNull();
  });
});

describe('emptyCefrRecord', () => {
  it('has a zero for every level', () => {
    expect(emptyCefrRecord()).toEqual({
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0,
    });
  });
});
