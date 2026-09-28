---
slug: grammar-content-rewrite
title: Переробка граматичного розділу — ручний контент замість EGP cheat sheet
base_branch: changes
created: 2026-09-22
status: in-progress
---

# Переробка граматичного розділу

## Виконання — ВАЖЛИВО, override дефолтного flow

Ця робота виконується **без worktree, без нових гілок і без PR/push**, на прохання користувача:

- Кожен зріз = звичайний `git commit` прямо в поточну гілку `changes`. Не створювати нову гілку,
  не запускати `git worktree add`, не викликати `git-workflow` для PR.
- Нічого не пушити, поки користувач явно не попросить.
- Кожен зріз Фази 2 (контент по одному правилу) виконується в **окремій новій сесії** — навмисно,
  щоб writer уважно і якісно пропрацював саме це правило. Не намагайся зробити кілька зрізів Фази 2
  за один виклик `slice`.
- Поля `Branch`/`PR` у кожному зрізі нижче навмисно порожні/незастосовні — це не помилка формату
  плану, а свідомий відступ від стандартного `slice`-флоу для цієї задачі.

## Контекст

`/grammar/[slug]` для конструкцій без ручної сторінки в `apps/web/src/grammar-pages/*.astro`
рендерить generic fallback: `GrammarConstruction.cheatSheetContent` — один markdown-блок,
механічно згенерований `buildCheatSheet()` (`src/modules/post/domain/egp.ts`) зі списку EGP
FORM-рядків, без жодної педагогічної обробки. Нижче завжди рендериться `GrammarUsagePoints` — список
usage points з AI-написаним поясненням/прикладами (стадія `grammar_enrichment`), без жодних вправ.

Лише 4 конструкції з 90 мають ручні сторінки (`determiners-articles`, `modality-can`,
`past-past-simple`, `past-present-perfect-simple`), написані за допомогою компонентів
`GrammarShell`/`GrammarSection`/`GrammarFormula`/`GrammarExample`/`GrammarCompare`
(`apps/web/src/components/grammar/`). Мета цього плану — довести решту 86 конструкцій до того ж
рівня якості вручну, і паралельно покращити UI/UX сторінки правила й списку `/grammar`.

## TODO на майбутнє (НЕ зріз, лише зафіксована ідея)

Користувач хоче згодом вправи на кожен usage point, показуючи типові речення/патерни, з яких можна
вчитися. Формат і джерело зафіксовані 2026-09-22 (обговорення після live-огляду
`adjectives-position`), сама реалізація свідомо не входить у зрізи нижче — розглянути окремо, коли
Фаза 2 буде завершена або значно просунута:

- **Формат**: fill-the-gap як основний тип (вставити пропущене слово/форму в речення за патерном), MCQ
  для вибору слова з варіантів — обидва мають одну однозначну правильну відповідь, отже легко 100%
  автоматично перевіряються. Без transform/error-correction (складніше валідувати без fuzzy-matching).
- **Джерело речень**: AI генерує нові речення за патерном usage point (промпт на
  `canDoStatement`/`explanation` + рівень + 2-3 EGP-приклади як few-shot), а не бере готові EGP-корпус
  речення напряму (їх на usage point часто лише 2-4 — не вистачить навіть на MVP) і не бере гібрид.
  Означає, що якість генерації і LLM-галюцинації неоднозначних речень треба буде верифікувати окремим
  проходом, коли до цього дійде.
- **Обсяг старту**: MVP — 10-15 вправ на usage point на 1-2 usage points спочатку, щоб підтвердити
  формат/якість, і лише після цього масштабувати до ~100 на всі. Повний обсяг (~100 × ~3-4 usage
  points × 90 конструкцій) — десятки тисяч вправ, не робити одразу.
- **Оновлення 2026-09-27**: цей TODO вище описаний як "не входить у зрізи нижче", але на практиці
  вправи вже частково реалізовані окремим планом (`GrammarConstructionUsagePoint.exercises` /
  `UsagePointExercise` в `apps/web/src/lib/types.ts`, коментар посилається на "grammar-usage-point-
  -exercises plan, slice 2/3"; рендер — `usagePointExercisesHtml`/`initUsagePointExercises` в
  `GrammarUsagePointCard.astro`). Формат/обсяг вище лишається зафіксованим наміром, але фактичний
  стан реалізації — перевіряти в тому окремому плані, не тут.

**Переклад на українську (піднято 2026-09-27, після живого огляду сторінки правила).** Користувач
хоче переклад для тих, хто знає англійську на A2-B1: зараз усе подається лише англійською.
Виявлено під час обговорення: дані для цього вже частково існують і генеруються, просто ніде не
рендеряться —
- `GrammarUsagePointRef.translations` (`apps/web/src/lib/types.ts`) — тип `GrammarTranslations`,
  `Partial<Record<'uk', { explanation: string }>>` — уже прокинутий до фронтенду через
  `GrammarConstructionUsagePoint`.
