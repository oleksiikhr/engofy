import type { DateTime } from 'luxon';
import type { Subscription } from '../entities/subscription.entity.js';
import type { SubscriptionPlan } from '../enums/subscription-plan.enum.js';

// Plain projection of an active `subscriptions` row. `ActivateMockSubscription`
// (a Command) and `GetSubscriptionQuery` both hand this back rather than a
// managed entity (cqrs.md Q6); the web layer maps it onto
// `SubscriptionResponseDto`. `null` from the query means "free tier".
export interface SubscriptionView {
  plan: SubscriptionPlan;
  currentPeriodEnd: DateTime;
  isMockPayment: boolean;
}

export function toSubscriptionView(
  subscription: Subscription,
): SubscriptionView {
  return {
    plan: subscription.plan,
    currentPeriodEnd: subscription.currentPeriodEnd,
    isMockPayment: subscription.isMockPayment ?? false,
  };
}
