import * as Sentry from '@sentry/nestjs';
import { APP_TAG, type AppRuntime } from '../app.js';
import { Environment, getEnvironment } from '../enums/environment.enum.js';
import { envBool, envNumber, envString } from '../helpers/env.helper.js';
import { sanitizeSqlParams } from '../helpers/sql.helper.js';

export function bootstrapSentry(runtime: AppRuntime): void {
  const env = getEnvironment();
  const key = runtime.toUpperCase();

  Sentry.init({
    dsn: envString('SENTRY_DSN'),
    release: envString('SENTRY_RELEASE', APP_TAG),
    environment: env,
    initialScope: { tags: { entrypoint: runtime } },
    debug: envBool('SENTRY_DEBUG'),
    spotlight: env !== Environment.Production,
    enableLogs: true,
    tracesSampleRate: envNumber(`SENTRY_TRACES_SAMPLE_RATE_${key}`, 1),
    sampleRate: envNumber(`SENTRY_SAMPLE_RATE_${key}`, 1),
    integrations: [Sentry.extraErrorDataIntegration()],
    ignoreSpans: [
      { op: 'middleware.nestjs' },
      { op: 'guard.nestjs' },
      { op: 'pipe.nestjs' },
      { op: 'interceptor.nestjs' },
      { op: 'hook.fastify' },
      { op: 'request_handler.fastify' },
    ],
    ignoreTransactions: ['/_healthz', '/_metrics', '/_swagger', '/_queues'],
    beforeSendTransaction(event) {
      if (env !== Environment.Production) {
        return event;
      }

      // MikroORM embeds all parameters inline — sanitize before sending to Sentry
      for (const span of event.spans ?? []) {
        const stmt = span.data?.['db.statement'];
        if (typeof stmt === 'string') {
          span.data['db.statement'] = sanitizeSqlParams(stmt);

          if (typeof span.description === 'string') {
            span.description = sanitizeSqlParams(span.description);
          }
        }
      }

      return event;
    },
  });
}

export async function shutdownSentry(): Promise<void> {
  await Sentry.close(5000);
}
