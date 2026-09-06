import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { BillingService } from '../../billing/billing.service.js';
import { LearningCard } from '../entities/learning-card.entity.js';
import { CardLimitReachedError } from '../errors/card-limit-reached.error.js';

// Free tier is capped at 100 cards total — COUNT(*) over learning_cards for
// the user, no split by target type (PLAN.md §3.5, §12). Premium lifts it.
export const FREE_CARD_LIMIT = 100;

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

    const count = await this.em.count(LearningCard, { userId });
    if (count >= FREE_CARD_LIMIT) {
      throw new CardLimitReachedError(FREE_CARD_LIMIT);
    }
  }
}
