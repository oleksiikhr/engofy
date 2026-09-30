// Languages a lexicon/grammar entry can be translated into. English is the
// base language and lives in the entities' own columns, so it is not a member.
export enum ContentLanguage {
  Uk = 'uk',
}

// Served when a request names no (valid) language of its own.
export const DEFAULT_CONTENT_LANGUAGE = ContentLanguage.Uk;
