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

export interface GrammarReferenceCategoryView {
  name: string;
  constructions: GrammarReferenceConstructionView[];
}

export interface GrammarReferenceView {
  // The 19 EGP categories in sort order, each with its constructions in sort
  // order (PLAN.md §4 `/grammar`).
  categories: GrammarReferenceCategoryView[];
}
