# engofy — Project Conventions

NestJS backend (fastify, MikroORM/Postgres, pg-boss for queues). These rules are
project-wide and override generic defaults.

## Dates: Luxon `DateTime`, never `Date`

Never write `new Date()`. Use Luxon's `DateTime` everywhere — it's immutable,
`Date` isn't.

- Entity timestamp fields: type `DateTime`, use the custom MikroORM type:

  ```ts
  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();
  ```

  (`LuxonTimestampType` lives at `src/core/database/types/luxon-timestamp.type.ts`
  and (de)serializes `DateTime` <-> `timestamptz`.)

- In services: `DateTime.now()`, `.plus({ milliseconds, days, ... })`.
  Relational comparisons (`<=`, `>=`) work directly on `DateTime` values.
- Raw SQL via `em.getConnection().execute(...)` bypasses `LuxonTimestampType`'s
  conversion — pass `.toJSDate()` for bound params there, since the pg driver
  serializes native `Date` but not `DateTime`.

Reference implementation: the `auth` module's entities/services
(`src/modules/auth/entities/*.entity.ts`, `application/session.service.ts`,
`application/challenge.service.ts`).

## Request DTOs: `nestjs-zod`, never `class-validator`/`class-transformer`

Request-body/query/param validation goes through
[`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod), not
`class-validator` decorators — those packages aren't dependencies of this
project.

- Define a `zod` schema, then wrap it: `class FooDto extends createZodDto(FooSchema) {}`.
  Reference: `src/entrypoints/web/auth/dto/*.dto.ts`.
- The global pipe is a `nestjs-zod` `ZodValidationPipe` built via
  `createZodValidationPipe({ createValidationException: zodValidationExceptionFactory })`
  (`src/main.ts`, mirrored in `test/http/web/setup/create-app.helper.ts`).
  `zodValidationExceptionFactory`
  (`src/core/validation/zod-validation-exception.factory.ts`) maps the first
  Zod issue onto the existing `{ type: 'validation', message, field }` error
  shape (`ValidationErrorResponseDto`) — don't let it drift back to the raw
  `ZodError`/`ZodValidationException` shape.
- `SwaggerModule.createDocument(...)` output must be passed through
  `cleanupOpenApiDoc()` from `nestjs-zod` (see `build-openapi-document.ts`) so
  zod-schema DTOs render correctly in the OpenAPI doc.

## No bare `@ApiProperty()`

`nest-cli.json` configures the `@nestjs/swagger` CLI plugin with
`introspectComments: true` — it infers Swagger metadata (type, required-ness,
description) from the TS types and leading comments at build time. A bare
`@ApiProperty()` with no options is redundant. This applies to plain
response-DTO classes (e.g. `src/core/http/dto/created-response.dto.ts`) —
request DTOs built with `createZodDto` get their OpenAPI schema from the zod
schema itself, not from this plugin.

- Plain fields (`string`, `number`, `boolean`, DTO types, etc.): no
  `@ApiProperty()`.
- Need a description in Swagger UI? Put it in a leading `//` comment above the
  property — `introspectComments` picks it up automatically.
- Exception: a property typed as Luxon `DateTime` still needs an explicit
  `@ApiProperty()` (e.g. `{ type: String, format: 'date-time' }`), since the
  plugin can't introspect a custom class the way it does primitives.
- For zod DTOs, add a field description with `.describe('...')` on the schema
  instead of a comment.
