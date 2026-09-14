import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class GrammarReferenceConstructionDto {
  readonly slug!: string;

  readonly name!: string;

  readonly cefrLevel!: CefrLevel | null;

  readonly usagePointCount!: number;

  // Most-advanced effective state across the construction's usage points.
  // EffectiveState.New for a guest or a construction with no cards/dispositions.
  readonly state!: EffectiveState;
}

export class GrammarReferenceCategoryDto {
  readonly name!: string;

  readonly constructions!: GrammarReferenceConstructionDto[];
}

export class GrammarReferenceResponseDto {
  readonly categories!: GrammarReferenceCategoryDto[];
}
