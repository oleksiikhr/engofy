import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Subscription } from '../../auth/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../auth/enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../auth/enums/subscription-status.enum.js';

// Read side of monetization (PLAN.md §8). "Premium" means an active premium
// row whose period has not lapsed; everything else (no row, expired,
// free-plan row) is free tier.
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
      { orderBy: { currentPeriodEnd: 'desc' } },
    );

    const now = DateTime.now();
    return subscriptions.find((s) => s.currentPeriodEnd > now) ?? null;
  }

  async isPremium(userId: string): Promise<boolean> {
    return (await this.getActive(userId)) !== null;
  }
}
