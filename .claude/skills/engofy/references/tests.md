# Tests — unit / integration / e2e

> Reviewed: `auth`, `post`, `core/*` (wave 1); `test/` infra + vitest + CI (wave 2).

## The tiers (vitest `projects`)

| Suffix | Project | Runs against | Built with | Use for |
|---|---|---|---|---|
| `*.spec.ts` | `unit` (parallel, isolated) | nothing — no DB, no DI | plain construction / `vi.spyOn` / `vi.stubGlobal` | pure functions, `domain/*`, helpers, template renderers |
| `*.ispec.ts` | `integration` (**serial** — `maxWorkers:1`, `fileParallelism:false`, `isolate:false`) | **real** Postgres + Redis + pg-boss | `createIntegrationSuite({ imports: [XModule] }, { builderHook })` | every handler; every DB-touching service; wiring (ETag interceptor, error filter, outbox) |
| web `*.ispec.ts` under `test/http/web` | `integration` | full Fastify app + supertest | `createWebE2ESuite(...)` | web request/response, filter/pipe stack |

There is **no dedicated e2e project.** `test/e2e/` holds only `seed-web-e2e.ts`
(a fixture seeder for the out-of-tree `apps/web` Playwright suite). Browser e2e is
**not** run in CI — treat it as a manual pre-release gate.

Rule of thumb (observed): **every handler and every DB-touching service has an
`.ispec.ts` sibling**; the only `.spec.ts` files are the ones with zero I/O.
(Remaining gaps — see `REVIEW.md`: `post` query handlers, learning
`get-dictionary`, `TelegramClientService`. Worker processors / `MAILER` /
`AnthropicClientService` / learning `CardLimitService` + `SkillProgressService`
now have direct specs — Batch I.)

## Integration-suite contract

`suite.command` / `suite.query` replicate the facade: `execute` → `em.flush()` →
`em.clear()`. Reference: `test/setup/int-suite.helper.ts:46-60`.

| # | Rule | Reference |
|---|---|---|
| T1 | Port fakes injected via `builderHook` + `.overrideProvider(X).useClass/useValue(FakeX)`. Canonical fakes live in `test/fakes/{ai,nlp,mailer,telegram,pg-boss}.fake.ts` — one `implements`-checked class per port; specs configure them (`onComplete` / `onCompleteStructured` handlers, an overrides map, `nextError`, …). Don't re-roll a bespoke fake in the spec. | `test/fakes/*.fake.ts`; `commands/assess-complexity/assess-complexity.handler.ispec.ts` |
| T1b | `login-with-google`'s inline `FakeGoogleIdTokenVerifierService` stays inline — auth's Google verifier is not a `core/*` port (D9). | `commands/login-with-google/login-with-google.handler.ispec.ts` |
| T2 | Read config in tests with `suite.moduleRef.get(XConfig.KEY)`. | `services/challenge.service.ispec.ts:19` |
| T3 | Make test data unique with `randomUUID()` / `Math.random().toString(36)` — no shared fixtures. | `services/challenge.service.ispec.ts:22-24` |
| T4 | Per-test isolation = **one Postgres transaction, rolled back in `afterEach`** (no truncate, no per-test schema). Schema is built once per worker process: `drop schema public cascade` + replay all migrations from zero. | `test/setup/orm-suite-lifecycle.helper.ts:12-21`; `test/setup/migration-guard.helper.ts:6-23` |
| T5 | The rollback model depends on **all three**: `RequestContext` skipped (`shouldSkipRequestContext()`), `allowGlobalContext:true`, `implicitTransactions:false`. A forked `em` that commits (e.g. a web path calling `em.fork()`) escapes the rollback and leaks rows into the shared serial DB. | `core/database/helpers/request-context.helper.ts:5`; `core/database/mikro-orm.setup.ts:38-39` |
| T6 | Redis is not transaction-rolled-back, so `useOrmSuiteLifecycle` runs `redis.flushdb()` in `afterEach`. The test env points every client at a dedicated logical DB (`REDIS_DB=1` in `.env.test`, `redis.config.ts` `db`), so the flush only ever clears throwaway state. Unique random keys per test are still good practice. | `test/setup/orm-suite-lifecycle.helper.ts` |
| T7 | Queue assertions: `useQueueSpy(suite)` → `vi.spyOn(OutboxSenderService, 'send')` + `assertSent(name, pred)` / `assertNotSent(name)`. `createIntegrationSuite` installs a no-op `PG_BOSS` stub (`test/fakes/pg-boss.fake.ts`) by default — no real worker, no live pg-boss. Pass `{ realPgBoss: true }` only for specs that read `pgboss.job` (`outbox-sender.service.ispec.ts`). | `test/setup/queue-spy.helper.ts`; `test/setup/create-app.helper.ts` |
| T8 | AI/NLP live-smoke tests exist but run manually (need real keys); CI covers those paths with per-spec fakes. | PLAN Зріз 2–4 notes |

