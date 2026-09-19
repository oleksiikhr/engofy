# HTTP / API — controllers, guards, response DTOs, Swagger

> Reviewed: `entrypoints/web` + `core/http` (waves 1–2). Baseline: `entrypoints/web/auth`.

## Module composition

`WebModule.forRoot(DEFAULT_SUB_MODULES)` — each domain has a `<domain>-web.module.ts`
importing exactly one domain module + one controller. Sub-modules: `internal`,
`auth`, `learning`, `billing`, `profile`, `content`, `dictionary`.

## Rules

| # | Rule | Reference |
|---|---|---|
| H1 | Controllers inject **only the domain facade**; no `EntityManager`, `CommandBus`/`QueryBus`, or handler. | `learning.controller.ts:57-58` |
| H2 | Controller body = call the facade, map the view → response DTO with an **explicit `to<X>Response` mapper** (never a structural passthrough). No logic, no `em`. (`ContentController` still has `parseSlugId` + `NotFoundException` — trim it.) | `content.controller.ts` `toPostsListResponse`/`toPostDetailResponse`; `billing.controller.ts:17-29` |
| H3 | `SessionAuthGuard` is the global `APP_GUARD` — registered in `web.module.ts` `forRoot` (Batch F), so it applies to every sub-module composition, `ThrottlerGuard`'s `APP_GUARD` runs before it, and `ETagInterceptor`'s `APP_INTERCEPTOR` sits alongside. `@Public()` is the opt-out. | `entrypoints/web/web.module.ts` |
| H4 | Read the authenticated identity only via `@CurrentUser(): UserActor` (backed by `request.raw.actor`). | `profile.controller.ts:16` |
| H5 | POST that isn't "created" → `@HttpCode(HttpStatus.OK)`. `POST /learning/cards` has it (Batch F — idempotent re-add). | `learning.controller.ts` `addCard`; `auth.controller.ts:41` |
| H6 | Response DTOs: plain classes, `readonly x!: T`, description via a leading `//` comment. **No bare `@ApiProperty()`** (the `@nestjs/swagger` CLI plugin infers type/required/description). | `content/dto/feed-response.dto.ts` |
| H7 | Convert `DateTime` → ISO `string` at the **controller**, never earlier — query/command views keep Luxon `DateTime` (dates.md), the `to<X>Dto` mapper calls a local `iso(value)` helper (`value.toISO() ?? value.toString()`). Consistent across `learning` / `billing` / `dictionary` (Batch R3 moved `dictionary` off an in-handler conversion). DTO fields stay `string`, so the "DateTime needs explicit `@ApiProperty`" rule never triggers. | `learning.controller.ts:25-27`; `dictionary.controller.ts` |
| H8 | Every controller sets `@ApiTags`. No route-level `@ApiResponse`/`@ApiOperation` — DTO schema + the global 400/429/500 responses in `build-openapi-document.ts` only. | `auth.controller.ts:30` |
| H8a | Authenticated controllers carry `@ApiCookieAuth()` (class-level; method-level on the one authed route of an otherwise-`@Public()` controller, `auth.controller.ts` `me`) — matches the `.addCookieAuth(sessionCookieName)` scheme in `build-openapi-document.ts` (Batch N). | `learning.controller.ts`, `billing.controller.ts`, `dictionary.controller.ts`, `profile.controller.ts` |
| H9 | `@CachePolicy('private'\|'public')` opts a GET into `ETagInterceptor` (Cache-Control + SHA-1 ETag + 304). `ContentController` carries `@CachePolicy('public')` at class level (Batch O) — every route there is an anonymous, cacheable GET. Add it (method- or class-level) to any future public GET; the interceptor no-ops on unannotated routes and on non-GET. | `entrypoints/web/content/controllers/content.controller.ts`; `core/http/interceptors/etag.interceptor.ts` |

## `/api` prefix — D14 (done, Batch F)

