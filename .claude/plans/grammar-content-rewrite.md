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

Користувач хоче згодом ~100 вправ на кожен usage point, згенерованих так, щоб показувати типові
речення/патерни, з яких можна вчитися. Підхід генерації (джерело типових речень — корпус текстів?
AI-seed з патернів?) ще не продуманий і свідомо не входить у зрізи нижче. Розглянути окремо, коли
Фаза 2 буде завершена або значно просунута.

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
`GrammarCompare` + нові компоненти із зрізу 1 (секції, акордеон, контрастні приклади). Існуючі дані
з `grammar_constructions`/`grammar_usage_points` (сирий EGP + вже AI-збагачені
`learnerExplanation`/`learnerExamples`) — це довідковий матеріал для перевірки фактів, а не текст
для копіювання; писати пояснення, формулу, приклади і типові помилки вручну заради педагогічної
ясності. Секція "Практика" — заглушка/анонс (вправи — окремий TODO вище, не цей зріз). Перевірити
рендер сторінки (`run` skill / dev-сервер) перед комітом.

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

### [ ] 5. Adjectives — position (`adjectives-position`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-position`.

### [ ] 6. Adjectives — superlatives (`adjectives-superlatives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adjectives-superlatives`.

### [ ] 7. Adverbs — adverb phrases - form (`adverbs-adverb-phrases-form`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-adverb-phrases-form`.

### [ ] 8. Adverbs — adverbs and adverb phrases: types and meanings (`adverbs-adverbs-and-adverb-phrases-types-and-meanings`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-adverbs-and-adverb-phrases-types-and-meanings`.

### [ ] 9. Adverbs — adverbs as modifiers (`adverbs-adverbs-as-modifiers`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-adverbs-as-modifiers`.

### [ ] 10. Adverbs — position (`adverbs-position`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `adverbs-position`.

### [ ] 11. Clauses — coordinated (`clauses-coordinated`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-coordinated`.

### [ ] 12. Clauses — declarative (`clauses-declarative`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-declarative`.

### [ ] 13. Clauses — interrogatives (`clauses-interrogatives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-interrogatives`.

### [ ] 14. Clauses — subordinated (`clauses-subordinated`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `clauses-subordinated`.

### [ ] 15. Conjunctions — coordinating (`conjunctions-coordinating`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `conjunctions-coordinating`.

### [ ] 16. Conjunctions — subordinating (`conjunctions-subordinating`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `conjunctions-subordinating`.

### [ ] 17. Determiners — demonstratives (`determiners-demonstratives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `determiners-demonstratives`.

### [ ] 18. Determiners — possessives (`determiners-possessives`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `determiners-possessives`.

### [ ] 19. Determiners — quantity (`determiners-quantity`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `determiners-quantity`.

### [ ] 20. Future — future simple (with will and shall) (`future-future-simple-with-will-and-shall`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `future-future-simple-with-will-and-shall`.

### [ ] 21. Modality — will (`modality-will`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-will`.

### [ ] 22. Modality — would (`modality-would`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `modality-would`.

### [ ] 23. Negation — negation (`negation-negation`) — рівень A1
- Branch: (немає — коміт прямо в `changes`)
- Base: `changes`
- PR: — (не потрібен)

Див. «Спільний процес» вище. Slug: `negation-negation`.

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

