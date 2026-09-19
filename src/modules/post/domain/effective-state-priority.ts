import { EffectiveState } from '../../learning/domain/resolve-effective-state.js';

// New < Skipped < Learning < Learned: an explicit dismissal is more resolved
// than an untouched target, but active engagement with the SRS (Learning) or
// having it graduate/count as known (Learned) outranks a skip.
const PRIORITY: Record<EffectiveState, number> = {
  [EffectiveState.New]: 0,
  [EffectiveState.Skipped]: 1,
  [EffectiveState.Learning]: 2,
  [EffectiveState.Learned]: 3,
};

// Collapses the per-usage-point effective states of one grammar construction
// into a single state for a construction-level badge (grammar-page-redesign
// зріз 1) — "most advanced wins". An empty input means no usage points at
// all, i.e. New.
export function mostAdvancedEffectiveState(
  states: EffectiveState[],
): EffectiveState {
  return states.reduce(
    (best, state) => (PRIORITY[state] > PRIORITY[best] ? state : best),
    EffectiveState.New,
  );
}
