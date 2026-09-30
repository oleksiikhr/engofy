---
slug: grammar-page-readiness
title: Готовність сторінок граматики до продакшена
base_branch: main
created: 2026-09-30
status: in-progress
---

# Готовність сторінок граматики до продакшена

Усі зрізи йдуть в одній гілці `grammar-page-readiness` і закриваються одним PR наприкінці
(розкатку на решту сторінок, зріз 8, можна винести в окремі PR за категоріями). Еталонна
сторінка — `determiners-quantity` (3 usage points, 24 вправи, 9 секцій).

## Чекліст готовності сторінки

Блокери:

- B1. Сторінка віддає 200, без помилок і попереджень у консолі, без 4xx/5xx у мережі.
- B2. Є хоча б один usage point.
- B3. Кожен usage point має `learner_explanation`, `learner_examples`, `translations` (українська).
- B4. Назва конструкції читабельна й унікальна: H1 і `<title>` не «quantity»/«types»/«position».
- B5. Є `<title>`, meta description, canonical, один H1, JSON-LD.
- B6. Немає горизонтального скролу на 390 px.
- B7. Вправи працюють: правильна відповідь → «Correct», неправильна → «Not quite».
- B8. Немає layout shift зі збереженою УКР і вимкненими скриптами (e2e `grammar.spec.ts`).
- B9. Тестові дані («E2E: …») не потрапляють у список, sitemap і пошук.
- B10. Sticky-прогрес не займає пів екрана на мобільному.

Бажано:

- D1. Кожен usage point має вправи.
- D2. Вправи «choose» після помилки показують правильну відповідь/пояснення.
- D3. Cheat sheet не порожній, є «Compare with».
- D4. Темна тема без візуальних дефектів.
- D5. Word-popup і словник працюють на сторінці.
- D6. Ролі-частини мови мають ті самі кольори, що й у читалці (`--pos-*`).
- D7. Цільові слова конструкції клікабельні з перекладом.
- D8. Сторінка не перевантажує A2: пояснення українською в шапці, рівнева фільтрація, зрозумілий
  перший крок.

Поза планом: стан залогіненого користувача, якість українських текстів (потрібне читання людиною),
режим навчання «Вивчити» (окрема фіча, окремий `/task` після зрізу 7).

## Зрізи

### [x] 1. Аудит усіх 94 сторінок і базовий звіт
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: — (єдиний PR наприкінці плану)

Скрипт `apps/web/scripts/grammar-audit.mjs` лише для читання: SQL по B2–B3 та D1 і Playwright по B1, B4–B6, B9. Результат —
таблиця «конструкція × перевірка» нижче в цьому файлі (розділ «Карта розкатки»). Без змін у
продукті.

### [x] 2. Еталонна сторінка, ч.1: шапка й навігація
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: — (єдиний PR наприкінці плану)

Читабельні й унікальні назви конструкцій у H1 і title (B4). Sticky-прогрес стає тонкою смужкою
з поточною секцією, повний список розкривний (B10). Спільні компоненти, тому виграють усі
сторінки.

### [x] 3. Еталонна сторінка, ч.2: кольори частин мови
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

Ролі-частини мови беруть токени `--pos-*` з читалки (D6). Ролі, які частинами мови не є,
лишаються нейтральними. Мапінг фіксуємо як еталон.

Мапінг: `data-role` (content/grammar) лишається слотом формули; частина мови — окремий необовʼязковий
`data-pos="noun|verb|adj|adv|function"` на `<mark>` у `GrammarExample` і `{ text, pos }` у частинах
`GrammarFormula`. Розмітка з `data-pos` втрачає заливку ролі й бере чорнило та підкреслення `--pos-*`
(службові слова — пунктир). Без `data-pos` — нейтральна заливка ролі. На `determiners-quantity`:
квантори/службові слова — `function`, іменники — `noun`.

### [x] 4. Еталонна сторінка, ч.3: слова й переклад
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

