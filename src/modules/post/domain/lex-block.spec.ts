import type {
  NlpParseResult,
  NlpToken,
} from '../../../core/nlp/nlp-client.port.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';
import { buildLexBlockSpans, lexBlockHash } from './lex-block.js';

const TEXT = 'She drew a detailed map.';

const token = (
  index: number,
  text: string,
  lemma: string,
  pos: string,
  start: number,
): NlpToken => ({
  index,
  text,
  lemma,
  pos,
  tag: '',
  dep: index === 1 ? 'ROOT' : 'dep',
  morph: {},
  head: 1,
  start,
  end: start + text.length,
});

const parsed: NlpParseResult = {
  sentences: [
    {
      text: TEXT,
      start: 0,
      end: TEXT.length,
      tokens: [
        token(0, 'She', 'she', 'PRON', 0),
        token(1, 'drew', 'draw', 'VERB', 4),
        token(2, 'a', 'a', 'DET', 9),
        token(3, 'detailed', 'detailed', 'ADJ', 11),
        token(4, 'map', 'map', 'NOUN', 20),
        token(5, '.', '.', 'PUNCT', 23),
      ],
    },
  ],
};

describe('buildLexBlockSpans', () => {
  it('links content words, skipping function words and very common lemmas', () => {
    const words = buildLexBlockSpans(TEXT, parsed, new Map([['map', 900]]));

    expect(words).toEqual([
      { kind: 'word', start: 4, end: 8, lemma: 'draw', pos: PartOfSpeech.Verb },
      {
        kind: 'word',
        start: 11,
        end: 19,
        lemma: 'detailed',
        pos: PartOfSpeech.Adjective,
      },
    ]);
  });

  it('leaves out proper nouns, fragments and words not in the Latin script', () => {
    const text = 'Ukrainian порада Anna -s';
    const result: NlpParseResult = {
      sentences: [
        {
          text,
          start: 0,
          end: text.length,
          tokens: [
            token(0, 'Ukrainian', 'ukrainian', 'ADJ', 0),
            token(1, 'порада', 'порада', 'NOUN', 10),
            token(2, 'Anna', 'Anna', 'PROPN', 17),
            token(3, '-s', '-s', 'NOUN', 22),
          ],
        },
      ],
    };

    expect(buildLexBlockSpans(text, result, new Map())).toEqual([
      {
        kind: 'word',
        start: 0,
        end: 9,
        lemma: 'ukrainian',
        pos: PartOfSpeech.Adjective,
      },
    ]);
  });

  it('groups a phrasal verb into one phrase, fragment by fragment', () => {
    const text = 'She picked it up';
    const result: NlpParseResult = {
      sentences: [
        {
          text,
          start: 0,
          end: text.length,
          tokens: [
            token(0, 'She', 'she', 'PRON', 0),
            { ...token(1, 'picked', 'pick', 'VERB', 4), dep: 'ROOT' },
            token(2, 'it', 'it', 'PRON', 11),
            { ...token(3, 'up', 'up', 'ADP', 14), dep: 'prt' },
          ],
        },
      ],
    };

    expect(
      buildLexBlockSpans(text, result, new Map(), {
        literal: [],
        phrasalVerbs: ['pick up'],
      }),
    ).toEqual([
      expect.objectContaining({
        kind: 'phrase',
        start: 4,
        end: 10,
        phraseText: 'pick up',
        phraseType: PhraseType.PhrasalVerb,
      }),
      expect.objectContaining({ kind: 'phrase', start: 14, end: 16 }),
    ]);
  });

  it('leaves out a phrasal verb that is not listed', () => {
    const text = 'She picked it up';
    const result: NlpParseResult = {
      sentences: [
        {
          text,
          start: 0,
          end: text.length,
          tokens: [
            {
              ...token(1, 'picked', 'pick', 'VERB', 4),
              index: 0,
              dep: 'ROOT',
              head: 0,
            },
            {
              ...token(3, 'up', 'up', 'ADP', 14),
              index: 1,
              dep: 'prt',
              head: 0,
            },
          ],
        },
      ],
    };

    expect(buildLexBlockSpans(text, result, new Map())).toEqual([]);
  });

  it('lets a listed phrase replace the words inside it', () => {
    const text = 'On the other hand, the map was detailed.';
    const result: NlpParseResult = {
      sentences: [
        {
          text,
          start: 0,
          end: text.length,
          tokens: [
            token(0, 'On', 'on', 'ADP', 0),
            token(1, 'the', 'the', 'DET', 3),
            token(2, 'other', 'other', 'ADJ', 7),
            token(3, 'hand', 'hand', 'NOUN', 13),
            token(4, 'map', 'map', 'NOUN', 23),
          ],
        },
      ],
    };

    expect(
      buildLexBlockSpans(text, result, new Map(), {
        literal: ['on the other hand'],
        phrasalVerbs: [],
      }),
    ).toEqual([
      {
        kind: 'phrase',
        start: 0,
        end: 17,
        phraseText: 'on the other hand',
        phraseType: PhraseType.Other,
      },
      {
        kind: 'word',
        start: 23,
        end: 26,
        lemma: 'map',
        pos: PartOfSpeech.Noun,
      },
    ]);
  });
});

describe('lexBlockHash', () => {
  it('is stable for the same text and differs for another', () => {
    expect(lexBlockHash(TEXT)).toBe(lexBlockHash(TEXT));
    expect(lexBlockHash(TEXT)).toHaveLength(32);
    expect(lexBlockHash(TEXT)).not.toBe(lexBlockHash(`${TEXT} `));
  });
});