- Заповнюється на бекенді в стадії `grammar_enrichment` (`enrich-grammar.handler.ts` +
  `grammar-enrichment-prompt.ts`) — тобто AI вже пише український переклад `explanation` для кожного
  usage point, це не новий пайплайн, який треба будувати з нуля.
- Ніде не рендериться: `GrammarUsagePointCard.astro` показує лише `up.explanation`/`up.canDoStatement`,
  без жодного посилання на `up.translations`.

Отже перший крок тут дешевший, ніж здавалося на початку розмови — не "новий контентний пайплайн", а
(а) перевірити, що бекенд справді заповнює `translations.uk.explanation` для вже написаних Фазою 2
конструкцій (а не лише для нових/generic), і (б) додати UI для показу перекладу в
`GrammarUsagePointCard.astro` (тумблер/hover, не суцільний білінгвальний текст — щоб не суперечити
пункту 1 про "менше видимої інформації одразу"). Не вирішено і не входить у зріз нижче: чи
розширювати переклад на `canDoStatement` і `examples` (їх зараз немає в `GrammarTranslations`), і чи
писаний вручну Фазою 2 контент (прозу в `apps/web/src/grammar-pages/*.astro`) теж перекладати —
розглянути окремо, коли дійде черга.

## Зрізи

### [x] 1. Секційна структура сторінки правила + акордеон + контрастні приклади
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Деталі виконання — див. `archive/grammar-content-rewrite.md#1`.

### [x] 2. UX списку /grammar
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Деталі виконання — див. `archive/grammar-content-rewrite.md#2`.

### [x] 2b. Use-секція закрита за замовчуванням + компактний показ usage points
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

"When it's used" тепер `GrammarSection` (`open={false}`, лічильник "N rules" через новий проп
`meta`); у розгорнутій секції — перші 2 usage points, решта за вкладеним `<details>` "Show N more"
(без JS). Deep link `#usage-point-N` з рідера відкриває всі `<details>` навколо цілі
(`openHashTarget()` у `grammar-section-progress.ts`).

## Фаза 2 — контент по одному правилу (86 зрізів)

Спільний процес для кожного зрізу нижче (не повторюється в кожному пункті):

Написати `apps/web/src/grammar-pages/<slug>.astro`, що замінює generic fallback для цієї
конструкції. Використати `GrammarShell`/`GrammarSection`/`GrammarFormula`/`GrammarExample`/
`GrammarCompare`/`GrammarUsagePointCard` + нові компоненти із зрізу 1 (секції, акордеон, контрастні
приклади). Існуючі дані з `grammar_constructions`/`grammar_usage_points` (сирий EGP + вже
AI-збагачені `learnerExplanation`/`learnerExamples`) — це довідковий матеріал для перевірки фактів, а
не текст для копіювання; писати пояснення, формулу, приклади і типові помилки вручну заради
педагогічної ясності. Секція "Практика" — заглушка/анонс (вправи — окремий TODO вище, не цей зріз).

UI-правила, зафіксовані 2026-09-22 (зрізи 5b/5c) після живого огляду `adjectives-position`,
обов'язкові для кожної сторінки:

- **Підсвітка в прикладах — усі слоти формули, не тільки цільове слово**: для кожного слова/фрази
  прикладу, що відповідає слоту `GrammarFormula`, обгорнути його прямо в тексті речення в
  `<mark data-role="content">…</mark>` або `<mark data-role="grammar">…</mark>`. `content` (жовтий,
  `--color-word`) — слот, названий у формулі "adjective"/"a-adjective"/"-ed form" (сама відмінювана
  граматична категорія, яку вчить сторінка); `grammar` (синій, `--color-gram`) — усі інші слоти формули
  (subject, be/feel/look, the/a, noun, and/but, make, someone/something, too/enough, prepositions
  тощо). Ті самі 2 токени, що й у рідері (word-definition vs grammar-match), для візуальної
  консистентності. Якщо для абзацу нема окремого `GrammarFormula` (напр. "degree adjectives"/"time
  adjectives" на `adjectives-position`, які прямим текстом кажуть "work the same way" як уже показана
  формула) — усе одно розмітити всі слоти за тим самим шаблоном; якщо приклад справді ізольований без
  жодної формули поруч (напр. compound adjectives на `adjectives-combining`), досить одного
  `data-role="content"` на цільове слово. **Пастка**: Astro прибирає прогалину-з-переносом-рядка між
  закриттям тегу і наступним тегом/словом повністю (не стискає в один пробіл, як звичайний HTML) —
  тому кожен розмічений приклад пишеться одним рядком у файлі (`<mark>…</mark> <mark>…</mark>` через
  пробіл, без переносу рядка між ними), інакше слова зливаються в тексті сторінки (`isbig`,
  `onlynarrow`) непомітно для ока (padding `<mark>` це маскує), але ламає копіювання/screen-reader.
  Так само стежити за переносами рядків між `</em>`/`<em>` і сусіднім словом у звичайній прозі.
