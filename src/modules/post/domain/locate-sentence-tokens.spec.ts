import type { AnalyzableSentenceToken } from './analyze-token.js';
import { locateSentenceTokens } from './locate-sentence-tokens.js';
import type { Block } from './node-tree.types.js';

type FixtureToken = AnalyzableSentenceToken & {
  charStart: number;
  charEnd: number;
};

// "The cat sat." — "cat" carries a `word` span (has a dictionary entry),
// "The" and "sat" don't.
const PARAGRAPH: Block = {
  type: 'paragraph',
  children: [
    { type: 'text', text: 'The ' },
    {
      type: 'span',
      kind: 'word',
      wordDefinitionId: 'wd1',
      pos: 'noun',
      text: 'cat',
    },
    { type: 'text', text: ' sat.' },
  ],
};

const SENTENCE = {
  unitIndex: 0,
  charStart: 0,
  charEnd: 12,
  rawText: 'The cat sat.',
};

const TOKENS: FixtureToken[] = [
  {
    position: 0,
    text: 'The',
    lemma: 'the',
    pos: 'DET',
    tag: 'DT',
    morph: {},
    dep: 'det',
    headPosition: 1,
    charStart: 0,
    charEnd: 3,
  },
  {
    position: 1,
    text: 'cat',
    lemma: 'cat',
    pos: 'NOUN',
    tag: 'NN',
    morph: {},
    dep: 'nsubj',
    headPosition: 2,
    charStart: 4,
    charEnd: 7,
  },
  {
    position: 2,
    text: 'sat',
    lemma: 'sit',
    pos: 'VERB',
    tag: 'VBD',
    morph: { Tense: 'Past', VerbForm: 'Fin' },
    dep: 'ROOT',
    headPosition: null,
    charStart: 8,
    charEnd: 11,
  },
  {
    position: 3,
    text: '.',
    lemma: '.',
    pos: 'PUNCT',
    tag: '.',
    morph: {},
    dep: 'punct',
    headPosition: 2,
    charStart: 11,
    charEnd: 12,
  },
];

describe('locateSentenceTokens roleFallback', () => {
  it('sets roleFallback for a token with no lexicon entry, omits it for one covered by a word span', () => {
    const located = locateSentenceTokens({
      block: PARAGRAPH,
      sentence: SENTENCE,
      tokens: TOKENS,
      irregularByLemma: new Map(),
    });

    const [theToken, catToken, satToken] = located;
    expect(theToken.roleFallback).toEqual({
      posLabel: 'definite article',
      roleHint: expect.any(String),
    });
    expect(catToken.roleFallback).toBeUndefined();
    expect('roleFallback' in catToken).toBe(false);
    expect(satToken.roleFallback).toEqual({
      posLabel: 'verb',
      roleHint: expect.any(String),
    });
  });

  it('omits roleFallback for a token covered by a phrase span', () => {
    const block: Block = {
      type: 'paragraph',
      children: [
        {
          type: 'span',
          kind: 'phrase',
          phraseId: 'ph1',
          text: 'give up',
        },
        { type: 'text', text: ' now.' },
      ],
    };
    const located = locateSentenceTokens({
      block,
      sentence: {
        unitIndex: 0,
        charStart: 0,
        charEnd: 12,
        rawText: 'give up now.',
      },
      tokens: [
        {
          position: 0,
          text: 'give',
          lemma: 'give',
          pos: 'VERB',
          tag: 'VB',
          morph: {},
          dep: 'ROOT',
          headPosition: null,
          charStart: 0,
          charEnd: 4,
        },
        {
          position: 1,
          text: 'up',
          lemma: 'up',
          pos: 'ADP',
          tag: 'RP',
          morph: {},
          dep: 'prt',
          headPosition: 0,
          charStart: 5,
          charEnd: 7,
        },
      ] satisfies FixtureToken[],
      irregularByLemma: new Map(),
    });

    expect(located.every((token) => token.roleFallback === undefined)).toBe(
      true,
    );
  });
});
