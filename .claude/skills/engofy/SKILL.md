---
name: engofy
description: >-
  Engofy NestJS backend conventions and best practices. Consult at the start of
  any task that writes, reviews, refactors, or debugs code under src/, test/,
  nlp-service/, or apps/. Routes to focused rule files for architecture, CQRS,
  MikroORM, migrations, DB performance, dates, HTTP/API, validation, error
  handling, queues, the content pipeline, AI, NLP, mail, security, config, and
  tests.
---

# Engofy Backend — Conventions & Best Practices

NestJS (Fastify) · MikroORM/Postgres · pg-boss · nestjs-zod · Luxon · CQRS (`@nestjs/cqrs`) · spaCy `nlp-service` · Claude API.

## Consistency first

The right pattern is the one the codebase already uses. `src/modules/auth` is the
**reference implementation** — mirror it. Read the neighbouring files before
adding code; a locally-consistent choice beats a globally-better one.

## How to apply

1. Identify the concern(s) from the index below; read those rule files.
2. Open the named reference implementation and match its structure, naming, layering.
3. Write code that reads like its neighbours (comment density, idiom, file names).
4. Verify: `pnpm run type` · `biome check src/ test/` · `pnpm test` · `pnpm migration:check`.

## Rule index

| Concern | File | Reference implementation |
|---|---|---|
| Module anatomy, layering, entrypoints | `references/architecture.md` | `src/modules/auth` |
| Command vs Query, buses, flush ownership | `references/cqrs.md` | `src/modules/auth/commands`, `auth.service.ts` |
| TS / Nest / ESM idioms, file naming, biome | `references/style.md` | repo-wide |
| EntityManager, flush, upsert, entities, custom types | `references/mikroorm.md` | `src/modules/auth/services/session.service.ts` |
| Migrations: idempotent, one per group, guarded | `references/migrations.md` | `src/core/database/migrations` |
| N+1, populate, qb, indexes, denormalized FKs, raw SQL | `references/db-performance.md` | `src/modules/post/queries` |
| Luxon `DateTime` everywhere, `LuxonTimestampType` | `references/dates.md` | `src/modules/auth/entities` |
| Thin controllers, guards, response DTOs, Swagger | `references/http-api.md` | `src/entrypoints/web` |
| nestjs-zod DTOs, `ZodValidationPipe`, error shape | `references/validation.md` | `src/entrypoints/web/auth/dto` |
| `DomainError` hierarchy, HTTP mapping, all-or-nothing | `references/error-handling.md` | `src/modules/*/errors` |
| pg-boss queues, processors, worker/cron hosts, CLI | `references/queue-jobs.md` | `src/entrypoints/worker`, `src/entrypoints/cron` |
| Content pipeline: `PostPipelineRun` idempotency, chaining | `references/pipeline.md` | `src/modules/post/commands` |
| `core/ai` port, `completeStructured`, inline-markup, evals | `references/ai.md` | `src/core/ai`, `draft/` |
| `nlp-service`, `NlpClient` port, deterministic spaCy domain | `references/nlp.md` | `src/core/nlp`, `nlp-service/` |
| Mail port, templates, queued send | `references/mail.md` | `src/modules/auth/mails` |
| Sessions, token/OTP hashing, rate limits, secrets | `references/security.md` | `src/modules/auth` |
| `core/config` + per-module config namespaces | `references/config.md` | `src/modules/auth/config` |
| unit / ispec / e2e split, helpers, port fakes | `references/tests.md` | `test/` |

## Decision rules

- Prefer a NestJS / MikroORM feature over a hand-rolled one; extract a domain
  helper before an abstraction you do not yet need.
- Any state change goes through a **Command**; reads go through a **Query**.
- Handlers never `flush()` — the **facade** does. Documented exceptions:
  `AnnotatePostHandler` and `SpacyParsePostHandler` (flush-per-`PostPart`); cron
  poller services in `services/shared/` (flush-per-row); CLI importer commands.
  See `references/cqrs.md`.
- A Command must not return a managed ORM entity — plain value / DTO / id.
- AI / LLM calls run **only in pg-boss workers**, never on an HTTP path.
- Offsets and annotations are validated **all-or-nothing** before any write.
- `new Date()` is banned — Luxon `DateTime` only.
- External `core/*` adapters use the port pattern (`*.port.ts` + `*.provider.ts` +
  `*.config.ts`); domain modules keep the plain `@Injectable` style.

---

_All 18 reference files are written (codebase review waves 1–2, 2026-08-30)._
_`REVIEW.md` holds the findings log + the 18 confirmed `Decisions` + the fix_
_backlog. Where a rule file says "fix owed", the current code does **not** yet_
_match the stated target — follow the target for new code._