- **Usage points вплітаються в секцію, а не дублюються знизу**: для кожного `con.usagePoints` знайти
  відповідну `GrammarSection` за `guideword` (підрядком, регістронезалежно) і вставити туди
  `<GrammarUsagePointCard usagePoint={…} />` одразу після прикладу, що це правило ілюструє; зібрати
  `grammarUsagePointId` таких точок у масив і передати як `inlineUsagePointIds` у `<GrammarShell>` —
  тоді generic блок "When it's used" внизу не дублює те, що вже показано в прозі (і взагалі не
  рендериться, якщо після фільтра нічого не лишилось). Якщо usage point не має явного відповідника
  серед написаних секцій (напр. рідкісна C2-конструкція поза темою сторінки), **не** притягувати його
  штучно — залишити в generic-блоці знизу як є.
- **FORM-факти без usage point — це нормально**: правила, яких нема серед `con.usagePoints` (чисті
  EGP `FORM`-рядки, не `USE`/`FORM/USE`), пишуться так само повноцінно (формула + приклад), просто без
  `GrammarUsagePointCard`/кнопки "я це знаю" — рішення 2026-09-22, гейміфікація навмисно лишається
  тільки на USE-класифікованих правилах, не розширювати на FORM без окремого рішення.
- **CEFR-прогрес — угорі, не внизу**: `GrammarShell` сам рендерить `con.levelProgress` (бейджі
  A2/B2/C2 "X/Y learned") одразу під lede, у шапці сторінки — це не частина `GrammarUsagePoints`
  більше, окремо піклуватись про це в зрізі не треба.

Перевірити рендер сторінки (`run` skill / dev-сервер) перед комітом.

Порядок — за CEFR рівнем (A1 → C2), потім алфавітно за slug.

**Запис у плані після закриття зрізу — коротко.** Не писати повний постмортем (перелік команд
перевірки, кількість міток/деталей, скріншоти) у тілі зрізу — цей файл вантажиться в контекст кожної
наступної сесії, і розлогі описи по 86 зрізах роздують його до нечитабельного розміру (уже було
виправлено раз — див. `archive/grammar-content-rewrite.md`). Обмежитись 2-3 реченнями: що написано
(EGP-рядки/секції коротко) і, якщо є, одне нетривіальне рішення, специфічне саме для цього правила.
Якщо під час зрізу відкрито рішення чи пастку, що стосується **всіх** майбутніх зрізів (як 5b/5c) —
воно йде в «Спільний процес»/UI-правила вище, а не повторюється в кожному наступному зрізі. Рутинні
перевірки (`type`/`lint:check`/`build`/Playwright, 0 склеєних слів) не описувати щоразу — вони й так
обов'язкові за «Спільним процесом», не окрема знахідка.

### [x] 3. Adjectives — combining (`adjectives-combining`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-combining`.

### [x] 4. Adjectives — modifying (`adjectives-modifying`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-modifying`.

### [x] 5. Adjectives — position (`adjectives-position`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-position`.

### [x] 5b. UI-фундамент: підсвітка в прикладах + вплетені usage points
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Деталі виконання — див. `archive/grammar-content-rewrite.md#5b`.

### [x] 5c. Ролі-кольори по слотах формули + прогрес угору + fix whitespace-бага
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Деталі виконання — див. `archive/grammar-content-rewrite.md#5c`.

### [x] 6. Adjectives — superlatives (`adjectives-superlatives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `adjectives-superlatives`. Деталі виконання — див. `archive/grammar-content-rewrite.md#6`.

### [x] 7. Adverbs — adverb phrases - form (`adverbs-adverb-phrases-form`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `adverbs-adverb-phrases-form`. Деталі виконання — див. `archive/grammar-content-rewrite.md#7`.

### [x] 8. Adverbs — adverbs and adverb phrases: types and meanings (`adverbs-adverbs-and-adverb-phrases-types-and-meanings`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `adverbs-adverbs-and-adverb-phrases-types-and-meanings`. Деталі виконання — див. `archive/grammar-content-rewrite.md#8`.

### [x] 9. Adverbs — adverbs as modifiers (`adverbs-adverbs-as-modifiers`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `adverbs-adverbs-as-modifiers`. Деталі виконання — див. `archive/grammar-content-rewrite.md#9`.

### [x] 10. Adverbs — position (`adverbs-position`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `adverbs-position`. Деталі виконання — див. `archive/grammar-content-rewrite.md#10`.

### [x] 11. Clauses — coordinated (`clauses-coordinated`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `clauses-coordinated`. Деталі виконання — див. `archive/grammar-content-rewrite.md#11`.

### [x] 12. Clauses — declarative (`clauses-declarative`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-declarative`.

### [x] 13. Clauses — interrogatives (`clauses-interrogatives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `clauses-interrogatives`. Деталі виконання — див. `archive/grammar-content-rewrite.md#13`.

### [x] 14. Clauses — subordinated (`clauses-subordinated`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `clauses-subordinated`. Деталі виконання — див. `archive/grammar-content-rewrite.md#14`.

