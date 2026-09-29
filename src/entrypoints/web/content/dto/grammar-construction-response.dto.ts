import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';
import type { ContentLanguage } from '../../../../modules/post/enums/content-language.enum.js';
import type {
  PostGrammarTranslationDto,
  PostWordAnnotationDto,
} from './post-detail-response.dto.js';

type ConstructionGrammarTranslations = Partial<
  Record<ContentLanguage, PostGrammarTranslationDto>
>;

export class ConstructionUsagePointDto {
  readonly grammarUsagePointId!: string;

  // 1-based row number in assets/egp.json; null for a usage point added from
  // a non-EGP source. The page anchors this point at `#usage-point-
  // -{egpIndex}` for the Reader popup's "Practice" link.
  readonly egpIndex!: number | null;

  readonly cefrLevel!: CefrLevel;

  readonly guideword!: string;

  readonly canDoStatement!: string;

  // Learner-facing explanation and clean example sentences; null / empty
  // until the grammar_enrichment stage has covered this point.
  readonly explanation!: string | null;

  // Translations of `explanation` by language; empty until translated.
  readonly translations!: ConstructionGrammarTranslations;

  readonly examples!: string[];

  // Per-point effective state — gates this point's own "+ Add to deck"
  // button. From the learner's own cards/dispositions only (no CEFR default);
  // EffectiveState.New for a guest or a point with no card yet.
  readonly state!: EffectiveState;

  // State is New, but the point's level is at or below the learner's own.
  // Always false for a guest.
  readonly assumedKnown!: boolean;
}

export class ConstructionLevelProgressDto {
  readonly cefrLevel!: CefrLevel;

  // Usage points at this level the learner resolved (Learned or Skipped).
  readonly learnedCount!: number;

  readonly totalCount!: number;
}

export class GrammarConstructionResponseDto {
  readonly slug!: string;

  readonly name!: string;

  readonly categoryName!: string;

  // Markdown cheat sheet, including the Form section.
  readonly cheatSheetContent!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  readonly usagePoints!: ConstructionUsagePointDto[];

  // Resolved / total usage points per level, easiest first. Absent for a guest.
  readonly levelProgress?: ConstructionLevelProgressDto[];

  readonly lexicon!: GrammarPageLexiconDto;
}

export class GrammarPageLexWordDto {
  // Half-open char range in the block's text.
  readonly start!: number;

  readonly end!: number;

  readonly wordDefinitionId!: string;
}

// Clickable words of the handcrafted page; empty until `grammar
// annotate-pages` has run for it.
export class GrammarPageLexiconDto {
  // Word spans per text block, keyed by the hash of the block's text
  // (sha256 hex, first 32 chars).
  readonly blocks!: Record<string, GrammarPageLexWordDto[]>;

  // Keyed by wordDefinitionId.
  readonly words!: Record<string, PostWordAnnotationDto>;
}
