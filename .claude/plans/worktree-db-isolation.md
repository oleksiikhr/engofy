---
slug: worktree-db-isolation
title: Ізоляція БД/Redis/портів між git worktree
base_branch: main
created: 2026-09-26
status: in-progress
---

# Ізоляція БД/Redis/портів між git worktree

`compose.yaml` навмисно тримає один спільний Postgres/Redis/Mailhog/Spotlight (`name: engofy`) для всіх
worktree цього репозиторію — не по одному стеку контейнерів на кожен, як у деяких інших проєктах.
`README.md` наразі документує лише ручний обхідний шлях для одночасної роботи двох worktree:
перейменувати `MIKRO_ORM_DB_NAME`, підняти `REDIS_DB`, вручну виконати `createdb`. Мета цього плану —
автоматизувати цей ручний рецепт через offset-схему в дусі `make ports` з референсного проєкту
`shift`, не змінюючи топологію контейнерів (Postgres/Redis лишаються спільними — так вирішено свідомо,
щоб не плодити зайві контейнери для легкого стеку engofy).

`.env.development.local` і `.env.test.local` вже в `.gitignore` та мають найвищий пріоритет у
`ConfigModule` (`envFilePath` у `src/app.module.ts`: `.env.${env}.local` перед `.env.${env}`) — це
готовий механізм для per-worktree оверрайдів, змін у конфіг-коді бекенда не потрібно.

Схема іменування БД для offset `N`:
- dev: `engofy` (N=0) / `engofy_wt<N>` (N>0)
- test (vitest `.ispec.ts`): `engofy-testing` (N=0) / `engofy-testing-wt<N>` (N>0)
- Redis: `REDIS_DB = 2*N` (dev), `2*N + 1` (test) — обмежено лімітом 16 логічних БД Redis за
  замовчуванням (0-15), тобто `N` не може перевищувати 7.
- Порти: backend `8080+N`, apps/web `4321+N`, nlp-service `8000+N` (лише рекомендація, без коду).

Іменування свідомо **не** використовує префікс `engofy-e2e`/`engofy_e2e` — він лишається вільним для
майбутнього ізольованого e2e-стеку на кшталт `shift/compose.e2e.yaml` + `compose.e2e-prod.yaml`
(окремий backend/web контейнер з власною БД, який зараз не існує в engofy: Playwright-е2е в
`apps/web/e2e` наразі напряму б'є в dev-БД через `global-setup.ts`). Побудова такого стеку — окрема
майбутня робота, не частина цього плану.

## Зрізи

### [x] 1. Ізоляція БД/Redis/порту бекенда через `make ports`
- Branch: `worktree-db-isolation-01-backend-db-redis-ports`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/134

Новий таргет `make ports OFFSET=<N>` у кореневому Makefile:
- Валідує, що `OFFSET` — ціле число ≥0 і ≤7 (ліміт Redis DB, див. вище); повідомляє про помилку інакше.
- Пише в `.env.development.local`: `PORT=8080+N`, `MIKRO_ORM_DB_NAME` та `REDIS_DB` за схемою вище.
- Пише в `.env.test.local`: `MIKRO_ORM_DB_NAME` та `REDIS_DB` за тестовою схемою вище.
- Автоматично створює обидві Postgres-бази (`docker compose exec postgres createdb -U engofy <name>`),
  ідемпотентно (не падає, якщо БД вже існує).
- В кінці друкує підсумок (offset, порт бекенда, назви БД, індекси Redis) — за зразком фінального
  `echo` у `shift`'s `make ports`.

### [ ] 2. Офсет порту apps/web + документація порту nlp-service
- Branch: `worktree-db-isolation-02-web-nlp-ports`
- Base: `worktree-db-isolation-01-backend-db-redis-ports`
- PR: —

Поширює ту саму offset-схему на `apps/web`: `make ports OFFSET=<N>` додатково пише
`apps/web/.env.local` (Astro/Vite читає `.env.local` автоматично) з `PORT=4321+N` та `API_ORIGIN`, що
вказує на офсетний бекенд-порт (`http://localhost:8080+N`). Якщо Astro dev-сервер не підхоплює `PORT`
з env самостійно — скоригувати `apps/web/astro.config.mjs`, який зараз хардкодить `server: { port:
4321 }`, щоб читати порт з `process.env.PORT` так само, як вже читається `API_ORIGIN`.

`nlp-service` не докеризований у dev-режимі і не має власного `.env`-файлу — код і Dockerfile тут не
змінюються. `make ports` лише додає до підсумкового виводу рекомендований прапорець
(`uvicorn app:app --port 8000+N`) для ручного запуску другого інстансу.

### [ ] 3. Документація та скіли git-workflow
- Branch: `worktree-db-isolation-03-docs-skills`
- Base: `worktree-db-isolation-02-web-nlp-ports`
- PR: —

Оновлює кореневий `README.md`: прибирає застарілий ручний рецепт (Troubleshooting-пункт про ручне
перейменування `MIKRO_ORM_DB_NAME`/`REDIS_DB` та `createdb`) і документує `make ports OFFSET=N` як
спосіб паралельної роботи з кількома worktree одночасно, включно з портом nlp-service.

Оновлює `.agents/skills/task/SKILL.md` (Step 3a, розділ Boundaries) та `.agents/skills/slice/SKILL.md`
(розділ Boundaries) — там зараз є явна інструкція "не винаходь Docker port-offset/env-isolation
machinery, якщо її ще нема в compose.yaml/тулінгу". Після цього зрізу вона вже є, тож інструкцію
потрібно замінити на: під час створення worktree для задачі/зрізу — визначити вільний `OFFSET` (за
кількістю вже існуючих worktree через `git worktree list --porcelain`) і запустити
`make ports OFFSET=<N>` у щойно створеному worktree, перш ніж `pnpm i`/`make sync`.
