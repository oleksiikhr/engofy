---
slug: dictionary-redesign
title: /dictionary — список і деталі слів/фраз
base_branch: main
created: 2026-09-13
status: in-progress
---

# /dictionary — список і деталі слів/фраз

Джерело: `prompt.txt` ("Сторінка /dictionary"). Список власних збережених слів/фраз
(без граматики, без глобального пошуку) + сторінки деталей `/dictionary/[lemma]` і
`/dictionary/[phrase]`.

## Залежності

Потребує `learning-foundation` зрізів 2 (`learning_dispositions` + ефективний стан +
`RemoveCardHandler`/`archivedAt`) і 3 (`word_definition_id`) — поточний
`GetDictionaryHandler` показує лише рядки з активною `LearningCard` і резолвить одне
`WordDefinition` на слово через тимчасовий `pickBestDefinitions` (стає незатребуваним
після зрізу 3). **Не починати зріз 1, доки `learning-foundation` не змерджено в
`main`.**

`apps/web/src/pages/dictionary.astro` — єдиний споживач `GET /dictionary`, повністю
переписується в цьому плані, тож бекенд+фронтенд зрізу 1 йдуть в одному PR без
staged-rollout контракт-танцю.

## Зрізи

### [x] 1. Список /dictionary: бекенд + фронтенд разом
- Branch: `dictionary-redesign-01-list`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/24

`GetDictionaryQuery` розширюється: стан-фільтр (Вивчаю/Вивчив/Пропустив через
ефективний resolver з `learning-foundation` зрізу 2 — обов'язково об'єднати активні
`learning_cards` з чисто-`learning_dispositions`-рядками без активної картки, інакше
"Пропустив"/ручне "Вивчив" ніколи не з'являться), текстовий пошук по
`lemma`/`phraseText`, курсорна пагінація, групування по лемі на бекенді. **Рішення
реалізатора:** пагінація по лема-групі (одна лема — один рядок незалежно від
кількості сенсів), курсор сортує за `(lowercase primary, groupId)`; список слів і
фраз посилається на `/dictionary/words/<lemma>` і `/dictionary/phrases/<phrase>`
відповідно (одно-сегментні `[lemma]`/`[phrase]` зіткнулись би в Astro-роутері) —
`/dictionary/words/:lemma` вже узгоджується з зрізом 2 нижче. `dictionary.astro`
переписується під новий запит (SSR query-параметри + htmx для live-фільтра/пагінації
без перезавантаження), клієнтський JS-фільтр прибирається.

### [x] 2. /dictionary/[lemma] — деталі слова
- Branch: `dictionary-redesign-02-word-detail`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/26

Новий запит: усі сенси `WordDefinition` для леми + форми неправильного дієслова
(новий lemma-lookup хелпер над `assets/irregular-verbs.json`, зараз є лише
CLI-парсер без runtime-lookup) + список постів, розбитий read/unread (додається join
`post_reads` до наявного `queryUsage`). Новий `GET /dictionary/words/:lemma`. Кнопки
"Позначити вивченим"/"Пропустити"/"Видалити" — **рішення для реалізатора:**
`learning-foundation` зрізу 2 додає команди (`SetDispositionCommand`,
`RemoveCardHandler`), але не фіксує HTTP-роут для диспозиції явно — додати
`POST /learning/dispositions` (чи еквівалент) тут, якщо зріз 2 його ще не відкрив.

### [ ] 3. /dictionary/[phrase] — деталі фрази
- Branch: `dictionary-redesign-03-phrase-detail`
- Base: `dictionary-redesign-02-word-detail`
- PR: —

Той самий шаблон, простіше (без POS/irregular-verb lookup): визначення/приклад/CEFR
з `Phrase`, список постів read/unread, ті самі дії відомо/пропустити/видалити.
