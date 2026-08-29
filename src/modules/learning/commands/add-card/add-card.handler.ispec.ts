import type { EntityManager } from '@mikro-orm/postgresql';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { Subscription } from '../../../auth/entities/subscription.entity.js';
import { SubscriptionPlan } from '../../../auth/enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../../../auth/enums/subscription-status.enum.js';
import { Word } from '../../../post/entities/word.entity.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { CardLimitReachedError } from '../../errors/card-limit-reached.error.js';
import { InvalidCardTargetError } from '../../errors/invalid-card-target.error.js';
import { LearningModule } from '../../learning.module.js';
import { FREE_CARD_LIMIT } from '../../services/card-limit.service.js';
import { AddCardCommand } from './add-card.command.js';

function fillLearningCards(
  em: EntityManager,
  userId: string,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    em.create(LearningCard, {
      userId,
      wordId: uuidv7(),
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

describe('AddCardHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  async function seedWord(lemma: string): Promise<string> {
    const word = suite.orm.em.create(Word, { lemma });
    await suite.orm.em.flush();
    return word.id;
  }

  it('creates a fresh New card for a word target', async () => {
    const userId = uuidv7();
    const wordId = await seedWord(`w-${uuidv7()}`);

    const card = await suite.command(new AddCardCommand(userId, { wordId }));

    expect(card.state).toBe(LearningCardState.New);
    expect(card.wordId).toBe(wordId);
    expect(card.phraseId).toBeNull();
    expect(card.reps).toBe(0);
  });

  it('is idempotent — re-adding the same target returns the existing card', async () => {
    const userId = uuidv7();
    const wordId = await seedWord(`w-${uuidv7()}`);

    const first = await suite.command(new AddCardCommand(userId, { wordId }));
    const second = await suite.command(new AddCardCommand(userId, { wordId }));

    expect(second.id).toBe(first.id);
    expect(await suite.orm.em.count(LearningCard, { userId })).toBe(1);
  });

  it('rejects a target id that does not exist', async () => {
    await expect(
      suite.command(new AddCardCommand(uuidv7(), { wordId: uuidv7() })),
    ).rejects.toBeInstanceOf(InvalidCardTargetError);
  });

  it('blocks a free user at the card cap', async () => {
    const userId = uuidv7();
    fillLearningCards(suite.orm.em, userId, FREE_CARD_LIMIT);
    await suite.orm.em.flush();
    const wordId = await seedWord(`w-${uuidv7()}`);

    await expect(
      suite.command(new AddCardCommand(userId, { wordId })),
    ).rejects.toBeInstanceOf(CardLimitReachedError);
  });

  it('lets a premium user past the cap', async () => {
    const userId = uuidv7();
    fillLearningCards(suite.orm.em, userId, FREE_CARD_LIMIT);
    suite.orm.em.create(Subscription, {
      userId,
      plan: SubscriptionPlan.Premium,
      status: SubscriptionStatus.Active,
      currentPeriodEnd: DateTime.now().plus({ months: 1 }),
      isMockPayment: true,
    });
    await suite.orm.em.flush();
    const wordId = await seedWord(`w-${uuidv7()}`);

    const card = await suite.command(new AddCardCommand(userId, { wordId }));
    expect(card.wordId).toBe(wordId);
  });
});
