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

`import-egp` turns `USE` / `FORM/USE` guideword records (574) into
`grammar_usage_points`. A construction with no such record (nouns, phrasal and
prepositional verbs, `there is/are`, ...) gets its `FORM:` records with a can-do
statement as usage points instead (87 more, 661 in total). `FORM:` records also
feed the parent construction's cheat sheet.

## `grammar-usage-point-exercises.json`

Reusable exercise bank per `grammar_usage_point` (~8-9 `fill_blank` /
`multiple_choice` exercises per usage point, all 661 usage points) — distinct
from the per-post `exercises` table, which is generated bespoke from one post's
sentences. Content is written in a Claude Code session, without an AI API call
from this codebase; `usage-point-exercise-seed.spec.ts` checks the file covers
exactly the EGP records that become usage points. `import-usage-point-exercises` seeds it
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
        "prompt": "I ____ to work by bus every day.",
        "answer": "go",
        "options": ["go", "goes", "went"]
      }
    },
    {
      "type": "multiple_choice",
      "payload": {
        "prompt": "She ____ football on Saturdays.",
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
- `fill_blank.prompt` and `multiple_choice.prompt` contain exactly one blank,
  written as four underscores `____`.
- `fill_blank.options`, when present, must include the answer plus at least
  one distractor (word bank shown to the learner); omit it for free typing.
- `multiple_choice.answerIndex` must index into `options`.
- `reorder.answer[slot]` is the target position of `scrambled[slot]` in the
  correct sentence — `answer` and `scrambled` must be the same length.
- Every `egpIndex` key must match an already-imported usage point (run
  `import-egp` first); the importer throws listing any that don't.

## `grammar-usage-point-content.json`

Hand-written learner content per `grammar_usage_point`, the same fields the
`grammar_enrichment` stage writes (`learner_explanation`, `learner_examples`,
`translations.uk`). Written in a Claude Code session, no AI API call.
`import-usage-point-content` (part of `make seed`) overwrites every listed
point, so edits are picked up on re-run; `grammar_enrichment` skips a point
that already has its translation (schema:
`src/modules/post/domain/usage-point-content-seed.ts`).

Shape: a JSON object keyed by `egpIndex`:

```json
{
  "2": {
    "explanation": "We use the present simple for habits. Add -s after he, she, it: she works.",
    "examples": ["I walk to work every day.", "She plays tennis on Sundays."],
    "uk": {
      "explanation": "Present simple вживаємо для звичок. Після he, she, it додаємо -s: she works.",
      "examples": [
        "Я щодня ходжу на роботу пішки.",
        "Вона грає в теніс щонеділі."
      ]
    }
  }
}
```

- `explanation` — 2-3 short sentences in plain English at the point's CEFR
  level or easier: why the construction is used for this purpose and its form
  pattern.
- `examples` — 2-3 complete sentences, at most 12 words each, showing exactly
  this use.
- `uk.explanation` — faithful Ukrainian translation of `explanation`; the form
  pattern stays in English.
- `uk.examples` — natural Ukrainian translations of `examples`, one per
  example, in the same order. Imported into `translations.uk.examples` and
  shown under each English example when the learner switches to the native
  language.

## `lexicon-content.json`

Hand-written dictionary entries for the words of the handcrafted grammar pages
(the ones `grammar annotate-pages` links), the same fields the enrichment job
writes for a `word_definition`. Written in a Claude Code session, no AI API
call. `words import-lexicon-content` (part of `make seed`) creates the Word /
WordDefinition by lemma + part of speech when missing and overwrites the
listed fields, so edits are picked up on re-run; the enrichment job skips a
sense that already has its translation (schema:
`src/modules/post/domain/lexicon-content-seed.ts`).

Shape: lowercase lemma → part of speech (`PartOfSpeech` value) → entry:

```json
{
  "cartographer": {
    "noun": {
      "definition": "A person whose job is to draw maps.",
      "example": "The cartographer drew a map of the coast.",
      "cefrLevel": "C1",
      "uk": { "translation": "картограф" }
    }
  }
}
```

- `definition` — one short plain-English sentence, as a learner's dictionary
  would phrase it, without the headword; the sense the pages use.
- `example` — one natural sentence with the word in that sense.
- `uk.translation` — one to three common Ukrainian equivalents, comma-separated.

## `phrase-content.json`

Hand-written dictionary entries for the phrases of the handcrafted grammar
pages: phrase text (lowercase) → the same fields as `lexicon-content.json`.
`words import-phrase-content` (part of `make seed`) creates the Phrase when
missing and overwrites the fields. `grammar annotate-pages` links an entry
with `"type": "phrasal_verb"` only where spaCy groups that phrasal verb (a
literal match would also catch "go on holiday"); any other entry — an idiom or
fixed expression — wherever its text occurs. After editing the list, re-run
`grammar annotate-pages --refresh`.

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
