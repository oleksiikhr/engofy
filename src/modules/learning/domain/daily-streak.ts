import type { DateTime } from 'luxon';

// Length of the run of consecutive UTC calendar days ending today — or, when
// nothing has been reviewed yet today, ending yesterday — on which the learner
// graded at least one card. Derived from `review_logs`; there is no stored
// counter (PLAN.md §3.6, decision 2026-08-29).
export function computeDailyStreak(
  reviewedAt: readonly DateTime[],
  now: DateTime,
): number {
  const days = new Set<string>();
  for (const dt of reviewedAt) {
    const iso = dt.toUTC().startOf('day').toISODate();
    if (iso) {
      days.add(iso);
    }
  }
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
