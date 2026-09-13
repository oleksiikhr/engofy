import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { LearningCard } from '../../entities/learning-card.entity.js';
import { LearningCardState } from '../../enums/learning-card-state.enum.js';
import { LearningModule } from '../../learning.module.js';
import { GetDueCardCountQuery } from './get-due-card-count.query.js';

describe('GetDueCardCountHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('counts only the cards due now or in the past, scoped to the user', async () => {
    const userId = uuidv7();
    const otherUserId = uuidv7();
    const em = suite.orm.em;

    em.create(LearningCard, {
      userId,
      wordId: uuidv7(),
      due: DateTime.now().minus({ days: 1 }),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: LearningCardState.Review,
    });
    em.create(LearningCard, {
      userId,
      phraseId: uuidv7(),
      due: DateTime.now().plus({ days: 3 }),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: LearningCardState.Learning,
    });
    em.create(LearningCard, {
      userId: otherUserId,
      wordId: uuidv7(),
      due: DateTime.now().minus({ days: 1 }),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: LearningCardState.Review,
    });
    await em.flush();

    expect(await suite.query(new GetDueCardCountQuery(userId))).toBe(1);
    expect(await suite.query(new GetDueCardCountQuery(uuidv7()))).toBe(0);
  });

  it('excludes archived cards', async () => {
    const userId = uuidv7();
    suite.orm.em.create(LearningCard, {
      userId,
      wordId: uuidv7(),
      due: DateTime.now().minus({ days: 1 }),
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

    expect(await suite.query(new GetDueCardCountQuery(userId))).toBe(0);
  });
});