Цільові слова конструкції клікабельні з коротким перекладом і прикладом (D7); решта за поточним
правилом. Цільові слова — усе, що в `<mark>`: `annotate-pages` лінкує їх незалежно від частини мови
і частоти, словникові статті для `determiners-quantity` дописані в `assets/lexicon-content.json`
(переклади потребують читання людиною). Після зміни розмітки `<mark>` без зміни тексту — `--refresh`. Зміни в `annotate-pages` і контенті сторінки. Перед реалізацією уточнюємо, які слова
вважати цільовими.

### [x] 5. Еталонна сторінка, ч.4: перевантаження для A2
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

Шапка з коротким поясненням українською, бейдж рівня, українська за замовчуванням або явний
перемикач угорі, usage points до рівня користувача +1 і решта під «Більше складних випадків»,
помітний Practice (D8). Обсяг узгоджуємо на скріншотах до коду.

### [x] 6. Еталонна сторінка, ч.5: вправи
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

«Choose»-вправи показують правильну відповідь або пояснення після помилки (D2). Перевірка B7 на
всіх вправах сторінки.

### [x] 7. Затвердження еталона
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

Прогін чекліста по `determiners-quantity` (mobile/desktop, світла/темна теми), e2e на нове,
скріншоти. Коротка сторінка-стандарт «як виглядає готова сторінка граматики».

### [x] 8. Розкатка на решту 93 сторінок: розбито на зрізи 9–13
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: — (єдиний PR наприкінці плану)

Зріз-плейсхолдер закрито розбиттям на пакети нижче. Контент (usage points, вправи) генерується зараз, українські тексти позначаються для читання людиною.

### [x] 9. Розкатка: блокери з аудиту
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: — (єдиний PR наприкінці плану)

B6 — горизонтальний скрол на `clauses-phrases-exclamations`. B9 — фікстури `e2e-*` не потрапляють у список, sitemap і пошук. B3 — неповний UP на `past-present-perfect-simple`. Повторний прогін `grammar-audit.mjs` для B4 після зрізу 2, оновити карту розкатки.

### [x] 10. Розкатка: 13 сторінок без usage point
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: — (єдиний PR наприкінці плану)

Джерело: у конструкцій без USE-записів EGP `import-egp` тепер робить usage points із FORM-записів із can-do (`usagePointRecords`, 87 записів, разом 661); контент і вправи в `assets/grammar-usage-point-*.json`, вправи в цих сторінках уже є (D1), тож зріз 11 їх не торкається. Українські тексти потребують читання людиною. `<mark>` не потрібен: сторінки рукописні, `annotate-pages` не запускали. B2/B3 для `nouns-*`, `verbs-linking/phrasal/prepositional/there-is-are/types/patterns-that-clauses`, `adjectives-modifying`, `clauses-interrogatives`, `nouns-noun-phrases-grammatical-functions`: usage points з `learner_explanation`, `learner_examples`, українським перекладом.

### [x] 11. Розкатка: вправи для 39 сторінок без вправ
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: — (єдиний PR наприкінці плану)

Змін у коді немає: банк вправ покриває всі 661 UP, dev-БД уже посіяна, `grammar-audit.mjs` показує D1 на всіх реальних сторінках, `modality-can` віддає вправи; D2 закрито в зрізі 6. Карта розкатки оновлена. Початковий опис: D1 за категоріями: `modality-*`, `present-*`, `pronouns-*`, `questions-*`, `reported-speech`, `verbs-patterns-*`, `verbs-phrasal-*`. Вправи «choose» показують правильну відповідь після помилки (D2).

### [ ] 12. Розкатка: cheat sheet для 6 сторінок
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

D3: `adverbs-adverbs-as-modifiers`, `discourse-markers-discourse-markers-in-writing`, `focus-focus`, `future-future-in-the-past`, `pronouns-generic-use`, `e2e-empty-construction` (остання — фікстура, пропустити).

### [ ] 13. Розкатка: фінальний прогін чекліста по всіх сторінках
- Branch: `grammar-page-readiness`
- Base: `main`
- PR: —

