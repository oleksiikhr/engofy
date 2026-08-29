import { LearningCardState } from '../enums/learning-card-state.enum.js';
import {
  aggregateMasteryScore,
  cardMasteryContribution,
  MASTERY_STABILITY_SCALE_DAYS,
} from './mastery.js';

describe('cardMasteryContribution', () => {
  it('is 0 for a card that has never been reviewed', () => {
    expect(
      cardMasteryContribution({ state: LearningCardState.New, stability: 42 }),
    ).toBe(0);
  });

  it('is ~63 at one stability scale', () => {
    const score = cardMasteryContribution({
      state: LearningCardState.Review,
      stability: MASTERY_STABILITY_SCALE_DAYS,
    });
    expect(score).toBeGreaterThan(62);
    expect(score).toBeLessThan(64);
  });

  it('approaches 100 for very stable cards and never exceeds it', () => {
    const score = cardMasteryContribution({
      state: LearningCardState.Review,
      stability: 3650,
    });
    expect(score).toBeGreaterThan(99);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('is 0 for a reviewed card with no stability yet', () => {
    expect(
      cardMasteryContribution({
        state: LearningCardState.Relearning,
        stability: 0,
      }),
    ).toBe(0);
  });
});

describe('aggregateMasteryScore', () => {
  it('is 0 with no cards', () => {
    expect(aggregateMasteryScore([])).toBe(0);
  });

  it('averages contributions and rounds, counting New cards as 0', () => {
    const score = aggregateMasteryScore([
      { state: LearningCardState.Review, stability: 3650 }, // ~100
      { state: LearningCardState.New, stability: 999 }, // 0
    ]);
    expect(score).toBe(50);
  });
});
