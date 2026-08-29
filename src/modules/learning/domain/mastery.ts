import { LearningCardState } from '../enums/learning-card-state.enum.js';

// FSRS stability (in days) at which a reviewed card counts as ~63% of the way
// to full mastery. The exponential curve below saturates near 100 well before
// a year of stability. Sole tuning knob for `masteryScore` (PLAN.md §3.6,
// decision 2026-08-29 — score is derived from card scheduling state, not from
// raw attempt tallies).
export const MASTERY_STABILITY_SCALE_DAYS = 30;

export interface MasteryCard {
  state: LearningCardState;
  stability: number;
}

// One card's contribution to its construction's mastery: 0 for a card that
// has never been reviewed (still `New`), otherwise a 0..100 retention proxy
// driven by FSRS stability.
export function cardMasteryContribution(card: MasteryCard): number {
  if (card.state === LearningCardState.New) {
    return 0;
  }
  const raw =
    100 * (1 - Math.exp(-card.stability / MASTERY_STABILITY_SCALE_DAYS));
  return clamp(raw, 0, 100);
}

// Mean contribution across every learning card that targets a usage point of
// the construction. No cards → 0 (locked, or unlocked but never reviewed).
export function aggregateMasteryScore(cards: readonly MasteryCard[]): number {
  if (cards.length === 0) {
    return 0;
  }
  const total = cards.reduce(
    (sum, card) => sum + cardMasteryContribution(card),
    0,
  );
  return Math.round(total / cards.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
