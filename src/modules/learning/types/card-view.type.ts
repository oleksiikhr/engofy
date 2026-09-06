import type { DateTime } from 'luxon';
import type { LearningCard } from '../entities/learning-card.entity.js';
import type { LearningCardState } from '../enums/learning-card-state.enum.js';

// Plain projection of a `learning_cards` row returned by `AddCard` / `ReviewCard`.
// A Command must not hand a managed entity back through the bus (cqrs.md Q6) —
// the web layer maps this onto `LearningCardResponseDto`.
export interface CardView {
  id: string;
  state: LearningCardState;
  due: DateTime;
  reps: number;
  lapses: number;
  stability: number;
  difficulty: number;
  lastReview: DateTime | null;
}

export function toCardView(card: LearningCard): CardView {
  return {
    id: card.id,
    state: card.state,
    due: card.due,
    reps: card.reps,
    lapses: card.lapses,
    stability: card.stability,
    difficulty: card.difficulty,
    lastReview: card.lastReview ?? null,
  };
}
