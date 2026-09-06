import cookie from '@fastify/cookie';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { ModuleMetadata } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../../../../src/app.module.js';
import { configureApp } from '../../../../src/entrypoints/web/configure-app.js';
import { WebModule } from '../../../../src/entrypoints/web/web.module.js';
import type { TestingBuilderHook } from '../../../setup/create-app.helper.js';

export interface WebApp {
  app: NestFastifyApplication;
  orm: MikroORM<PostgreSqlDriver>;
}

export async function createWebApp(
  metadata: ModuleMetadata = {},
  config: { builderHook?: TestingBuilderHook } = {},
): Promise<WebApp> {
  const { imports = [] } = metadata;
  const common = AppModule.common('web');

  let moduleBuilder = Test.createTestingModule({
    imports: [
      {
        ...common,
        imports: [
          ...common.imports,
          WebModule.forRoot(imports.length > 0 ? imports : undefined),
        ],
      },
    ],
  });

  if (config.builderHook) {
    moduleBuilder = config.builderHook(moduleBuilder);
  }

  const moduleRef = await moduleBuilder.compile();
  moduleRef.useLogger(moduleRef.get(Logger));

  const orm = moduleRef.get<MikroORM<PostgreSqlDriver>>(MikroORM);

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  app.enableShutdownHooks();
  app.useLogger(false);

  configureApp(app);

  await app.register(cookie);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, orm };
}
