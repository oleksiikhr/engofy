import { DateTime } from 'luxon';
import {
  coverableGapDay,
  STREAK_FREEZES_PER_MONTH,
  streakFreezeBalance,
} from './streak-freeze.js';

const NOW = DateTime.fromISO('2026-08-29T10:00:00Z', { zone: 'utc' });

function daysAgo(n: number): string {
  return NOW.minus({ days: n }).toISODate() as string;
}

describe('streakFreezeBalance', () => {
  it('is the full allotment when none were used', () => {
    expect(streakFreezeBalance(0)).toBe(STREAK_FREEZES_PER_MONTH);
  });

  it('decreases by how many were already used this month', () => {
    expect(streakFreezeBalance(1)).toBe(STREAK_FREEZES_PER_MONTH - 1);
  });

  it('never goes below 0', () => {
    expect(streakFreezeBalance(STREAK_FREEZES_PER_MONTH + 5)).toBe(0);
  });

  it('respects a custom allotment', () => {
    expect(streakFreezeBalance(1, 5)).toBe(4);
  });
});

describe('coverableGapDay', () => {
  it('is null when yesterday was already reviewed (no gap)', () => {
    const reviewed = new Set([daysAgo(1), daysAgo(2)]);
    expect(coverableGapDay(reviewed, new Set(), NOW)).toBeNull();
  });

  it('is null when yesterday is already frozen', () => {
    const reviewed = new Set([daysAgo(2)]);
    const frozen = new Set([daysAgo(1)]);
    expect(coverableGapDay(reviewed, frozen, NOW)).toBeNull();
  });

  it('is yesterday when yesterday is missing but the day before was reviewed', () => {
    const reviewed = new Set([daysAgo(2)]);
    expect(coverableGapDay(reviewed, new Set(), NOW)).toBe(daysAgo(1));
  });

  it('is yesterday when the day before was itself covered by a freeze', () => {
    const frozen = new Set([daysAgo(2)]);
    expect(coverableGapDay(new Set(), frozen, NOW)).toBe(daysAgo(1));
  });

  it('is null when the gap is two days wide (nothing to reconnect to)', () => {
    const reviewed = new Set([daysAgo(3)]);
    expect(coverableGapDay(reviewed, new Set(), NOW)).toBeNull();
  });

  it('is null with no activity at all', () => {
    expect(coverableGapDay(new Set(), new Set(), NOW)).toBeNull();
  });
});
