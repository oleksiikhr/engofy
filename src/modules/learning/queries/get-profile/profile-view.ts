import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';

export interface ProfileConstructionView {
  slug: string;
  name: string;
  // Easiest CEFR level among the construction's usage points; null when it
  // has none (not expected for EGP-imported data).
  cefrLevel: CefrLevel | null;
  // True until the learner adds their first card for any of the
  // construction's usage points.
  locked: boolean;
  // 0-100, aggregated from the FSRS stability of the learner's cards for this
  // construction.
  masteryScore: number;
  // Consecutive non-"Again" grades across this construction's cards.
  correctStreak: number;
}

export interface ProfileCategoryView {
  name: string;
  constructions: ProfileConstructionView[];
}

export interface ProfileView {
  // Consecutive UTC days with at least one review, ending today or yesterday.
  streak: number;
  // Count of the learner's SRS cards per CEFR level. A card whose target has
  // no known level (unclassified word/phrase) is left out of every bucket.
  cefr: Record<CefrLevel, number>;
  // The 19 EGP categories in sort order, each with its constructions.
  categories: ProfileCategoryView[];
}
