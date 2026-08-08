import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ensureMigrated } from './migration-guard.helper.js';

export function useOrmSuiteLifecycle(
  getOrm: () => MikroORM<PostgreSqlDriver>,
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
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
}
