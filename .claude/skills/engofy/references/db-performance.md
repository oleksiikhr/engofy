# DB performance — reads, N+1, indexes

> Reviewed: `post` + `learning` query handlers, entities (waves 1–2). See also `references/mikroorm.md`.

## Rules

| # | Rule | Reference |
|---|---|---|
| DP1 | Batch child loads with `id: { $in: [...] }` + in-memory grouping (`Map`); `Promise.all` for independent finds. **No N+1.** | `post/queries/get-post-detail/get-post-detail.handler.ts:45-56` |
| DP2 | Read-only query handlers pass `{ disableIdentityMap: true }` on every `find`/`findOne` (or project a plain read DTO). `auth` + all `learning` query handlers + `billing`'s `SubscriptionService` do this (Batch E). **Gap:** `post` query handlers (`get-feed`, `get-post-detail`, `get-grammar-*`) still don't. | `learning/queries/get-profile/get-profile.handler.ts:36-53`; `auth/queries/get-user/get-user.handler.ts:11-16` |
| DP3 | Denormalise a FK when it saves a join on a hot read — with a `// source of truth is X` comment. | `post/entities/sentence.entity.ts:25-29` (`postId` copied from `post_parts`) |
| DP4 | Slow queries (> `SLOW_QUERY_THRESHOLD`, default 2000 ms) are logged at `warn` with SQL. | `core/database/mikro-orm.logger.ts:75-85` |
| DP5 | Raw SQL is fine for set-based work the ORM can't express cheaply (`SELECT max(...)`, `distinct ::date`, `lower(col)` upserts, retention `DELETE`s) — via `em.getConnection().execute(..., em.getTransactionContext())`. | `telegram/services/shared/poll-updates.service.ts` (`max(update_id)`); `telegram/services/shared/prune-telegram-updates.service.ts` (30-day `DELETE`) |

## Index anti-patterns found — fixed (Batch D)

| Where | Was | Now |
|---|---|---|
| `sentence.postPartId`, `sentence_token.sentenceId`, `grammar_match.sentenceId`, `learning_cards.userId` | standalone `@Index()` on a column already the **leading** key of a composite `@Unique` — redundant btree, extra write cost | dropped (`Migration20260830120500`). The composite's own btree serves `WHERE <lead> IN (...)`. |
| `learning_cards` | standalone `@Index()` on `due` — doesn't serve the practice query `WHERE user_id=? AND due<=? ORDER BY due` | replaced with class-level `@Index({ properties: ['userId', 'due'] })`. |

## Unbounded reads found

| Where | Problem | D |
|---|---|---|
| ~~`learning/queries/get-profile` `computeStreak`~~ | **fixed (Batch E)** — now a single `SELECT DISTINCT to_char((reviewed_at AT TIME ZONE 'UTC')::date, …)` via `em.getConnection().execute` (`dailyStreakFromUtcDays` consumes the day strings). | — |
| `learning/queries/get-dictionary` | loads **all** published posts + all their `post_parts` + walks every node-tree span on each `/dictionary` hit (stands in for the missing `post_word`/`post_phrase`). Bound it, or build the projection. | D10/D12 |
| `post/queries/get-feed` | offset pagination on `publishedAt desc` — every new publish shifts the window. Batch K took the cheap path: the misleading "stable offset" comment is now replaced with the truth + a `TODO` for keyset on `(publishedAt, id)` (the query already `orderBy`s that exact tuple). Full keyset is a deferred feature, not a bug. | — |
