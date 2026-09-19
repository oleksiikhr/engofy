---
slug: pre-deploy-cleanup
title: Підчистка перед деплоєм
base_branch: main
created: 2026-09-19
status: in-progress
---

# Підчистка перед деплоєм

## Context

Перед першим деплоєм зробили повну перевірку (gates, Playwright, живий конвеєр з реальним
Anthropic API, CLI, cron, обхід усіх сторінок). Знайдено чотири TODO в коді та кілька багів і
недоробок. Частину виправлень уже зроблено в робочому дереві, але не закомічено. Решту розбито на
зрізи, які можна рев'юїти окремо.

Стан на старті: `tsc`, biome, `astro check`, `migration:check`, `astro build` чисті; vitest 1076/1076;
Playwright 83/83; pytest 8/8. Конвеєр: 7 стадій `completed`, $0.05 за пост.

## Зрізи

### [x] 1. Закомітити вже зроблені виправлення
- Branch: `pre-deploy-cleanup-01-verification-fixes`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/53

Уже лежить у робочому дереві, потрібно лише перевірити й закомітити:
- `activate-mock-subscription.handler.ispec.ts` — очікувані значення в UTC (тест залежав від локальної
  таймзони і ламався через перехід на зимовий час 25 жовтня).
- `.env.development` — `PUBLIC_URL` з `:3000` на `:4321` (листи, CORS-origin у dev).
- `apps/web/e2e`: видалено `feed.spec.ts` і `pages/feed-page.ts` (стрічка переїхала на `/posts`,
  `due-badge` більше немає), оновлено `smoke.spec.ts`, `login-page.ts` (двозначний локатор «Log in»),
  `grammar.spec.ts` (очікується `learned`: правило «most advanced wins»).
- `apps/web/playwright.config.ts` — `workers: 1` і проєкт `pristine` (practice, profile-progress) перед
  рештою, бо специфікації мутують одного сідованого юзера.

Без зміни контрактів. Перевірка: `pnpm test`, `pnpm exec playwright test`, `biome check`.

### [x] 2. Видалити мертвий ендпоінт `/content/feed` (TODO про keyset)
- Branch: `pre-deploy-cleanup-02-remove-dead-feed`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/54

Фронтенд не викликає `/feed` (згадка лише в коментарі `apps/web/src/lib/api.ts`), `/posts` уже
працює на keyset-пагінації. Замість міграції на keyset прибрати ендпоінт разом з TODO:
`src/modules/post/queries/get-feed/*`, маршрут і DTO в `content.controller.ts`, підключення в
`post.service.ts`/`post.module.ts`, тести в `content.controller.ispec.ts`, коментар-посилання в
`get-posts-list.handler.ts`, рядок про `get-feed` у `.agents/skills/engofy/references/db-performance.md`,
застарілий коментар в `api.ts`. Точний список знайти через `git grep -n "GetFeed\|get-feed\|content/feed"`.

Контракт: це видалення HTTP-ендпоінта. За правилом `task` видалення має йти окремим зрізом після
підтвердженого деплою споживачів. Тут споживачів немає (перевірено grep), тому окремі зрізи «додати» і
«мігрувати» порожні — виняток, який треба явно підтвердити перед стартом.

Перевірка: `git grep` не знаходить залишків, `pnpm run type`, `pnpm test`, `pnpm migration:check`.

### [x] 3. Гейт `publish` не має крутитись безкінечно
- Branch: `pre-deploy-cleanup-03-publish-gate-stop`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/55

`PublishPostHandler` (`src/modules/post/commands/publish-post/publish-post.handler.ts`) перепланує себе
кожні `PUBLISH_GATE_RETRY_SECONDS`, доки `annotation` і `enrichment` не `Completed`. Якщо гілка
завершилась `failed` або пост зник, джоба живе вічно (у dev це вже сталось з осиротілим job після
`migrate-fresh`).

Спершу прочитати `retry-post` і процесори стадій: чи повторний запуск упалої стадії знову ставить
`publish` у чергу. Тільки якщо так, робити:
- пост відсутній → завершити без повторної постановки;
- гілка `Failed` → не перепланувати, залогувати `warn`, пост лишається `processing` до `retry-post`.

Тести в `publish-post.handler.ispec.ts` для обох випадків. Без зміни payload черги.

