import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { factories } from '../../../../../test/factories/factories.js';
import { makeWordDefinition } from '../../../../../test/helpers/reference-data.helper.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { ReviewRating } from '../../enums/review-rating.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetReviewsTodayQuery } from './get-reviews-today.query.js';

describe('GetReviewsTodayHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('returns 0 for a user with no cards', async () => {
    expect(await suite.query(new GetReviewsTodayQuery(uuidv7()))).toBe(0);
  });

  it('counts only reviews logged since the start of the UTC day', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    const em = suite.orm.em;

    const card = factories(em).learningCard.makeOne({
      userId,
      wordDefinitionId: makeWordDefinition(factories(em)).id,
      due: DateTime.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 2,
      lapses: 0,
      state: LearningCardState.Learning,
    });
    const log = (reviewedAt: DateTime) =>
      factories(em).reviewLog.makeOne({
        cardId: card.id,
        rating: ReviewRating.Good,
        reviewedAt,
        elapsedDays: 0,
        scheduledDays: 1,
      });
    log(DateTime.now());
    log(DateTime.now());
    log(DateTime.utc().startOf('day').minus({ hours: 1 }));
    await em.flush();

    expect(await suite.query(new GetReviewsTodayQuery(userId))).toBe(2);
  });
});