### [x] 15. Conjunctions — coordinating (`conjunctions-coordinating`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `conjunctions-coordinating`. Деталі виконання — див. `archive/grammar-content-rewrite.md#15`.

### [x] 16. Conjunctions — subordinating (`conjunctions-subordinating`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `conjunctions-subordinating`. Деталі виконання — див. `archive/grammar-content-rewrite.md#16`.

### [x] 17. Determiners — demonstratives (`determiners-demonstratives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `determiners-demonstratives`. Деталі виконання — див. `archive/grammar-content-rewrite.md#17`.

### [x] 18. Determiners — possessives (`determiners-possessives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `determiners-possessives`. Деталі виконання — див. `archive/grammar-content-rewrite.md#18`.

### [x] 19. Determiners — quantity (`determiners-quantity`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `determiners-quantity`. Деталі виконання — див. `archive/grammar-content-rewrite.md#19`.

### [x] 20. Future — future simple (with will and shall) (`future-future-simple-with-will-and-shall`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `future-future-simple-with-will-and-shall`. Деталі виконання — див. `archive/grammar-content-rewrite.md#20`.

### [x] 21. Modality — will (`modality-will`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `modality-will`. Деталі виконання — див. `archive/grammar-content-rewrite.md#21`.

### [x] 22. Modality — would (`modality-would`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `modality-would`. Деталі виконання — див. `archive/grammar-content-rewrite.md#22`.

### [x] 23. Negation — negation (`negation-negation`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `negation-negation`. Деталі виконання — див. `archive/grammar-content-rewrite.md#23`.

### [x] 24. Nouns — noun phrases (`nouns-noun-phrases`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `nouns-noun-phrases`. Деталі виконання — див. `archive/grammar-content-rewrite.md#24`.

### [x] 25. Nouns — noun phrases - grammatical functions (`nouns-noun-phrases-grammatical-functions`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `nouns-noun-phrases-grammatical-functions`. Деталі виконання — див. `archive/grammar-content-rewrite.md#25`.

### [x] 26. Nouns — plural (`nouns-plural`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `nouns-plural`. Деталі виконання — див. `archive/grammar-content-rewrite.md#26`.

### [x] 27. Nouns — types (`nouns-types`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Slug: `nouns-types`. Деталі виконання — див. `archive/grammar-content-rewrite.md#27`.

### [x] 28. Prepositions — prepositions (`prepositions-prepositions`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `prepositions-prepositions`. Деталі виконання — див. `archive/grammar-content-rewrite.md#28`.

### [x] 29. Present — present continuous (`present-present-continuous`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `present-present-continuous`. Деталі виконання — див. `archive/grammar-content-rewrite.md#29`.

### [x] 30. Present — present simple (`present-present-simple`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `present-present-simple`. Деталі виконання — див. `archive/grammar-content-rewrite.md#30`.

### [x] 31. Pronouns — indefinite - thing, -one, -body etc (`pronouns-indefinite-thing-one-body-etc`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `pronouns-indefinite-thing-one-body-etc`. Деталі виконання — див. `archive/grammar-content-rewrite.md#31`.

### [x] 32. Pronouns — subject/ object (`pronouns-subject-object`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `pronouns-subject-object`. Деталі виконання — див. `archive/grammar-content-rewrite.md#32`.

### [x] 33. Questions — yes/no (`questions-yes-no`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `questions-yes-no`. Деталі виконання — див. `archive/grammar-content-rewrite.md#33`.

### [x] 34. Verbs — linking (`verbs-linking`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `verbs-linking`. Деталі виконання — див. `archive/grammar-content-rewrite.md#34`.

### [x] 35. Verbs — patterns_with to and -ing (`verbs-patterns-with-to-and-ing`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Див. «Спільний процес» вище. Slug: `verbs-patterns-with-to-and-ing`.

### [x] 36. Verbs — prepositional (`verbs-prepositional`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `verbs-prepositional`. Деталі виконання — див. `archive/grammar-content-rewrite.md#36`.

### [x] 37. Verbs — there is/are (`verbs-there-is-are`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `verbs-there-is-are`. Деталі виконання — див. `archive/grammar-content-rewrite.md#37`.

### [x] 38. Verbs — types (`verbs-types`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: https://github.com/oleksiikhr/engofy/pull/155

Slug: `verbs-types`. Деталі виконання — див. `archive/grammar-content-rewrite.md#38`.

### [x] 39. Adjectives — comparatives (`adjectives-comparatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

18 EGP-рядків (13-30): 9 чистих FORM (-er/-ier/подвоєння/-e+r/irregular/more/than/перед
іменником/після be) у 3 секціях без карток; 9 FORM/USE (22-30, усі вплетені за `egpIndex`) —
модифікатори компаратива, згруповані за розміром різниці (much/a lot/even; a bit/slightly/not that
much; bigger and bigger; no/not any), а не за рівнем.

