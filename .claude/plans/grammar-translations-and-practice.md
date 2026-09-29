---
slug: grammar-translations-and-practice
title: Граматика — український переклад пояснень і секція Practice
base_branch: main
created: 2026-09-28
status: in-progress
---

# Граматика — український переклад пояснень і секція Practice

## Контекст

Продовження завершеного плану `grammar-content-rewrite`: усі 90 конструкцій `/grammar/[slug]` тепер
мають ручні сторінки в `apps/web/src/grammar-pages/*.astro` (гілка `changes`). Слайс 1 стартує лише
після того, як `changes` змерджено в `main`.

**Переклад.** Користувач хоче переклад для тих, хто знає англійську на A2-B1 — зараз усе лише
англійською. Дані частково вже існують:
- `GrammarUsagePointRef.translations` (`apps/web/src/lib/types.ts`) — `GrammarTranslations`,
  `Partial<Record<'uk', { explanation: string }>>`, прокинутий у `GrammarConstructionUsagePoint`.
- Заповнюється стадією `grammar_enrichment` (`enrich-grammar.handler.ts` +
  `grammar-enrichment-prompt.ts`).
- Ніде не рендериться: `GrammarUsagePointCard.astro` показує лише `explanation`/`canDoStatement`.

Показ — тумблер/hover, не суцільний білінгвальний текст (менше видимої інформації одразу).

**Вправи.** Банк вправ на usage point уже є (PR #128/#129/#133/#135: модель + seed importer, query,
кнопка Practice і секція вправ у `GrammarUsagePointCard.astro`). Зафіксований намір щодо формату:
fill-the-gap основний тип + MCQ (одна однозначна відповідь, 100% автоперевірка; без
transform/error-correction); речення генерує AI за патерном usage point (`canDoStatement`/
`explanation` + рівень + 2-3 EGP-приклади як few-shot), не EGP-корпус напряму; масштаб — спершу MVP
10-15 вправ на 1-2 usage points, перевірка якості, потім ~100 на кожен. Секція `Practice` у
`GrammarShell.astro` на кожній сторінці досі лише анонс.

**Стан даних (2026-09-28, локальна БД).** 580 usage points (575 з `egpIndex`, 5 — E2E-фікстури),
лише 2 мають `learnerExplanation`, 1 — `translations.uk`: `grammar_enrichment` покриває тільки
точки, які зматчив якийсь пост, і на локальних постах не запускався. `GET /grammar/:slug`
(`get-grammar-construction.handler.ts`, `ConstructionUsagePointDto`) `translations` взагалі не
віддає — поле в `GrammarUsagePointRef` на фронті є лише завдяки типу.

**Рішення (з користувачем).** Контент пишеться вручну в сесії Claude Code, без Anthropic API і без
AI-CLI. На кожну точку — те саме, що дав би `grammar_enrichment`: `explanation` (2-3 речення
простою англійською, рівень точки або нижче, патерн форми), 2-3 `examples` (≤12 слів, побутова
лексика), `uk` — вірний переклад `explanation` природною українською, патерн форми лишається
англійською. Сховище — `assets/grammar-usage-point-content.json`, ключ — `egpIndex`, завантажується
`make seed` у `learnerExplanation`/`learnerExamples`/`translations.uk` (сид авторитетний —
перезаписує). `grammar_enrichment` після цього такі точки пропускає (gap-fill по `translations`).
Щоб узяти точки зрізу: `SELECT p.egp_index, c.slug, p.cefr_level, p.guideword, p.can_do_statement
FROM grammar_usage_points p JOIN grammar_constructions c ON c.id = p.construction_id WHERE c.slug IN
(...) ORDER BY c.slug, p.egp_index` + форма/приклади з відповідної ручної сторінки
`apps/web/src/grammar-pages/<slug>.astro`, щоб пояснення не суперечило прозі сторінки.

## Зрізи

### [x] 1. Інфраструктура перекладу + тумблер + ADJECTIVES (22)
- Branch: `grammar-translations-and-practice-01-uk-explanation`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/158

Бекенд: `translations` у `ConstructionUsagePointView`/`ConstructionUsagePointDto`
(`readGrammarTranslations`). Сид: формат `assets/grammar-usage-point-content.json` (zod-парсер у
`modules/post/domain/`, опис у `assets/README.md`), команда `grammar import-usage-point-content`
(помилка на невідомий `egpIndex`), додана в `make seed`. Фронт: тумблер `EN/УКР` у
`GrammarUsagePointCard.astro` — спільний з reader popup pref `popupLang` (`lib/prefs.ts`, доданий у
`bootScript()`), показ перекладу через CSS від `<html data-popup-lang>` (без layout shift), e2e "does
not shift".
Картка без перекладу — без тумблера. Контент: ADJECTIVES (4 конструкції, 22 точки).

