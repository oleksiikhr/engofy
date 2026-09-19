export interface CalendarDay {
  date: string; // YYYY-MM-DD (UTC)
  active: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 53;

// GitHub-style grid: `WEEKS` week columns of 7 Monday-first rows, ending with
// the week that contains `today`. Days after `today` are omitted (the last
// column is partial). Days are UTC, matching `activityDays` from the API.
export function buildActivityCalendar(
  activityDays: string[],
  today: Date = new Date(),
): CalendarDay[] {
  const active = new Set(activityDays);
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const mondayOffset = (new Date(todayUtc).getUTCDay() + 6) % 7;
  const start = todayUtc - (mondayOffset + (WEEKS - 1) * 7) * DAY_MS;

  const days: CalendarDay[] = [];
  for (let t = start; t <= todayUtc; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    days.push({ date, active: active.has(date) });
  }
  return days;
}
