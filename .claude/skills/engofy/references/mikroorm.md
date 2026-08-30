# MikroORM — EntityManager, entities, write patterns

> Reviewed: `auth`, `post`, `core/database` (wave 1). Baseline: `src/modules/auth`.
> See also `references/dates.md`, `references/migrations.md`, `references/db-performance.md`.

## EntityManager

| # | Rule | Reference |
|---|---|---|
| M1 | Import `EntityManager` from `@mikro-orm/postgresql`; inject directly into services/handlers. | `services/session.service.ts:1,11` |
| M2 | Deferred write → `em.create` / `em.persist` / `em.remove`; the **facade** flushes (see `references/cqrs.md`). | `services/session.service.ts:20` |
| M3 | Idempotent find-or-create → `em.upsert(Entity, {…}, { onConflictFields, onConflictAction: 'merge' \| 'ignore', onConflictExcludeFields })`. Commits immediately. | `services/complete-login.service.ts:38-43`; `services/challenge.service.ts:61-78` |
| M4 | Bulk delete before rebuild → `em.nativeDelete(Entity, { … })`. Used by rebuild-style pipeline stages. | `commands/tag-grammar/tag-grammar.handler.ts:91-93` |
| M5 | Raw SQL → `em.getConnection().execute(sql, params, 'run'\|'all', this.em.getTransactionContext())`. Pass `this.em.getTransactionContext()` as the ctx arg so it joins the current transaction. | `services/session.service.ts:60-71`; `telegram/services/shared/{poll-updates,prune-telegram-updates}.service.ts` |
| M6 | Raw SQL bypasses custom types — pass `.toJSDate()` for every Luxon `DateTime` bound param (pg driver serializes `Date`, not `DateTime`). | `services/challenge.service.ts:129-136` |
| M7 | Fresh reads that must not see identity-map state → `findOneOrFail(…, { disableIdentityMap: true })`. | `queries/get-user/get-user.handler.ts:11-16` |

## Entity conventions

| # | Rule | Reference |
|---|---|---|
| E1 | Decorators from `@mikro-orm/decorators/legacy`. | `entities/user.entity.ts:2` |
| E2 | PK: `@PrimaryKey({ type: 'uuid' }) id: string = uuidv7();` (uuid **v7**). | `entities/user.entity.ts:14-15` |
| E3 | Defaulted fields are typed `Opt<T>` and given the default inline. | `entities/user.entity.ts:25-26` |
| E4 | Timestamps: `type: LuxonTimestampType`, `onCreate: () => DateTime.now()`, `onUpdate` where mutable. See `references/dates.md`. | `entities/user.entity.ts:25-33` |
| E5 | Enums stored as `text` + a CHECK constraint (not native pg enum); values are `snake_case` strings. | `Migration20260824192359.ts:77-108` |
| E6 | Enum decorator: **object form** `@Enum({ items: () => X })`. (Batch K converted the last 3 `@Enum(() => X)` shorthands in post — no drift left.) | `entities/subscription.entity.ts:24` |
| E7 | FKs are bare `@Property({ type: 'uuid' })` columns — **no `@ManyToOne` relations**. "FK → x" lives in a comment only. | `entities/auth-session.entity.ts` `userId`; `entities/sentence-token.entity.ts:70-85` |
| E8 | Multi-column identity → `@Unique({ properties: [...] })` on the entity. | `entities/post-part.entity.ts:32` |
| E9 | Case-insensitive uniqueness → raw `expression` unique index (`lower(col)`). New technique vs auth; used by the lexicon. | `entities/word.entity.ts:13-17` |
| E10 | Custom column types live in `src/core/database/types/` (`LuxonTimestampType`, `Url`). | `src/core/database/types/luxon-timestamp.type.ts` |

## Anti-patterns found (wave 1 — do not copy)

| Where | Problem |
|---|---|
| ~~`entities/grammar-match.entity.ts` — no unique constraint~~ | **fixed (Batch D)** — composite `@Unique(sentenceId, grammarUsagePointId, tokenStart, tokenEnd)`; `TagGrammarHandler` keeps delete-by-sentence AND dedupes spans in memory before persist. |
| ~~standalone `@Index()` on a composite-unique leading column~~ | **fixed (Batch D)** — dropped on `sentence.postPartId`, `sentence_token.sentenceId`, `grammar_match.sentenceId`, `learning_cards.userId`; `learning_cards` gained class-level `@Index(['userId','due'])`. `sentence.postId` (denormalised, not in a unique) kept. |
| `domain/node-tree.parser.ts` + `node-tree.type.ts` | **partly addressed (Batch D)** — `parseDoc` is now wired at read time in `get-post-detail.handler.ts:58`; `node-tree.type.ts` / `post-part-body.type.ts` comments no longer name a non-existent `Post.body`. `NodeTreeType` itself is still mapped to nothing (kept as the drop-in for a future `Post`-level tree column, D12). |
| `services/complete-login.service.ts:22-31` | backfills `@Unique` `googleSub` after `onConflictAction:'ignore'` — a Google email change can create a 2nd row and violate the constraint on flush. |
| ~~`poll-updates.service.ts` — audit row flushed after `dispatch()`~~ | **fixed (Batch G)** — `dispatch()` → `postService.ingest()` runs its own `em.flush()` on the shared UoW, so the `telegram_updates` row rode that inner flush with `processed=false`; a crash in the window stranded it. The row is now marked `processed=true` and flushed **before** `dispatch()`. Flush-per-row work that calls into another flushing method must commit its own state first. |

## `disableIdentityMap` for query handlers

`auth` + every `learning` query handler + `billing`'s `SubscriptionService`
pass `{ disableIdentityMap: true }` on their reads (Batch E). **Still owed:**
the `post` query handlers (`get-feed`, `get-post-detail`, `get-grammar-*`). New
query handlers match `auth`/`learning` (or project a read DTO).
