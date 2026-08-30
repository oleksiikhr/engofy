# Error handling — domain errors, HTTP mapping, all-or-nothing

> Reviewed: all modules + `core/http` (waves 1–2). See `REVIEW.md` D1.

## Error taxonomy

| Base | Where | Maps to | Filter |
|---|---|---|---|
| `DomainError` (`core/errors/domain.error.ts`) | one class per failure mode in `<module>/errors/` | **HTTP 400** (today — flat) | `DomainErrorFilter` |
| `AuthorizationError` (`core/errors/authorization.error.ts`) | authz failures | **HTTP 403** | `AuthorizationErrorFilter` |
| `HttpException` (Nest) | guards, controllers (`NotFoundException`, …) | its own status | `HttpErrorFilter` |
| anything else | — | **HTTP 500** `{message:'Internal server error'}` + Sentry | `ErrorFilter` (`@Catch()`) |

Filters are registered specific-last in `main.ts:66-72` (Nest applies them reverse,
so `ErrorFilter` is the fallback).

## Rules

| # | Rule | Reference |
|---|---|---|
| E1 | One error class per failure mode, `extends DomainError`, `super(message)` only — the base sets `this.name = new.target.name`. | `auth/errors/too-many-attempts.error.ts:3-7` |
| E2 | Constructor args interpolated into the message are fine (`post` does it) — same base contract as auth's static messages. | `post/errors/overlapping-span-insert.error.ts` |
| E3 | Services/handlers **throw**; HTTP status mapping is out of module scope. | `auth/services/challenge.service.ts:87` |
| E4 | Infra failures: `new Error(msg, { cause })` with a structured `cause`. Use the `err` key when logging so pino's serializer fires (`{ err }`, not `{ cause: err }`). | `core/s3/s3.service.ts:44`; **bug:** `worker.ts:35` uses `{ cause: err }` |
| E5 | All-or-nothing: validate the whole batch (offsets, annotations) before **any** write; the first bad item throws and aborts the job. | `post/domain/validate-annotations.ts:107-118` |
| E6 | Grammar tagging is the **sanctioned exception** — drop-with-warn per span, not all-or-nothing. | `post/commands/tag-grammar/tag-grammar.handler.ts:251-279` |

## D1 — `DomainError` will carry an optional status (confirmed)

Target state (not yet implemented):

```ts
export class DomainError extends Error {
  constructor(message: string, readonly status = 400) { super(message); this.name = new.target.name; }
}
```

- `TooManyLoginRequestsError` / `TooManyAttemptsError` → `429`
- `CardNotFoundError` / `PostNotFoundError` → `404`
- unique-conflict cases → `409`
- `DomainErrorFilter` reads `err.status` (default 400).

Until then, every domain error is 400 — the OpenAPI global `429` response is
currently unreachable (`build-openapi-document.ts`), and `AuthorizationError`
still uses `this.name = AuthorizationError.name` (should be `new.target.name`).

## Async / pipeline failures

Per **D4**: a failing pipeline stage must leave a trace. Target: `JobWorkerHost`
writes `PostPipelineRun` `Pending`+`startedAt` on entry, `Failed`+`errorMessage`+
`retryCount++` on caught error before rethrow; `PostStatus.Failed` on retry
exhaustion. Today it only rethrows (→ Sentry + pg-boss `failed` state, no row).
See `references/pipeline.md`, `references/queue-jobs.md`.
