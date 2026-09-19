import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { generateToken, hashSecret } from '../../crypto/token.helper.js';
import { AccountDeletionRequest } from '../../entities/account-deletion-request.entity.js';
import { AccountDeletionRequestNotFoundError } from '../../errors/account-deletion-request-not-found.error.js';
import { CancelAccountDeletionByTokenCommand } from './cancel-account-deletion-by-token.command.js';

describe('CancelAccountDeletionByTokenHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('cancels the request that owns the token', async () => {
    const userId = randomUUID();
    const token = generateToken();
    suite.orm.em.create(AccountDeletionRequest, {
      userId,
      cancelTokenHash: hashSecret(token),
    });
    await suite.orm.em.flush();

    await suite.command(new CancelAccountDeletionByTokenCommand({ token }));

    const request = await suite.orm.em.findOneOrFail(AccountDeletionRequest, {
      userId,
    });
    expect(request.cancelledAt).not.toBeNull();
  });

  it('throws for an unknown token', async () => {
    await expect(
      suite.command(
        new CancelAccountDeletionByTokenCommand({ token: generateToken() }),
      ),
    ).rejects.toThrow(AccountDeletionRequestNotFoundError);
  });

  it('throws when the request was already cancelled', async () => {
    const token = generateToken();
    const request = suite.orm.em.create(AccountDeletionRequest, {
      userId: randomUUID(),
      cancelTokenHash: hashSecret(token),
    });
    request.cancelledAt = request.requestedAt;
    await suite.orm.em.flush();

    await expect(
      suite.command(new CancelAccountDeletionByTokenCommand({ token })),
    ).rejects.toThrow(AccountDeletionRequestNotFoundError);
  });
});
