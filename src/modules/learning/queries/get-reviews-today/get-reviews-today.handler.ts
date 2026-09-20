import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { ReviewLog } from '../../entities/review-log.entity.js';
import { GetReviewsTodayQuery } from './get-reviews-today.query.js';

// Cards the learner graded since the start of the current UTC day — the
// numerator of the daily-goal ring. Same UTC-day boundary as the streak.
@QueryHandler(GetReviewsTodayQuery)
export class GetReviewsTodayHandler
  implements IQueryHandler<GetReviewsTodayQuery>
{
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: GetReviewsTodayQuery): Promise<number> {
    const cardIds = (
      await this.em.find(LearningCard, { userId }, { fields: ['id'] })
    ).map((card) => card.id);
    if (cardIds.length === 0) {
      return 0;
    }

    return this.em.count(ReviewLog, {
      cardId: { $in: cardIds },
      reviewedAt: { $gte: DateTime.utc().startOf('day') },
    });
  }
}
