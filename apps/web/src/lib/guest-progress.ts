// Words and phrases a guest opened in the reader, kept in localStorage so the
// "You've explored N words" count carries across texts. Entries are validated
// on read, so a stale or hand-edited value never reaches the DOM.

const KEY = 'guest-explored';
const MAX_ENTRIES = 500;

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id !== '')
      : [];
  } catch {
    return [];
  }
}

export function exploredCount(): number {
  return new Set(read()).size;
}

// The new count once `key` (`word:<id>` / `phrase:<id>`) is recorded; an
// already-recorded key changes nothing.
export function recordExplored(key: string): number {
  const ids = read();
  if (ids.includes(key) || ids.length >= MAX_ENTRIES) {
    return new Set(ids).size;
  }
  ids.push(key);
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode / blocked storage — the count holds for this page only.
  }
  return ids.length;
}
