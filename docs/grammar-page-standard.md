# Grammar page standard

Reference page: `/grammar/determiners-quantity` (`apps/web/src/grammar-pages/determiners-quantity.astro`).
Checked by `apps/web/e2e/grammar-reference-page.spec.ts` (mobile 390 px and desktop, light and dark) plus the
`grammar construction detail` block in `e2e/grammar.spec.ts`.

## What a ready page looks like

Top to bottom:

1. Back link, level badge and category label, then one H1 `Category: name` (title `Category: name — Grammar — Engofy`).
   The badge is outside the H1.
2. Lede: 1–2 sentences of plain English with the key words in italics; Ukrainian via the EN/УКР switch in the header
   (choice stored in localStorage, applied before first paint).
3. `Practice · N` button (jumps to the Practice section) next to the language switch.
4. Sticky progress: a thin bar (< 48 px) with the current section; the full section list overlays on demand and does not
   move content.
5. Sections as `<details>`: cheat sheet (form table, examples, formula), one section per topic, "When it's used"
   (closed by default, shows a rule count), Common mistakes, Compare with, Practice.
6. Usage points up to B1 are shown; harder ones sit under "More difficult cases".
7. After a missed "choose" exercise the correct answer and a link to the rule are shown.

## Rules

- Part-of-speech colours use `--pos-*` via `data-pos` on `<mark>` / formula parts; `data-role` stays the formula slot.
  Non-POS roles stay neutral.
- Every word in a `<mark>` is clickable with a dictionary popup (`annotate-pages`; entries in
  `assets/lexicon-content.json`). Re-run with `--refresh` after changing `<mark>` markup.
- Nothing that appears after scripts run may move content already on screen (see root `CLAUDE.md`).

## Checklist

Blockers: 200 with no console errors/warnings or 4xx/5xx; at least one usage point; every usage point has
`learner_explanation`, `learner_examples`, Ukrainian `translations`; readable unique name in H1 and `<title>`; meta
description, canonical, one H1, JSON-LD; no horizontal scroll at 390 px; exercises answer "Correct"/"Not quite"; no
layout shift with stored УКР and scripts blocked; `e2e-*` fixtures absent from list, sitemap, search; thin sticky
progress on mobile.

Desirable: exercises on every usage point; correct answer after a miss; non-empty cheat sheet with "Compare with";
dark theme without defects; word popup and dictionary work; `--pos-*` colours; clickable target words; A2 page is not
overloaded (Ukrainian lede, level filter, obvious first step).
