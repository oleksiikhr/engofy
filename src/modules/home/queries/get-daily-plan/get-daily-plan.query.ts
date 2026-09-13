import { Query } from '@nestjs/cqrs';
import type { DailyPlanView } from './daily-plan-view.js';

export class GetDailyPlanQuery extends Query<DailyPlanView | null> {
  constructor(readonly userId: string) {
    super();
  }
}
