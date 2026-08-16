import type { LoggerNamespace } from '@mikro-orm/core';
import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy';
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig } from '@mikro-orm/postgresql';
import { Environment, getEnvironment } from '../enums/environment.enum.js';
import { envNumber } from '../helpers/env.helper.js';

const env = getEnvironment();
let debug: boolean | LoggerNamespace[];

if (env === Environment.Production) {
  debug = ['query', 'schema', 'discovery', 'info', 'deprecated'];
} else {
  debug = false;
}

export default defineConfig({
  preferEnvVars: true,
  dbName: 'engofy',
  user: 'engofy',
  password: 'engofy',
  port: 5432,
  host: '127.0.0.1',
  baseDir: import.meta.dirname,
  entities: ['../../**/*.entity.js'],
  entitiesTs: ['../../**/*.entity.ts'],
  extensions: [Migrator],
  // Needed for ESM environments. MikroORM normally relies on `require`,
  // but in ESM we must use dynamic `import()` for loading entities, migrations, etc.
  dynamicImportProvider: (id) => import(id),
  metadataProvider: ReflectMetadataProvider,
  debug,
  migrations: {
    pathTs: './migrations',
    path: './migrations',
    snapshot: env !== Environment.Testing,
  },
  allowGlobalContext: env === Environment.Testing,
  implicitTransactions: env !== Environment.Testing,
  pool: {
    max: envNumber('DB_POOL_MAX', 10),
    idleTimeoutMillis: envNumber('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
  },
  /** @see https://node-postgres.com/apis/client */
  driverOptions: {
    statement_timeout: envNumber('DB_STATEMENT_TIMEOUT_MS', 30_000),
    query_timeout: envNumber('DB_QUERY_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: envNumber('DB_CONNECTION_TIMEOUT_MS', 10_000),
  },
});
