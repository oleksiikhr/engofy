import { Factory } from '@mikro-orm/seeder';
import { GrammarUsagePointExercise } from '../../src/modules/post/entities/grammar-usage-point-exercise.entity.js';
import { ExerciseType } from '../../src/modules/post/enums/exercise-type.enum.js';

// `usagePointId` has no default — pass the owning usage point's id.
export class GrammarUsagePointExerciseFactory extends Factory<GrammarUsagePointExercise> {
  readonly model = GrammarUsagePointExercise;

  protected definition() {
    return {
      type: ExerciseType.FillBlank,
      payload: {},
    };
  }
}
