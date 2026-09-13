import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { GetPracticeQueueQuery } from './get-practice-queue.query.js';
import type { PracticeQueueItem } from './practice-queue-item.js';
import { cardTargetKey, resolveCardTargets } from './resolve-card-targets.js';

// The SRS review queue for a user (PLAN.md §4 `/practice`): every card whose
// `due` has arrived, soonest first, capped at `limit`. Fresh cards are due
// immediately, so they surface here too. Each card is resolved to its
// display text with batched lookups (no N+1).
@QueryHandler(GetPracticeQueueQuery)
export class GetPracticeQueueHandler
  implements IQueryHandler<GetPracticeQueueQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute(query: GetPracticeQueueQuery): Promise<PracticeQueueItem[]> {
    const cards = await this.em.find(
      LearningCard,
      {
        userId: query.userId,
        due: { $lte: DateTime.now() },
        archivedAt: null,
      },
      {
        orderBy: { due: 'asc', createdAt: 'asc' },
        limit: query.limit,
        disableIdentityMap: true,
      },
    );
    if (cards.length === 0) {
      return [];
    }

    const targets = await resolveCardTargets(this.em, cards);

    return cards
      .map((card) => {
        const target = targets.get(cardTargetKey(card));
        if (!target) {
          return null;
        }
        return {
          cardId: card.id,
          state: card.state,
          due: card.due,
          target,
        } satisfies PracticeQueueItem;
      })
      .filter((item): item is PracticeQueueItem => item !== null);
  }
}
