import type { EffectiveState } from '../../../learning/domain/resolve-effective-state.js';
import type { GrammarPageLexSpan } from '../../entities/grammar-page-lex-block.entity.js';
import type { CefrLevel } from '../../enums/cefr-level.enum.js';
import type {
  PhraseAnnotationView,
  WordAnnotationView,
} from '../get-post-detail/post-detail-view.js';

export interface ConstructionUsagePointView {
  grammarUsagePointId: string;
  // 1-based row number in assets/egp.json; null for a usage point added from
  // a non-EGP source. The page anchors each point at `#usage-point-
  // -{egpIndex}` so the Reader popup's "Practice" link can deep-link here.
  egpIndex: number | null;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  explanation: string | null;
  // `explanation` in the request's language; null until translated.
  translation: string | null;
  // Index-aligned with `examples`; null when only the explanation is translated.
  exampleTranslations: string[] | null;
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
  lexicon: GrammarPageLexiconView;
}

// Clickable words and phrases of the handcrafted page (`grammar
// annotate-pages`): the spans of each text block, keyed by `lexBlockHash` of
// the block's text, and the popup data of every word / phrase they link to.
// Empty when the page has not been annotated.
export interface GrammarPageLexiconView {
  blocks: Record<string, GrammarPageLexSpan[]>;
  words: Record<string, WordAnnotationView>;
  phrases: Record<string, PhraseAnnotationView>;
}
