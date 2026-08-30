import { randomUUID } from 'node:crypto';
import { RequestContext } from '@mikro-orm/core';
import { createIntegrationSuite } from '../../../test/setup/int-suite.helper.js';
import { OutboxSenderService } from './outbox-sender.service.js';
import { QueueName } from './queue-names.enum.js';

describe('OutboxSenderService', () => {
  // This suite reads `pgboss.job` back to prove `drain()` really enqueues on
  // the em's connection, so it needs a live pg-boss (not the default stub).
  const suite = createIntegrationSuite({}, { realPgBoss: true });

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

  // Regression: outside RequestContext, send()/drain() (and the WeakMap they
  // share) always saw the same root em, masking a real bug — the injected em
  // in application code is the root, request-context-agnostic instance,
  // while afterFlush hands drain() the forked em for the active request.
  // The fork opens its own real transaction (no shared context with this
  // test's outer one), so it commits for real — read it back on a fresh
  // connection (no ctx, unlike findByMarker) and clean up manually, since
  // this row isn't covered by afterEach's rollback of the outer transaction.
  it('drains a job staged from within a forked RequestContext em', async () => {
    const marker = randomUUID();

    await RequestContext.create(suite.orm.em, async () => {
      outbox.send(suite.orm.em, QueueName.AuthChallengeEmail, { marker });
      await suite.orm.em.flush();
    });

    try {
      const rows = await suite.orm.em
        .getConnection()
        .execute<{ id: string }[]>(
          `select id from pgboss.job where name = ? and data->>'marker' = ?`,
          [QueueName.AuthChallengeEmail, marker],
          'all',
        );

      expect(rows[0]).toBeTruthy();
    } finally {
      await suite.orm.em
        .getConnection()
        .execute(`delete from pgboss.job where data->>'marker' = ?`, [marker]);
    }
  });
});
