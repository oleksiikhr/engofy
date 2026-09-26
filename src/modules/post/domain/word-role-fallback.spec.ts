import { describeWordRole } from './word-role-fallback.js';

const token = (
  pos: string,
  lemma: string,
  tag = pos,
): { pos: string; tag: string; lemma: string } => ({ pos, tag, lemma });

describe('describeWordRole', () => {
  it.each([
    ['NOUN', 'noun'],
    ['PROPN', 'proper noun'],
    ['VERB', 'verb'],
    ['AUX', 'auxiliary verb'],
    ['ADJ', 'adjective'],
    ['ADV', 'adverb'],
    ['PRON', 'pronoun'],
    ['DET', 'determiner'],
    ['ADP', 'preposition'],
    ['CCONJ', 'conjunction'],
    ['SCONJ', 'conjunction'],
    ['PART', 'particle'],
    ['NUM', 'number'],
    ['INTJ', 'interjection'],
  ])('gives a generic label for %s', (pos, expectedLabel) => {
    const result = describeWordRole(token(pos, 'xyzzy'));
    expect(result).not.toBeNull();
    expect(result?.posLabel).toBe(expectedLabel);
    expect(result?.roleHint.length).toBeGreaterThan(0);
  });

  it('returns null for a POS it does not cover', () => {
    expect(describeWordRole(token('PUNCT', '.'))).toBeNull();
    expect(describeWordRole(token('SPACE', ' '))).toBeNull();
    expect(describeWordRole(token('X', 'huh'))).toBeNull();
  });

  it('prefers a lemma-specific entry over the generic POS one', () => {
    expect(describeWordRole(token('DET', 'the'))?.posLabel).toBe(
      'definite article',
    );
    expect(describeWordRole(token('DET', 'a'))?.posLabel).toBe(
      'indefinite article',
    );
    expect(describeWordRole(token('DET', 'an'))?.posLabel).toBe(
      'indefinite article',
    );
  });

  it('is lemma-lookup case-insensitive', () => {
    expect(describeWordRole(token('DET', 'The'))?.posLabel).toBe(
      'definite article',
    );
  });

  it('disambiguates "to" by POS: infinitive marker vs. preposition', () => {
    expect(describeWordRole(token('PART', 'to'))?.posLabel).toBe(
      'infinitive marker',
    );
    expect(describeWordRole(token('ADP', 'to'))?.posLabel).toBe('preposition');
  });

  it('falls back to the generic POS entry for an unlisted lemma', () => {
    const result = describeWordRole(token('ADP', 'beneath'));
    expect(result?.posLabel).toBe('preposition');
  });
});
