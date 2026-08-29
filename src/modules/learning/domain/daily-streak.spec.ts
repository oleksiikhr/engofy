import { DateTime } from 'luxon';
import { computeDailyStreak } from './daily-streak.js';

const NOW = DateTime.fromISO('2026-08-29T10:00:00Z', { zone: 'utc' });

function daysAgo(n: number): DateTime {
  return NOW.minus({ days: n }).set({ hour: 8 });
}

describe('computeDailyStreak', () => {
  it('is 0 with no reviews', () => {
    expect(computeDailyStreak([], NOW)).toBe(0);
  });

  it('counts a single review today as 1', () => {
    expect(computeDailyStreak([daysAgo(0)], NOW)).toBe(1);
  });

  it('counts consecutive days ending today', () => {
    expect(computeDailyStreak([daysAgo(0), daysAgo(1), daysAgo(2)], NOW)).toBe(
      3,
    );
  });

  it('still counts a run that ends yesterday (nothing today yet)', () => {
    expect(computeDailyStreak([daysAgo(1), daysAgo(2)], NOW)).toBe(2);
  });

  it('is 0 when the most recent review is two days old', () => {
    expect(computeDailyStreak([daysAgo(2), daysAgo(3)], NOW)).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(computeDailyStreak([daysAgo(0), daysAgo(1), daysAgo(3)], NOW)).toBe(
      2,
    );
  });

  it('collapses multiple reviews on the same day', () => {
    expect(
      computeDailyStreak(
        [daysAgo(0), NOW.set({ hour: 1 }), NOW.set({ hour: 23 })],
        NOW,
      ),
    ).toBe(1);
  });

  it('is order-independent', () => {
    expect(computeDailyStreak([daysAgo(2), daysAgo(0), daysAgo(1)], NOW)).toBe(
      3,
    );
  });
});
