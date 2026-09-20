# Hosting — DigitalOcean, managed-first

Direction only (2026-09-20): no app spec, IaC, or runbook exists yet.

Goal: minimise self-administration — no servers to patch, no hand-managed secrets or backups.
The database uses the cheapest Managed Postgres plan.

## Shape

| Component | Service |
|---|---|
| `web` (Nest), `apps-web` (Astro SSR) | App Platform services |
| `nlp` (spaCy) | App Platform internal service (no public route) |
| `worker`, `cron` | App Platform workers, 1 instance each (`cron` must never run 2) |
| Migrations | App Platform `PRE_DEPLOY` job running `node cli migrate up`; a failed job aborts the deploy |
| Postgres | DigitalOcean Managed Postgres (v18 supported; PITR for the last 7 days) |
| Redis (throttler, OTP counters — ephemeral) | Managed Valkey, or a `redis` image as an internal service |
| Images | A registry App Platform can pull from |
| DNS / proxy / WAF | Cloudflare |
| Errors | Sentry |

## Prices (DigitalOcean pricing pages, 2026-09-20 — re-verify before paying)

- App Platform shared vCPU: $5 (512 MiB, fixed), $10 (1 GiB, fixed), $12 (1 GiB, can add
  instances), $25 (2 GiB). Dedicated starts at $29 (512 MiB); only dedicated autoscales. Jobs are
  billed only while running. Transfer included: 50 GiB ($5 size), 100 GiB ($10 size); overage
  $0.02/GiB.
- Managed Postgres Standard: $15.15 (1 GiB, 10 GiB disk, 22 connections), $30.45 (2 GiB, 30 GiB
  disk, 47 connections), $60.90 (4 GiB).
- Managed Valkey: $15 (1 GiB).
- Container Registry: free tier = 1 repo / 500 MiB; Basic $5 = 5 repos / 5 GiB. Three images are
  needed (`engofy`, `engofy-web`, `engofy-nlp`).
- Estimated total: ≈ $65–95/month (5 components ≈ $40, Redis $5–15, Postgres $15–30, registry $5).

## Open points

- **Connection limit.** The cheapest Postgres plan allows 22 connections. Each Nest process holds a
  MikroORM pool (`DB_POOL_MAX`, default 10) plus a pg-boss pool (`QUEUE_POOL_MAX`, default 5), so
  `web` + `worker` + `cron` ≈ 45. Either lower the pool sizes or take the $30 plan. pg-boss needs a
  direct/session connection (`LISTEN/NOTIFY`), not a transaction pool.
- **`TRUST_PROXY`.** The request chain is Cloudflare → DigitalOcean edge → app. The app rejects
  numeric hop counts, and throttler / OTP-per-IP counters depend on the real client IP, so the
  client-IP handling needs rework.
- **Telegram poller.** During a rollout the old `cron` can overlap the new one, causing a duplicate
  `getUpdates` (409). Guard with a Postgres advisory lock or a pg-boss singleton.
- **Worker shutdown.** Set `termination.grace_period_seconds` to at least 120 (allowed 1–600) so an
  in-flight AI stage (~2 min) finishes.
- **Redis.** Managed Valkey ($15) vs. an internal `redis` service ($5–10); losing the data only
  resets rate-limit windows.
- **Registry.** DigitalOcean Container Registry (Basic, $5) vs. private GHCR — App Platform pulling
  from private GHCR is unverified.
- **CPU.** Shared vCPU may be too slow for `nlp` and `worker`; measure before fixing sizes.
- **Cheapest Postgres plan.** Confirm its disk and `max_connections` fit before choosing it.
- **Leftover env matrix.** `.env.production.example` still describes Docker secrets and stack file
  names; rework it for App Platform env vars.
