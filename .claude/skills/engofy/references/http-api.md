# HTTP / API — controllers, guards, response DTOs, Swagger

> Reviewed: `entrypoints/web` + `core/http` (waves 1–2). Baseline: `entrypoints/web/auth`. See `REVIEW.md` D14.

## Module composition

`WebModule.forRoot(DEFAULT_SUB_MODULES)` — each domain has a `<domain>-web.module.ts`
importing exactly one domain module + one controller. Sub-modules: `internal`,
`auth`, `learning`, `billing`, `profile`, `content`, `dictionary`.

## Rules

| # | Rule | Reference |
|---|---|---|
| H1 | Controllers inject **only the domain facade**; no `EntityManager`, `CommandBus`/`QueryBus`, or handler. | `learning.controller.ts:57-58` |
| H2 | Controller body = call the facade, map the view → response DTO with an **explicit `to<X>Response` mapper** (never a structural passthrough). No logic, no `em`. (`ContentController` still has `parseSlugId` + `NotFoundException` — trim it.) | `content.controller.ts` `toFeedResponse`/`toPostDetailResponse`; `billing.controller.ts:17-29` |
| H3 | `SessionAuthGuard` is the global `APP_GUARD` — registered in `web.module.ts` `forRoot` (Batch F), so it applies to every sub-module composition, `ThrottlerGuard`'s `APP_GUARD` runs before it, and `ETagInterceptor`'s `APP_INTERCEPTOR` sits alongside. `@Public()` is the opt-out. | `entrypoints/web/web.module.ts` |
| H4 | Read the authenticated identity only via `@CurrentUser(): UserActor` (backed by `request.raw.actor`). | `profile.controller.ts:16` |
| H5 | POST that isn't "created" → `@HttpCode(HttpStatus.OK)`. `POST /learning/cards` has it (Batch F — idempotent re-add). | `learning.controller.ts` `addCard`; `auth.controller.ts:41` |
| H6 | Response DTOs: plain classes, `readonly x!: T`, description via a leading `//` comment. **No bare `@ApiProperty()`** (the `@nestjs/swagger` CLI plugin infers type/required/description). | `content/dto/feed-response.dto.ts` |
| H7 | Convert `DateTime` → ISO `string` **before** it reaches a response DTO, so DTO fields are `string` and the "DateTime needs explicit `@ApiProperty`" rule never triggers. Pick **one** layer for it (see fix). | `learning.controller.ts:25-27` |
| H8 | Every controller sets `@ApiTags`. No route-level `@ApiResponse`/`@ApiOperation` — DTO schema + the global 400/429/500 responses in `build-openapi-document.ts` only. | `auth.controller.ts:30` |
| H9 | `@CachePolicy('private'\|'public')` opts a GET into `ETagInterceptor` (Cache-Control + SHA-1 ETag + 304). Today it's on **zero** routes (dead) — annotate the public GETs or drop the global registration. | `core/http/interceptors/etag.interceptor.ts` |

## `/api` prefix — D14 (done, Batch F)

`configureApp` (see below) calls `setGlobalPrefix('api', { exclude: [{ path:
'_healthz', method: RequestMethod.ALL }] })`; `build-openapi-document.ts` adds
`.addServer('/api')` and generates the doc with `ignoreGlobalPrefix: true` (so
paths stay `/feed` and the server entry re-adds `/api` — no `/api/api`). The
edge proxy strip stays (belt-and-suspenders). The web ispec helper
(`e2e-suite.helper.ts` `request()`) prepends `/api` transparently.

## Pagination — D14 (partial, Batch F)

Shared envelope `OffsetPage<T>` = `{ items: T[]; nextOffset: number | null }`
lives in `core/http/dto/offset-page.ts` (+ `toOffsetPage` builder).
`FeedResponseDto implements OffsetPage<FeedItemDto>`. **Still owed:** `practice`
(bare array) and `dictionary` (`{items}`, unbounded — tied to D10/D12) not yet
converted.

## Response-DTO independence — D14 (partial, Batch F)

`ContentController` now maps every view → DTO through an explicit `to<X>Response`
function (no structural cast). `PostDetailResponseDto` re-declares the annotation
shapes as local DTO classes (`PostWordAnnotationDto` etc.) and no longer imports
`*View` types. **Still owed:** `doc` is still typed via a `type`-only import of
the domain `Doc`; a standalone structural copy is Batch K. Enum imports
(`CefrLevel` / `ExerciseType` / `ExerciseSource`) are kept deliberately — shared
vocabulary, not view shapes.

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
