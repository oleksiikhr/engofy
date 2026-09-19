---
slug: practice-redesign
title: /practice — реальний reveal-контент і денний ліміт
base_branch: main
created: 2026-09-13
status: in-progress
---

# /practice — реальний reveal-контент і денний ліміт

Джерело: `prompt.txt` ("Сторінка /practice"). Загальна SRS-черга вже реалізована
базово; цей план виправляє знайдений баг ("Show answer" не показує нічого для
word/phrase) разом з архітектурною зміною на `word_definition_id`, додає денний
ліміт нових карток на рівні черги, окремий шаблон для граматики і UX-полірування.

## Залежності

Потребує `learning-foundation` зрізу 3 (`word_definition_id`) — `get-practice-queue`
вже сьогодні резолвить ціль слова через `Word`, а не `WordDefinition`; зріз 1 цього
плану напряму залежить від цієї міграції. **Не починати зріз 1, доки
`learning-foundation` не змерджено в `main`.**

## Зрізи

### [x] 1. Реальний reveal-контент (фікс "Show answer")
- Branch: `practice-redesign-01-reveal-content`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/19

`GetPracticeQueueHandler` (`src/modules/learning/queries/get-practice-queue/`)
резолвить word/phrase-цілі напряму через `WordDefinition`/`Phrase` (definition +
phonetic, де є — `Phrase` не має `phonetic`, шаблон рендерить його умовно) замість
захардкодженого `secondary: null`. Новий пошук "реального речення з контексту":
міст від `wordDefinitionId`-входження до `Sentence.rawText` через перетин
символьних офсетів у межах того самого `postPartId`/`unitIndex` (не через
`sentence_tokens.pos`, який не прив'язаний до сенсу слова), обмежено останніми 3
різними прочитаними постами (`post_reads.readAt desc`), **без fallback** на
AI-`exampleSentence`. Адитивне поле на `PracticeCardTarget` — не є breaking
контракт-зміною. `apps/web`: визначення+фонетика+🔊+речення з посту з міткою
джерела ("зі статті, яку ти читав").

### [x] 2. Денний ліміт нових карток у черзі
- Branch: `practice-redesign-02-daily-new-card-limit`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/27

Новий per-user денний throttle (~12-15/день, `learning_cards.createdAt = сьогодні`),
застосовується лише до карток у стані `New` в `GetPracticeQueueHandler` — due
Review/Relearning показуються завжди без обрізання. Екран завершення явно пояснює
причину, якщо нових показано менше, ніж додано. Кнопка "Показати ще N нових" обходить
денний ліміт для поточної сесії (не чіпає загальний free-tier ліміл 100,
який лишається лише на `AddCardHandler`/`CardLimitService`).

### [x] 3. Окремий шаблон картки для граматики
- Branch: `practice-redesign-03-grammar-card-template`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/34

Окремий reveal-шаблон: кикер = категорія + назва конструкції (join до
`GrammarConstruction`/категорії з `GrammarUsagePoint`), фронт = guideword, reveal =
`canDoStatement` + `exampleText` + реальне речення з контексту (той самий міст, що в
зрізі 1, але для `grammar_matches`) + посилання "Детальніше" на `/grammar/[slug]`
(звичайний `<a>`, редизайн тієї сторінки — окремий план). Явно без contrastive-питання
тут — формат лишається can-do-recall, contrastive-формат відкладений на
`post-detail-redesign`.

### [ ] 4. Черга: порядок, фільтри, кнопки оцінки, UX
- Branch: `practice-redesign-04-queue-ux`
- Base: `practice-redesign-03-grammar-card-template`
- PR: —

Порядок черги (due review/relearning спочатку, нові в останню чергу — вже так через
`orderBy: due asc`, підтвердити явним тестом), чипси фільтра типу (Слова/Фрази/
Граматика, multi-select, default всі), окремі екрани "порожньо" (жодної картки
ніколи) vs "завершено" (черга розчищена), спрощені 2 кнопки ("Вивчив"/"Повтор" →
good/again) для карток у стані `New` проти повної 4-кнопкової шкали для
Review/Relearning (чисто фронтендна зміна — бекенд вже приймає довільний
`ReviewRating`), клавіатурні шорткати (пробіл=показати, 1-4=оцінка), 🔊 кнопка
(Web Speech API, клієнтська) для слова/фрази і контекстного речення.
