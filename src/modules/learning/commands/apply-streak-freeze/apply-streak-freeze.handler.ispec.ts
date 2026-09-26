import { v7 as uuidv7 } from 'uuid';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { StreakGapNotCoverableError } from '../../errors/streak-gap-not-coverable.error.js';
import { LearningModule } from '../../learning.module.js';
import { ApplyStreakFreezeCommand } from './apply-streak-freeze.command.js';

describe('ApplyStreakFreezeHandler', () => {
  const suite = createIntegrationSuite({ imports: [LearningModule] });

  it('rejects a user with no coverable gap (e.g. a free user, or a fresh account)', async () => {
    await expect(
      suite.command(new ApplyStreakFreezeCommand(uuidv7())),
    ).rejects.toBeInstanceOf(StreakGapNotCoverableError);
  });
});
