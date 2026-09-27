import { DateTime } from 'luxon';
import { factories } from '../../../../test/factories/factories.js';
import { makeWordDefinition } from '../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { LearningCardState } from '../enums/learning-card-state.enum.js';
import { ReviewRating } from '../enums/review-rating.enum.js';
import { StreakFreezeBalanceExhaustedError } from '../errors/streak-freeze-balance-exhausted.error.js';
import { StreakGapNotCoverableError } from '../errors/streak-gap-not-coverable.error.js';
import { LearningModule } from '../learning.module.js';
import { StreakFreezeService } from './streak-freeze.service.js';

const NOW = DateTime.now().toUTC();

describe('StreakFreezeService', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  let service: StreakFreezeService;

  beforeAll(() => {
    service = suite.moduleRef.get(StreakFreezeService, { strict: false });
  });

  // Logs a review on `daysAgo` days before `NOW`, so the user has a
  // reviewed UTC day at that offset.
  async function reviewOn(userId: string, daysAgo: number): Promise<void> {
    const em = suite.orm.em;
    const card = factories(em).learningCard.makeOne({
      userId,
      wordDefinitionId: makeWordDefinition(factories(em)).id,
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Learning,
    });
    factories(em).reviewLog.makeOne({
      cardId: card.id,
      rating: ReviewRating.Good,
      reviewedAt: NOW.minus({ days: daysAgo }),
      elapsedDays: 0,
      scheduledDays: 1,
    });
    await em.flush();
  }

  describe('status', () => {
    it('is 0/not applicable for a free user, even with a coverable gap', async () => {
      const user = await suite.factories.user.createOne();
      await reviewOn(user.id, 2);

      const status = await service.status(user.id, NOW);

      expect(status).toEqual({
        balance: 0,
        coveredDate: null,
        applicable: false,
      });
    });

    it('reports the full allotment and a coverable gap for a premium user', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      await reviewOn(user.id, 2);
      await suite.orm.em.flush();

      const status = await service.status(user.id, NOW);

      expect(status.balance).toBe(2);
      expect(status.coveredDate).toBe(NOW.minus({ days: 1 }).toISODate());
      expect(status.applicable).toBe(true);
    });

    it('is not applicable when the streak is unbroken (no gap)', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      await reviewOn(user.id, 0);
      await reviewOn(user.id, 1);

      const status = await service.status(user.id, NOW);

      expect(status.coveredDate).toBeNull();
      expect(status.applicable).toBe(false);
    });

    it('is not applicable when the gap is two days wide', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      await reviewOn(user.id, 3);

      const status = await service.status(user.id, NOW);

      expect(status.coveredDate).toBeNull();
      expect(status.applicable).toBe(false);
    });

    it('reflects a lower balance once freezes were already used this month', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      suite.factories.streakFreeze.makeOne({
        userId: user.id,
        coveredDate: NOW.minus({ days: 10 }).toISODate() as string,
      });
      await reviewOn(user.id, 2);
      await suite.orm.em.flush();

      const status = await service.status(user.id, NOW);

      expect(status.balance).toBe(1);
    });
  });

  describe('apply', () => {
    it('spends a freeze, extends the streak and decrements the balance', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      await reviewOn(user.id, 0);
      await reviewOn(user.id, 2);
      await suite.orm.em.flush();

      const result = await service.apply(user.id, NOW);
      await suite.orm.em.flush();

      expect(result.coveredDate).toBe(NOW.minus({ days: 1 }).toISODate());
      expect(result.balance).toBe(1);
      expect(result.streak).toBe(3);

      const secondStatus = await service.status(user.id, NOW);
      expect(secondStatus.balance).toBe(1);
      expect(secondStatus.applicable).toBe(false);
    });

    it('rejects when there is no coverable gap', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      await reviewOn(user.id, 0);
      await reviewOn(user.id, 1);
      await suite.orm.em.flush();

      await expect(service.apply(user.id, NOW)).rejects.toBeInstanceOf(
        StreakGapNotCoverableError,
      );
    });

    it('rejects once the monthly balance is exhausted', async () => {
      const user = await suite.factories.user.createOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      suite.factories.streakFreeze.makeOne({
        userId: user.id,
        coveredDate: NOW.minus({ days: 10 }).toISODate() as string,
      });
      suite.factories.streakFreeze.makeOne({
        userId: user.id,
        coveredDate: NOW.minus({ days: 15 }).toISODate() as string,
      });
      await reviewOn(user.id, 2);
      await suite.orm.em.flush();

      await expect(service.apply(user.id, NOW)).rejects.toBeInstanceOf(
        StreakFreezeBalanceExhaustedError,
      );
    });
  });
});
