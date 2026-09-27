import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { StreakFreeze } from '../../src/modules/learning/entities/streak-freeze.entity.js';

// `userId` and `coveredDate` have no default — pass the user's id and the
// UTC calendar day (`YYYY-MM-DD`) the freeze covers.
export class StreakFreezeFactory extends Factory<StreakFreeze> {
  readonly model = StreakFreeze;

  protected definition() {
    return {
      coveredDate: DateTime.now().toUTC().toISODate() as string,
    };
  }
}
