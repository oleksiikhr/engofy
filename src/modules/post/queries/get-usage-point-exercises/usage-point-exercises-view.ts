import type { ExerciseType } from '../../enums/exercise-type.enum.js';

export interface UsagePointExerciseView {
  id: string;
  type: ExerciseType;
  payload: Record<string, unknown>;
}

export interface UsagePointExercisesView {
  items: UsagePointExerciseView[];
}
