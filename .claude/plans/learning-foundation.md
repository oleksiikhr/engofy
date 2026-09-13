---
slug: learning-foundation
title: Фундамент моделі вивчення (CEFR-рівень, диспозиції, word_definition_id)
base_branch: main
created: 2026-09-13
status: in-progress
---

# Фундамент моделі вивчення (CEFR-рівень, диспозиції, word_definition_id)

Джерело: `prompt.txt` (продуктовий брейншторм редизайну Engofy). Цей план реалізує лише
наскрізну "фундаментальну" частину, спільну для майбутніх редизайнів окремих сторінок
(Головна, `/dictionary`, `/grammar`, `/practice`, `/posts/[slug]`): збереження CEFR-рівня
юзера, 4-станну модель "Новий/Вивчаю/Вивчив/Пропустив" (`learning_dispositions`), і
міграцію SRS-картки слова на `word_definition_id`. UI окремих сторінок, що споживатимуть
ці дані, — предмет наступних окремих планів.

## Зрізи

### [x] 1. CEFR-рівень користувача та сигнал онбордингу
- Branch: `learning-foundation-01-cefr-onboarding`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/12

Нова колонка `users.cefrLevel` (NOT NULL DEFAULT 'A1', enum `CefrLevel`) + міграція.
Виводиться окремим полем у `ProfileView`/`ProfileResponseDto` (не плутати з наявним
похідним `cefr`-розподілом карток у профілі). Нова команда/ендпоінт
`PATCH /profile/cefr-level` для зміни рівня. `CompleteLoginService.findOrCreateUser`
явно визначає, чи юзера щойно створено (замість сліпого `upsert`), і повертає
`isNewUser` у `LoginResult`; `AuthController` (verify-code і Google) при `isNewUser`
виставляє короткоживучий сигнал (cookie або query-параметр на редиректі, без нової
персистентної колонки) для одноразового онбординг-екрана, який реалізується пізніше на
фронтенді.

### [x] 2. Модель чотирьох станів вивчення (learning_dispositions)
- Branch: `learning-foundation-02-dispositions`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/13

Нова таблиця `learning_dispositions` (`userId`, `wordDefinitionId?`/`phraseId?`/
`grammarUsagePointId?`, `disposition: known|skipped`, `createdAt`) з тим самим патерном
"exactly one target" CHECK + composite UNIQUE, що вже є в `learning_cards`. Доменний
сервіс ефективного стану, що розширює/замінює
`src/modules/post/domain/learning-card-state-priority.ts` — пріоритет: активна
`learning_cards` (будь-який FSRS-стан → "Вивчаю"; `Review` і `scheduledDays ≥ 365` →
"Вивчив") → `learning_dispositions` (known/skipped) → CEFR-дефолт (ціль `cefrLevel` ≤
`users.cefrLevel` → "Вивчив" для UI, нічого не пишеться в БД) → "Новий". Нова команда
`SetDispositionCommand` (пряме known/skipped без картки, для контролу "Я це знаю").
Новий `archivedAt` на `LearningCard` + перша в проєкті команда видалення картки
(`RemoveCardHandler` + `DELETE /learning/cards/:cardId`, наразі такого ендпоінту не
існує): `reps = 0` → фізичне видалення, `reps > 0` → архівація (`archivedAt`) + запис у
`learning_dispositions`. Повторне додавання того самого target через `AddCardHandler`
розархівовує наявну картку (зберігаючи прогрес) замість створення нової.

### [ ] 3. Міграція SRS-картки слова на word_definition_id
- Branch: `learning-foundation-03-word-definition-id`
- Base: `learning-foundation-02-dispositions`
- PR: —

**Явний виняток зі staged-rollout контракт-правила** (task skill): у репо немає жодного
`v*`-тега (перевірено), деплою в прод ще не було — тож `learning_cards.word_id` →
`word_definition_id` змінюється однією прямою міграцією (FK, CHECK, три
UNIQUE-констрейнти), без окремих слайсів зворотної сумісності. `CardTarget`/
`resolveCardTarget` (`src/modules/learning/domain/card-target.ts`) резолвить ціль
`'word'` через `wordDefinitionId`. `AddCardHandler` валідує ціль проти `WordDefinition`
замість `Word`. `GetDictionaryQuery`/handler і
`src/modules/post/queries/get-post-detail/get-post-detail.handler.ts` переходять на
прямий join по `word_definition_id` — заразом фіксується вже знайдений баг:
`buildSidebar`'s `stateByWordId` зараз матчить картку по `wordId`, тому картка на
одному POS-сенсі слова помилково підсвічує всі сенси того самого слова як "відомі".
Малий `apps/web`-тач: кнопка "+" у рідері відправляє `wordDefinitionId` замість
`wordId` (поле вже є в `WordAnnotationView`, зміна тривіальна).
