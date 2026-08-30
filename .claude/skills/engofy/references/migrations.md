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

## D17 — `migration:check` (confirmed, not yet done)

- Add a `pnpm migration:check` script (`mikro-orm migration:check`, prod config
  with `snapshot:true`) + a CI step in `.github/workflows/app.yaml`.
- `ensureMigrated` (test) should also fail on `getPendingMigrations()` / a pending
  schema diff.
- Migrations stay plain-generated — the **check** is the drift gate, not
  hand-written guards. (This reconciles the older SKILL.md "idempotent, guarded"
  wording with reality.)

## Fixes owed (from the review — write these migrations)

| D | Migration |
|---|---|
| D1 | (no schema) — `DomainError.status` is code-only |
| D5/D4 | `PostPipelineRunStatus` — no `Running` value; `Running` derived from `startedAt ∧ !completedAt` |
| D12 | `PostSource` + `attributionText` (NOT NULL) + `PostSourceType` enum + CHECK |
| D12 | `grammar_matches` + composite `@Unique(sentence_id, grammar_usage_point_id, token_start, token_end)` |
| D12 | `posts.status` CHECK: `Annotating`/`Annotated` → `Processing` |
| D12 | `Subscription` table move to `modules/billing/entities/` (entity move only — table unchanged; drop `SubscriptionStatus.Expired` from the CHECK) |
| D12 | `telegram_updates.telegram_message_id` → `update_id` (rename column) |
| — | drop the redundant standalone `@Index()` on composite-unique leading columns (`sentence`, `sentence_token`, `learning_card.userId`); add `@Index(['userId','due'])` on `learning_cards` |
| — | `review_logs` — drop `created_at` (keep `reviewed_at`) |
