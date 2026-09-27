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

## Зрізи

### [x] 1. Секційна структура сторінки правила + акордеон + контрастні приклади
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

На сторінці `/grammar/[slug]` (і для generic fallback, і для ручних сторінок): розбити тіло на
секції Form → Use → Типові помилки → Практика (поки заглушка/анонс, вправ ще нема) з прогресивним
розкриттям замість суцільного скролу; sticky чекліст-прогрес по секціях, перевикористовуючи паттерн
track+fill (`.practice__goal-track`/`.practice__goal-fill` з `apps/web/src/lib/practice-card.ts` /
`app.css`); `<details>`-акордеон для form-буллетів у cheat sheet (застосовується одразу до
generic fallback — отже покращує всі ще не переписані 86 правил негайно, до того як дійде Фаза 2);
новий компонент для ✅/❌ контрастних прикладів (вживається і в generic fallback для usage points, і
пізніше в ручних сторінках Фази 2, замість сухого can-do-стейтменту).

### [x] 2. UX списку /grammar
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

На `apps/web/src/pages/grammar.astro`: візуальний progress (ring/bar) на картці конструкції замість
текстового `learnedCount/usagePointCount`; CTA "продовжити навчання" зверху сторінки (для
конструкції в процесі); бейдж "ручний контент" vs "автозгенерований" на картці — за наявністю
відповідного файлу в `apps/web/src/grammar-pages/`.

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

Після живого огляду `adjectives-position` користувач вказав, що ручні секції відчуваються
відірваними від 3 реальних EGP usage points (дублюються окремим блоком карток внизу) і що приклади не
підсвічують слово, яке ілюструють. Рішення (детальніше — обговорення 2026-09-22, зафіксовано вище у
«Спільному процесі» і в TODO про вправи):

- `GrammarExample.astro`: глобальний стиль для `<mark>` всередині прикладу (`--color-gram`, той самий
  токен, що й grammar-хайлайти в reader).
- Новий `GrammarUsagePointCard.astro`, винесений з `GrammarUsagePoints.astro` (той сам рендер картки
  usage point, тепер придатний і для generic-списку знизу, і для вставки прямо в секцію).
- `GrammarShell.astro`: новий проп `inlineUsagePointIds` — фільтрує `con.usagePoints`, що вже показані
  inline, з generic-блоку "When it's used"; якщо після фільтра нічого не лишилось, текст-заглушка
  міняється на "Every usage point for this rule is covered in the sections above." замість "No usage
  points recorded".
- Ретрофіт усіх 3 вже написаних сторінок (`adjectives-position`, `adjectives-combining`,
  `adjectives-modifying`): `<mark>` на цільові слова в кожному прикладі; для `adjectives-position` всі
  3 usage points (LIMITING ADJECTIVES, DEGREE ADJECTIVES ×2) вплетені в секцію "attributive-only" —
  темово збігаються з прозою. `adjectives-combining` має 1 usage point (`USE: FOCUS`, C2, про
  еліптичні речення) без відповідника серед написаних секцій — залишено в generic-блоці свідомо, не
  притягнуто штучно (окрема тема, потребує власного параграфа — не цей зріз). `adjectives-modifying`
  не має usage points узагалі — без змін по цій частині.

