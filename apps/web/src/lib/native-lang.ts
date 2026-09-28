import type { TranslationLang } from './types';

// The learner's native language — the one translation offered next to English
// (reader popup, grammar usage-point cards, dictionary). Single source for it:
// Ukrainian for everyone until a second language exists, then it comes from a
// cookie / the account.
export function nativeLang(): TranslationLang {
  return 'uk';
}

// Label on the EN / native switch.
export const NATIVE_LANG_LABEL: Record<TranslationLang, string> = {
  uk: 'УКР',
};
