import type { PgBoss } from 'pg-boss';

/**
 * No-op `PG_BOSS` stub for the integration suites. Every queue effect is
 * asserted through the `OutboxSenderService.send` spy (`useQueueSpy`), so the
 * suites never need a live pg-boss — booting one per file just adds a Postgres
 * connection, schema bootstrap and maintenance timers.
 *
 * Implemented as a Proxy so every method (`createQueue`, `send`, `work`,
 * `stop`, …) resolves to an async no-op without having to enumerate the API.
 * `then` is left undefined so Nest's async DI resolution does not mistake the
 * stub for a thenable and hang.
 *
 * `createIntegrationSuite` installs this by default; pass `{ realPgBoss: true }`
 * for the few specs that inspect `pgboss.job` directly.
 */
export function createFakePgBoss(): PgBoss {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then' || typeof prop === 'symbol') {
          return undefined;
        }
        return async () => undefined;
      },
    },
  ) as unknown as PgBoss;
}
