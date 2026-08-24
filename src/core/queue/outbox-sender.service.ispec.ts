import { randomUUID } from 'node:crypto';
import { createIntegrationSuite } from '../../../test/setup/int-suite.helper.js';
import { OutboxSenderService } from './outbox-sender.service.js';
import { QueueName } from './queue-names.enum.js';

describe('OutboxSenderService', () => {
  const suite = createIntegrationSuite();

  let outbox: OutboxSenderService;

  beforeAll(() => {
    outbox = suite.moduleRef.get(OutboxSenderService);
  });

  // pg-boss's own client runs on a separate connection pool, so it can never
  // see a write still sitting in the (per-test, rolled-back) em transaction —
  // read the job back through the same em connection instead.
  const findByMarker = async (marker: string) => {
    const rows = await suite.orm.em
      .getConnection()
      .execute<{ data: { marker: string } }[]>(
        `select data from pgboss.job where name = ? and data->>'marker' = ?`,
        [QueueName.AuthChallengeEmail, marker],
        'all',
        suite.orm.em.getTransactionContext(),
      );

    return rows[0];
  };

  it('does not send the job before the entity manager is flushed', async () => {
    const marker = randomUUID();

    outbox.send(suite.orm.em, QueueName.AuthChallengeEmail, { marker });

    expect(await findByMarker(marker)).toBeUndefined();

    await suite.orm.em.flush();
  });

  it('sends the staged job once the entity manager is flushed', async () => {
    const marker = randomUUID();

    outbox.send(suite.orm.em, QueueName.AuthChallengeEmail, { marker });
    await suite.orm.em.flush();

    expect(await findByMarker(marker)).toBeTruthy();
  });

  it('sends jobs staged from multiple send() calls on the same flush', async () => {
    const markerA = randomUUID();
    const markerB = randomUUID();

    outbox.send(suite.orm.em, QueueName.AuthChallengeEmail, {
      marker: markerA,
    });
    outbox.send(suite.orm.em, QueueName.AuthChallengeEmail, {
      marker: markerB,
    });
    await suite.orm.em.flush();

    expect(await findByMarker(markerA)).toBeTruthy();
    expect(await findByMarker(markerB)).toBeTruthy();
  });
});
