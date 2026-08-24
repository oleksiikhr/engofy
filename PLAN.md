# Engofy pivot: generic content-learning API

## Context

`engofy-go` (`../engofy-go`) is the original AI-written MVP: RSS ingestion →
scrape → multi-source synthesis → 3 difficulty-level rewrites → annotation →
publish to a single website. This repo (`engofy`, NestJS/Fastify/MikroORM) is
a from-scratch rewrite, written manually with Claude Code so every step is
understood and controlled, and it changes the product shape:

- No more parsing/scraping, no more "news" framing.
- Content is *fed in* (CLI, file: plain text / markdown / html) instead of
  discovered.
- No AI difficulty-level rewrite — the text is processed as-is (decided
  2026-08-24).
- The project becomes an API/core-engine: process text → structured JSON
  (words, phrases, grammar, quiz, conversation kit) → later, publish that
  JSON to arbitrary platforms (web, Telegram, X, Android, iOS, Chrome
  extension, notifications...), each platform rendering only the content
  types it supports.

**Right now the target is only the core: ingest → analyze → JSON.**
Publishing/platform adapters are deliberately out of scope until the core is
solid.

Reusable design carried over from `engofy-go` (see
`../engofy-go/docs/kb/03-content-pipeline.md` and `04-content-body-schema.md`):
- Node-tree body schema (`doc → paragraph → text/span`), span carries
  `kind: word|phrase|grammar_only`, `word_definition_id`, `pos`,
  `grammar_construct`.
- Offset-splice primitive: AI returns character offsets via tool-use; code
  validates offset against the real text before writing anything
  (`text[start:end] === form`), whole job fails on one bad annotation
  (all-or-nothing, no partial writes).
