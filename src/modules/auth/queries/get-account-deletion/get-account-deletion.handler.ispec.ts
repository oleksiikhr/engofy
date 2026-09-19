import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { AccountDeletionRequest } from '../../entities/account-deletion-request.entity.js';
import { GetAccountDeletionQuery } from './get-account-deletion.query.js';

describe('GetAccountDeletionHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('returns null when there is no request', async () => {
    expect(
      await suite.query(new GetAccountDeletionQuery(randomUUID())),
    ).toBeNull();
  });

  it('returns the pending request with its scheduled deletion time', async () => {
    const userId = randomUUID();
    suite.orm.em.create(AccountDeletionRequest, {
      userId,
      cancelTokenHash: randomUUID(),
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetAccountDeletionQuery(userId));

    expect(view?.scheduledFor.diff(view.requestedAt).as('days')).toBe(30);
  });

  it('ignores a cancelled request', async () => {
    const userId = randomUUID();
    const request = suite.orm.em.create(AccountDeletionRequest, {
      userId,
      cancelTokenHash: randomUUID(),
    });
    request.cancelledAt = request.requestedAt;
    await suite.orm.em.flush();

    expect(await suite.query(new GetAccountDeletionQuery(userId))).toBeNull();
  });
});
