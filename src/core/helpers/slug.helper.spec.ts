import { slugify } from './slug.helper.js';

describe('slugify', () => {
  it('lowercases and collapses non-alphanumeric runs to a single hyphen', () => {
    expect(slugify('Hello,  World!')).toBe('hello-world');
  });

  it('trims leading and trailing hyphen runs', () => {
    expect(slugify('  --Edge case--  ')).toBe('edge-case');
  });

  it('strips combining diacritical marks', () => {
    expect(slugify('Crème brûlée')).toBe('creme-brulee');
  });

  it('drops characters outside the ASCII alphanumeric range', () => {
    expect(slugify('日本語 title')).toBe('title');
  });

  it('applies maxLength last, after normalisation', () => {
    expect(slugify('The quick brown fox jumps', { maxLength: 9 })).toBe(
      'the-quick',
    );
  });

  it('returns an empty string when nothing survives', () => {
    expect(slugify('!!!')).toBe('');
  });
});
