# Codebase Review — progress & method

Module-by-module read-only review of `v2`. Each pass produces (a) findings logged
here, (b) raw material for `references/*.md` (written by the lead, not subagents).

## Method

- Subagents review **read-only** and return a report in the exact template below.
- The lead synthesises `references/*.md` from reports — subagents never write them.
- One code area per subagent. Order: foundations → data → http → async → tests → cross-cut.
- Baseline for "how it should look": `src/modules/auth`.

## Subagent report template

```
## 1. Inventory
| file / dir | purpose | LOC | notes |

## 2. Observed conventions
One bullet per rule, tagged with a concern slug from the list below:
architecture · cqrs · style · mikroorm · migrations · db-performance · dates ·
http-api · validation · error-handling · queue-jobs · pipeline · ai · nlp ·
mail · security · config · tests · observability
Format: `[slug] <rule as observed in one line> — evidence: path:line`

## 3. Findings
| sev | concern | file:line | problem | suggested fix |
sev: high = bug / security / data-loss · med = convention drift / maintainability ·
low = nit / naming / missing doc

## 4. Divergence from auth baseline
Only where this area does the same thing differently than src/modules/auth.
(auth reviewer: write "n/a — this is the baseline".)

## 5. Open questions for the user
Product or architecture decisions the review can't settle.
```

Rules for subagents: read-only, no edits. Cite `path:line` for every claim.
Tables and bullets over prose. Return the whole report as the final message.

## Wave 1 — foundations + core (COMPLETE)

| area | scope | agent | status | report |
|---|---|---|---|---|
| auth | `src/modules/auth`, `src/core/actor` | wave-1 | **done** | synthesised below |
| core-infra | `src/core/*` except `ai`, `nlp` | wave-1 | **done** | synthesised below |
| core-ai-nlp | `src/core/ai`, `src/core/nlp`, `nlp-service/`, `draft/` | wave-1 | **done** | synthesised below |
| post-data | `src/modules/post`: entities, enums, errors, converters, domain, embeddables | wave-1 | **done** | synthesised below |
| post-flow | `src/modules/post`: commands/*, queries/*, `post.module.ts`, `post.service.ts` | wave-1 | **done** | synthesised below |

## Wave 2 — remaining modules + entrypoints (COMPLETE)

| # | area | scope | status |
|---|---|---|---|
| 1 | learning-billing | `src/modules/learning`, `src/modules/billing` | **done** |
| 2 | telegram-cron | `src/modules/telegram`, `src/entrypoints/cron` | **done** |
| 3 | web | `src/entrypoints/web` | **done** |
| 4 | worker-cli | `src/entrypoints/worker`, `src/entrypoints/cli` | **done** |
| 5 | tests | `test/`, vitest, CI | **done** |

## Wave 3 — cross-cutting (complete)

Consistency sweep of every area against the `auth` baseline; fill remaining
`references/*.md` gaps; resolve accumulated open questions. Ran as **Batches L–O**
in the fix backlog:

- **L** — DP2 `disableIdentityMap` on the `post` query handlers; `queue.config`
  creds aligned to `engofy/engofy`; D9/D10/D11 written into the reference files;
  closed "fix owed" rows left over from Batch I.
- **M** — DI tokens → `Symbol`; `@CurrentUser()` → 401; Sentry `tracesSampleRate`
  0.1 in prod; `PUBLIC_URL` / CORS guard; drop `S3_CORS_MAX_AGE`;
  `supportsAdaptiveThinking` → allowlist; `http-nlp-client` `assertParseResult()`;
  draft idiom-harness `maxTokens` / `truncated` parity.
- **N** — `IngestPostCommand` → `IngestedPostView` (D2 tail); `parse-annotation-tags`
  identical-form offset bug; `@ApiCookieAuth()` on the authed controllers;
  pipeline stage comments; `PostDetailResponseDto.doc` kept as a `type`-import
  by decision.
- **O** — `challenge.service` outbox atomicity (D18); `worker.ts`/`cron.ts`
  double-`app.close()` (`closeOnce`); per-call tag-parser regexes;
  `@CachePolicy('public')` on `ContentController` (user decision); downstream AI
  re-call on retry accepted as intentional (user decision, open q9).

All 48 open questions are now grouped into D1–D18 and resolved. Remaining items
are consciously deferred (big / breaking / infra) — see the "Still open" note at
the end of Batch O.

## Fix backlog (batched — one batch per session; `[ ]` → `[x]` as done)

Order is a suggestion. **Batch D-attribution is the priority** (PLAN §9 = legal).
Batches are sized to be reviewable + `pnpm type && biome check && pnpm test` green
as a unit. Doc/PLAN edits (J) are cheapest.

### Batch A — cheap safety fixes (S, low risk) — DONE (fix/batch-a-safety)
- [x] D18: `await sessions.refresh(dto.token)` in `ResolveSessionHandler` (dropped the floating `.catch(() => undefined)`) — `resolve-session.handler.ts:22`
- [x] D18: pg session `TimeZone` forced UTC via `options: '-c timezone=UTC'` in `driverOptions` — `mikro-orm.setup.ts:50`; dates.md open-question note closed
- [x] D18: per-query Sentry breadcrumb — `sanitizeSqlParams` (prod-gated via `isProdEnvironment()`), `results` dropped, only emitted when `context.query` present — `mikro-orm.logger.ts:58-78`; security.md high row closed
- [x] D18: `redis.provider.ts` — factory now attaches `client.on('error', …)` (Logger, mirrors pg-boss)
- [x] D18: mailer fallback chain = Resend → `MAIL_USE_MAILHOG` → `ConsoleMailerService`; `isProdEnvironment()` → throw at bootstrap when none set — `mailer.provider.ts`, new `mail.config.ts` `useMailhog`; mail.md D18 + security.md row closed
- [x] `AuthorizationError` → `this.name = new.target.name` — `authorization.error.ts:4`; error-handling.md note closed
- [x] AI: Sonnet 5 pricing `{input:2,output:10}` in `anthropic-client.service.ts:14` + `draft/lib/call-claude.ts:11`; ai.md Fixes-owed row closed
- [x] AI: `completeStructured` throws the distinct `max_tokens` error before `tool.schema.parse` — `anthropic-client.service.ts:100-107`; ai.md AI3 gap + Fixes-owed row closed
- [x] D3: dropped redundant trailing `em.flush()` from `assess-complexity` / `tag-grammar` / `generate-exercises` / `publish-post` / `retry-post` handlers (facade flush owns it); cqrs.md drift note closed. `pnpm type` + `biome` + `pnpm test` (105 files / 603 tests, incl. 39 ispec) green.

### Batch B — `DomainError` → HTTP status (D1) — DONE (fix/batch-a-safety)
- [x] `DomainError` 2nd ctor arg `status = 400` (plain number, no `HttpStatus` dep) — `core/errors/domain.error.ts`; `DomainErrorFilter` sends `exception.status` instead of hard-coded `BAD_REQUEST` — `domain-error.filter.ts:21`
- [x] `TooManyLoginRequestsError` + `TooManyAttemptsError` → `super(msg, 429)`; `CardNotFoundError` → `super('Card not found', 404)`. No `*NotFound` for post (Nest `NotFoundException` via `HttpErrorFilter`). No 409 subclass — mechanism ready; the learning `add-card` unique race is Batch E (upsert, not a 409). `CardLimitReachedError` deliberately left `400` (plan-quota, not in the 429/404/409 set) — noted in error-handling.md.
- [x] OpenAPI global `429` already declared in `build-openapi-document.ts` — now reachable, left as-is; no `409` added (unused)
- [x] tests: `auth.controller.ispec` — 2 rate-limit cases + the OTP lockout case now expect `TOO_MANY_REQUESTS`; new `learning.controller.ispec` case "returns 404 when reviewing a card that does not exist". error-handling.md D1 + taxonomy + E1/E3 updated; security.md D1 row closed. `pnpm type` + `biome` + `pnpm test` (105 files / 606 tests) green.

### Batch C — pipeline correctness (D4, D5, D6, D7, D8) — DONE (fix/batch-a-safety)
- [x] D7: `PostPipelineStage.Fetch` removed — `post-pipeline-stage.enum.ts:3-18` (enum now starts at `SpacyParse`; header comment records why + that the `post_pipeline_runs_stage_check` constraint still lists `'fetch'` → Batch D migration). PLAN §5 step 1 already gone (Batch J). pipeline.md Stage-DAG note updated.
- [x] D8: new `src/core/queue/queue-config.ts` (`QUEUE_DEFINITIONS` + `POST_DEAD_LETTER_QUEUE` shared const). `PostQueueBootstrapService` rewritten as the single `createQueue` authority — declares the dead-letter queue + every `QueueName` (auth incl.) from the map — `post-queue-bootstrap.service.ts`. `AuthQueueBootstrapService` deleted + dropped from `auth.module.ts`. `WorkerRegistrarService.onApplicationBootstrap` no longer calls `createQueue`; `boss.work(name, { includeMetadata: true }, …)` — `worker-registrar.service.ts:21-38`. Caveat (auth-only worker never loads `PostModule`) noted in queue-jobs.md.
- [x] D4: `JobWorkerHost` — `pipelineStage(job): PipelineStageRef | null` hook; `recordStageStart` (`Pending`+`startedAt`, clears `errorMessage`/`completedAt`) before the job and `recordStageFailure` (`Failed`+`errorMessage` truncated 2000ch+`retryCount = job.retryCount+1`) in the catch, both on `this.orm.em.fork()` (own txn, survives rollback); `PostStatus.Failed` when `job.retryCount >= job.retryLimit` — `job-worker-host.ts`. All 6 post processors override `pipelineStage()` — `entrypoints/worker/post/*.processor.ts`. Per-queue `retryLimit`+`retryBackoff` + `deadLetter` (AI stages) in `queue-config.ts`. Columns `started_at`/`error_message`/`retry_count` already exist (`Migration20260829124701`) → no migration. `Running` derived, no enum value added. New `src/entrypoints/worker/post/pipeline-run-tracking.ispec.ts` (3 cases: Failed row + message + retryCount; post untouched mid-retry; `PostStatus.Failed` on exhaustion).
- [x] D5: `RetryPostHandler` rewritten — `nativeDelete` `SentenceToken`/`GrammarMatch` (by `sentenceId $in`), `Sentence`/`Exercise`/`PostPipelineRun` (by `postId`), null every `PostPart.annotatedAt`, reset `posts.status`, re-enqueue only `spacy_parse` — `retry-post.handler.ts`. No `--force`. `retry-post.handler.ispec.ts`: +2 cases (full-artefact wipe; no-op-safe reset with no artefacts).
- [x] D6: `PublishPostHandler` gates on `PostPipelineRun(stage=Annotation, status=Completed)` — if absent, re-enqueues a delayed (`startAfter: 30`) `post-publish` via outbox and returns with no state change; injects `OutboxSenderService` — `publish-post.handler.ts`. `publish-post.handler.ispec.ts`: existing cases seed a completed annotation run; +2 cases (gated no-op + re-queue; publishes once annotation flips Completed).
- [x] `JobWorkerHost.work` → `Promise.allSettled` + re-throw (single reason, or `AggregateError`) — `job-worker-host.ts:38-59`.

`pnpm run type` + `biome check` + `pnpm test` green — **106 files / 613 tests** (was 105 / 606: +7 ispec). `pnpm test:cov` gate green (stmts 88.2 / branches 73.7 / funcs 82.3 / lines 88.6). `pnpm build` + `git diff --exit-code src/metadata.ts` clean.

### Batch D — schema reconciliation (D12) + migration:check (D17) — DONE (fix/batch-a-safety)
Migrations `Migration20260830120000`..`120600` (all up+down verified; `migration:check` green from a clean DB). `pnpm type` + `biome` + `pnpm test` (**107 files / 623 tests**, was 107/622) + `pnpm test:cov` gate green. `pnpm build` regenerated `src/metadata.ts` (billing path + attribution DTO fields) — `git diff --exit-code src/metadata.ts` clean after build.
- [x] **§9 attribution** — new `PostSourceType` enum (`enums/post-source-type.enum.ts` — `original`/`excerpt`/`reddit_comment`/`news_snippet`); `PostSource.type` + `.attributionText` both NOT NULL (`embeddables/post-source.embeddable.ts`, TS + DB defaults so direct entity construction stays valid). `IngestPostDto` gained `sourceType` (default `original`) + `attributionText` (optional). New `domain/derive-attribution-text.ts` (explicit → link → type-label fallback) + `.spec`. `IngestPostHandler` sets both; CLI `post ingest` gained `-s/--source-type` (validated → `InvalidCliFlagError`) + `-a/--attribution`; telegram `/add` routes through `IngestPostDto.create` (defaults, NOTE for Batch G). `FeedItemView`/`PostDetailView` + web `FeedItemDto`/`PostDetailResponseDto` expose `attributionText` + `sourceType` (kept `sourceLink`); handlers populate from `post.source`. Migration `120200` (add cols nullable+default → backfill `original` / `coalesce(link,'Original content')` → set NOT NULL → CHECK). ispec: `ingest-post.handler.ispec` +3, `content.controller.ispec` feed+detail assertions, `post-ingest.command.spec` +2.
- [x] `grammar_matches` composite `@Unique(sentenceId, grammarUsagePointId, tokenStart, tokenEnd)` — `grammar-match.entity.ts` (+ dropped now-redundant standalone `@Index()` on `sentenceId`; kept `grammarUsagePointId`). `TagGrammarHandler` keeps `nativeDelete`-by-sentence AND now dedupes spans in memory (`seen` Set) so a model-repeated span is a no-op, not a `UniqueConstraintViolationException` — `tag-grammar.handler.ts:96-108,283-287` (+ispec case). Migration `120500` (constraint name auto-truncated: `grammar_matches_sentence_id_grammar_usage_point_i_05997_unique`).
- [x] `posts.status`: `Annotating`/`Annotated` → single `Processing` — `enums/post-status.enum.ts`; `annotate-post.handler.ts:119-121,151` (Pending→Processing guard + end-of-stage set). Migration `120100` (data `update ... where status in ('annotating','annotated')` + CHECK `('pending','processing','published','failed')`). Matches PLAN §3.2. ispec: `annotate-post.handler.ispec:160`, `content.controller.ispec:166`.
- [x] move `Subscription` + `SubscriptionPlan`/`SubscriptionStatus` enums → `modules/billing/{entities,enums}/` (`git mv`, glob-discovered so no `forFeature`); all imports rewritten (web dto/controller, billing service/command/handler, learning add-card ispec, e2e seed); `billing.module.ts` comment updated. `SubscriptionStatus.Expired` removed (enum now single-value; expiry is `currentPeriodEnd <= now` at read). Migration `120600` (data `update ... where status='expired'` + CHECK `('active')`).
- [x] rename `telegram_updates.telegram_message_id` → `update_id` (col + `@Unique` constraint + `TelegramUpdate.updateId` field + entity comment); `poll-updates.service.ts` (field + raw `max(update_id)` SQL + log key) + ispec. Migration `120400` (rename column + rename constraint). Batch G still owed the rest of the telegram fixes.
- [x] drop redundant standalone `@Index()` on composite-unique leading columns — `sentence.postPartId`, `sentence_token.sentenceId`, `learning_cards.userId` (+ `grammar_matches.sentenceId`, above); replaced `learning_cards` `@Index()` on `due` with class-level `@Index(['userId','due'])` for the practice-queue hot path. Migration `120500`.
- [x] `review_logs` — dropped `created_at` column + field (`reviewedAt` is the meaningful timestamp; nothing read `createdAt`). `review-log.entity.ts`, migration `120300`.
- [x] wire `parseDoc(assembleDocFromParts(...))` at `get-post-detail.handler.ts:58` — read-time re-validation of the reassembled tree (`InvalidNodeTreeError` on a converter/splice bug). Comments fixed: `post-part-body.type.ts` (no `Post.body`; points at the handler), `node-tree.type.ts` (`NodeTreeType` is the unused drop-in for a future `Post`-level tree column). `node-tree.parser.ts` kept (D12).
- [x] `pnpm migration:check` (D17) — `package.json` scripts `mikro-orm` + `migration:{create,up,down,check}` (via `@swc-node/register` + `@mikro-orm/cli`); CI step `pnpm migration:up && pnpm migration:check` in `.github/workflows/app.yaml` (prod config, `snapshot:true`). `ensureMigrated` (`test/setup/migration-guard.helper.ts`) now calls `orm.migrator.checkSchema()` after replay and throws with the pending diff on drift. Pre-existing `'fetch'` drift closed by `120000`.
- [x] Batch C tail — dropped legacy `'fetch'` literal from `post_pipeline_runs_stage_check` (was flagged in `post-pipeline-stage.enum.ts` header). Migration `120000`.

### Batch E — learning / billing (D2, D11) — DONE (fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**108 files / 633 tests**, was 107/623) + `pnpm test:cov` gate green (stmts 88.4 / branches 73.8 / funcs 83 / lines 88.7). `pnpm build` + `git diff --exit-code src/metadata.ts` clean. `pnpm migration:check` green — no schema change in this batch.
- [x] **D11** — `get-profile` derives `masteryScore` per construction at read time from the already-loaded cards (`aggregateMasteryScore` over `grammarCardsByPoint`) — `get-profile.handler.ts:196-215` (`buildSkillTree`/`toConstructionView` gained a `cards` param). `SkillProgressService.recordGrammarReview` no longer writes `progress.masteryScore`; `computeMastery` deleted; entity + service + `profile-view.ts` comments updated — `skill-progress.service.ts:33-56`. `user_skill_progress.mastery_score` column kept (display-only, no migration). ispec: new `get-profile.handler.ispec.ts:` "derives masteryScore at read time, ignoring the stored column" (poisons the stored col to 999, asserts view still 0<score≤100); `review-card.handler.ispec.ts:90` now asserts `progress.masteryScore` stays `0`.
- [x] **D2** — new `learning/types/card-view.type.ts` (`CardView` + `toCardView`) + `billing/types/subscription-view.type.ts` (`SubscriptionView` + `toSubscriptionView`). `AddCardCommand`/`ReviewCardCommand` → `Command<CardView>`; `ActivateMockSubscriptionCommand` → `Command<SubscriptionView>`; handlers return the view, facades + web controllers (`learning.controller.ts` `toCardDto`, `billing.controller.ts` `toDto`) retyped. `add-card.handler.ispec` fetches the stored row for `wordId`/`phraseId` assertions; `activate-mock-subscription.handler.ispec` drops the `.status` assertion (not on the view). cqrs.md Q6 updated.
- [x] **add-card / skill-progress upsert** — `AddCardHandler` keeps the `findOne` fast path but the insert is now `em.upsert(LearningCard, card, { onConflictFields: onConflictFields(target), onConflictAction: 'ignore' })` (per-target-type composite unique) — a racing duplicate `POST /learning/cards` resolves idempotently instead of `UniqueConstraintViolationException` → 500 — `add-card.handler.ts:56-74,113-124`. `SkillProgressService.loadOrCreate` rewritten as a single `em.upsert(UserSkillProgress, …, onConflictFields:['userId','constructionId'], onConflictAction:'ignore')` — `skill-progress.service.ts:63-77`. ispec: `add-card.handler.ispec` +1 ("does not fail when the target card already exists from a racing add"). NOTE: a true concurrent-race ispec isn't feasible under the serial int-suite (one shared EM, no per-call fork) — the guarantee rests on `onConflictAction:'ignore'` (same pattern as `complete-login.service.ts`) + the sequential idempotency test.
- [x] **computeStreak SQL** — `get-profile.computeStreak(cardIds)` now runs `SELECT DISTINCT to_char((reviewed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') … WHERE card_id IN (…)` via `em.getConnection().execute(…, 'all', em.getTransactionContext())` (M5/DP5) instead of loading every `review_logs` row — `get-profile.handler.ts:75-92`. New `dailyStreakFromUtcDays(utcDays, now)` in `domain/daily-streak.ts` (shares `streakFromDays` with the untouched `computeDailyStreak`) + 5 spec cases. db-performance.md "unbounded reads" row closed.
- [x] **billing GetSubscriptionQuery** — new `billing/queries/get-subscription/{query,handler,handler.ispec}.ts` (`GetSubscriptionHandler` delegates to `SubscriptionService.getActive`, maps to `SubscriptionView | null`). `SubscriptionService` dropped from `billing.module.ts` `exports` (nothing outside billing imported it) + `SubscriptionService.isPremium` removed (dead); `getActive`'s `em.find` gained `disableIdentityMap: true`. `BillingService.getActiveSubscription` routes through `queryBus`; `isPremium` derives from it. ispec: `get-subscription.handler.ispec.ts` (null / running / lapsed + not-instanceof-`Subscription`).
- [x] **disableIdentityMap (DP2)** — added `{ disableIdentityMap: true }` to every `find`/`findOne` in the three `learning` query handlers (`get-profile`, `get-practice-queue`, `get-dictionary`) + `billing`'s `SubscriptionService`. db-performance.md DP2 + mikroorm.md updated. **Still owed** (deferred, not in this batch): the `post` query handlers (`get-feed`, `get-post-detail`, `get-grammar-construction`, `get-grammar-reference`) — noted in db-performance.md / mikroorm.md; low value (pure reads, tests clear the EM between ops), high line-count churn across a module outside this batch's scope. Suggest folding into Batch F or K.

### Batch F — web infra (D14, D17) — DONE (fix/batch-a-safety)
New deps: `@nestjs/throttler` ^6.5.0 + `@nest-lab/throttler-storage-redis` ^1.2.0. `pnpm run type` + `biome check src/ test/` + `pnpm test` (**108 files / 636 tests**, was 108/633) + `pnpm test:cov` gate green (stmts 88.3 / branches 73.6 / funcs 83.1 / lines 88.7). `pnpm build` regenerated `src/metadata.ts` (new content annotation DTO classes) — deterministic across rebuilds. `pnpm migration:check` green (no schema change).
- [x] **guard/interceptor placement** — `{ provide: APP_GUARD, useClass: SessionAuthGuard }` + `APP_INTERCEPTOR: ETagInterceptor` moved into `WebModule.forRoot` (`web.module.ts`), which now also imports `ConfigModule.forFeature(AuthConfig)` + `AuthModule` + `WebThrottlerModule`. `auth-web.module.ts` no longer registers the guard. Every `WebModule.forRoot(subModules)` composition is now authenticated regardless of which sub-modules it gets. Fallout: the `etag.interceptor.ispec` fixture controller gained `@Public()` (it only exercises the interceptor).
- [x] **`/api` prefix (D14 #33)** — `setGlobalPrefix('api', { exclude: [{ path: '_healthz', method: RequestMethod.ALL }] })` in the new `configureApp`. `build-openapi-document.ts`: `.addServer('/api')` + `createDocument(…, { ignoreGlobalPrefix: true })` (paths stay `/feed`, server re-adds `/api`, no `/api/api`). `e2e-suite.helper.ts` `request()` prepends `/api` (except `/_healthz`) so the 50 existing web requests need no edits; +1 ispec asserts bare `/feed` 404s and `/api/feed` 200s.
- [x] **throttler (D14 #35)** — `src/entrypoints/web/throttler/web-throttler.module.ts`: `ThrottlerModule.forRootAsync` with `ThrottlerStorageRedisService(REDIS_CLIENT)`, config `src/core/config/throttler.config.ts` (`THROTTLE_TTL_MS` 60000 / `THROTTLE_LIMIT` 300). Own `APP_GUARD: ThrottlerGuard`, imported first in `forRoot` so it runs before `SessionAuthGuard`. `skipIf: () => isTestEnvironment()` — the integration suites share one Redis DB and run `isolate:false`, so a live window would flake unrelated specs; guard still constructed + `canActivate`-exercised in every web ispec (always-allow). No dedicated throttle ispec (see NOTE). security.md rate-limit row + http-api.md updated.
- [x] **response-DTO decoupling + envelope (D14 #36)** — new `core/http/dto/offset-page.ts` (`OffsetPage<T>` + `toOffsetPage`); `FeedResponseDto implements OffsetPage<FeedItemDto>`. `ContentController` maps every view → DTO through explicit `to<X>Response` functions (no structural passthrough). `post-detail-response.dto.ts` re-declares the annotation shapes as local classes (`PostWordAnnotationDto`/`PostPhraseAnnotationDto`/`PostGrammarAnnotationDto`/`PostGrammarUsagePointDto`) — no more `*View` imports. **Partial:** `doc` still typed via a `type`-only import of the domain `Doc` (standalone structural copy → Batch K); `practice` (bare array) + `dictionary` (`{items}`) envelopes not converted (dictionary tied to D10/D12). Enum imports (`CefrLevel`/`ExerciseType`/`ExerciseSource`) kept deliberately — shared vocabulary. http-api.md H2 + sections updated.
- [x] **`/_healthz` indicators (D14 #39)** — `HealthController.check([...])` now runs `MikroOrmHealthIndicator.pingCheck('database')` + new `RedisHealthIndicator.pingCheck('redis')` (`internal/controllers/health/redis.health.ts`, uses `HealthIndicatorService` + `REDIS_CLIENT`); `@ApiTags('internal')` added; `RedisHealthIndicator` registered in `InternalWebModule`. health ispec asserts `info.database.status` / `info.redis.status` `up`.
- [x] **`HttpErrorFilter` `{ message }`** — `<500` bodies normalised to `{ message: string }` via `extractMessage(exception)` (string / `{message}` / `string[]`); no more Nest `{ statusCode, message, error }` leak on guard 401s / `NotFoundException`. +1 ispec asserts a 404 body `=== { message: 'Post not found' }`.
- [x] **query blank-param fix** — `core/validation/coerce-query.ts` `queryParam(schema)` = `z.preprocess` mapping `null`/`''`/`undefined` → `undefined`; wrapped around every field in `feed-query.dto.ts`, `grammar-reference-query.dto.ts`, `practice-queue-query.dto.ts`. `?limit=` / `?cefr=` now fall through to the default/optional instead of 400. +2 ispec cases. validation.md "gotcha" section closed.
- [x] **`POST /learning/cards` → `@HttpCode(HttpStatus.OK)`** — `learning.controller.ts`; 3 ispecs updated (`learning`/`dictionary`/`profile` seed cards over HTTP) from `CREATED` → `OK`.
- [x] **`clearSessionCookie`** — now passes `{ path, httpOnly: true, secure: true, sameSite: 'lax' }` to mirror `setSessionCookie` — `auth/cookies/auth-cookies.helper.ts`.
- [x] **`configureApp(app)` (D17 #48)** — `src/entrypoints/web/configure-app.ts` owns global prefix + pipes + filters; called by both `main.ts` and `test/http/web/setup/create-app.helper.ts` (both stripped of the hand-copied stack; `main.ts` keeps Fastify plugins + Swagger). http-api.md "Bootstrap" section rewritten.

NOTE — no dedicated throttler ispec: a deterministic rate-limit test needs a low limit in one suite only, but the integration project runs `isolate:false` (shared module state) + one Redis DB, so a per-file `process.env.THROTTLE_LIMIT` override would leak. Left as a manual/prod check; wiring is type-checked and the guard runs (always-allow) in every web ispec.

### Batch G — telegram / cron (D15) — DONE (fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**109 files / 647 tests**, was 108/636: +1 file, +11 tests) + `pnpm test:cov` gate green (stmts 88.4 / branches 73.7 / funcs 83 / lines 88.8). `pnpm build` regenerated `src/metadata.ts` (`PostPublication.retryCount` — deterministic across rebuilds). `pnpm migration:up` + `pnpm migration:check` green.
- [x] **layering (#29)** — `git mv` `PollUpdatesService` + `PublishPendingService` (+ ispecs) → `telegram/services/shared/`; new `PruneTelegramUpdatesService` also there. `telegram.module.ts` providers/exports + `poll-updates.cron.ts` / `publish-pending.cron.ts` imports updated. Sanctioned pattern documented: `queue-jobs.md` (Cron pattern + Done Batch G), `architecture.md` (A2 + new A2a). Header comments on both services note the services/shared + own-flush rationale.
- [x] **failed publications (#30)** — new `post_publications.retry_count` col (`int not null default 0`) — `post-publication.entity.ts:45-49`, `Migration20260830130000`, snapshot hand-patched (17-line insert) + `src/metadata.ts` rebuilt. `PublishPendingService.run()` now selects `{ retryCount: { $lt: 5 }, $or: [{status: Pending}, {status: Failed, updatedAt: {$lte: now-5min}}] }` (`publish-pending.service.ts:39-58`); `publishOne` does `retryCount += 1` on a failed send (`:71`). `RetryPostHandler` re-selects `PostPublication` rows `status=Failed` for the post and resets them to `Pending` + `retryCount=0` + `errorMessage=null` (`published` rows untouched) — `retry-post.handler.ts:62-76`. ispec: `publish-pending` +3 (re-select after backoff / too-soon skip / attempt-limit stop) + retryCount assertion on the existing fail case; `retry-post.handler` +2 (failed→pending reset; published left alone).
- [x] **poll-updates ordering** — `row.processed = true` set + `em.flush()`ed **before** `dispatch()` (`poll-updates.service.ts:52-61`); `dispatch` no longer touches `processed`. mikroorm.md anti-pattern row added. ispec: +1 ("commits as processed before dispatch, so a failing command is not retried on re-delivery").
- [x] **poll-updates confirmation** — command runs in the `try` and only computes a `reply` string; the `sendMessage(reply)` is issued **after** the try (`poll-updates.service.ts:114-123`), swallow + `logger.warn` on failure. Error path unchanged (`return` after the error reply). error-handling.md E7 added. ispec: +1 ("does not reply 'Command failed' when only the confirmation send throws").
- [x] **/retry UUID validation** — `parse-command.ts` adds `UUID_RE`; a `/retry <non-uuid>` returns `{ kind: 'unknown' }` (→ the `UNKNOWN_COMMAND_REPLY`, which shows the correct `/retry <post_id>` form) instead of reaching `findOneOrFail`. security.md row struck. `parse-command.spec.ts` +1.
- [x] **no-op on empty adminUserId** — `PollUpdatesService.run()` returns early when `config.adminUserId === ''` (`poll-updates.service.ts:34-37`) — no poll, no audit rows. ispec: +1. queue-jobs.md "empty config" bullet updated.
- [x] **retention cron** — `PruneTelegramUpdatesService.run()` = raw `DELETE FROM telegram_updates WHERE created_at < now()-30d` (DP5, `em.getTransactionContext()`); `PruneTelegramUpdatesCron` `@Cron('0 3 * * *')` in `telegram-cron.module.ts`. Runs unconditionally (cleanup even after the bot is disabled). New `prune-telegram-updates.service.ispec.ts` (2 cases). security.md retention row struck; db-performance.md DP5 example added.

