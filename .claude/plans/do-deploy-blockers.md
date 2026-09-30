---
slug: do-deploy-blockers
title: Блокери деплою на DigitalOcean App Platform
base_branch: main
created: 2026-09-30
status: in-progress
---

# Блокери деплою на DigitalOcean App Platform

Усі зрізи йдуть однією гілкою `do-deploy-blockers` (один коміт на зріз); PR відкривається один раз, після останнього зрізу.

## Зрізи

### [x] 1. Реальний IP клієнта за Cloudflare
- Branch: `do-deploy-blockers`
- Base: `main`
- PR: —

Замінити схему `TRUST_PROXY`: довіряти `CF-Connecting-IP` лише для запитів, що прийшли через довірений проксі (адреси DO edge нестабільні, тож спосіб перевірки джерела визначається в зрізі). Оновити `parseTrustProxy` і тести; throttler та OTP-лічильники беруть IP звідти.

### [x] 2. Бюджет з'єднань Postgres
- Branch: `do-deploy-blockers`
- Base: `main`
- PR: —

Окремі `QUEUE_DB_HOST`/`QUEUE_DB_PORT` для pg-boss (direct-з'єднання, LISTEN/NOTIFY) при пулері для MikroORM. Значення `DB_POOL_MAX`/`QUEUE_POOL_MAX` для кожного процесу під 22 з'єднання та бюджет — у зрізі 5 (env і docs/deploy.md).

### [ ] 3. Захист Telegram-поллера від перетину
- Branch: `do-deploy-blockers`
- Base: `main`
- PR: —

Postgres advisory lock (try-lock, без очікування) навколо `PollUpdatesService.run()`, щоб старий і новий cron під час rollout не робили `getUpdates` паралельно. Інтеграційний тест на два одночасні `run()`.

### [ ] 4. Повне завершення worker
- Branch: `do-deploy-blockers`
- Base: `main`
- PR: —

`boss.stop()` з graceful і таймаутом з env (`WORKER_SHUTDOWN_TIMEOUT_MS`, дефолт ≥120 с), щоб AI-стадія (~2 хв) доробила. Тест на lifecycle.

### [ ] 5. Env для App Platform і docs/deploy.md
- Branch: `do-deploy-blockers`
- Base: `main`
- PR: —

Переписати `.env.production.example` під змінні App Platform (прибрати swarm/Docker secrets), описати app spec (PRE_DEPLOY міграція, `grace_period_seconds=120`, cron = 1 інстанс, значення зі зрізів 1–4), написати `docs/deploy.md`, прибрати закриті пункти з `docs/hosting-direction.md`. Залежить від 1–4.
