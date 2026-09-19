---
slug: post-detail-redesign
title: /posts/[slug] — заякорений попап, тулбар, grammar_contrastive
base_branch: main
created: 2026-09-13
status: in-progress
---

# /posts/[slug] — заякорений попап, тулбар, grammar_contrastive

Джерело: `prompt.txt` ("Сторінка /posts/[slug]"), фінально зафіксовано 2026-09-13.
Найскладніша сторінка редизайну — повністю замінює Reader v2 (сайдбар + comprehension
quiz) на один наскрізний механізм: заякорений попап без зсуву контенту, тулбар з 4
незалежними тоглами, і новий `grammar_contrastive` AI-пайплайн замість
`comprehension`. Мокапи: "Direction C" (тепла/грайлива палітра, Baloo 2 + Nunito) —
див. посилання в самому `prompt.txt`.

## Залежності

Потребує `learning-foundation` повністю (усі 3 зрізи: `users.cefrLevel`,
`learning_dispositions`/ефективний стан, `word_definition_id` — зріз 3 там уже
фіксить сайдбарний баг `stateByWordId`→`wordDefinitionId`, тож тут його не
переробляємо). **Не починати зріз 1, доки `learning-foundation` не змерджено в
`main`.**

Зріз 5 (due-картки з поста) — спільний з `daily-session-home` (зріз 2 там). Хто з
двох планів реалізується першим — визначає запит; інший лише споживає.

## Зрізи

### [x] 1. Прибрати сайдбар, повернути спарс-мітки слів/фраз
- Branch: `post-detail-redesign-01-sparse-labels`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/42

Видалити `buildSidebar`/`PostSidebarView` з `GetPostDetailHandler`
(`src/modules/post/queries/get-post-detail/get-post-detail.handler.ts`) і з
`PostDetailView` — контракт звужується, узгоджено, немає інших споживачів окрім
самого рідера, що переписується в цьому ж плані. `renderDoc`
(`apps/web/src/lib/render-doc.ts`, зараз span рендериться ідентично тексту) починає
рендерити `data-word-definition-id`/`data-phrase-id` атрибути на спанах, чий
ефективний стан (через `learning-foundation` зрізу 2 resolver) — new/learning; інші
спани лишаються звичайним текстом. Видалити `PostSidebar`/`Sidebar*Entry` типи з
`apps/web/src/lib/types.ts`.

### [x] 2. Мапінг grammar_matches на дерево вузлів
- Branch: `post-detail-redesign-02-grammar-spans`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/43

Нова, незалежна від word/phrase логіка (окремий модуль поруч з `render-doc.ts`, не
розширення його): `grammar_matches.tokenStart/tokenEnd` (sentence-relative) →
символьні офсети в тексті вузла через `sentence_tokens`/`sentences.rawText` → спан на
відповідному текстовому вузлі, лише для конструкцій з ефективним станом
new/learning.

### [x] 3. Пайплайн grammar_contrastive замість comprehension
- Branch: `post-detail-redesign-03-grammar-contrastive-pipeline`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/44

Новий модуль (аналог `src/modules/post/domain/comprehension-prompt.ts`) +
зміна `GenerateExercisesHandler`: один AI-виклик на унікальний
`grammarUsagePointId`, зматчений у пості (з `grammar_matches`, лише невивчені
конструкції — той самий джойн, що рахує стан у зрізі 1), конкуренти-сиблінги з
тієї ж `grammar_constructions.categoryId`. Результат: (a) пояснювальний текст "чому
X, не Y" (використовується і в Analyze-панелі зрізу 9, і в фінальному квізі зрізу
10 — без дублювання генерації), (b) contrastive-питання з поясненням хибності
кожного варіанта. Зберігається як `exercises.type = 'grammar_contrastive'`,
`payload_json` несе `grammarUsagePointId`/`sentenceId`. Підтверджено: `comprehension`
не має інших споживачів окрім самого рідера (`apps/web/src/pages/
posts/[slugId].astro`, що переписується тут же) — прибирається без staged rollout.

### [x] 4. Word bank для fill_blank
- Branch: `post-detail-redesign-04-fill-blank-options`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/45

`buildFillBlank` (`src/modules/post/domain/build-exercises.ts`) додатково
консумує вже наявний `buildDistractorPool` (той самий, що вже живить
`buildMultipleChoice` для 3 дистракторів) — додає 2-3 дистрактори того самого
POS у `payload_json.options`, фронтенд рендерить тап-чипси; вільний ввід лишається
опційним важчим режимом.

