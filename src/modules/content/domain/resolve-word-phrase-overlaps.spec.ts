import { resolveWordPhraseOverlaps } from './resolve-word-phrase-overlaps.js';
import type { Annotation } from './validate-annotations.js';

describe('resolveWordPhraseOverlaps', () => {
  it('drops standalone word annotations covered by a phrase annotation', () => {
    const annotations: Annotation[] = [
      {
        start: 18,
        end: 22,
        form: 'fine',
        kind: 'word',
        lemma: 'fine',
        pos: 'adjective',
      },
      {
        start: 23,
        end: 28,
        form: 'print',
        kind: 'word',
        lemma: 'print',
        pos: 'noun',
      },
      {
        start: 18,
        end: 28,
        form: 'fine print',
        kind: 'phrase',
        phraseText: 'fine print',
        phraseType: 'collocation',
        phraseGroupId: 'p1',
      },
    ];

    const result = resolveWordPhraseOverlaps(annotations);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'phrase', form: 'fine print' });
  });

  it('leaves non-overlapping word and phrase annotations untouched', () => {
    const annotations: Annotation[] = [
      {
        start: 0,
        end: 6,
        form: 'Always',
        kind: 'word',
        lemma: 'always',
        pos: 'adverb',
      },
      {
        start: 18,
        end: 28,
        form: 'fine print',
        kind: 'phrase',
        phraseText: 'fine print',
        phraseType: 'collocation',
        phraseGroupId: 'p1',
      },
    ];

    const result = resolveWordPhraseOverlaps(annotations);

    expect(result).toHaveLength(2);
  });

  it('drops a word overlapping just one fragment of a multi-fragment phrase', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 8,
        form: 'took',
        kind: 'phrase',
        phraseText: 'take off',
        phraseType: 'phrasal_verb',
        phraseGroupId: 'g1',
      },
      {
        start: 18,
        end: 21,
        form: 'off',
        kind: 'phrase',
        phraseText: 'take off',
        phraseType: 'phrasal_verb',
        phraseGroupId: 'g1',
      },
      {
        // Overlaps only the "off" fragment, not "took".
        start: 18,
        end: 21,
        form: 'off',
        kind: 'word',
        lemma: 'off',
        pos: 'particle',
      },
    ];

    const result = resolveWordPhraseOverlaps(annotations);

    expect(result).toHaveLength(2);
    expect(result.every((a) => a.kind === 'phrase')).toBe(true);
  });
});
