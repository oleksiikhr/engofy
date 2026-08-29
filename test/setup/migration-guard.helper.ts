import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';

let isInitialized = false;

export async function ensureMigrated(
  orm: MikroORM<PostgreSqlDriver>,
): Promise<void> {
  if (isInitialized) {
    return;
  }

  // orm.schema.drop() only drops tables mapped by *current* entity metadata —
  // a renamed/removed entity leaves its old table orphaned in the test DB,
  // which then collides with a later `create table` when migrations replay
  // from scratch. Dropping the whole schema is metadata-independent, so a
  // rename or deletion can never leave a stale table behind again.
  const connection = orm.em.getConnection();
  await connection.execute('drop schema if exists public cascade');
  await connection.execute('create schema public');

  await orm.migrator.up();
  isInitialized = true;
}
