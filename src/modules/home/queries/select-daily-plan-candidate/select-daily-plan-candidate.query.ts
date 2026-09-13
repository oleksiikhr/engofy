import { Query } from '@nestjs/cqrs';
import type { DailyPlanCandidate } from './daily-plan-candidate.js';

export class SelectDailyPlanCandidateQuery extends Query<DailyPlanCandidate> {
  constructor(readonly userId: string) {
    super();
  }
}
