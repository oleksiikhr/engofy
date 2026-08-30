# Config

> Reviewed: `core/config`, every module `config/`, `.env.*` (waves 1–2). See `REVIEW.md` D18.

## Rules

| # | Rule | Reference |
|---|---|---|
| C1 | One namespace per subsystem: `export default registerAs('<ns>', () => ({ ... }))`. | `auth/config/auth.config.ts:4` |
| C2 | Built from `core/helpers/env.helper` readers (`envString`, `envNumber`, `envBool`, `envEnum`, `envRequiredString`, `envStringList`) — the **only** `process.env` access primitive (trims, typed, fallback-or-throw). Exception: pre-DI bootstrap (`core/app.ts`, `core/observability/sentry.ts`). | `core/helpers/env.helper.ts` |
| C3 | Loaded with `ConfigModule.forFeature(XConfig)` (variadic — one call for several); consumed with `@Inject(XConfig.KEY) config: ConfigType<typeof XConfig>`. | `auth/services/session.service.ts:12-15` |
| C4 | Duration keys are `…Ms` numbers; do the `DateTime` arithmetic in the service (`.plus({ milliseconds: config.xMs })`). | `auth/config/auth.config.ts` |
| C5 | Env-file precedence: `.env.<env>.local` > `.env.<env>` > `.env.local` > `.env`; disabled entirely in production. | `app.module.ts:34-40` |
| C6 | An empty env value is a valid "feature off" switch (`TELEGRAM_*` empty → both crons no-op). | `telegram/config/telegram.config.ts` |

## Known issues (fix owed)

| Item | D |
|---|---|
| The MikroORM connection is configured **outside** `@nestjs/config` (`mikro-orm.setup.ts` hardcodes `engofy/engofy` + `preferEnvVars:true` reading native `MIKRO_ORM_*`). `core/queue/config/queue.config.ts` describes the **same** DB with **different** defaults (`postgres/postgres`) → pg-boss can target different creds. **D18: share the ORM config object — one source.** | D18 |
| `LuxonTimestampType` writes an offset-less literal into `timestamptz` → Postgres interprets it in the session `TimeZone`; nothing forces UTC. **D18: set `timezone: 'UTC'` in the pg `driverOptions`.** | D18 |
| `S3_CORS_MAX_AGE` / `S3_PUBLIC_URL` declared but never read. | — |
| `PUBLIC_URL` has no fallback but is passed to CORS `origin` with `credentials:true`. Make it `envRequiredString`. | — |
| Token style: `MAILER` is `Symbol('MAILER')`; `PG_BOSS`/`REDIS_CLIENT`/`S3_CLIENT`/`WORKER_QUEUES` are plain strings. Standardise on `Symbol()`. | — |
| `.env.test` `MIKRO_ORM_DB_NAME=engofy-testing` vs CI `engofy`. Align. | D17 |
