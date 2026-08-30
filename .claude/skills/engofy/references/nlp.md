# NLP layer — `nlp-service`, `NlpClient`, deterministic spaCy domain

> Reviewed: `core/nlp`, `nlp-service/`, `post/domain/build-sentences.ts` (wave 1).

## Pieces

| Piece | File | Role |
|---|---|---|
| `nlp-service` | `nlp-service/app.py` | FastAPI + spaCy `en_core_web_sm`; `GET /health`, `POST /parse` |
| `NlpClient` port | `core/nlp/nlp-client.port.ts` | `NLP_CLIENT` symbol + `NlpToken`/`NlpSentence`/`NlpParseResult` |
| HTTP adapter | `core/nlp/http-nlp-client.service.ts` | global `fetch` + `AbortSignal.timeout`; throws on non-2xx / transport error; **one attempt, no retry** |
| deterministic domain | `post/domain/build-sentences.ts` | spaCy result → rows; phrasal-verb keys, gerund detection |

`requirements.txt` is pinned as a contract (`spacy==3.8.16`, `en_core_web_sm-3.8.0`).

## Offset contract (critical)

| Field | Coordinate space |
|---|---|
| `sentence.start` / `.end` | offsets into the **submitted unit text** |
| `token.start` / `.end` | offsets into the token's **own sentence's** text |
| `token.head` | sentence-local token **index** (== index for the root) |

- Sentence-local token offsets are re-based to unit coordinates **at consumption
  time** (`sentence.charStart + token.charStart`), never stored re-based.
- The NestJS domain **re-validates every offset** (`unitText.slice(s.start,s.end)
  === s.text`, `sentenceText.slice(t.start,t.end) === t.text`) and throws
  `NlpOffsetMismatchError` before persisting anything (all-or-nothing).

## Rules

| # | Rule | Reference |
|---|---|---|
| N1 | `nlp-service` returns **raw spaCy fields only**. All linguistics (phrasal-verb grouping, gerund detection) is deterministic TS in `build-sentences.ts` — never in Python, never via the LLM. | PLAN §5/§12; `build-sentences.ts:58-119` |
| N2 | `computePhrasalVerbKeys`: particle (`dep=prt` / `tag=RP`) → head verb via dependency → key `lemma + particle` (`pick up`), shared by the verb and every fragment; the handler resolves it to a `Phrase` (`phrasal_verb`). | `build-sentences.ts` |
| N3 | `detectGerund`: `-ing` in a nominal dep role; `VBG` always, `NN` only when it has no `det` child **and** is not in `LEXICALISED_ING_NOUNS` (Batch K / D13 — ~24 common `-ing` nouns like `morning`, `nothing`, `spring`; consulted for the `NN` branch only, a confident `VBG` still wins). | `build-sentences.ts` |
| N4 | Both configs ship a working localhost default (`NLP_SERVICE_URL = http://127.0.0.1:8000`) so the app boots without the service. | `core/nlp/nlp.config.ts` |

## Fixes owed

| Sev | Change |
|---|---|
| med | `nlp-service/app.py` has **no tests** — the offset math is the whole contract. Add a `pytest` for a 2-sentence input with a discontinuous phrasal verb. |
| low | `http-nlp-client.service.ts:36` casts `response.json() as NlpParseResult` with no shape check — a malformed 200 throws far away in `buildSentences`. Validate at the boundary. |
| ~~low (D13)~~ | **done (Batch K)** — `LEXICALISED_ING_NOUNS` stop-list in `build-sentences.ts` short-circuits the `NN` branch; `build-sentences.spec.ts` covers "Morning"/"Nothing" (not flagged) and a `VBG` "Meeting" (still flagged). |
