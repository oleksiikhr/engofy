import { EffectiveState } from '../../learning/domain/resolve-effective-state.js';

// A usage point counts as resolved once the learner has settled it: it
// graduated (Learned, a card or a Known disposition) or was dismissed
// (Skipped). Untouched (New) and in-progress (Learning) points are open.
function isResolved(state: EffectiveState): boolean {
  return state === EffectiveState.Learned || state === EffectiveState.Skipped;
}

export function countResolved(states: EffectiveState[]): number {
  return states.filter(isResolved).length;
}

// Collapses the per-usage-point effective states of one grammar construction
// into a single state for a construction-level badge. The inputs carry no
// CEFR default — only what the learner did (cards, dispositions):
//   - Learned: every point resolved, at least one truly Learned;
//   - Skipped: every point Skipped;
//   - New: no point touched (also no points at all);
//   - Learning: anything in between — a card, or only some points resolved.
export function collapseConstructionState(
  states: EffectiveState[],
): EffectiveState {
  if (states.every((state) => state === EffectiveState.New)) {
    return EffectiveState.New;
  }
  if (states.every((state) => state === EffectiveState.Skipped)) {
    return EffectiveState.Skipped;
  }
  if (states.every(isResolved)) {
    return EffectiveState.Learned;
  }
  return EffectiveState.Learning;
}
