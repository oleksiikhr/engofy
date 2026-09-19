import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NewCardBudgetService } from '../../services/new-card-budget.service.js';
import { GetNewCardBudgetQuery } from './get-new-card-budget.query.js';

// Backs the reader's study mode: how many new words it may still offer to add
// today (the same remaining-of-`DAILY_NEW_CARD_LIMIT` figure the practice
// queue throttles New cards with).
@QueryHandler(GetNewCardBudgetQuery)
export class GetNewCardBudgetHandler
  implements IQueryHandler<GetNewCardBudgetQuery>
{
  constructor(private readonly budget: NewCardBudgetService) {}

  execute({ userId }: GetNewCardBudgetQuery): Promise<number> {
    return this.budget.remaining(userId);
  }
}
