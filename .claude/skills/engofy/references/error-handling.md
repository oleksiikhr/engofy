# Error handling — domain errors, HTTP mapping, all-or-nothing

> Reviewed: all modules + `core/http` (waves 1–2). See `REVIEW.md` D1.

## Error taxonomy

| Base | Where | Maps to | Filter |
|---|---|---|---|
| `DomainError` (`core/errors/domain.error.ts`) | one class per failure mode in `<module>/errors/` | `err.status` (**400** default; `429`/`404`/`409` per subclass) | `DomainErrorFilter` |
| `AuthorizationError` (`core/errors/authorization.error.ts`) | authz failures | **HTTP 403** | `AuthorizationErrorFilter` |
| `HttpException` (Nest) | guards, controllers (`NotFoundException`, …) | its own status | `HttpErrorFilter` |
| anything else | — | **HTTP 500** `{message:'Internal server error'}` + Sentry | `ErrorFilter` (`@Catch()`) |

Filters are registered specific-last in `main.ts:66-72` (Nest applies them reverse,
so `ErrorFilter` is the fallback).

## Rules

| # | Rule | Reference |
|---|---|---|
| E1 | One error class per failure mode, `extends DomainError`, `super(message)` — the base sets `this.name = new.target.name`. Pass a second `super(message, status)` arg **only** for non-400 cases (`429`/`404`/`409`). | `auth/errors/too-many-attempts.error.ts:3-7`; `auth/errors/too-many-login-requests.error.ts` |
| E2 | Constructor args interpolated into the message are fine (`post` does it) — same base contract as auth's static messages. | `post/errors/overlapping-span-insert.error.ts` |
| E3 | Services/handlers **throw**; the concrete HTTP mapping stays in `DomainErrorFilter` — a subclass only *declares* its status via the `super()` arg, never touches `HttpStatus` or a response. | `auth/services/challenge.service.ts:87` |
| E4 | Infra failures: `new Error(msg, { cause })` with a structured `cause`. Use the `err` key when logging so pino's serializer fires (`{ err }`, not `{ cause: err }`). | `core/s3/s3.service.ts:44`; **bug:** `worker.ts:35` uses `{ cause: err }` |
| E5 | All-or-nothing: validate the whole batch (offsets, annotations) before **any** write; the first bad item throws and aborts the job. | `post/domain/validate-annotations.ts:107-118` |
| E6 | Grammar tagging is the **sanctioned exception** — drop-with-warn per span, not all-or-nothing. | `post/commands/tag-grammar/tag-grammar.handler.ts:251-279` |
| E7 | A best-effort side effect that runs **after** the real work succeeded (e.g. a chat confirmation after `ingest`) goes **outside** the `try` that guards the work — inside it, a failed notification reads as the work failing (wrong reply, false-negative Sentry). Swallow + `logger.warn` it instead. | `telegram/services/shared/poll-updates.service.ts` (`dispatch`) |

## D1 — `DomainError` carries an optional status (done, Batch B)

```ts
export class DomainError extends Error {
  constructor(message?: string, readonly status = 400) {
    super(message);
    this.name = new.target.name;
  }
}
```

- `DomainErrorFilter` responds with `exception.status` (default 400).
- `TooManyLoginRequestsError` / `TooManyAttemptsError` → `429`.
- `CardNotFoundError` → `404`. (No `PostNotFoundError` exists — post 404s come
  from a Nest `NotFoundException` in the controller via `HttpErrorFilter`.)
- `409` (unique conflict): mechanism is in place, no subclass uses it yet —
  the learning `add-card` race still surfaces a raw
  `UniqueConstraintViolationException` (Batch E turns that into an idempotent
  upsert, not a 409).
- `CardLimitReachedError` stays `400` — a plan-quota error, not in the
  429/404/409 set; revisit if a dedicated status is wanted.
- OpenAPI already declares a global `429` (`build-openapi-document.ts`); it is
  now reachable. No `409` response added (unused).

## Async / pipeline failures (D4 — done, Batch C)

A failing pipeline stage leaves a trace. `JobWorkerHost` (`entrypoints/worker/
job-worker-host.ts`) writes `PostPipelineRun` `Pending`+`startedAt` on stage
entry and `Failed`+`errorMessage`+`retryCount++` in the catch **before**
rethrowing — both on `this.orm.em.fork()` (its own transaction) so the row
survives the job's rollback. When pg-boss has no attempts left
(`job.retryCount >= job.retryLimit`) it also sets `PostStatus.Failed`. The
handler still throws for pg-boss to retry; the paid AI queues carry a
`deadLetter` so a poison job is quarantined (`core/queue/queue-config.ts`).
`Running` is derived (`startedAt` set, `completedAt` null), not an enum value.
See `references/pipeline.md` (P3a), `references/queue-jobs.md`.
