import { spanToTokenRange, type TokenOffsets } from './grammar-span-tokens.js';

// "She had never visited Tokyo ."
const TOKENS: TokenOffsets[] = [
  { position: 0, charStart: 0, charEnd: 3 }, // She
  { position: 1, charStart: 4, charEnd: 7 }, // had
  { position: 2, charStart: 8, charEnd: 13 }, // never
  { position: 3, charStart: 14, charEnd: 21 }, // visited
  { position: 4, charStart: 22, charEnd: 27 }, // Tokyo
  { position: 5, charStart: 28, charEnd: 29 }, // .
];

describe('spanToTokenRange', () => {
  it('returns the half-open position range of every token the span overlaps', () => {
    // "had never visited"
    expect(spanToTokenRange({ charStart: 4, charEnd: 21 }, TOKENS)).toEqual({
      tokenStart: 1,
      tokenEnd: 4,
    });
  });

  it('includes a token the span only partially covers', () => {
    // starts mid-"had", ends mid-"visited"
    expect(spanToTokenRange({ charStart: 5, charEnd: 17 }, TOKENS)).toEqual({
      tokenStart: 1,
      tokenEnd: 4,
    });
  });

  it('covers a single token', () => {
    expect(spanToTokenRange({ charStart: 22, charEnd: 27 }, TOKENS)).toEqual({
      tokenStart: 4,
      tokenEnd: 5,
    });
  });

  it('returns null when the span falls between tokens', () => {
    expect(spanToTokenRange({ charStart: 3, charEnd: 4 }, TOKENS)).toBeNull();
  });

  it('returns null for an empty token list', () => {
    expect(spanToTokenRange({ charStart: 0, charEnd: 5 }, [])).toBeNull();
  });
});
