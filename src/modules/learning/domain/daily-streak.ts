import type { DateTime } from 'luxon';

// Length of the run of consecutive UTC calendar days ending today — or, when
// nothing has been reviewed yet today, ending yesterday — on which the learner
// graded at least one card. Derived from `review_logs`; there is no stored
// counter (PLAN.md §3.6, decision 2026-08-29). `frozenDays` (a Premium user's
// `StreakFreeze.coveredDate` rows, `streak-freeze.ts`) count the same as a
// reviewed day — a backward-compatible addition, defaulting to none.
export function computeDailyStreak(
  reviewedAt: readonly DateTime[],
  now: DateTime,
  frozenDays: readonly string[] = [],
): number {
  const days = new Set<string>(frozenDays);
  for (const dt of reviewedAt) {
    const iso = dt.toUTC().startOf('day').toISODate();
    if (iso) {
      days.add(iso);
    }
  }
  return streakFromDays(days, now);
}

// Same result as `computeDailyStreak` for callers that already hold the
// distinct UTC calendar days as `YYYY-MM-DD` strings — `get-profile` pushes the
// `DISTINCT (reviewed_at at time zone 'UTC')::date` down to SQL instead of
// loading every `review_logs` row.
export function dailyStreakFromUtcDays(
  utcDays: readonly string[],
  now: DateTime,
  frozenDays: readonly string[] = [],
): number {
  return streakFromDays(new Set([...utcDays, ...frozenDays]), now);
}

function streakFromDays(days: Set<string>, now: DateTime): number {
  if (days.size === 0) {
    return 0;
  }

  const today = now.toUTC().startOf('day');
  let cursor = days.has(isoDay(today)) ? today : today.minus({ days: 1 });
  if (!days.has(isoDay(cursor))) {
    return 0;
  }

  let streak = 0;
  while (days.has(isoDay(cursor))) {
    streak += 1;
    cursor = cursor.minus({ days: 1 });
  }
  return streak;
}

function isoDay(dt: DateTime): string {
  return dt.toISODate() ?? '';
}
