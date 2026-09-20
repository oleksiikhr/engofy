import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../test/setup/int-suite.helper.js';
import { SubscriptionPlan } from '../../billing/enums/subscription-plan.enum.js';
import { LearningCardState } from '../enums/learning-card-state.enum.js';
import { CardLimitReachedError } from '../errors/card-limit-reached.error.js';
import { LearningModule } from '../learning.module.js';
import { CardLimitService, FREE_CARD_LIMIT } from './card-limit.service.js';

describe('CardLimitService', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  let service: CardLimitService;

  beforeAll(() => {
    service = suite.moduleRef.get(CardLimitService, { strict: false });
  });

  function fillCards(em: EntityManager, userId: string, count: number): void {
    for (let i = 0; i < count; i += 1) {
      factories(em).learningCard.makeOne({
        userId,
        wordDefinitionId: uuidv7(),
        due: DateTime.now(),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        state: LearningCardState.New,
      });
    }
  }

  it('allows a free user below the cap', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    fillCards(suite.orm.em, userId, FREE_CARD_LIMIT - 1);
    await suite.orm.em.flush();

    await expect(service.assertCanAddCard(userId)).resolves.toBeUndefined();
  });

  it('rejects a free user at the cap', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    fillCards(suite.orm.em, userId, FREE_CARD_LIMIT);
    await suite.orm.em.flush();

    await expect(service.assertCanAddCard(userId)).rejects.toBeInstanceOf(
      CardLimitReachedError,
    );
  });

  it('does not count archived cards against the cap', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    fillCards(suite.orm.em, userId, FREE_CARD_LIMIT - 1);
    suite.factories.learningCard.makeOne({
      userId,
      wordDefinitionId: uuidv7(),
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 1,
      lapses: 0,
      state: LearningCardState.Learning,
      archivedAt: DateTime.now(),
    });
    await suite.orm.em.flush();

    await expect(service.assertCanAddCard(userId)).resolves.toBeUndefined();
  });

  it('lets a premium user past the cap', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    fillCards(suite.orm.em, userId, FREE_CARD_LIMIT + 5);
    suite.factories.subscription.makeOne({
      userId,
      plan: SubscriptionPlan.Premium,
      currentPeriodEnd: DateTime.now().plus({ days: 30 }),
    });
    await suite.orm.em.flush();

    await expect(service.assertCanAddCard(userId)).resolves.toBeUndefined();
  });

  describe('getUsage', () => {
    it('reports the used count against the free cap, ignoring archived cards', async () => {
      const userId = (await suite.factories.user.createOne()).id;
      fillCards(suite.orm.em, userId, 3);
      suite.factories.learningCard.makeOne({
        userId,
        wordDefinitionId: uuidv7(),
        due: DateTime.now(),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 1,
        lapses: 0,
        state: LearningCardState.Learning,
        archivedAt: DateTime.now(),
      });
      await suite.orm.em.flush();

      await expect(service.getUsage(userId)).resolves.toEqual({
        used: 3,
        limit: FREE_CARD_LIMIT,
      });
    });

    it('reports no limit for a premium user', async () => {
      const userId = (await suite.factories.user.createOne()).id;
      fillCards(suite.orm.em, userId, 2);
      suite.factories.subscription.makeOne({
        userId,
        plan: SubscriptionPlan.Premium,
        currentPeriodEnd: DateTime.now().plus({ days: 30 }),
      });
      await suite.orm.em.flush();

      await expect(service.getUsage(userId)).resolves.toEqual({
        used: 2,
        limit: null,
      });
    });
  });
});
