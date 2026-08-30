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
| H2 | Controller body = call the facade, map the view → response DTO. No logic, no `em`. (`ContentController` currently has `parseSlugId` + `NotFoundException` logic — trim it.) | `billing.controller.ts:17-29` |
| H3 | `SessionAuthGuard` is the global `APP_GUARD`; routes are protected by default; `@Public()` is the opt-out. **D14: move the `APP_GUARD` provider to `web.module.ts`** (today it hides in `AuthWebModule`). | `auth/auth-web.module.ts:12` |
| H4 | Read the authenticated identity only via `@CurrentUser(): UserActor` (backed by `request.raw.actor`). | `profile.controller.ts:16` |
| H5 | POST that isn't "created" → `@HttpCode(HttpStatus.OK)`. (`POST /learning/cards` is missing it — 201 on an idempotent re-add.) | `auth.controller.ts:41` |
| H6 | Response DTOs: plain classes, `readonly x!: T`, description via a leading `//` comment. **No bare `@ApiProperty()`** (the `@nestjs/swagger` CLI plugin infers type/required/description). | `content/dto/feed-response.dto.ts` |
| H7 | Convert `DateTime` → ISO `string` **before** it reaches a response DTO, so DTO fields are `string` and the "DateTime needs explicit `@ApiProperty`" rule never triggers. Pick **one** layer for it (see fix). | `learning.controller.ts:25-27` |
| H8 | Every controller sets `@ApiTags`. No route-level `@ApiResponse`/`@ApiOperation` — DTO schema + the global 400/429/500 responses in `build-openapi-document.ts` only. | `auth.controller.ts:30` |
| H9 | `@CachePolicy('private'\|'public')` opts a GET into `ETagInterceptor` (Cache-Control + SHA-1 ETag + 304). Today it's on **zero** routes (dead) — annotate the public GETs or drop the global registration. | `core/http/interceptors/etag.interceptor.ts` |

## `/api` prefix — D14 (confirmed)

Add `setGlobalPrefix('api', { exclude: ['_healthz'] })` in `main.ts` **and**
`.addServer('/api')` in `build-openapi-document.ts` so generated client paths
match production URLs. The edge proxy strip stays (belt-and-suspenders).

## Pagination — D14 (confirmed)

Adopt one shared list envelope `{ items: T[], nextOffset: number | null }` across
all list endpoints. Today: `feed` = `{items, nextOffset}`, `practice` = bare
array, `dictionary` = `{items}` unbounded.

## Response-DTO independence — D14 (confirmed)

Web response DTOs must **not** import module query-view types.
`PostDetailResponseDto` currently re-exports `WordAnnotationView` / `Doc` from
`modules/post/**` and `ContentController` returns the raw view via a structural
cast — replace with self-contained DTOs + an explicit mapper.

## Security posture

| Aspect | State | Note |
|---|---|---|
| Session cookie | `__Host-session`, `httpOnly`, `secure`, `sameSite:'lax'`, `path:'/'` | `clearSessionCookie` must mirror the attributes (a `__Host-` deletion may need `Secure`) |
| CSRF | none | **D14: `SameSite=Lax` + POST-only + single-origin is accepted for V1**; revisit for any third-party embed |
| Rate limiting | login-only Redis counter | **D14: add `@nestjs/throttler` `ThrottlerGuard` (global, Redis) before launch** — PLAN §7 |
| CORS | `origin: app.publicUrl`, `credentials: true` | `PUBLIC_URL` has no fallback → `origin: undefined` (permissive) if unset — make it `envRequiredString` |
| `/_healthz` | always 200, zero indicators | **D14: add Terminus DB + Redis indicators (readiness) + `@ApiTags('internal')`** |

## Bootstrap (`main.ts`) order

`EmptyStringToNullPipe` → `ZodValidationPipe` (global pipes); filters registered
specific-last (`ErrorFilter` fallback → `HttpErrorFilter` → `DomainErrorFilter` →
`AuthorizationErrorFilter` → `HealthCheckErrorFilter`); `helmet`
(`contentSecurityPolicy:false`), `@fastify/cookie`, `cors`; Swagger only when
`!isProd`. **D17: extract a shared `configureApp(app)`** used by both `main.ts` and
`test/http/web/setup/create-app.helper.ts` (today hand-copied).

`HttpErrorFilter` forwards Nest's `{statusCode,message,error}` for `<500`
`HttpException` — normalise to `{ message }` to match the domain/authz/validation
filters.
