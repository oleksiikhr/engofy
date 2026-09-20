import { z } from 'zod';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import type { ContentLanguage } from '../enums/content-language.enum.js';
import type { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import type { PhraseType } from '../enums/phrase-type.enum.js';
import { CONTENT_LANGUAGE_INFO } from './content-translations.js';

export function buildEnrichmentSystemPrompt(language: ContentLanguage): string {
  const { name, wordExample } = CONTENT_LANGUAGE_INFO[language];
  return `You write learner-dictionary entries for a CEFR-graded English reading app.

You are given two numbered lists: WORDS (a lemma + the part of speech it is used as in the article) and PHRASES (a phrasal verb / idiom / collocation, as running text). Some posts have none of one kind — an empty list still needs the corresponding output array present (just empty).

For EVERY word, in the given part of speech, provide:
- "definition": one short sentence, in plain English, as a learner's dictionary would phrase it — no circular definitions (don't reuse the headword), no jargon.
- "phonetic": the IPA transcription in that part of speech (e.g. "/rʌn/"), or null if you are not confident of it.
- "example": one natural sentence that uses the word in exactly this part of speech and sense.
- "cefrLevel": the CEFR level (A1-C2) at which a learner would typically already know this word in this sense.
- "translation": the ${name} equivalent(s) of the word in exactly this sense and part of speech — one to three common ${name} words or short expressions, comma-separated, in dictionary form (e.g. "${wordExample}"). No explanations, no English.

For EVERY phrase, provide "definition", "example", "cefrLevel" and "translation" the same way (no "phonetic" — multi-word phrases don't get one). A phrase's "translation" is its natural ${name} equivalent, not a word-by-word rendering.

Answer only by calling the "report_enrichment" tool, with "words" and "phrases" covering every index exactly once from the corresponding input list.`;
}

export interface PendingWord {
  wordDefinitionId: string;
  lemma: string;
  pos: PartOfSpeech;
}

export interface PendingPhrase {
  phraseId: string;
  phraseText: string;
  type: PhraseType | null;
}

const wordEntrySchema = z.object({
  index: z.number().int().min(0),
  definition: z.string().min(1),
  phonetic: z.string().min(1).nullable(),
  example: z.string().min(1),
  cefrLevel: z.enum(CefrLevel),
  translation: z.string().min(1),
});

const phraseEntrySchema = z.object({
  index: z.number().int().min(0),
  definition: z.string().min(1),
  example: z.string().min(1),
  cefrLevel: z.enum(CefrLevel),
  translation: z.string().min(1),
});

export const enrichmentToolSchema = z.object({
  words: z.array(wordEntrySchema),
  phrases: z.array(phraseEntrySchema),
});

export type EnrichmentResult = z.infer<typeof enrichmentToolSchema>;
export type WordEnrichmentEntry = z.infer<typeof wordEntrySchema>;
export type PhraseEnrichmentEntry = z.infer<typeof phraseEntrySchema>;

export function buildEnrichmentUserText(
  words: PendingWord[],
  phrases: PendingPhrase[],
): string {
  const wordLines =
    words.map((w, i) => `[${i}] "${w.lemma}" (${w.pos})`).join('\n') ||
    '(none)';
  const phraseLines =
    phrases
      .map((p, i) => `[${i}] "${p.phraseText}"${p.type ? ` (${p.type})` : ''}`)
      .join('\n') || '(none)';

  return `WORDS:\n${wordLines}\n\nPHRASES:\n${phraseLines}`;
}

// Flattens the model's index-tagged entries back onto the positional
// pending list, failing (PLAN.md §12 all-or-nothing) if the model dropped,
// duplicated, or invented an index — same shape as
// complexity-prompt.ts's indexComplexityLevels.
function indexEntries<T extends { index: number }>(
  entries: T[],
  count: number,
  label: string,
): T[] {
  const byIndex = new Map<number, T>();

  for (const entry of entries) {
    if (entry.index < 0 || entry.index >= count) {
      throw new Error(
        `ai_enrichment returned ${label} index ${entry.index} out of range 0..${count - 1}`,
      );
    }
    if (byIndex.has(entry.index)) {
      throw new Error(
        `ai_enrichment returned ${label} index ${entry.index} twice`,
      );
    }
    byIndex.set(entry.index, entry);
  }

  if (byIndex.size !== count) {
    throw new Error(
      `ai_enrichment covered ${byIndex.size} of ${count} ${label} entries`,
    );
  }

  return Array.from({ length: count }, (_, i) => byIndex.get(i) as T);
}

export function indexEnrichmentResult(
  result: EnrichmentResult,
  wordCount: number,
  phraseCount: number,
): { words: WordEnrichmentEntry[]; phrases: PhraseEnrichmentEntry[] } {
  return {
    words: indexEntries(result.words, wordCount, 'word'),
    phrases: indexEntries(result.phrases, phraseCount, 'phrase'),
  };
}
