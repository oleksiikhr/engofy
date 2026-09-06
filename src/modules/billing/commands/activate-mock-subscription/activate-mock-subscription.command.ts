import { Command } from '@nestjs/cqrs';
import type { SubscriptionView } from '../../types/subscription-view.type.js';

export class ActivateMockSubscriptionCommand extends Command<SubscriptionView> {
  constructor(readonly userId: string) {
    super();
  }
}
