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
| `<Module>QueueBootstrapService` | per module | `OnApplicationBootstrap` → `boss.createQueue(QueueName.X)` |
| `JobWorkerHost<T>` | `entrypoints/worker/job-worker-host.ts` | abstract base for processors |
| `WorkerRegistrarService` | `entrypoints/worker/worker-registrar.service.ts` | `boss.work(name, jobs => processor.work(jobs))` |
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
- A **throw** in `processJob` → caught by `JobWorkerHost.handleOne` → Sentry + log → **rethrown** so pg-boss retries.
- Job runs inside `withRequestContext(this.orm.em, …)` — its own forked `em`.
- Distributed trace continued from `job.data._sentryTrace` → `startSpan({ op: 'queue.process' })`.
- The **facade** owns `em.flush()` — the processor just calls one facade method.
- Worker shutdown leans on `boss.stop()`'s built-in graceful wait (`PgBossLifecycleService`) — **not** a hand-rolled drain like cron. Don't "fix" it to match.

## Cron pattern

- `@Cron('* * * * *', { waitForCompletion: true })` on a class extending `CronJobHost`.
- `CronJobHost`: module-level `draining` flag + `inFlightTicks` set awaited by `waitForCronTicksToDrain()` before `app.close()`; each tick wrapped in `Sentry.startNewTrace` → `startSpan({ op: 'function.cron' })`; failure → `captureException` + `logger.error` + rethrow.
- **D15:** a cron-driven service that mutates state may own its own `em.flush()` (flush-per-row for mid-batch durability). Such services live in `services/shared/`. No facade / CQRS for pure pollers.
- Empty config (`TELEGRAM_*` unset) → the cron no-ops.

## Fixes owed (confirmed)

| D | Change |
|---|---|
| D4 | run row on entry; `Failed`/`errorMessage`/`retryCount` on error; `PostStatus.Failed` on exhaustion; explicit `retryLimit`+backoff per queue; `deadLetter` queue for paid AI stages. `Running` is derived, not an enum value. |
| D8 | `PostQueueBootstrapService` (extended to **all** `QueueName`s) is the single `createQueue` authority with a shared options const; `WorkerRegistrarService` only `boss.work()`s. |
| — | `Promise.all(jobs.map(handleOne))` in `JobWorkerHost.work` → `allSettled` + per-job settle (safe today only because `batchSize` defaults to 1). |
| — | `WORKER_QUEUES` string token → `Symbol()`. |
