# Content ingestion — manual smoke test

Sample files for manually exercising `content ingest` end-to-end (auto-detect
format, node-tree conversion, `content-annotation` job enqueued via the
transactional outbox). Kept in the repo so the same fixtures stay useful as
later pipeline stages (annotation, grammar-tagging, quiz, conversation-kit)
land — same input, more of the pipeline to observe.

- `plain.txt` — plain text, two paragraphs, no markup (exercises
  `plain-text-to-doc.converter.ts`, paragraph split on blank lines).
- `formatted.md` — markdown: `#`/`##` headings, **bold**/*italic*, a bullet
  list, a link (exercises `markdown-to-doc.converter.ts`).
- `formatted.html` — html: `h1`/`h2`, `<p>`, `<strong>`/`<em>`, `<ul><li>`, `<a>`
  (exercises `html-to-doc.converter.ts`).
- `article.md` — full-length article (heading, list, 3 longer paragraphs):
  non-adjacent phrasal verb ("put the delivery off"), a word-sense
  disambiguation case ("fine" as noun/penalty vs. "fine print" as a
  collocation, both in the same text), proper nouns, numerals. Used to
  stress-test the `content-annotation` stage (`annotate-content.handler.ts`)
  on realistic paragraph lengths, not just short samples.
- `article-complex.md` — heavier stress test: h1 + h2, an ordered list and an
  unordered list (short items, exercises `ordered` on `ListBlock`), a
  word-sense case ("offer" as verb vs. noun in the same sentence), several
  non-adjacent phrasal verbs ("turned the offer down", "look the contract
  over"), idioms ("broke the ice", "picked up the phone"), a combined
  bold+italic span (`**_significantly_**`, two marks on one node), a link,
  multi-word proper nouns, and numerals/money amounts. Used to probe where
  the annotation model's per-call completeness degrades (short list items,
  longer paragraphs).

## 1. Start local infra

```bash
docker compose up -d postgres redis
```

## 2. Run migrations (first time / after pulling new ones)

```bash
pnpm cli migrate up
```

## 3. Ingest each sample

```bash
pnpm cli content ingest examples/content/plain.txt --title="Plain sample"
pnpm cli content ingest examples/content/formatted.md --title="Markdown sample"
pnpm cli content ingest examples/content/formatted.html --title="HTML sample"
```

Each command logs the created `content.id` and detected `source.format`.

## 4. Verify the result

Check the row and its node-tree parts (body content lives in `content_parts`,
one row per paragraph/list-item, not on `content` itself — see
`src/modules/content/entities/content-part.entity.ts`):

```bash
psql "$DATABASE_URL" -c "select id, title, source_format, status from content order by created_at desc limit 3;"
psql "$DATABASE_URL" -c "select block_index, item_index, kind, body from content_parts where content_id = '<content-id>' order by block_index, item_index;"
```

Check that the `content-annotation` job was enqueued (transactional outbox →
pg-boss):

```bash
pnpm cli queue stats
```

or inspect the raw job row:

```bash
psql "$DATABASE_URL" -c "select id, name, data from pgboss.job where name = 'content-annotation' order by createdon desc limit 3;"
```

At this stage (Phase 1 only — no `content-annotation` worker yet) the job is
expected to sit unprocessed in `pgboss.job`; nothing consumes it until Phase 2
ships. A successful run here means: `content` row created with
`status = 'pending'`, a plausible node-tree `body`, and one queued job per
ingested file.

## Adding a fixture

If a new converter feature needs a dedicated example (e.g. nested lists,
`ContentSource.link`), add a file here and a line to this README rather than
inventing throwaway content ad hoc — keeps the same set usable for manual
testing across every future pipeline phase.
