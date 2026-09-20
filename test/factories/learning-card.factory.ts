import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { LearningCard } from '../../src/modules/learning/entities/learning-card.entity.js';

// `userId` and exactly one target (`wordDefinitionId` | `phraseId` |
// `grammarUsagePointId`) have no default — the table CHECK demands one.
export class LearningCardFactory extends Factory<LearningCard> {
  readonly model = LearningCard;

  protected definition() {
    return {
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
    };
  }
}
