import { createHash } from 'node:crypto';
import type { NlpParseResult } from '../../../core/nlp/nlp-client.port.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';
import { buildSentences } from './build-sentences.js';
import { buildTokenAnnotations } from './build-token-annotations.js';

// A text block of a handcrafted grammar page (one paragraph, list item,
// example…), as apps/web extracts it from the rendered page. The web keys its
// spans by the same hash, so the formula must match `lib/lex-blocks.ts`.
export function lexBlockHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 32);
}

// A clickable span in a block (half-open char range): a word, linked to its
// sense by lemma + part of speech, or a phrase, linked by its text. A
// discontinuous phrasal verb ("picked her up") is one span per fragment.
export type LexBlockSpan =
  | {
      kind: 'word';
      start: number;
      end: number;
      lemma: string;
      pos: PartOfSpeech;
    }
  | {
      kind: 'phrase';
      start: number;
      end: number;
      phraseText: string;
      phraseType: PhraseType;
    };

// An English word of two letters or more (hyphens only inside): the pages'
// Ukrainian comparisons, IPA transcriptions, fragments like "-s" and
// contractions like "bus'll" or "amn't" sit inline in the prose and are not
// looked up.
const ENGLISH_WORD_RE = /^[A-Za-z]{2,}(?:-[A-Za-z]+)*$/;
const REGEX_SPECIAL_RE = /[.*+?^${}()|[\]\\]/g;

// The phrases a grammar page links, both hand-listed: `literal` ones (idioms,
// fixed expressions — an article gets these from the AI pass) wherever the
// text occurs; `phrasalVerbs` only where spaCy groups that phrasal verb (a
// literal match would also catch "go on holiday"), so a spaCy misparse that
// isn't listed gets no span.
export interface LexBlockPhrases {
  literal: string[];
  phrasalVerbs: string[];
}

// The spans a grammar page block gets — the same deterministic rule as an
// article's lexical layer (buildTokenAnnotations: content words outside the
// most common ones, phrasal verbs grouped by spaCy), English words only and
// no proper nouns (on these pages they are example names or grammar terms
// spaCy mistakes for names). A literal phrase replaces any span it overlaps.
export function buildLexBlockSpans(
  text: string,
  parsed: NlpParseResult,
  frequencyRanks: Map<string, number>,
  phrases: LexBlockPhrases = { literal: [], phrasalVerbs: [] },
): LexBlockSpan[] {
  const listedPhrasalVerbs = new Set(phrases.phrasalVerbs);
  const sentences = buildSentences(text, parsed).map((sentence) => ({
    charStart: sentence.charStart,
    tokens: sentence.tokens.map((token) => ({
      ...token,
      phrasalVerbGroupId: token.phrasalVerbKey,
    })),
  }));
  // The phrasal verb's canonical key doubles as its group id and phrase text.
  const phrasalVerbs = new Map<string, string>();
  for (const sentence of sentences) {
    for (const token of sentence.tokens) {
      if (token.phrasalVerbKey) {
        phrasalVerbs.set(token.phrasalVerbKey, token.phrasalVerbKey);
      }
    }
  }
  const fromTokens = buildTokenAnnotations(
    sentences,
    phrasalVerbs,
    frequencyRanks,
  ).flatMap((annotation): LexBlockSpan[] => {
    if (annotation.kind === 'phrase' && annotation.phraseText) {
      if (!listedPhrasalVerbs.has(annotation.phraseText)) {
        return [];
      }
      return [
        {
          kind: 'phrase',
          start: annotation.start,
          end: annotation.end,
          phraseText: annotation.phraseText,
          phraseType: PhraseType.PhrasalVerb,
        },
      ];
    }
    return annotation.kind === 'word' &&
      annotation.lemma &&
      annotation.pos &&
      annotation.pos !== PartOfSpeech.ProperNoun &&
      ENGLISH_WORD_RE.test(annotation.form)
      ? [
          {
            kind: 'word',
            start: annotation.start,
            end: annotation.end,
            lemma: annotation.lemma,
            pos: annotation.pos as PartOfSpeech,
          },
        ]
      : [];
  });

  const listed = findListedPhrases(text, phrases.literal);
  const overlapsListed = (span: LexBlockSpan) =>
    listed.some((phrase) => span.start < phrase.end && phrase.start < span.end);
  return [
    ...listed,
    ...fromTokens.filter((span) => !overlapsListed(span)),
  ].sort((a, b) => a.start - b.start);
}

// Whole-word, case-insensitive occurrences of the listed phrases, longest
// phrase first, never overlapping each other.
function findListedPhrases(text: string, phrases: string[]): LexBlockSpan[] {
  const found: LexBlockSpan[] = [];
  const byLength = [...phrases].sort((a, b) => b.length - a.length);
  for (const phrase of byLength) {
    const pattern = new RegExp(
      `(?<![A-Za-z])${phrase.replace(REGEX_SPECIAL_RE, '\\$&')}(?![A-Za-z])`,
      'gi',
    );
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (found.some((span) => start < span.end && span.start < end)) {
        continue;
      }
      found.push({
        kind: 'phrase',
        start,
        end,
        phraseText: phrase,
        phraseType: PhraseType.Other,
      });
    }
  }
  return found;
}
