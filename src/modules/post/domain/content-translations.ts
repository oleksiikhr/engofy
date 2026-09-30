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
  // Translations of the usage point's example sentences, index-aligned with
  // them. Only hand-written seed content has them; grammar_enrichment writes
  // the explanation alone.
  examples?: string[];
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
  z.object({
    explanation: z.string().min(1),
    examples: z.array(z.string().min(1)).optional(),
  }),
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

// The one language a request is served in; null when it is not translated yet.
export function pickLexiconTranslation(
  raw: unknown,
  lang: ContentLanguage,
): string | null {
  return readLexiconTranslations(raw)[lang]?.translation ?? null;
}

export function pickGrammarTranslation(
  raw: unknown,
  lang: ContentLanguage,
): { translation: string | null; exampleTranslations: string[] | null } {
  const entry = readGrammarTranslations(raw)[lang];
  return {
    translation: entry?.explanation ?? null,
    exampleTranslations: entry?.examples ?? null,
  };
}
