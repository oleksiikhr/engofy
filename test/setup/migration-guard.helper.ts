import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';

let isInitialized = false;

export async function ensureMigrated(
  orm: MikroORM<PostgreSqlDriver>,
): Promise<void> {
  if (isInitialized) {
    return;
  }

  await orm.migrator.up();
  isInitialized = true;
}
