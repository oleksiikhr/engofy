import './core/observability/cli.js';

import type { INestApplicationContext } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { CommandFactory } from 'nest-commander';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { envBool } from './core/helpers/env.helper.js';
import { shutdownSentry } from './core/observability/sentry.js';

function reportError(err: unknown, logger?: Logger) {
  logger
    ? logger.error({ cause: err }, 'CLI command failed')
    : console.error('CLI command failed', err);

  Sentry.captureException(err);

  Sentry.getActiveSpan()?.setStatus({
    code: 2, // error
  });

  process.exitCode = 1;
}

try {
  await Sentry.startSpan(
    {
      name: process.argv.slice(2, 4).join(' ') || 'unknown',
      op: 'cli.command',
    },
    async () => {
      let logger: Logger | undefined;
      let app: INestApplicationContext | undefined;

      try {
        app = await CommandFactory.createWithoutRunning(
          AppModule.cli(process.argv[2]),
          {
            // Suppress Nest bootstrap noise so CLI output stays readable
            logger: envBool('APP_DEBUG') ? ['debug'] : false,
            serviceErrorHandler: (err) => {
              reportError(err, logger);
            },
          },
        );

        logger = app.get<Logger>(Logger);
        app.useLogger(logger);
        app.flushLogs();

        await CommandFactory.runApplication(app);
      } catch (err) {
        reportError(err, logger);
      } finally {
        await app?.close();
      }
    },
  );
} catch (err) {
  reportError(err);
} finally {
  await shutdownSentry();
}
