import { LearningCardState } from '../enums/learning-card-state.enum.js';

// How many never-reviewed cards a practice session introduces at once —
// review/relearning cards are due material already in progress and are never
// capped, only New ones (daily-session-home PLAN, зріз 2; practice-redesign
// зріз 2 reuses this same constant instead of defining its own).
export const DAILY_NEW_CARD_LIMIT = 12;

// Upper bound a Premium user may override `DAILY_NEW_CARD_LIMIT` with
// (`PATCH /profile/daily-new-card-limit`) — keeps a single misconfigured
// override from blowing up the practice queue or the New-card budget query.
export const MAX_DAILY_NEW_CARD_LIMIT_OVERRIDE = 100;

export interface NewCardCapInput {
  state: LearningCardState;
}

export interface NewCardCapResult<T> {
  cards: T[];
  heldBackCount: number;
}

// Keeps every review/relearning card but stops adding New ones past `limit`,
// in whatever order `cards` is already sorted in. `heldBackCount` is how many
// New cards this pass dropped — the practice queue surfaces it so the UI can
// explain why fewer new cards showed up than are actually due, and offer to
// show them anyway (practice-redesign зріз 2). `limit` defaults to
// `DAILY_NEW_CARD_LIMIT`; the practice queue passes a smaller remaining
// budget once some of today's allotment is already spent.
export function capNewCards<T extends NewCardCapInput>(
  cards: readonly T[],
  limit: number = DAILY_NEW_CARD_LIMIT,
): NewCardCapResult<T> {
  let newCount = 0;
  let heldBackCount = 0;
  const result: T[] = [];
  for (const card of cards) {
    if (card.state === LearningCardState.New) {
      if (newCount >= limit) {
        heldBackCount += 1;
        continue;
      }
      newCount += 1;
    }
    result.push(card);
  }
  return { cards: result, heldBackCount };
}
