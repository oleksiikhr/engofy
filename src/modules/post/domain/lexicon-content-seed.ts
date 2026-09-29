import { z } from 'zod';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { PhraseType } from '../enums/phrase-type.enum.js';

// Seed format for hand-written dictionary entries (assets/lexicon-content.json,
// see assets/README.md): lemma -> part of speech -> the fields the enrichment
// job writes for a WordDefinition. Content is written by another session (no
// AI call from this codebase) — this schema is the contract its output must
// satisfy.

const text = z.string().trim().min(1);

export const LexiconContentEntrySchema = z.object({
  definition: text,
  example: text,
  cefrLevel: z.enum(CefrLevel),
  uk: z.object({ translation: text }),
});

export type LexiconContentEntry = z.infer<typeof LexiconContentEntrySchema>;

export const LexiconContentSeedFileSchema = z.record(
  z.string().regex(/^[a-z][a-z'’-]*$/, 'must be a lowercase lemma'),
  z.partialRecord(z.enum(PartOfSpeech), LexiconContentEntrySchema),
);

export type LexiconContentSeedFile = z.infer<
  typeof LexiconContentSeedFileSchema
>;

export function parseLexiconContentSeedFile(
  raw: unknown,
): LexiconContentSeedFile {
  return LexiconContentSeedFileSchema.parse(raw);
}

// assets/phrase-content.json: phrase text (lowercase) -> the same entry
// fields; `type: "phrasal_verb"` marks one linked only where spaCy groups it
// (see LexBlockPhrases), anything else is matched as literal text.
export const PhraseContentSeedFileSchema = z.record(
  z.string().regex(/^[a-z][a-z'’ -]*[a-z]$/, 'must be a lowercase phrase'),
  LexiconContentEntrySchema.extend({
    type: z.literal(PhraseType.PhrasalVerb).optional(),
  }),
);

export type PhraseContentSeedFile = z.infer<typeof PhraseContentSeedFileSchema>;

export function parsePhraseContentSeedFile(
  raw: unknown,
): PhraseContentSeedFile {
  return PhraseContentSeedFileSchema.parse(raw);
}

// The phrase lists `grammar annotate-pages` links, from the seed file.
export function phraseLists(seed: PhraseContentSeedFile): {
  literal: string[];
  phrasalVerbs: string[];
} {
  const entries = Object.entries(seed);
  return {
    literal: entries.filter(([, e]) => !e.type).map(([text]) => text),
    phrasalVerbs: entries.filter(([, e]) => e.type).map(([text]) => text),
  };
}