## Verify commands (what CI actually runs — `.github/workflows/app.yaml`)

```
pnpm type                # tsc --noEmit — covers src/ AND test/
pnpm lint:check          # biome check
pnpm test:cov            # vitest run --coverage — ENFORCES coverage 80/80/70/80
pnpm migration:up && pnpm migration:check   # entity/migration drift gate (D17)
pnpm build && git diff --exit-code src/metadata.ts   # swagger metadata drift
```

Separate CI job `nlp-service`: `pip install -r nlp-service/requirements-dev.txt`
then `pytest -q` (`nlp-service/test_app.py` — the spaCy offset contract).

The vitest integration project sets an explicit `hookTimeout: 60_000`
(`vitest.config.ts`) — the first `beforeAll` replays every migration from zero.

`pnpm migration:check` (`mikro-orm migration:check`, prod config → `snapshot:true`)
now exists and runs in CI after the test step. `ensureMigrated`
(`test/setup/migration-guard.helper.ts`) also fails the whole suite on a pending
schema diff via `orm.migrator.checkSchema()` after the drop-and-replay. Closes
`REVIEW.md` open question 43 / D17.

## Coverage gaps found (wave 1)

| Area | Missing spec | Status |
|---|---|---|
| `core/ai/anthropic-client.service.ts` | `$schema` stripping, tool extraction, `max_tokens`, cost math | **done** — `anthropic-client.service.spec.ts` (Batch I) |
| `nlp-service/app.py` | the offset math is the whole contract | **done** — `nlp-service/test_app.py` + CI job (Batch I) |
| worker processors, `MAILER` / `ChallengeMailerService` | no direct spec | **done** — `post-processors.spec.ts`, `send-challenge-email.processor.spec.ts`, `challenge-mailer.service.spec.ts` (Batch I) |
| `learning` `CardLimitService` / `SkillProgressService` | no direct spec | **done** — `*.ispec.ts` (Batch I) |
| `core/database/helpers/change-set.helper.ts`, `request-context.helper.ts` | no `.spec.ts` | **done** — `change-set.helper.spec.ts`, `request-context.helper.spec.ts` (Batch K) |
| `post/domain/` | `collect-spans`, `generate-slug`, `generate-short-id`, `upsert-phrase-id`, `annotation-prompt` uncovered | **done** (Batch K) — `collect-spans.spec.ts`, `generate-slug.spec.ts`, `generate-short-id.spec.ts` (also documents the `byte % 62` modulo bias + no-retry-on-`@Unique` as a known/accepted weakness), `annotation-prompt.spec.ts`, `upsert-phrase-id.ispec.ts` (raw upsert needs PG); new `span-range.spec.ts` + `core/helpers/slug.helper.spec.ts` for the Batch K extractions |

Dead test scaffolding removed (Batch I): `test/helpers/factory.helper.ts`,
`@faker-js/faker` dep, `makeChangeSet` / `makeFlushArgs`, the `authed` flag on
`createWebE2ESuite.request` (web auth is cookie-based; nothing implemented it).
