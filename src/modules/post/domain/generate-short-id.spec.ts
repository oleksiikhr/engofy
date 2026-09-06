import { generateShortId } from './generate-short-id.js';

const BASE62_8 = /^[0-9A-Za-z]{8}$/;
const BASE62 = /^[0-9A-Za-z]+$/;

describe('generateShortId', () => {
  it('produces an 8-char base62 id by default', () => {
    const id = generateShortId();
    expect(id).toHaveLength(8);
    expect(id).toMatch(BASE62_8);
  });

  it('honours a custom length', () => {
    expect(generateShortId(12)).toHaveLength(12);
    expect(generateShortId(1)).toHaveLength(1);
  });

  it('is practically collision-free across many draws', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generateShortId()));
    expect(ids.size).toBe(5000);
  });

  // KNOWN WEAKNESS (documented, not fixed): `byte % 62` maps 256 byte values
  // onto 62 symbols, so the first `256 % 62 === 8` symbols ('0'–'7') are ~1.6%
  // more likely than the rest. Acceptable here — the id is a 62^8 ≈ 2.2e14
  // space guarded by a `@Unique` column on `posts.short_id`, and the entity
  // sets it once at construction with no collision retry (a collision would
  // surface as a UniqueConstraintViolationException on insert). If post volume
  // ever makes that plausible, switch to rejection sampling + an insert retry.
  it('draws every symbol from the base62 alphabet only', () => {
    const sample = generateShortId(2000);
    expect(sample).toMatch(BASE62);
  });
});