### Batch H — worker / cli (D16) — DONE (fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**109 files / 649 tests**, was 109/647: +2 tests) + `pnpm test:cov` gate green (stmts 88.46 / branches 73.73 / funcs 83.1 / lines 88.82). `pnpm build` + `git diff --exit-code src/metadata.ts` clean (no metadata change). `pnpm migration:check` green — no schema change in this batch.
- [x] **D16 (doc)** — `cqrs.md` "Sanctioned exceptions to Q2" gained a new **"Flush outside the CQRS path"** subsection: cron-poller services (`services/shared/*`, D15) + **CLI importer inline seeding** (`grammar-import-egp` / `grammar-import-irregular-verbs` / `words-import-frequency` build entities inline in `execute()` + own `em.flush()`; sanctioned for one-off/seed per PLAN §1; not refactored; `post ingest` contrasted as the through-`PostService` case). "only sanctioned exceptions" line reworded to "only … CQRS-handler exceptions" — `cqrs.md:44-60`.
- [x] `WORKER_QUEUES` string token → `Symbol('WORKER_QUEUES')` (mirrors `MAILER`) — `entrypoints/worker/worker.tokens.ts:1`. `worker.module.ts` (`provide: WORKER_QUEUES`) + `worker-registrar.service.ts` (`@Inject(WORKER_QUEUES)`) unchanged (symbol is a valid token). `queue-jobs.md` "Fixes owed" table emptied ("None outstanding") + new "Done (Batch H)" note — `queue-jobs.md:55-61`.
- [x] `post ingest --type` validation — `parseType` now checks `Object.values(PostType).includes(...)` and throws `InvalidCliFlagError('--type')` (mirrors `parseSourceType` / the `queue` commands) instead of the unchecked `return val as PostType` that let a bad `--type` surface as a raw `ZodError` — `post-ingest.command.ts:44-49`. `post-ingest.command.spec.ts` +1 case. **`parseTitle` kept** (not dropped): nest-commander registers an option only from its decorated `@Option` method, so removing it would remove the `--title` flag that `execute()` consumes; the identity body matches the sibling `parseAttribution` parser added in Batch D.
- [x] bootstrap crash logs `{ cause: err }` → `{ err }` so pino's error serializer fires — `cli.ts:13`, `cron.ts:37`, `worker.ts:35`. `error-handling.md` E4 row: dropped the `worker.ts:35` **bug** note, now "(fixed Batch H)" — `error-handling.md:24`.
- [x] `post ingest <file>` — `execute()` runs `await access(file)` before `readFile`; on failure throws the new `CliInputError('Ingest file not found: <path>')` (`entrypoints/cli/cli-input.error.ts`, sibling of `InvalidCliFlagError`) so a path typo reads as user error, not an ENOENT infra fault — `post-ingest.command.ts:76-84`. `post-ingest.command.spec.ts` +1 case (`access` rejects → `CliInputError`, `readFile`/`ingest` not called; `access` reset in `beforeEach`).
- [x] **(deferred to Batch O)** `worker.ts` / `cron.ts` SIGTERM handler could call `app.close()` twice when the first rejects — done in Batch O via the shared `closeOnce(app)` helper.

