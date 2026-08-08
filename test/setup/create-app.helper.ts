import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { type ModuleMetadata } from '@nestjs/common';
import {
  Test,
  type TestingModule,
  TestingModuleBuilder,
} from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';

export type TestingBuilderHook = (
  ref: TestingModuleBuilder,
) => TestingModuleBuilder;

export interface IntegrationApp {
  moduleRef: TestingModule;
  orm: MikroORM<PostgreSqlDriver>;
}

export async function createIntegrationApp(
  metadata: ModuleMetadata = {},
  config: { builderHook?: TestingBuilderHook } = {},
): Promise<IntegrationApp> {
  const { imports = [], ...restMetadata } = metadata;

  let moduleBuilder = Test.createTestingModule({
    ...restMetadata,
    imports: [AppModule.common('cli'), ...imports],
  });

  if (config.builderHook) {
    moduleBuilder = config.builderHook(moduleBuilder);
  }

  const moduleRef = await moduleBuilder.compile();
  moduleRef.useLogger(false);

  const orm = moduleRef.get<MikroORM<PostgreSqlDriver>>(MikroORM);

  await moduleRef.init();

  return { moduleRef, orm };
}
