import { resolvePhraseOverlaps } from './resolve-phrase-overlaps.js';
import type { Annotation } from './validate-annotations.js';

// A deterministic phrasal-verb fragment (carries phraseId), plus an AI idiom
// that straddles it.
const phrasalVerb: Annotation = {
  start: 4,
  end: 10,
  form: 'picked',
  kind: 'phrase',
  phraseType: 'phrasal_verb',
  phraseText: 'pick up',
  phraseGroupId: 'det-1',
  phraseId: 'det-1',
};

describe('resolvePhraseOverlaps', () => {
  it('drops an AI phrase group when any fragment overlaps a deterministic phrase', () => {
    const aiIdiomFragmentA: Annotation = {
      start: 8,
      end: 14,
      form: 'ked up',
      kind: 'phrase',
      phraseText: 'made-up idiom',
      phraseType: 'idiom',
      phraseGroupId: 'g1',
    };
    const aiIdiomFragmentB: Annotation = {
      start: 20,
      end: 25,
      form: 'later',
      kind: 'phrase',
      phraseText: 'made-up idiom',
      phraseType: 'idiom',
      phraseGroupId: 'g1',
    };

    const result = resolvePhraseOverlaps([
      phrasalVerb,
      aiIdiomFragmentA,
      aiIdiomFragmentB,
    ]);

    // Both fragments of g1 are gone — a half-dropped group would still trip
    // checkNoOverlaps.
    expect(result).toEqual([phrasalVerb]);
  });

  it('keeps an AI phrase that does not overlap any deterministic phrase', () => {
    const aiIdiom: Annotation = {
      start: 30,
      end: 45,
      form: 'at loose ends',
      kind: 'phrase',
      phraseText: 'at loose ends',
      phraseType: 'idiom',
      phraseGroupId: 'g2',
    };

    expect(resolvePhraseOverlaps([phrasalVerb, aiIdiom])).toEqual([
      phrasalVerb,
      aiIdiom,
    ]);
  });

  it('is a no-op when there are no deterministic phrases', () => {
    const aiIdiom: Annotation = {
      start: 0,
      end: 5,
      form: 'x y z',
      kind: 'phrase',
      phraseText: 'x y z',
      phraseType: 'collocation',
      phraseGroupId: 'g1',
    };
    const word: Annotation = {
      start: 2,
      end: 3,
      form: 'y',
      kind: 'word',
      lemma: 'y',
      pos: 'noun',
    };

    const input = [aiIdiom, word];
    expect(resolvePhraseOverlaps(input)).toBe(input);
  });

  it('never drops a deterministic phrase fragment', () => {
    const secondFragment: Annotation = {
      ...phrasalVerb,
      start: 14,
      end: 16,
      form: 'up',
    };
    const result = resolvePhraseOverlaps([phrasalVerb, secondFragment]);
    expect(result).toEqual([phrasalVerb, secondFragment]);
  });
});
