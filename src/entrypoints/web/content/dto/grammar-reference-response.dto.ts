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

export class GrammarReferenceGroupDto {
  // Stable id within the requested axis (category name, `past`/`present`/
  // `future`/`other`, or a CEFR level / `other`).
  readonly key!: string;

  // Display label.
  readonly name!: string;

  readonly constructions!: GrammarReferenceConstructionDto[];
}

export class GrammarReferenceResponseDto {
  // The same construction set grouped by the requested `groupBy` axis.
  readonly groups!: GrammarReferenceGroupDto[];

  // Deprecated: same array as `groups`, kept so a client that predates
  // `groupBy` (always category-grouped) keeps working; remove once
  // `apps/web` reads `groups`.
  readonly categories!: GrammarReferenceGroupDto[];
}
