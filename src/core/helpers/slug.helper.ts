export interface SlugifyOptions {
  // Hard cap on the result length (applied last — a trailing `-` is possible
  // if the cut lands on a separator, matching the pre-extraction behaviour).
  maxLength?: number;
}

// Lowercase ASCII slug. Content in this app is English, so NFKD + combining-mark
// strip is enough — no transliteration. Any run of non `[a-z0-9]` collapses to a
// single `-`, and leading/trailing `-` runs are trimmed.
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return options.maxLength === undefined
    ? slug
    : slug.slice(0, options.maxLength);
}
