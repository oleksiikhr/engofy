import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';
import {
  buildEnrichmentUserText,
  type EnrichmentResult,
  indexEnrichmentResult,
  type PendingPhrase,
  type PendingWord,
} from './enrichment-prompt.js';

describe('buildEnrichmentUserText', () => {
  it('numbers words and phrases on their own lists', () => {
    const words: PendingWord[] = [
      { wordDefinitionId: 'w1', lemma: 'run', pos: PartOfSpeech.Verb },
      { wordDefinitionId: 'w2', lemma: 'happy', pos: PartOfSpeech.Adjective },
    ];
    const phrases: PendingPhrase[] = [
      { phraseId: 'p1', phraseText: 'give up', type: PhraseType.PhrasalVerb },
    ];

    expect(buildEnrichmentUserText(words, phrases)).toBe(
      'WORDS:\n[0] "run" (verb)\n[1] "happy" (adjective)\n\n' +
        'PHRASES:\n[0] "give up" (phrasal_verb)',
    );
  });

  it('renders (none) for an empty list', () => {
    expect(buildEnrichmentUserText([], [])).toBe(
      'WORDS:\n(none)\n\nPHRASES:\n(none)',
    );
  });
});

describe('indexEnrichmentResult', () => {
  const word = (index: number) => ({
    index,
    definition: 'd',
    phonetic: null,
    example: 'e',
    cefrLevel: CefrLevel.A1,
    translation: 'у',
  });
  const phrase = (index: number) => ({
    index,
    definition: 'd',
    example: 'e',
    cefrLevel: CefrLevel.A1,
    translation: 'у',
  });

  it('returns entries positionally when every index is covered', () => {
    const result: EnrichmentResult = {
      words: [word(1), word(0)],
      phrases: [phrase(0)],
    };

    const indexed = indexEnrichmentResult(result, 2, 1);
    expect(indexed.words.map((w) => w.index)).toEqual([0, 1]);
    expect(indexed.phrases.map((p) => p.index)).toEqual([0]);
  });

  it('throws when a word index is out of range', () => {
    const result: EnrichmentResult = { words: [word(5)], phrases: [] };
    expect(() => indexEnrichmentResult(result, 1, 0)).toThrow('out of range');
  });

  it('throws when a phrase index is repeated', () => {
    const result: EnrichmentResult = {
      words: [],
      phrases: [phrase(0), phrase(0)],
    };
    expect(() => indexEnrichmentResult(result, 0, 1)).toThrow('twice');
  });

  it('throws when not every entry is covered', () => {
    const result: EnrichmentResult = { words: [word(0)], phrases: [] };
    expect(() => indexEnrichmentResult(result, 2, 0)).toThrow('covered 1 of 2');
  });
});
