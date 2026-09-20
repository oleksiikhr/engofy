# Migrations

> Reviewed: `core/database/migrations`, test migration guard, CI (waves 1–2).

## Rules

| # | Rule | Reference |
|---|---|---|
| MG1 | One migration file per logical schema-change group (one per entity group in a slice). | PLAN Зріз 1 |
| MG2 | Vanilla MikroORM-generated: `this.addSql(...)` create/alter in `up`, `drop ... if exists cascade` in `down`. No hand-written idempotency guards. | `Migration20260919151755.ts` |
| MG3 | Enums are `text` columns + a `CHECK` constraint — updating an enum value means a migration that rewrites `<table>_<col>_check`. | `Migration20260919151755.ts` (posts_status_check) |
| MG4 | History is **immutable once a `v*` tag has shipped** — never edit a shipped migration; rename/rework via a new one. Before the first deploy the history is a single initial migration: regenerate it (`migration:create --initial` on an empty DB) instead of stacking alters. | `Migration20260919151755.ts` |
| MG5 | Idempotent **data** imports (EGP, irregular verbs, word frequency) are CLI commands keyed by a natural key (`egpIndex`, `lower(lemma)`), **not** migrations. | `entrypoints/cli/grammar/*` |
| MG6 | `.snapshot-engofy.json` is tracked; under **test** `snapshot:false` (schema is dropped + all migrations replayed from zero per worker process). | `mikro-orm.setup.ts:36`; `test/setup/migration-guard.helper.ts` |
| MG7 | Adding an FK to a table that may hold orphans: in the same migration, `delete from "<child>" where "<fk>" not in (select "id" from "<parent>");` **before** the `add constraint ... foreign key`. Nullable FK → `update ... set "<fk>" = null` instead of delete when the row is still meaningful. Generate with `migration:create`, then insert the delete `addSql` above the generated constraint. | `Migration20260920124054.ts` |

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
