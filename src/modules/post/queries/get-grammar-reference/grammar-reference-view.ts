import type { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';

export interface GrammarReferenceConstructionView {
  slug: string;
  name: string;
  // Easiest CEFR level among the construction's usage points.
  cefrLevel: CefrLevel | null;
  usagePointCount: number;
  // Learner explanation of the construction's easiest usage point; null until
  // the grammar_enrichment stage has covered it.
  summary: string | null;
  // Collapsed from the learner's own cards/dispositions across the usage
  // points (no CEFR default): Learned when all are resolved, Learning when
  // some are, New when none. EffectiveState.New for a guest.
  state: EffectiveState;
  // Usage points the learner resolved (Learned or Skipped); out of
  // `usagePointCount`. Absent for a guest.
  learnedCount?: number;
}

export interface GrammarReferenceGroupView {
  // Stable id of the group within its axis (category name, `past`/`present`/
  // `future`/`other`, or a CEFR level / `other`); `name` is its label.
  key: string;
  name: string;
  constructions: GrammarReferenceConstructionView[];
}

export interface GrammarReferenceView {
  // The same construction set grouped by the requested axis. `category`: the
  // 19 EGP categories in sort order (PLAN.md §4 `/grammar`); `time`: Past /
  // Present / Future / Other; `cefr`: A1 → C2 by each construction's easiest
  // level. Constructions keep their category-then-sort order inside a group.
  groups: GrammarReferenceGroupView[];
}
