import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BillingService } from './billing.service.js';
import { ActivateMockSubscriptionHandler } from './commands/activate-mock-subscription/activate-mock-subscription.handler.js';
import { SubscriptionService } from './services/subscription.service.js';

// Mock monetization (PLAN.md §8). The `subscriptions` entity lives in the
// auth module; the behaviour around it lives here.
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
