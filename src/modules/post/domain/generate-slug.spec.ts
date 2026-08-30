import { generateSlug } from './generate-slug.js';

describe('generateSlug', () => {
  it('lowercases, trims and hyphenates a title', () => {
    expect(generateSlug('  The Quick Brown Fox  ')).toBe('the-quick-brown-fox');
  });

  it('collapses punctuation runs to a single hyphen', () => {
    expect(generateSlug('Rock & Roll: Vol. 2!!')).toBe('rock-roll-vol-2');
  });

  it('strips accents down to ASCII', () => {
    expect(generateSlug('Café del Mar')).toBe('cafe-del-mar');
  });

  it('caps the slug at 80 characters', () => {
    const slug = generateSlug('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.startsWith('word-word-word')).toBe(true);
  });

  it('returns an empty string for a title with no slug-able characters', () => {
    expect(generateSlug('— … —')).toBe('');
  });
});
