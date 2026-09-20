// The /practice type-filter chips (practice-redesign зріз 4): a multi-select
// over card types, carried in the URL as `?types=word,grammar`. An empty
// selection means "all" — the default, and what the param's absence encodes.

export const PRACTICE_TYPES = ['word', 'phrase', 'grammar'] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export const PRACTICE_TYPE_LABEL: Record<PracticeType, string> = {
  word: 'Words',
  phrase: 'Phrases',
  grammar: 'Grammar',
};

// Tone class per type (app.css `.tone-*`), matching the reader's colours.
export const PRACTICE_TYPE_TONE: Record<PracticeType, string> = {
  word: 'tone-amber',
  phrase: 'tone-pink',
  grammar: 'tone-blue',
};

// Unknown values are dropped; a full selection collapses to "all" so the URL
// and the API query stay canonical.
export function parseTypesParam(raw: string | null): PracticeType[] {
  const requested = new Set((raw ?? '').split(','));
  const selected = PRACTICE_TYPES.filter((type) => requested.has(type));
  return selected.length === PRACTICE_TYPES.length ? [] : selected;
}

// Flips one chip. Deselecting the last remaining type falls back to "all"
// rather than an empty queue.
export function toggleType(
  active: readonly PracticeType[],
  type: PracticeType,
): PracticeType[] {
  const current = active.length > 0 ? active : PRACTICE_TYPES;
  const next = current.includes(type)
    ? current.filter((t) => t !== type)
    : [...current, type];
  return parseTypesParam(next.join(','));
}

// `types=word,grammar`, or '' for "all" — for appending to a URL.
export function typesQuery(types: readonly PracticeType[]): string {
  return types.length > 0 ? `types=${types.join(',')}` : '';
}

export function isTypeActive(
  active: readonly PracticeType[],
  type: PracticeType,
): boolean {
  return active.length === 0 || active.includes(type);
}
