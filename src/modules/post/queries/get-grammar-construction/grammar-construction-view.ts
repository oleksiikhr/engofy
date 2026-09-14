import type { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';

export interface ConstructionUsagePointView {
  grammarUsagePointId: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  exampleText: string | null;
  // Per-point, not collapsed (unlike the reference list's construction-level
  // badge): gates that point's own "+ Add to deck" button. New for a guest.
  state: EffectiveState;
}

export interface GrammarConstructionView {
  slug: string;
  name: string;
  categoryName: string;
  // Markdown, including the Form section built from EGP FORM: rows (PLAN.md
  // §3.4).
  cheatSheetContent: string | null;
  cefrLevel: CefrLevel | null;
  // USE / FORM+USE points, easiest level first — each is an SRS target for
  // the "+" button (PLAN.md §2).
  usagePoints: ConstructionUsagePointView[];
}
