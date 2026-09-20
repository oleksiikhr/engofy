import { Factory } from '@mikro-orm/seeder';
import { DateTime } from 'luxon';
import { DailyPlan } from '../../src/modules/home/entities/daily-plan.entity.js';

// `userId` and `postId` have no default — pass the parents' ids.
export class DailyPlanFactory extends Factory<DailyPlan> {
  readonly model = DailyPlan;

  protected definition() {
    return { planDate: DateTime.now() };
  }
}
