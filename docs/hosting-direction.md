# Hosting — DigitalOcean, managed-first

Direction only (2026-09-20): the app spec is `.do/app.yaml`; no runbook exists yet.

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
| Redis (throttler, OTP counters — ephemeral) | `redis` image as an internal App Platform service, no persistence, no password, no TLS |
| Images | DigitalOcean Container Registry (Basic) |
| DNS / proxy / WAF | Cloudflare |
| Errors | Sentry |

## Prices (DigitalOcean pricing pages, 2026-09-20 — re-verify before paying)

- App Platform shared vCPU: $5 (512 MiB, fixed), $10 (1 GiB, fixed), $12 (1 GiB, can add
  instances), $25 (2 GiB). Dedicated starts at $29 (512 MiB); only dedicated autoscales. Jobs are
  billed only while running. Transfer included: 50 GiB ($5 size), 100 GiB ($10 size); overage
  $0.02/GiB.
- Managed Postgres Standard: $15.15 (1 GiB, 10 GiB disk, 22 connections), $30.45 (2 GiB, 30 GiB
  disk, 47 connections), $60.90 (4 GiB).
- Container Registry: free tier = 1 repo / 500 MiB; Basic $5 = 5 repos / 5 GiB. Three images are
  needed (`engofy`, `engofy-web`, `engofy-nlp`).
- Estimated total: ≈ $65–95/month (5 components ≈ $40, Redis $5, Postgres $30, registry $5).

## Decisions

Connection budget, client IP, Telegram poller, worker shutdown and the env matrix — see `docs/deploy.md`.

- **Redis.** Internal `redis` service ($5); losing the data only resets rate-limit windows. It is
  reachable only inside the app, so it has no password or TLS.
- **Registry.** DOCR Basic ($5). Private GHCR is not used (App Platform pulling from it is unverified).
- **Postgres plan.** The $30.45 plan (47 connections). Steady state is 19 connections; a rolling
  deploy of `web` or `worker` adds 7 and `migrate` adds 2, which exceeds the $15.15 plan's 22.
  Confirm the plan's actual `max_connections` in the panel after provisioning.
- **CPU.** Start with the sizes in `.do/app.yaml`; raise `nlp`/`worker` only if measured latency
  on the first real deploy requires it.
