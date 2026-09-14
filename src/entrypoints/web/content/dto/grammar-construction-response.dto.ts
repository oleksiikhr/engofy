import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class ConstructionUsagePointDto {
  readonly grammarUsagePointId!: string;

  readonly cefrLevel!: CefrLevel;

  readonly guideword!: string;

  readonly canDoStatement!: string;

  readonly exampleText!: string | null;

  // Per-point effective state — gates this point's own "+ Add to deck"
  // button. EffectiveState.New for a guest or a point with no card yet.
  readonly state!: EffectiveState;
}

export class GrammarConstructionResponseDto {
  readonly slug!: string;

  readonly name!: string;

  readonly categoryName!: string;

  // Markdown cheat sheet, including the Form section.
  readonly cheatSheetContent!: string | null;

  readonly cefrLevel!: CefrLevel | null;

  readonly usagePoints!: ConstructionUsagePointDto[];
}
