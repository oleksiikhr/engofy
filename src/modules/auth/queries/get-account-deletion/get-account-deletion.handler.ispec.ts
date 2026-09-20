import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { AuthModule } from '../../auth.module.js';
import { GetAccountDeletionQuery } from './get-account-deletion.query.js';

describe('GetAccountDeletionHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });

  it('returns null when there is no request', async () => {
    expect(
      await suite.query(new GetAccountDeletionQuery(randomUUID())),
    ).toBeNull();
  });

  it('returns the pending request with its scheduled deletion time', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    suite.factories.accountDeletionRequest.makeOne({
      userId,
      cancelTokenHash: randomUUID(),
    });
    await suite.orm.em.flush();

    const view = await suite.query(new GetAccountDeletionQuery(userId));

    expect(view?.scheduledFor.diff(view.requestedAt).as('days')).toBe(30);
  });

  it('ignores a cancelled request', async () => {
    const userId = (await suite.factories.user.createOne()).id;
    const request = suite.factories.accountDeletionRequest.makeOne({
      userId,
      cancelTokenHash: randomUUID(),
    });
    request.cancelledAt = request.requestedAt;
    await suite.orm.em.flush();

    expect(await suite.query(new GetAccountDeletionQuery(userId))).toBeNull();
  });
});
