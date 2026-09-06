import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class ConstructionUsagePointDto {
  readonly grammarUsagePointId!: string;

  readonly cefrLevel!: CefrLevel;

  readonly guideword!: string;

  readonly canDoStatement!: string;

  readonly exampleText!: string | null;
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
