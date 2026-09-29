import type {
  NlpParseResult,
  NlpToken,
} from '../../../core/nlp/nlp-client.port.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { buildLexBlockWords, lexBlockHash } from './lex-block.js';

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

describe('buildLexBlockWords', () => {
  it('links content words, skipping function words and very common lemmas', () => {
    const words = buildLexBlockWords(TEXT, parsed, new Map([['map', 900]]));

    expect(words).toEqual([
      { start: 4, end: 8, lemma: 'draw', pos: PartOfSpeech.Verb },
      { start: 11, end: 19, lemma: 'detailed', pos: PartOfSpeech.Adjective },
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
