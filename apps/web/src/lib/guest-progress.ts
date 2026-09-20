// Words and phrases a guest opened in the reader, kept in localStorage so the
// "You've explored N words" count carries across texts. Entries are validated
// on read, so a stale or hand-edited value never reaches the DOM. The per-day
// tally next to it backs the guest's day streak and daily counter (local days,
// never synced to an account).

const KEY = 'guest-explored';
const DAYS_KEY = 'guest-explored-days';
const MAX_ENTRIES = 500;
const MAX_DAYS = 400;

// Fired on `document` with the guest's new explored-words count as `detail`.
export const EXPLORED_EVENT = 'reader:explored';
export const GUEST_DAILY_GOAL = 10;

export interface GuestProgress {
  streak: number;
  today: number;
  goal: number;
}

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

function readDays(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DAYS_KEY) ?? '{}');
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const days: Record<string, number> = {};
    for (const [day, count] of Object.entries(parsed)) {
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(day) &&
        typeof count === 'number' &&
        Number.isInteger(count) &&
        count > 0
      ) {
        days[day] = count;
      }
    }
    return days;
  } catch {
    return {};
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / blocked storage — the values hold for this page only.
  }
}

// `YYYY-MM-DD` in the visitor's local time zone, `offset` days from `from`.
export function dayKey(from: Date, offset = 0): string {
  const day = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + offset,
  );
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${month}-${date}`;
}

// Consecutive days with at least one explored word, ending today — or
// yesterday while nothing has been explored yet today.
export function guestStreak(days: Record<string, number>, now: Date): number {
  let offset = days[dayKey(now)] ? 0 : -1;
  let streak = 0;
  while (days[dayKey(now, offset)]) {
    streak += 1;
    offset -= 1;
  }
  return streak;
}

export function exploredCount(): number {
  return new Set(read()).size;
}

export function guestProgress(now: Date = new Date()): GuestProgress {
  const days = readDays();
  return {
    streak: guestStreak(days, now),
    today: days[dayKey(now)] ?? 0,
    goal: GUEST_DAILY_GOAL,
  };
}

// The new count once `key` (`word:<id>` / `phrase:<id>`) is recorded; an
// already-recorded key changes nothing.
export function recordExplored(key: string): number {
  const ids = read();
  if (ids.includes(key) || ids.length >= MAX_ENTRIES) {
    return new Set(ids).size;
  }
  ids.push(key);
  write(KEY, ids);

  const now = new Date();
  const days = readDays();
  const today = dayKey(now);
  days[today] = (days[today] ?? 0) + 1;
  const kept = Object.keys(days).sort().slice(-MAX_DAYS);
  write(DAYS_KEY, Object.fromEntries(kept.map((day) => [day, days[day]])));
  return ids.length;
}
