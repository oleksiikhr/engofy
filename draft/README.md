# draft — annotation prompt experiments

Sandbox for A/B-testing the content-annotation LLM prompt/model against the
REAL production pipeline in `src/modules/content/` — not a separate
approximation of it. Originally used to validate the plain-text inline-tag
format that replaced the old JSON tool-call + character-offset schema; that
port is done (see `src/modules/content/domain/annotation-prompt.ts` and
`annotate-content.handler.ts`). This harness now exists to test *changes* to
that prompt/model/algorithm against a recorded baseline before they ship.

## Layout

- `lib/` — the harness:
  - `call-claude.ts` — raw Anthropic call, no tool-use, accepts `model` /
    `thinking` overrides. The only thing NOT shared with production — Nest
    DI (`AiClient.complete`) isn't available to a standalone script, so this
    is a direct equivalent transport.
  - `build-units.ts` — parses a markdown file with the REAL production
    pipeline (`convertMarkdownToDoc` + `flattenDoc` from
    `src/modules/content/`, the same `marked`-based converter and flattener
    `annotate-content.handler.ts` uses) and splits it into `block` (one call
    per paragraph/list-item, mirroring `ContentPart`) or `sentence` units.
  - `split-sentences.ts` — the `--unit=sentence` chunking, a deliberate copy
    of a boundary heuristic production no longer has (chunking was dropped
    in the port) — kept here only to let this harness still test the
    sentence-vs-block granularity question if that ever comes back up.
  - `annotate-unit.ts` — mirrors `AnnotateContentHandler.computeAnnotations`
    exactly: calls `parseAnnotationTags` (the REAL one, imported from
    `src/modules/content/domain/`, not a copy) → if `isComplete: false`,
    one retry on the same full text → merge →
    dedupe/resolve-overlaps/drop-incomplete/drop-boundary-crossing →
    `validateAnnotations`. Because it imports the actual production domain
    functions and prompt, a baseline recorded here reflects production
    behavior, not a parallel reimplementation of it.
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
`scripts/snapshot.ts` under a new key — `'tagged-v1'` should keep pointing
at whatever `annotation-prompt.ts` currently exports, so it always reflects
what production actually sends.

## Running (ad-hoc, while iterating)

```bash
npx tsx draft/scripts/run.ts --content=examples/content/article-complex.md --prompt=tagged-v1 --unit=block
```

Flags:
- `--content=<path>` — markdown file, relative to repo root. Default:
  `examples/content/article-complex.md`.
- `--prompt=<name>` — key into the `PROMPTS` map. Default: `tagged-v1`
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
npx tsx draft/scripts/snapshot.ts --prompt=tagged-v1 --unit=block
```

Flags: `--files=<comma,separated,paths>` (default: every `.md` in
`examples/content/`, excluding `README.md`), `--prompt=`,
`--unit=block|sentence`, `--model=<id>` (default: `AI_MODEL` from env),
`--thinking=true`, `--name=<label>` (default:
`<prompt>-<unit>-<sanitized-model>`). Output goes to
`draft/baselines/<name>.json` — **commit this file** when you want it kept
as the reference point (it's git-tracked on purpose, unlike `results/`).

**2. Make your change** — edit `annotation-prompt.ts`, try a different
`--model`, or edit the retry/cleanup logic in `annotate-content.handler.ts`
(`annotate-unit.ts` will pick it up automatically since it imports the real
thing).

**3. Record a candidate snapshot** the same way, with a different `--name`:

```bash
npx tsx draft/scripts/snapshot.ts --prompt=tagged-v1 --unit=block --name=tagged-v1-block-sonnet-5-candidate
```

**4. Compare:**

```bash
npx tsx draft/scripts/compare.ts draft/baselines/tagged-v1-block-sonnet-5.json draft/baselines/tagged-v1-block-sonnet-5-candidate.json
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
textLength, annotationCount, wordCount, phraseCount, validationError,
retried, isComplete }], totals: {...same fields, summed...} }], grandTotals:
{...summed across all files...} }`.

Since a single run is one noisy sample, treat one regression flag as "worth
a second `compare.ts` run before concluding" rather than absolute proof —
`compare.ts` doesn't average multiple snapshots, it only diffs two.

## Status

The tagged inline-annotation format is live in production
(`src/modules/content/domain/annotation-prompt.ts` +
`parse-annotation-tags.ts` + `annotate-content.handler.ts`), replacing the
old JSON tool-call/offset schema entirely — no chunking, no separate
verify-pass call; completeness is checked by reconstructing the raw
response with tags stripped and comparing it to the original text
character-for-character, with one whole-block retry if that check fails.
This was validated against 0 `validateAnnotations` failures across 44 units
spanning increasingly adversarial fixtures before the port. No baseline is
currently committed in `draft/baselines/` — the pre-port one was deleted
since its schema doesn't match the new `isComplete`/`retried` metrics; run
`snapshot.ts` to record a fresh one before comparing future changes against it.
