import './core/observability/worker.js';

import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { shutdownSentry } from './core/observability/sentry.js';
import { closeOnce } from './entrypoints/close-once.helper.js';

let logger: Logger | undefined;
let app: INestApplicationContext | undefined;
let closeApp: () => Promise<void> = () => Promise.resolve();

const queues = process.argv[2] ? process.argv[2].split(',') : [];

try {
  app = await NestFactory.createApplicationContext(AppModule.worker(queues), {
    bufferLogs: true,
  });
  closeApp = closeOnce(app);

  logger = app.get<Logger>(Logger);
  app.useLogger(logger);
  app.flushLogs();

  logger.log(
    `Active queues: ${queues.length > 0 ? queues.join(', ') : 'all'}`,
    'WorkerModule',
  );

  await new Promise<void>((resolve, reject) => {
    process.once('SIGTERM', () => closeApp().then(resolve, reject));
    process.once('SIGINT', () => closeApp().then(resolve, reject));
  });
} catch (err) {
  logger
    ? logger.error({ err }, 'Worker crashed')
    : console.error('Worker crashed', err);
  Sentry.captureException(err);
  await closeApp();
  process.exitCode = 1;
} finally {
  await shutdownSentry();
}
