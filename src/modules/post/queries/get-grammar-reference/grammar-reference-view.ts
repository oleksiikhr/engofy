import type { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';

export interface GrammarReferenceConstructionView {
  slug: string;
  name: string;
  // Easiest CEFR level among the construction's usage points.
  cefrLevel: CefrLevel | null;
  usagePointCount: number;
  // Most-advanced effective state across the construction's usage points
  // (grammar-page-redesign зріз 1). EffectiveState.New for a guest.
  state: EffectiveState;
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
