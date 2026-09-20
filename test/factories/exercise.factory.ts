import { Factory } from '@mikro-orm/seeder';
import { Exercise } from '../../src/modules/post/entities/exercise.entity.js';
import { ExerciseSource } from '../../src/modules/post/enums/exercise-source.enum.js';
import { ExerciseType } from '../../src/modules/post/enums/exercise-type.enum.js';

// `postId` has no default — pass the owning post's id.
export class ExerciseFactory extends Factory<Exercise> {
  readonly model = Exercise;

  protected definition() {
    return {
      type: ExerciseType.FillBlank,
      payload: {},
      source: ExerciseSource.Spacy,
    };
  }
}
