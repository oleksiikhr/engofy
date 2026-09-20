import { z } from 'zod';
import { ContentLanguage } from '../enums/content-language.enum.js';

// Per-language translations stored in a `translations` json column, keyed by
// `ContentLanguage`. Adding a language is a new enum member plus an entry in
// `CONTENT_LANGUAGE_INFO` — no migration.

export const CONTENT_LANGUAGE_INFO: Record<
  ContentLanguage,
  { name: string; wordExample: string }
> = {
  [ContentLanguage.Uk]: { name: 'Ukrainian', wordExample: 'ринок, базар' },
};

// Languages the enrichment stages write; a row is pending while any is missing.
export const ENRICHMENT_LANGUAGES: ContentLanguage[] = [ContentLanguage.Uk];

export interface LexiconTranslation {
  translation: string;
}

export interface GrammarTranslation {
  explanation: string;
}

export type LexiconTranslations = Partial<
  Record<ContentLanguage, LexiconTranslation>
>;
export type GrammarTranslations = Partial<
  Record<ContentLanguage, GrammarTranslation>
>;

const lexiconTranslationsSchema = z.partialRecord(
  z.enum(ContentLanguage),
  z.object({ translation: z.string().min(1) }),
);
const grammarTranslationsSchema = z.partialRecord(
  z.enum(ContentLanguage),
  z.object({ explanation: z.string().min(1) }),
);

// A stored value that does not match the current shape reads as "no
// translations" rather than failing the whole request.
export function readLexiconTranslations(raw: unknown): LexiconTranslations {
  const parsed = lexiconTranslationsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

export function readGrammarTranslations(raw: unknown): GrammarTranslations {
  const parsed = grammarTranslationsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}
