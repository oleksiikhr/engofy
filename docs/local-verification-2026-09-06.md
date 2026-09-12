# Local end-to-end verification — 2026-09-06

Pre-deploy pass on `main` @ `a4b9e1a` ("V2 (#1)"). Fixes committed on
`fix/local-verification` as `Batch T — …` (F1–F9 + `Batch T — F3` = 10 commits).
`fix/batch-a-safety`
does not exist — it was squash-merged into `main` as "V2 (#1)"; `main`'s tree
is byte-identical to the old branch tip (`git diff e2fc15e a4b9e1a` empty).

## Baseline (green, before and after Batch T)

| Check | Before | After Batch T |
|---|---|---|
| `pnpm type` | 0 | 0 |
| `biome check src/ test/` | clean (580) | clean |
| `pnpm test` | 131 files / 777 | 132 files / 795 (was 131 / 781 pre-F3) |
| `pnpm test:cov` | ~90.3 / 78.5 / 86.9 / 90.7 | 91.3 / 80.0 / 87.5 / 91.8 (exit 0) |
| `pnpm build` + `git diff src/metadata.ts` | clean | clean |
| `pnpm migration:up` + `migration:check` | clean (…120000) | clean (…20260906120000) |
| `nlp-service` `pytest -q` | deps OK, service smoke-tested | unchanged |

## Phase 1 — pipeline end-to-end (real Anthropic API)

5 invented texts covering short / long / list-heavy / quote+attribution and
`text` / `markdown` / `html` formats. All reached `posts.status = published`
through all 6 stages (`spacy_parse → annotation ‖ ai_complexity → ai_grammar →
ai_exercises → publish`).

| short_id | text | fmt | type / source_type | CEFR | sentences | grammar_matches | exercises |
|---|---|---|---|---|---|---|---|
| KjSq0Edp | morning walk (1 para) | text | post / original | A2 | 5 | 13 | 15 |
| HJbyWpDn | getting lost (4 para essay) | text | article / original | B2 | 13 | 34 | 27 |
| u9n5O8SV | packing light (bullet + numbered lists) | markdown | article / original | B1 | 15 | 20 | 29 |
| tu2TXp1G | library Sundays (quote + attribution) | text | article / news_snippet | B2 | 7 | 18 | 24 |
| gsRaeJzW | neighbour's piano | html | book / excerpt | B1 | 11 | 24 | 32 |

Evidence:

- **Cost**: 43 AI calls, **$0.599 total** (~$0.12/post). 0 `max_tokens`
  truncations, 0 unrecovered failures.
- **Prompt caching (Batch R) works**: 5 `cache_read` hits of 36,874 tokens each
  — the 90-construction grammar catalogue re-read from cache on grammar-stage
  retries instead of re-charged (~$0.10 saved per retry).
- **D6 publish gate works**: `"publish gated on annotation branch"` logged;
  `post-publish` no-ops and re-queues a delayed job until the `annotation` run
  is `Completed`.
- **D4 run tracking works**: `post_pipeline_runs` rows carry
  `started_at` / `completed_at` / `retry_count`; HJbyWpDn's `ai_grammar` did one
  reconstruct-and-compare retry and recovered.
- **Lexical annotation**: `sentence_tokens.word_id` / `phrase_id` populated;
  `is_gerund` / `is_idiom_part` / `phrasal_verb_group_id` set; `get-post-detail`
  resolves `annotations.words` (25–90) and `annotations.phrases` (7–12).
- **Attribution**: `source_type` + `attribution_text` stored correctly —
  explicit for `news_snippet` / `excerpt`, `"Original content"` fallback for the
  three `original` posts.
- **Reader reconstruction**: `parseDoc(assembleDocFromParts(...))` re-validates
  every published post's tree at read time (200 on all).

Negative / transient: one `ZodError` from `ai_complexity` `completeStructured`
(model returned `sentences` as a string) → pg-boss retried → recovered. Logged
as F5 and fixed.

## Phase 3 — schema / indexes

Full `\d+` + `pg_index` dump reviewed against the hot queries
(get-feed keyset, get-dictionary `sentence_tokens` join, practice `(user_id,
due)`, `grammar_matches` composite unique). Index coverage is correct except the
two redundant standalone indexes in **F2**. Connection budget:
web(2)+worker(1)+cron(1) × (DB_POOL_MAX 10 + QUEUE_POOL_MAX 5) ≈ 60 vs
`max_connections=150` — comfortable. `driverOptions` (session `timezone=UTC`,
`statement_timeout=30s`) confirmed applied under MikroORM v7's Kysely layer —
D18's timezone force still holds.

## Phase 4 / 5 — code & security review

Batches A–S closed every logged finding; the review below is new. Live security
posture verified: helmet headers (HSTS, nosniff, `X-Frame-Options`,
`Referrer-Policy`, COOP/CORP), `__Host-session` cookie = `Secure; HttpOnly;
SameSite=Lax; Path=/` with no `Domain`, throttler active (`x-ratelimit-*`),
ETag→304 on content routes, OTP request returns `200` empty (no enumeration),
`/_swagger` served in dev only. Batch S infra (`docker-entrypoint.sh` secret
shim, `stack.prod.yaml`, `cloudflared/config.yml`, `deploy.sh`, `pg-backup.sh`)
reviewed — sound apart from F4 / F9.

## Findings & status

