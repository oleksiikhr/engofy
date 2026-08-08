import { parseTrustProxy } from './trust-proxy.helper.js';

describe('parseTrustProxy', () => {
  it('returns [] when raw is undefined', () => {
    expect(parseTrustProxy(undefined)).toEqual([]);
  });

  it('returns [] when raw is empty string', () => {
    expect(parseTrustProxy('')).toEqual([]);
  });

  it('returns true when raw is "true"', () => {
    expect(parseTrustProxy('true')).toBe(true);
  });

  it('returns true when raw is "TRUE" (case-insensitive)', () => {
    expect(parseTrustProxy('TRUE')).toBe(true);
  });

  it('returns false when raw is "false"', () => {
    expect(parseTrustProxy('false')).toBe(false);
  });

  it('returns false when raw is "FALSE" (case-insensitive)', () => {
    expect(parseTrustProxy('FALSE')).toBe(false);
  });

  it('returns a single-element array for a single IP', () => {
    expect(parseTrustProxy('127.0.0.1')).toEqual(['127.0.0.1']);
  });

  it('returns an array for comma-separated IPs', () => {
    expect(parseTrustProxy('127.0.0.1, 10.0.0.1')).toEqual([
      '127.0.0.1',
      '10.0.0.1',
    ]);
  });

  it('trims whitespace around each token', () => {
    expect(parseTrustProxy('  127.0.0.1 , 10.0.0.1  ')).toEqual([
      '127.0.0.1',
      '10.0.0.1',
    ]);
  });

  it('filters out blank tokens from extra commas', () => {
    expect(parseTrustProxy('127.0.0.1,,10.0.0.1')).toEqual([
      '127.0.0.1',
      '10.0.0.1',
    ]);
  });
});
