import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Inject, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { DateTime } from 'luxon';
import type { Job, JobWithMetadata } from 'pg-boss';
import { withRequestContext } from '../../core/database/helpers/request-context.helper.js';
import type { SentryTraceFields } from '../../core/queue/sentry-trace.js';
import { Post } from '../../modules/post/entities/post.entity.js';
import { PostPipelineRun } from '../../modules/post/entities/post-pipeline-run.entity.js';
import { PostPipelineRunStatus } from '../../modules/post/enums/post-pipeline-run-status.enum.js';
import type { PostPipelineStage } from '../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostStatus } from '../../modules/post/enums/post-status.enum.js';

type JobSpanAttributes = NonNullable<
  Parameters<typeof Sentry.startSpan>[0]['attributes']
>;

// A processor that runs one content-pipeline stage returns this from
// `pipelineStage()` so `JobWorkerHost` can maintain the `post_pipeline_runs`
// row around the job (D4).
export interface PipelineStageRef {
  stage: PostPipelineStage;
  postId: string;
}

const MAX_ERROR_MESSAGE_LENGTH = 2000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export abstract class JobWorkerHost<T = unknown> {
  protected readonly logger = new Logger(this.constructor.name);

  @Inject(MikroORM)
  protected readonly orm!: MikroORM;

  async work(jobs: JobWithMetadata<T & SentryTraceFields>[]): Promise<void> {
    // Settle every job independently — one rejection must not abandon the
    // siblings' success bookkeeping. Re-throw afterwards so pg-boss still
    // retries the failed job(s). Safe as a batch today because `batchSize`
    // defaults to 1; a real batch would want pg-boss `perJobResults`.
    const results = await Promise.allSettled(
      jobs.map((job) => this.handleOne(job)),
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (failures.length === 1) {
      throw failures[0].reason;
    }
    if (failures.length > 1) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `${failures.length} jobs failed`,
      );
    }
  }

  private async handleOne(
    job: JobWithMetadata<T & SentryTraceFields>,
  ): Promise<void> {
    const startedAt = DateTime.now();
    const params = { jobId: job.id, queueName: job.name };
    const stageRef = this.pipelineStage(job);

    this.logger.log(params, 'job started');

    if (stageRef) {
      await this.recordStageStart(stageRef);
    }

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
              // Record the failure on its own transaction *before* rethrowing —
              // the job's own unit of work has rolled back, so this is the only
              // durable trace of the failed attempt (D4).
              if (stageRef) {
                await this.recordStageFailure(stageRef, job, err);
              }

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

  // Write the run row `Pending` + `startedAt` on stage entry. `Running` is a
  // derived state (`startedAt` set, `completedAt` null) — there is no enum
  // value for it.
  private async recordStageStart(ref: PipelineStageRef): Promise<void> {
    const em = this.orm.em.fork();
    const run = await this.loadOrCreateRun(em, ref);

    // A re-delivered job for an already-finished stage: leave the Completed row
    // untouched so the handler's idempotency check still short-circuits.
    if (run.status === PostPipelineRunStatus.Completed) {
      return;
    }

    run.status = PostPipelineRunStatus.Pending;
    run.startedAt = DateTime.now();
    run.completedAt = null;
    run.errorMessage = null;

    await em.flush();
  }

  private async recordStageFailure(
    ref: PipelineStageRef,
    job: JobWithMetadata<T>,
    err: unknown,
  ): Promise<void> {
    const em = this.orm.em.fork();
    const run = await this.loadOrCreateRun(em, ref);

    // Raced with a success (e.g. a sibling delivery finished first) — don't
    // clobber it.
    if (run.status === PostPipelineRunStatus.Completed) {
      return;
    }

    run.status = PostPipelineRunStatus.Failed;
    run.errorMessage = errorMessage(err).slice(0, MAX_ERROR_MESSAGE_LENGTH);
    run.retryCount = job.retryCount + 1;

    // No pg-boss attempts left after this throw → the job dead-letters (paid AI
    // stages) or lands in `failed`. Reflect that on the post itself so it stops
    // looking "in progress".
    if (job.retryCount >= job.retryLimit) {
      const post = await em.findOne(Post, ref.postId);
      if (post && post.status !== PostStatus.Published) {
        post.status = PostStatus.Failed;
      }
    }

    await em.flush();
  }

  private async loadOrCreateRun(
    em: EntityManager,
    ref: PipelineStageRef,
  ): Promise<PostPipelineRun> {
    const existing = await em.findOne(PostPipelineRun, {
      postId: ref.postId,
      stage: ref.stage,
    });
    if (existing) {
      return existing;
    }

    const run = new PostPipelineRun();
    run.postId = ref.postId;
    run.stage = ref.stage;
    em.persist(run);

    return run;
  }

  protected spanAttributes(_job: Job<T>): JobSpanAttributes {
    return {};
  }

  // A pipeline-stage processor overrides this to name its stage + post so the
  // host can track the `post_pipeline_runs` row. Non-pipeline processors (e.g.
  // the auth challenge e-mail) leave it returning `null`.
  protected pipelineStage(_job: Job<T>): PipelineStageRef | null {
    return null;
  }

  protected abstract processJob(job: Job<T>): Promise<void>;
}
