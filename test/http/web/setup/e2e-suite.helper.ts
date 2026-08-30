import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { ModuleMetadata } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { TestingModuleBuilder } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import request, { type Test } from 'supertest';
import { REDIS_CLIENT } from '../../../../src/core/redis/redis.tokens.js';
import { useOrmSuiteLifecycle } from '../../../setup/orm-suite-lifecycle.helper.js';
import { createWebApp, type WebApp } from './create-app.helper.js';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface WebE2ESuite extends WebApp {
  request(method: HttpMethod, path: string): Test;
}

export type TestingBuilderHook = (
  ref: TestingModuleBuilder,
) => TestingModuleBuilder;

export function createWebE2ESuite(
  metadata: ModuleMetadata = {},
  config: { builderHook?: TestingBuilderHook } = {},
): WebE2ESuite {
  let app: NestFastifyApplication;
  let orm: MikroORM<PostgreSqlDriver>;

  beforeAll(async () => {
    ({ app, orm } = await createWebApp(metadata, config));
  });

  useOrmSuiteLifecycle(
    () => orm,
    () => app.get<Redis>(REDIS_CLIENT),
  );

  afterAll(async () => {
    await app?.close();
  });

  return {
    get app() {
      return app;
    },
    get orm() {
      return orm;
    },
    request(method: HttpMethod, path: string) {
      const server = request(app.getHttpServer());
      // `configureApp` mounts every route under the `/api` global prefix
      // (except `_healthz`); tests still pass bare paths.
      const url = path.startsWith('/_healthz') ? path : `/api${path}`;
      return server[method](url);
    },
  };
}
