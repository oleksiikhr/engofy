import type { MikroORM } from '@mikro-orm/core';
import type { PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { ModuleMetadata } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { TestingModuleBuilder } from '@nestjs/testing';
import request, { type Test } from 'supertest';
import { useOrmSuiteLifecycle } from '../../../setup/orm-suite-lifecycle.helper.js';
import { createWebApp, type WebApp } from './create-app.helper.js';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RequestOptions {
  authed?: boolean;
}

export interface WebE2ESuite extends WebApp {
  request(method: HttpMethod, path: string, options?: RequestOptions): Test;
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

  useOrmSuiteLifecycle(() => orm);

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
    request(method: HttpMethod, path: string, options?: RequestOptions) {
      const server = request(app.getHttpServer());
      // `configureApp` mounts every route under the `/api` global prefix
      // (except `_healthz`); tests still pass bare paths.
      const url = path.startsWith('/_healthz') ? path : `/api${path}`;
      const req = server[method](url);

      if (options?.authed ?? true) {
        // req.set('Authorization', `Bearer ${TEST_TOKEN}`);
      }

      return req;
    },
  };
}
