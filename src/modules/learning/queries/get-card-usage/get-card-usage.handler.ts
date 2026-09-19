import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  CardLimitService,
  type CardUsage,
} from '../../services/card-limit.service.js';
import { GetCardUsageQuery } from './get-card-usage.query.js';

// Backs `/profile/subscription`'s "72 / 100 cards" line — same count the
// free-tier cap in `CardLimitService.assertCanAddCard` enforces.
@QueryHandler(GetCardUsageQuery)
export class GetCardUsageHandler implements IQueryHandler<GetCardUsageQuery> {
  constructor(private readonly cardLimit: CardLimitService) {}

  execute({ userId }: GetCardUsageQuery): Promise<CardUsage> {
    return this.cardLimit.getUsage(userId);
  }
}
