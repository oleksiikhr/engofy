# draft — prompt experiments (annotation + grammar)

Sandbox for A/B-testing the LLM prompt/model of the annotation-stage idiom
pass and the `ai_grammar` stage against the REAL production pipeline in
`src/modules/post/` — not a separate approximation of it. Both harnesses
import the actual production domain functions and prompts; only the
transport is swapped (a direct Anthropic / nlp-service call instead of Nest
DI), so a recorded baseline reflects production behaviour, not a parallel
reimplementation.

- **Idiom** (`run.ts` / `snapshot.ts` / `compare.ts`) — the annotation
  stage is now a thin AI pass: spaCy (`sentence_tokens`) owns every word and
  groups phrasal verbs deterministically, so the LLM's only job is
  multi-word idioms / collocations (PLAN.md §6, §12; prompt is
  `IDIOM_SYSTEM_PROMPT` in `src/modules/post/domain/annotation-prompt.ts`).
  This harness evals that one prompt against a recorded baseline. It covers
  only the LLM sub-pass — the deterministic spaCy word/phrasal-verb layer is
  unit-tested in `src/modules/post/domain/build-token-annotations.spec.ts`.
- **Grammar** (`run-grammar.ts` / `snapshot-grammar.ts` /
  `compare-grammar.ts`) — the `ai_grammar` stage (PLAN.md §5, Зріз 3): tags
  every sentence against the closed EGP catalogue of ~90 constructions /
  ~574 usage points using the same `⟦span⟧{{g|slug|egpIndex}}` inline
  mechanism. See **Grammar harness** below.

## Layout

- `lib/` — the harness:
  - `call-claude.ts` — raw Anthropic call, no tool-use, accepts `model` /
    `thinking` overrides. The only thing NOT shared with production — Nest
    DI (`AiClient.complete`) isn't available to a standalone script, so this
    is a direct equivalent transport.
  - `build-units.ts` — parses a markdown file with the REAL production
    pipeline (`convertMarkdownToDoc` + `flattenDoc` from
    `src/modules/post/`, the same `marked`-based converter and flattener
    `annotate-post.handler.ts` uses) and splits it into `block` (one call
    per paragraph/list-item, mirroring `PostPart`) or `sentence` units.
  - `split-sentences.ts` — the `--unit=sentence` chunking, a deliberate copy
    of a boundary heuristic production no longer has (chunking was dropped
    in the port) — kept here only to let this harness still test the
    sentence-vs-block granularity question if that ever comes back up.
  - `annotate-unit.ts` — mirrors the LLM sub-pass of
    `AnnotatePostHandler.computeAnnotations` (the only part still driven by
    the model): calls `parseAnnotationTags` (the REAL one, imported from
    `src/modules/post/domain/`, not a copy) → if `isComplete: false`,
    one retry on the same full text → merge →
    dedupe/resolve-overlaps/drop-incomplete/drop-boundary-crossing →
    `validateAnnotations`. The deterministic spaCy word/phrasal-verb layer
    and its `resolvePhraseOverlaps` merge are out of scope here (no
    nlp-service in this harness). Because it imports the actual production
    domain functions and prompt, a baseline recorded here reflects
    production behavior, not a parallel reimplementation of it.
  - `env.ts` — loads `ANTHROPIC_API_KEY`/`AI_MODEL` from
    `.env.development.local` (handles quoted values).
- `scripts/run.ts` — ad-hoc single-file runner with full console detail.
  Use this while iterating on a prompt/model change.
- `scripts/snapshot.ts` — runs every (or selected) content file end-to-end
  and writes one aggregated **baseline** JSON to `draft/baselines/`. This is
  the "фіксація результату" — a git-tracked scorecard for one
  prompt+model+unit combination.
- `scripts/compare.ts` — diffs two baseline JSONs and reports regressions.
  See **Snapshot testing** below — this is the actual answer to "did
  changing the model/prompt make it better or worse or just break it."
- `results/` — one JSON report per `run.ts` invocation (gitignored —
  regenerable scratch output, not meant to be committed).
- `baselines/` — one JSON per `snapshot.ts` invocation (**git-tracked** —
  these are the fixed reference points `compare.ts` diffs against; commit
  them deliberately when you want a new baseline to stick).

Testing a genuinely new prompt *variant* (not just a tweak to the shipped
one)? Add it as its own exported const somewhere under `draft/prompts/` and
register it in the `PROMPTS` map in both `scripts/run.ts` and
`scripts/snapshot.ts` under a new key — `'idiom-v1'` should keep pointing
at `IDIOM_SYSTEM_PROMPT`, so it always reflects what production actually
sends.

