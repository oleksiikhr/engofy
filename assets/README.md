# assets/

Static reference data, imported into the DB by `engofy grammar …` CLI
commands. Checked in rather than fetched at runtime — the sources are frozen.

## `egp.json`

The Cambridge **English Grammar Profile** (EGP), 1239 records. Derived from
`asset/egpo.xlsx` in <https://github.com/ninja33/EGP> (a spreadsheet copy of
<https://englishprofile.org>), converted to JSON with light cleanup:

- columns renamed: `SuperCategory`→`category`, `SubCategory`→`subcategory`,
  `Level`→`level`, `guideword`, `Can-do statement`→`can_do`, `Example`→`example`
- `#`→`index` (1-based, stable — the import's idempotency key)
- some apostrophes in the source were mangled to a literal `?`
  (`couldn?t`, `I?m`); the unambiguous contraction cases are repaired
- `\r\n`→`\n`, values trimmed, blank `example`→`null`

`import-egp` keeps only `USE` / `FORM/USE` guideword records (574) as
`grammar_usage_points`; the rest (`FORM:` etc.) feed the parent
construction's cheat sheet.

## `grammar-usage-point-exercises.json`

Reusable exercise bank per `grammar_usage_point` (~10 exercises per usage point,
~574 usage points) — distinct from the per-post `exercises` table, which is
generated bespoke from one post's sentences. **Not checked in yet**: content
is written in a separate session, without an AI API call from this codebase,
and loaded once it exists. `import-usage-point-exercises` seeds it
idempotently **per usage point** — a usage point that already has any
exercises is left untouched; re-running only fills in usage points seeded for
the first time (schema: `src/modules/post/domain/usage-point-exercise-seed.ts`).

Shape: a JSON object keyed by `egpIndex` (the same natural key `import-egp`
upserts usage points on), each value an array of exercises:

```json
{
  "2": [
    {
      "type": "fill_blank",
      "payload": {
        "prompt": "I ___ to work by bus every day.",
        "answer": "go",
        "options": ["go", "goes", "went"]
      }
    },
    {
      "type": "multiple_choice",
      "payload": {
        "prompt": "She ___ football on Saturdays.",
        "options": ["play", "plays", "playing", "played"],
        "answerIndex": 1
      }
    },
    {
      "type": "reorder",
      "payload": {
        "scrambled": ["bus", "by", "work", "to", "go", "I"],
        "answer": [4, 2, 5, 1, 0, 3]
      }
    },
    {
      "type": "find_error",
      "payload": {
        "prompt": "She go to school every day.",
        "incorrectForm": "go",
        "correction": "goes"
      }
    }
  ]
}
```

- `type` is one of `fill_blank` / `multiple_choice` / `reorder` / `find_error`
  — `grammar_contrastive` never appears here, it stays bespoke to a post.
- `fill_blank.options`, when present, must include the answer plus at least
  one distractor (word bank shown to the learner); omit it for free typing.
- `multiple_choice.answerIndex` must index into `options`.
- `reorder.answer[slot]` is the target position of `scrambled[slot]` in the
  correct sentence — `answer` and `scrambled` must be the same length.
- Every `egpIndex` key must match an already-imported usage point (run
  `import-egp` first); the importer throws listing any that don't.

## `irregular-verbs.json`

~164 English irregular verbs (`base_form`, `past_simple[]`,
`past_participle[]`, `cefr_level`). `import-irregular-verbs` seeds a `words`
row per `base_form`; the inflected forms stay here.

## `word-frequency.txt`

Top 50 000 English words, one per line, most frequent first — line number is
the rank. Generated once from the `wordfreq` Python package
(`top_n_list('en', …)`), filtered to alphabetic tokens (internal
apostrophe/hyphen allowed), dropping digits, symbols and stray single
letters. `words import-frequency` sets `words.frequency_rank` on existing
`Word` rows by case-insensitive lemma match; unmatched lemmas stay null.
