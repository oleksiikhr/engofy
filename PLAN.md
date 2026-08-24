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

- [ ] `Content` entity: `id`, `sourceFormat` (`text`/`markdown`/`html`),
      `rawText`, `title?`, `status` (`pending → annotating → annotated/ready
      → failed`), `body` (jsonb node-tree), Luxon timestamps
      (`LuxonTimestampType`).
- [ ] Node-tree body schema (`doc`/`paragraph`/`text`/`span`), ported from
      `04-content-body-schema.md`.
- [ ] Vocabulary entities: `Word`, `WordDefinition` (dedup by
      `(word, pos)`), `Phrase` (dedup by lowercase text).
- [ ] Pure domain functions, no DB/HTTP: `flattenDoc`/`flattenParagraph`,
      `spliceSpans`, offset validation. Ported from `internal/content`.
- [ ] Format converters → node-tree: plain text (paragraphs by blank line),
      markdown (need to pick a parser, e.g. `remark`/`mdast`), html (extract
      `<p>` text — input is user-supplied, not scraped, so this stays
      simple).

## Phase 1 — Ingestion (CLI)

- [ ] `engofy content:ingest <file> --format=text|markdown|html
      [--title=...]` in `src/entrypoints/cli`.
- [ ] `IngestContentCommand` (CQRS): parse file → node-tree → create
      `Content` row (`status='pending'`) → flush → enqueue
      `content_annotation` job via pg-boss. No AI call at this step.

## Phase 2 — Annotation pipeline (AI, per-stage pg-boss jobs)

Each job: idempotent (skip AI call if result already exists), tool-use for
structured output, validate offsets before any write, all-or-nothing per job.

- [ ] `content_annotation` — Claude tool-use over the whole flattened text →
      word/phrase spans; create/link `Word`/`WordDefinition`/`Phrase` (stub +
      separate fill-in job for definitions, mirroring
      `FillWordDefinitionJob`).
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

- Update this file's checkboxes as phases land; re-open discussion here
  before changing anything already checked off.
- Open question, not yet decided: markdown/html parser library choice
  (Phase 0, format converters).
