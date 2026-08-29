import {
  buildTokenAnnotations,
  type SentenceRows,
  type TokenRow,
} from './build-token-annotations.js';

function token(overrides: Partial<TokenRow>): TokenRow {
  return {
    text: 'x',
    charStart: 0,
    charEnd: 1,
    lemma: 'x',
    pos: 'NOUN',
    isGerund: false,
    phrasalVerbGroupId: null,
    ...overrides,
  };
}

describe('buildTokenAnnotations', () => {
  it('maps content-word UPOS to the curated PartOfSpeech and re-bases offsets onto the unit', () => {
    // "The government acted swiftly." with the sentence starting at unit
    // offset 10.
    const sentences: SentenceRows[] = [
      {
        charStart: 10,
        tokens: [
          token({
            text: 'The',
            charStart: 0,
            charEnd: 3,
            lemma: 'the',
            pos: 'DET',
          }),
          token({
            text: 'government',
            charStart: 4,
            charEnd: 14,
            lemma: 'government',
            pos: 'NOUN',
          }),
          token({
            text: 'acted',
            charStart: 15,
            charEnd: 20,
            lemma: 'act',
            pos: 'VERB',
          }),
          token({
            text: 'swiftly',
            charStart: 21,
            charEnd: 28,
            lemma: 'swiftly',
            pos: 'ADV',
          }),
          token({
            text: '.',
            charStart: 28,
            charEnd: 29,
            lemma: '.',
            pos: 'PUNCT',
          }),
        ],
      },
    ];

    const result = buildTokenAnnotations(sentences, new Map());

    expect(result).toEqual([
      {
        start: 14,
        end: 24,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
      },
      {
        start: 25,
        end: 30,
        form: 'acted',
        kind: 'word',
        lemma: 'act',
        pos: 'verb',
      },
      {
        start: 31,
        end: 38,
        form: 'swiftly',
        kind: 'word',
        lemma: 'swiftly',
        pos: 'adverb',
      },
    ]);
  });

  it('maps PROPN and ADJ, and skips AUX / PRON / ADP / NUM', () => {
    const sentences: SentenceRows[] = [
      {
        charStart: 0,
        tokens: [
          token({
            text: 'She',
            pos: 'PRON',
            lemma: 'she',
            charStart: 0,
            charEnd: 3,
          }),
          token({
            text: 'is',
            pos: 'AUX',
            lemma: 'be',
            charStart: 4,
            charEnd: 6,
          }),
          token({
            text: 'Canadian',
            pos: 'ADJ',
            lemma: 'canadian',
            charStart: 7,
            charEnd: 15,
          }),
          token({
            text: 'in',
            pos: 'ADP',
            lemma: 'in',
            charStart: 16,
            charEnd: 18,
          }),
          token({
            text: 'Toronto',
            pos: 'PROPN',
            lemma: 'Toronto',
            charStart: 19,
            charEnd: 26,
          }),
        ],
      },
    ];

    expect(buildTokenAnnotations(sentences, new Map())).toEqual([
      {
        start: 7,
        end: 15,
        form: 'Canadian',
        kind: 'word',
        lemma: 'canadian',
        pos: 'adjective',
      },
      {
        start: 19,
        end: 26,
        form: 'Toronto',
        kind: 'word',
        lemma: 'Toronto',
        pos: 'proper_noun',
      },
    ]);
  });

  it('tags a gerund as a verb even when spaCy calls it a noun', () => {
    const sentences: SentenceRows[] = [
      {
        charStart: 0,
        tokens: [
          token({
            text: 'Swimming',
            pos: 'NOUN',
            lemma: 'swimming',
            isGerund: true,
            charStart: 0,
            charEnd: 8,
          }),
        ],
      },
    ];

    expect(buildTokenAnnotations(sentences, new Map())).toEqual([
      {
        start: 0,
        end: 8,
        form: 'Swimming',
        kind: 'word',
        lemma: 'swimming',
        pos: 'verb',
      },
    ]);
  });

  it('emits one phrase fragment per token of a phrasal-verb group, carrying the resolved phraseId', () => {
    // "She picked it up." — "picked" and "up" share a group id.
    const sentences: SentenceRows[] = [
      {
        charStart: 0,
        tokens: [
          token({
            text: 'She',
            pos: 'PRON',
            lemma: 'she',
            charStart: 0,
            charEnd: 3,
          }),
          token({
            text: 'picked',
            pos: 'VERB',
            lemma: 'pick',
            charStart: 4,
            charEnd: 10,
            phrasalVerbGroupId: 'phrase-1',
          }),
          token({
            text: 'it',
            pos: 'PRON',
            lemma: 'it',
            charStart: 11,
            charEnd: 13,
          }),
          token({
            text: 'up',
            pos: 'ADP',
            lemma: 'up',
            charStart: 14,
            charEnd: 16,
            phrasalVerbGroupId: 'phrase-1',
          }),
        ],
      },
    ];

    const result = buildTokenAnnotations(
      sentences,
      new Map([['phrase-1', 'pick up']]),
    );

    expect(result).toEqual([
      {
        start: 4,
        end: 10,
        form: 'picked',
        kind: 'phrase',
        phraseType: 'phrasal_verb',
        phraseText: 'pick up',
        phraseGroupId: 'phrase-1',
        phraseId: 'phrase-1',
      },
      {
        start: 14,
        end: 16,
        form: 'up',
        kind: 'phrase',
        phraseType: 'phrasal_verb',
        phraseText: 'pick up',
        phraseGroupId: 'phrase-1',
        phraseId: 'phrase-1',
      },
    ]);
  });

  it('does not emit a standalone word for a content token that is part of a phrasal verb', () => {
    const sentences: SentenceRows[] = [
      {
        charStart: 0,
        tokens: [
          token({
            text: 'gave',
            pos: 'VERB',
            lemma: 'give',
            charStart: 0,
            charEnd: 4,
            phrasalVerbGroupId: 'g',
          }),
          token({
            text: 'up',
            pos: 'ADP',
            lemma: 'up',
            charStart: 5,
            charEnd: 7,
            phrasalVerbGroupId: 'g',
          }),
        ],
      },
    ];

    const result = buildTokenAnnotations(
      sentences,
      new Map([['g', 'give up']]),
    );
    expect(result.every((a) => a.kind === 'phrase')).toBe(true);
  });

  it('returns annotations sorted by start offset across multiple sentences', () => {
    const sentences: SentenceRows[] = [
      {
        charStart: 0,
        tokens: [
          token({
            text: 'Rain',
            pos: 'NOUN',
            lemma: 'rain',
            charStart: 0,
            charEnd: 4,
          }),
        ],
      },
      {
        charStart: 6,
        tokens: [
          token({
            text: 'Sun',
            pos: 'NOUN',
            lemma: 'sun',
            charStart: 0,
            charEnd: 3,
          }),
        ],
      },
    ];

    const result = buildTokenAnnotations(sentences, new Map());
    expect(result.map((a) => a.start)).toEqual([0, 6]);
  });
});
