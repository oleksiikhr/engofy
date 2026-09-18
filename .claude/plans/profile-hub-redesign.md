---
slug: profile-hub-redesign
title: /profile — легкий хаб, /profile/progress, /profile/subscription, видалення акаунту
base_branch: main
created: 2026-09-13
status: in-progress
---

# /profile — легкий хаб, /profile/progress, /profile/subscription, видалення акаунту

Джерело: `prompt.txt` ("Сторінка /profile"). Поточний `GET /profile` віддає майже все
під майбутній `/profile/progress` — переносимо туди без змін, `/profile` стає легким
хабом. Плюс нова `/profile/subscription` і 30-денне видалення акаунту з
grace-періодом.

## Залежності

Потребує `learning-foundation` зрізу 1 (`users.cefrLevel` + `PATCH
/profile/cefr-level`) для контролу редагування рівня в хабі. **Не починати зріз 1,
доки `learning-foundation` не змерджено в `main`.**

`GET /profile` має рівно одного споживача (apps/web) — розбиття запиту на
хаб+progress безпечне як звичайний PR, не потребує staged-rollout.

## Зрізи

### [x] 1. Розбиття /profile-запиту: хаб vs progress
- Branch: `profile-hub-redesign-01-split-profile-query`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/16

Наявний важкий `GetProfileHandler` (streak+cefr+categories) переїхав без змін під
новий роут `GET /profile/progress`. `GET /profile` став легким хабом (`streak` +
self-reported `cefrLevel`) — реалізатор виявив, що окрема `GetProfileHubQuery` не
потрібна: стрік уже обслуговує наявний `GetStreakQuery`/`LearningService.getStreak`
(раніше — лише для reader-хедера), тож контролер просто комбінує його з
`AuthService.getUser`, без нового CQRS-запиту. `daily_plans.completed_at` ще нема в
`main` (паралельний план `daily-session-home` не змерджений) — цей зріз іде без
цього поля (TODO-коментар у `ProfileHubResponseDto`), додається окремим маленьким
зрізом пізніше.

### [x] 2. Календар активності
- Branch: `profile-hub-redesign-02-activity-calendar`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/28

Новий запит: distinct UTC-дні з `review_logs` — той самий SQL-патерн, що вже в
`GetProfileHandler.computeStreak`, тільки без згортання через
`dailyStreakFromUtcDays` у лічильник; повний список днів для GitHub-style
contribution-графіка. Додається до `/profile/progress`.

### [ ] 3. Редагування CEFR-рівня в хабі
- Branch: `profile-hub-redesign-03-cefr-edit-ui`
- Base: `profile-hub-redesign-02-activity-calendar`
- PR: —

Ендпоінт з `learning-foundation` зрізу 1 вже існує — тут лише хабовий контрол
("Рівень складності контенту", мітки A1-C2) + виклик `PATCH /profile/cefr-level`.
Зміна нічого не мігрує, ефект миттєвий (дефолт "презумпція знання" рахується на
льоту).

### [ ] 4. Видалення акаунту: запит + скасування
- Branch: `profile-hub-redesign-04-account-deletion-request`
- Base: `profile-hub-redesign-03-cefr-edit-ui`
- PR: —

Нова `AccountDeletionRequest` (`userId`, `requestedAt`, `cancelToken`,
`cancelledAt?`) + міграція. Команда запиту видалення: створює запис, ставить job на
mail-чергу за наявним патерном `ChallengeMailerService`/pg-boss воркер-процесор
(`src/entrypoints/worker/auth/send-challenge-email.processor.ts`-подібний). Ендпоінт
скасування по `cancelToken` (доступний і з банера в хабі, і з лінка в листі).
Підписка скасовується одразу як частина запиту на видалення (реальних грошей нема,
`is_mock_payment = true`). Банер у хабі показується, поки є активний
незаскасований запит.

### [ ] 5. Видалення акаунту: cascade cron
- Branch: `profile-hub-redesign-05-account-deletion-cron`
- Base: `profile-hub-redesign-04-account-deletion-request`
- PR: —

Свідомо окремий зріз від запиту/скасування (деструктивна, незворотна дія — окреме
рев'ю). `DeleteExpiredAccountsCron` за наявним патерном `CronJobHost`/`@Cron`
(`src/entrypoints/cron/`), щодня вибирає `requestedAt ≤ now - 30d AND cancelledAt IS
NULL`, каскадно видаляє всі пов'язані дані (не анонімізує).

### [ ] 6. Фронтенд: /profile, /profile/progress, /profile/subscription
- Branch: `profile-hub-redesign-06-frontend-pages`
- Base: `profile-hub-redesign-05-account-deletion-cron`
- PR: —

Три сторінки в `apps/web`: хаб (привітання, streak, статус плану, швидкі посилання,
редагування рівня, банер видалення, логаут — вже є), `/profile/progress`
(перейменований поточний вміст + календар), `/profile/subscription` (план/дата
поновлення з наявного `GetSubscriptionQuery`, "72/100" з `CardLimitService`,
посилання на `/pricing`). Прибрати слово "mock" з копірайту саме
`/profile/subscription` тут (аналогічний фікс на `pricing.astro:88` — інший план,
не дублювати тут).
