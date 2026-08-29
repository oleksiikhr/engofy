import type { SubscriptionPlan } from '../../../../modules/auth/enums/subscription-plan.enum.js';

export class SubscriptionResponseDto {
  // 'free' when the user has no active premium subscription.
  readonly plan!: SubscriptionPlan;

  // True while a premium period is running.
  readonly active!: boolean;

  // End of the current premium period, ISO-8601, or null on the free plan.
  readonly currentPeriodEnd!: string | null;

  readonly isMockPayment!: boolean;
}
