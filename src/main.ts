import './core/observability/web.js';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
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
import { buildOpenApiDocument } from './entrypoints/web/build-openapi-document.js';
import { configureApp } from './entrypoints/web/configure-app.js';
import AuthConfig from './modules/auth/config/auth.config.js';

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
  auth: app.get<ConfigType<typeof AuthConfig>>(AuthConfig.KEY),
};

app.enableShutdownHooks();
app.useLogger(app.get(Logger));

configureApp(app);

if (!isProdEnvironment()) {
  const openApiDoc = await buildOpenApiDocument(
    app,
    config.swagger,
    config.auth,
  );

  SwaggerModule.setup(config.swagger.path, app, openApiDoc);
}

// `origin: undefined` + `credentials: true` makes @fastify/cors reflect any
// Origin — unacceptable on a cookie-authed API. Require an explicit public URL
// in production; in dev, fall back to reflecting localhost only.
if (isProdEnvironment() && !config.app.publicUrl) {
  throw new Error('PUBLIC_URL must be set in production (CORS allowed origin)');
}
await app.register(cors, {
  origin: config.app.publicUrl ?? /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  credentials: true,
});
await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cookie);
await app.listen(config.app.port, config.app.host);
