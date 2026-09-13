---
slug: daily-session-home
title: Головна — щоденна сесія та guest landing
base_branch: main
created: 2026-09-13
status: in-progress
---

# Головна — щоденна сесія та guest landing

Джерело: `prompt.txt` ("Головна сторінка"). Лінійна "Сьогоднішня сесія" для авторизованих
(пост → контекстна практика → grammar-хайлайт → фінал) + структурний каркас guest-лендінгу.

## Залежності

Потребує `learning-foundation` (усі 3 зрізи: `users.cefrLevel` для вибору поста по
CEFR±1, ефективний стан для вибору grammar-хайлайту, `word_definition_id` для join'у
due-карток) — **не починати зріз 1, доки `learning-foundation` не змерджено в `main`**
(або локально розгалужуватись від його останньої гілки, якщо вона ще існує).

Зріз 2 (запит "due-картки з поста") — спільний з планом `post-detail-redesign`
(зріз 5 там), який використовує той самий запит для фінального екрана рідера при вході
з `/posts`. Хто з двох планів реалізується першим — визначає запит; інший лише
споживає його, не дублює.

## Зрізи

### [x] 1. daily_plans таблиця + вибір поста/граматики (крок 0+1)
- Branch: `daily-session-home-01-plan-selection`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/17

Нова адитивна таблиця `daily_plans` (`userId`, `planDate`, `postId`, `grammarUsagePointId?`,
`completedAt?`, `createdAt`, UNIQUE(`userId`, `planDate`)) — без staged rollout, немає
існуючих споживачів. Find-or-create через стандартний в репо ідіом
`em.upsert(Entity, {...}, { onConflictFields, onConflictAction: 'ignore' })` (той самий,
що в `mark-post-read.handler.ts`, `add-card.handler.ts`,
`complete-login.service.ts#findOrCreateUser`). Вибір поста: непрочитаний
(анти-join `post_reads`) у діапазоні CEFR±1 від `users.cefrLevel`, найновіший спочатку,
розширення діапазону якщо порожньо. Вибір grammar-хайлайту в той самий момент: один
невивчений `grammar_usage_point`, зматчений у обраному пості (`grammar_matches` →
`sentences.postId`), через ефективний стан з `learning-foundation` зрізу 2. Новий
`GET /home/daily-plan` ендпоінт.

### [x] 2. Крок 2 — due-картки з поста (спільний запит з post-detail-redesign)
- Branch: `daily-session-home-02-post-due-cards`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/18

Новий entry-point-agnostic запит (напр. `GetDuePostCardsQuery(postId, userId)`), що
джойнить `LearningCard` (due ≤ now) через `sentence_tokens`/`grammar_matches` →
`sentences.postId`. Рахується наживо (не кешується), відповідно до вимоги в
`prompt.txt`. Тут же вводиться константа денного ліміту нових карток (~12-15) —
`practice-redesign` перевикористовує її, не дублює.

### [ ] 3. Крок 3 (пасивна граматика) + фінальний екран
- Branch: `daily-session-home-03-final-screen`
- Base: `daily-session-home-02-post-due-cards`
- PR: —

Віддає попередньо обрану пасивну grammar-картку (can-do + приклад, без питання).
**Явна примітка для реалізатора:** `prompt.txt` свідомо залишає невирішеним, чи цей
крок пізніше має перевикористовувати активне contrastive-питання з
`post-detail-redesign` замість окремої пасивної картки — за замовчуванням лишаємо їх
окремими, як зараз описано; переглянути після того, як `post-detail-redesign`
задеплоїться. `POST /home/daily-plan/complete` виставляє `completedAt`, підсумковий
рядок рахується з `learning_cards.createdAt = сьогодні` + сьогоднішні
`review_logs`.

### [ ] 4. apps/web: маршрутизація сесії + guest landing каркас
- Branch: `daily-session-home-04-web-routing`
- Base: `daily-session-home-03-final-screen`
- PR: —

Авторизована гілка `/` лінійно проходить зрізи 1-3 (без назад/вперед за бажанням
юзера). Гостьова гілка — тільки структурний каркас із заглушками секцій
(`prompt.txt` явно каже "TODO деталі секцій" — не вигадувати маркетинговий копірайт
зараз). Одноразовий онбординг-екран споживає короткоживучий сигнал першого логіну з
`learning-foundation` зрізу 1 (cookie/query-param), дає змінити рівень через
ендпоінт `PATCH /profile/cefr-level` з того ж зрізу, після чого сигнал очищається.
