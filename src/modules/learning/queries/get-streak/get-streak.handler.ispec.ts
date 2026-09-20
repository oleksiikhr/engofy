import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { ReviewRating } from '../../enums/review-rating.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetStreakQuery } from './get-streak.query.js';

describe('GetStreakHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns 0 for a user with no cards', async () => {
    expect(await suite.query(new GetStreakQuery(uuidv7()))).toBe(0);
  });

  it('counts a review logged today as a 1-day streak', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    const em = suite.orm.em;

    const card = factories(em).learningCard.makeOne({
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
    });
    factories(em).reviewLog.makeOne({
      cardId: card.id,
      rating: ReviewRating.Good,
      reviewedAt: DateTime.now(),
      elapsedDays: 0,
      scheduledDays: 1,
    });
    await em.flush();

    expect(await suite.query(new GetStreakQuery(userId))).toBe(1);
  });
});