### Batch I — tests (D17) — DONE (fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**115 files / 677 tests**, was 109/649: +6 files, +28) + `pnpm test:cov` gate green — coverage rose across the board (stmts 88.46→89.61 / branches 73.73→75.04 / funcs 83.1→85.54 / lines 88.82→90.01). `pnpm build` + `git diff --exit-code src/metadata.ts` clean. `pnpm migration:check` green — no schema change. `nlp-service` pytest: 8 passed.
- [x] **shared fakes** — new `test/fakes/{ai,nlp,mailer,telegram,pg-boss}.fake.ts`, one `implements`-checked class per port (telegram via `implements Pick<TelegramClientService, …>` — no port interface, D9). Migrated all 7 in-scope bespoke fakes: `FakeNlpClient` (spacy-parse + annotate → one whitespace-tokeniser taking an overrides map), `FakeAiClient` (annotate/assess-complexity/generate-exercises/tag-grammar → one class with settable `onComplete` / `onCompleteStructured`; default throws), `FakeTelegramClient` (poll-updates + publish-pending → one merged class). `login-with-google`'s inline `FakeGoogleIdTokenVerifierService` left inline (not a `core/*` port). `test/fakes/*.fake.ts`; T1/T1b in `tests.md` added.
- [x] **Redis isolation** — `redis.config.ts` gained `db` (`REDIS_DB`, default 0); `.env.test` sets `REDIS_DB=1`; `redis.provider.ts` passes it. `useOrmSuiteLifecycle(getOrm, getRedis?)` now runs `redis.flushdb()` in `afterEach` (both `createIntegrationSuite` + `createWebE2ESuite` pass the getter). `auth.controller.ispec.ts` manual `otp:ip:*` cleanup `beforeEach` deleted (redundant). `tests.md` T6 rewritten.
- [x] **direct specs** — `core/ai/anthropic-client.service.spec.ts` (10 cases: text-join, `max_tokens` truncation on both methods, `$schema` strip, forced-tool extraction + missing-tool error, adaptive-thinking allowlist, cost math incl. unknown-model `undefined`); `entrypoints/worker/post/post-processors.spec.ts` (parametrised — all 6 pipeline processors: stage mapping + `PostService` delegation); `entrypoints/worker/auth/send-challenge-email.processor.spec.ts`; `modules/auth/services/shared/challenge-mailer.service.spec.ts` (render + send via `FakeMailer`, transport-error propagation); `modules/learning/services/card-limit.service.ispec.ts` (below/at cap, premium bypass); `modules/learning/services/skill-progress.service.ispec.ts` (unlock idempotent, unknown point no-op, streak bump/reset, `masteryScore` never written — D11).
- [x] **coverage gate** — verified green directly, not just transitively; thresholds unchanged (80/80/70/80), actuals now 89.6/75.0/85.5/90.0.
- [x] **dead code** — deleted `test/helpers/factory.helper.ts` (`maybe`), removed `@faker-js/faker` (devDep, lockfile), dropped `makeChangeSet` / `makeFlushArgs` from `test/helpers/orm.helper.ts` (kept `injectOrm`).
- [x] **`authed` flag** — removed (not "implemented"): web auth is cookie-based, there was never a `TEST_TOKEN`; `RequestOptions` + the `options` param dropped from `createWebE2ESuite.request`, `{ authed: false }` stripped from ~24 call sites (all were no-ops).
- [x] **hookTimeout + PG_BOSS stub** — `vitest.config.ts` integration project gets `hookTimeout: 60_000`. `createIntegrationSuite` installs `createFakePgBoss()` (`test/fakes/pg-boss.fake.ts` — a Proxy returning async no-ops; `then` left undefined so Nest's async DI doesn't treat it as a thenable and hang) by default; `{ realPgBoss: true }` opt-out for `outbox-sender.service.ispec.ts` (reads `pgboss.job`). `tests.md` T7 updated.
- [x] **nlp-service pytest (D17)** — `nlp-service/test_app.py` (8 cases: `/health`, empty-text 422, offset round-trip for 4 texts incl. whitespace, multi-sentence sentence-relative offsets, documented `Swimming` example). `nlp-service/requirements-dev.txt` (`pytest==8.3.4`). New CI job `nlp-service` in `.github/workflows/app.yaml` (`setup-python@v6` 3.14 → `pip install -r requirements-dev.txt` → `pytest -q`). README "Tests" section added.

### Batch J — PLAN.md + docs (DONE 2026-08-30)
- [x] §5 — dropped the "fetch" step; rewrote the stage list to match the real DAG (spacy_parse → fan-out annotation + ai_complexity → ai_grammar → ai_exercises → publish) + idempotency/`/retry` notes
- [x] §6 + §12 — documented rare-delimiter (`⟦⟧` + `{{}}`) + reconstruct-and-compare; PUA escaping marked NOT implemented / not needed; example updated to the real format
- [x] §3.7 — `stage` list without `fetch`, `+annotation`; `running` marked derived (`started_at ∧ !completed_at`); note that `Failed`/`error_message`/`retry_count` aren't written yet (D4)
- [x] §3.3 — `cefr_level` moved to `word_definitions` in the schema block + a post-review note (D12)
- [x] §3.9 — `update_id` (was `telegram_message_id`), `raw_payload` (was `raw_payload_json`), `/add <text>` (was `/add {link}`) + "pasted text, not URL" note
- [x] §13 — annotated the `§6` and `§3.3` audit rows; added a new **§13a Пост-рев'ю кодбази** section pointing at `.claude/skills/engofy/` with the top unresolved items table
- [x] §3.2 `attribution_text`/`source_type` — resolved in code by Batch D; PLAN Part I needs 0 edits (§3.2 already contains the spec block). Closed in Batch K cleanup.
- [x] §3.5 `review_logs` `created_at` — resolved in code by Batch D (code-only column drop; never in the §3.5 spec block). PLAN Part I needs 0 edits. Closed in Batch K cleanup.