- Pipeline stages are independent, idempotent pg-boss jobs ("gap-filler, not
  rewrite" — check for existing result before ever calling AI).
- **AI never runs on the HTTP request path** — only in workers.

## Decisions locked in (2026-08-24)

- No AI rewrite per difficulty level — process the original text as given.
- Pipeline = separate pg-boss job per stage (annotate → grammar-tag → quiz →
  conversation-kit), mirroring the Go project's per-stage worker pattern.
- "Core done" means: CLI → DB-backed `Content` entity → JSON assembled via a
  service method. Not just a local JSON file — this is deliberately DB-backed
  so the later publishing module has something real to read from.

## Phase 0 — Domain model + core primitives (no AI)

- [x] `Content` entity: `id`, `source` (embedded `ContentSource`:
      `sourceFormat` (`text`/`markdown`/`html`), `rawText`, nullable `link` to
      the source site), `title?`, `status` (`pending → annotating →
      annotated/ready → failed`), Luxon timestamps (`LuxonTimestampType`).
      No `body` column — see `ContentPart` below and Working notes:
      "Content.body split into ContentPart rows".
- [x] `ContentPart` entity (`content_parts` table): one row per top-level
      `Doc.children` element — a `Paragraph`, or a whole `ListBlock` (all its
      items, not exploded per item). Replaces the single `Content.body: Doc`
      jsonb blob. Added 2026-08-24, reworking already-shipped Phase 0/1 code;
      revised same day from an earlier per-list-item-row shape — see Working
      notes: "Content.body split into ContentPart rows" and "ContentPart
      revised to whole-block rows".
- [x] Node-tree body schema (`doc`/`paragraph`/`text`/`span`), ported from
      `04-content-body-schema.md`. Extended 2026-08-24 beyond the Go source
      with rich-formatting support not present in engofy-go: heading level on
      `Paragraph`, `LinkNode`, `marks` (bold/italic) on `text`/`link`/`span`,
      and a `ListBlock` that's flattened/spliced through the same AI
      annotation pipeline as paragraphs (see Working notes).
- [x] Vocabulary entities: `Word`, `WordDefinition` (dedup by
      `(word, pos)`), `Phrase` (dedup by lowercase text).
- [x] `ContentPipelineRun` (`contentId`, `stage`, `status`): scaffolded
      2026-08-24, ahead of Phase 2 like the other Phase 0 entities — see
      Working notes: "Full-pipeline-ready tracking".
- [x] Pure domain functions, no DB/HTTP: `flattenDoc`/`flattenParagraph`,
      `spliceSpans`, offset validation. Ported from `internal/content`.
- [x] Format converters → node-tree: plain text (paragraphs by blank line),
      markdown (need to pick a parser, e.g. `remark`/`mdast`), html (extract
      `<p>` text — input is user-supplied, not scraped, so this stays
      simple).

## Phase 1 — Ingestion (CLI)

- [x] `engofy content ingest <file> [--title=...]` in `src/entrypoints/cli`.
      No `--format` flag (see Working notes: "Format auto-detected, not
      passed") — space-separated subcommand, matching the existing
      `migrate`/`queue` nest-commander convention, not the `content:ingest`
      colon form originally sketched here.
- [x] `IngestContentCommand` (CQRS): parse file → node-tree → create
      `Content` row (`status='pending'`) → flush → enqueue
      `content_annotation` job via pg-boss. No AI call at this step.

## Phase 2 — Annotation pipeline (AI, per-stage pg-boss jobs)

Each job: idempotent (skip AI call if result already exists), tool-use for
structured output, validate offsets before any write, all-or-nothing per job.

- [ ] `content_annotation` — Claude tool-use over the whole flattened text →
      word/phrase spans; create/link `Word`/`WordDefinition`/`Phrase` (stub +
      separate fill-in job for definitions, mirroring
      `FillWordDefinitionJob`).
- [ ] `content_structuring` (html only, conditional) — see Working notes:
      "HTML structuring for messy/scraped input" for when this fires. Claude
      tool-use → node-tree `Doc`, replacing the deterministic
      `html-to-doc.converter.ts` output for this Content. Runs *before*
      `content_annotation` when it fires.
- [ ] `content_grammar_tagging` — per-paragraph tool-use, tags
      `grammar_construct` onto existing spans (overlap with word/phrase spans
      is expected, not an error — same `spliceSpans` contract).
- [ ] `content_comprehension_questions` — per-paragraph tool-use → quiz
      (own table, not folded into body).
- [ ] `content_conversation_kit` — one Claude call → system_prompt /
      starter_questions / suggested_vocabulary (drawn from already-annotated
      spans, cross-validated against that candidate list).

`Content.status` moves `pending → annotating → annotated` after the
annotation step (required). Grammar-tag/quiz/conversation-kit are best-effort
enrichment on top, same as in the Go project — they don't block "ready".

Each job also writes a `ContentPipelineRun` row (`contentId`, `stage`,
`status`) — see Working notes: "Full-pipeline-ready tracking". A job's
idempotency check is "is there already a `completed` row for
(this content, this stage)", not "does the result already exist in some
other table" (grammar-tagging in particular has no other way to tell).

## Phase 3 — Access to the result

- [ ] `ContentReaderService.getContentJson(id)` — assembles `Content` + body
      + comprehension questions + conversation kit into one canonical JSON.
      Service method only, no HTTP endpoint yet — but DB-backed, so the
      publishing module can read from it later without rework.

## Phase 4 — Publishing (separate, later effort — not started)

- [ ] Capability manifest per platform (what block types it can render).
- [ ] Per-platform renderer (pure function, node-tree → platform format),
      same shape as Go's `BodyRenderer` but multiplied per target. Unknown
      block type on a given platform → skipped, not an error.

---

## Working notes

- **Content.body split into ContentPart rows**: decided and implemented
  2026-08-24, reworking already-shipped Phase 0/1 code (`Content` entity,
  `IngestContentHandler`) while it's cheap to (dev only, 0 rows in prod).
  Trigger: `content_annotation`/`content_grammar_tagging`/
  `content_comprehension_questions` all process one paragraph/list-item AI
  call at a time (see the per-unit decision above) — a single `Content.body`
  jsonb blob meant every one-paragraph annotation rewrote the *entire*
  document's jsonb, and made partial/incremental persistence across a
  many-paragraph document (a 1-paragraph comment vs. a hundred-page book,
  both explicitly in scope) impossible without a race on concurrent writers.
  `ContentPart` (`entities/content-part.entity.ts`, `content_parts` table)
  is one row per document block, `body` (jsonb, via `ContentPartBodyType` —
  like `NodeTreeType` but skips `parseDoc` validation, since which parser
  applies depends on the sibling `kind` column, invisible to a MikroORM
  custom type) holding that block's content. Original shape exploded list
  items into their own rows — superseded same day, see the next note for the
  current column-level shape. `domain/content-parts.ts`
  (`splitDocIntoParts`/`assembleDocFromParts`) converts between a whole `Doc`
  and ordered parts; `IngestContentHandler` persists parts instead of
  setting `content.body`. `ContentPipelineRun` stays content-level
  (unchanged) — it's the product-facing "is this content fully ready" gate;
  per-unit idempotency inside a job is a cheap "does this part's body
  already contain a span" check, no new tracking table needed.
- **ContentPart revised to whole-block rows**: decided 2026-08-24, same day
  as the split above, before Phase 2 touched it. The first cut of
  `ContentPart` exploded a `ListBlock` into one row per item (`itemIndex`,
  `listOrdered` columns) to mirror `flattenDoc`'s per-unit AI-call
  granularity 1:1 at the storage layer. Reopened because `ContentPart` is
  meant to be the general top-level "block" layer everything else (image,
  embed, table, ... — see below) builds on, and `itemIndex`/`listOrdered`
  are columns that exist for exactly one kind and are null for every other
  — the same "wide table, kind-specific nullable columns" shape being
  avoided at the `Content`-vs-content-type level one layer up, just
  recurring one layer down. Fixed by making `ContentPart` fully
  kind-agnostic: `id`, `contentId`, `blockIndex`, `kind`, `body: Block` —
  no other columns, ever, for any future kind. A `list`-kind row's `body` is
  the whole `ListBlock` (`ordered` + all `items`), matching the `ListBlock`
  TS type as-is. `domain/content-parts.ts` (`splitDocIntoParts`/
  `assembleDocFromParts`) simplified to a direct `Doc.children` map/sort,
  no per-item grouping logic left. **Trade-off accepted**: the per-unit AI
  annotation *call* granularity is unchanged (still one call per paragraph
  or per list item, for the blast-radius reasons already decided — call
  granularity and storage-row granularity are independent), but annotating
  one item of a list now rewrites that whole row's `body.items` array
  (all items), not just a dedicated per-item row. Accepted because a list is
  bounded in practice (unlike a whole document) — the incremental-write
  problem this whole `ContentPart` split exists to solve was document-scale
  blast radius, not list-scale.
- **Near-term content shape**: current target is small content (max ~10
  paragraphs, article-style), not book-length yet — but `ContentPart` is
  sized for both from the start (see above), so no rework needed when larger
  content shows up. Images/YouTube-style embeds between paragraphs are an
  anticipated near-term addition to `Doc.children` (a new `Block` variant
  alongside `Paragraph`/`ListBlock`) — not implemented yet (format
  converters don't extract them), but `ContentPart.kind` is already shaped
  to add `image`/`embed` values additively when that lands, with those parts
  skipped by flatten/annotate (no text) but still ordered into the doc on
  reassembly.
- **Sentence/word metadata extensibility**: decided 2026-08-24, not
  implemented beyond what's listed. Anticipated metadata beyond
  word/phrase/grammar spans: per-word audio, per-sentence audio,
  dictionary/grammar-based quizzes, and whatever comes after. Principle:
  anchor every such concern on a stable id already in the schema —
  `wordId`/`wordDefinitionId` (word-level), `phraseId` (phrase-level),
  `contentPartId` (sentence/paragraph-level, now that `ContentPart` is a
  real row with its own uuid) — as a **new dedicated table per concern**,
  never as inline fields bolted onto `WordSpanNode`/`PhraseSpanNode`/
  `Paragraph`/`ListItem`. This is already the project's existing pattern
  (`WordDefinition`, `Phrase`, `ContentPipelineRun`, and the planned
  standalone comprehension-questions table — "own table, not folded into
  body" per Phase 2 above) — adding e.g. audio later means one new table
  with a FK, zero changes to the node-tree shape or to `spliceSpans`.
- **Discontinuous phrases (e.g. phrasal verbs like "took it off")**: the
  existing span model already supports this with no schema/domain-code
  change — `PhraseSpanNode.phraseId` is just an FK to `Phrase`, and nothing
  in `spliceSpansIntoNodes`/`checkNoOverlaps` assumes one span per phrase.
  The AI annotation job (Phase 2, not yet built) emits one
  `PhraseSpanNode`-producing insert per contiguous fragment ("took", "off"),
  all sharing the same `phraseId` — highlighting/tooltip logic groups spans
  by shared `phraseId` to treat them as one logical phrase. Added `Phrase`
  entity: `type?: PhraseType` (`phrasal_verb`/`idiom`/`collocation`/`other`,
  nullable — not yet classified until Phase 2's annotation job runs).
  Open item for when the `content_annotation` tool-use schema gets built:
  the `Annotation` interface (`domain/validate-annotations.ts`) needs a
  per-response-local grouping field (e.g. `phraseGroupId`) so the handler
  knows which fragments belong to the same phrase instance before it
  find-or-creates the one `Phrase` row and applies its id to every fragment.

- Update this file's checkboxes as phases land; re-open discussion here
  before changing anything already checked off.
- Format auto-detected, not passed: decided 2026-08-24, Phase 1 CLI review.
  `detectContentSourceFormat` (Phase 0, `domain/detect-content-source-format.ts`)
  already existed but was unused until Phase 1 — the CLI ingest command runs
  it on the file's raw text instead of taking a `--format` flag. Rationale:
  the flag would just duplicate what the heuristic already does reliably for
  CLI-fed text/markdown/well-formed html, and giving both a flag and
  auto-detection invites drift between them. `IngestContentDto`
  (`modules/content/commands/ingest-content/`) has no `format` field for the
  same reason. `ContentModule` also needs no `MikroOrmModule.forFeature` —
  entities are auto-discovered (same as every other module so far).
- Content module layering follows the `auth` reference implementation
  exactly ([[feedback-controllers-no-cqrs]]): `ContentService` facade
  (`commandBus.execute` + one `em.flush()`), `IngestContentHandler` never
  flushes, `ContentQueueBootstrapService` (creates the `content-annotation`
  pg-boss queue) sits at module root next to the facade like
  `AuthQueueBootstrapService`, not under `services/`.
- **Outbox pattern bug found and fixed while smoke-testing the CLI (2026-08-24)**:
  `OutboxSenderService`'s `send()`/`drain()` WeakMap was keyed by the raw
  DI-injected `EntityManager` (the root `orm.em`, since it's a `Scope.DEFAULT`
  provider), but `OutboxSubscriber.afterFlush` hands `drain()` the *forked*
  em for the active `RequestContext` — a different object, so the WeakMap
  lookup silently missed and staged jobs (e.g. `content-annotation`,
  and likely `auth-challenge-email` OTP emails too — same call pattern)
  never reached `pgboss.job` outside of tests. Existing ispec tests never
  caught this because `shouldSkipRequestContext()` skips
  `RequestContext.create` entirely under `NODE_ENV=test`, so root and
  "forked" em were trivially the same object there. Fixed by resolving
  `em.getContext()` at the top of both methods
  (`src/core/queue/outbox-sender.service.ts`); added a regression test in
  `outbox-sender.service.ispec.ts` that wraps a real
  `RequestContext.create(..., { keepTransactionContext: true })` call
  (verified it fails without the fix, passes with it). Confirmed fixed
  against the real dev DB via `content ingest`.
- Markdown/html parser library choice (Phase 0, format converters): decided
  2026-08-24 — `marked` (lexer only, for paragraph-block splitting) and
  `node-html-parser` (for `<p>` extraction). See converter files under
  `src/modules/content/converters/`.
- Rich formatting (bold/italic/headers/lists/links): implemented 2026-08-24,
  same day as the deferral note above — turned out small enough to do
  immediately rather than as separate follow-up work. `Paragraph.level`
  (heading), `Mark` (`bold`/`italic`) on `text`/`link`/`span` nodes, new
  `LinkNode`, and `ListBlock` (see below — reversed from presentation-only on
  2026-08-24). `spliceSpans` preserves marks onto the new span and both split
  pieces; splitting a `LinkNode` keeps `href` on the lead/trail pieces but the
  new span itself is plain (loses the link) — accepted simplification. No
  entity/migration change needed (jsonb `body` already stored arbitrary
  shape; only app-level validation changed).
- List annotation symmetry: reversed 2026-08-24 (same day as the note above)
  — `ListBlock` is no longer presentation-only. `flattenDoc` now flattens
  each `ListItem` as its own unit (`FlattenedUnit.itemIndex` set), and
  `spliceSpansIntoListItem` (sibling to `spliceSpans`, sharing the extracted
  `spliceSpansIntoNodes`/`flattenNodes` core) inserts word/phrase/grammar
  spans into list items exactly as `spliceSpans` does for paragraphs. List
  text now reaches the AI annotation pipeline like any paragraph.
- `Content.source` (embedded `ContentSource`: `format`/`rawText`/`link`):
  added 2026-08-24, replacing flat `sourceFormat`/`rawText` columns.
  `@Embedded` prefixes columns as `source_format`/`source_raw_text`/
  `source_link`. `link` is nullable — only set when content was pulled from
  a URL (not for directly CLI-fed text/markdown). Storing the raw input
  exactly as received (whatever the format, whatever the source — CLI file,
  or a future extension/API) is the point: ingestion never blocks on AI or
  on how well it parses; that's entirely a worker-side concern, decided
  below.
- HTML structuring for messy/scraped input: decided 2026-08-24, resolving
  the earlier "known limitation, not fixed" note on
  `html-to-doc.converter.ts`. That converter only extracts
  `p`/`h1`-`h6`/`ul`/`ol` — bare `<div>`/`<br>` markup (plausible from a
  future Chrome-extension "grab this selection" flow, where arbitrary DOM
  gets sent as-is) produces an empty `Doc` today. Decision: keep the
  deterministic converters (`plain-text-to-doc`, `markdown-to-doc`,
  `html-to-doc`) as the default, synchronous, zero-AI-cost path for the
  common case (CLI-fed text/markdown, well-formed html) — do **not**
  extend AI to markdown/plain-text structuring, that would trade a
  reliable, deterministic, offset-free step for cost/latency/non-determinism
  with no upside. For html specifically: `html-to-doc.converter.ts` stays
  the first attempt; a new worker-side job, `content_structuring` (Phase 2),
  fires only when its output looks unreliable (empty `Doc`, or a block count
  too low relative to the raw html's text length) and re-parses with an AI
  tool-use call into the same node-tree `Doc` shape. AI still never runs on
  the request path — this is a conditional worker job, same as every other
  Phase 2 stage.
- Full-pipeline-ready tracking: decided 2026-08-24. `Content.status`
  intentionally only tracks the required `content_annotation` step (see the
  entity's own doc comment) — grammar-tagging/comprehension-questions/
  conversation-kit are independent, best-effort, and don't block it. That
  left no way to know when a `Content` is *fully* done across every stage,
  which matters for product reasons (a reader shouldn't see a quiz "pop in"
  after they've already read the piece) as well as pipeline reasons
  (`content_grammar_tagging` writes `grammarConstruct` directly onto
  existing spans in `body` — there's no other way to tell "did this job
  already run" from an absence of grammar tags, since a paragraph can
  legitimately have none). `ContentPipelineRun` (scaffolded in Phase 0,
  ahead of the jobs that populate it — same as `Word`/`Phrase` were)
  is one row per `(contentId, stage)`; a `Content` is fully ready when none
  of its rows (across every `ContentPipelineStage` value defined at the
  time) are `pending`. `failed` counts as resolved too, so a permanently
  failed best-effort stage can't block readiness forever.
- `PartOfSpeech` widened from the traditional 8 to 15 values (2026-08-24):
  added `ProperNoun`, `Auxiliary`, `Determiner`, `Numeral`, `Particle`, and
  a catch-all `Other`. Rationale: this enum constrains the AI annotation
  job's tool-use output — a broader, more linguistically complete set (plus
  an explicit "I'm not sure" escape hatch) reduces hallucination/forced
  mistagging versus a narrow enum with no safe fallback.
