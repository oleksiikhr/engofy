# AI layer — `core/ai`, structured output, inline-markup

> Reviewed: `core/ai`, `post` prompt/parse domain, `draft/` (wave 1). See `REVIEW.md` D9, D13.

## Port

`core/ai/ai-client.port.ts` — `AI_CLIENT` symbol token + interface. Two output modes,
deliberately split:

| Method | Shape | Use for |
|---|---|---|
| `complete({ system, userText, maxTokens })` | free-form text back | whole-text inline-markup passes (annotation, grammar) |
| `completeStructured<T>({ system, userText, tool: { name, description, schema: ZodType<T> } })` | forced single-tool-use; `input_schema` from `z.toJSONSchema` (strip `$schema`); response validated `tool.schema.parse` | small structured outputs (complexity, comprehension) |

Adapter `anthropic-client.service.ts` (not `@Injectable` — built by `ai-client.provider.ts`).

## Rules

| # | Rule | Reference |
|---|---|---|
| AI1 | AI calls run **only in pg-boss processors** (`references/pipeline.md` P1). | PLAN §12 |
| AI2 | Never trust the raw tool payload — always `tool.schema.parse` it. | `anthropic-client.service.ts:112` |
| AI3 | `complete()` turns SDK `stop_reason === 'max_tokens'` into a distinct thrown error so the reconstruct-retry loop doesn't spin on a budget problem. `completeStructured` must do the same (**gap** — today a truncated tool call surfaces as an opaque `ZodError`). | `anthropic-client.service.ts:133-137` |
| AI4 | Every call logs a structured usage line (`input`/`output`/`cache` tokens + `cost_usd`). | `anthropic-client.service.ts:57-69` |
| AI5 | Prompt strings + zod tool schemas live in pure `<module>/domain/*-prompt.ts`. | `post/domain/complexity-prompt.ts` |

## Inline-markup round-trip

Model echoes the text back **verbatim**, adding only tags:

- annotation: `⟦…⟧{{p|type|canon|gN}}`  ·  grammar: `⟦span⟧{{g|slug|egpIndex}}`
- delimiters are the rare `⟦` `⟧` (U+27E6/7) + `{{…}}`.
- parser recovers offsets by walking the original text (annotation) or rebuilding
  plain text char-by-char with a `⟦`/`⟧` stack (grammar — handles one nesting level).
- `isComplete = false` unless the stripped output reconstructs the input
  character-for-character → **1 retry**, same prompt; still incomplete → proceed
  with partial spans + `logger.warn`.
- **all-or-nothing**: `validateAnnotations` throws on the first bad offset/shape/
  overlap; the caller writes none of the batch on throw.

Reference: `post/domain/parse-annotation-tags.ts`, `parse-grammar-tags.ts`,
`grammar-prompt.ts`.

## D13 — PLAN §6 is stale (confirmed)

PLAN §6/§12 claim private-use-area escaping of `[]{}` "вже є" — it is **not**
implemented and the format changed. Confirmed approach: rare-delimiter +
reconstruct-and-compare, **no** PUA escaping; a literal `⟦`/`⟧`/`{{…}}` in a
source paragraph is unsupported (vanishingly rare) and degrades to partial
annotation. PLAN to be updated to match.

## `draft/` eval harness

- Imports the **real** production domain functions + prompts; only `callClaude` /
  `callNlp` transports are re-implemented; the pricing table is duplicated on
  purpose so a prod edit can't retro-skew an old baseline.
- `snapshot*.ts` writes a committed baseline (`draft/baselines/`); `compare*.ts`
  flags a regression only on **hard** failures (`isComplete` true→false,
  `truncated` false→true, persisted→0, catalogue-drops rising) — never on count
  variance (LLM sampling moves counts).

## Fixes owed

| Sev | Change |
|---|---|
| med | Sonnet 5 price in `anthropic-client.service.ts:14` + `draft/lib/call-claude.ts:11` is stale (`{input:3,output:15}` → `{input:2,output:10}`). |
| med | `completeStructured` must check `stop_reason` (AI3). |
| med | `supportsAdaptiveThinking` denylists only `haiku` — allowlist adaptive-capable models instead. |
| med | Stream `complete()` (baseline calls ~114 s — SDK 10-min timeout risk → full paid stage re-run); add `cache_control: { type: 'ephemeral' }` to the large static system prompts. |
| med | `AnthropicClientService` has no unit spec. |