Перенести перевірки чекліста (B1, B4–B6, D1, D3) з `grammar-audit.mjs` у e2e або CI-скрипт по всіх реальних сторінках, оновити карту розкатки; сторінка-стандарт лишається джерелом істини.

## Карта розкатки

Знято 2026-09-30 на dev-стеку (`node scripts/grammar-audit.mjs > audit.json` з `apps/web`,
вʼюпорт 390 px, гість). Стовпці: B2 (є usage point), B3 (пояснення+приклади+переклад у всіх UP;
`✗ n/m` — скільки повних), B4 (назва унікальна й не однослівна), B6 (без гор. скролу), D1
(UP із вправами / усього UP), D3 (є cheat sheet). Не в таблиці, бо пройшли на всіх 94: B1 (200, без
console error/warning, без 4xx/5xx), B5 (title, description, canonical, один H1, JSON-LD).

Підсумок:

- B2: пройдено після зрізу 10 (було 13 без usage point: `nouns-plural/types/uncountable/noun-phrases-grammatical-functions`,
  `verbs-linking/phrasal/prepositional/there-is-are/types/patterns-that-clauses`,
  `adjectives-modifying`, `clauses-interrogatives`, `e2e-empty-construction`; лишилась лише фікстура).
- B3: 77 повні; неповні `past-present-perfect-simple` (10/11) і три e2e-фікстури.
- B4: пройдено (перепрогін після зрізу 2 і 9): 90 реальних сторінок з унікальними H1 і `<title>`
  («Adjectives: combining»); однослівні лише самі категорії (`Focus`, `Negation`, `Prepositions`).
- B6: пройдено. Скрол на `clauses-phrases-exclamations` спричиняв H1 з неподільним «phrases/exclamations»;
  виправлено `overflow-wrap: anywhere` на H1 шапки.
- B9 і неповні B3 (`past-present-perfect-simple` 10/11, три e2e-фікстури) — артефакт витоку e2e-фікстур
  у dev-БД `engofy` (посів 2026-09-22, до ізоляції e2e-БД), не дефект продукту: фільтра не потрібно,
  у проді таких рядків немає. `seed-web-e2e.ts` тепер відмовляється працювати з БД, назва якої не
  містить `e2e`. Витік у dev-БД лишається до ручного очищення (`grammar_usage_points` з
  `egp_index is null`, конструкції категорії «E2E: Tenses», повʼязані матчі/картки).
- D1: пройдено (перепрогін у зрізі 11): вправи є в усіх UP усіх 90 реальних сторінок, крім
  `past-present-perfect-simple` 10/11 — той самий витік e2e-фікстур у dev-БД, що й у B3. Було 39 сторінок
  без вправ: банк `grammar-usage-point-exercises.json` уже покриває всі 661 UP, у dev-БД бракувало лише
  посіву (`import-usage-point-exercises`, зараз 0 нових).
- D3: 6 сторінок без cheat sheet.
- B7, B8, B10, D2, D4–D8 аудитом не покриті (потрібна взаємодія/зір) — зрізи 2–7.

