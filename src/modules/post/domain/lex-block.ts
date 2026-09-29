import { createHash } from 'node:crypto';
import type { NlpParseResult } from '../../../core/nlp/nlp-client.port.js';
import type { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { buildSentences } from './build-sentences.js';
import { buildTokenAnnotations } from './build-token-annotations.js';

// A text block of a handcrafted grammar page (one paragraph, list item,
// example…), as apps/web extracts it from the rendered page. The web keys its
// spans by the same hash, so the formula must match `lib/lex-blocks.ts`.
export function lexBlockHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

// A clickable word in a block: half-open char range + the sense it links to.
export interface LexBlockWord {
  start: number;
  end: number;
  lemma: string;
  pos: PartOfSpeech;
}

// The word spans a grammar page block gets — the same deterministic rule as
// an article's word layer (content words outside the most common ones, see
// buildTokenAnnotations). Phrasal verbs are not grouped here: their tokens
// stay plain words.
export function buildLexBlockWords(
  text: string,
  parsed: NlpParseResult,
  frequencyRanks: Map<string, number>,
): LexBlockWord[] {
  const sentences = buildSentences(text, parsed).map((sentence) => ({
    charStart: sentence.charStart,
    tokens: sentence.tokens.map((token) => ({
      ...token,
      phrasalVerbGroupId: null,
    })),
  }));
  return buildTokenAnnotations(sentences, new Map(), frequencyRanks).flatMap(
    (annotation) =>
      annotation.kind === 'word' && annotation.lemma && annotation.pos
        ? [
            {
              start: annotation.start,
              end: annotation.end,
              lemma: annotation.lemma,
              pos: annotation.pos as PartOfSpeech,
            },
          ]
        : [],
  );
}
