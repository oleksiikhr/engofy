---
slug: next-up-deploy-i18n
title: Підготовка до деплою та друга мова
base_branch: main
created: 2026-09-30
status: in-progress
---

# Підготовка до деплою та друга мова

Усі зрізи йдуть однією гілкою `next-up-deploy-i18n` (один коміт на зріз); PR відкривається один раз, після останнього зрізу.

## Зрізи

### [x] 1. Виправити часові флейки
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Два ispec (`request-account-deletion`, `profile.controller`) отримують 30,04 дня замість 30: 30 днів у локальній зоні перетинають перехід на зимовий час. Знайти, де дні додаються не в UTC, виправити код (Luxon, UTC) і тести.

### [x] 2. Прибрати залишки Swarm
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Видалити `docker-entrypoint.sh` і його підключення в `Dockerfile` (шим Docker secrets). Перевірити, що на нього не спираються compose e2e та CI docker build; прибрати згадки swarm у `health.controller.ts`.

### [x] 3. App spec для App Platform
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Закомітити `.do/app.yaml` за таблицею з `docs/deploy.md`: компоненти, команди, health checks, `grace_period_seconds` 180/60, `PRE_DEPLOY` міграція, env з `.env.production.example`. Залежить від 2.

### [x] 4. Закрити відкриті питання хостингу
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Рішення по Redis (Valkey чи внутрішній сервіс), реєстру (DOCR чи GHCR), CPU для `nlp`/`worker` і `max_connections` у `docs/hosting-direction.md`. Вибір Redis і реєстру — питання розробнику, не припущення. Залежить від 3.

### [x] 5. Перевірка рідера v2 вживу
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Запустити застосунок, пройти рідер «Editorial & Margin Notes» (Playwright, скриншоти), зафіксувати проблеми щільності анотацій і виправити очевидне; сумнівне — питання розробнику.

### [ ] 6. i18n: дизайн другої мови (дослідницький)
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Вирішити, де живе рідна мова (cookie/акаунт), як зберігаються переклади для `grammar-usage-point`, `word-definition`, `phrase`, як додається мова й що з UI-рядками. Результат — нові зрізи за Step 3b `task`, а не код.
