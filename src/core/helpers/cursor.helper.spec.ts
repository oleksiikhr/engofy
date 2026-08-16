import { decodeCursor, encodeCursor } from './cursor.helper.js';

const isNumber = (v: unknown): v is number => typeof v === 'number';
const isArrayCursor = (v: unknown): v is [number, string] =>
  Array.isArray(v) &&
  v.length === 2 &&
  typeof v[0] === 'number' &&
  typeof v[1] === 'string';

describe('decodeCursor', () => {
  it('returns undefined for undefined input', () => {
    expect(decodeCursor(undefined, 1, isNumber)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(decodeCursor('', 1, isNumber)).toBeUndefined();
  });

  it('decodes and returns the payload directly', () => {
    const cursor = encodeCursor(1, 42);
    expect(decodeCursor(cursor, 1, isNumber)).toBe(42);
  });

  it('decodes complex payload values', () => {
    const payload = [1234567890, 'abc-123'] as [number, string];
    const cursor = encodeCursor(1, payload);
    expect(decodeCursor(cursor, 1, isArrayCursor)).toEqual(payload);
  });

  it('throws Error for non-base64url input', () => {
    expect(() => decodeCursor('!!!not-base64!!!', 1, isNumber)).toThrow(Error);
  });

  it('throws Error when base64 decodes to invalid JSON', () => {
    const notJson = Buffer.from('{broken', 'utf8').toString('base64url');
    expect(() => decodeCursor(notJson, 1, isNumber)).toThrow(Error);
  });

  it('throws Error when payload guard returns false', () => {
    const cursor = encodeCursor(1, 'a string');
    expect(() => decodeCursor(cursor, 1, isNumber)).toThrow(Error);
  });

  it('throws Error on version mismatch', () => {
    const cursor = encodeCursor(1, 42);
    expect(() => decodeCursor(cursor, 2, isNumber)).toThrow(Error);
  });

  it('throws Error with message "Invalid pagination cursor"', () => {
    expect(() => decodeCursor('bad', 1, isNumber)).toThrow(
      'Invalid pagination cursor',
    );
  });
});

describe('encodeCursor', () => {
  it('produces a string', () => {
    expect(typeof encodeCursor(1, 42)).toBe('string');
  });

  it('roundtrips with decodeCursor', () => {
    const payload: [number, string] = [1700000000000, 'job-id-xyz'];
    expect(decodeCursor(encodeCursor(1, payload), 1, isArrayCursor)).toEqual(
      payload,
    );
  });
});
