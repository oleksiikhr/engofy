import type { EffectiveState } from '../../../../modules/learning/domain/resolve-effective-state.js';
import type { CefrLevel } from '../../../../modules/post/enums/cefr-level.enum.js';

export class GrammarReferenceConstructionDto {
  readonly slug!: string;

  readonly name!: string;

  readonly cefrLevel!: CefrLevel | null;

  readonly usagePointCount!: number;

  // Collapsed from the learner's own cards/dispositions across the usage
  // points (no CEFR default). EffectiveState.New for a guest or a construction
  // with no cards/dispositions.
  readonly state!: EffectiveState;

  // Usage points the learner resolved (Learned or Skipped), out of
  // `usagePointCount`. Absent for a guest.
  readonly learnedCount?: number;
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
}
