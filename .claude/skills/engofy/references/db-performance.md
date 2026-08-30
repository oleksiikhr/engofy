# DB performance — reads, N+1, indexes

> Reviewed: `post` + `learning` query handlers, entities (waves 1–2). See also `references/mikroorm.md`.

## Rules

| # | Rule | Reference |
|---|---|---|
| DP1 | Batch child loads with `id: { $in: [...] }` + in-memory grouping (`Map`); `Promise.all` for independent finds. **No N+1.** | `post/queries/get-post-detail/get-post-detail.handler.ts:45-56` |
| DP2 | Read-only query handlers pass `{ disableIdentityMap: true }` (or project a plain read DTO). **Gap:** no `post` or `learning` query handler does this — only `auth/get-user`. | `auth/queries/get-user/get-user.handler.ts:11-16` |
| DP3 | Denormalise a FK when it saves a join on a hot read — with a `// source of truth is X` comment. | `post/entities/sentence.entity.ts:25-29` (`postId` copied from `post_parts`) |
| DP4 | Slow queries (> `SLOW_QUERY_THRESHOLD`, default 2000 ms) are logged at `warn` with SQL. | `core/database/mikro-orm.logger.ts:75-85` |
| DP5 | Raw SQL is fine for set-based work the ORM can't express cheaply (`SELECT max(...)`, `distinct ::date`, `lower(col)` upserts) — via `em.getConnection().execute(..., em.getTransactionContext())`. | `telegram/services/poll-updates.service.ts:67-74` |

## Index anti-patterns found (fix owed)

| Where | Problem |
|---|---|
| `sentence.entity.ts:28`, `sentence-token.entity.ts:24`, `learning-card.entity.ts:38` | standalone `@Index()` on a column that is already the **leading** key of a composite `@Unique` on the same entity — redundant btree, extra write cost. Drop it. |
| `learning_cards` | the hot practice query is `WHERE user_id=? AND due<=? ORDER BY due` — the standalone `due` index doesn't serve it. Add `@Index({ properties: ['userId', 'due'] })`. |

## Unbounded reads found (fix owed)

| Where | Problem | D |
|---|---|---|
| `learning/queries/get-profile` `computeStreak` | loads **every** `review_logs` row for all the user's cards on each `/profile` hit, only to derive distinct UTC days. Push `select distinct (reviewed_at at time zone 'UTC')::date` to SQL. | — |
| `learning/queries/get-dictionary` | loads **all** published posts + all their `post_parts` + walks every node-tree span on each `/dictionary` hit (stands in for the missing `post_word`/`post_phrase`). Bound it, or build the projection. | D10/D12 |
| `post/queries/get-feed` | offset pagination on `publishedAt desc` — every new publish shifts the window (the "stable offset" comment is wrong). Keyset on `(publishedAt, id)` or accept + fix the comment. | — |