## Running (ad-hoc, while iterating)

```bash
npx tsx draft/scripts/run.ts --content=examples/content/article-complex.md --prompt=idiom-v1 --unit=block
```

Flags:
- `--content=<path>` — markdown file, relative to repo root. Default:
  `examples/content/article-complex.md`.
- `--prompt=<name>` — key into the `PROMPTS` map. Default: `idiom-v1`
  (the real production prompt).
- `--unit=block|sentence` — see `build-units.ts` above. Default: `block`
  (production's actual granularity — `sentence` is exploratory only).
- `--model=<id>` — override `AI_MODEL` from the env for this run only.
- `--thinking=true` — enable adaptive thinking on the call.

### What to look at per run

- **`validationError`** — the annotations failed `validateAnnotations`
  (overlapping spans, missing lemma/pos/phraseType, invalid enum value).
- **`retried` / `isComplete`** — `parseAnnotationTags` found the raw
  response didn't reconstruct the original text exactly (a truncation, a
  word skipped anywhere, a malformed tag), so `annotate-unit.ts` retried
  once on the same full text; `isComplete: false` in the final result means
  it was *still* incomplete after that retry — the real failure signal. A
  `retried: true` with `isComplete: true` is the safety net working, not a
  problem.
- **totals** — input/output tokens and estimated cost, so a prompt/model
  change's cost impact is visible alongside its quality.

## Snapshot testing (regression baseline)

The goal: change a model, a prompt, or the parsing/cleanup algorithm, and
know — without re-reading transcripts by eye — whether it got better,
worse, or broke something.

**1. Record a baseline** (runs every `examples/content/*.md` file through
one prompt+model+unit combo and writes one aggregated JSON):

```bash
npx tsx draft/scripts/snapshot.ts --prompt=idiom-v1 --unit=block
```

