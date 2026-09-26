import type { DateTime } from 'luxon';

// Fixed monthly allotment — Premium only, no stored counter: balance is this
// minus however many `StreakFreeze` rows the user already created this
// calendar month (same "derive at read time" principle as the streak itself,
// `daily-streak.ts`).
export const STREAK_FREEZES_PER_MONTH = 2;

export function streakFreezeBalance(
  usedThisMonth: number,
  allotment: number = STREAK_FREEZES_PER_MONTH,
): number {
  return Math.max(0, allotment - usedThisMonth);
}

// The one UTC calendar day a freeze could cover right now, or null if there
// is none. A freeze only repairs a single missed day: yesterday must be
// missing (not already reviewed or frozen) and the day before it present —
// otherwise there is no still-warm streak on the other side of the gap for a
// freeze to reconnect. Today is never the candidate: it may still be
// reviewed the ordinary way before the day is over.
export function coverableGapDay(
  reviewedDays: ReadonlySet<string>,
  frozenDays: ReadonlySet<string>,
  now: DateTime,
): string | null {
  const yesterday = now.toUTC().startOf('day').minus({ days: 1 });
  const yesterdayIso = isoDay(yesterday);
  if (reviewedDays.has(yesterdayIso) || frozenDays.has(yesterdayIso)) {
    return null;
  }

  const dayBeforeIso = isoDay(yesterday.minus({ days: 1 }));
  const hadStreakBefore =
    reviewedDays.has(dayBeforeIso) || frozenDays.has(dayBeforeIso);
  return hadStreakBefore ? yesterdayIso : null;
}

function isoDay(dt: DateTime): string {
  return dt.toISODate() ?? '';
}
