import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { Word } from '../../../post/entities/word.entity.js';
import { ReviewLog } from '../../entities/review-log.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { ReviewRating } from '../../enums/review-rating.enum.js';
import { CardNotFoundError } from '../../errors/card-not-found.error.js';
import { LearningModule } from '../../learning.module.js';
import { AddCardCommand } from '../add-card/add-card.command.js';
import { ReviewCardCommand } from './review-card.command.js';

describe('ReviewCardHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  async function seedCard(userId: string): Promise<string> {
    const word = suite.orm.em.create(Word, { lemma: `w-${uuidv7()}` });
    await suite.orm.em.flush();
    const card = await suite.command(
      new AddCardCommand(userId, { wordId: word.id }),
    );
    return card.id;
  }

  it('reschedules the card and appends a review log', async () => {
    const userId = uuidv7();
    const cardId = await seedCard(userId);

    const card = await suite.command(
      new ReviewCardCommand(userId, cardId, ReviewRating.Good),
    );

    expect(card.reps).toBe(1);
    expect(card.state).not.toBe(LearningCardState.New);
    expect(card.lastReview).not.toBeNull();
    expect(card.due.toMillis()).toBeGreaterThan(DateTime.now().toMillis());

    const logs = await suite.orm.em.find(ReviewLog, { cardId });
    expect(logs).toHaveLength(1);
    expect(logs[0].rating).toBe(ReviewRating.Good);
  });

  it('will not review a card that belongs to another user', async () => {
    const cardId = await seedCard(uuidv7());

    await expect(
      suite.command(new ReviewCardCommand(uuidv7(), cardId, ReviewRating.Good)),
    ).rejects.toBeInstanceOf(CardNotFoundError);
  });

  it('rejects an unknown card id', async () => {
    await expect(
      suite.command(
        new ReviewCardCommand(uuidv7(), uuidv7(), ReviewRating.Again),
      ),
    ).rejects.toBeInstanceOf(CardNotFoundError);
  });
});
