import cookie from '@fastify/cookie';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import type { ModuleMetadata } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { createZodValidationPipe } from 'nestjs-zod';
import { AppModule } from '../../../../src/app.module.js';
import { AuthorizationErrorFilter } from '../../../../src/core/http/filters/authorization-error.filter.js';
import { DomainErrorFilter } from '../../../../src/core/http/filters/domain-error.filter.js';
import { ErrorFilter } from '../../../../src/core/http/filters/error.filter.js';
import { HealthCheckErrorFilter } from '../../../../src/core/http/filters/health-check-error.filter.js';
import { HttpErrorFilter } from '../../../../src/core/http/filters/http-error.filter.js';
import { EmptyStringToNullPipe } from '../../../../src/core/pipes/empty-string-to-null.pipe.js';
import { zodValidationExceptionFactory } from '../../../../src/core/validation/zod-validation-exception.factory.js';
import { WebModule } from '../../../../src/entrypoints/web/web.module.js';
import type { TestingBuilderHook } from '../../../setup/create-app.helper.js';

const ZodValidationPipe = createZodValidationPipe({
  createValidationException: zodValidationExceptionFactory,
});

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

  const reflector = app.get(Reflector);

  app.enableShutdownHooks();
  app.useLogger(false);

  app.useGlobalPipes(
    new EmptyStringToNullPipe(reflector),
    new ZodValidationPipe(),
  );

  app.useGlobalFilters(
    new ErrorFilter(app.get(HttpAdapterHost)),
    new HttpErrorFilter(),
    new DomainErrorFilter(),
    new AuthorizationErrorFilter(),
    new HealthCheckErrorFilter(),
  );

  await app.register(cookie);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return { app, orm };
}
