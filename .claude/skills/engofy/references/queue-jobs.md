# Queues & scheduled jobs — pg-boss, workers, cron

> Reviewed: `core/queue`, `entrypoints/worker`, `entrypoints/cron`, per-module bootstraps (waves 1–2). See `REVIEW.md` D4, D8, D15.

## Pieces

| Piece | File | Role |
|---|---|---|
| `PG_BOSS` token + module | `core/queue/pg-boss.{module,provider}.ts` | `@Global`, `forRuntime(runtime)`; `supervise` only when `runtime === 'cron'` |
| `QueueName` enum | `core/queue/queue-names.enum.ts` | every queue id; `ALL_QUEUE_NAMES` for fan-out |
| `OutboxSenderService` | `core/queue/outbox-sender.service.ts` | `send(em, QueueName, data)` — staged in a `WeakMap<em>`, drained on `afterFlush` so the enqueue rides the write txn |
| `OutboxSubscriber` | `core/queue/outbox.subscriber.ts` | registers on `orm.em` event mgr, `afterFlush → drain` |
| `withSentryTrace` | `core/queue/sentry-trace.ts` | stamps `_sentryTrace`/`_sentryBaggage` into the payload |
| `PostQueueBootstrapService` | `modules/post` | **the single `boss.createQueue` authority (D8)** — `OnApplicationBootstrap` declares the dead-letter queue + every `QueueName` (auth queue included) from the shared `QUEUE_DEFINITIONS` map |
| `QUEUE_DEFINITIONS` / `POST_DEAD_LETTER_QUEUE` | `core/queue/queue-config.ts` | per-queue `createQueue` options: singleton + 1h expiry base, explicit `retryLimit`/`retryDelay`/`retryBackoff`, `deadLetter` on the paid AI stages |
| `JobWorkerHost<T>` | `entrypoints/worker/job-worker-host.ts` | abstract base for processors; also owns the `PostPipelineRun` lifecycle for a stage job (D4) |
| `WorkerRegistrarService` | `entrypoints/worker/worker-registrar.service.ts` | **only** `boss.work(name, { includeMetadata: true }, jobs => processor.work(jobs))` — never `createQueue` (D8) |
| `CronJobHost` | `entrypoints/cron/cron-job-host.ts` | abstract base for `@Cron` classes |

## Enqueue rules

| # | Rule | Reference |
|---|---|---|
| J1 | Never `boss.send` directly from a handler — use `OutboxSenderService.send(em, QueueName, data)` so the job commits with the flush. | `auth/commands/request-login-code/request-login-code.handler.ts:31-35` |
| J2 | Pipeline successors are enqueued by the **completing** handler with `{ singletonKey: postId }`. | `post/commands/spacy-parse-post/spacy-parse-post.handler.ts:99` |
| J3 | The job payload interface is defined in the worker processor and imported by the enqueuing handler. | `entrypoints/worker/auth/send-challenge-email.processor.ts:6-9` |

## Worker processor pattern

```ts
@Injectable()
export class AssessComplexityProcessor extends JobWorkerHost<AssessComplexityJobData> {
  constructor(private readonly posts: PostService) { super(); }
  protected processJob(job) { return this.posts.assessComplexity(job.data.postId); }
}
```

- One stage = one `QueueName` + one processor + one per-stage `@Module` importing the domain module.
- A **throw** in `processJob` → caught by `JobWorkerHost.handleOne` → (pipeline stages: `PostPipelineRun` set `Failed` on a forked em) → Sentry + log → **rethrown** so pg-boss retries.
- Job runs inside `withRequestContext(this.orm.em, …)` — its own forked `em`.
- A pipeline processor overrides `pipelineStage(job): PipelineStageRef` (stage + postId). `JobWorkerHost` then writes the run row `Pending`+`startedAt` before the job and `Failed`+`errorMessage`+`retryCount++` in the catch — on `this.orm.em.fork()` (a separate transaction) so the trace survives the job's rollback. `PostStatus.Failed` is set once `job.retryCount >= job.retryLimit`. Non-pipeline processors (auth e-mail) leave `pipelineStage()` returning `null`.
- `JobWorkerHost.work` settles each job with `Promise.allSettled`, then re-throws (single reason, or `AggregateError`) so pg-boss still retries the failed job(s). Safe as a batch only because `batchSize` defaults to 1 — a real batch wants pg-boss `perJobResults`.
- Distributed trace continued from `job.data._sentryTrace` → `startSpan({ op: 'queue.process' })`.
- The **facade** owns `em.flush()` — the processor just calls one facade method. (The run-row bookkeeping above is `JobWorkerHost`'s own forked em, not the facade's.)
- Worker shutdown leans on `boss.stop()`'s built-in graceful wait (`PgBossLifecycleService`) — **not** a hand-rolled drain like cron. Don't "fix" it to match.

## Cron pattern

- `@Cron('* * * * *', { waitForCompletion: true })` on a class extending `CronJobHost`.
- `CronJobHost`: module-level `draining` flag + `inFlightTicks` set awaited by `waitForCronTicksToDrain()` before `app.close()`; each tick wrapped in `Sentry.startNewTrace` → `startSpan({ op: 'function.cron' })`; failure → `captureException` + `logger.error` + rethrow.
- **D15:** a cron-driven service that mutates state may own its own `em.flush()` (flush-per-row for mid-batch durability). Such services live in `services/shared/`. No facade / CQRS for pure pollers.
- Empty config (`TELEGRAM_*` unset) → the cron no-ops.

## Fixes owed (confirmed)

| D | Change |
|---|---|
| — | `WORKER_QUEUES` string token → `Symbol()`. (Batch H) |

### Done (Batch C)

- **D4** — `JobWorkerHost` writes the run row on entry / failure on a forked em;
  `PostStatus.Failed` on retry exhaustion; per-queue `retryLimit` + backoff +
  `deadLetter` for the AI stages (`core/queue/queue-config.ts`). `Running` stays
  derived.
- **D8** — `PostQueueBootstrapService` declares every queue from
  `QUEUE_DEFINITIONS`; `AuthQueueBootstrapService` deleted; `WorkerRegistrarService`
  only `boss.work()`s (with `includeMetadata: true`).
- `JobWorkerHost.work` → `Promise.allSettled` + re-throw.

**Caveat:** the single authority lives in `PostModule`, so a worker started with
*only* non-post queues (`worker auth-challenge-email`) never runs it. Every real
deployment loads `PostModule` (the web app imports it, and the default worker
runs all queues), so the queues exist before that worker `work()`s them.
