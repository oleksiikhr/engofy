import './core/observability/web.js';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HttpAdapterHost, NestFactory, Reflector } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import AppConfig from './core/config/app.config.js';
import SwaggerConfig from './core/config/swagger.config.js';
import { isProdEnvironment } from './core/enums/environment.enum.js';
import { envString } from './core/helpers/env.helper.js';
import { parseTrustProxy } from './core/helpers/trust-proxy.helper.js';
import { AuthorizationErrorFilter } from './core/http/filters/authorization-error.filter.js';
import { DomainErrorFilter } from './core/http/filters/domain-error.filter.js';
import { ErrorFilter } from './core/http/filters/error.filter.js';
import { HealthCheckErrorFilter } from './core/http/filters/health-check-error.filter.js';
import { HttpErrorFilter } from './core/http/filters/http-error.filter.js';
import { EmptyStringToNullPipe } from './core/pipes/empty-string-to-null.pipe.js';
import { validationExceptionFactory } from './core/validation/validation-exception.factory.js';
import { buildOpenApiDocument } from './entrypoints/web/build-openapi-document.js';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule.web(),
  new FastifyAdapter({
    trustProxy: parseTrustProxy(envString('TRUST_PROXY')),
  }),
  { bufferLogs: true },
);

const config = {
  app: app.get<ConfigType<typeof AppConfig>>(AppConfig.KEY),
  swagger: app.get<ConfigType<typeof SwaggerConfig>>(SwaggerConfig.KEY),
};

if (!isProdEnvironment()) {
  const openApiDoc = await buildOpenApiDocument(app, config.swagger);

  SwaggerModule.setup(config.swagger.path, app, openApiDoc);
}

const reflector = app.get(Reflector);
const logger = app.get(Logger);

app.enableShutdownHooks();
app.useLogger(logger);
app.useGlobalPipes(
  new EmptyStringToNullPipe(reflector),
  new ValidationPipe({
    exceptionFactory: validationExceptionFactory,
    stopAtFirstError: true,
    transform: true,
    whitelist: true,
    forbidUnknownValues: true,
  }),
);
app.useGlobalFilters(
  new ErrorFilter(app.get(HttpAdapterHost)),
  new HttpErrorFilter(),
  new DomainErrorFilter(),
  new AuthorizationErrorFilter(),
  new HealthCheckErrorFilter(),
);

await app.register(cors, { origin: config.app.publicUrl });
await app.register(helmet, { contentSecurityPolicy: false });
await app.listen(config.app.port, config.app.host);
