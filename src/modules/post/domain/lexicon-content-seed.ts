import { z } from 'zod';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PartOfSpeech } from '../enums/part-of-speech.enum.js';

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
