# Codebase review — decisions archive

Full module-by-module review of `v2` (waves 1–3, 2026-08-30 → 09-01) produced
18 reference files under `references/*.md` and a fix backlog (Batches A–S, all
**DONE**, squash-merged into `main` as `a4b9e1a` "V2 (#1)"). The raw findings
log, batch-by-batch fix history, and the original 48 open questions have been
folded into the reference files themselves (each has its own "Fixes owed" /
"Known weaknesses" table with inline `done (Batch X)` status) and are not
repeated here — see `git log -- .claude/skills/engofy/REVIEW.md` for that
history if ever needed.

What's kept below is the **Decisions log (D1–D18)**, because individual
reference files cite these by number (e.g. `ai.md` → "See REVIEW.md D9, D13").
All 18 are `confirmed` (2026-08-30) and closed.

## Decisions (D1–D18)

### D1 — `DomainError` carries an optional HTTP status — `confirmed`
**Rec:** add optional `status` (+ maybe `code`) to `DomainError`, default 400;
`DomainErrorFilter` honours it. Map `TooMany*` → 429, `*NotFound` → 404,
unique-conflict → 409. Effort: S.

### D2 — Commands return plain values, never managed entities — `confirmed`
**Rec:** handlers return `id` or a small plain view; fix opportunistically per
command; update the telegram consumer of `IngestPost`. Rule already in
`cqrs.md` Q6/A7. Effort: M (spread).

### D3 — Handler flush discipline — `confirmed`
**Rec:** drop the redundant `em.flush()` from `assess-complexity` / `tag-grammar`
/ `generate-exercises` / `publish` / `retry` handlers; keep the per-`PostPart`
flush in `spacy-parse` + `annotate` and document **both** as the 2 sanctioned
exceptions in `cqrs.md`. Effort: S.

### D4 — `post_pipeline_runs` becomes a real run tracker — `confirmed`
**Rec:** write the run row `Pending`+`startedAt` on stage entry (in
`JobWorkerHost`); on caught error `Failed`+`errorMessage`+`retryCount++` before
rethrow; set `PostStatus.Failed` when pg-boss retries exhaust; `Running` is
**derived** (`startedAt set ∧ completedAt null`), no new enum value; set explicit
`retryLimit`+backoff per queue + a `deadLetter` queue for the paid AI stages.
Effort: M.

### D5 — `/retry` = full reprocess from scratch — `confirmed`
**Rec:** `RetryPostHandler` also `nativeDelete` `Sentence` / `SentenceToken` /
`GrammarMatch` / `Exercise` for the post + null `PostPart.annotatedAt`, all in one
flush. No `--force` flag — retry always means from scratch. Effort: S.

### D6 — `publish` gates on the `annotation` branch — `confirmed`
**Rec:** `PublishPostHandler` no-ops-and-requeues until
`PostPipelineRun(stage=Annotation, status=Completed)` exists — the two
`spacy_parse` fan-out branches rejoin at publish. Effort: S.

### D7 — Drop `PostPipelineStage.Fetch` — `confirmed`
**Rec:** link-fetching is out of V1 scope (ingest takes pasted text). Remove the
enum value + PLAN §5 step 1. A future link-fetch is a new stage. Effort: S.

### D8 — Single queue-declaration authority — `confirmed`
**Rec:** `PostQueueBootstrapService` (extended to **all** `QueueName`s incl. the
auth queue), with a shared options const, is the only `boss.createQueue` caller;
`WorkerRegistrarService` only calls `boss.work()`. Effort: S.

### D9 — Hexagonal port pattern is the canon for `core/*` external adapters — `confirmed`
**Rec:** `*.port.ts` (Symbol token + interface) + `*.provider.ts` + `*.config.ts`
is the standard for swappable external adapters (`ai`, `nlp`; new ones follow it).
auth's inline Google verifier + telegram's inline `fetch` client are the older
simpler style — leave them, don't retrofit. Document in `architecture.md`.
Effort: 0 (doc only).

### D10 — Read-only cross-module `em.find` is allowed for query handlers — `confirmed`
**Rec (pragmatic):** sanction direct read-only `em.find` of another module's
tables **from query handlers only** (never writes, never in a command); document
in `architecture.md` that a `post` projection / `services/shared` lookup is the
eventual fix for `learning`'s post-table reads + the missing
`post_word`/`post_phrase`. Effort: 0 (doc). *Alt: build the boundary now — L.*

### D11 — `mastery_score` derived at read time — `confirmed`
**Rec:** compute in `get-profile` from the already-loaded cards + usage points
(like `streak`/`cefr`); make the stored column display-only (or drop it);
`recordGrammarReview` stops recomputing. Effort: S.

### D12 — PLAN §3 vs code reconciliation — `confirmed`
**Rec, per item:**
- **word CEFR:** keep on `WordDefinition` (per-POS); add a derived
  "easiest classified sense" helper; update PLAN §3.3.
- **attribution:** add `attributionText` (required) + `PostSourceType` enum
  to `PostSource` — PLAN §9 is a legal constraint, non-negotiable. Effort: M.
- **grammar_matches unique:** add composite
  `@Unique(sentenceId, grammarUsagePointId, tokenStart, tokenEnd)` **and** keep
  delete-by-sentence in the handler.
- **node-tree parser:** wire `parseDoc` at the reassembly site
  (`get-post-detail`) — it is the intended read-time validator; fix the
  misleading comments; **don't** delete.
- **Subscription home:** move `Subscription` + its 2 enums to
  `modules/billing/entities/`.
- **subscription expiry:** drop `SubscriptionStatus.Expired`; expiry is
  `currentPeriodEnd <= now` at read time; document.
- **telegram_message_id:** rename column + field to `updateId` (migration);
  matches what's stored + PLAN §3.9 prose.
