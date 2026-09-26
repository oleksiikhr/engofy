---
slug: e2e-isolated-stack
title: Ізольований e2e-стек (compose.e2e.yaml / compose.e2e-prod.yaml)
base_branch: main
created: 2026-09-26
status: in-progress
---

# Ізольований e2e-стек (compose.e2e.yaml / compose.e2e-prod.yaml)

Playwright-е2е в `apps/web/e2e` наразі напряму б'є в dev-БД: `apps/web/e2e/global-setup.ts` шле сід
через `test/e2e/seed-web-e2e.ts` у dev-Postgres, а `playwright.config.ts` очікує, що розробник сам
підняв `docker compose up -d postgres redis`, Nest-сервер і `astro dev` локально (коментар "No
webServer" у файлі). E2e не входить у CI (`.github/workflows/app.yaml`: "Playwright e2e runs locally
only, not in CI") — це суто dev-тулінг, зміни цього плану не торкаються CI.

Мета — портувати підхід `~/dev/shift`'s `compose.e2e.yaml` + `compose.e2e-prod.yaml` (плюс відповідні
цілі кореневого `Makefile`) в engofy: повністю ізольований набір контейнерів (свій backend/web, своя
БД/Redis-індекс/порти), який можна піднімати поруч зі звичайним dev-стеком, не займаючи і не
змінюючи його стан.

Ключові архітектурні рішення (адаптація shift-моделі під топологію engofy):

- **Спільний Postgres/Redis-контейнер, окрема логічна БД** — `compose.e2e.yaml`/`compose.e2e-prod.yaml`
  роблять `include: - compose.yaml` (як у `shift`) замість піднімати окремий Postgres-контейнер. Нова
  логічна БД `engofy-e2e` додається до `docker/postgres-initdb.sql` (той самий init-скрипт, що вже
  преprovision-ить offset-бази з `worktree-db-isolation`).
- **Redis-індекс поза offset-діапазоном** — `worktree-db-isolation`'s offset-схема вже займає весь
  дефолтний діапазон Redis (0-15: `2*N`/`2*N+1` для offset 0-7). E2e потребує власний індекс поза цим
  діапазоном, тож `compose.yaml`'s `redis`-сервіс отримує `command: redis-server --databases 32` (чи
  подібне), а e2e зарезервує фіксований індекс (напр. `16`) — задокументувати як зарезервований, щоб
  майбутнє розширення offset-схеми його не зачепило.
- **Один DB-name/Redis-індекс на весь e2e-стек** — на відміну від `shift` (окремий `REDIS_QUEUE_DB` для
  BullMQ), тут pg-boss читає ту саму Postgres-БД, що й MikroORM (`queue.config.ts` бере
  `MIKRO_ORM_DB_NAME`), тож окремого другого Redis-індексу під чергу не треба.
- **Production-образи вже робочі** — на відміну від `shift` (TODO-заглушка для backend prod-образу,
  залежність від GitHub OAuth token у build-контексті), кореневий `Dockerfile` і `apps/web/Dockerfile`
  збираються локально без додаткових секретів (`docker.yaml` CI це підтверджує) — `compose.e2e-prod.yaml`
  може одразу використовувати реальні production-образи, без тимчасових заглушок.
- **Health-ендпоінти** — бекенд вже має `GET /_healthz` (`src/entrypoints/web/internal/controllers/health`).
  `apps/web` (Astro) такого ендпоінту не має — слайс 2 вирішує health-check для `web-e2e`
  (легкий ендпоінт чи перевірка кореневого шляху).

## Зрізи

### [x] 1. Ізольована Postgres/Redis-конфігурація + compose.e2e.yaml (backend-e2e)
- Branch: `e2e-isolated-stack-01-backend-container`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/136

Додає логічну БД `engofy-e2e` у `docker/postgres-initdb.sql`; піднімає `redis`-сервіс у `compose.yaml`
до `--databases 32` (чи достатнього запасу) і документує зарезервований e2e-індекс. Новий
`compose.e2e.yaml` (`include: - compose.yaml`) із сервісом `backend-e2e` — dev-образ, hot reload через
bind mount (`pnpm i && nest start --watch`, як `compose.e2e.yaml`'s `backend-e2e` у `shift`), власний
порт (напр. `8180`), env вказує на `engofy-e2e`/зарезервований Redis-індекс. Makefile: `e2e-up`,
`e2e-down`. Перевіряється самостійно (без web/Playwright ще): `make e2e-up` + `curl
localhost:8180/_healthz`.

### [ ] 2. web-e2e контейнер + переорієнтація Playwright на ізольований стек
- Branch: `e2e-isolated-stack-02-web-playwright`
- Base: `e2e-isolated-stack-01-backend-container`
- PR: —

Додає `web-e2e` у `compose.e2e.yaml` (Astro dev, hot reload, `API_ORIGIN` → `backend-e2e`, власний
порт напр. `3100`, health-check рішення зі вступу плану). Оновлює `apps/web/e2e/global-setup.ts` і
`test/e2e/seed-web-e2e.ts`, щоб сіяти в `engofy-e2e`, а не в dev-БД (параметризувати
`MIKRO_ORM_DB_NAME`/`REDIS_DB` через env, які `compose.e2e.yaml` вже проставляє для `backend-e2e`, а
seed-скрипт читає ту саму конфігурацію MikroORM). `playwright.config.ts`: `baseURL` за замовчуванням
на e2e-web-порт, прибрати застарілий коментар "No webServer... підніми стек сам". Makefile: `e2e-reset`
(дроп+ресід `engofy-e2e`), `e2e`, `e2e-ui`, `e2e-headed`, `e2e-report`, `e2e-full` (up → reset → run).

### [ ] 3. compose.e2e-prod.yaml + prod-цілі Makefile
- Branch: `e2e-isolated-stack-03-prod-stack`
- Base: `e2e-isolated-stack-02-web-playwright`
- PR: —

Той самий стек, зібраний з реальних production-образів (кореневий `Dockerfile`, `apps/web/Dockerfile`,
`include: - compose.yaml`) — передрелізна перевірка перед тегом деплою (`v*` git tag), повільніша, без
hot reload. Makefile: `e2e-prod-up`, `e2e-prod-down`, `e2e-prod-exec-%`, `e2e-prod-logs-%`,
`e2e-prod-full` (reset → up → run → down, за зразком `shift`'s `trap ... EXIT`).

### [ ] 4. Документація
- Branch: `e2e-isolated-stack-04-docs`
- Base: `e2e-isolated-stack-03-prod-stack`
- PR: —

Документує ізольований e2e-стек: коли `make e2e`/`e2e-full` (щоденна робота), коли `e2e-prod-full`
(перед тегом деплою), як влаштована ізоляція (окрема БД/Redis-індекс/порти, не займає і не блокує
dev-стек чи інший worktree). Місце — README (розділ Daily workflow чи Troubleshooting) або новий
`apps/web/e2e/README.md`, вирішити під час зрізу за обсягом тексту.
