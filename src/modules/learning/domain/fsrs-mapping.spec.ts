import { DateTime } from 'luxon';
import { createEmptyCard, Rating, State } from 'ts-fsrs';
import { LearningCardState } from '../enums/learning-card-state.enum.js';
import { ReviewRating } from '../enums/review-rating.enum.js';
import {
  ratingFromFsrs,
  toFsrsCard,
  toFsrsRating,
  toReviewLogEntry,
  toSchedulingState,
} from './fsrs-mapping.js';

describe('fsrs-mapping', () => {
  it('round-trips an empty card through scheduling state and back', () => {
    const now = DateTime.fromISO('2026-08-29T12:00:00.000Z');
    const empty = createEmptyCard(now.toJSDate());

    const state = toSchedulingState(empty);
    expect(state.state).toBe(LearningCardState.New);
    expect(state.reps).toBe(0);
    expect(state.lastReview).toBeNull();
    expect(state.due.toMillis()).toBe(now.toMillis());

    const card = toFsrsCard(state);
    expect(card.due.getTime()).toBe(empty.due.getTime());
    expect(card.state).toBe(State.New);
    expect(card.stability).toBe(empty.stability);
    expect(card.last_review).toBeUndefined();
  });

  it('maps every learning-card state in both directions', () => {
    const cases: [State, LearningCardState][] = [
      [State.New, LearningCardState.New],
      [State.Learning, LearningCardState.Learning],
      [State.Review, LearningCardState.Review],
      [State.Relearning, LearningCardState.Relearning],
    ];
    for (const [fsrsState, enumState] of cases) {
      const state = toSchedulingState({
        ...createEmptyCard(new Date()),
        state: fsrsState,
      });
      expect(state.state).toBe(enumState);
      expect(toFsrsCard(state).state).toBe(fsrsState);
    }
  });

  it('maps ratings both ways', () => {
    expect(toFsrsRating(ReviewRating.Again)).toBe(Rating.Again);
    expect(toFsrsRating(ReviewRating.Easy)).toBe(Rating.Easy);
    expect(ratingFromFsrs(Rating.Good)).toBe(ReviewRating.Good);
  });

  it('rejects a non-gradeable ts-fsrs rating', () => {
    expect(() => ratingFromFsrs(Rating.Manual)).toThrow();
  });

  it('extracts the review-log slice', () => {
    const entry = toReviewLogEntry({
      rating: Rating.Hard,
      state: State.Review,
      due: new Date(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 3,
      last_elapsed_days: 2,
      scheduled_days: 7,
      learning_steps: 0,
      review: new Date('2026-08-29T10:00:00.000Z'),
    });
    expect(entry.rating).toBe(ReviewRating.Hard);
    expect(entry.elapsedDays).toBe(3);
    expect(entry.scheduledDays).toBe(7);
    expect(entry.reviewedAt.toUTC().toISO()).toBe('2026-08-29T10:00:00.000Z');
  });
});
