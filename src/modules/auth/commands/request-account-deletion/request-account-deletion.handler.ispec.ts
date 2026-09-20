import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { useQueueSpy } from '../../../../../test/setup/queue-spy.helper.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import type { SendAccountDeletionEmailJobData } from '../../../../entrypoints/worker/auth/send-account-deletion-email.processor.js';
import { AuthModule } from '../../auth.module.js';
import { hashSecret } from '../../crypto/token.helper.js';
import { AccountDeletionRequest } from '../../entities/account-deletion-request.entity.js';
import { RequestAccountDeletionCommand } from './request-account-deletion.command.js';

describe('RequestAccountDeletionHandler', () => {
  const suite = createIntegrationSuite({ imports: [AuthModule] });
  const queue = useQueueSpy(suite);

  const createUser = async () => {
    const user = suite.factories.user.makeOne({
      email: `user-${randomUUID()}@example.com`,
    });
    await suite.orm.em.flush();
    suite.orm.em.clear();
    return user;
  };

  it('stores a hashed cancel token, schedules deletion after the grace period and mails the token', async () => {
    const user = await createUser();

    const view = await suite.command(
      new RequestAccountDeletionCommand(user.id),
    );

    const request = await suite.orm.em.findOneOrFail(AccountDeletionRequest, {
      userId: user.id,
    });
    expect(request.cancelledAt).toBeNull();
    expect(view.scheduledFor.diff(view.requestedAt).as('days')).toBe(30);

    const job = queue.assertSent<SendAccountDeletionEmailJobData>(
      QueueName.AuthAccountDeletionEmail,
      (data) => data.email === user.email,
    );
    expect(hashSecret(job.cancelToken)).toBe(request.cancelTokenHash);
    expect(request.cancelTokenHash).not.toBe(job.cancelToken);
  });

  it('is idempotent while a request is pending', async () => {
    const user = await createUser();

    const first = await suite.command(
      new RequestAccountDeletionCommand(user.id),
    );
    const second = await suite.command(
      new RequestAccountDeletionCommand(user.id),
    );

    expect(second.requestedAt.toMillis()).toBe(first.requestedAt.toMillis());
    expect(
      await suite.orm.em.count(AccountDeletionRequest, { userId: user.id }),
    ).toBe(1);
  });

  it('opens a new request after the previous one was cancelled', async () => {
    const user = await createUser();
    await suite.command(new RequestAccountDeletionCommand(user.id));
    const first = await suite.orm.em.findOneOrFail(AccountDeletionRequest, {
      userId: user.id,
    });
    first.cancelledAt = first.requestedAt;
    await suite.orm.em.flush();
    suite.orm.em.clear();

    await suite.command(new RequestAccountDeletionCommand(user.id));

    expect(
      await suite.orm.em.count(AccountDeletionRequest, {
        userId: user.id,
        cancelledAt: null,
      }),
    ).toBe(1);
  });
});
