import type { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';

export interface ConstructionUsagePointView {
  grammarUsagePointId: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  explanation: string | null;
  examples: string[];
  // Per-point, not collapsed (unlike the reference list's construction-level
  // badge): gates that point's own "+ Add to deck" button. From the learner's
  // own cards/dispositions only — New for a guest or an untouched point.
  state: EffectiveState;
  // State is New, but the point's level is at or below the learner's own —
  // the page labels it "Assumed known". Always false for a guest.
  assumedKnown: boolean;
}

export interface ConstructionLevelProgressView {
  cefrLevel: CefrLevel;
  // Usage points at this level the learner resolved (Learned or Skipped).
  learnedCount: number;
  totalCount: number;
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
  // Easiest level first. Absent for a guest.
  levelProgress?: ConstructionLevelProgressView[];
}