| # | sev | concern | where | problem | status |
|---|---|---|---|---|---|
| **F3** | high | pipeline / product | `tag-grammar.handler.ts`, `get-post-detail.handler.ts` | `ai_grammar` writes only `grammar_matches` (token ranges); `get-post-detail` resolves grammar only from node-tree `span.grammarConstruct`, which nothing ever writes → `annotations.grammar = {}` on all 5 posts, reader grammar highlighting dead, paid stage output unused. | **fixed** (`Batch T — F3`) — `tag-grammar` gained a second phase: after `grammar_matches` it paints the construction slug onto `post_parts.body` via new `domain/apply-grammar-constructs.ts` (`stripGrammarConstructs` → `paintGrammarConstruct`), gated on `PostPipelineRun(Annotation)=Completed` (mirrors D6) so it is the last writer of `part.body` — no race with the parallel `annotate-post`. Flush-per-`PostPart` (3rd sanctioned `cqrs.md` exception). No new stage / fan-out change / migration. |
| F4 | high | config / deploy | `nest-cli.json`, `Dockerfile` | importers resolve `join(process.cwd(),'assets',…)`; `nest build` doesn't copy `assets/` into `dist/`, runtime cwd is `/app/dist` → `node cli grammar import-egp` ENOENT in the prod image → empty grammar catalogue. | **fixed** `0442766` — `Dockerfile` `COPY --from=build /app/assets ./dist/assets`. |
| F7 | medium | converters | `html-to-doc` / `markdown-to-doc` / `node-tree.types.ts` | `<blockquote>` / `> ` content silently discarded (block allow-list `p\|ul\|ol\|h1-6`, no quote block type). | **fixed** `e19e2ca` — `Paragraph.quote?: boolean`; both converters + parser + `spliceSpans` + `render-doc.ts`. Verified live: re-ingest yields 5 parts incl. the quote (was 4). |
| F1 | medium | http / deploy | `health.controller.ts` + no bootstrap connect | `/_healthz/ready` = 503 "Not connected to database" from `web` boot until the first organic DB query (MikroORM v7 `init()` no longer connects; Terminus probe short-circuits on `!connected`). | **fixed** `fd7dbd2` — `DatabaseBootstrapService` (`OnApplicationBootstrap` → `orm.connect()`) for every runtime. Verified: readiness 200 as the first request after boot. |
| F8 | low–med | annotation | `splice-spans` via `annotate-post` | a word span inside a `link` node split the anchor into fragments (`"on the "` + `"'s "`), words pulled outside. | **fixed** `106dd5d` — `NodeOffset.type`; `dropSpansCrossingNodeBoundaries` drops link-contained spans. Verified live: link is one node with full text. |
| F5 | low | ai / observability | `anthropic-client.service.ts` | model schema-shape violation → raw `ZodError`, opaque in Sentry. | **fixed** `82d7c95` — `safeParse` + typed `AiSchemaMismatchError` (extends Error, `cause` = ZodError); still thrown so pg-boss retries. |
| F2 | low | db-performance | `PostPublication.postId`, `UserSkillProgress.userId` | standalone `@Index()` on the leading column of a composite `@Unique` (Batch D cleaned this elsewhere; missed these two). | **fixed** `4d748d1` — decorators dropped + `Migration20260906120000` drops the real indexes. |
| F6 | low | dead code / deploy | `core/s3/*`, `@aws-sdk/client-s3`, `image-size` | no module imports `S3Module`, no stage stores assets; deploy still provisioned `engofy_s3_*` secrets + `S3_*` config. | **fixed** `5b38d40` — removed the module, both deps (−26 packages), `S3_*` from all env + CI, `seaweedfs` from compose + CI, `engofy_s3_*` from `stack.prod.yaml`. `pg-backup.sh` (R2 via aws-cli) untouched. |
| F9 | low | security | `stack.prod.yaml` | `web` + `cron` were handed `engofy_anthropic_api_key` though AI runs only in `worker` (P1). | **fixed** `aa3747e` — `*worker-secrets` anchor; only `worker` gets the key. `docker stack config` OK. |

Not fixed / accepted:

- The old `content_*` constraint names (`contents_id_not_null`,
  `content_pipeline_runs_content_id_not_null`) survive from the pre-rename
  history (MG4 immutable). Cosmetic, no functional effect.
- `get-feed` offset pagination has no `(published_at, id)` index; the handler's
  own comment already flags keyset as a deferred feature. Fine at MVP volume.
- Skill reference files (`.claude/skills/engofy/references/*.md`) still mention
  the removed `core/s3` module and pre-Batch-T index state — update on the next
  skill pass (out of scope here).

## Env needed for a local run (`.env.development.local`)

Only `ANTHROPIC_API_KEY` (+ optional `AI_MODEL=claude-sonnet-5`) must be added;
everything else has a working default in `.env.development` (host Postgres/Redis
creds are `engofy/engofy`, `NLP_SERVICE_URL=http://127.0.0.1:8000`, mail falls
back to `ConsoleMailerService` — OTP printed in the worker log). After Batch T
the `S3_*` block is gone from `.env.development` / `.env.test`. Telegram +
Google are opt-in (empty ⇒ no-op).

Seed the reference data after `pnpm migration:up`:

```
pnpm cli grammar import-egp                # 19 categories / 90 constructions / 574 usage points
pnpm cli grammar import-irregular-verbs    # 164 words
pnpm cli words import-frequency            # 164 ranked
```

## Verdict

**Not deploy-ready as-is** before this session; **F1, F4, F7** were the real
blockers and are fixed. **F3** (reader grammar highlighting dead + paid
`ai_grammar` output unused) is now fixed too (`Batch T — F3`) — verified by the
new `apply-grammar-constructs` unit spec, the `tag-grammar` ispec (gated no-op +
re-queue / paints onto `part.body` / strip+repaint idempotency) and the
`get-post-detail` ispec (`annotations.grammar` resolved, usage points CEFR-sorted).

Everything else (pipeline, DB, security, Batch S infra) is in shippable shape.
`docs/deploy.md` (Batch S deliverable #9) is still unwritten — the runbook is a
prerequisite for the first deploy.
