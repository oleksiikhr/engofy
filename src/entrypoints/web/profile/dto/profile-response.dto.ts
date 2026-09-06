import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class ProfileConstructionDto {
  readonly slug!: string;

  readonly name!: string;

  // Easiest CEFR level among the construction's usage points, or null.
  readonly cefrLevel!: CefrLevel | null;

  // No card added yet for any of this construction's usage points.
  readonly locked!: boolean;

  // 0-100, aggregated from the FSRS stability of the learner's grammar cards.
  readonly masteryScore!: number;

  // Consecutive non-"Again" grades across this construction's cards.
  readonly correctStreak!: number;
}

export class ProfileCategoryDto {
  readonly name!: string;

  readonly constructions!: ProfileConstructionDto[];
}

export class CefrBreakdownDto {
  readonly A1!: number;

  readonly A2!: number;

  readonly B1!: number;

  readonly B2!: number;

  readonly C1!: number;

  readonly C2!: number;
}

export class ProfileResponseDto {
  // Consecutive UTC days with at least one review, ending today or yesterday.
  readonly streak!: number;

  // Learner's SRS card count per CEFR level (unclassified targets excluded).
  readonly cefr!: CefrBreakdownDto;

  // The 19 EGP categories in sort order, each with its constructions.
  readonly categories!: ProfileCategoryDto[];
}
