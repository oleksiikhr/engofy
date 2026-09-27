import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { LearningModule } from '../../learning.module.js';
import { GetStreakFreezeStatusQuery } from './get-streak-freeze-status.query.js';

describe('GetStreakFreezeStatusHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('is 0/not applicable for a free user with no cards', async () => {
    const user = await suite.factories.user.createOne();

    const status = await suite.query(new GetStreakFreezeStatusQuery(user.id));

    expect(status).toEqual({
      balance: 0,
      coveredDate: null,
      applicable: false,
    });
  });
});
