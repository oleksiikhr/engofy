import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { BillingService } from '../../billing/billing.service.js';
import { LearningCard } from '../entities/learning-card.entity.js';
import { CardLimitReachedError } from '../errors/card-limit-reached.error.js';

// Free tier is capped at 100 cards total — COUNT(*) over learning_cards for
// the user, no split by target type (PLAN.md §3.5, §12). Premium lifts it.
export const FREE_CARD_LIMIT = 100;

export interface CardUsage {
  used: number;
  limit: number | null;
}

@Injectable()
export class CardLimitService {
  constructor(
    private readonly em: EntityManager,
    private readonly billing: BillingService,
  ) {}

  async assertCanAddCard(userId: string): Promise<void> {
    if (await this.billing.isPremium(userId)) {
      return;
    }

    const count = await this.countCards(userId);
    if (count >= FREE_CARD_LIMIT) {
      throw new CardLimitReachedError(FREE_CARD_LIMIT);
    }
  }

  // `limit` is null on premium (unlimited).
  async getUsage(userId: string): Promise<CardUsage> {
    const [used, isPremium] = await Promise.all([
      this.countCards(userId),
      this.billing.isPremium(userId),
    ]);
    return { used, limit: isPremium ? null : FREE_CARD_LIMIT };
  }

  private countCards(userId: string): Promise<number> {
    return this.em.count(LearningCard, { userId, archivedAt: null });
  }
}
