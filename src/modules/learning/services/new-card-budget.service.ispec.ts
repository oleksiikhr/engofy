import { DateTime } from 'luxon';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import {
  DAILY_NEW_CARD_LIMIT,
  MAX_DAILY_NEW_CARD_LIMIT_OVERRIDE,
} from '../domain/daily-new-card-limit.js';
import { LearningModule } from '../learning.module.js';
import { NewCardBudgetService } from './new-card-budget.service.js';

describe('NewCardBudgetService', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  let service: NewCardBudgetService;

  beforeAll(() => {
    service = suite.moduleRef.get(NewCardBudgetService, { strict: false });
  });

  describe('effectiveLimit', () => {
    it('ignores a stored override for a free user', async () => {
      const user = suite.factories.user.makeOne({
        dailyNewCardLimitOverride: 50,
      });
      await suite.orm.em.flush();

      await expect(service.effectiveLimit(user.id)).resolves.toBe(
        DAILY_NEW_CARD_LIMIT,
      );
    });

    it('falls back to the default for a premium user with no override', async () => {
      const user = suite.factories.user.makeOne();
      suite.factories.subscription.makeOne({ userId: user.id });
      await suite.orm.em.flush();

      await expect(service.effectiveLimit(user.id)).resolves.toBe(
        DAILY_NEW_CARD_LIMIT,
      );
    });

    it("applies a premium user's override", async () => {
      const user = suite.factories.user.makeOne({
        dailyNewCardLimitOverride: 40,
      });
      suite.factories.subscription.makeOne({ userId: user.id });
      await suite.orm.em.flush();

      await expect(service.effectiveLimit(user.id)).resolves.toBe(40);
    });

    it('clamps a premium override above the cap', async () => {
      const user = suite.factories.user.makeOne({
        dailyNewCardLimitOverride: 9999,
      });
      suite.factories.subscription.makeOne({ userId: user.id });
      await suite.orm.em.flush();

      await expect(service.effectiveLimit(user.id)).resolves.toBe(
        MAX_DAILY_NEW_CARD_LIMIT_OVERRIDE,
      );
    });

    it("ignores a lapsed premium user's leftover override", async () => {
      const user = suite.factories.user.makeOne({
        dailyNewCardLimitOverride: 40,
      });
      suite.factories.subscription.makeOne({
        userId: user.id,
        currentPeriodEnd: DateTime.now().minus({ days: 1 }),
      });
      await suite.orm.em.flush();

      await expect(service.effectiveLimit(user.id)).resolves.toBe(
        DAILY_NEW_CARD_LIMIT,
      );
    });
  });

  describe('remaining', () => {
    it("uses the user's effective limit when nothing was introduced yet", async () => {
      const user = suite.factories.user.makeOne({
        dailyNewCardLimitOverride: 40,
      });
      suite.factories.subscription.makeOne({ userId: user.id });
      await suite.orm.em.flush();

      await expect(service.remaining(user.id)).resolves.toBe(40);
    });
  });
});