### [x] 5. Due-картки з поста + флаг неправильного дієслова
- Branch: `post-detail-redesign-05-post-due-cards`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/46

Entry-point-agnostic запит "due-картки, чия ціль зустрічалась у пості" (приймає
лише `postId`). **Координація з `daily-session-home`:** перевірити перед
реалізацією, чи той план (зріз 2 там) уже визначив цей запит — якщо так, цей зріз
лише споживає його з фінального екрана рідера, не дублює визначення. Плюс
невеликий lemma-lookup сервіс над `assets/irregular-verbs.json` (зараз лише
CLI-парсер) для позначки неправильного дієслова в Analyze-режимі.

### [ ] 6. Базовий візуальний зсув — шрифти/палітра, прибрати старий quiz
- Branch: `post-detail-redesign-06-base-visual-shift`
- Base: `post-detail-redesign-05-post-due-cards`
- PR: —

`apps/web/src/pages/posts/[slugId].astro` (717 рядків, усе інлайн — немає окремих
компонентів для видалення): гарнітури Baloo 2 + Nunito, тепла кремова палітра,
прибрати секції сайдбару (~267-351) і старий comprehension-блок. **Design-fidelity
checkpoint тут** — перший реальний рендер у новому напрямку; порівняти скріншот з
мокапом ("Direction C") перед тим, як рухатись до наступних зрізів.

### [ ] 7. Заякорений попап — слово/фраза
- Branch: `post-detail-redesign-07-lexicon-popup`
- Base: `post-detail-redesign-06-base-visual-shift`
- PR: —

Новий клієнтський компонент/скрипт: клік по `data-word-definition-id`/
`data-phrase-id` відкриває заякорену картку над/під елементом без зсуву контенту,
контролі "+"/"I know it" (тепер шлють `wordDefinitionId`, поле вже є в
`WordSpanNode`), 🔊 через Web Speech API.

### [ ] 8. Граматичний попап + перекриття
- Branch: `post-detail-redesign-08-grammar-popup-overlap`
- Base: `post-detail-redesign-07-lexicon-popup`
- PR: —

Попап для grammar-спанів (kicker + guideword + can-do + exampleText, ті самі
"+"/"I know it" на `grammarUsagePointId`), двосекційний попап (лексична секція
зверху, граматична знизу, тонкий розділювач) коли лексична і граматична мітка
перекриваються на тому самому діапазоні тексту.

### [ ] 9. Тулбар — POS/tense фарбування + Analyze
- Branch: `post-detail-redesign-09-toolbar-analyze`
- Base: `post-detail-redesign-08-grammar-popup-overlap`
- PR: —

Два незалежні тогли фарбування (POS, tense/construction — детерміновано з наявних
даних, 0 нового бекенду) + режим Analyze (POS-теги по токенах, позначка
неправильного дієслова через lookup з зрізу 5, ідентифікація конструкції з "чому не
X" через `grammar_contrastive`-текст з зрізу 3). Плюс A-/A+ розмір тексту
(`localStorage`, без бекенду) і "Позначити як помилку" всередині попапу (подія в
observability, без нової таблиці).

### [ ] 10. Study mode + фінальний екран
- Branch: `post-detail-redesign-10-study-mode-final-screen`
- Base: `post-detail-redesign-09-toolbar-analyze`
- PR: —

Study mode: форсований лінійний прохід абзац-за-абзацом (решта притемнена),
пропозиція додати нове слово перед "Continue" (той самий пріоритет CEFR≤рівень →
frequency_rank, обрізаний денним лишком ліміту з `daily-session-home` зрізу 2),
опційний грамат-чекін. Не блокує ("Exit study mode"). Фінальний екран: contrastive
grammar-питання(-я) з зрізу 3 (якщо в пості є незнайомі конструкції — інакше блоку
просто нема, без заглушки), рядок-підсумок, CTA на контекстну практику (споживає
запит з зрізу 5; форсовано з Головної, опційно з `/posts`). **Явно перенести
тригер `post_reads`/mark-read з "quiz submit" на "досягнення фінального екрана"**
(зараз фіксується в `apps/web/src/pages/partials/mark-read.ts` на сабміт квізу) —
інакше регресія, коли contrastive-блок відсутній через брак незнайомих
конструкцій.

## Свідомо відкладено (не сюди)

Персистентність тоглів тулбару, дедуп кроку 3 Головної з фінальним екраном (не
вирішено — фіксується як відкрите питання в `daily-session-home` зрізі 3),
морфологічна підсвітка неправильних дієслів (основа+суфікс).
