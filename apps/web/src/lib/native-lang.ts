// The learner's native language — the one translation offered next to English
// (reader popup, grammar usage-point cards, dictionary). The backend serves
// content already translated into it; the frontend only needs the code (for
// `lang` attributes) and the switch label. Adding a language: one entry in
// `NATIVE_LANG_LABEL`, matching the backend's `ContentLanguage`.
export const NATIVE_LANG_LABEL = {
  uk: 'УКР',
} as const;

export type NativeLang = keyof typeof NATIVE_LANG_LABEL;

export const NATIVE_LANGS = Object.keys(NATIVE_LANG_LABEL) as NativeLang[];
export const DEFAULT_NATIVE_LANG: NativeLang = 'uk';

// Display name of each language, for the picker.
export const NATIVE_LANG_NAME: Record<NativeLang, string> = {
  uk: 'Українська',
};

export function parseNativeLang(value: unknown): NativeLang | null {
  return typeof value === 'string' &&
    (NATIVE_LANGS as readonly string[]).includes(value)
    ? (value as NativeLang)
    : null;
}

// Browser-side lookup: Layout renders the resolved language onto
// `<html data-native-lang>` (server-side, so it is known before paint).
// Server code gets it from `resolveNativeLang` (session.ts) instead.
export function nativeLang(): NativeLang {
  return typeof document === 'undefined'
    ? DEFAULT_NATIVE_LANG
    : (parseNativeLang(document.documentElement.dataset.nativeLang) ??
        DEFAULT_NATIVE_LANG);
}
