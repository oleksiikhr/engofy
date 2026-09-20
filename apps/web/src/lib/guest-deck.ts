// Cards a guest saved from the reader, kept in localStorage until they sign in
// (`initGuestDeckImport` then moves them into the account). Entries are
// validated on read, so a stale or hand-edited value never reaches the DOM or
// the API.

const KEY = 'guest-deck';
// The free-tier deck size; a guest can't queue more than an account could keep.
const MAX_ENTRIES = 100;
const KINDS = ['word', 'phrase', 'grammar'] as const;

export interface GuestDeckEntry {
  kind: (typeof KINDS)[number];
  id: string;
}

function isEntry(value: unknown): value is GuestDeckEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { kind, id } = value as Record<string, unknown>;
  return (
    typeof id === 'string' &&
    id !== '' &&
    (KINDS as readonly unknown[]).includes(kind)
  );
}

export function readGuestDeck(): GuestDeckEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function write(entries: GuestDeckEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Private mode / blocked storage — the save holds for this page only.
  }
}

// False when the deck is already full.
export function addToGuestDeck(entry: GuestDeckEntry): boolean {
  const entries = readGuestDeck();
  if (entries.some((e) => e.kind === entry.kind && e.id === entry.id)) {
    return true;
  }
  if (entries.length >= MAX_ENTRIES) {
    return false;
  }
  write([...entries, { kind: entry.kind, id: entry.id }]);
  return true;
}

export function clearGuestDeck(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored that we could remove.
  }
}

// Signed-in pages only: moves the saved cards into the account through
// /partials/import-guest-deck, then empties the local deck. A failed request
// keeps the deck for the next page load.
export async function importGuestDeck(): Promise<void> {
  const entries = readGuestDeck();
  if (entries.length === 0) {
    return;
  }
  try {
    const res = await fetch('/partials/import-guest-deck', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entries),
    });
    if (res.ok) {
      clearGuestDeck();
    }
  } catch {
    // Offline — retried on the next page load.
  }
}
