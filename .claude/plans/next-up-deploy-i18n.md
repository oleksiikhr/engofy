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

### [x] 6. i18n: дизайн другої мови (дослідницький)
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Вирішити, де живе рідна мова (cookie/акаунт), як зберігаються переклади для `grammar-usage-point`, `word-definition`, `phrase`, як додається мова й що з UI-рядками. Результат — нові зрізи за Step 3b `task`, а не код.

### [ ] 7. Рідна мова: зберігання та визначення (бекенд)
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Колонка `users.native_lang` (default `uk`) + міграція; `PATCH /profile/native-lang`; `/auth/me` повертає `nativeLang`. Резолвер мови запиту: акаунт, інакше cookie `native-lang`, інакше `uk`. При логіні cookie гостя переноситься в акаунт, якщо там значення ще немає.

### [ ] 8. API віддає лише резолвлену мову
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

`lexicon-view`, post-detail, деталі слова/фрази та grammar-construction повертають плоский `translation` / `explanation` для резолвленої мови; прибрати DTO `Record<ContentLanguage, …>`. Кеш і ETag залежать від мови (Vary). Оновити тести. Залежить від 7.

### [ ] 9. apps/web: динамічна рідна мова
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

`nativeLang()` і `NATIVE_LANG_LABEL` беруться з `/auth/me` або cookie на сервері; прибрати літерал `TranslationLang = 'uk'`. Вибір мови на сторінці профілю та для гостя (пише cookie). e2e-перевірка «does not shift when scripts run» для підпису перемикача. Залежить від 8.

### [ ] 10. Seed і backfill по мовах
- Branch: `next-up-deploy-i18n`
- Base: `main`
- PR: —

Імпорт-CLI читають `translations: { <lang>: … }` із seed-файлів замість `entry.uk`; `ENRICHMENT_LANGUAGES` — єдиний список мов для збагачення; backfill-CLI приймає `--lang`. Короткий файл у `docs/` з чеклистом додавання мови: член enum, `CONTENT_LANGUAGE_INFO`, підпис, backfill. Незалежний від 7–9.
