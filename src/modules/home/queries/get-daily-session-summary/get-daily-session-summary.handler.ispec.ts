import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { LearningCard } from '../../../learning/entities/learning-card.entity.js';
import { ReviewLog } from '../../../learning/entities/review-log.entity.js';
import { ReviewRating } from '../../../learning/enums/review-rating.enum.js';
import { HomeModule } from '../../home.module.js';
import { GetDailySessionSummaryQuery } from './get-daily-session-summary.query.js';

function seedCard(
  em: EntityManager,
  userId: string,
  createdAt: DateTime,
): LearningCard {
  return em.create(LearningCard, {
    userId,
    grammarUsagePointId: uuidv7(),
    due: DateTime.now(),
    stability: 1,
    difficulty: 1,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    createdAt,
  });
}

function seedReviewLog(
  em: EntityManager,
  cardId: string,
  reviewedAt: DateTime,
): void {
  em.create(ReviewLog, {
    cardId,
    rating: ReviewRating.Good,
    reviewedAt,
    elapsedDays: 0,
    scheduledDays: 1,
  });
}

describe('GetDailySessionSummaryHandler', () => {
  const suite = createIntegrationSuite({ imports: [HomeModule] });

  it('returns zero counts for a user with no cards', async () => {
    const summary = await suite.query(
      new GetDailySessionSummaryQuery(uuidv7()),
    );
    expect(summary).toEqual({ newCardsToday: 0, reviewsToday: 0 });
  });

  it('counts only cards created today and reviews logged today', async () => {
    const userId = uuidv7();
    const today = DateTime.now();
    const yesterday = today.minus({ days: 1 });

    const cardToday = seedCard(suite.orm.em, userId, today);
    seedCard(suite.orm.em, userId, yesterday);
    await suite.orm.em.flush();

    seedReviewLog(suite.orm.em, cardToday.id, today);
    seedReviewLog(suite.orm.em, cardToday.id, yesterday);
    await suite.orm.em.flush();

    const summary = await suite.query(new GetDailySessionSummaryQuery(userId));

    expect(summary).toEqual({ newCardsToday: 1, reviewsToday: 1 });
  });

  it("never counts another user's cards or reviews", async () => {
    const userId = uuidv7();
    const otherUserId = uuidv7();
    const today = DateTime.now();

    const otherCard = seedCard(suite.orm.em, otherUserId, today);
    await suite.orm.em.flush();
    seedReviewLog(suite.orm.em, otherCard.id, today);
    await suite.orm.em.flush();

    const summary = await suite.query(new GetDailySessionSummaryQuery(userId));

    expect(summary).toEqual({ newCardsToday: 0, reviewsToday: 0 });
  });
});