Перевірено: `pnpm astro check` (0 помилок), живий рендер трьох сторінок через dev-сервер + Playwright
(мітки/картки на місці, DOM-снапшот `adjectives-position` підтверджує inline-картку під "Limiting
adjectives"/"Degree adjectives" параграфами).

### [x] 5c. Ролі-кольори по слотах формули + прогрес угору + fix whitespace-бага
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Друге коло фідбеку 2026-09-22 після 5b: одна підсвітка на слово не показувала всю формулу (напр. "the
+ main / only + noun" — 3 слоти, 1 мітка); "When it's used" внизу лишався майже пустим блоком (лише
progress-бар) на сторінках, де всі usage points уже inline; кольори підсвітки мали бути тими самими
токенами, що й у рідері, а не довільними. Рішення — див. оновлений «Спільний процес» вище. Крім того,
знайдено і виправлено **окремий, попередньо існуючий баг** під час розмітки: Astro прибирає
whitespace-only текстовий вузол між тегами, якщо він містить перенос рядка (не стискає в пробіл, як
звичайний HTML) — це вже ламало пробіли в оригінальній прозі (`Main and only` + перенос →
`onlynarrow`, `expensive,` + перенос → `expensive,new`) до будь-яких моїх правок; виправлено всюди, де
знайдено на цих 3 сторінках.

- `GrammarExample.astro`: `<mark>` тепер вимагає `data-role="content"|"grammar"`, стилізовані
  `--color-word`/`--color-gram` відповідно (раніше — один нерозрізнений синій `<mark>`).
  `GrammarShell.astro`: `con.levelProgress` рендериться в шапці (`.con-head__progress`), прибрано з
  `GrammarUsagePoints`; `GrammarUsagePoints.astro` тепер не рендерить взагалі нічого (ні h2, ні пункт
  sticky-нав), коли `usagePoints` порожній (спрощено — раніше було "No usage points recorded" текстом).
- Усі 3 вже написані сторінки: кожен приклад під кожною наявною `GrammarFormula` розмічений по всіх
  слотах (subject/be/determiner/noun/conjunction/preposition → `grammar`, adjective/-ed-form →
  `content`); приклади без формули (compound adjectives) лишились з одинарною `content`-міткою.

Перевірено: `pnpm astro check` (0 помилок), Playwright-скріншоти всіх 3 сторінок (progress-бейджі
вгорі, "When it's used" відсутній на `adjectives-position`/`adjectives-modifying`, наявний на
`adjectives-combining` з 1 незакладеним usage point), скрипт-перевірка на злиплі слова
(`</mark>\S`/`\S<mark`/`</em>\S`/`\S<em`) по всіх 3 рендерах — чисто.

### [x] 6. Adjectives — superlatives (`adjectives-superlatives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-superlatives`.

5 секцій: -est/the most патерни + неправильні форми (best/worst/furthest) +
spelling; the + superlative + noun (+ prepositional phrase); ellipsis та one
of the; by far / possible-ever postmodifiers / slightest-faintest ідіома;
типова помилка (superlative для двох речей, подвійне маркування -est+most).
Усі 9 EGP usage points (58,59,60,69,70,74,77,78,79) вплетені інлайн — жоден
не лишився в generic-блоці знизу; "COMPLEX NOUN PHRASES" (A2+B1, той самий
guideword) відрендерені разом як два картки, за прецедентом
DEGREE ADJECTIVES з adjectives-position. Під час рев'ю виявлено і виправлено
ще один випадок відомого Astro-бага з переносом рядка між текстом і `<em>`
(«...instead. And\n<em>-est</em>» → склеїлось у «And-est» без пробілу) — це
трапляється не тільки з `<mark>` у прикладах, а з будь-яким інлайн-тегом,
розбитим переносом рядка на межі тегу.

Перевірено: `pnpm --dir apps/web run type` (0 помилок), `lint:check` (чисто),
`build` (успішно), живий рендер через dev-сервер + Playwright (усі 5 секцій
розкрито, усі приклади й usage-point картки на місці), скрипт-перевірка на
злиплі слова (`</mark>\S`/`\S<mark`/`</em>\S`/`\S<em`) по всьому `.con-body`
— чисто після виправлення.

### [x] 7. Adverbs — adverb phrases - form (`adverbs-adverb-phrases-form`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-adverb-phrases-form`.

Лише 2 EGP-рядки класифіковані як USE/FORM-USE (146 `ADVERB + 'ENOUGH'`, 147
`ADVERBS + PREPOSITIONAL PHRASES, HIGHLIGHT`, обидва C1) — решта (141-145,
148) чисті FORM-рядки без usage point, написані повноцінно (формула +
приклад) без картки, за правилом «FORM-факти без usage point — це
нормально». 5 секцій: very + адверб (A1) разом з тим самим патерном
adverb+adverb, що зростає в діапазоні на A2/B1/C1 (один і той самий
guideword `FORM: ADVERB + ADVERB` повторюється тричі — згорнуто в одну
секцію за прецедентом DEGREE ADJECTIVES з adjectives-position, а не
розбито на 3 підрозділи); порівняльна форма адверба (B2, very тут не
працює — much/far/a lot/even); enough і прийменникова фраза після адверба
(C1, обидва usage points вплетені інлайн); поєднання модифікатора до і
після одночасно (C2); типова помилка (very + comparative, порядок enough).

Перевірено: `pnpm --dir apps/web run type` (0 помилок), `lint:check`
(чисто), `build` (успішно), живий рендер через dev-сервер + Playwright
(усі 5 секцій розкрито, обидві usage-point картки на місці, "When it's
used" відсутній — обидва usage points вже інлайн), перевірка на злиплі
слова через `innerText` після розкриття всіх `<details>` — чисто.

### [x] 8. Adverbs — adverbs and adverb phrases: types and meanings (`adverbs-adverbs-and-adverb-phrases-types-and-meanings`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-adverbs-and-adverb-phrases-types-and-meanings`.

15 EGP-рядків (111-125), лише 1 класифікований як USE (FORM/USE: MODIFYING
CLAUSES, STANCE, B1) — решта чисті FORM-рядки без картки, за правилом
«FORM-факти без usage point — це нормально». 6 секцій за темою «що модифікує
цей тип адверба», а не за рівнем: degree-адверби + adjectives; degree-адверби
+ інші адверби (короткий, з крос-посиланням на `adverbs-adverb-phrases-form`,
щоб не дублювати вже написану механіку combine/enough/prepositional phrase);
адверби напряму модифікують дієслово (degree/frequency vs manner); degree-
адверби модифікують noun phrases/pronouns/determiners/comparatives (B2-C1);
адверби модифікують цілий clause (place-complement, time/sequencing, stance
з карткою); типова помилка (adjective замість -ly adverb при модифікації
дієслова). Приклади написані вручну (не скопійовані з EGP-корпусу) одним
рядком у файлі, щоб уникнути Astro-бага з переносом рядка між тегами.

Перевірено: `pnpm --dir apps/web run type` (0 помилок), `lint:check` (чисто),
`build` (успішно), живий рендер через dev-сервер + Playwright (усі 6 секцій
розкрито, картка usage point на місці, contrast-блок і compare-посилання на
місці), скрипт-перевірка на злиплі слова (`</mark>\S`/`\S<mark`/`</em>\S`/
`\S<em`) по всьому `.con-body` — жодного справжнього збою (лише пунктуація
після тегу).

### [x] 9. Adverbs — adverbs as modifiers (`adverbs-adverbs-as-modifiers`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-adverbs-as-modifiers`.

31 EGP-рядків (80-110), усі класифіковані як USE — найбільша з побудованих
досі конструкцій, кожна точка отримала inline-картку. 11 функціональних
секцій (time, place, frequency, degree+adjectives, degree+verbs, manner,
linking, focus/sequencing/organising, certainty, stance, distancing) + типова
помилка (false friend "actually" ≠ "зараз/наразі"). На відміну від
`adverbs-adverbs-and-adverb-phrases-types-and-meanings` (що модифікує кожен
тип адверба), ця сторінка групує за функцією самого адверба; крос-посилання
в обидва боки, дублікатів EGP-рядків нема (різні `egp_index`). Приклади
написані вручну одним рядком у файлі.

Перевірено: `pnpm --dir apps/web run type` (0 помилок — зловив незекранований
апостроф у `parts={['...what's more...']}`, виправлено на подвійні лапки),
`lint:check` (чисто), `build` (успішно), живий рендер через dev-сервер +
Playwright (усі 13 секцій розкрито, усі 31 картки на місцях з правильними
рівнем/guideword, скрипт-перевірка на злиплі слова навколо `<mark>`/`<em>` —
0 збігів).

### [x] 10. Adverbs — position (`adverbs-position`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-position`.

15 EGP-рядків (126-140), лише 3 класифіковані як USE/FORM-USE (138 NEVER-
inversion B2, 139 HARDLY-inversion C2, 140 mid-position distancing C2) — усі
3 вплетені інлайн, решта 12 чисті FORM-рядки без картки. 6 секцій за
позицією в реченні, а не за типом адверба: front position (просте
фронтування + sentence-адверби, що лінкують до попереднього речення, з
карткою), mid position (перед дієсловом, з really, після be/auxiliary/modal,
+ advanced distancing use з карткою), end position (time/place/manner/degree
разом), degree-адверби перед прикметником (коротко, з крос-посиланням на
`adjectives-modifying` за повним списком інтенсифікаторів — уникнення
дублювання того самого патерну "very + adjective"), inversion після
fronted never/hardly (обидві картки), типова помилка (позиція frequency-
адверба + забута інверсія після never).

Перевірено: `pnpm --dir apps/web run type` (0 помилок), `lint:check` (чисто),
`build` (успішно), живий рендер через dev-сервер + Playwright (усі 6 секцій
розкрито, усі 3 usage-point картки на місцях, CEFR-бейдж у шапці як і на
інших уже написаних сторінках з високорівневими usage points), перевірка
злиплих слів навколо `<mark>` через DOM (сусідні text-вузли) — 36 міток, 0
збігів.

### [x] 11. Clauses — coordinated (`clauses-coordinated`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-coordinated`.

10 EGP-рядків (169-178), 6 класифіковані як (FORM/)USE — instructions
(A2)/narrative (B1) чейнінг кількох клауз, neither...nor (B2), not
only...but (also) без (B2) і з (C1) інверсією, negative clause + nor (C2)
— усі 6 вплетені інлайн; решта 4 чисті FORM-рядки (and/but/or, ellipted
subject, either...or, combining clauses of the same type) написані
повноцінно без картки. 8 секцій: базове з'єднання двох клауз; еліпсис
підмета; чейнінг (instructions/narrative); правило "лише той самий тип
клаузи" (finite vs -ing/to-inf) з контраст-блоком; either...or +
neither...nor як парні сполучники; not only...but (also) звичайний і
фронтований з інверсією; negative clause + nor (з крос-посиланням на
`adverbs-position` за тим самим патерном інверсії never/hardly); типова
помилка. Content-мітка — цільовий сполучник (and/but/or/either/neither/
not only/nor), grammar-мітка — auxiliary/subject у прикладах інверсії
(за прецедентом NEVER/HARDLY з `adverbs-position`).

Перевірено: `pnpm --dir apps/web run type` (0 помилок), `lint:check`
(чисто), `build` (успішно), живий рендер через dev-сервер + Playwright
(усі 8 секцій розкрито, усі 6 usage-point карток на місцях з правильними
рівнем/guideword, "When it's used" відсутній — усі USE вже інлайн,
перевірка на злиплі слова навколо `<mark>` через `innerText` — 0 збігів).

### [x] 12. Clauses — declarative (`clauses-declarative`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-declarative`.

### [x] 13. Clauses — interrogatives (`clauses-interrogatives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-interrogatives`.

11 EGP-рядків (203-213), усі чисті FORM — жодного usage point, отже
жодної картки, "When it's used" не рендериться. Рядок 212 (WHICH/WHOSE)
у EGP без can-do і прикладів — приклади написані вручну. 10 секцій: be
на початку; допоміжні be/have; do/does/did; модальні; wh- (об'єкт);
wh- як підмет без do (з парою Who did you call? / Who called you?);
which/whose + іменник; заперечні питання + why don't we/you як
пропозиція; прислівники в середній позиції (ever/still/usually, також
у заперечних — B2); типові помилки. Content-мітка — дієслово, що
виходить перед підметом (у секціях wh-subject/which-whose/adverb —
відповідно дієслово, which/whose, прислівник), grammar — решта слотів.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (11 details, 97 міток і 49 `<em>` — 0 злиплих
сусідніх слів).

### [x] 14. Clauses — subordinated (`clauses-subordinated`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-subordinated`.

17 EGP-рядків (240-256), 16 FORM/USE — усі 16 вплетені інлайн; єдиний
чистий FORM (250, non-finite після if, C1) написаний без картки в секції
умов. Guideword-и перетинаються (REASON vs 'BECAUSE', REASONS; два
NON-FINITE WITH '-ING' на B1 і B2; CONDITIONS на A2 і B2), тому usage
points матчаться за `cefrLevel` + підрядком guideword. 9 секцій: головна
+ підрядна (позиція і правило коми); reason (because/as/since); time
(+ present замість will, + before/after + -ing); condition (if,
unless/provided, if + -ed); purpose (to-inf, so that/in order that);
contrast (although/even though/while + although + -ed/adj); -ing/-ed
клаузи (after having/being, -ing, not + -ing, based on/compared to);
формальна інверсія (Should/Had/Were + Were + to); типові помилки
(фрагмент, although...but, dangling participle). Content-мітка — сполучник/
вступне слово клаузи, grammar — підмет/дієслово. Кома у формулі
приліплена до попереднього слота (`'verb,'`), а не окремим чипом.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (10 details, 100 міток, 16 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих сусідніх слів навколо
`<mark>`/`<em>`).

### [x] 15. Conjunctions — coordinating (`conjunctions-coordinating`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `conjunctions-coordinating`.

19 EGP-рядків: 11 FORM/USE — усі 11 вплетені інлайн; 8 чистих FORM
(word/phrase/clause/sentence + and/but/or, complex adding so/then, plus з
іменниками, either...or на B1 і C1) написані без картки. Guideword-и
повторюються між рівнями ('BOTH … AND' B1/B2, 'NEITHER' B2/C2, 'YET'
C1/'AND YET' C2, два 'NOT ONLY' на C1 — з/без INVERSION), тому матчинг за
`cefrLevel` + підрядком guideword (+ exclude для NOT ONLY). 9 секцій: що
можуть з'єднувати and/but/or (+ на початку речення); списки; контраст
(but/yet/and yet); so/then/plus; both...and (іменники → фрази);
either...or + neither...nor (+ узгодження дієслова з найближчим
підметом); not only...but also (+ фронтування з інверсією, крос-посилання
на `clauses-coordinated`); Neither/Nor на початку речення з інверсією;
типові помилки (подвійне заперечення з neither...nor, both...or,
not only без інверсії). Відмежовано від `clauses-coordinated`: там —
з'єднання клауз, тут — самі сполучники і що вони з'єднують. Content-мітка
— сполучник, grammar — з'єднані елементи / auxiliary+subject в інверсії.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (10 details, 98 міток, 11 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих слів навколо `<mark>`/`<em>`).

### [x] 16. Conjunctions — subordinating (`conjunctions-subordinating`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `conjunctions-subordinating`.

7 EGP-рядків: 2 FORM/USE — обидва вплетені інлайн (FOCUS whatever/
wherever на початку речення, C1; 'IN THAT', C2); 5 чистих FORM (because
A1, прості сполучники A2/B1/B2, складені B2) написані без картки. У
learner_explanation/examples обох точок порожньо — факти перевірено
за EGP can-do + прикладами. Відмежовано від `clauses-subordinated` (та
організована за значенням клаузи — reason/time/condition…, тут — самі
слова і пари, які плутають, як і обіцяє її GrammarCompare). 12 секцій:
because vs because of (+ due to the fact that); if vs when; while/as/
since з двома значеннями; before/after/until/once/as soon as; although/
though/whereas (+ though-прислівник у кінці, despite the fact that); so
vs so that/in order that; unless/provided/as long as/except that;
whether vs if; as if/as though; -ever на початку речення; in that;
типові помилки (despite/because of + клауза, unless + not, will після
when, on if). Content-мітка — сполучник, grammar — підмет/дієслово
підрядної клаузи (+ look/talks перед as if, прикметник після however).
**Нова пастка**: не лише `</em>`/`<mark>` між тегами — перенос рядка
одразу перед `<em>` посеред прози теж з'їдається (`not\n<em>as` →
`notas`); `<em>` завжди на тому ж рядку, що попереднє слово. Контракції
не розбивати між двома `<mark>` (`you</mark> <mark>'ve` дає зайвий
пробіл) — писати повну форму.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (13 details, 118 міток, 2 картки в секціях
`ever`/`in-that`, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>` — перевірка за символом до/після кожного тегу).

### [x] 17. Determiners — demonstratives (`determiners-demonstratives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `determiners-demonstratives`.

20 EGP-рядків: 15 USE — усі 15 вплетені інлайн; 5 чистих FORM (this +
singular A1, this + uncountable / that / these / those A2) написані без
картки в першій секції (таблиця near/far × singular/plural). Guideword-и
тут неконсистентні ('THIS', POINTING A1 / 'THIS' POINTING| і голий
POINTING на A2 для того самого правила, 'THESE' POINTING||), тому usage
points матчаться за `egpIndex`, а не підрядком guideword. У
learner_explanation/examples усіх точок порожньо — факти перевірено за
EGP can-do + прикладами. 9 секцій: чотири слова (узгодження з числом,
uncountable, замість артикля); near (this/these, «місце, де я є»); far
(that/those, those days, точка зору мовця); вже згадане; час (this + time
word = майбутнє/минуле за часом дієслова, that night в розповіді, без
прийменника); storytelling this (C2); this + noun + of + his (C2);
емоційна дистанція that/those (C2); типові помилки (this shoes / these
informations, the this / this my, in this afternoon). Займенникове
вживання (This is my brother) — лише крос-посилання на
`pronouns-demonstratives` (зріз 63). Content-мітка — демонстратив,
grammar — іменник (+ there was, of + possessive).

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (10 details, 60 міток, 15 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>`).

### [x] 18. Determiners — possessives (`determiners-possessives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `determiners-possessives`.

13 EGP-рядків (318-330): 1 USE (324 GENERIC 'THEIR', B2) — вплетений
інлайн, матч за `egpIndex`; 12 чистих FORM написані без картки. У
learner_explanation/examples точки порожньо — факти перевірено за EGP
can-do + прикладами з `assets/egp.json`. 10 секцій: таблиця my…their
(+ заміна артикля, прикметник між); his/her/its/their за власником, а не
за іменником (+ немає слова «свій»); generic their (everyone has their,
компанія = they); all/some/one of + my; noun + 's (+ 's для людей, of для
речей); parents'/people's/James's/series'; a friend of my father's;
's без іменника (+ at the doctor's) разом з 's + 's; one's (формальне,
vs your); типові помилки (the my / a my, his↔her, it's↔its, the car of my
brother, childrens'). Content-мітка — присвійне слово / noun+'s, grammar —
іменник-власність (+ quantity + of, everyone + дієслово). Присвійні
займенники (mine) — лише крос-посилання на `pronouns-possessive`.
Підтверджено обидві відомі пастки: перенос рядка одразу після `</em>`
теж з'їдається (`</em>\n(= at` → `</em>(= at`), не лише перед `<em>`.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (11 details, 78 міток, 1 картка в секції
`generic-their`, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>`).

### [x] 19. Determiners — quantity (`determiners-quantity`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `determiners-quantity`.

22 EGP-рядки (331-352): 3 USE — 341 (a little / a bit of, B1), 351
(HYPERBOLE, C1), 352 (MANY A, C2) — усі 3 вплетені інлайн, матч за
`egpIndex`; 19 чистих FORM написані без картки. У learner_explanation/
examples усіх точок порожньо — факти перевірено за EGP can-do + прикладами з
`assets/egp.json`. 10 секцій: таблиця «яке слово з яким іменником»
(singular / plural / uncountable / обидва); some/any/no (+ some в
пропозиціях, more); much/many (заперечення, питання, how much/many,
so/too much/many); a lot of/lots of/plenty of/loads of + гіпербола millions/
tons of (картка 351); a few/a little/a bit of (картка 341) + very/so/too
few/little; a/one/each/every/both/either/neither; all/most/several/enough +
almost/nearly all/every; quantity + of + the/my (опціональний of після
all/both/half, each of/none of замість every/no, either/neither of + plural/
pronoun); many a/many an (картка 352); типові помилки (much↔many,
informations, every students, some my / the most people / most of people,
подвійне заперечення з no/neither, little↔a little). Content-мітка —
quantity-слово, grammar — іменник (+ of/the/my, so/too/very/almost/nearly).
Займенникове вживання (Some were late) — лише крос-посилання на
`pronouns-quantity`.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (11 details, 144 мітки, 3 картки в секціях
`a-lot-of`/`few-little`/`many-a`, "When it's used" відсутній, 0 злиплих
слів навколо `<mark>`/`<em>`).

### [x] 20. Future — future simple (with will and shall) (`future-future-simple-with-will-and-shall`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-simple-with-will-and-shall`.

16 EGP-рядків (382-397): 11 USE — усі 11 вплетені інлайн, матч за
`egpIndex` (guideword-и повторюються: PLANS AND INTENTIONS WITH 'WILL' на
A1 і A2, PREDICTIONS will B1 / shall C2); 5 чистих FORM (affirmative will,
affirmative shall, negative will, questions, negative shall) написані без
картки. У learner_explanation/examples усіх точок порожньо — факти
перевірено за EGP can-do + прикладами з `assets/egp.json`. 10 секцій: will
+ base verb + таблиця 'll; won't; питання (+ short answers, Shall I в
питаннях); рішення/наміри/обіцянки + Will you…? про плани (картки 383,
388, з відмежуванням від going to); прогнози (+ probably/definitely до
won't, картка 393); fixed plans з датою/часом (392); requests + willingness
(389, 391, won't = відмова лише згадано); Shall I…? / Shall we…? (387,
390); формальне I/we shall + shall not + shall always/never + shall-
прогнози (394, 396, 397); типові помилки (will to/comes/going, will після
when/until, Will I…? замість Shall I…?, Yes I'll / willn't). Відмежовано
від `modality-will`/`modality-shall` (зрізи 21 і далі — там habitual/
willfulness/Will you please/advice/commands): тут will/shall лише як
майбутній час. Content-мітка — will/'ll/won't/shall, grammar — підмет +
base verb (+ probably/always/never, час/дата). Контракції (I'll, It'll)
розмічені однією content-міткою на все слово, не розбиті на дві.

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (11 details, 128 міток, 11 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>`).

### [x] 21. Modality — will (`modality-will`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-will`.

13 EGP-рядків (603-615): 10 USE — усі 10 вплетені інлайн, матч за
`egpIndex` (guideword-и повторюються: PLANS AND INTENTIONS A1/A2, REQUESTS
A2/B2); 3 чисті FORM (affirmative, negative, questions) написані без картки
в одній секції форми. У learner_explanation/examples усіх точок порожньо —
факти перевірено за EGP can-do + прикладами з `assets/egp.json`. 10 секцій:
форма (will/'ll, won't, питання, short answers, will can't + modal →
be able to); plans/intentions + Will you…? про плани (604, 608); if +
present, will в головному реченні (605); прогнози + question tags won't
you? / will it? (612); fixed plans (611); willingness/offers (609) + won't
= відмова, у т.ч. для речей (The car won't start — без картки, поза EGP);
requests Will you…? (610) + Will you please… / Will you be quiet! як
команда (613); habitual/typical will + often/usually (614, відсилка на
would для минулих звичок); stressed WILL для несхвалення + Boys will be
boys (615); типові помилки (will to/comes/please to, will в if-clause,
will can/will must, Yes I'll / willn't). Відмежовано від
`future-future-simple-with-will-and-shall` (там — will/shall як час, Shall
I/we): тут майбутнє показано коротко з крос-посиланням, фокус на модальних
значеннях. Content-мітка — will/'ll/won't (контракції однією міткою),
grammar — підмет + base verb (+ if-clause, please, often/usually, час/дата).

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (11 details, 130 міток, 10 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>`).

### [x] 22. Modality — would (`modality-would`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-would`.

23 EGP-рядки (616-638): 13 USE — усі 13 вплетені інлайн, матч за
`egpIndex` (перетин guideword-ів: WISHES AND PREFERENCES з 'like' A1 / з
іншими дієсловами A2, IMAGINED SITUATIONS теперішні A2 / минулі B1); 10
чистих FORM (affirmative with like, affirmative, negative, questions with
like, would have + -ed, wouldn't have + -ed, questions, adverbs B1/C1/C2)
написані без картки. У learner_explanation/examples усіх точок порожньо —
факти перевірено за EGP can-do + прикладами з `assets/egp.json`. 12
секцій: форма (would/'d, wouldn't, питання, Wouldn't that…?, tag wouldn't
it?, short answers, 'd = would vs had); would like/love/prefer (618, 624,
I like vs I'd like); Would you like to…? + written I would like to invite
you (617; FORM 621 тут же); imagined situations + It would be nice to / if
you came (622, 623); if + past, would + If I were you (625, will vs would);
would have + pp, if + had + pp (631; FORM 626/627); polite requests Would
you…? / Would you mind -ing / if + past / Would it be possible (633, No,
not at all); I'd say/advise/recommend (632); future in the past + reported
speech (630, 634); wouldn't = past refusal + would = past habit (635, 636,
не для станів → used to); adverbs (B1 really/probably/definitely + C1/C2
strongly/easily/significantly, probably wouldn't); типові помилки (would
to/comes/like go, would в if-clause, I like vs I'd like, Yes I'd / would of
/ would для станів). Content-мітка — would/'d/wouldn't/would have
(контракції однією міткою), grammar — підмет + base verb/participle (+
like/love/prefer, to-infinitive, if-clause, mind, adverb, reporting verb).

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (13 details, 219 міток, 13 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>`).

### [x] 23. Negation — negation (`negation-negation`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `negation-negation`.

31 EGP-рядок (1175-1205): 12 USE / FORM/USE — усі 12 вплетені інлайн, матч
за `egpIndex`; 19 чистих FORM (not після be / be-have aux present+past /
модальних, don't/doesn't/didn't, imperatives, negative questions + tags,
no / any / much / many, indefinite pronouns A2+B1, ever/never/yet/still, I
don't think, not + non-finite/ellipted clause, neither of / none of, none
substitution, not all / not every) написані без картки. У
learner_explanation/examples усіх точок порожньо — факти перевірено за EGP
can-do + прикладами з `assets/egp.json`. 13 секцій: not після be / aux /
modal; don't/doesn't/didn't + base verb; Don't + verb + Don't you (ever/
dare) (1203); negative questions + tags + seeking agreement (1188, answer
about the facts); no vs not … any, much/many, anything vs nothing/nobody;
none of / neither of + positive verb, none alone, not all / not every;
never/ever/yet/still; I don't think + positive clause; not + phrase,
hedging not necessarily/really/actually (1199), formal few vs a few (1200);
strong negatives do not/cannot (1192), whatsoever (1201), in the least
(1205), not a single (1202); neither … nor (1194) + Neither/Nor + inversion
(1204); Never have I (1193), Not only (1198); типові помилки (подвійне
заперечення, she don't / doesn't lives / didn't went / I no like, don't +
be/modal, I think it isn't, Anybody didn't, Never I have). Content-мітка —
негативне слово (not/n't-форма, no, nothing, nobody, never, none of,
neither/nor, few, whatsoever, in the least, not a single; ever/yet/still у
секції прислівників), grammar — решта слотів формули (підмет, aux/verb,
any/much/many + noun, прислівник-hedge, inverted aux + subject).

Перевірено: `type` (0 помилок), `lint:check`, `build`, живий рендер через
dev-сервер + Playwright (14 details, 273 мітки, 12 карток у правильних
секціях, "When it's used" відсутній, 0 злиплих слів навколо
`<mark>`/`<em>`).

### [ ] 24. Nouns — noun phrases (`nouns-noun-phrases`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `nouns-noun-phrases`.

### [ ] 25. Nouns — noun phrases - grammatical functions (`nouns-noun-phrases-grammatical-functions`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `nouns-noun-phrases-grammatical-functions`.

### [ ] 26. Nouns — plural (`nouns-plural`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `nouns-plural`.

### [ ] 27. Nouns — types (`nouns-types`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `nouns-types`.

### [ ] 28. Prepositions — prepositions (`prepositions-prepositions`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `prepositions-prepositions`.

### [ ] 29. Present — present continuous (`present-present-continuous`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `present-present-continuous`.

### [ ] 30. Present — present simple (`present-present-simple`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `present-present-simple`.

### [ ] 31. Pronouns — indefinite - thing, -one, -body etc (`pronouns-indefinite-thing-one-body-etc`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-indefinite-thing-one-body-etc`.

### [ ] 32. Pronouns — subject/ object (`pronouns-subject-object`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-subject-object`.

### [ ] 33. Questions — yes/no (`questions-yes-no`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `questions-yes-no`.

### [ ] 34. Verbs — linking (`verbs-linking`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-linking`.

### [ ] 35. Verbs — patterns_with to and -ing (`verbs-patterns-with-to-and-ing`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-patterns-with-to-and-ing`.

### [ ] 36. Verbs — prepositional (`verbs-prepositional`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-prepositional`.

### [ ] 37. Verbs — there is/are (`verbs-there-is-are`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-there-is-are`.

### [ ] 38. Verbs — types (`verbs-types`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `verbs-types`.

### [ ] 39. Adjectives — comparatives (`adjectives-comparatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-comparatives`.

### [ ] 40. Clauses — comparatives (`clauses-comparatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-comparatives`.

### [ ] 41. Clauses — conditional (`clauses-conditional`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-conditional`.

### [ ] 42. Clauses — imperatives (`clauses-imperatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-imperatives`.

### [ ] 43. Clauses — phrases/exclamations (`clauses-phrases-exclamations`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-phrases-exclamations`.

### [ ] 44. Clauses — relative (`clauses-relative`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-relative`.

### [ ] 45. Discourse markers — discourse markers in writing (`discourse-markers-discourse-markers-in-writing`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `discourse-markers-discourse-markers-in-writing`.

### [ ] 46. Focus — focus (`focus-focus`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `focus-focus`.

### [ ] 47. Future — future continuous (`future-future-continuous`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-continuous`.

### [ ] 48. Future — future with be going to (`future-future-with-be-going-to`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-with-be-going-to`.

### [ ] 49. Future — present continuous for future use (`future-present-continuous-for-future-use`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-present-continuous-for-future-use`.

### [ ] 50. Modality — adjectives (`modality-adjectives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-adjectives`.

### [ ] 51. Modality — adverbs (`modality-adverbs`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-adverbs`.

### [ ] 52. Modality — could (`modality-could`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-could`.

### [ ] 53. Modality — expressions with be (`modality-expressions-with-be`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-expressions-with-be`.

### [ ] 54. Modality — have (got) to (`modality-have-got-to`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-have-got-to`.

### [ ] 55. Modality — may (`modality-may`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-may`.

### [ ] 56. Modality — might (`modality-might`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-might`.

### [ ] 57. Modality — must (`modality-must`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-must`.

### [ ] 58. Modality — shall (`modality-shall`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-shall`.

### [ ] 59. Modality — should (`modality-should`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-should`.

### [ ] 60. Nouns — uncountable (`nouns-uncountable`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `nouns-uncountable`.

### [ ] 61. Passives — passives: form (`passives-passives-form`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `passives-passives-form`.

### [ ] 62. Past — past continuous (`past-past-continuous`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `past-past-continuous`.

### [ ] 63. Pronouns — demonstratives (`pronouns-demonstratives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-demonstratives`.

### [ ] 64. Pronouns — generic use (`pronouns-generic-use`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-generic-use`.

### [ ] 65. Pronouns — possessive (`pronouns-possessive`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-possessive`.

### [ ] 66. Pronouns — quantity (`pronouns-quantity`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-quantity`.

### [ ] 67. Pronouns — reflexive (`pronouns-reflexive`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-reflexive`.

### [ ] 68. Pronouns — substitution, one, ones, none (`pronouns-substitution-one-ones-none`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `pronouns-substitution-one-ones-none`.

### [ ] 69. Questions — alternatives (`questions-alternatives`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `questions-alternatives`.

### [ ] 70. Questions — tags (`questions-tags`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `questions-tags`.

### [ ] 71. Questions — wh- (`questions-wh`) — рівень A2
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `questions-wh`.

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

