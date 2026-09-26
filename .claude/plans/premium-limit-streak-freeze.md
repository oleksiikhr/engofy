---
slug: premium-limit-streak-freeze
title: Конфігурований ліміт нових карток і streak freeze для Premium
base_branch: main
created: 2026-09-26
status: in-progress
---

# Конфігурований ліміт нових карток і streak freeze для Premium

Дві незалежні Premium-плюшки поверх існуючого гейтингу `BillingService.isPremium()` (той самий
патерн, що й `card-limit.service.ts`). Кожен зріз включає і backend, і frontend — нової фічі
цілком, бо немає жодних існуючих споживачів API, яких можна зламати проміжним станом.

## Зрізи

### [ ] 1. Конфігурований денний ліміт нових карток
- Branch: `premium-limit-streak-freeze-01-configurable-card-limit`
- Base: `main`
- PR: —

Додати на `User` нове nullable поле `dailyNewCardLimitOverride` (integer), за зразком уже наявного
`dailyGoal`/`PATCH /profile/daily-goal` (`user.entity.ts`, `set-daily-goal` command,
`profile.controller.ts`) — міграція. `NewCardBudgetService.remaining()` бере override (з верхньою
межею, напр. 100) лише коли `billing.isPremium(userId)` повертає true; для Free/guest завжди
дефолтні `DAILY_NEW_CARD_LIMIT` (12), незалежно від збереженого значення override. Новий ендпоінт
`PATCH /profile/daily-new-card-limit`, що мірорить `SetDailyGoalDto`/`profile.controller.ts`'s
`daily-goal` роут один в один, з Premium-гейтом (403 для Free/guest). На `/profile/subscription` —
Premium-only контрол (number input) для редагування ліміту; Free бачить нередаговане "12". Юніт-
тести на budget-сервіс і ispec на контролер (Premium/Free/guest).

### [ ] 2. Streak freeze
- Branch: `premium-limit-streak-freeze-02-streak-freeze`
- Base: `premium-limit-streak-freeze-01-configurable-card-limit`
- PR: —

Нова сутність `StreakFreeze` (userId, coveredDate, createdAt) + міграція в модулі `learning`.
Розширити чисті функції `daily-streak.ts` (`computeDailyStreak`/`dailyStreakFromUtcDays`/
`streakFromDays`) необов'язковим параметром замороженних UTC-днів, що додаються до множини днів із
рев'ю — зворотньо сумісна зміна сигнатури. `get-streak.handler.ts` і `get-profile`'s `computeStreak`
підтягують `StreakFreeze`-рядки користувача поряд із днями рев'ю. Ліміт заморозок — фіксований
щомісячний пул (напр. 2/календарний місяць); баланс рахується на льоту (allotment мінус кількість
використаних цього календарного місяця), без окремого лічильника — за тим самим принципом, що й сам
streak (коментар у `daily-streak.ts`: "there is no stored counter"). Новий `POST
/learning/streak/freeze` (Premium-gated, валідує що є прогалина, яку можна покрити, і баланс > 0) та
`GET /learning/streak/freezes` (баланс + чи застосовна заморозка зараз). UI на сторінках зі streak
(профіль/reader header) показує баланс і кнопку "застосувати заморозку" для Premium, коли є
прогалина; Free нічого не бачить. Тести на domain-функції (злиття замороженних днів) і на edge-cases
(баланс вичерпано, немає прогалини, Free/guest reject).