| Конструкція | Назва | B2 | B3 | B4 | B6 | D1 | D3 |
|---|---|---|---|---|---|---|---|
| `adjectives-combining` | combining | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `adjectives-comparatives` | comparatives | ✓ | ✓ | ✓ | ✓ | 9/9 | ✓ |
| `adjectives-modifying` | modifying | ✓ | ✓ | ✓ | ✓ | 13/13 | ✓ |
| `adjectives-position` | position | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `adjectives-superlatives` | superlatives | ✓ | ✓ | ✓ | ✓ | 9/9 | ✓ |
| `adverbs-adverb-phrases-form` | adverb phrases - form | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `adverbs-adverbs-and-adverb-phrases-types-and-meanings` | adverbs and adverb phrases: types and meanings | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `adverbs-adverbs-as-modifiers` | adverbs as modifiers | ✓ | ✓ | ✓ | ✓ | 31/31 | ✗ |
| `adverbs-position` | position | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `clauses-comparatives` | comparatives | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `clauses-conditional` | conditional | ✓ | ✓ | ✓ | ✓ | 23/23 | ✓ |
| `clauses-coordinated` | coordinated | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `clauses-declarative` | declarative | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `clauses-imperatives` | imperatives | ✓ | ✓ | ✓ | ✓ | 16/16 | ✓ |
| `clauses-interrogatives` | interrogatives | ✓ | ✓ | ✓ | ✓ | 10/10 | ✓ |
| `clauses-phrases-exclamations` | phrases/exclamations | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `clauses-relative` | relative | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `clauses-subordinated` | subordinated | ✓ | ✓ | ✓ | ✓ | 16/16 | ✓ |
| `conjunctions-coordinating` | coordinating | ✓ | ✓ | ✓ | ✓ | 11/11 | ✓ |
| `conjunctions-subordinating` | subordinating | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `determiners-articles` | articles | ✓ | ✓ | ✓ | ✓ | 7/7 | ✓ |
| `determiners-demonstratives` | demonstratives | ✓ | ✓ | ✓ | ✓ | 15/15 | ✓ |
| `determiners-possessives` | possessives | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `determiners-quantity` | quantity | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `discourse-markers-discourse-markers-in-writing` | discourse markers in writing | ✓ | ✓ | ✓ | ✓ | 11/11 | ✗ |
| `e2e-conditionals` (e2e) | conditionals | ✓ | ✗ 0/2 | ✓ | ✓ | 0/2 | ✓ |
| `e2e-empty-construction` (e2e) | empty construction | ✗ | — | ✓ | ✓ | — | ✗ |
| `e2e-past-perfect` (e2e) | past perfect | ✓ | ✗ 1/2 | ✓ | ✓ | 0/2 | ✓ |
| `e2e-present-simple` (e2e) | present simple | ✓ | ✗ 0/1 | ✓ | ✓ | 0/1 | ✓ |
| `focus-focus` | focus | ✓ | ✓ | ✓ | ✓ | 15/15 | ✗ |
| `future-future-continuous` | future continuous | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `future-future-expressions-with-be` | future expressions with be | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `future-future-in-the-past` | future in the past | ✓ | ✓ | ✓ | ✓ | 5/5 | ✗ |
| `future-future-perfect-continuous` | future perfect continuous | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `future-future-perfect-simple` | future perfect simple | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `future-future-simple-with-will-and-shall` | future simple (with will and shall) | ✓ | ✓ | ✓ | ✓ | 11/11 | ✓ |
| `future-future-with-be-going-to` | future with be going to | ✓ | ✓ | ✓ | ✓ | 7/7 | ✓ |
| `future-present-continuous-for-future-use` | present continuous for future use | ✓ | ✓ | ✓ | ✓ | 9/9 | ✓ |
| `modality-adjectives` | adjectives | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `modality-adverbs` | adverbs | ✓ | ✓ | ✓ | ✓ | 7/7 | ✓ |
| `modality-can` | can | ✓ | ✓ | ✓ | ✓ | 13/13 | ✓ |
| `modality-could` | could | ✓ | ✓ | ✓ | ✓ | 26/26 | ✓ |
| `modality-dare` | dare | ✓ | ✓ | ✓ | ✓ | 4/4 | ✓ |
| `modality-expressions-with-be` | expressions with be | ✓ | ✓ | ✓ | ✓ | 18/18 | ✓ |
| `modality-have-got-to` | have (got) to | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `modality-may` | may | ✓ | ✓ | ✓ | ✓ | 12/12 | ✓ |
| `modality-might` | might | ✓ | ✓ | ✓ | ✓ | 9/9 | ✓ |
| `modality-must` | must | ✓ | ✓ | ✓ | ✓ | 10/10 | ✓ |
| `modality-need` | need | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `modality-ought` | ought | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `modality-shall` | shall | ✓ | ✓ | ✓ | ✓ | 7/7 | ✓ |
| `modality-should` | should | ✓ | ✓ | ✓ | ✓ | 12/12 | ✓ |
| `modality-used-to` | used to | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `modality-will` | will | ✓ | ✓ | ✓ | ✓ | 10/10 | ✓ |
| `modality-would` | would | ✓ | ✓ | ✓ | ✓ | 13/13 | ✓ |
| `negation-negation` | negation | ✓ | ✓ | ✓ | ✓ | 12/12 | ✓ |
| `nouns-noun-phrases` | noun phrases | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `nouns-noun-phrases-grammatical-functions` | noun phrases - grammatical functions | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `nouns-plural` | plural | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `nouns-types` | types | ✓ | ✓ | ✓ | ✓ | 7/7 | ✓ |
| `nouns-uncountable` | uncountable | ✓ | ✓ | ✓ | ✓ | 8/8 | ✓ |
| `passives-get-and-have` | get and have | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `passives-passives-form` | passives: form | ✓ | ✓ | ✓ | ✓ | 10/10 | ✓ |
| `past-past-continuous` | past continuous | ✓ | ✓ | ✓ | ✓ | 6/6 | ✓ |
| `past-past-perfect-continuous` | past perfect continuous | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `past-past-perfect-simple` | past perfect simple | ✓ | ✓ | ✓ | ✓ | 12/12 | ✓ |
| `past-past-simple` | past simple | ✓ | ✓ | ✓ | ✓ | 10/10 | ✓ |
| `past-present-perfect-continuous` | present perfect continuous | ✓ | ✓ | ✓ | ✓ | 4/4 | ✓ |
| `past-present-perfect-simple` | present perfect simple | ✓ | ✗ 10/11 | ✓ | ✓ | 10/11 | ✓ |
| `prepositions-prepositions` | prepositions | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `present-present-continuous` | present continuous | ✓ | ✓ | ✓ | ✓ | 11/11 | ✓ |
| `present-present-simple` | present simple | ✓ | ✓ | ✓ | ✓ | 14/14 | ✓ |
| `pronouns-demonstratives` | demonstratives | ✓ | ✓ | ✓ | ✓ | 12/12 | ✓ |
| `pronouns-generic-use` | generic use | ✓ | ✓ | ✓ | ✓ | 5/5 | ✗ |
| `pronouns-indefinite-thing-one-body-etc` | indefinite - thing, -one, -body etc | ✓ | ✓ | ✓ | ✓ | 8/8 | ✓ |
| `pronouns-possessive` | possessive | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `pronouns-quantity` | quantity | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `pronouns-reciprocal` | reciprocal | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `pronouns-reflexive` | reflexive | ✓ | ✓ | ✓ | ✓ | 8/8 | ✓ |
| `pronouns-subject-object` | subject/ object | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `pronouns-substitution-one-ones-none` | substitution, one, ones, none | ✓ | ✓ | ✓ | ✓ | 4/4 | ✓ |
| `questions-alternatives` | alternatives | ✓ | ✓ | ✓ | ✓ | 4/4 | ✓ |
| `questions-tags` | tags | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `questions-wh` | wh- | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `questions-yes-no` | yes/no | ✓ | ✓ | ✓ | ✓ | 2/2 | ✓ |
| `reported-speech-reported-speech` | reported speech | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `verbs-linking` | linking | ✓ | ✓ | ✓ | ✓ | 3/3 | ✓ |
| `verbs-patterns-that-clauses` | patterns_that clauses | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `verbs-patterns-with-to-and-ing` | patterns_with to and -ing | ✓ | ✓ | ✓ | ✓ | 5/5 | ✓ |
| `verbs-phrasal` | phrasal | ✓ | ✓ | ✓ | ✓ | 9/9 | ✓ |
| `verbs-phrasal-prepositional` | phrasal-prepositional | ✓ | ✓ | ✓ | ✓ | 1/1 | ✓ |
| `verbs-prepositional` | prepositional | ✓ | ✓ | ✓ | ✓ | 4/4 | ✓ |
| `verbs-there-is-are` | there is/are | ✓ | ✓ | ✓ | ✓ | 7/7 | ✓ |
| `verbs-types` | types | ✓ | ✓ | ✓ | ✓ | 10/10 | ✓ |
