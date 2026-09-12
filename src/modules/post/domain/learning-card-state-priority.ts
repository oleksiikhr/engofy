import { LearningCardState } from '../../learning/enums/learning-card-state.enum.js';

const PRIORITY: Record<LearningCardState, number> = {
  [LearningCardState.New]: 0,
  [LearningCardState.Learning]: 1,
  [LearningCardState.Relearning]: 1,
  [LearningCardState.Review]: 2,
};

// The most-advanced state among a set of LearningCard states for one sidebar
// entry (PLAN.md §17 Track B) — a grammar construction can have a card on
// more than one of its usage points: New < Learning/Relearning < Review. An
// empty input means "no card at all", i.e. New.
export function mostAdvancedState(
  states: LearningCardState[],
): LearningCardState {
  return states.reduce(
    (best, state) => (PRIORITY[state] > PRIORITY[best] ? state : best),
    LearningCardState.New,
  );
}
