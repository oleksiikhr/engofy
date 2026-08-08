import type { ConfigType } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import type { Params } from 'nestjs-pino';
import type { AppRuntime } from '../app.js';
import { Environment, getEnvironment } from '../enums/environment.enum.js';
import type LoggerConfig from './logger.config.js';

export function loggerFactory(
  config: ConfigType<typeof LoggerConfig>,
  runtime: AppRuntime,
): Params {
  const environment = getEnvironment();

  return {
    pinoHttp: {
      enabled: environment !== Environment.Testing,
      level: config.level,
      autoLogging: environment === Environment.Production,
      base: { runtime },
      transport:
        environment !== Environment.Production
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
      },
      customProps: (req) => {
        const span = Sentry.getActiveSpan();
        const traceContext = span
          ? {
              traceId: span.spanContext().traceId,
              spanId: span.spanContext().spanId,
            }
          : {};

        if (req.actor?.type === 'user') {
          return { userId: req.actor.id, ...traceContext };
        }

        return traceContext;
      },
    },
    exclude: ['_healthz', '_metrics', '_swagger', '_queues'],
  };
}