- **posts.status:** collapse `Annotating`/`Annotated` → single `Processing`;
  `Published`/`Failed` stay.
Effort: M overall (attribution is the real build).

### D13 — inline-markup / PLAN §6 staleness — `confirmed`
**Rec:** update PLAN §6/§12 to document the actual approach (rare `⟦⟧`/`{{}}`
delimiters + reconstruct-and-compare, no PUA escaping); note literal `⟦⟧` in
source is unsupported (vanishingly rare). Don't build the PUA round-trip.
`detectGerund`: accept the false-positive class + add a ~15-entry stop-list of the
commonest lexicalised `-ing` nouns. Effort: S.

### D14 — Web infrastructure — `confirmed`
**Rec, per item:**
- **/api prefix:** `setGlobalPrefix('api', { exclude: ['_healthz'] })` in
  `main.ts` + `.addServer('/api')` in the OpenAPI builder. Keep the proxy too.
- **guard placement:** move `SessionAuthGuard` `APP_GUARD` +
  `ETagInterceptor` `APP_INTERCEPTOR` into `web.module.ts`.
- **rate limiting:** add `@nestjs/throttler` `ThrottlerGuard` (global, Redis
  storage) before launch — PLAN §7. Effort: M.
- **response-DTO coupling:** web response DTOs independent of module view
  types + explicit mapper in `ContentController`; shared `{ items, nextOffset }`
  list envelope.
- **request-DTO home:** web-local `createZodDto` under
  `entrypoints/web/*/dto/` + controller mapper is the **standard**; auth's
  command-DTO reuse is a tolerated exception. Reason: keep HTTP contract out of
  the domain module.
- **CSRF:** `SameSite=Lax` + POST-only + single-origin is acceptable for V1;
  document; revisit for any third-party embed.
- **/_healthz:** add Terminus DB + Redis indicators (readiness) +
  `@ApiTags('internal')`.
Effort: M overall.

### D15 — telegram / cron-poller layering — `confirmed`
**Rec:**
- **layering:** sanction "cron entrypoint → exported `services/shared/*.run()`
  that owns its own flush" as the pattern for cron-driven non-HTTP work (no
  facade / CQRS for pure pollers). Move the 2 services to `services/shared/`.
  Document.
- **failed publications:** `PublishPendingService` re-selects `Failed` rows
  with `retryCount < N` + backoff; `/retry` also resets `failed` telegram
  publications for the post.
- **retention:** daily cron prunes `telegram_updates` older than 30 days.
  Low priority.
Effort: S–M.

### D16 — CLI importer layering — `confirmed`
**Rec:** sanction "thin importer script inline in the CLI `execute()` with its own
`em.flush()`" as an explicit named exception for one-off / seed commands (PLAN
§1). Document in `cqrs.md`. Don't refactor into services. Effort: 0 (doc).

### D17 — Test + migration tooling — `confirmed`
**Rec:**
- **migration:check:** add `pnpm migration:check` (mikro-orm, prod config
  `snapshot:true`) + CI step; `ensureMigrated` also fails on a pending diff.
  Migrations stay plain-generated — the check is the gate.
- **shared fakes:** `test/fakes/{ai,nlp,mailer,telegram}.fake.ts`, one
  canonical `implements` per port.
- **coverage:** verify the 80/80/70/80 gate is actually green in the fix
  pass; add **direct** specs for worker processors + `AnthropicClientService` +
  `MAILER` rather than leaning on transitive coverage.
- **browser e2e:** document as a manual pre-release gate for V1; automate
  (CI job: seed + Playwright) post-launch. Low priority.
- **Redis isolation:** dedicated test Redis DB index + `FLUSHDB` in
  `afterEach` of `useOrmSuiteLifecycle`.
- **configApp factory:** extract one `configureApp(app)` shared by `main.ts`
  + the web test helper.
Effort: M overall.

### D18 — Misc / lower-stakes — `confirmed`
**Rec:**
- **resolve-session unawaited refresh:** `await` it inside the command
  (it's cheap). "Command on a read path for a genuine state change" stays allowed.
- **challenge atomicity:** persist the challenge deferred (`em.create`/
  `persist`) so it commits with the outbox email job.
- **timezone:** force `timezone: 'UTC'` in the pg `driverOptions` + document.
- **mail fallback:** `ConsoleMailerService` is the no-key fallback; throw at
  bootstrap in production if neither Resend key nor explicit MailHog opt-in.
- **Sentry breadcrumbs:** run `context.query` through `sanitizeSqlParams` +
  drop `results` before the breadcrumb; gate behind the same prod logic as spans.
- **queue DB config:** share the ORM config object — one source of the
  Postgres connection.
- **billing queries:** keep `SubscriptionService` internal (drop from
  `exports`); billing facade calls it; add a thin `GetSubscriptionQuery` for
  symmetry. Low priority.
Effort: S–M.

## Genuinely still open (post-review, low priority / deferred by choice)

Everything else from the original backlog is done. These are the only items
any reference file still marks as open, all low-severity and consciously
deferred (not oversights):

- CSRF: none beyond `SameSite=Lax` + POST-only — accepted for V1 (D14);
  revisit only if a third-party embed is ever added.
- `apps/web` Playwright + `seed-web-e2e.ts` not wired into CI — manual
  pre-release gate for now (D17 #46).
- Telegram `retry_after` (429) honoured only via fixed backoff, not the exact
  hint — needs a per-row next-attempt column; single low-volume channel.
- `get-feed` offset pagination has no `(publishedAt, id)` keyset index yet —
  fine at MVP volume, comment documents the drift.
- `DateTime`→ISO serialization happens at slightly different layers across
  modules — cosmetic, not a correctness issue.
