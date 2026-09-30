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

Connection budget, client IP, Telegram poller, worker shutdown and the env matrix are settled — see `docs/deploy.md`.

- **Redis.** Managed Valkey ($15) vs. an internal `redis` service ($5–10); losing the data only
  resets rate-limit windows.
- **Registry.** DigitalOcean Container Registry (Basic, $5) vs. private GHCR — App Platform pulling
  from private GHCR is unverified.
- **CPU.** Shared vCPU may be too slow for `nlp` and `worker`; measure before fixing sizes.
- **Cheapest Postgres plan.** Confirm its disk and `max_connections` fit before choosing it.
