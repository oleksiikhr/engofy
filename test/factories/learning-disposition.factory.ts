import { Factory } from '@mikro-orm/seeder';
import { LearningDisposition } from '../../src/modules/learning/entities/learning-disposition.entity.js';
import { Disposition } from '../../src/modules/learning/enums/disposition.enum.js';

// `userId` and exactly one target (`wordDefinitionId` | `phraseId` |
// `grammarUsagePointId`) have no default — the table CHECK demands one.
export class LearningDispositionFactory extends Factory<LearningDisposition> {
  readonly model = LearningDisposition;

  protected definition() {
    return { disposition: Disposition.Known };
  }
}
