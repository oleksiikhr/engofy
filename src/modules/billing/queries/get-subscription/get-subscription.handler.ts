import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SubscriptionService } from '../../services/subscription.service.js';
import {
  type SubscriptionView,
  toSubscriptionView,
} from '../../types/subscription-view.type.js';
import { GetSubscriptionQuery } from './get-subscription.query.js';

// Thin read wrapper over `SubscriptionService` so every billing read goes
// through the QueryBus like the auth baseline (D18). Returns `null` for a user
// with no running premium period.
@QueryHandler(GetSubscriptionQuery)
export class GetSubscriptionHandler
  implements IQueryHandler<GetSubscriptionQuery>
{
  constructor(private readonly subscriptions: SubscriptionService) {}

  async execute({
    userId,
  }: GetSubscriptionQuery): Promise<SubscriptionView | null> {
    const subscription = await this.subscriptions.getActive(userId);
    return subscription ? toSubscriptionView(subscription) : null;
  }
}
