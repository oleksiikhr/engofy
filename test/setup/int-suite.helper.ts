import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { ModuleMetadata } from '@nestjs/common';
import { Command, CommandBus, Query, QueryBus } from '@nestjs/cqrs';
import type { TestingModule } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../src/core/redis/redis.tokens.js';
import {
  createIntegrationApp,
  type IntegrationApp,
  type IntegrationAppConfig,
} from './create-app.helper.js';
import { useOrmSuiteLifecycle } from './orm-suite-lifecycle.helper.js';

export interface IntegrationSuite extends IntegrationApp {
  command<T>(command: Command<T>): Promise<T>;
  query<T>(query: Query<T>): Promise<T>;
}

export function createIntegrationSuite(
  metadata: ModuleMetadata = {},
  config: IntegrationAppConfig = {},
): IntegrationSuite {
  let moduleRef: TestingModule;
  let orm: MikroORM<PostgreSqlDriver>;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeAll(async () => {
    ({ moduleRef, orm } = await createIntegrationApp(metadata, config));
    commandBus = moduleRef.get(CommandBus);
    queryBus = moduleRef.get(QueryBus);
  });

  useOrmSuiteLifecycle(
    () => orm,
    () => moduleRef.get<Redis>(REDIS_CLIENT, { strict: false }),
  );

  afterAll(async () => {
    await moduleRef?.close();
  });

  return {
    get moduleRef() {
      return moduleRef;
    },
    get orm() {
      return orm;
    },
    async command<T>(command: Command<T>): Promise<T> {
      const result = await commandBus.execute(command);

      await orm.em.flush();
      orm.em.clear();

      return result;
    },
    async query<T>(query: Query<T>): Promise<T> {
      const result = await queryBus.execute(query);

      orm.em.clear();

      return result;
    },
  };
}