Перевірка: `pnpm exec vitest run src/modules/post`, ручний прогін через `pnpm cli post ingest` з
навмисно зламаним ключем (окремо, поза CI).

### [ ] 4. Статус щоденного плану в profile hub (TODO)
- Branch: `pre-deploy-cleanup-04-profile-daily-plan`
- Base: `main`
- PR: —

TODO в `src/entrypoints/web/profile/dto/profile-hub-response.dto.ts:16` розблоковано: `daily_plans` і
`completedAt` уже є (`home.controller.ts`, `daily-plan-response.dto.ts`, `daily-plan.entity.ts`). Додати
в `ProfileHubResponseDto` поле зі статусом сьогоднішнього плану, згідно з наявним запитом (перевикористати
логіку з home/daily-plan замість нового запиту), відобразити в `apps/web/src/pages/profile.astro`,
прибрати TODO.

Контракт: додається поле (аддитивно, старі клієнти його ігнорують), споживач у тому ж репо. Якщо
розділяти суворо за правилом: спершу бекенд, потім `apps/web`. Видалення нічого не потребує.

**Відкрите питання:** що саме показувати (лише «виконано/ні» чи ще й крок 1 з 3)? Без відповіді
зріз не стартує.

Перевірка: ispec для `get-profile`/profile-hub, оновити e2e `profile.spec.ts`.

### [ ] 5. Лендинг для гостя (два TODO в `index.astro`)
- Branch: `pre-deploy-cleanup-05-guest-landing`
- Base: `pre-deploy-cleanup-04-profile-daily-plan`
- PR: —

`apps/web/src/pages/index.astro:88,92`: секції «Features» і «Product screenshots» порожні, гість бачить
заголовок, кнопку та два розділювачі. `prompt.txt`, на який посилається коментар, у репо немає.
Потрібно: копірайт для блоку фіч, 2–3 скриншоти продукту (зняти через `run` skill з сідованих даних,
зберегти у `apps/web/public/`), адаптація під мобільний.

**Блокер:** потрібен текст від власника (або погоджена чернетка). Це UI-зріз, тому спершу чернетка +
скриншот на погодження, потім решта. Оновити `e2e/smoke.spec.ts`, якщо змінюються заголовки.

### [ ] 6. Навігація для гостя та «Feed»
- Branch: `pre-deploy-cleanup-06-nav-cleanup`
- Base: `pre-deploy-cleanup-05-guest-landing`
- PR: —

Пункт «Feed» веде на `/`, яка тепер лендинг (гість) або щоденна сесія (залогінений), а справжній список
у «Posts». Гість бачить Practice і Profile, які просто ведуть на логін. Перейменувати «Feed» (напр.
«Today»/«Home») і вирішити, які пункти ховати від гостя. Файл: `apps/web/src/layouts/Layout.astro`
(перевірити шлях). Оновити e2e, що шукають лінки за назвою.

**Відкрите питання:** нова назва пункту і чи ховати Practice/Profile для гостя.

## Поза зрізами (перевірити, не код)

Окрема чек-ліста перед деплоєм, нічого з цього локально не перевірялось:
- Telegram (`TELEGRAM_*`), Resend (`RESEND_API_KEY`), Google login — немає ключів у dev.
- Docker-збірки трьох образів і `infra/deploy.sh`, `docs/deploy.md`.
- Гість на сторінці рідера викликає `/partials/mark-read` (запит завершується `ERR_ABORTED` у Playwright
  при закритті сторінки): перевірити, що гість не шле зайвий запит і бекенд не логує помилку.
- Дизайн: рідер у теплій палітрі (Baloo 2 + Nunito), решта сайту в індиго + Public Sans. Рішення
  власника: розширити тему чи залишити. Окремий зріз, якщо вирішите уніфікувати.

## Verification (наскрізно)

Після кожного зрізу: `pnpm run type`, `pnpm run lint:check`, `pnpm test`, `pnpm migration:check`;
для `apps/web` ще `pnpm --filter @engofy/web run type` і `pnpm exec playwright test` (стек: `make up`,
API, воркер, `nlp-service`, `astro dev`). Після зрізу 3 і 5 додатково живий прогін
`pnpm cli post ingest <файл>` і візуальна перевірка результату.
