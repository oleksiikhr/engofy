import { EntityManager } from '@mikro-orm/postgresql';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { DateTime } from 'luxon';
import { dailyStreakFromUtcDays } from '../../domain/daily-streak.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { StreakFreezeService } from '../../services/streak-freeze.service.js';
import { GetStreakQuery } from './get-streak.query.js';

// Backs the reader/feed header's day-streak display (PLAN.md §16/§17 Track
// B) — a standalone, cheap version of the same computation
// `get-profile.handler.ts`'s `computeStreak` does, so a page that only needs
// the streak number doesn't pull the full skills tree. Distinct UTC review
// days pushed to SQL, same as get-profile. A Premium user's frozen days
// (`StreakFreezeService`) count the same as a reviewed day.
@QueryHandler(GetStreakQuery)
export class GetStreakHandler implements IQueryHandler<GetStreakQuery> {
  constructor(
    private readonly em: EntityManager,
    private readonly streakFreeze: StreakFreezeService,
  ) {}

  async execute({ userId }: GetStreakQuery): Promise<number> {
    const cardIds = (
      await this.em.find(LearningCard, { userId }, { fields: ['id'] })
    ).map((card) => card.id);

    const [days, frozenDays] = await Promise.all([
      cardIds.length === 0
        ? Promise.resolve<string[]>([])
        : this.loadDays(cardIds),
      this.streakFreeze.loadFrozenDays(userId),
    ]);

    return dailyStreakFromUtcDays(days, DateTime.now(), frozenDays);
  }

  private async loadDays(cardIds: string[]): Promise<string[]> {
    const placeholders = cardIds.map(() => '?').join(', ');
    const rows = await this.em.getConnection().execute<{ day: string }[]>(
      `SELECT DISTINCT to_char((reviewed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day
         FROM review_logs
        WHERE card_id IN (${placeholders})`,
      cardIds,
      'all',
      this.em.getTransactionContext(),
    );
    return rows.map((row) => row.day);
  }
}