### [x] 2. Контент: ADVERBS, CONJUNCTIONS, DISCOURSE MARKERS (61)
- Branch: `grammar-translations-and-practice-02-adverbs-conjunctions`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/159

`adverbs-*` (37), `conjunctions-*` (13), `discourse-markers-*` (11).

### [x] 3. Рідна мова як налаштування: `nativeLang` + тумблер `EN / native`
- Branch: `grammar-translations-and-practice-03-native-lang`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/160

Сайт планує кілька рідних мов (з яких вчать англійську); зараз UI перекладу захардкоджений на `uk`.
Мова в перемикачі завжди одна — рідна мова користувача, тому тумблер лишається двопозиційним.
Бекенд/дані вже мультимовні (`ContentLanguage`, `translations` JSONB за ключем мови) — не чіпати.

- Розвести два поняття, які зараз злиті в `popupLang: 'en' | 'uk'` (`lib/prefs.ts`): рідна мова
  (`TranslationLang`, одне місце-джерело `nativeLang()` — поки повертає `'uk'`; cookie/поле акаунта —
  коли з'явиться друга мова) і що показано: `popupLang: 'en' | 'native'`. `bootScript()` ставить
  `<html data-popup-lang>` зі значенням `en`/`native`; CSS показує переклад від
  `[data-popup-lang='native']`.
- Підпис кнопки й `lang`-атрибут перекладу — від `nativeLang` (мапа `TranslationLang → label`,
  `УКР` для `uk`), замість `LANG_LABEL` з `uk` у `lib/reader-lexicon.ts:212`.
- Прибрати `uk` з назв: `ukExplanation` / `.usage-item__uk` / `[data-usage-lang='uk']` у
  `GrammarUsagePointCard.astro`, `lib/grammar-lang-toggle.ts`, `lib/reader-popup.ts`,
  `lib/reader-lexicon.ts` (`translations[lang]` → `translations[nativeLang]`),
  `lib/dictionary-detail.ts` (`translations.uk` → `translations[nativeLang]`).
- Серверний рендер (`GrammarUsagePointCard.astro`) віддає в HTML лише переклад `nativeLang`, не всі
  мови з `translations`.
- e2e: наявні тести тумблера (картки граматики + reader popup) і "does not shift" проходять з
  перейменованими значеннями; старе значення `popup-lang=uk` у localStorage не мігрувати (прод
  немає) — `bootScript()` просто його ігнорує.

Не входить: переклад UI-оболонки, селектор рідної мови, `hreflang`/мовні префікси URL.

### [x] 4. Контент: CLAUSES (74)
- Branch: `grammar-translations-and-practice-04-clauses`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/161

`clauses-*` — 8 конструкцій.

### [x] 5. Контент: DETERMINERS, FOCUS, NEGATION, NOUNS, PREPOSITIONS (62)
- Branch: `grammar-translations-and-practice-05-determiners-focus`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/162

`determiners-*` (26), `focus-focus` (15), `negation-negation` (12), `nouns-noun-phrases` (6),
`prepositions-prepositions` (3).

### [x] 6. Контент: FUTURE, PASSIVES (58)
- Branch: `grammar-translations-and-practice-06-future-passives`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/163

`future-*` (43), `passives-*` (15).

### [x] 7. Контент: PAST, PRESENT (72)
- Branch: `grammar-translations-and-practice-07-past-present`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/164

`past-*` (47 з `egpIndex`), `present-*` (25).

### [x] 8. Контент: PRONOUNS, QUESTIONS, REPORTED SPEECH, VERBS (63)
- Branch: `grammar-translations-and-practice-08-pronouns-questions`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/165

`pronouns-*` (42), `questions-*` (10), `reported-speech-*` (5), `verbs-*` (6).

### [x] 9. Контент: MODALITY I (56)
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: — (один PR на весь залишок плану, відкривається після останнього зрізу)

`modality-adjectives` (6), `-adverbs` (7), `-can` (13), `-could` (26), `-dare` (4).

### [x] 10. Контент: MODALITY II (56)
- Branch: `grammar-translations-and-practice-09-modality-1` (спільна гілка зі зрізом 9)
- Base: `main`
- PR: — (див. зріз 9)

`modality-expressions-with-be` (18), `-have-got-to` (5), `-may` (12), `-might` (9), `-must` (10),
`-need` (2).

### [x] 11. Контент: MODALITY III (50)
- Branch: `grammar-translations-and-practice-09-modality-1` (спільна гілка зі зрізом 9)
- Base: `main`
- PR: — (див. зріз 9)

`modality-ought` (6), `-shall` (7), `-should` (12), `-used-to` (2), `-will` (10), `-would` (13).
Після зрізу перевірити, що всі 575 точок з `egpIndex` покриті (парсер/тест на повноту).
Зроблено: реальних EGP-точок 574 (575 у БД включало dev-фікстуру) — усі покриті, тест
`usage-point-content-seed.spec.ts` звіряє ключі файлу з USE-рядками `egp.json`.

### [x] 12. Переклад прози ручних сторінок (дослідницький)
- Branch: `grammar-translations-and-practice-09-modality-1` (спільна гілка зі зрізом 9)
- Base: `main`
- PR: — (див. зріз 9)

Рішення користувача (2026-09-29): прозу 90 сторінок **не** перекладати. Натомість будь-яке слово
на сторінці правила має бути клікабельним і показувати інформацію про слово/фразу, як у статтях
(зріз 18). `examples` usage points — перекладати (зрізи 14-17); `canDoStatement` — ні.

### [x] 13. Аудит банку вправ і наповнення секції Practice (дослідницький)
- Branch: `grammar-translations-and-practice-09-modality-1` (спільна гілка зі зрізом 9)
- Base: `main`
- PR: — (див. зріз 9)

Стан (локальна БД, 2026-09-29): `grammar_usage_point_exercises` — 0 рядків,
`assets/grammar-usage-point-exercises.json` не існує; `uk`-переклад мають усі 574 EGP-точки.
Рішення: секція `Practice` у `GrammarShell.astro` = агрегат вправ усіх usage points сторінки;
спершу MVP-банк (зріз 19), після перевірки якості — зрізи масштабування.

Усі наступні зрізи — на гілці `grammar-translations-and-practice-09-modality-1`, один PR після останнього зрізу.

### [x] 14. Інфраструктура `uk.examples` + контент ADJECTIVES, ADVERBS, CONJUNCTIONS, DISCOURSE MARKERS, CLAUSES (157)
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: —

Сид: `uk.examples` у `usage-point-content-seed.ts` — масив тієї ж довжини, що `examples`
(поки опційний, обов'язковим стає в зрізі 17), імпорт пише в `translations.uk.examples`; опис у
`assets/README.md`. Бекенд: `examples` у `GrammarTranslations`/DTO. Фронт: переклад прикладу під
тумблером EN/native у `GrammarUsagePointCard.astro` (CSS від `<html data-popup-lang>`), e2e "does not
shift". Контент: `adjectives-*` (22), `adverbs-*` (37), `conjunctions-*` (13),
`discourse-markers-*` (11), `clauses-*` (74).

### [x] 15. `uk.examples`: DETERMINERS, FOCUS, FUTURE, NEGATION, NOUNS, PASSIVES, PREPOSITIONS (120)
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: —

### [ ] 16. `uk.examples`: PAST, PRESENT, PRONOUNS, QUESTIONS, REPORTED SPEECH, VERBS (135)
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: —

### [ ] 17. `uk.examples`: MODALITY (162) + повнота
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: —

`uk.examples` стає обов'язковим у схемі сиду; `usage-point-content-seed.spec.ts` перевіряє, що
кожна точка має переклад кожного прикладу.

### [ ] 18. Клік по слову на сторінках правил — дизайн (дослідницький)
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: —

У статтях клікабельні спани `[data-word-definition-id]`/`[data-phrase-id]` (`lib/reader-popup.ts`)
мають контекстний сенс з AI-пайплайну; сторінки правил — статичні `.astro`, таких id немає.
Єдиний пошук — `GET /dictionary/words/:lemma` (лише для залогінених, усі сенси леми). Порівняти:
(а) build-time/seed-time анотація тексту сторінки через наявний пайплайн (контекстний сенс, як у
статтях); (б) runtime-пошук за лемою через `nlp-service` (усі сенси, лише слова, що вже є в БД).
Врахувати гостьовий доступ і CLS. Після рішення з користувачем — дописати зрізи.

### [ ] 19. Practice MVP: банк вправ на 1-2 usage points + агрегат на сторінці
- Branch: `grammar-translations-and-practice-09-modality-1`
- Base: `main`
- PR: —

10-15 вправ (`fill_blank` основний тип + `multiple_choice`, одна однозначна відповідь) на 1-2 usage
points у `assets/grammar-usage-point-exercises.json` (формат — `assets/README.md`), речення за
патерном точки (`canDoStatement`/`explanation` + рівень + EGP-приклади як few-shot). Секція
`Practice` у `GrammarShell.astro` — агрегат вправ усіх usage points сторінки. Зупинитися на
перевірку якості користувачем, потім дописати зрізи масштабування по категоріях.
