import { Query } from '@nestjs/cqrs';
import type { SubscriptionView } from '../../types/subscription-view.type.js';

export class GetSubscriptionQuery extends Query<SubscriptionView | null> {
  constructor(readonly userId: string) {
    super();
  }
}
