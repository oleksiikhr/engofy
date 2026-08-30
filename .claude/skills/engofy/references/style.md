# Style — TS / Nest / ESM idioms

> Reviewed: repo-wide (waves 1–2). Enforced by `biome check src/ test/` + `tsc --noEmit`.

## Rules

| # | Rule | Reference |
|---|---|---|
| ST1 | **ESM**: every relative import carries a `.js` extension. | any file |
| ST2 | `verbatimModuleSyntax` is on — type-only imports use `import type` / inline `type` in named lists. | `auth/auth.service.ts:5` |
| ST3 | File naming: `kebab-case.<role>.ts` — `.entity.ts`, `.service.ts`, `.command.ts`, `.query.ts`, `.handler.ts`, `.dto.ts`, `.enum.ts`, `.error.ts`, `.config.ts`, `.template.ts`, `.type.ts`, `.helper.ts`, `.port.ts`, `.provider.ts`, `.processor.ts`, `.cron.ts`. | `auth/` tree |
| ST4 | Test files: `.spec.ts` (unit), `.ispec.ts` (integration) — colocated with the code. | `references/tests.md` |
| ST5 | `biome-ignore` always carries a justification string. | `core/queue/outbox-sender.service.ts:48` |
| ST6 | Structured params/results are named interfaces, not positional args. | `auth/services/challenge.service.ts:39-46` |
| ST7 | PK: `@PrimaryKey({ type: 'uuid' }) id: string = uuidv7();` — uuid **v7**. Defaulted fields typed `Opt<T>` with the default inline. | `references/mikroorm.md` E2–E3 |
| ST8 | Entity `@Enum` → object form `@Enum({ items: () => X })`. (post/learning have `@Enum(() => X)` shorthand drift — don't copy.) | `references/mikroorm.md` E6 |
| ST9 | Module `providers` group handlers into named `commandHandlers` / `queryHandlers` arrays spread into `providers`. (learning/billing/cli use one flat array — drift.) | `auth/auth.module.ts:22-30` |
| ST10 | `ConfigModule.forFeature(A, B, C)` is variadic — one call, not three. | drift in `auth.module.ts:33-38`, `telegram.module.ts:13-16` |
| ST11 | Never `new Date()` — Luxon `DateTime` only (`references/dates.md`). | `CLAUDE.md` |
| ST12 | Don't return a managed ORM entity across a module / `CommandBus` boundary — plain value / DTO / id (`references/cqrs.md` Q6, D2). | — |

## Naming drift to avoid (found in review)

| Where | Issue |
|---|---|
| `post/domain/node-tree.type.ts` vs `node-tree.types.ts` | differ only by a trailing `s` — trivially mis-imported. Rename the custom-type file. |
| `post/domain/` | 3 slugify implementations (`generateSlug`, `grammarConstructionSlug`, `parse-slug-id`) with different rules. Share one. |
| `post/domain/` | `spansOverlap` / `overlaps` half-open-interval helper duplicated across 4 files. Extract `domain/span-range.ts`. |
| `resolve-session.dto.ts` | `token` vs `sessionToken` for the same concept across sibling DTOs; `z.string()` without `.min(16)` that siblings have. |

## `biome.json` scope

`biome check` covers everything **except** `src/metadata.ts`, migration `*.json`
snapshots, and `apps/**`. `tsc --noEmit` (`pnpm type`) covers `src/` **and**
`test/` (no `include` in `tsconfig.json`, only `exclude: [apps]`).
