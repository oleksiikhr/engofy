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
| ST8 | Entity `@Enum` → object form `@Enum({ items: () => X })`. (Batch K cleared the last 3 `@Enum(() => X)` shorthands in post — no drift left.) | `references/mikroorm.md` E6 |
| ST9 | Module `providers` group handlers into named `commandHandlers` / `queryHandlers` arrays spread into `providers`. (learning/billing/cli use one flat array — drift.) | `auth/auth.module.ts:22-30` |
| ST10 | One `ConfigModule.forFeature(X)` call per config namespace. `@nestjs/config`'s `forFeature` takes a **single** factory (verified in the installed dist) — it is *not* variadic, so `auth.module.ts`'s three calls are correct, not drift. | `auth/auth.module.ts:33-35` |
| ST11 | Never `new Date()` — Luxon `DateTime` only (`references/dates.md`). | `CLAUDE.md` |
| ST12 | Don't return a managed ORM entity across a module / `CommandBus` boundary — plain value / DTO / id (`references/cqrs.md` Q6, D2). | — |

## Naming drift (found in review — all cleared by Batch K)

| Where | Issue | Resolution |
|---|---|---|
| `post/domain/node-tree.type.ts` vs `node-tree.types.ts` | differ only by a trailing `s` — trivially mis-imported. | renamed to `node-tree-json.type.ts` (nothing imported it). |
| slugify | `generateSlug` + `grammarConstructionSlug` each hand-rolled the same normalise/hyphenate logic with subtly different rules. | shared `core/helpers/slug.helper.ts` `slugify(input, { maxLength? })`; both delegate. `parse-slug-id` is a shortId *parser*, not a generator — left alone. |
| overlap helpers | `spansOverlap` / `overlaps` / inline `contains` half-open-interval logic duplicated across 5 domain files. | extracted `post/domain/span-range.ts` (`spansOverlap`, `contains`, `SpanRange`); all call sites use it. |
| `resolve-session.dto.ts` | field `token` (vs `sessionToken` elsewhere); `z.string()` without the `.min(16)` siblings have. | renamed to `sessionToken`, added `.min(16)`; command/handler/guard/service + ispecs updated; DTO imported `import type`. |

## `biome.json` scope

`biome check` covers everything **except** `src/metadata.ts`, migration `*.json`
snapshots, and `apps/**`. `tsc --noEmit` (`pnpm type`) covers `src/` **and**
`test/` (no `include` in `tsconfig.json`, only `exclude: [apps]`).