`configureApp` (see below) calls `setGlobalPrefix('api', { exclude: [{ path:
'_healthz', method: RequestMethod.ALL }] })`; `build-openapi-document.ts` adds
`.addServer('/api')` and generates the doc with `ignoreGlobalPrefix: true` (so
paths stay `/content/posts` and the server entry re-adds `/api` — no `/api/api`).
The web ispec helper (`e2e-suite.helper.ts` `request()`) prepends `/api`
transparently; `apps/web`'s `src/lib/api.ts` `call()` does the same for SSR
fetches (Batch R5 — the app previously hit bare `/feed` and 404'd).

## Controller path prefixes

Every web controller declares a path prefix so no route sits at the bare root.
`ContentController` is `@Controller('content')` (Batch R5) — `content/posts`,
`content/posts/:slugId`, `content/grammar`, `content/grammar/:slug`, i.e.
`/api/content/*`. It used to be `@Controller()` (top-level `feed`/`posts`/
`grammar`), a future-collision risk.

## Pagination / list envelopes — D14 (done, Batches F + R5)

Shared envelope `OffsetPage<T>` = `{ items: T[]; nextOffset: number | null }`
lives in `core/http/dto/offset-page.ts` (+ `toOffsetPage` builder). **Every**
list endpoint now returns it: `PracticeQueueResponseDto` and
`DictionaryResponseDto` (Batch R5). Both are limit-capped single-shot reads with
no `offset` param, so their `nextOffset` is **always `null`** — the field is
there for wire consistency, not because they paginate. `practice` was a
bare array and `dictionary` was `{ items }` before R5.

## Response-DTO independence — D14 (partial, Batch F)

`ContentController` now maps every view → DTO through an explicit `to<X>Response`
function (no structural cast). `PostDetailResponseDto` re-declares the annotation
shapes as local DTO classes (`PostWordAnnotationDto` etc.) and no longer imports
`*View` types. `doc` stays a `type`-only import of the domain `Doc` **by
decision (Batch N):** `node-tree.types.ts` is dependency-free wire-contract data
deliberately shared with the SSR renderer, not an internal query view;
re-declaring ~90 lines of recursive discriminated unions would be fragile and
give a worse OpenAPI schema. Enum imports (`CefrLevel` / `ExerciseType` /
`ExerciseSource`) are kept deliberately — shared vocabulary, not view shapes.

## Security posture

| Aspect | State | Note |
|---|---|---|
| Session cookie | `__Host-session`, `httpOnly`, `secure`, `sameSite:'lax'`, `path:'/'` | `clearSessionCookie` mirrors all four attributes (Batch F) |
| CSRF | none | **D14: `SameSite=Lax` + POST-only + single-origin is accepted for V1**; revisit for any third-party embed |
| Rate limiting | global `ThrottlerGuard`, Redis storage (Batch F) | `WebThrottlerModule` — first `APP_GUARD`; `THROTTLE_TTL_MS`/`THROTTLE_LIMIT` (60 s / 300). `skipIf: isTestEnvironment()` (shared Redis + `isolate:false`). |
| CORS | `origin: app.publicUrl`, `credentials: true` | `PUBLIC_URL` has no fallback → `origin: undefined` (permissive) if unset — make it `envRequiredString` |
| `/_healthz` | Terminus readiness: `MikroOrmHealthIndicator.pingCheck('database')` + custom `RedisHealthIndicator.pingCheck('redis')`; `@ApiTags('internal')` (Batch F) | 200 only when both answer |

## Bootstrap — `configureApp(app)` (Batch F, D17)

`src/entrypoints/web/configure-app.ts` is the single source of truth for the
request pipeline: `setGlobalPrefix('api', …)`, then global pipes
(`EmptyStringToNullPipe` → `ZodValidationPipe`), then filters specific-last
(`ErrorFilter` fallback → `HttpErrorFilter` → `DomainErrorFilter` →
`AuthorizationErrorFilter` → `HealthCheckErrorFilter`). Both `main.ts` and
`test/http/web/setup/create-app.helper.ts` call it — no more hand-copied stack.
`main.ts` still owns the Fastify plugins (`helmet` `contentSecurityPolicy:false`,
`@fastify/cookie`, `cors`) and Swagger (`!isProd`).

`HttpErrorFilter` normalises every `<500` body to `{ message: string }` (Batch F)
— matches the domain/authz/validation filters; no more Nest
`{ statusCode, message, error }` leak.
