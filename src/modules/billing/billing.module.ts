import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BillingService } from './billing.service.js';
import { ActivateMockSubscriptionHandler } from './commands/activate-mock-subscription/activate-mock-subscription.handler.js';
import { SubscriptionService } from './services/subscription.service.js';

// Mock monetization (PLAN.md §8). Owns the `subscriptions` entity and all
// behaviour around it (D12).
@Module({
  imports: [CqrsModule],
  providers: [
    BillingService,
    SubscriptionService,
    ActivateMockSubscriptionHandler,
  ],
  exports: [BillingService, SubscriptionService],
})
export class BillingModule {}
