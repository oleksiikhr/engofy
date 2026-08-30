# Migrations

> Reviewed: `core/database/migrations`, test migration guard, CI (waves 1–2). See `REVIEW.md` D17.

## Rules

| # | Rule | Reference |
|---|---|---|
| MG1 | One migration file per logical schema-change group (one per entity group in a slice). | PLAN Зріз 1 |
| MG2 | Vanilla MikroORM-generated: `this.addSql(...)` create/alter in `up`, `drop ... if exists cascade` in `down`. No hand-written idempotency guards. | `Migration20260824192359.ts` |
| MG3 | Enums are `text` columns + a `CHECK` constraint — updating an enum value means a migration that rewrites `<table>_<col>_check`. | `Migration20260829153800.ts` (posts_status_check) |
| MG4 | History is **immutable** — never edit a shipped migration. Rename/rework via a new one. | PLAN Зріз 0 |
| MG5 | Idempotent **data** imports (EGP, irregular verbs, word frequency) are CLI commands keyed by a natural key (`egpIndex`, `lower(lemma)`), **not** migrations. | `entrypoints/cli/grammar/*` |
| MG6 | `.snapshot-engofy.json` is tracked; under **test** `snapshot:false` (schema is dropped + all migrations replayed from zero per worker process). | `mikro-orm.setup.ts:36`; `test/setup/migration-guard.helper.ts` |

## D17 — `migration:check` (done, Batch D)

- `pnpm migration:check` = `mikro-orm migration:check` (run via
  `node --import @swc-node/register/esm-register node_modules/@mikro-orm/cli/cli.js`
  — the config is a `.ts` file). Sibling scripts: `migration:create` / `up` /
  `down`. Prod config → `snapshot:true`, so the check diffs
  `.snapshot-engofy.json` against entity metadata (no DB needed for the diff
  itself). **Keep `.snapshot-engofy.json` in sync** — regenerate it after any
  entity/enum change with `migration:create --blank` (then delete the blank
  file, keep the snapshot).
- CI step (`app.yaml`, after tests): `pnpm migration:up && pnpm migration:check`
  — `up` also proves the migrations apply to a clean DB.
- `ensureMigrated` (`test/setup/migration-guard.helper.ts`) calls
  `orm.migrator.checkSchema()` after the drop-and-replay and throws with the
  pending schema diff on drift (under test `snapshot:false`, so this is a live
  DB-vs-entities diff).
- Migrations stay plain-generated — the **check** is the drift gate, not
  hand-written guards. (This reconciles the older SKILL.md "idempotent, guarded"
  wording with reality.)

## Fixes owed (from the review — write these migrations)

| D | Migration | status |
|---|---|---|
| D1 | (no schema) — `DomainError.status` is code-only | n/a |
| D5/D4 | `PostPipelineRunStatus` — no `Running` value; `Running` derived from `startedAt ∧ !completedAt` | done (Batch C) |
| D12 | `PostSource` + `attributionText` (NOT NULL) + `PostSourceType` enum + CHECK | done — `Migration20260830120200` (Batch D) |
| D12 | `grammar_matches` composite `@Unique(sentence_id, grammar_usage_point_id, token_start, token_end)` | done — `Migration20260830120500` |
| D12 | `posts.status` CHECK: `Annotating`/`Annotated` → `Processing` | done — `Migration20260830120100` |
| D12 | `Subscription` move to `modules/billing/` + drop `SubscriptionStatus.Expired` from CHECK | done — `Migration20260830120600` |
| D12 | `telegram_updates.telegram_message_id` → `update_id` (rename column + constraint) | done — `Migration20260830120400` |
| — | drop redundant standalone `@Index()` on composite-unique leading columns; add `@Index(['userId','due'])` on `learning_cards` | done — `Migration20260830120500` |
| — | `review_logs` — drop `created_at` (keep `reviewed_at`) | done — `Migration20260830120300` |
| D7 | drop legacy `'fetch'` from `post_pipeline_runs_stage_check` | done — `Migration20260830120000` |
| D15 | `post_publications.retry_count` (`int not null default 0`) — bounds the failed-announcement re-send loop | done — `Migration20260830130000` (Batch G) |
