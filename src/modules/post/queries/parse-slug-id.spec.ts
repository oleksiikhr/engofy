import { describe, expect, it } from 'vitest';
import { parseSlugId } from './parse-slug-id.js';

describe('parseSlugId', () => {
  it('takes the trailing segment of a slug-prefixed id', () => {
    expect(parseSlugId('a-day-in-tokyo-Ab3Xy9Qz')).toBe('Ab3Xy9Qz');
  });

  it('accepts a bare short id with no slug prefix', () => {
    expect(parseSlugId('Ab3Xy9Qz')).toBe('Ab3Xy9Qz');
  });

  it('handles a slug that is itself just hyphens of words', () => {
    expect(parseSlugId('one-two-three-0Zzzzzz1')).toBe('0Zzzzzz1');
  });

  it('rejects a trailing segment that is not a plausible short id', () => {
    expect(parseSlugId('a-day-in-tokyo')).toBeNull();
    expect(parseSlugId('with spaces')).toBeNull();
    expect(parseSlugId('')).toBeNull();
    expect(parseSlugId('trailing-')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(parseSlugId('  hello-Ab3Xy9Qz  ')).toBe('Ab3Xy9Qz');
  });
});
