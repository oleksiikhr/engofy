import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { type ModuleMetadata } from '@nestjs/common';
import {
  Test,
  type TestingModule,
  TestingModuleBuilder,
} from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PG_BOSS } from '../../src/core/queue/queue.tokens.js';
import { createFakePgBoss } from '../fakes/pg-boss.fake.js';

export type TestingBuilderHook = (
  ref: TestingModuleBuilder,
) => TestingModuleBuilder;

export interface IntegrationAppConfig {
  builderHook?: TestingBuilderHook;
  // Boot a real pg-boss instead of the no-op stub. Only for specs that read
  // `pgboss.job` directly.
  realPgBoss?: boolean;
}

export interface IntegrationApp {
  moduleRef: TestingModule;
  orm: MikroORM<PostgreSqlDriver>;
}

export async function createIntegrationApp(
  metadata: ModuleMetadata = {},
  config: IntegrationAppConfig = {},
): Promise<IntegrationApp> {
  const { imports = [], ...restMetadata } = metadata;

  let moduleBuilder = Test.createTestingModule({
    ...restMetadata,
    imports: [AppModule.common('cli'), ...imports],
  });

  if (!config.realPgBoss) {
    moduleBuilder = moduleBuilder
      .overrideProvider(PG_BOSS)
      .useValue(createFakePgBoss());
  }

  if (config.builderHook) {
    moduleBuilder = config.builderHook(moduleBuilder);
  }

  const moduleRef = await moduleBuilder.compile();
  moduleRef.useLogger(false);

  const orm = moduleRef.get<MikroORM<PostgreSqlDriver>>(MikroORM);

  await moduleRef.init();

  return { moduleRef, orm };
}
