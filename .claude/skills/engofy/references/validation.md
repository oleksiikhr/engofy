# Validation — `nestjs-zod` request DTOs

> Reviewed: `auth`, `learning`, `content` web DTOs + `core/validation` (waves 1–2). Also in `CLAUDE.md`. See `REVIEW.md` D14 (request-DTO home).

## Rules

| # | Rule | Reference |
|---|---|---|
| V1 | Request body/query/param validation goes through `nestjs-zod` — **never** `class-validator` / `class-transformer` (not dependencies). | `CLAUDE.md` |
| V2 | Define a `const FooSchema = z.object({...})`, then `class FooDto extends createZodDto(FooSchema) {}` — schema directly above the class, same file. | `auth/commands/verify-login-code/verify-login-code.dto.ts` |
| V3 | The global pipe is a `nestjs-zod` `ZodValidationPipe` built once via `createZodValidationPipe({ createValidationException: zodValidationExceptionFactory })`, registered **after** `EmptyStringToNullPipe`. | `main.ts:29-31,62-65` |
| V4 | `zodValidationExceptionFactory` maps the **first** Zod issue to `{ type: 'validation', message, field }` (`field = issue.path.join('.') \|\| null`) — the `ValidationErrorResponseDto` shape. Do not let it drift back to the raw `ZodError` / `ZodValidationException`. | `core/validation/zod-validation-exception.factory.ts:16-32` |
| V5 | Cross-field rules → `.refine(...)`. **Pass a `path`** (e.g. `path: ['wordId']`) so `field` is populated — a bare `.refine` yields `field: null`. | `learning/.../add-card.dto.ts:13-21` (currently missing `path`) |
| V6 | Swagger description for a zod DTO field → `.describe('...')` on the schema (not a `//` comment — that's for plain response DTOs). | `content/dto/feed-query.dto.ts` |
| V7 | `SwaggerModule.createDocument(...)` output must pass through `cleanupOpenApiDoc()` from `nestjs-zod`. | `entrypoints/web/build-openapi-document.ts` |

## D14 — where request DTOs live (confirmed)

**Standard:** web-local `createZodDto` schemas under `entrypoints/web/<domain>/dto/`
+ a mapper in the controller. Keeps the HTTP contract out of the domain module.

`auth` reuses the **command** DTOs from `modules/auth/commands/*/*.dto.ts` (one
schema serves HTTP + command) — a **tolerated exception**, not the pattern to copy.

## Query-param gotcha (fix owed)

`EmptyStringToNullPipe` runs first and turns `?limit=` / `?cefr=` into `null`.
`z.coerce.number().default(20)` only defaults on `undefined`, and `.optional()`
rejects `null` → **400 instead of defaulting**. Fix query fields with
`.nullish().transform(v => v ?? undefined)`, or exclude query metatypes from the
empty-to-null pipe.

## Asset-file validation

Static asset files (`egp.json`, `irregular-verbs.json`, `word-frequency.txt`) are
parsed with a zod schema at load time (`z.enum(CefrLevel)`, `.superRefine` dup
checks). Reference: `post/domain/egp.ts`, `irregular-verb.ts`.
