# Dates — Luxon `DateTime` only

> Reviewed: `auth`, `post`, `core/database` (wave 1). Also stated in `CLAUDE.md`.

## Rules

| # | Rule | Reference |
|---|---|---|
| D1 | **`new Date()` is banned.** Use Luxon `DateTime` everywhere — it is immutable, `Date` is not. | `CLAUDE.md` |
| D2 | Entity timestamp field: type `DateTime`, `type: LuxonTimestampType`, default `DateTime.now()`. | `entities/user.entity.ts:25-33` |
| D3 | In services: `DateTime.now()`, `.plus({ milliseconds, days, … })`. Config durations are stored as `…Ms` numbers. | `services/session.service.ts:23-25`; `config/auth.config.ts` |
| D4 | Relational comparisons (`<=`, `>=`) work directly on `DateTime` values. | `services/session.service.ts:36` |
| D5 | Raw SQL bypasses `LuxonTimestampType` — pass `.toJSDate()` for every bound `DateTime` param. This is the **only** place `.toJSDate()` appears. | `services/session.service.ts:64-67` |

## `LuxonTimestampType`

`src/core/database/types/luxon-timestamp.type.ts` — (de)serializes `DateTime` ↔
`timestamptz`.

- Write: `dt.toSQL({ includeOffset: false })` — an **offset-less** UTC wall-time literal.
- Read: `DateTime.fromSQL(value, { zone: 'utc' })`.
- Defensively accepts a stray JS `Date`.

> **Open question (wave 1):** the offset-less literal means Postgres interprets it
> in the session `TimeZone`. Nothing in the repo forces UTC — it currently works
> only because the `postgres` image defaults to UTC. See `REVIEW.md` open question 15.
