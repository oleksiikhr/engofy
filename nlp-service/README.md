# nlp-service

Small FastAPI + spaCy (`en_core_web_sm`) HTTP service. It is the deterministic
NLP layer of the post pipeline: the NestJS `spacy_parse` stage
(`src/modules/post/commands/spacy-parse-post/`) sends one flattened text unit
per request and stores the returned sentences / tokens in `sentences` +
`sentence_tokens`.

It runs as a separate process (not `child_process`) so it scales and is tested
in isolation — see PLAN.md §12.

## Setup

```bash
cd nlp-service
python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Run

```bash
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000
```

The NestJS side reads the base URL from `NLP_SERVICE_URL` (default
`http://127.0.0.1:8000`).

## API

`GET /health` → `{ "status": "ok", "model": "en_core_web_sm" }`

`POST /parse`

```json
{ "text": "Swimming is good for your health." }
```

→

```json
{
  "sentences": [
    {
      "text": "Swimming is good for your health.",
      "start": 0,
      "end": 32,
      "tokens": [
        {
          "index": 0, "text": "Swimming", "lemma": "swimming",
          "pos": "NOUN", "tag": "NN", "dep": "nsubj",
          "morph": {"Number": "Sing"}, "head": 2, "start": 0, "end": 8
        }
      ]
    }
  ]
}
```

- Sentence `start` / `end` are char offsets within the submitted `text`.
- Token `start` / `end` are char offsets within that sentence's `text`.
- Token `head` is the sentence-local index of the token's syntactic head
  (equals the token's own `index` when it is the sentence root).

Gerund detection and phrasal-verb grouping are done downstream in
`src/modules/post/domain/build-sentences.ts`, not here.

## Smoke test

```bash
curl -s localhost:8000/parse -H 'content-type: application/json' \
  -d '{"text":"She picked her sister up from school."}' | python -m json.tool
```
