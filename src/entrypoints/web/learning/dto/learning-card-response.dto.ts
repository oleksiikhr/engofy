import type { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';

export class LearningCardResponseDto {
  readonly id!: string;

  readonly state!: LearningCardState;

  // Next due date, ISO-8601.
  readonly due!: string;

  readonly reps!: number;

  readonly lapses!: number;

  readonly stability!: number;

  readonly difficulty!: number;
}
