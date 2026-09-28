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

## Зрізи

### [ ] 1. Показ українського перекладу пояснення в картці usage point
- Branch: `grammar-translations-and-practice-01-uk-explanation`
- Base: `main`
- PR: —

Перевірити в БД, що `translations.uk.explanation` заповнений для всіх usage points (не лише для
частини конструкцій); якщо є прогалини — прогнати `grammar_enrichment` для них. Додати в
`GrammarUsagePointCard.astro` тумблер показу перекладу (стан — без layout shift, див. root
`CLAUDE.md`). Картка без перекладу — без тумблера.

### [ ] 2. Розширення перекладу: canDoStatement, приклади, проза ручних сторінок (дослідницький)
- Branch: `grammar-translations-and-practice-02-translation-scope`
- Base: `grammar-translations-and-practice-01-uk-explanation`
- PR: —

Відкриті питання до користувача: чи додавати `canDoStatement` і `examples` у `GrammarTranslations`
(бекенд-промпт + тип), і чи перекладати прозу 90 ручних сторінок (i18n-підхід для `.astro`). Після
відповідей — дописати конкретні зрізи в цей план.

### [ ] 3. Аудит банку вправ і наповнення секції Practice (дослідницький)
- Branch: `grammar-translations-and-practice-03-practice-audit`
- Base: `main`
- PR: —

Порахувати покриття банку вправ (скільки usage points/конструкцій мають вправи, скільки на кожен),
перевірити якість вибірки згенерованих речень. Вирішити разом з користувачем, чим стає секція
`Practice` на сторінці правила (агрегат вправ усіх usage points сторінки чи прибрати), і дописати
зрізи на масштабування генерації.
