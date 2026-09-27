import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NewCardBudgetService } from '../../services/new-card-budget.service.js';
import { GetDailyNewCardLimitQuery } from './get-daily-new-card-limit.query.js';

// Backs `/profile/subscription`'s "New cards per day" line — the effective
// limit `NewCardBudgetService.remaining` throttles today's queue with.
@QueryHandler(GetDailyNewCardLimitQuery)
export class GetDailyNewCardLimitHandler
  implements IQueryHandler<GetDailyNewCardLimitQuery>
{
  constructor(private readonly budget: NewCardBudgetService) {}

  execute({ userId }: GetDailyNewCardLimitQuery): Promise<number> {
    return this.budget.effectiveLimit(userId);
  }
}
