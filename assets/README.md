# assets/

Static reference data, imported into the DB by `engofy grammar …` CLI
commands (PLAN.md §3.3, §3.4, Slice 1). Checked in rather than fetched at
runtime — the sources are frozen.

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
