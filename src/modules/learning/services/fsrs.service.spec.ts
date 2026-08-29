import { DateTime } from 'luxon';
import { LearningCardState } from '../enums/learning-card-state.enum.js';
import { ReviewRating } from '../enums/review-rating.enum.js';
import { FsrsService } from './fsrs.service.js';

describe('FsrsService', () => {
  const service = new FsrsService();
  const now = DateTime.fromISO('2026-08-29T12:00:00.000Z');

  it('creates a fresh card due immediately', () => {
    const card = service.newCard(now);
    expect(card.state).toBe(LearningCardState.New);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
    expect(card.lastReview).toBeNull();
    expect(card.due.toMillis()).toBe(now.toMillis());
  });

  it('schedules a "good" review into the future and logs it', () => {
    const fresh = service.newCard(now);
    const { card, log } = service.review(fresh, ReviewRating.Good, now);

    expect(card.reps).toBe(1);
    expect(card.lastReview?.toMillis()).toBe(now.toMillis());
    expect(card.due.toMillis()).toBeGreaterThan(now.toMillis());
    expect(card.state).not.toBe(LearningCardState.New);
    expect(log.rating).toBe(ReviewRating.Good);
    expect(log.reviewedAt.toMillis()).toBe(now.toMillis());
  });

  it('counts a lapse when a learned card is rated "again"', () => {
    let card = service.newCard(now);
    card = service.review(card, ReviewRating.Easy, now).card;
    expect(card.state).toBe(LearningCardState.Review);
    const later = card.due.plus({ days: 1 });

    const { card: lapsed } = service.review(card, ReviewRating.Again, later);

    expect(lapsed.lapses).toBe(1);
    expect(lapsed.reps).toBe(2);
    // Stability drops on a lapse, so the next interval is shorter than the
    // one the "easy" review had granted.
    expect(lapsed.stability).toBeLessThan(card.stability);
  });
});