### [x] 40. Clauses — comparatives (`clauses-comparatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

20 EGP-рядків (149-168): 14 чистих FORM без карток; 6 FORM/USE (151/152/153/154/161/167) вплетені
за `egpIndex`. Збірна конструкція — 8 секцій згруповані за словом-зв'язкою (like, than + clause,
as … as, the same as, rather than, superlative + clause, as if, too/enough/so … that), content-мітка —
саме це слово, решта слотів — grammar (компаратив теж grammar, бо тема сторінки — зв'язка, не форма).

### [x] 41. Clauses — conditional (`clauses-conditional`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

27 EGP-рядків (1105-1131): 4 чисті FORM (1105/1106/1121/1123) без карток; 23 FORM/USE/USE — усі
вплетені за `egpIndex`. 10 секцій за типом умови (real, imperative+hedging, first, second, third,
if so/not/needed, unless/as long as/whether or not, should, were to, if it weren't for); інверсії
(had/should/were) — у секції свого значення, а не окремим блоком. Додано короткий mixed conditional
(не EGP-рядок) — його обіцяють GrammarCompare-посилання 4 інших сторінок. Content — маркер умови
(if/unless/had/should/were…), grammar — решта слотів.

### [x] 42. Clauses — imperatives (`clauses-imperatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

17 EGP-рядків (186-202): 1 чистий FORM (186) без картки; 16 FORM/USE/USE — усі вплетені за
`egpIndex`. 9 секцій за словом, що починає команду (base verb, don't, do/do not/don't you, come and,
let's/let's not, let me, let him/her/them, imperative + and, see above). Content — саме це слово
(base verb лише в базовій секції; у `don't let` content — `let`, `don't` — grammar).

### [x] 43. Clauses — phrases/exclamations (`clauses-phrases-exclamations`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

7 EGP-рядків (214-220): 6 чистих FORM без карток; 1 FORM/USE (218, negative interrogative) вплетений
за `egpIndex`. 5 секцій за словом, що відкриває вигук (what a, what a pity, how + adjective, how +
clause C2, isn't it / wouldn't it). Додано what + plural/uncountable без `a` (не EGP-рядок, але
головна пастка поруч із what a). Content — what (a)/how/заперечний допоміжний, grammar — решта слотів.

### [x] 44. Clauses — relative (`clauses-relative`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

19 EGP-рядків (221-239): 14 чистих FORM без карток; 5 FORM/USE (233/234/235/238/239) вплетені за
`egpIndex`. 9 секцій за relative-словом (who, which/that, коми defining vs non-defining, без
займенника, whose, where/when/why, the thing that, прийменник у кінці, which про ціле речення).
Додано формальний fronted preposition (to whom / in which / of which) і superlative + zero relative —
їх обіцяють GrammarCompare-посилання з `prepositions-prepositions`/`adjectives-superlatives`. Content —
relative-слово; у реченнях без займенника content-мітки нема (слова нема), усе — grammar.

### [x] 45. Discourse markers — discourse markers in writing (`discourse-markers-discourse-markers-in-writing`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

11 EGP-рядків (1132-1142), усі FORM/USE — усі вплетені за `egpIndex`. 10 секцій за функцією маркера
(as you know / you see, so, sequencing, adding, contrasting, stance, comparing, result, opening/closing,
textual reference). Додано `however` (не EGP-рядок) — його обіцяє GrammarCompare з
`conjunctions-coordinating`. Content — сам маркер, grammar — subject + verb речення, що йде після.

### [x] 46. Focus — focus (`focus-focus`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

15 EGP-рядків (1160-1174), усі FORM/USE — усі вплетені за `egpIndex`. 11 секцій за засобом фокусу:
спершу винесене наперед (phrase, adverb, fixed expressions + подвійні, -ed clause, not a + noun), далі
«рамки» (it's + adj + that, the thing/problem is + premodified, the reason/place … is, what/how-cleft,
it-cleft), далі вказівники в тексті (note/see, wh-заголовки). Content — сам засіб фокусу (фраза/рамка),
grammar — subject + verb і фокусована частина.

### [x] 47. Future — future continuous (`future-future-continuous`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

7 EGP-рядків (353-359): 4 чисті FORM (affirmative will / will+shall, negative, questions) без карток;
3 USE (354/358/359) вплетені за `egpIndex`. 7 секцій (form + shall, won't, questions, in progress +
контраст із will + verb, polite questions, might/may be + -ing, common mistakes). Content — лише
`-ing`-дієслово; subject/will/be/час — grammar (у контрастному прикладі will + verb content-мітки нема).

### [x] 48. Future — future with be going to (`future-future-with-be-going-to`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

14 EGP-рядків (398-411): 7 FORM (affirmative, questions, negative, past, adverbs B1/C1/C2) без карток;
7 USE вплетені за `egpIndex`. 9 секцій (form, negative, questions, plans + контраст із will, predictions
з be / інші дієслова, adverbs mid-position + перед дієсловом, was going to…but, future in the past +
reporting, common mistakes). Content — сам `going to` (як `will` на сторінці will); be/subject/verb/adverb — grammar.

### [x] 49. Future — present continuous for future use (`future-present-continuous-for-future-use`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

13 EGP-рядків (412-424): 4 чисті FORM (when, as soon as, by the time, only when + інверсія) без карток;
9 USE вплетені за `egpIndex`. EGP кладе сюди й present simple для майбутнього (418-424) — тому сторінка
покриває обидва часи: 9 секцій (arrangements, more verbs + контраст із going to, questions, timetables,
I hope, time clauses, only when, suggest that, common mistakes). Content — -ing-дієслово / present
simple дієслово; be/subject/час/when/that — grammar.

### [x] 50. Modality — adjectives (`modality-adjectives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

11 EGP-рядків (425-435): 5 чистих FORM (425/426/429/430/432) без карток; 6 FORM/USE вплетені за
`egpIndex`. 9 секцій за шаблоном (I'm sure, it's important that, it + adj + to, + for + object,
if possible, it is clear/seems obvious that, it is likely that, subject + be likely/sure to, adverb +
adjective). Content — сам модальний прикметник; it/be/seem/that/for/to/adverb і клауза — grammar.

### [x] 51. Modality — adverbs (`modality-adverbs`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

8 EGP-рядків (639-646): 1 чистий FORM (640, maybe/perhaps перед клаузою/еліпсисом) без картки; 7 USE
вплетені за `egpIndex`. 7 секцій (start, mid position після be / перед main verb / перед won't, modal +
adverb, emphasis, could … possibly, not necessarily, one-word answers — 645 і 646 в одній секції) +
common mistakes. Content — сам модальний прислівник; subject/be/auxiliary/modal/main verb/not — grammar.

### [x] 52. Modality — could (`modality-could`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

`assets/egp.json` дублює кожен рядок could (1206-1239 парами) → 13 пар однакових usage points у БД;
картка — перша з пари, обидва id в `inlineUsagePointIds` (сам баг даних не виправлявся). 4 FORM
(affirmative/negative/questions/could have + -ed) без карток, 13 USE вплетені. 11 секцій (form, past
ability, requests, permission, suggestions, possibility, could have: past possibility / past guess /
regret+criticism, reported, common mistakes). Content — сам could / couldn't / could have.

### [x] 53. Modality — expressions with be (`modality-expressions-with-be`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

23 EGP-рядки (464-486): 5 чистих FORM (465/466/470/471/485) без карток; 18 USE вплетені за
`egpIndex`. 14 секцій (form, will be able / modal + be able, was able, allowed, supposed + was supposed,
hearsay, meant, likely + more/less likely, sure/certain/bound, imperative be sure to, due/be to/set,
obliged/forced, + that-clause hedging, not + adj + to vs adj + not + to) + common mistakes. Content —
сам прикметник/дієприкметник (able/allowed/supposed…); be/modal/subject/to/verb/not — grammar.

### [x] 54. Modality — have (got) to (`modality-have-got-to`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

10 EGP-рядків (487-496): 5 чистих FORM (487/488/489/492/494) без карток; 5 USE вплетені за
`egpIndex`. 9 секцій (form + had to / will have to, obligation + must, don't have to vs mustn't,
infinitive after verbs/modals, I have to admit, strong suggestion, deductions, have to have + -ed,
common mistakes). Content — сам have to / has to / 've got to / had to; subject/do/not/verb — grammar.

### [x] 55. Modality — may (`modality-may`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

17 EGP-рядків (497-513): 5 чистих FORM (497/499/500/502/504) без карток; 12 USE вплетені за
`egpIndex`. 13 секцій (form, possibility, adverbs, may well, may (not) have + -ed, permission, formal
requests, as you may know, may … but, may as well, concession, hedging, common mistakes). Content —
сам may / may not / may have / may well / may as well; EGP-приклад 499 "I knew I may not…" не
використано (у минулому природніше might).

### [x] 56. Modality — might (`modality-might`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

15 EGP-рядків (514-528): 6 чистих FORM (514/516/519/522/523/528) без карток; 9 USE вплетені за
`egpIndex`. 11 секцій (form + Might…?, weak possibility, reported speech, suggestions, might (not) have
+ -ed, as you might know, might … but, Might I suggest / Might it not be, might as well, try as I
might, common mistakes). На відміну від `may`, тут `might as well` — FORM-рядок (без картки).

### [x] 57. Modality — must (`modality-must`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

22 EGP-рядки (529-550): 12 чистих FORM (529/530/532/533/534/539/540/541/547/548/549/550) без карток;
10 USE вплетені за `egpIndex`. 12 секцій (form, obligation I/you + wide range, Must I…?, mustn't rules
+ vs don't have to, invitations + suggestions, it must be + can't, must have + -ed / must not have been,
adverbs, I must admit / I must say, ellipsis, inversion, common mistakes). Content — сам must / mustn't /
must have; для заперечної дедукції наголошено can't, а не mustn't (обіцяють may/might/can).

### [x] 58. Modality — shall (`modality-shall`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

10 EGP-рядків (567-576): 3 чисті FORM (567/568/573) без карток; 7 USE вплетені за `egpIndex`. 9 секцій
(form + shan't, offers, suggestions + let's…shall we?, advice, formal plans, rules/contracts з shall not,
after if-clause, predictions + We shall see, common mistakes). Content — сам shall / shall not / shan't;
передбачення третьою особою (EGP 576 "our town shall…") не використано — з I/we природніше.

### [x] 59. Modality — should (`modality-should`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

19 EGP-рядків (577-595): 7 чистих FORM (577/578/579/583/584/590/591) без карток; 12 USE/FORM-USE
вплетені за `egpIndex`. 12 секцій (form, advice, suggestions + shouldn't we?, ideal situations,
likelihood, should have + -ed regrets, You should have seen it!, You shouldn't have!, ellipsis, should be
+ -ing з expectations/obligation, if…should + inversion Should you…, common mistakes). Content — сам
should / shouldn't / should have / should be; контраст "should для правил → must" свідомо не додано
(у табличках/інструкціях should для правил — нормальна англійська).

### [x] 60. Nouns — uncountable (`nouns-uncountable`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

8 EGP-рядків (690-697), усі чисті FORM — без карток. 7 секцій (no a/no plural + singular verb, with the,
quantity words A2+B1 разом, containers/a piece of, "uncountable in English" — B1/C1 рядки злиті в
список іменників, злічуваних в українській (advice/news/furniture…), no article для загального, common
mistakes).

### [x] 61. Passives — passives: form (`passives-passives-form`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

32 EGP-рядки (703-734; 735 — порожній коментар), 22 чисті FORM без карток; 10 USE/FORM-USE вплетені за
`egpIndex`. 12 секцій (form present/past + neg/questions, by (info/focus/relative), continuous (+ future,
past), perfect, will + modals (+ summaries), infinitive, modal perfect, two objects, formal it, -ing forms,
таблиця всіх форм, common mistakes). Розмітка: `be`-частина (is being / has been / could have been) —
`grammar`, лише past participle — `content`, бо саме він незмінний у всіх часах.

### [x] 62. Past — past continuous (`past-past-continuous`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

12 EGP-рядків (743-754): 6 чистих FORM без карток, 6 USE вплетені за `egpIndex`. 8 секцій (form +
neg/questions, in progress, background when/while, reason because, mid-position adverbs A2/B1/B2 разом,
always — repeated B1 + undesired C2 в одній секції, I was wondering if, common mistakes). Розмітка як у
future continuous: `was/were` — `grammar`, `-ing` дієслово — `content`.

### [x] 63. Pronouns — demonstratives (`pronouns-demonstratives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

18 EGP-рядків (938-955): 6 чистих FORM без карток, 12 USE вплетені за `egpIndex`. 11 секцій (four words,
pointing forward, right now, pointing back — 4 картки this/that/these/those разом, whole idea, That's +
That's all разом, quantity + of, this one/these ones, those who/-ed/-ing, that of/those of, common
mistakes). Content — сам демонстратив; `That's` — одна мітка (розділена `That`+`'s` виглядає як два слова).
Не дублює `determiners-demonstratives` (там — перед іменником).

### [x] 64. Pronouns — generic use (`pronouns-generic-use`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

5 EGP-рядків (999-1003), усі USE, вплетені за `egpIndex` (два однакові guideword GENDER NEUTRAL). 7 секцій
(you, one, we/us, they say — без EGP-рядка й картки, someone…they, he or she, common mistakes). Content —
сам генеричний займенник; антецедент (`someone`/`a student`) — `grammar`.

### [x] 65. Pronouns — possessive (`pronouns-possessive`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

19 EGP-рядків (889-907): 17 чистих FORM без карток, 895 — порожній General comment, єдиний USE (903,
that … of yours) вплетений за `egpIndex`. 7 секцій (таблиця my/mine, після be/дієслова/прийменника,
як підмет + формальне Ours is a…, порівняння as…as/than, a friend of mine, that car of his, common
mistakes). Content — сам присвійний займенник. Не дублює `determiners-possessives` (там — перед іменником і 's).

### [x] 66. Pronouns — quantity (`pronouns-quantity`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

14 EGP-рядків (956-969): 12 чистих FORM без карток, два USE (965 formal few/many/most, 969 Many are the…)
вплетені за `egpIndex`. 10 секцій (some/any, both/a few/another, each/either/neither/several/enough, + of +
pronoun, none, formal people, too many/very few, some of which, much has been said/Many are the…, common
mistakes). Content — сам квантифікатор; `of`/займенник/дієслово — `grammar`. Не дублює `determiners-quantity` (там — перед іменником).

### [x] 67. Pronouns — reflexive (`pronouns-reflexive`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

14 EGP-рядків (908-921): 6 чистих FORM без карток, 8 USE/FORM-USE (909, 913 by + reflexive; 912, 919 emphasis;
918 itself; 917 in itself; 920 yourselves polite; 921 as for myself) вплетені за `egpIndex` — generic-блок
не рендериться. 8 секцій (таблиця форм, same person + buy myself a…, після прийменника + next to her, by
myself/itself, emphasis, itself/in itself, formal, common mistakes з -ся калькою). Content — сам зворотний займенник.

### [x] 68. Pronouns — substitution, one, ones, none (`pronouns-substitution-one-ones-none`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

12 EGP-рядків (970-981): 8 чистих FORM без карток, 4 FORM/USE (972 the one + complement, 977 the ones + complement,
978 new ones general, 981 The one(s) that… focus) вплетені за `egpIndex` — generic-блок не рендериться. 7 секцій
(one, ones, the one with…, which/this/that one, focus, none, common mistakes). Content — `one`/`ones`/`none`; детермінатор,
прикметник, complement — `grammar` (навпаки до `pronouns-demonstratives`, де content — this/that).

### [x] 69. Questions — alternatives (`questions-alternatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

8 EGP-рядків (1008-1015): 4 чистих FORM без карток, 4 FORM/USE (1010 or something else, 1012 or not, 1013 strong
alternative, 1014 hedging) вплетені за `egpIndex` — generic-блок не рендериться. 10 секцій (word/phrase/clause, інтонація
↗↘, A, B or something else, Which…, A or B? — без EGP-рядка, or not, еліпсис + hedging, strong alternative, common mistakes
з калькою чи → whether). Content — кожна альтернатива (її розмір і розрізняє FORM-рядки); opener і `or` — `grammar`.

### [x] 70. Questions — tags (`questions-tags`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

7 EGP-рядків (1016-1022): 5 чистих FORM без карток, 2 FORM/USE (1020 right, 1021 imperative softeners) вплетені за
`egpIndex` — generic-блок не рендериться. 11 секцій (базовий тег, +/−, −/+, таблиця вибору дієслова/займенника, інтонація
↘↗, +/+, right?, імператив/Let's…shall we, there + be, відповідь на тег — без EGP-рядка, common mistakes з калькою так?
→ isn't it). Content — сам тег; підмет + дієслово головного речення, яке тег копіює — `grammar`.

### [x] 71. Questions — wh- (`questions-wh`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

9 EGP-рядків (1023-1031): 7 чистих FORM без карток, 2 USE (1028 Why don't we…? suggestion, 1031 focus) вплетені за
`egpIndex` — generic-блок не рендериться. 12 секцій (таблиця wh-слів з укр. відповідниками, be, do, aux be/have, модальні,
how much/what time/which + noun, subject questions — коротко з посиланням на `clauses-interrogatives`, прийменник у кінці,
Why don't we…?, негативні why can't/didn't, focus, common mistakes з калькою How do you think? → What). Content — wh-слово/фраза;
допоміжне, підмет, дієслово — `grammar`. Таблиця з 4 колонками переповнювала контейнер на 375px — укр. переклад злито в колонку.

### [ ] 72. Reported speech — reported speech (`reported-speech-reported-speech`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `reported-speech-reported-speech`.

### [ ] 73. Verbs — patterns_that clauses (`verbs-patterns-that-clauses`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-patterns-that-clauses`.

### [ ] 74. Verbs — phrasal (`verbs-phrasal`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-phrasal`.

### [ ] 75. Verbs — phrasal-prepositional (`verbs-phrasal-prepositional`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-phrasal-prepositional`.

### [ ] 76. Future — future in the past (`future-future-in-the-past`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-in-the-past`.

### [ ] 77. Modality — ought (`modality-ought`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-ought`.

### [ ] 78. Modality — used to (`modality-used-to`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-used-to`.

### [ ] 79. Passives — get and have (`passives-get-and-have`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `passives-get-and-have`.

### [ ] 80. Past — past perfect continuous (`past-past-perfect-continuous`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `past-past-perfect-continuous`.

### [ ] 81. Past — past perfect simple (`past-past-perfect-simple`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `past-past-perfect-simple`.

### [ ] 82. Past — present perfect continuous (`past-present-perfect-continuous`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `past-present-perfect-continuous`.

### [ ] 83. Pronouns — reciprocal (`pronouns-reciprocal`) — рівень B1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-reciprocal`.

### [ ] 84. Future — future expressions with be (`future-future-expressions-with-be`) — рівень B2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-expressions-with-be`.

### [ ] 85. Future — future perfect continuous (`future-future-perfect-continuous`) — рівень B2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-perfect-continuous`.

### [ ] 86. Future — future perfect simple (`future-future-perfect-simple`) — рівень B2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-perfect-simple`.

### [ ] 87. Modality — dare (`modality-dare`) — рівень B2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-dare`.

### [ ] 88. Modality — need (`modality-need`) — рівень B2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-need`.

