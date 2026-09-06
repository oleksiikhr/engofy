import type { CefrLevel } from '../../enums/cefr-level.enum.js';

export interface GrammarReferenceConstructionView {
  slug: string;
  name: string;
  // Easiest CEFR level among the construction's usage points.
  cefrLevel: CefrLevel | null;
  usagePointCount: number;
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
