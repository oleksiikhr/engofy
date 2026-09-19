import { cefrRank } from '../../post/domain/cefr-order.js';
import type { CefrLevel } from '../../post/enums/cefr-level.enum.js';
import { Disposition } from '../enums/disposition.enum.js';
import { LearningCardState } from '../enums/learning-card-state.enum.js';

// The learner-facing four-state model for one target (learning-foundation
// §2): richer than `LearningCardState` (which only exists once a card does);
// it folds in the disposition and CEFR-default layers a target can carry with
// no card at all.
export enum EffectiveState {
  New = 'new',
  Learning = 'learning',
  Learned = 'learned',
  Skipped = 'skipped',
}

export interface EffectiveStateCard {
  state: LearningCardState;
  scheduledDays: number;
}

export interface EffectiveStateInput {
  // An active (non-archived) card for the target, if one exists.
  card?: EffectiveStateCard | null;
  disposition?: Disposition | null;
  targetCefrLevel?: CefrLevel | null;
  userCefrLevel: CefrLevel;
}

// Priority: an active card always wins (any FSRS state reads as "Learning";
// `Review` with `scheduledDays >= 365` graduates to "Learned") → a stored
// disposition → the CEFR default (target at or below the learner's own level
// reads as already known — nothing is written for this tier, it is computed
// fresh every time) → "New".
export function resolveEffectiveState(
  input: EffectiveStateInput,
): EffectiveState {
  const { card, disposition, targetCefrLevel, userCefrLevel } = input;

  if (card) {
    const graduated =
      card.state === LearningCardState.Review && card.scheduledDays >= 365;
    return graduated ? EffectiveState.Learned : EffectiveState.Learning;
  }

  if (disposition === Disposition.Known) {
    return EffectiveState.Learned;
  }
  if (disposition === Disposition.Skipped) {
    return EffectiveState.Skipped;
  }

  if (targetCefrLevel && cefrRank(targetCefrLevel) <= cefrRank(userCefrLevel)) {
    return EffectiveState.Learned;
  }

  return EffectiveState.New;
}
