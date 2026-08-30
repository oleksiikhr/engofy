import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Subscription } from '../entities/subscription.entity.js';
import { SubscriptionPlan } from '../enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../enums/subscription-status.enum.js';

// Read side of monetization (PLAN.md §8). "Premium" means an active premium
// row whose period has not lapsed; everything else (no row, free-plan row) is
// free tier. Module-internal — reads reach it through `GetSubscriptionQuery`
// (D18); not exported from `billing.module.ts`.
@Injectable()
export class SubscriptionService {
  constructor(private readonly em: EntityManager) {}

  async getActive(userId: string): Promise<Subscription | null> {
    const subscriptions = await this.em.find(
      Subscription,
      {
        userId,
        plan: SubscriptionPlan.Premium,
        status: SubscriptionStatus.Active,
      },
      { orderBy: { currentPeriodEnd: 'desc' }, disableIdentityMap: true },
    );

    const now = DateTime.now();
    return subscriptions.find((s) => s.currentPeriodEnd > now) ?? null;
  }
}
