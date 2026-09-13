import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { ReviewLog } from '../../../learning/entities/review-log.entity.js';
import type { DailySessionSummaryView } from './daily-session-summary-view.js';
import { GetDailySessionSummaryQuery } from './get-daily-session-summary.query.js';

// Final-screen summary row (daily-session-home plan, зріз 3): new cards added
// today and reviews logged today, across all of a learner's targets (word,
// phrase, grammar) — not scoped to today's post. Cross-module read of
// `learning_cards`/`review_logs` from a query handler is sanctioned (A8), same
// as `SelectDailyPlanCandidateHandler`.
@QueryHandler(GetDailySessionSummaryQuery)
export class GetDailySessionSummaryHandler
  implements IQueryHandler<GetDailySessionSummaryQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({
    userId,
  }: GetDailySessionSummaryQuery): Promise<DailySessionSummaryView> {
    const startOfToday = DateTime.now().toUTC().startOf('day');
    const startOfTomorrow = startOfToday.plus({ days: 1 });

    const cardIds = (
      await this.em.find(LearningCard, { userId }, { fields: ['id'] })
    ).map((card) => card.id);

    const [newCardsToday, reviewsToday] = await Promise.all([
      this.em.count(LearningCard, {
        userId,
        createdAt: { $gte: startOfToday, $lt: startOfTomorrow },
      }),
      cardIds.length === 0
        ? 0
        : this.em.count(ReviewLog, {
            cardId: { $in: cardIds },
            reviewedAt: { $gte: startOfToday, $lt: startOfTomorrow },
          }),
    ]);

    return { newCardsToday, reviewsToday };
  }
}
