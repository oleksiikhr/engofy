import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { AccountDeletionRequest } from '../../entities/account-deletion-request.entity.js';
import { AccountDeletionRequestNotFoundError } from '../../errors/account-deletion-request-not-found.error.js';
import { CancelAccountDeletionCommand } from './cancel-account-deletion.command.js';

describe('CancelAccountDeletionHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('marks the pending request as cancelled', async () => {
    const userId = randomUUID();
    suite.orm.em.create(AccountDeletionRequest, {
      userId,
      cancelTokenHash: randomUUID(),
    });
    await suite.orm.em.flush();

    await suite.command(new CancelAccountDeletionCommand(userId));

    const request = await suite.orm.em.findOneOrFail(AccountDeletionRequest, {
      userId,
    });
    expect(request.cancelledAt).not.toBeNull();
  });

  it('throws when nothing is pending', async () => {
    await expect(
      suite.command(new CancelAccountDeletionCommand(randomUUID())),
    ).rejects.toThrow(AccountDeletionRequestNotFoundError);
  });
});
