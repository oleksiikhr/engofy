import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { dailyStreakFromUtcDays } from '../../domain/daily-streak.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { GetStreakQuery } from './get-streak.query.js';

// Backs the reader/feed header's day-streak display (PLAN.md §16/§17 Track
// B) — a standalone, cheap version of the same computation
// `get-profile.handler.ts`'s `computeStreak` does, so a page that only needs
// the streak number doesn't pull the full skills tree. Distinct UTC review
// days pushed to SQL, same as get-profile.
@QueryHandler(GetStreakQuery)
export class GetStreakHandler implements IQueryHandler<GetStreakQuery> {
  constructor(private readonly em: EntityManager) {}

  async execute({ userId }: GetStreakQuery): Promise<number> {
    const cardIds = (
      await this.em.find(LearningCard, { userId }, { fields: ['id'] })
    ).map((card) => card.id);
    if (cardIds.length === 0) {
      return 0;
    }

    const placeholders = cardIds.map(() => '?').join(', ');
    const rows = await this.em.getConnection().execute<{ day: string }[]>(
      `SELECT DISTINCT to_char((reviewed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day
         FROM review_logs
        WHERE card_id IN (${placeholders})`,
      cardIds,
      'all',
      this.em.getTransactionContext(),
    );

    return dailyStreakFromUtcDays(
      rows.map((row) => row.day),
      DateTime.now(),
    );
  }
}
