import type { SubscriptionPlan } from '../../../../modules/billing/enums/subscription-plan.enum.js';

export class ProfileSubscriptionResponseDto {
  // 'free' when the user has no active premium subscription.
  readonly plan!: SubscriptionPlan;

  // True while a premium period is running.
  readonly active!: boolean;

  // End of the current premium period, ISO-8601, or null on the free plan.
  readonly currentPeriodEnd!: string | null;

  // Non-archived cards the user holds.
  readonly cardsUsed!: number;

  // Free-tier card cap; null on premium (unlimited).
  readonly cardLimit!: number | null;
}
