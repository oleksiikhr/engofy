# Security

> Reviewed: `auth`, `core` (redis/config/logger/observability), web, telegram (waves 1–2). See `REVIEW.md` D1, D14, D18.

## Rules

| # | Rule | Reference |
|---|---|---|
| S1 | Store only sha256-hex hashes of secrets (`tokenHash`, `otpHash`); never the plaintext. | `auth/crypto/token.helper.ts:16-18` |
| S2 | Compare secrets with `timingSafeEqual` over hex buffers, length-guarded first. | `auth/crypto/token.helper.ts:24-33` |
| S3 | Session token = 32 random bytes base64url; OTP = `randomInt(0, 1_000_000)` zero-padded. | `auth/crypto/token.helper.ts:8-14` |
| S4 | Missing / expired / wrong all raise the **same** error (no enumeration oracle). | `auth/services/challenge.service.ts:86-105` (`InvalidOrExpiredChallengeError`) |
| S5 | OTP attempts incremented **atomically** (`UPDATE … SET attempts = attempts + 1 … RETURNING`) before validation; challenge hard-deleted past `otpMaxAttempts`. | `auth/services/challenge.service.ts:82-94` |
| S6 | Rate limiting = one Redis `EVAL` Lua script incrementing per-IP **and** per-email counters together (both vectors), arming `PEXPIRE` on first hit. | `auth/services/challenge.service.ts:24-37` |
| S7 | Normalise email (`trim().toLowerCase()`) before every store/compare. | `auth/crypto/token.helper.ts:20-22` |
| S8 | Secrets come from `core/config` namespaces (`registerAs` + `env.helper`), never hard-coded; `.env*` is git-ignored. | `references/config.md` |
| S9 | Session cookie: `__Host-`-prefixed, `httpOnly`, `secure`, `sameSite:'lax'`. | `auth/cookies/auth-cookies.helper.ts` |
| S10 | Telegram admin gate: `message.from.id === TELEGRAM_ADMIN_USER_ID`; non-admin messages are stored + `processed=true`, never acted on. | `telegram/services/poll-updates.service.ts` |
| S11 | Google verifier requires `sub` + `email` + `email_verified`; short-circuits to `InvalidGoogleCredentialError` when no client id is configured (never calls Google). | `auth/services/google-id-token-verifier.service.ts:24-38` |

## Known weaknesses (fix owed)

| Sev | Item | D |
|---|---|---|
| med | No rate limiting at the web edge (PLAN §7) — only the auth login counter. Add `@nestjs/throttler`. | D14 |
| low | `PUBLIC_URL` unset → CORS `origin: undefined` (permissive) on a credentialed endpoint. Make it required. | — |
| low | `Sentry.tracesSampleRate` defaults to `1` (100%) per entrypoint. | — |
| low | converters copy link `href` verbatim — no scheme allow-list (`javascript:`/`data:` reach stored `LinkNode.href`). Admin-supplied, but persisted + rendered. Strip non-`http(s)`/`mailto`. | — |
| low | `telegram_updates.raw_payload` stores every sender's username + text with no pruning. Add a retention cron. | D15 |
| low | CSRF: none — accepted for V1 (`SameSite=Lax` + POST-only + single origin). Revisit for a third-party embed. | D14 |
| low | `/retry <id>` passes any `\S+` to `findOneOrFail` → raw pg `invalid input syntax for type uuid` echoed to the admin chat. Validate UUID shape. | — |

## Logging redaction

`nestjs-pino` redacts `authorization` and `cookie` headers; trace/span/userId
attached as custom props. Reference: `core/logger/logger.factory.ts:18-44`.
