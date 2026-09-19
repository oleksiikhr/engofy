import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DAILY_NEW_CARD_LIMIT } from '../domain/daily-new-card-limit.js';

@Injectable()
export class NewCardBudgetService {
  constructor(private readonly em: EntityManager) {}

  // How many New cards are still allowed into today's queue: the daily limit
  // minus however many of the user's cards already graduated from New today
  // — "graduated" means a card's *earliest* review (every card starts New,
  // so its first-ever grade is always the one that takes it out of New) falls
  // within today's UTC calendar day. A raw aggregate (DP5) since the ORM
  // can't express "first review per card" cheaply.
  async remaining(userId: string): Promise<number> {
    const startOfToday = DateTime.now().toUTC().startOf('day');
    const startOfTomorrow = startOfToday.plus({ days: 1 });
    const rows = await this.em.getConnection().execute<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM (
         SELECT rl.card_id, MIN(rl.reviewed_at) AS first_review
           FROM review_logs rl
           JOIN learning_cards lc ON lc.id = rl.card_id
          WHERE lc.user_id = ?
          GROUP BY rl.card_id
       ) first_reviews
       WHERE first_review >= ? AND first_review < ?`,
      [userId, startOfToday.toJSDate(), startOfTomorrow.toJSDate()],
      'all',
      this.em.getTransactionContext(),
    );
    const introducedToday = Number(rows[0]?.count ?? 0);
    return Math.max(0, DAILY_NEW_CARD_LIMIT - introducedToday);
  }
}
