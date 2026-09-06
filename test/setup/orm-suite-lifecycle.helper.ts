import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { Redis } from 'ioredis';
import { ensureMigrated } from './migration-guard.helper.js';

export function useOrmSuiteLifecycle(
  getOrm: () => MikroORM<PostgreSqlDriver>,
  getRedis?: () => Redis,
): void {
  beforeAll(async () => {
    await ensureMigrated(getOrm());
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    await getOrm().em.begin();
  });

  afterEach(async () => {
    await getOrm().em.rollback();
    getOrm().em.clear();

    // Postgres is isolated by the per-test transaction above; Redis is not, so
    // counters/keys would otherwise leak across tests and (within their TTL)
    // across re-runs (T6). The test env points every client at a dedicated
    // logical DB (`REDIS_DB`), so this only ever clears throwaway state.
    await getRedis?.().flushdb();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
}
