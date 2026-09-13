import { DomainError } from '../../../core/errors/domain.error.js';

// Thrown by CompleteDailyPlanHandler when no daily_plans row exists yet for
// today — only reachable by calling the complete endpoint before ever calling
// GET /home/daily-plan, which always find-or-creates today's row first.
export class DailyPlanNotFoundError extends DomainError {
  constructor() {
    super('No daily plan selected for today', 404);
  }
}
