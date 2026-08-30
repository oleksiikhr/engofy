import './core/observability/cron.js';

import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { shutdownSentry } from './core/observability/sentry.js';
import { waitForCronTicksToDrain } from './entrypoints/cron/cron-job-host.js';

let logger: Logger | undefined;
let app: INestApplicationContext | undefined;

try {
  app = await NestFactory.createApplicationContext(AppModule.cron(), {
    bufferLogs: true,
  });

  logger = app.get<Logger>(Logger);
  app.useLogger(logger);
  app.flushLogs();

  await new Promise<void>((resolve, reject) => {
    const shutdown = async () => {
      try {
        await waitForCronTicksToDrain();
      } finally {
        await app?.close();
      }
    };

    process.once('SIGTERM', () => shutdown().then(resolve, reject));
    process.once('SIGINT', () => shutdown().then(resolve, reject));
  });
} catch (err) {
  logger
    ? logger.error({ err }, 'Cron crashed')
    : console.error('Cron crashed', err);
  Sentry.captureException(err);
  await app?.close();
  process.exitCode = 1;
} finally {
  await shutdownSentry();
}