### Batch K — misc cleanup / consistency (DONE 2026-08-30, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**124 files / 737 tests**, was 115/677: +9 files, +60) + `pnpm test:cov` gate green — coverage rose (stmts 89.61→89.99 / branches 75.04→76.15 / funcs 85.54→86.44 / lines 90.01→90.34). `pnpm build` + `git diff --exit-code src/metadata.ts` clean (enum-syntax change is a no-op for metadata). `pnpm migration:check` green — no schema change in this batch.
- [x] **converters — link `href` allow-list** — new `isSafeLinkHref` (`core/helpers/url.helper.ts`): only absolute `http(s):`/`mailto:` pass; `javascript:`/`data:`/relative/unparseable are rejected. `wrapLink` in both `html-to-doc.converter.ts` + `markdown-to-doc.converter.ts` now degrades an unsafe-href `<a>`/`[]()` to a plain text node (keeps the visible text; also keeps the stored tree valid — `parseLinkNode` demands a non-empty href). `.spec` +3 (html js: degraded, html mailto: kept, md js: degraded) + `url.helper.spec` +3. security.md "known weaknesses" row struck.
- [x] **`html-to-doc` block scan → top-level only** — `querySelectorAll('p, h1..h6, ul, ol')` (any depth) replaced with `collectBlockElements(root.childNodes)`: descends through non-block wrappers (`<div>`, `<section>`) but stops at the first block on each path, so a `<ul>`/`<ol>` nested inside a `<li>` is no longer *also* emitted as its own top-level list (was duplicating its content). `.spec` +2 (nested `<ul>` → one list block; block inside wrapper `<div>`s still found).
- [x] **D13: `detectGerund` stop-list** — `LEXICALISED_ING_NOUNS` (~24: morning, evening, ceiling, building, meeting, wedding, feeling, warning, opening, beginning, painting, drawing, meaning, setting, ending, thing, nothing, something, everything, anything, spring, string, king, ring) short-circuits the `NN` branch only — a confident `VBG` tag still wins. `build-sentences.ts`; `build-sentences.spec` +3 ("Morning"/"Nothing" not flagged; stop-listed lemma still flagged when tagged `VBG`). nlp.md N3 + Fixes-owed row updated.
- [x] **`resolve-session.dto.ts`** — `token` → `sessionToken`, `z.string()` → `z.string().min(16)`. Updated: dto, `resolve-session.command.ts` (`import type` for the DTO), `resolve-session.handler.ts` (`dto.sessionToken`), `auth.service.ts` (`import type`), `session-auth.guard.ts` (`{ sessionToken: token }`), `resolve-session.handler.ispec.ts` (4 call sites). style.md naming-drift row struck.
- [x] **`session.service.create()` — drop `async`** — no `await` in the body (`em.create` is sync); now `create(userId: string): string`. Call sites in `complete-login.service.ts` (×2) + 2 ispecs had their now-redundant `await` removed; still type-compatible. findings-log `[auth] style` row struck.
- [x] **entity `@Enum(() => X)` → `@Enum({ items: () => X })`** — the last 3 shorthands: `post-part.entity.ts` (`kind`), `post-pipeline-run.entity.ts` (`stage`), `word-definition.entity.ts` (`pos`). No-op for schema — verified: `pnpm build` → `git diff --exit-code src/metadata.ts` clean, `pnpm migration:check` green. style.md ST8 + mikroorm.md E6 updated (no drift left).
- [x] **`node-tree.type.ts` → `node-tree-json.type.ts`** — `git mv`; **zero import updates** (nothing imports `NodeTreeType` — it's the dead drop-in for a future `Post`-level tree column, kept per instruction). Resolves the `node-tree.type.ts` vs `node-tree.types.ts` trailing-`s` confusion. style.md naming-drift row struck.
- [x] **shared `slugify`** — new `core/helpers/slug.helper.ts` `slugify(input, { maxLength? })` (NFKD + combining-mark strip + lowercase + `[^a-z0-9]+ → -` + trim `-` runs). `generateSlug` → `slugify(title, { maxLength: 80 })`; `grammarConstructionSlug` → `slugify(\`${category} ${subcategory}\`)`. Behaviour preserved (existing `egp.spec` grammar-slug cases still pass; `parse-slug-id` is a shortId *parser*, not a slug generator — left alone). New `slug.helper.spec.ts` (6 cases) + `generate-slug.spec.ts` (5). style.md naming-drift row struck.
- [x] **`post/domain/span-range.ts`** — `SpanRange` + `spansOverlap` (half-open) + `contains`. Replaced the private `overlaps`/`spansOverlap` copies in `resolve-phrase-overlaps.ts` + `resolve-word-phrase-overlaps.ts`, the inline containment checks in `drop-spans-crossing-node-boundaries.ts` + `splice-spans.ts`, and the sorted-sweep predicate in `validate-annotations.ts` (`spansOverlap(previous, current)` — provably identical given the start<end invariant `validateOffsets` enforces first). New `span-range.spec.ts` (10 cases). style.md naming-drift row struck.
- [x] **`get-feed` comment** — the false "stable offset pagination" comment in `get-feed.handler.ts:12-15` replaced with the truth (every publish shifts the `publishedAt desc` window → a client `?offset=` can double-see or skip an item) + a `TODO` for keyset on `(publishedAt, id)` (the query already `orderBy`s that exact tuple). Full keyset is a deferred feature, not this batch. db-performance.md "unbounded reads" row updated.
- [x] **missing domain / core-helper specs** — `collect-spans.spec.ts`, `generate-slug.spec.ts`, `generate-short-id.spec.ts` (documents the `byte % 62` modulo bias + the no-retry-on-`@Unique` insert as an accepted weakness — huge id space, `@Unique` on `posts.short_id` is the real guard), `annotation-prompt.spec.ts`, `upsert-phrase-id.ispec.ts` (raw case-insensitive upsert needs PG — `PostModule` suite: insert / CI-text conflict returns same id / original `type` untouched), `core/database/helpers/{change-set,request-context}.helper.spec.ts`. tests.md "coverage gaps" rows struck.
- [x] **`services/` vs `services/shared/` audit** — swept `auth`/`post`/`learning`/`billing`/`telegram`. **No discrepancies.** All 4 `services/shared/*` are imported from an entrypoint; every non-shared service is imported only within its own module (`SubscriptionService` already left `services/` + dropped from `exports` in Batch E). Recorded as a new "A2 audit (Batch K)" row in architecture.md.
- [x] **`ConfigModule.forFeature` "variadic"** — NOT a real fix: `@nestjs/config`'s `forFeature(config)` takes a **single** factory (verified in the installed `dist` — extra args are silently dropped). `auth.module.ts`'s three `forFeature(X)` calls are correct, not drift. style.md ST10 rewritten to say so.

### Batch L — Wave 3 cross-cutting, first pass (DONE 2026-08-30, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**124 files / 737 tests**, unchanged) + `pnpm test:cov` gate green — coverage unchanged (stmts 89.99 / branches 76.15 / funcs 86.44 / lines 90.34): the code changes are exercised by existing specs, no new logic branch. No entity/enum touched → no `pnpm build` / `migration:check` needed.
- [x] **DP2 — `post` query handlers** — `{ disableIdentityMap: true }` added to every `find`/`findOne`/`findAndCount` in `get-feed`, `get-post-detail`, `get-grammar-construction`, `get-grammar-reference` (~15 sites). Closes the last DP2/M7 gap — `post` now matches the `auth`/`learning` baseline. `mikroorm.md` "disableIdentityMap" + `db-performance.md` DP2 "Still owed"/"Gap" markers struck; findings-log row struck.
- [x] **queue DB creds (D18 partial)** — `core/queue/config/queue.config.ts` fallback defaults `postgres/postgres` → `engofy/engofy` (+ a comment), so an env-less local run can't split creds from the ORM. Full "one config object" left undone (low value now vars + defaults match). `config.md` "Known issues" row + findings-log row updated.
- [x] **`draft/lib/split-sentences.ts`** — header referenced a removed `split-text-for-annotation.ts`; rewritten to state prod segments via spaCy and the harness keeps its own splitter deliberately. findings-log row struck.
- [x] **D-decision coverage in `references/*.md`** — added the three that were unreferenced: **D9** (hexagonal port = canon for new `core/*` adapters; the other 2 styles grandfathered) → `architecture.md` `core/*` section rewritten (was "unresolved — open q21"); **D10** (read-only cross-module `em.find` from a **query** handler is sanctioned) → new `architecture.md` A8 + `db-performance.md` DP2; **D11** (derive at read time, don't write-cache) → new `db-performance.md` DP6. `architecture.md` A7 annotated with D2's Batch E state; stale "Full review pending wave 2" line removed.
- [x] **`config.md` C3** — said `forFeature` is "variadic — one call for several"; corrected to "one call per namespace" to match the Batch K `style.md` ST10 finding.
- [x] **"fix owed" rows closed by earlier batches but still open in references** — `mail.md` "Fix owed (tests)" → done (Batch I: `mailer.fake.ts` + `challenge-mailer.service.spec.ts`); `nlp.md` "Fixes owed" `app.py` no-tests → done (Batch I: `test_app.py` + CI job); `ai.md` "Fixes owed" `AnthropicClientService` no-spec → done (Batch I). `config.md` token-style + `.env.test`-vs-CI rows refreshed (WORKER_QUEUES is now a Symbol; the DB-name split is intentional, not drift). Matching findings-log rows struck.

### Batch M — Wave 3 cross-cutting, second pass (DONE 2026-08-31, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**124 files / 739 tests**, was 124/737: +2 nlp-boundary specs) + `pnpm test:cov` gate green — coverage nudged up (stmts 89.99→90.02 / branches 76.15→76.18 / funcs 86.44→86.46 / lines 90.34→90.37). No entity/enum touched → no `pnpm build` / `migration:check` needed.
- [x] **DI tokens → `Symbol()`** — `PG_BOSS`, `REDIS_CLIENT`, `S3_CLIENT` (`*.tokens.ts`) converted from string constants to `Symbol('…')`. Consumers import the const, so zero call-site churn; no string-literal token usage anywhere (grep-verified). Every DI token in the codebase is now a `Symbol`. `config.md` + `architecture.md` + findings-log rows struck.
- [x] **`@CurrentUser()` → 401** — the decorator threw a bare `Error` (→ 500) when `actor` was missing; now `UnauthorizedException`. Defence-in-depth (the global guard 401s first in every real flow), so no dedicated spec — a `@Public()` route using `@CurrentUser` would be self-contradictory. `core/decorators/current-user.decorator.ts`.
- [x] **`Sentry.tracesSampleRate`** — was `1` (100%) everywhere; default is now `0.1` in production, `1` elsewhere. `SENTRY_TRACES_SAMPLE_RATE_<ENTRYPOINT>` still overrides; error `sampleRate` stays `1`. `sentry.ts`. security.md row struck.
- [x] **`PUBLIC_URL` / CORS** — `origin: undefined` + `credentials:true` made `@fastify/cors` reflect any Origin. `main.ts` now throws in production when `PUBLIC_URL` is unset; in dev it falls back to `^http://(localhost|127.0.0.1)(:\d+)?$`, never `undefined`. security.md + config.md rows struck.
- [x] **`S3_CORS_MAX_AGE`** — `corsMaxAge` dropped from `s3.config.ts` (bucket CORS is an infra/bucket-policy concern, nothing in-app applied it; `envNumber` import removed). `S3_PUBLIC_URL` left as a CI/env-only var. config.md row struck.
- [x] **`supportsAdaptiveThinking` → allowlist** — was `!model.includes('haiku')` (a denylist that would 400 on any older/unknown id). Now an explicit `ADAPTIVE_THINKING_MODELS` allowlist (sonnet-5 / opus-5 / fable-5 / sonnet-4-6 / opus-4-6/-4-7/-4-8). `anthropic-client.service.spec.ts` case extended to assert Haiku *and* a pre-4.6 id get no `thinking` block. ai.md "Fixes owed" row struck.
- [x] **`http-nlp-client` boundary check** — `response.json()` was cast `as NlpParseResult` with no validation. New `assertParseResult()` checks the `sentences` array + each entry's `text`/`start`/`end`/`tokens` and throws a clear error at the boundary instead of a `TypeError` deep in `buildSentences`. `http-nlp-client.service.spec.ts` +2. nlp.md row struck.
- [x] **draft idiom-harness fidelity** — `annotateUnit` ran `maxTokens: 8000` vs prod `16000` and never checked `stopReason`. Now sends `MAX_TOKENS = 16000` and records `truncated` from a `max_tokens` stop on either call; `compare.ts` / `snapshot.ts` / `run.ts` surface + count `truncated` as a hard failure (parity with the grammar harness). `draft/` is outside the CI biome/type gate but `pnpm run type` covers it and stays clean.

### Batch N — Wave 3 cross-cutting, third pass (DONE 2026-08-31, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**124 files / 741 tests**, was 124/739: +2 parse-annotation-tags specs) + `pnpm test:cov` gate green — coverage nudged up (stmts 90.02→90.03 / branches 76.18→76.22 / funcs 86.46→86.49 / lines 90.37→90.38). `pnpm build` + `git diff --exit-code src/metadata.ts` clean (`@ApiCookieAuth` + the command type change don't touch metadata). No entity/enum touched → no `migration:check` needed.
- [x] **`IngestPostCommand` → view (D2 tail)** — new `post/types/ingested-post-view.type.ts` (`IngestedPostView` = `id` / `shortId` / `status` / `format`, `toIngestedPostView(post)`). `IngestPostCommand extends Command<IngestedPostView>`; handler returns the view; `PostService.ingest` retyped. CLI `post ingest` logs `post.format` (was `post.source.format`); telegram `/add` reply already used `post.shortId`. `ingest-post.handler.ispec` reloads the `Post` for `source.*` assertions; `post-ingest.command.spec` mock returns the flat shape. `cqrs.md` Q6 + `architecture.md` A7 updated (D2 now fully done). findings-log row struck.
- [x] **`parse-annotation-tags` identical-form offset** — `resolveOffset()` prefers `reconstructed.length` (the position the token *should* sit at) when the fragment is exactly there and reconstruction is still aligned, so a tag on the 2nd of two identical forms no longer resolves to the 1st, untagged one; `cursor` stays the hard search floor so a drifted `{{}}` still lets later tags resolve. `.spec` +2 (2nd-of-two; both-tagged land on their own positions). findings-log row struck.
- [x] **`@ApiCookieAuth()`** — class-level on `LearningController` / `BillingController` / `DictionaryController` / `ProfileController`; method-level on `AuthController.me` (the one authed route of an otherwise-`@Public()` controller). Matches the `.addCookieAuth(sessionCookieName)` scheme already in `build-openapi-document.ts`. New `http-api.md` H8a. findings-log row struck.
- [x] **pipeline stage-comment fix** — `tag-grammar.handler.ts` / `generate-exercises.handler.ts` header comments said "runs after spacy_parse"; now "consumes spaCy output from spacy_parse; in the DAG it is the stage after ai_complexity / ai_grammar". findings-log row struck.
- [x] **`PostDetailResponseDto.doc` — decision, not a fix** — `doc` stays a `type`-only import of the dependency-free domain `Doc`: it's wire-contract data deliberately shared with the SSR renderer, not an internal query view, and re-declaring ~90 lines of recursive discriminated unions would be fragile + worse OpenAPI. Comment + `http-api.md` + findings-log updated to record the call.

### Batch O — Wave 3 cross-cutting, close-out (DONE 2026-09-01, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**125 files / 748 tests**, was 124/741: +1 file `close-once.helper.spec`, +7 tests) + `pnpm test:cov` gate green — coverage flat (stmts 90.03→90.04 / branches 76.22→76.41 / funcs 86.49→86.46 / lines 90.38→90.41). No entity/enum touched → no `pnpm build` / `migration:check` needed. (Committed in two parts: `resolve batch o` + a `tail` commit for the two low-priority findings-log clean-ups.)
- [x] **D18 — `challenge.service` outbox atomicity** — `ChallengeService.issue` moved off immediate `em.upsert` to `findOne`-then-mutate-or-`em.create` (deferred): the OTP challenge row now commits in the same facade flush as the challenge-email outbox job. Repeated `/auth/login` for the same address still replaces the pending challenge in place (fresh OTP, `attempts = 0`); the rare parallel-login race loses one request to `unique(email)` on flush (commented, mirrors `complete-login`'s googleSub race). `challenge.service.ispec` +2 (in-place replace; deferred-not-immediate). `cqrs.md` Q3–Q5 + `error-handling.md` E8 updated; Medium findings-log row struck.
- [x] **`worker.ts` / `cron.ts` double `app.close()`** — new `src/entrypoints/close-once.helper.ts` `closeOnce(app)` memoises the first close's promise; both entrypoints route the SIGTERM/SIGINT handler *and* the outer `catch` through it, so a rejected signal-handler close no longer triggers a second teardown from the catch. `close-once.helper.spec.ts` (3 cases: single close across callers, same rejection re-handed, no-op when app never booted). findings-log `[worker/cli] low` clause struck; Batch H deferred `[ ]` → `[x]`.
- [x] **module-level `/g`/`/y` regex cursors** — `parse-annotation-tags.ts` / `parse-grammar-tags.ts` build their scan regex fresh per call (`buildTokenRe` / `buildTrailerRe`; grammar threads the instance through `consumeClose`), removing the shared mutable `.lastIndex`. Negligible cost — one compile per post-annotation stage, dwarfed by the model call. Existing parser specs cover behaviour unchanged; `ai.md` inline-markup round-trip section + `[core-ai] style` findings-log row updated.
- [x] **`ETagInterceptor` / `@CachePolicy()` (user decision — option a)** — class-level `@CachePolicy('public')` on `ContentController` (every route there is an anonymous cacheable GET): `feed` / `posts/:slugId` / `grammar` / `grammar/:slug` now emit `Cache-Control: public` + a SHA-1 content ETag and answer a matching `If-None-Match` with 304. `content.controller.ispec` +1 (`Cache-Control` + ETag + 304 revalidation). `http-api.md` H9 + `[web] http-api` findings-log row updated.
- [x] **downstream AI re-call on retry (open q9 — user decision: accept + document)** — `ai_complexity`/`ai_grammar`/`ai_exercises` re-calling the model on a `Failed`/`Pending`/absent `PostPipelineRun` (then `nativeDelete`+re-write) is a **deliberate full recompute of that stage**, the pipeline-level analogue of `/retry` (P10 / D5). A failed stage rolls its writes back (P3a) so there is no trustworthy partial output to gap-fill; the `Completed` short-circuit already blocks any re-call after success; the extra paid call on a transient failure is bounded. No code change — `pipeline.md` P6a + Known-gaps note, open q9 resolved, `[post] pipeline/ai` findings-log row struck.
- [x] **tail — two low-priority findings-log clean-ups** — (1) `[auth] cqrs/observability` `resolve-session` unawaited-`refresh` row struck: it was actually fixed in Batch A (`await this.sessions.refresh(...)`, no floating `.catch`) but never marked. (2) `[core-ai] style` `grammar-prompt.ts` double whitespace normaliser: `buildGrammarUserText` now emits `normalizeInlineWhitespace(text).normalized` so the prompt side and the parse-side reconstruct-and-compare share one normaliser; the `map[...] ?? span.charStart` fallback is now an explicit throw (an out-of-range offset from `parseGrammarTags` is a bug, not something to paper over); `NUMBERED_MARKER_RE` localised to `buildNumberedMarkerRe()` (last module-level cursor regex). `grammar-prompt.spec` +1.

### Batch P — findings-log reconciliation + small safe fixes (DONE 2026-09-01, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**125 files / 749 tests**, was 125/748: +1 `build-token-annotations` case) + `pnpm test:cov` gate green (stmts 90.05 / branches 76.47 / funcs 86.49 / lines 90.43). `pnpm build` + `git diff --exit-code src/metadata.ts` clean (new error class isn't in metadata). No entity/enum touched → no `migration:check` needed.
- [x] **findings-log reconciliation** — swept the whole "Findings log": ~35 findings that Batches A–O actually closed but never struck (High: mikro-orm.logger breadcrumb, retry-post no-op; Medium: no-Failed-run-row, 7/8-handler flush, publish-not-gated, redis error listener, DomainError→status, mail fallback, sonnet-5 pricing, completeStructured stop_reason, adaptive-thinking, PUA/PLAN staleness; Low: Fetch stage, queue singleton copy-paste, http-error.filter shape, migration:check, node-tree parser wiring, grammar-match unique, PostSource attribution, telegram cluster ×5, web guard placement + throttler + 429 + error shape + /api prefix + request-DTO home, worker queue authority + retry/deadLetter + allSettled, cli parseType + importer layering, test cluster ×8, learning/billing cluster) now carry `~~…~~ **fixed (Batch X)**` with the batch + reference. Compound bullets edited sub-clause by sub-clause. Genuinely-open items left standing.
- [x] **`[auth] complete-login` googleSub race** — accepted for MVP, now carries the explaining comment (`loginByGoogle`): backfilling a `@Unique` `googleSub` onto an email-first row can hit the constraint if the Google email later changes; rare, recoverable by retry.
- [x] **`[post-data] build-token-annotations` map miss** — `phraseText: … ?? ''` (which `validatePhraseShape` then rejects with a misleading shape error) replaced by `resolvePhraseText()` throwing `MissingPhraseTextError(phraseGroupId)` — a `sentence_token` pointing at a phrasal-verb group with no `Phrase` row now fails with its real cause. New `errors/missing-phrase-text.error.ts`; `build-token-annotations.spec` +1.

**Still open — the deferred backlog (post-Batch-P, accurate list):**
| # | Item | Why deferred |
|---|---|---|
| 1 | `get-dictionary` unbounded read — loads every published post + all parts + walks every node-tree span per request | Needs the `post_word` / `post_phrase` projection (or `sentence_tokens.word_id`/`phrase_id` join): new schema + migration + backfill. Self-contained but large. Folds in `[learning] architecture` cross-module reads + `post_word`/`post_phrase` from `[post-data] spec drift`. |
| 2 | `complete()` non-streaming (~114 s/call → SDK 10-min timeout risk). ~~+ no `cache_control` on the large static system prompts~~ **cache_control done (Batch R)** — `toSystemParam()`, grammar-stage retry reads from cache. | Perf; streaming touches AI3 (`stop_reason`) + AI4 (usage log) + the reconstruct-retry loop — deferred as the risky half. `ai.md` "Fixes owed". |
| 3 | List envelopes: `practice` bare array, `dictionary` `{items}` → `{items,nextOffset}` | Breaking wire change; `apps/web` (in-repo Astro) consumes them — must land backend + frontend together, and `apps/web` is outside the tsc/biome gate + Playwright not in CI. |
| 4 | `ContentController` `@Controller()` with no path prefix (owns top-level `feed`/`posts`/`grammar`) | Breaking route change; same `apps/web` coordination as #3. |
| ~~5~~ | ~~No direct `.ispec.ts` for `post` query handlers + `get-dictionary`~~ | **done (Batch Q)** — `get-feed` / `get-post-detail` / `get-grammar-construction` / `get-grammar-reference` / `get-dictionary` each have a `.handler.ispec.ts` (12 cases). |
| 6 | `apps/web` Playwright + `seed-web-e2e.ts` not in CI; prod nginx `/api` proxy; `apps/web` deploy | Infra, non-checkbox. |
| 7 | Low nits — **partly done (Batch Q):** ~~"long-polling" comment~~, ~~`telegram-client.service.spec.ts`~~, ~~`DictionaryController` no `toDto`~~. **Left (all cosmetic / no user-facing effect):** telegram `429`/`retry_after` backoff + `TelegramApiError` + `updatedAt` (behaviour + migration, not a nit); `DateTime`→ISO done at handler vs controller depending on module; `queue-spy` positional match; `app.module.ispec.ts` never `.init()`s; `add-card.dto` `.refine` `path: []` (→ `field: null`, which the factory already handles correctly for a cross-field constraint — **not a bug**). |

### Batch Q — direct query-handler ispecs + low-nit cleanup (DONE 2026-09-01, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**131 files / 767 tests**, was 125/749: +6 files, +18) + `pnpm test:cov` gate green — coverage rose (stmts 90.05→90.55 / branches 76.47→78.14 / funcs 86.49→87.14 / lines 90.43→90.94). `pnpm build` + `git diff --exit-code src/metadata.ts` clean. No entity/enum touched → no `migration:check` needed.
- [x] **direct `.ispec.ts` for the 5 previously-uncovered query handlers** (deferred item #5): `get-feed` (published-only + `(publishedAt, id)` tie-break; `nextOffset` from total not page size; excerpt from leading blocks + word-boundary truncation), `get-post-detail` (null on unknown/non-published; doc reassembly + resolved word annotation + exercises), `get-grammar-construction` (null on unknown slug; usage points sorted by CEFR; construction level = easiest; category name), `get-grammar-reference` (categories in `sortOrder`; easiest CEFR + point count; CEFR filter drops non-matching constructions and emptied categories), `get-dictionary` (empty on no cards; word + phrase entries resolved; "appears in" from published-post spans, de-duped, drafts excluded, grammar cards excluded). 12 cases; all via `suite.query(new XQuery(...))` against the real module.
- [x] **`DictionaryController` explicit mapper** (nit) — was returning `learning.getDictionary()`'s `DictionaryView` structurally cast to the DTO; now `async` + `view.items.map(toDictionaryEntryDto)` with an explicit field-by-field mapper (matches `ContentController`'s `to<X>` style, so a view/DTO drift can't ride through silently). `dictionary.controller.ispec` unchanged (output identical).
- [x] **`telegram-client.service.spec.ts`** (nit) — first spec for `TelegramClientService`: `configured` flag, `getUpdates` short-poll body (`timeout: 0`, `allowed_updates`, offset omitted when absent), result unwrap, transport-failure wrap (`{ cause }`), API not-ok → throw with status + description, HTTP-200-but-`ok:false` → throw. `fetch` stubbed via `vi.stubGlobal`.
- [x] **"long-polling" comment fix** (nit) — `telegram-client.service.ts` header said "long-polling getUpdates"; `getUpdates` uses `timeout: 0` (short poll) — the once-a-minute cron is the interval. Comment corrected.
- [x] **`add-card.dto` `.refine` `path: []`** — reviewed, **not a bug**: `zodValidationExceptionFactory` maps an empty path to `field: null`, which is the right shape for a cross-field ("exactly one of …") constraint. No change.

### Batch R — AI prompt caching (deferred item #2, safe half) (DONE 2026-09-01, fix/batch-a-safety)
`pnpm run type` + `biome check src/ test/` + `pnpm test` (**131 files / 770 tests**, was 131/767: +3 cases) + `pnpm test:cov` gate green — coverage flat/up (stmts 90.55→90.56 / branches 78.14→78.17 / funcs 87.14→87.16 / lines 90.94→90.95). No entity/enum touched → no `pnpm build` / `migration:check` needed.
- [x] **`cache_control: { type: 'ephemeral' }` on large static system prompts (deferred #2, safe half)** — new `toSystemParam(system)` in `anthropic-client.service.ts`: a system prompt `>= CACHE_CONTROL_MIN_CHARS` (4000, ~Anthropic's 1024-token minimum cacheable prefix) is sent as `[{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]`; anything shorter passes through as the plain string unchanged (byte-identical request). Used in both `messages.create` calls (`complete` + `completeStructured`). In practice only `tag-grammar`'s prompt (`GRAMMAR_SYSTEM_PROMPT` preamble + full seeded `buildGrammarCatalog` — ~8 KB+) clears the bar, so its one-retry second identical call (fired seconds later when the first echo doesn't reconstruct) is billed at the cache-read rate instead of re-charging the whole catalogue; the annotation/complexity/comprehension prompts are all < 4000 chars and Anthropic would silently decline to cache them anyway. `cache_creation_input_tokens` / `cache_read_input_tokens` were already in the AI4 usage log. `anthropic-client.service.spec.ts` +3 (large prompt → cache breakpoint on `complete`; short prompt → plain string; large prompt → cache breakpoint on `completeStructured`). `ai.md` "Fixes owed" split — cache half **done**, streaming half still open. Findings-log `[core-ai] ai/performance` row + deferred-backlog #2 updated.
- **Deferred (still open, risky half of #2):** stream `complete()` — baseline calls ~114 s risk the SDK 10-min timeout; touches AI3 (`stop_reason` handling), AI4 (usage log from the final event), and the reconstruct-retry loop. Not in this batch.

## Findings log

_(populated from subagent reports as waves complete)_

### High

- ~~**[core] observability/security** — `core/database/mikro-orm.logger.ts:58-70`:
  `logQuery` adds a Sentry breadcrumb for **every** query with `message:
  context.query` (inlined bind params) plus `data.results` rows, never
  sanitised, before the `isEnabled` guard, in all environments.~~ **fixed
  (Batch A)** — `sanitizeSqlParams` on `context.query`, `results` dropped,
  emitted only when `context.query` present and prod-gated via
  `isProdEnvironment()`. `security.md` high row closed.

- ~~**[post] pipeline** — `commands/retry-post/retry-post.handler.ts`: `/retry`
  deletes only `PostPipelineRun` rows, but `spacy_parse` / `annotate` skip on
  row existence (`Sentence` rows / `annotatedAt`), not the deleted run → retry
  silently no-ops those two stages.~~ **fixed (Batch C, D5)** — `RetryPostHandler`
  now `nativeDelete`s `Sentence` / `SentenceToken` / `GrammarMatch` / `Sentence`-
  scoped rows / `Exercise` / `PostPipelineRun`, nulls every `PostPart.annotatedAt`,
  resets `posts.status`, re-enqueues only `spacy_parse`. `pipeline.md` P10;
  `retry-post.handler.ispec` +2.

### Medium

- ~~**[auth] cqrs/observability** — `commands/resolve-session/resolve-session.handler.ts:22`
  fires `this.sessions.refresh(...)` as a floating unawaited promise on every
  authenticated request; the write escapes the facade `em.flush()` and errors are
  swallowed (`.catch(() => undefined)`).~~ **fixed (Batch A)** — the handler now
  `await`s `this.sessions.refresh(dto.sessionToken)` (no floating `.catch`), so
  the sliding-expiry write rides the facade flush and a failure surfaces.
  `cqrs.md` "behavioural split" note already treats `resolveSession` as a
  sanctioned Command on a read path (D18 1/4). (Row was left un-struck when
  Batch A landed — closed in Batch O bookkeeping.)
- ~~**[auth] queue-jobs/mikroorm** — `services/challenge.service.ts:61` +
  `commands/request-login-code/request-login-code.handler.ts:29-35`: challenge row
  is written with `em.upsert` (immediate) *before* the email job is staged on the
  outbox and drained by the facade flush → row and job enqueue are not atomic,
  defeating the outbox pattern.~~ **fixed (Batch O)** — `ChallengeService.issue`
  is now `findOne`-then-mutate-or-`em.create` (deferred): the challenge row rides
  the same facade flush as the challenge-email outbox job. Repeated `/auth/login`
  still replaces the pending challenge in place (fresh OTP, `attempts = 0`); the
  rare parallel-login race loses one request to `unique(email)` on flush
  (documented, mirrors `complete-login`'s googleSub race). `challenge.service.ispec`
  +2 (in-place replace; deferred-not-immediate). `cqrs.md` Q3–Q5 + `error-handling.md`
  E8 updated.
- ~~**[post] error-handling/observability** — no stage handler ever writes
  `...Status.Failed` / `startedAt` / `errorMessage` / `retryCount`; a failing
  stage rolls back and leaves no run row, `PostStatus.Failed` never set.~~ **fixed
  (Batch C, D4)** — `JobWorkerHost` writes `Pending`+`startedAt` on entry and
  `Failed`+`errorMessage`+`retryCount++` in the catch, both on a forked em / own
  txn, and sets `PostStatus.Failed` on retry exhaustion. `pipeline.md` P3a.
- ~~**[post] cqrs** — 7 of 8 post handlers call `em.flush()` internally;
  redundant with the facade re-flush for `assess-complexity` / `tag-grammar` /
  `generate-exercises` / `publish` / `retry`.~~ **fixed (Batch A, D3)** — trailing
  flush dropped from those 5; `spacy-parse` + `annotate` per-`PostPart` flush
  documented as the 2 sanctioned exceptions in `cqrs.md`.
- ~~**[post] pipeline** — `publish` sets `status=Published` with no check that
  the parallel `annotation` fan-out branch finished.~~ **fixed (Batch C, D6)** —
  `PublishPostHandler` no-ops and re-queues a delayed `post-publish` until
  `PostPipelineRun(stage=Annotation, status=Completed)` exists. `pipeline.md`
  Stage-DAG note; `publish-post.handler.ispec` +2.
- ~~**[core] error-handling** — `core/redis/redis.provider.ts`: ioredis client
  created with no `error` listener; an emitted `error` crashes the process.~~
  **fixed (Batch A)** — factory attaches `client.on('error', …)` (Logger,
  mirrors pg-boss).
- ~~**[core] error-handling** — `DomainError` carries only a message; the filter
  maps the whole hierarchy to HTTP 400.~~ **fixed (Batch B, D1)** — `DomainError`
  2nd ctor arg `status = 400`; `DomainErrorFilter` honours it; `TooMany*` → 429,
  `CardNotFoundError` → 404. `error-handling.md` D1.
- ~~**[core] config**~~ — `queue.config.ts` had divergent fallback defaults
  (`postgres/postgres`) from the ORM (`engofy/engofy`): **addressed (Wave 3)** —
  both read the same `MIKRO_ORM_*` vars and the queue defaults now match
  `engofy/engofy`, so an env-less run can't split creds. Full "one config
  object" (D18) left undone — low value now the vars + defaults align.
- ~~**[core] mail** — no `RESEND_API_KEY` → falls back to MailHog SMTP; in
  misconfigured prod mail is silently dropped; `ConsoleMailerService` referenced
  nowhere.~~ **fixed (Batch A, D18)** — fallback chain Resend → `MAIL_USE_MAILHOG`
  → `ConsoleMailerService`; `isProdEnvironment()` → throw at bootstrap when none
  set. `mail.md` D18.
- ~~**[core-ai] ai/observability** — `sonnet-5` priced at `{input:3,output:15}`
  (Sonnet 4.6 rate); every `cost_usd` log + the committed baseline overstate
  ~50%.~~ **fixed (Batch A)** — `{input:2,output:10}` in `anthropic-client.service.ts`
  + `draft/lib/call-claude.ts`.
- ~~**[core-ai] ai/error-handling** — `completeStructured` never checks
  `response.stop_reason`; a truncated tool call surfaces as an opaque `ZodError`.~~
  **fixed (Batch A)** — throws the distinct `max_tokens` error before
  `tool.schema.parse`. `ai.md` AI3.
- ~~**[core-ai] ai/config** — `supportsAdaptiveThinking` only denylists `haiku`;
  a pre-4.6 `AI_MODEL` would be sent `thinking:{type:'adaptive'}` and 400.~~
  **fixed (Batch M)** — explicit `ADAPTIVE_THINKING_MODELS` allowlist; spec
  covers Haiku + a pre-4.6 id.
- **[core-ai] ai/performance** — non-streaming `messages.create`
  `max_tokens:16000` for whole-article echo-back (~114 s/call → SDK 10-min
  timeout risk → full paid stage re-run). Stream `complete()`. **← still open**
  (`ai.md` "Fixes owed"; deferred perf item). ~~large static system prompts
  re-sent uncached every call + retry (no `cache_control`)~~ **fixed (Batch R)**
  — `toSystemParam()` marks a ≥ 4000-char system prompt as an ephemeral cache
  breakpoint; the grammar stage's preamble+catalogue retry now reads from cache.
- ~~**[core-ai] ai/pipeline (stale PLAN)** — PLAN §6/§12 claim PUA escaping of
  `[]{}` "вже є"; not implemented, format changed.~~ **fixed (Batch J, D13)** —
  PLAN §6/§12 rewritten to the real rare-delimiter + reconstruct-and-compare
  approach; PUA escaping marked NOT implemented / not needed; literal `⟦⟧` in
  source noted unsupported.

### Low

- ~~**[auth] validation/style**~~ — resolve-session.dto: **fixed (Batch K)** —
  `token` → `sessionToken`, added `.min(16)`.
- ~~**[auth] style**~~ — `ResolveSessionDto` value-import: **fixed (Batch K)** —
  `import type` in `resolve-session.command.ts` + `auth.service.ts`.
- ~~**[auth] style**~~ — `services/session.service.ts` `create()` `async` with no
  `await`: **fixed (Batch K)** — now sync `create(): string`; call-site `await`s
  removed (still compatible).
- ~~**[auth] style**~~ — `auth.module.ts` three `ConfigModule.forFeature()` calls:
  **not a bug (Batch K)** — `@nestjs/config`'s `forFeature` takes a single
  factory (not variadic); one call per namespace is correct. style.md ST10 fixed.
- ~~**[auth] architecture** — `subscription.entity.ts` + its two enums live in
  `auth` but nothing in the module reads/writes them.~~ **fixed (Batch D, D12)** —
  `git mv`'d to `modules/billing/{entities,enums}/`; all imports rewritten;
  `SubscriptionStatus.Expired` removed (expiry is `currentPeriodEnd <= now` at
  read). Migration `120600`.
- ~~**[auth] mikroorm** — `loginByGoogle` backfills `user.googleSub` (`@Unique`)
  after an `onConflictAction:'ignore'` upsert; a Google email change could
  create a second row that violates the constraint on flush.~~ **fixed (Batch P)** —
  accepted for MVP, now carries the explaining comment (`complete-login.service.ts`
  `loginByGoogle`).

- ~~**[post] pipeline** — `PostPipelineStage.Fetch` / PLAN §5 step 1 has no
  handler and no run row.~~ **fixed (Batch C, D7)** — enum value removed (starts
  at `SpacyParse`); legacy `'fetch'` literal dropped from
  `post_pipeline_runs_stage_check` in `Migration20260830120000`; PLAN §5 step 1
  gone (Batch J).
- ~~**[post] pipeline/ai** — downstream AI stages (`assess-complexity`, `tag-grammar`,
  `generate-exercises`) re-call the model on every non-`Completed` run with no
  sub-result check, then wholesale delete/overwrite — not "gap-filler, not
  rewrite" (PLAN §12).~~ **fixed (Batch O)** — accepted + documented as
  intentional (option a, open q9). A stage retry is a full recompute of that
  stage — the same stance as `/retry` at the pipeline level (P10 / D5); a failed
  stage rolls its writes back (P3a) so there is no trustworthy partial output to
  gap-fill, and the `Completed` short-circuit already prevents any re-call after
  success. `pipeline.md` P6a + Known-gaps note; `ai.md` unchanged (round-trip
  section already covers it).
- ~~**[post] queue-jobs** — `{policy:'singleton', expireInSeconds:3600}`
  copy-pasted 6× in `post-queue-bootstrap.service.ts`; 1 h expiry tight for a
  retried `ai_grammar` on a long article.~~ **fixed (Batch C, D8)** — single
  `QUEUE_DEFINITIONS` map in `core/queue/queue-config.ts`; `PostQueueBootstrapService`
  is the only `createQueue` caller and loops it; per-queue `retryLimit` +
  `retryBackoff` + `deadLetter` (AI stages) live there too.
- ~~**[post] db-performance/cqrs**~~ — post query handlers loaded managed
  entities into the identity map for pure reads: **fixed (Wave 3)** —
  `{ disableIdentityMap: true }` added to every `find`/`findOne`/`findAndCount`
  in `get-feed` / `get-post-detail` / `get-grammar-construction` /
  `get-grammar-reference`, matching the `auth`/`learning` baseline (DP2).
- ~~**[post] cqrs**~~ — `ingest-post.command.ts` returned a live managed `Post`
  through `CommandBus` + facade: **fixed (Batch N, D2)** — new
  `post/types/ingested-post-view.type.ts` (`IngestedPostView` = `id` / `shortId`
  / `status` / `format` + `toIngestedPostView`); command → `Command<IngestedPostView>`,
  `PostService.ingest` retyped, CLI + telegram consumers use the flat fields.
  `ingest-post.handler.ispec` reloads the `Post` for `source.*` assertions.
- **[post] docs** — ~~`tag-grammar.handler.ts` / `generate-exercises.handler.ts`
  comments name the wrong predecessor stage~~ **fixed (Batch N)** — both now say
  "consumes spaCy output from spacy_parse; in the DAG it is the stage after
  ai_complexity / ai_grammar respectively".
  ~~`get-feed.handler.ts` "stable offset pagination" comment~~ — **fixed (Batch K)**:
  comment now states the drift + carries a `TODO` for keyset on `(publishedAt, id)`.
- ~~**[core] config**~~ — `s3.config.ts` `corsMaxAge` unused: **fixed (Batch M)**
  — dropped (bucket CORS is infra). `S3_PUBLIC_URL` stays a CI/env-only var
  (harmless, infra), not in `s3.config.ts`.
- ~~**[core] architecture**~~ — DI token style: **fixed (Batch M)** —
  `PG_BOSS`/`REDIS_CLIENT`/`S3_CLIENT` converted to `Symbol()`. Every DI token
  in the codebase is now a `Symbol` (`MAILER`, `WORKER_QUEUES` were already).
- ~~**[core] error-handling**~~ — `authorization.error.ts` used
  `this.name = AuthorizationError.name`: **fixed (Batch A)** — now
  `new.target.name`, matching `DomainError`.
- ~~**[core] http-api** — `http-error.filter.ts`: `<500` `HttpException` with an
  object payload forwards Nest's `{statusCode,message,error}` verbatim.~~ **fixed
  (Batch F)** — normalised to `{ message: string }` via `extractMessage`; +1
  ispec asserts a 404 body `=== { message: 'Post not found' }`.
- ~~**[core] migrations** — SKILL.md lists `pnpm migration:check` but no such
  script exists and CI runs no migration/snapshot check.~~ **fixed (Batch D,
  D17)** — `package.json` `mikro-orm` + `migration:{create,up,down,check}`
  scripts; CI runs `pnpm migration:up && pnpm migration:check`; `ensureMigrated`
  calls `orm.migrator.checkSchema()` and throws on drift. Source of truth:
  `references/migrations.md`.
- ~~**[core] security**~~ — `publicUrl` unset → CORS `origin: undefined`
  (permissive) with `credentials:true`: **fixed (Batch M)** — `main.ts` throws in
  production when `PUBLIC_URL` is unset; dev falls back to a localhost-only
  origin regex, never `undefined`.
- ~~**[core] observability**~~ — `sentry.ts` `tracesSampleRate` defaulted to `1`
  (100%): **fixed (Batch M)** — default `0.1` in production, `1` elsewhere;
  `SENTRY_TRACES_SAMPLE_RATE_<ENTRYPOINT>` still overrides. Error `sampleRate`
  stays `1` (want every exception).
- ~~**[core] tests**~~ — `change-set.helper.ts` / `request-context.helper.ts` no
  `.spec.ts`: **fixed (Batch K)** — both now have a `.spec.ts` under
  `core/database/helpers/`.
- ~~**[core-ai] correctness**~~ — `parse-annotation-tags` resolved offsets via
  `indexOf(fragment, cursor)`, so a tag on the 2nd of two identical forms landed
  on the 1st: **fixed (Batch N)** — `resolveOffset()` prefers `reconstructed.length`
  (the position the token *should* sit at — every char emitted before it is
  already reconstructed) when the fragment sits exactly there and reconstruction
  is still aligned; `cursor` stays the hard floor so a drifted `{{}}` still
  resolves later tags. `.spec` +2.
- ~~**[core-ai] correctness**~~ — `detectGerund` mis-flags lexicalised `-ing`
  nouns: **fixed (Batch K / D13)** — `LEXICALISED_ING_NOUNS` stop-list on the
  `NN` branch (`VBG` still trusted). Spec'd.
- ~~**[core-ai] style** — module-level `/g` `/y` regexes with mutable `.lastIndex`
  as scan cursors in both tag parsers (`parse-annotation-tags.ts`,
  `parse-grammar-tags.ts`); safe only single-threaded/non-reentrant.~~ **fixed
  (Batch O)** — each parser now builds its scan regex fresh per call
  (`buildTokenRe` / `buildTrailerRe`; grammar threads the instance through
  `consumeClose`), so there is no shared mutable cursor. Negligible cost (one
  compile per stage). Existing parser specs cover it; `ai.md` round-trip section
  updated.
- ~~**[core-ai] nlp/error-handling**~~ — `http-nlp-client` cast `response.json()`
  with no shape check: **fixed (Batch M)** — `assertParseResult()` validates the
  `sentences` array + each entry's `text`/`start`/`end`/`tokens` at the boundary
  and throws a clear error. `.spec` +2.
- ~~**[core-ai] tests**~~ — **fixed (Batch I)** — `anthropic-client.service.spec.ts`
  (9 cases: `$schema` strip, tool extraction + missing-tool error, `max_tokens`
  on both methods, adaptive-thinking gate, cost math incl. unknown model);
  `nlp-service/test_app.py` (offset round-trip, multi-sentence, `/health`,
  empty-text 422) + a dedicated CI job.
- ~~**[core-ai] style** — `grammar-prompt.ts` has two independent whitespace-
  normalisation paths (`INLINE_WS_RE` vs `normalizeInlineWhitespace`) that must
  produce byte-identical output or the round-trip breaks; `:190-192`
  `map[span.charStart] ?? span.charStart` fallback silently masks a mapping bug.~~
  **fixed (Batch O tail)** — `buildGrammarUserText` now emits
  `normalizeInlineWhitespace(text).normalized`, so the string the model sees and
  the string `parseGrammarResponse` reconstruct-and-compares against come from
  one normaliser (`INLINE_WS_RE` stays only for collapsing the model's *tagged*
  echo). The `?? span.charStart` fallback is replaced by an explicit throw —
  `parseGrammarTags` offsets are always inside `map`'s range, so an undefined
  there is a real bug, now loud instead of a silently-wrong `rawText` offset.
  Also localised the last module-level cursor regex (`NUMBERED_MARKER_RE` →
  `buildNumberedMarkerRe`). `grammar-prompt.spec` +1.
- ~~**[core-ai] draft fidelity**~~ — idiom harness ran `maxTokens:8000` vs prod
  `16000` and never checked `stopReason`: **fixed (Batch M)** — `annotateUnit`
  now sends `MAX_TOKENS = 16000` and records `truncated` from a `max_tokens`
  stop; `compare.ts`/`snapshot.ts`/`run.ts` count `truncated` as a hard failure
  (same as the grammar harness).
- ~~**[core-ai] docs**~~ — `draft/lib/split-sentences.ts` header referenced a
  removed file `split-text-for-annotation.ts`: **fixed (Wave 3)** — rewritten to
  say prod segments via spaCy and the harness keeps its own splitter on purpose.

- ~~**[post-data] mikroorm/pipeline** — `node-tree.parser.ts` + `NodeTreeType`
  imported by nothing; `post-part-body.type.ts` claims reassembly runs
  `parseDoc(...)` but the handler doesn't; node trees never re-validated after a
  converter/splice.~~ **fixed (Batch D, D12)** — `parseDoc(assembleDocFromParts(...))`
  wired at `get-post-detail.handler.ts` (read-time re-validation,
  `InvalidNodeTreeError` on a splice bug); comments corrected; parser kept as the
  intended validator; type renamed `node-tree-json.type.ts` (Batch K).
- ~~**[post-data] mikroorm** — `grammar-match.entity.ts`: no unique constraint; a
  partial `ai_grammar` write + rerun double-inserts.~~ **fixed (Batch D)** —
  composite `@Unique(sentenceId, grammarUsagePointId, tokenStart, tokenEnd)`;
  `TagGrammarHandler` also dedupes spans in memory. Migration `120500`.
- **[post-data] mikroorm (spec drift)** — **mostly fixed (Batch D, D12)**:
  ~~`PostSource` attribution~~ (added `type` + `attributionText`, NOT NULL);
  ~~`posts.status` annotation-centric~~ (→ `processing`); ~~`Running` missing~~
  (derived, not an enum value). Kept-by-decision: `words.cefr_level` stays on
  `word_definitions` per-POS (PLAN §3.3 updated, Batch J). **Still open:**
  `post_word`/`post_phrase` join tables not built — the `get-dictionary`
  projection (D10/D12), the tracked deferred item.
- ~~**[post-data] ai/error-handling** — `build-token-annotations.ts`
  `phraseText: phraseTextById.get(id) ?? ''` — a map miss yields `''`, failing
  the job with a shape error that hides the real cause.~~ **fixed (Batch P)** —
  `resolvePhraseText` throws `MissingPhraseTextError(phraseGroupId)` on a miss
  (`errors/missing-phrase-text.error.ts`). `build-token-annotations.spec` +1.
- ~~**[post-data] style**~~ — **fixed**: ~~`node-tree.type.ts` naming~~,
  ~~`@Enum(() => X)` shorthand~~, ~~3 slugify impls~~, ~~`spansOverlap` dup~~
  (all Batch K); ~~redundant `@Index()` on composite-unique leading columns
  (`sentence.postPartId`, `sentence_token.sentenceId`)~~ dropped in Batch D
  (Migration `120500`).
- ~~**[post-data] security**~~ — **fixed (Batch K)**: `wrapLink` in both
  converters now rejects non-`http(s)`/`mailto` hrefs (`isSafeLinkHref`) →
  degrades to a text node; `html-to-doc` block scan is top-level-only
  (`collectBlockElements`), so a nested `<ul>` is no longer duplicated. Spec'd.
- ~~**[post-data] tests**~~ — **fixed (Batch K)**: `collect-spans`,
  `generate-slug`, `generate-short-id`, `annotation-prompt` `.spec.ts` +
  `upsert-phrase-id.ispec.ts` added; `generate-short-id`'s modulo bias +
  no-unique-retry documented in its spec as an accepted weakness (huge id space,
  `@Unique` on `posts.short_id` is the guard).

- ~~**[learning] architecture** — `add-card` / `get-*` handlers +
  `skill-progress.service.ts` `em.find` ~8 `post`-owned tables + import
  `post/domain/*` directly, no `PostModule` / `services/shared` boundary.~~
  **resolved by D10 (Batch E / Wave 3)** — read-only cross-module `em.find`
  **from a query handler** is sanctioned (never a command, never a write);
  `architecture.md` A8 + `db-performance.md` DP2. A `post` projection /
  `services/shared` lookup stays the eventual fix (folds into the
  `get-dictionary` deferred item).
- ~~**[learning/billing] cqrs**~~ — commands returned managed ORM entities:
  **fixed (Batch E, D2)** — `AddCard`/`ReviewCard` → `Command<CardView>`,
  `ActivateMockSubscription` → `Command<SubscriptionView>`; view types +
  `to<View>` mappers in `<module>/types/`. `IngestPostCommand` still returns a
  managed `Post` (owed).
- ~~**[billing] cqrs/architecture**~~ — no `queries/` folder: **fixed (Batch E,
  D18)** — `billing/queries/get-subscription/*` added (`GetSubscriptionHandler`
  → `SubscriptionView | null`); `BillingService` routes through `queryBus`;
  `SubscriptionService` dropped from `billing.module.ts` `exports` + `isPremium`
  removed (dead).
- ~~**[learning] mikroorm/error-handling**~~ — `add-card` /
  `skill-progress.loadOrCreate` were `findOne`-then-`persist` (racing duplicate →
  500): **fixed (Batch E)** — both are now `em.upsert(…, onConflictFields,
  onConflictAction: 'ignore')`, resolving a racing `POST /learning/cards`
  idempotently.
- ~~**[learning] mikroorm**~~ — `masteryScore` was write-cached and only
  recomputed in `recordGrammarReview`: **fixed (Batch E, D11)** — derived at read
  time in `get-profile` (`aggregateMasteryScore` over the loaded cards);
  `recordGrammarReview` no longer writes it; column is display-only. See DP6.
- **[learning] db-performance** — ~~`get-profile.computeStreak` loads every
  `review_logs` row~~ **fixed (Batch E)** — now `SELECT DISTINCT …::date` raw SQL.
  ~~No learning query handler uses `disableIdentityMap`~~ **fixed (Batch E)**.
  Still open: `get-dictionary` loads **all** published posts + all their parts +
  walks every node-tree span on every `/dictionary` request (stands in for the
  missing `post_word`/`post_phrase`, PLAN §3.3) — bound it or build the
  projection (D10/D12).
- ~~**[telegram] pipeline/error-handling** — a `Failed` `post_publications` row
  is terminal (`run()` selects only `Pending`); a transient Telegram 5xx
  permanently drops the announcement and `/retry` doesn't recover it.~~ **fixed
  (Batch G, D15 #30)** — `post_publications.retry_count` col; `PublishPendingService`
  re-selects `Failed` rows (`retryCount < 5` + `updatedAt` backoff);
  `RetryPostHandler` resets `Failed` rows for the post to `Pending`. `pipeline.md`
  P11.
- ~~**[telegram] mikroorm/observability** — `poll-updates`: the
  `telegram_updates` row is committed `processed=false` by `ingest()`'s internal
  flush; `processed=true` only afterwards → a crash in the window strands it.~~
  **fixed (Batch G)** — `row.processed = true` set + `em.flush()`ed **before**
  `dispatch()`; `mikroorm.md` anti-pattern row + ispec.
- ~~**[telegram] style/mikroorm** — `telegram_updates.telegramMessageId` stores
  `update.update_id`.~~ **fixed (Batch D)** — column + `@Unique` + field renamed
  `updateId`; `poll-updates.service.ts` + raw SQL + ispec. Migration `120400`.
- ~~**[telegram] error-handling** — `poll-updates`: the `try` wraps the command
  call *and* the success `sendMessage`; a failed confirmation reads as the
  command failing.~~ **fixed (Batch G)** — the command runs in the `try` and only
  computes a reply string; `sendMessage(reply)` is issued after the `try`,
  swallow + `logger.warn` on failure. `error-handling.md` E7.
- **[telegram] low** — **mostly fixed**: ~~poll cron runs when
  `TELEGRAM_ADMIN_USER_ID` empty~~ (Batch G no-op on empty adminUserId);
  ~~`/retry` accepts any `\S+`~~ (Batch G `UUID_RE` in `parse-command.ts`);
  ~~raw payloads stored with no pruning~~ (Batch G `PruneTelegramUpdatesService`
  daily cron, 30-day retention); ~~PLAN §3.9 `raw_payload_json` / `/add {link}`~~
  (Batch J); ~~"long-polling" comment vs `getUpdates timeout: 0`~~ (Batch Q —
  comment corrected: `timeout: 0` short poll, the once-a-minute cron is the
  interval); ~~no `telegram-client.service.spec.ts`~~ (Batch Q — `configured`,
  short-poll body, result unwrap, transport-wrap `{cause}`, API not-ok + 200/`ok:false`
  throws). **Still open (low, single-channel MVP):** bare `Error` from the
  client — no `TelegramApiError`, `429`/`retry_after` not distinguished (no
  backoff); `TelegramUpdate` has no `updatedAt`; `formatPostAnnouncement(post,
  publicUrl ?? '')` ships a relative link if `PUBLIC_URL` unset.
- **[cron] observed (good, document as-is)** — `CronJobHost` abstract base: drain
  flag + `inFlightTicks` awaited by `waitForCronTicksToDrain()` before
  `app.close()`; `@Cron(…, {waitForCompletion:true})` prevents self-overlap; every
  tick wrapped in `Sentry.startNewTrace` → `startSpan({op:'function.cron'})`,
  failures `captureException` + `logger.error` + rethrow.

- ~~**[web] architecture/security** — the global `SessionAuthGuard` `APP_GUARD`
  is declared in `AuthWebModule`, not `web.module.ts`; a composition omitting
  `AuthWebModule` silently unauthenticates every route.~~ **fixed (Batch F)** —
  `APP_GUARD: SessionAuthGuard` + `APP_INTERCEPTOR: ETagInterceptor` moved into
  `WebModule.forRoot`; every composition is authenticated regardless of
  sub-modules. `http-api.md` H3.
- ~~**[web] security/http-api** — no rate limiting at the web edge (PLAN §7).~~
  **fixed (Batch F, D14 #35)** — `@nestjs/throttler` `ThrottlerGuard` (global,
  Redis storage) via `WebThrottlerModule`; `THROTTLE_TTL_MS` / `THROTTLE_LIMIT`
  (60 s / 300); `skipIf: isTestEnvironment()`. `security.md` rate-limit row.
- ~~**[web] http-api** — `ETagInterceptor` wired globally but `@CachePolicy()` is on
  **zero** routes → it early-returns for every request; public feed/post-detail
  GETs get no `Cache-Control`/`ETag`/304.~~ **fixed (Batch O)** — option (a):
  class-level `@CachePolicy('public')` on `ContentController` (every route there
  is an anonymous cacheable GET), so `feed` / `posts/:slugId` / `grammar` /
  `grammar/:slug` now emit `Cache-Control: public` + a SHA-1 ETag and answer a
  matching `If-None-Match` with 304. `content.controller.ispec` +1;
  `http-api.md` H9 updated.
- ~~**[web] http-api** — OpenAPI advertises a global `429` but no web endpoint
  can return it (`TooManyLoginRequests` → 400).~~ **fixed (Batch B, D1)** —
  `TooManyLoginRequestsError` / `TooManyAttemptsError` → `super(msg, 429)`; the
  declared `429` is now reachable.
- ~~**[web] http-api** — error-body shape diverges: `HttpErrorFilter` forwards
  Nest's `{statusCode,message,error}` for `<500` `HttpException`.~~ **fixed
  (Batch F)** — normalised to `{ message: string }`; +1 ispec.
- ~~**[web] architecture/http-api** — the `/api` prefix strip is an undocumented
  deployment coupling; OpenAPI has no `/api` server URL.~~ **fixed (Batch F,
  D14 #33)** — `setGlobalPrefix('api', { exclude: ['_healthz'] })` in
  `configureApp`; `.addServer('/api')` + `ignoreGlobalPrefix: true` in the
  OpenAPI builder; the edge proxy strip stays belt-and-suspenders. `http-api.md`
  "/api prefix".
- ~~**[web] architecture** — request-DTO location split (`auth` command-DTO
  reuse vs `learning`/`content` web-local `createZodDto`).~~ **decided (Batch F,
  D14 #37)** — web-local `createZodDto` under `entrypoints/web/*/dto/` +
  controller mapper is the standard; auth's command-DTO reuse is a tolerated
  exception. `http-api.md` "request-DTO home".
- **[web] architecture** — ~~`PostDetailResponseDto` imports internal query view
  types + `ContentController` structural-casts~~ **fixed (Batch F)** — annotation
  DTOs re-declared locally, explicit `to<X>Response` mappers. `doc` still
  `type`-imports the domain `Doc` **by decision (Batch N)** — it's dependency-free
  wire-contract data shared with the SSR renderer, not an internal query view.
  Still open: `ContentController` uses `@Controller()` with **no path prefix**
  (owns top-level `feed`/`posts`/`grammar` — future collision risk).
- **[web] low** — **mostly fixed**: ~~`EmptyStringToNullPipe` → 400 on
  `?limit=`/`?cefr=`~~ (Batch F `queryParam` preprocess); ~~`POST /learning/cards`
  no `@HttpCode`~~ (Batch F → 200); ~~`clearSessionCookie` only `{path:'/'}`~~
  (Batch F mirrors all four cookie attrs); ~~`addCookieAuth` no `@ApiCookieAuth()`~~
  (Batch N); ~~`HealthController` no `@ApiTags` / zero indicators~~ (Batch F —
  DB + Redis Terminus indicators + `@ApiTags('internal')`); ~~`@CurrentUser()`
  bare `Error` → 500~~ (Batch M → 401). **Still open (low / deferred):**
  `practice` bare-array + `dictionary` `{items}` list shapes (breaking wire
  change, needs `apps/web` — deferred); `DateTime`→ISO conversion done at
  different layers per module; `content` controller mixes `async` and bare
  promise returns.

- ~~**[worker] queue-jobs/config** — two `boss.createQueue` authorities for the
  post queues (`worker-registrar` no-options vs `PostQueueBootstrapService`); the
  bare call can overwrite policy/expiry.~~ **fixed (Batch C, D8)** —
  `PostQueueBootstrapService` is the only `createQueue` caller (all queues incl.
  auth); `WorkerRegistrarService` only `boss.work()`s.
- ~~**[worker] queue-jobs/error-handling** — no `retryLimit`/backoff/`deadLetter`
  on any queue; a poison paid-AI job silently strands.~~ **fixed (Batch C, D4)** —
  per-queue `retryLimit` + `retryBackoff` + a `deadLetter` queue for the AI
  stages in `core/queue/queue-config.ts`.
- ~~**[worker] queue-jobs/observability** — `JobWorkerHost` never touches
  `PostPipelineRun` on failure.~~ **fixed (Batch C, D4)** — `recordStageStart` /
  `recordStageFailure` on a forked em; see the `[post] error-handling` row above.
- ~~**[worker] queue-jobs** — `work()` does `Promise.all(jobs.map(handleOne))` —
  one rejection rejects the whole batch.~~ **fixed (Batch C)** —
  `Promise.allSettled` + re-throw (single reason or `AggregateError`).
- ~~**[cli] architecture/cqrs** — ~90 LOC of entity seeding + `em.flush()` inline
  in `grammar-import-*` / `words-import-frequency` `execute()`.~~ **decided
  (Batch H, D16)** — "thin importer script inline in the CLI `execute()` with its
  own `em.flush()`" is a sanctioned named exception for one-off / seed commands.
  `cqrs.md` "Flush outside the CQRS path".
- ~~**[cli] validation** — `parseType` does `return val as PostType` with no
  check; invalid `--type` surfaces as a raw `ZodError`.~~ **fixed (Batch H)** —
  `parseType` checks `Object.values(PostType).includes(...)` → `InvalidCliFlagError`.
  `parseTitle` kept (nest-commander needs the decorated `@Option` method for the
  `--title` flag; identity body matches sibling parsers).
- **[worker/cli] low** — `WORKER_QUEUES` bare string token; **zero spec files** in
  `src/entrypoints/worker/` (CLI side has 9); `spanAttributes()` extension point
  overridden by nothing; `sentry test` / `migrate up|down` extend
  `CliCommandRunner` (acquire a forked `em` + request context) but never use `em`;
  ~~`worker.ts` SIGTERM handler can double-`app.close()` on reject~~ **fixed
  (Batch O)** — shared `closeOnce(app)` helper (`src/entrypoints/close-once.helper.ts`)
  memoises the first close's promise; both `worker.ts` and `cron.ts` route the
  signal handler and the outer `catch` through it. `close-once.helper.spec.ts`
  (3 cases). Also fixed earlier (Batch H, not struck here): bootstrap crash logs
  `{ cause: err }` → `{ err }`; `post ingest <file>` existence check; `WORKER_QUEUES`
  → `Symbol`. Still open: no worker-dir spec files beyond the new helper;
  `parseCommaSeparated` referenced only by its own spec.
- ~~**[test] migrations/tests** — `migration-guard.helper.ts` only drops +
  replays; no `migration:check`, no CI step.~~ **fixed (Batch D, D17)** —
  `migration:check` script (prod config, `snapshot:true`) + CI step;
  `ensureMigrated` calls `orm.migrator.checkSchema()` and throws on drift.
- ~~**[test] tests** — Redis state is never reset between integration tests.~~
  **fixed (Batch I)** — `REDIS_DB` (default 0), `.env.test` `REDIS_DB=1`,
  `redis.flushdb()` in `afterEach` of `useOrmSuiteLifecycle`.
- ~~**[test] tests** — no shared port fakes (4 `FakeAiClient`, 2 `FakeNlpClient`,
  2 `FakeTelegramClient`, none `implements`-checked).~~ **fixed (Batch I)** —
  `test/fakes/{ai,nlp,mailer,telegram,pg-boss}.fake.ts`, one `implements`-checked
  class per port; all 7 bespoke fakes migrated.
- ~~**[test] tests/mail** — `MAILER` port + every worker processor have zero
  tests.~~ **fixed (Batch I)** — `send-challenge-email.processor.spec.ts`,
  `challenge-mailer.service.spec.ts` (render + send via `FakeMailer`),
  `post-processors.spec.ts` (all 6 pipeline processors), `anthropic-client.service.spec.ts`.
- ~~**[test] tests** — coverage gate may pass only transitively.~~ **verified
  (Batch I)** — gate confirmed green directly; actuals ~90/76/86/90 vs the
  80/80/70/80 thresholds.
- **[test] tests** — ~~`e2e-suite.helper.ts` `request(…, {authed})` dead API~~
  **fixed (Batch I)** — the `authed` flag + `options` param removed (web auth is
  cookie-based, no `TEST_TOKEN` ever existed). **Still open (deferred, infra):**
  `apps/web` Playwright + `seed-web-e2e.ts` not in a CI workflow — a manual
  pre-release gate for now.
- **[test] low** — **mostly fixed**: ~~hand-copied filters/pipes in
  `create-app.helper.ts`~~ (Batch F `configureApp`); ~~`factory.helper.ts` /
  `maybe()` / `@faker-js/faker` / `makeChangeSet` dead~~ (Batch I deleted);
  ~~no `hookTimeout`~~ (Batch I `60_000`); ~~real pg-boss for every ispec~~
  (Batch I `createFakePgBoss()` default, `{realPgBoss:true}` opt-out);
  ~~`.env.test` DB name vs CI~~ (Batch L — intentional, documented);
  ~~`post` query handlers + `get-dictionary` no direct `.ispec.ts`~~ (Batch Q —
  `.handler.ispec.ts` for all 5). **Still open (low):** `queue-spy` matches
  `send()` args positionally; `app.module.ispec.ts` compiles entrypoint modules
  but never `.init()`s them.
- **[test] observed (document as-is)** — 3 tiers by suffix; `suite.command` =
  `execute → em.flush() → em.clear()`, `suite.query` = `execute → em.clear()`
  (facade replica); per-test isolation = one Postgres transaction rolled back in
  `afterEach` (no truncate); schema built once per worker process via `drop schema
  public cascade` + replay all migrations; integration run fully serial
  (`maxWorkers:1`, `fileParallelism:false`, `isolate:false`), unit run parallel;
  test-env ORM flags `allowGlobalContext:true` + `implicitTransactions:false` +
  `RequestContext` skipped — the rollback model depends on all three; fakes via
  `builderHook` + `.overrideProvider().useClass/useValue()`; queue effects via
  `vi.spyOn(OutboxSenderService, 'send')` (no real worker); CI (`app.yaml`): `pnpm
  type` (covers `src/` + `test/`), `biome check`, `pnpm test:cov` (enforces
  coverage), `pnpm build` + `git diff --exit-code src/metadata.ts`,
  `pnpm migration:up && pnpm migration:check` (Batch D), a `nlp-service` pytest
  job (Batch I). Still no Playwright (`apps/web` e2e is a manual gate).

- **[worker/cli] observed (document as-is)** — a throw in `processJob` is caught by
  `JobWorkerHost.handleOne` → Sentry + log → **rethrown** so pg-boss retries; job
  runs inside `withRequestContext(this.orm.em, …)` (own forked `em`, same idiom as
  `CronJobHost` / `CliCommandRunner`); distributed trace continued from
  `job.data._sentryTrace`/`_sentryBaggage` (stamped by `OutboxSenderService` via
  `withSentryTrace`) → `startSpan({op:'queue.process'})`; worker shutdown leans on
  `boss.stop()`'s built-in graceful wait (`PgBossLifecycleService`), **not** a
  hand-rolled drain like cron — don't "fix" it to match; `boss.supervise` only on
  for `runtime === 'cron'`. CLI = nest-commander, one router `@Command` per verb
  with `subCommands`; stateful commands `extend CliCommandRunner`, pure routers
  stay on bare `CommandRunner`; failure → `process.exitCode = 1` (never
  `process.exit()`).

- **[learning/billing] low** — **mostly fixed**: ~~`SubscriptionStatus.Expired`
  never written~~ (Batch D removed it); ~~`POST /learning/cards` no `@HttpCode`~~
  (Batch F → 200); ~~redundant `@Index()` on `learning_cards.userId` + missing
  `(userId, due)`~~ (Batch D — `@Index(['userId','due'])`); ~~`review_logs` has
  both `reviewedAt` and `createdAt`~~ (Batch D dropped `created_at`); ~~no
  `.spec.ts` for `CardLimitService` / `SkillProgressService`~~ (Batch I —
  `.ispec.ts` for both); ~~`DictionaryController` returns the raw view cast to
  the DTO (no `toDto` mapper)~~ (Batch Q — explicit `toDictionaryEntryDto`);
  ~~no `get-dictionary` `.ispec.ts`~~ (Batch Q — `get-dictionary.handler.ispec.ts`).
  **Still open (low):** `DateTime`→ISO at handler for dictionary vs controller
  for practice-queue; flat `providers` array vs auth's grouped
  `commandHandlers`/`queryHandlers`; `add-card.dto` `.refine` `path: []` →
  `field: null` (**not a bug** — correct for a cross-field constraint, factory
  handles it); practice-queue drops deleted-target cards while dictionary keeps
  them with `primary: ''`.

## Decisions (proposed — confirm / override in bulk)

Status legend: `proposed` · `confirmed` · `overridden: <what>`.
Each decision resolves the listed open-question numbers.

### D1 — `DomainError` carries an optional HTTP status — `confirmed` (2026-08-30)
Resolves: 16, and the web-429 dead contract, learning-errors-→400.
**Rec:** add optional `status` (+ maybe `code`) to `DomainError`, default 400;
`DomainErrorFilter` honours it. Map `TooMany*` → 429, `*NotFound` → 404,
unique-conflict → 409. Effort: S.

### D2 — Commands return plain values, never managed entities — `confirmed` (2026-08-30)
Resolves: 28, IngestPost finding.
**Rec:** handlers return `id` or a small plain view; fix opportunistically per
command; update the telegram consumer of `IngestPost`. Rule already in
`cqrs.md` Q6/A7. Effort: M (spread).

### D3 — Handler flush discipline — `confirmed` (2026-08-30)
Resolves: the post cqrs finding.
**Rec:** drop the redundant `em.flush()` from `assess-complexity` / `tag-grammar`
/ `generate-exercises` / `publish` / `retry` handlers; keep the per-`PostPart`
flush in `spacy-parse` + `annotate` and document **both** as the 2 sanctioned
exceptions in `cqrs.md`. Effort: S.

### D4 — `post_pipeline_runs` becomes a real run tracker — `confirmed` (2026-08-30)
Resolves: 7, 40 (part), 9 (part), 42 (part).
**Rec:** write the run row `Pending`+`startedAt` on stage entry (in
`JobWorkerHost`); on caught error `Failed`+`errorMessage`+`retryCount++` before
rethrow; set `PostStatus.Failed` when pg-boss retries exhaust; `Running` is
**derived** (`startedAt set ∧ completedAt null`), no new enum value; set explicit
`retryLimit`+backoff per queue + a `deadLetter` queue for the paid AI stages.
Effort: M.

### D5 — `/retry` = full reprocess from scratch — `confirmed` (2026-08-30)
Resolves: 5.
**Rec:** `RetryPostHandler` also `nativeDelete` `Sentence` / `SentenceToken` /
`GrammarMatch` / `Exercise` for the post + null `PostPart.annotatedAt`, all in one
flush. No `--force` flag — retry always means from scratch. Effort: S.

### D6 — `publish` gates on the `annotation` branch — `confirmed` (2026-08-30)
Resolves: 6.
**Rec:** `PublishPostHandler` no-ops-and-requeues until
`PostPipelineRun(stage=Annotation, status=Completed)` exists — the two
`spacy_parse` fan-out branches rejoin at publish. Effort: S.

### D7 — Drop `PostPipelineStage.Fetch` — `confirmed` (2026-08-30)
Resolves: 8.
**Rec:** link-fetching is out of V1 scope (ingest takes pasted text). Remove the
enum value + PLAN §5 step 1. A future link-fetch is a new stage. Effort: S.

### D8 — Single queue-declaration authority — `confirmed` (2026-08-30)
Resolves: 42, 40 (part).
**Rec:** `PostQueueBootstrapService` (extended to **all** `QueueName`s incl. the
auth queue), with a shared options const, is the only `boss.createQueue` caller;
`WorkerRegistrarService` only calls `boss.work()`. Effort: S.

### D9 — Hexagonal port pattern is the canon for `core/*` external adapters — `confirmed` (2026-08-30)
Resolves: 21.
**Rec:** `*.port.ts` (Symbol token + interface) + `*.provider.ts` + `*.config.ts`
is the standard for swappable external adapters (`ai`, `nlp`; new ones follow it).
auth's inline Google verifier + telegram's inline `fetch` client are the older
simpler style — leave them, don't retrofit. Document in `architecture.md`.
Effort: 0 (doc only).

### D10 — Read-only cross-module `em.find` is allowed for query handlers — `confirmed` (2026-08-30)
Resolves: 24, 12 (part).
**Rec (pragmatic):** sanction direct read-only `em.find` of another module's
tables **from query handlers only** (never writes, never in a command); document
in `architecture.md` that a `post` projection / `services/shared` lookup is the
eventual fix for `learning`'s post-table reads + the missing
`post_word`/`post_phrase`. Effort: 0 (doc). *Alt: build the boundary now — L.*

### D11 — `mastery_score` derived at read time — `confirmed` (2026-08-30)
Resolves: 25.
**Rec:** compute in `get-profile` from the already-loaded cards + usage points
(like `streak`/`cefr`); make the stored column display-only (or drop it);
`recordGrammarReview` stops recomputing. Effort: S.

### D12 — PLAN §3 vs code reconciliation — `confirmed` (2026-08-30)
Resolves: 3, 10, 11, 13, 14, 27, 31, + `posts.status` vocab, `PostPipelineRun.Running`.
**Rec, per item:**
- **word CEFR (10):** keep on `WordDefinition` (per-POS); add a derived
  "easiest classified sense" helper; update PLAN §3.3.
- **attribution (11):** add `attributionText` (required) + `PostSourceType` enum
  to `PostSource` — PLAN §9 is a legal constraint, non-negotiable. Effort: M.
- **grammar_matches unique (13):** add composite
  `@Unique(sentenceId, grammarUsagePointId, tokenStart, tokenEnd)` **and** keep
  delete-by-sentence in the handler.
- **node-tree parser (14):** wire `parseDoc` at the reassembly site
  (`get-post-detail`) — it is the intended read-time validator; fix the
  misleading comments; **don't** delete.
- **Subscription home (3):** move `Subscription` + its 2 enums to
  `modules/billing/entities/`.
- **subscription expiry (27):** drop `SubscriptionStatus.Expired`; expiry is
  `currentPeriodEnd <= now` at read time; document.
- **telegram_message_id (31):** rename column + field to `updateId` (migration);
  matches what's stored + PLAN §3.9 prose.
- **posts.status:** collapse `Annotating`/`Annotated` → single `Processing`;
  `Published`/`Failed` stay.
Effort: M overall (attribution is the real build).

### D13 — inline-markup / PLAN §6 staleness — `confirmed` (2026-08-30)
Resolves: 22, 23.
**Rec:** update PLAN §6/§12 to document the actual approach (rare `⟦⟧`/`{{}}`
delimiters + reconstruct-and-compare, no PUA escaping); note literal `⟦⟧` in
source is unsupported (vanishingly rare). Don't build the PUA round-trip.
`detectGerund`: accept the false-positive class + add a ~15-entry stop-list of the
commonest lexicalised `-ing` nouns. Effort: S.

### D14 — Web infrastructure — `confirmed` (2026-08-30)
Resolves: 33, 34, 35, 36, 37, 38, 39.
**Rec, per item:**
- **/api prefix (33):** `setGlobalPrefix('api', { exclude: ['_healthz'] })` in
  `main.ts` + `.addServer('/api')` in the OpenAPI builder. Keep the proxy too.
- **guard placement (34):** move `SessionAuthGuard` `APP_GUARD` +
  `ETagInterceptor` `APP_INTERCEPTOR` into `web.module.ts`.
- **rate limiting (35):** add `@nestjs/throttler` `ThrottlerGuard` (global, Redis
  storage) before launch — PLAN §7. Effort: M.
- **response-DTO coupling (36):** web response DTOs independent of module view
  types + explicit mapper in `ContentController`; shared `{ items, nextOffset }`
  list envelope.
- **request-DTO home (37):** web-local `createZodDto` under
  `entrypoints/web/*/dto/` + controller mapper is the **standard**; auth's
  command-DTO reuse is a tolerated exception. Reason: keep HTTP contract out of
  the domain module.
- **CSRF (38):** `SameSite=Lax` + POST-only + single-origin is acceptable for V1;
  document; revisit for any third-party embed.
- **/_healthz (39):** add Terminus DB + Redis indicators (readiness) +
  `@ApiTags('internal')`.
Effort: M overall.

### D15 — telegram / cron-poller layering — `confirmed` (2026-08-30)
Resolves: 29, 30, 32.
**Rec:**
- **layering (29):** sanction "cron entrypoint → exported `services/shared/*.run()`
  that owns its own flush" as the pattern for cron-driven non-HTTP work (no
  facade / CQRS for pure pollers). Move the 2 services to `services/shared/`.
  Document.
- **failed publications (30):** `PublishPendingService` re-selects `Failed` rows
  with `retryCount < N` + backoff; `/retry` also resets `failed` telegram
  publications for the post.
- **retention (32):** daily cron prunes `telegram_updates` older than 30 days.
  Low priority.
Effort: S–M.

### D16 — CLI importer layering — `confirmed` (2026-08-30)
Resolves: 41.
**Rec:** sanction "thin importer script inline in the CLI `execute()` with its own
`em.flush()`" as an explicit named exception for one-off / seed commands (PLAN
§1). Document in `cqrs.md`. Don't refactor into services. Effort: 0 (doc).

### D17 — Test + migration tooling — `confirmed` (2026-08-30)
Resolves: 20, 43, 44, 45, 46, 47, 48.
**Rec:**
- **migration:check (20/43):** add `pnpm migration:check` (mikro-orm, prod config
  `snapshot:true`) + CI step; `ensureMigrated` also fails on a pending diff.
  Migrations stay plain-generated — the check is the gate.
- **shared fakes (44):** `test/fakes/{ai,nlp,mailer,telegram}.fake.ts`, one
  canonical `implements` per port.
- **coverage (45):** verify the 80/80/70/80 gate is actually green in the fix
  pass; add **direct** specs for worker processors + `AnthropicClientService` +
  `MAILER` rather than leaning on transitive coverage.
- **browser e2e (46):** document as a manual pre-release gate for V1; automate
  (CI job: seed + Playwright) post-launch. Low priority.
- **Redis isolation (47):** dedicated test Redis DB index + `FLUSHDB` in
  `afterEach` of `useOrmSuiteLifecycle`.
- **configApp factory (48):** extract one `configureApp(app)` shared by `main.ts`
  + the web test helper.
Effort: M overall.

### D18 — Misc / lower-stakes — `confirmed` (2026-08-30)
Resolves: 1, 2, 4, 15, 17, 18, 19, 26.
**Rec:**
- **resolve-session unawaited refresh (1/4):** `await` it inside the command
  (it's cheap). "Command on a read path for a genuine state change" stays allowed.
- **challenge atomicity (2):** persist the challenge deferred (`em.create`/
  `persist`) so it commits with the outbox email job.
- **timezone (15):** force `timezone: 'UTC'` in the pg `driverOptions` + document.
- **mail fallback (17):** `ConsoleMailerService` is the no-key fallback; throw at
  bootstrap in production if neither Resend key nor explicit MailHog opt-in.
- **Sentry breadcrumbs (18):** run `context.query` through `sanitizeSqlParams` +
  drop `results` before the breadcrumb; gate behind the same prod logic as spans.
- **queue DB config (19):** share the ORM config object — one source of the
  Postgres connection.
- **billing queries (26):** keep `SubscriptionService` internal (drop from
  `exports`); billing facade calls it; add a thin `GetSubscriptionQuery` for
  symmetry. Low priority.
Effort: S–M.

---

## Open questions

_(accumulated across waves — grouped into the Decisions above; kept for traceability)_

1. **[auth]** `ResolveSessionHandler` fires `sessions.refresh(...)` unawaited on
   every request — deliberate latency trade-off (accept lost refreshes + silent
   failures) or a bug to await? Decides whether the medium finding stands.
2. **[auth]** Should OTP-challenge persistence be atomic with the challenge-email
   outbox job, or is "row exists, email delayed until TTL" acceptable? The
   reference should state the answer explicitly.
3. **[auth/billing]** Which module owns `Subscription`? Currently defined in
   `auth`, mutated only by (planned) billing code. Needed to measure the billing
   review against a clear boundary.
4. **[auth]** Is "a Command dispatched on a read path (guard, every request)
   purely for a side effect" (`resolve-session` sliding expiry) an endorsed
   pattern, or should session refresh move to a queued job so read paths stay
   Queries?
5. **[post] `/retry` semantics** — full re-process (re-run spaCy + annotation from
   scratch) or resume of unfinished stages only? Current code does neither for
   those two stages. Want a separate `--force` flag?
6. **[post] publish vs annotation** — should `publish` block on the parallel
   `annotation` branch, or is a post intentionally publishable with word/phrase
   annotations still pending/failed (progressive enhancement)?
7. **[post] `post_pipeline_runs`** — a genuine run tracker (rows on entry,
   `Failed`/`errorMessage`/`retryCount` maintained, `PostStatus.Failed` on
   exhaustion, per PLAN §5) or is Sentry/pg-boss the source of truth and those
   entity columns should be removed?
8. **[post] `PostPipelineStage.Fetch`** — is link-fetching in scope for V1 (ingest
   currently accepts only inline `rawText`)? If not, drop the enum value.
9. **[post] AI stage retries** — is re-calling the model on every non-`Completed`
   retry acceptable cost-wise, or should `ai_complexity`/`ai_grammar`/`ai_exercises`
   short-circuit on existing partial output ("gap-filler, not rewrite", PLAN §12)?
   → **Resolved (Batch O): accepted as intentional.** A stage retry is a full
   recompute of that stage (same stance as `/retry` / D5). A failed stage rolls
   its writes back (P3a) so there is no trustworthy partial output to gap-fill;
   the `Completed` short-circuit already prevents re-calls after success; the
   extra paid call on a transient failure is bounded. `pipeline.md` P6a.
10. **[post-data] word-level CEFR** — `cefr_level` on `words` (PLAN §3.3) or only
    on `word_definitions` (current)? SRS difficulty + feed level-filter need a
    per-word answer.
11. **[post-data] attribution** — is showing the bare `source.link` an accepted V1
    shortcut, or is a stored `attribution_text` (+ `source_type` enum) still
    required per PLAN §3.2 + §9?
12. **[post-data] `post_word`/`post_phrase`** — is the node-tree span +
    `sentence_tokens.wordId/phraseId` linkage the deliberate replacement for
    "which posts use this word", or is a join table still expected for the
    dictionary reverse-lookup?
13. **[post-data] `grammar_matches` uniqueness** — dedupe is the handler's job
    (delete-then-insert); should the entity still encode a composite `@Unique` as
    a safety net?
14. **[post-data] node-tree validation** — keep `node-tree.parser.ts` /
    `NodeTreeType` as the intended read-time validator (and wire it up), or remove
    the dead code?
15. **[core] Postgres timezone** — is the session `TimeZone` guaranteed UTC in
    every environment? `LuxonTimestampType` writes an offset-less literal into
    `timestamptz`; nothing in the repo forces UTC (works only because the
    `postgres` image defaults to it).
16. **[core] `DomainError` → HTTP** — should it carry a status (429/404/409) or is
    flat 400 for every domain error an intentional API contract?
17. **[core] mail fallback** — is MailHog (not the unused `ConsoleMailerService`,
    not a hard failure) the intended behaviour when `RESEND_API_KEY` is absent in
    prod?
18. **[core] Sentry breadcrumbs** — sanitise per-query breadcrumbs like
    `db.statement` spans already are, or is raw inlined SQL in breadcrumbs
    accepted?
19. **[core] queue DB config** — keep piggy-backing on `MIKRO_ORM_*` env vars, or
    give the queue its own `QUEUE_*` namespace with ORM-matching defaults?
20. **[core] migrations** — bring tooling/migrations up to "idempotent, guarded" +
    add `migration:check`, or relax the SKILL.md wording to the plain-generated
    reality?
21. **[core] `core/*` adapter pattern** — is the hexagonal port/provider/config
    split (ai, nlp) the sanctioned pattern for all `core/*` external adapters, or
    an inconsistency to reconcile toward the plain-`@Injectable` auth baseline?
22. **[core-ai] inline-markup metacharacters** — keep "rare `⟦⟧` delimiter +
    reconstruct-and-compare, no escaping" (and update PLAN §6/§12), or build the
    private-use-area `[]{}`/`⟦⟧` round-trip PLAN claims exists?
23. **[core-ai] `detectGerund` false positives** on lexicalised `-ing` nouns —
    acceptable noise for a deterministic heuristic, or worth a stop-list?
24. **[learning] cross-module reads** — is `learning` `em.find`-ing `post`-owned
    tables + importing `post/domain/*` an accepted pattern for read-only
    cross-aggregate joins, or must those go through a `post` `services/shared/*`
    lookup service? (dominant deviation; affects most learning handlers)
25. **[learning] `mastery_score` stored vs derived** — compute at read time in
    `get-profile` (column display-only), or make every write path that touches a
    construction's cards recompute it?
26. **[billing] reads without `QueryBus`** — is a `queries/` folder expected for
    `getActiveSubscription`/`isPremium`, or is facade-direct access to
    `SubscriptionService` acceptable for a module this small (and should it then
    leave `exports`)?
27. **[billing] subscription expiry** — add a "expire lapsed subscriptions" job,
    or drop `SubscriptionStatus.Expired` and document expiry as time-derived only?
28. **[learning] command return values** — stop returning managed entities from
    `AddCard`/`ReviewCard`/`ActivateMockSubscription` (return id / plain view), or
    accept entity-through-the-bus as `IngestPostCommand` already does? (same
    decision as the `post` cqrs finding — answer once for the whole codebase)
29. **[telegram] module layering** — is "cron entrypoint → exported `services/*.run()`
    that mutates state and owns its own flush" endorsed for non-HTTP entrypoints,
    or should `telegram` grow a facade + `commands/` and move the services to
    `services/shared/` to match `auth`?
30. **[telegram] failed publications** — recoverable (bounded `retryCount` +
    backoff, or reset in `RetryPostHandler`), or "one shot, human notices"
    acceptable for the V1 single-channel setup?
31. **[telegram] `telegram_message_id` vs `update_id`** — rename column/field to
    `update_id` (matches what's stored + PLAN §3.9 prose), or keep + document?
32. **[telegram] audit retention** — is a pruning policy needed for
    `telegram_updates.raw_payload` (stores all senders' usernames + message text)?
33. **[web] `/api` prefix** — is "edge proxy strips `/api`, Nest serves at root"
    the accepted contract, or should `setGlobalPrefix('api', {exclude:['_healthz']})`
    own it so OpenAPI paths match production URLs?
34. **[web] global guard placement** — move `SessionAuthGuard` `APP_GUARD` (and
    `ETagInterceptor` `APP_INTERCEPTOR`) into `web.module.ts`? Is
    `WebModule.forRoot` ever composed without `AuthWebModule`?
35. **[web] rate limiting (PLAN §7)** — is the Redis login-only counter enough for
    MVP, or is `@nestjs/throttler` on public `content` GETs + cookie-authed POSTs
    expected before launch?
36. **[web] response-DTO coupling** — web response DTOs independent of
    `modules/post` view types with an explicit mapper, or is the structural-cast
    passthrough intentional (avoid duplication)? Same question for list/pagination
    envelope consistency.
37. **[web] request-DTO home** — reuse module command DTOs (auth style) or always
    web-local `createZodDto` + controller mapper (learning/content style)? Pick
    one for `references/http-api.md`.
38. **[web] CSRF** — is "`SameSite=Lax` cookie + POST-only mutations, no token, no
    Origin check" the accepted design for `learning`/`billing` state changes?
39. **[web] `/_healthz`** — always-200 with zero indicators intentional (liveness
    only), or should it probe DB/Redis (readiness)?
40. **[worker] dead-letter / retry policy** — is manual `engofy queue retry-failed`
    the MVP recovery story, or do the paid AI stages need explicit per-queue
    `retryLimit` + backoff + a `deadLetter` queue? (never set today)
41. **[cli] importer layering** — is "~90 LOC of entity seeding + `em.flush()`
    inline in the CLI command" the accepted shape for one-off importers (PLAN §1),
    or should that logic move into `post` domain/services to match auth layering?
42. **[worker] queue declaration ownership** — should `PostQueueBootstrapService`
    be the single `createQueue` authority (all queues, with policy/expiry) and
    `WorkerRegistrarService` only `boss.work()` pre-existing queues?
43. **[test] `migration:check` in CI** — add an entities-vs-migrations diff gate
    (prod config, `snapshot:true`) + fail `ensureMigrated` on a pending diff, or
    relax the SKILL.md wording to the drop-and-replay reality? (= open q20)
44. **[test] shared port fakes** — is a `test/fakes/` module (one canonical
    `implements` fake per port) wanted, or is per-spec bespoke faking intended?
45. **[test] coverage thresholds** — are the 80/80/70/80 gates green right now
    given untested workers/mail/telegram-client/anthropic-client? If only
    transitively, lower them or add direct specs?
46. **[test] browser e2e in CI** — should `apps/web` Playwright + `seed-web-e2e.ts`
    run in a workflow before launch, or stay a manual pre-release gate?
47. **[test] Redis isolation** — `FLUSHDB` a dedicated test Redis DB between
    integration tests, or is "unique random keys per test" the accepted contract
    despite the cross-run TTL leak?
48. **[test] shared app-config factory** — should `src/main.ts` and
    `test/http/web/setup/create-app.helper.ts` share one `configureApp()` so the
    web-ispec filter/pipe stack can't drift from production?
