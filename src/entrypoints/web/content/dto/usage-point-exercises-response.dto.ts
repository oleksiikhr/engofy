import type { ExerciseType } from '../../../../modules/post/enums/exercise-type.enum.js';

export class UsagePointExerciseDto {
  readonly id!: string;

  readonly type!: ExerciseType;

  // Shape depends on `type` (fill_blank / find_error / multiple_choice / reorder).
  readonly payload!: Record<string, unknown>;
}

export class UsagePointExercisesResponseDto {
  readonly items!: UsagePointExerciseDto[];
}