Flags: `--files=<comma,separated,paths>` (default: every `.md` in
`examples/content/`, excluding `README.md`), `--prompt=`,
`--unit=block|sentence`, `--model=<id>` (default: `AI_MODEL` from env),
`--thinking=true`, `--name=<label>` (default:
`<prompt>-<unit>-<sanitized-model>`). Output goes to
`draft/baselines/<name>.json` — **commit this file** when you want it kept
as the reference point (it's git-tracked on purpose, unlike `results/`).

**2. Make your change** — edit `annotation-prompt.ts`, try a different
`--model`, or edit the retry/cleanup logic in `annotate-post.handler.ts`
(`annotate-unit.ts` will pick it up automatically since it imports the real
thing).

**3. Record a candidate snapshot** the same way, with a different `--name`:

```bash
npx tsx draft/scripts/snapshot.ts --prompt=idiom-v1 --unit=block --name=idiom-v1-block-sonnet-5-candidate
```

**4. Compare:**

```bash
npx tsx draft/scripts/compare.ts draft/baselines/idiom-v1-block-sonnet-5.json draft/baselines/idiom-v1-block-sonnet-5-candidate.json
```

Exits `0` with `RESULT: ✓ no regressions` if nothing got worse, `1` with a
per-unit breakdown if something did. A unit is flagged **REGRESSED** only if
it now has a `validationError` or `isComplete: false` (after retry) that
wasn't there before — **never** on `annotationCount` alone, since that
legitimately varies run to run from LLM sampling even with zero code
changes. Everything in a unit that's unchanged is omitted from the printout;
only diffs and the final grand-totals/verdict are shown, so the output stays
short enough to read directly (this is the intended way for a future Claude
Code session to analyze a change — run `compare.ts` and read its stdout,
rather than diffing raw JSON by hand).

Baseline JSON schema (`draft/baselines/<name>.json`): `{ name, createdAt,
prompt, unit, model, thinking, files: [{ contentFile, units: [{ label,
textLength, annotationCount, phraseCount, validationError,
retried, isComplete }], totals: {...same fields, summed...} }], grandTotals:
{...summed across all files...} }`.

Since a single run is one noisy sample, treat one regression flag as "worth
a second `compare.ts` run before concluding" rather than absolute proof —
`compare.ts` doesn't average multiple snapshots, it only diffs two.

## Grammar harness

Same idea as the annotation harness, for the `ai_grammar` stage. It reuses
the real domain functions end to end — `parseGrammarResponse` +
`parseGrammarTags` (the reconstruct-and-compare completeness check),
`spanToTokenRange`, and the same drop ladder `TagGrammarHandler.persistMatch`
applies (unknown slug → missing/out-of-construction `egpIndex` → span covers
no token → persisted). The catalogue is rebuilt straight from
`assets/egp.json` with the same helpers `engofy grammar import-egp` uses
(`classifyEgpRecord`, `grammarConstructionSlug`), so no database is needed;
the only order difference from the seeded DB is documented in
`lib/grammar-catalog.ts`.

`parseGrammarResponse` collapses each sentence's internal whitespace (spaCy
keeps the source's hard-wrap newlines in `Sentence.rawText`) before the
numbered-line round-trip and maps recovered span offsets back to `rawText`
coords; `parseGrammarTags` is a stack walk over `⟦…⟧` that accepts one
construction nested inside another (`⟦outer ⟦inner⟧{{g|a|1}} tail⟧{{g|b|2}}`)
and records both spans. `draft/baselines/grammar-sonnet-5.json` is the
committed baseline (7 fixtures, all `isComplete` with no retry/truncation;
the 3 `droppedUnknownSlug` are all in `plain.txt`, where the model shortens
`present-present-simple` → `present-simple` on bare present-simple verbs it
should arguably leave untagged).

### Pipeline mirrored

`lib/parse-content-sentences.ts` reproduces ingest + `spacy_parse` without a
DB: `detectPostSourceFormat` → `convertToDoc` → one PostPart per top-level
block → `flattenPostPartUnits` → **live `nlp-service` `/parse` call per
unit** → `buildSentences` (the real offset-validating domain function). The
result is the exact ordered `Sentence.rawText` / `SentenceToken` list
`TagGrammarHandler` loads. `lib/grammar-tag-file.ts` then mirrors
`TagGrammarHandler.callModel` — one AI call, one retry on an incomplete
parse, later attempt used regardless — and classifies every parsed span by
its production disposition.

**The `nlp-service` must be running** (`cd nlp-service && .venv/bin/uvicorn
app:app --host 127.0.0.1 --port 8000`; override with `NLP_SERVICE_URL`).
Unlike the annotation harness this one also covers the `.html` / `.txt`
fixtures — `ai_grammar` runs on sentences, so it is format-agnostic.

### Running

```bash
# ad-hoc, full per-sentence detail, writes draft/results/<ts>-grammar.json
npx tsx draft/scripts/run-grammar.ts --content=examples/content/article.md

# record a baseline over every examples/content/* fixture
npx tsx draft/scripts/snapshot-grammar.ts --name=grammar-sonnet-5

# after a prompt/catalogue/parser change, snapshot again and diff
npx tsx draft/scripts/snapshot-grammar.ts --name=grammar-sonnet-5-candidate
npx tsx draft/scripts/compare-grammar.ts \
  draft/baselines/grammar-sonnet-5.json \
  draft/baselines/grammar-sonnet-5-candidate.json
```

Flags: `run-grammar.ts` takes `--content=`, `--model=`, `--thinking=true`;
`snapshot-grammar.ts` also takes `--files=<comma,list>` (default: every
`.md` / `.html` / `.txt` in `examples/content/`, README excluded) and
`--name=` (default `grammar-<sanitized-model>`). Model defaults to
`AI_MODEL` from `.env.development.local`.

### Metrics per file

`spanCount`, `persistedCount`, `distinctConstructions` (distinct persisted
slugs — a coverage signal), `droppedUnknownSlug` / `droppedBadEgpIndex`
(model tagged outside the closed catalogue), `droppedNoToken` (span landed
between tokens), `spansPerSentence`, `isComplete` (whole-response
reconstruct-and-compare, after the retry), `retried`, `truncated`
(`max_tokens`). `compare-grammar.ts` flags a file **REGRESSED** only on hard
failures — `isComplete` true→false, `truncated` false→true, `persistedCount`
collapsing to 0, or catalogue drops (`droppedUnknownSlug` +
`droppedBadEgpIndex`) rising — **never** on span/persisted count variance
alone, since that moves run to run from LLM sampling with zero code change
(same principle as `compare.ts`). `droppedNoToken` is reported, not flagged.

## Status

The annotation stage is now a thin AI pass over spaCy
(`src/modules/post/domain/annotation-prompt.ts` = `IDIOM_SYSTEM_PROMPT` +
`parse-annotation-tags.ts` + `annotate-post.handler.ts`): `sentence_tokens`
drives every word span and phrasal-verb span (see
`domain/build-token-annotations.ts`), and the LLM only tags multi-word
idioms / collocations. The inline `⟦…⟧{{p|type|canonical|gN}}` format and
the reconstruct-and-compare completeness check (one whole-block retry on
failure) carry over unchanged. No baseline is currently committed in
`draft/baselines/` for `idiom-v1` — run `snapshot.ts` to record a fresh one
before comparing future changes against it.
