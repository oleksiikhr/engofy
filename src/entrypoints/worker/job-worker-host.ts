import { MikroORM } from '@mikro-orm/core';
import { Inject, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { DateTime } from 'luxon';
import type { Job } from 'pg-boss';
import { withRequestContext } from '../../core/database/helpers/request-context.helper.js';
import type { SentryTraceFields } from '../../core/queue/sentry-trace.js';

type JobSpanAttributes = NonNullable<
  Parameters<typeof Sentry.startSpan>[0]['attributes']
>;

export abstract class JobWorkerHost<T = unknown> {
  protected readonly logger = new Logger(this.constructor.name);

  @Inject(MikroORM)
  protected readonly orm!: MikroORM;

  async work(jobs: Job<T & SentryTraceFields>[]): Promise<void> {
    await Promise.all(jobs.map((job) => this.handleOne(job)));
  }

  private async handleOne(job: Job<T & SentryTraceFields>): Promise<void> {
    const startedAt = DateTime.now();
    const params = { jobId: job.id, queueName: job.name };

    this.logger.log(params, 'job started');

    return Sentry.continueTrace(
      { sentryTrace: job.data._sentryTrace, baggage: job.data._sentryBaggage },
      () =>
        Sentry.startSpan(
          {
            name: `${job.name} -> process`,
            op: 'queue.process',
            attributes: {
              'messaging.system': 'pg-boss',
              'messaging.destination': job.name,
              'messaging.message.id': job.id,
              ...this.spanAttributes(job),
            },
          },
          async () => {
            try {
              await withRequestContext(this.orm.em, () => this.processJob(job));

              this.logger.log(
                {
                  ...params,
                  duration_ms: DateTime.now().diff(startedAt).milliseconds,
                },
                'job completed',
              );
            } catch (err) {
              Sentry.captureException(err);

              this.logger.error(
                {
                  ...params,
                  duration_ms: DateTime.now().diff(startedAt).milliseconds,
                  err,
                },
                'job failed',
              );

              throw err;
            }
          },
        ),
    );
  }

  protected spanAttributes(_job: Job<T>): JobSpanAttributes {
    return {};
  }

  protected abstract processJob(job: Job<T>): Promise<void>;
}
