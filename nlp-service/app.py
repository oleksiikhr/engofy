"""engofy nlp-service — deterministic spaCy layer for the post pipeline.

A single POST /parse endpoint takes a plain-text unit (one flattened
paragraph or one list item from a PostPart) and returns spaCy's sentence
segmentation + per-token analysis. All offsets are character offsets:
sentence offsets are relative to the submitted text, token offsets are
relative to their own sentence's text — so the NestJS `spacy_parse` stage
can validate `text[start:end] == token.text` before writing anything
(PLAN.md §12 offset-splice / all-or-nothing).

Gerund detection and phrasal-verb grouping are NOT done here — this service
only exposes raw spaCy fields (pos/tag/dep/head/morph). The deterministic
rules live in src/modules/post/domain/build-sentences.ts so they are
unit-testable without a running Python process.

Run:  uvicorn app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import spacy
from fastapi import FastAPI
from pydantic import BaseModel, Field

# en_core_web_sm is the model pinned in requirements.txt. Loaded once at
# import time; the process is single-model and stateless per request.
nlp = spacy.load("en_core_web_sm")

app = FastAPI(title="engofy nlp-service", version="1.0.0")


class ParseRequest(BaseModel):
    text: str = Field(min_length=1)


class Token(BaseModel):
    # 0-based index of this token within its sentence.
    index: int
    text: str
    lemma: str
    pos: str  # universal POS (token.pos_)
    tag: str  # fine-grained Penn tag (token.tag_)
    dep: str  # dependency label (token.dep_)
    # token.morph as a flat map, e.g. {"Tense": "Past", "VerbForm": "Fin"}.
    morph: dict[str, str]
    # Sentence-local index of this token's syntactic head; equals `index`
    # when the token is its own root.
    head: int
    # Char offsets within the sentence's text.
    start: int
    end: int


class Sentence(BaseModel):
    text: str
    # Char offsets within the submitted request text.
    start: int
    end: int
    tokens: list[Token]


class ParseResponse(BaseModel):
    sentences: list[Sentence]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": "en_core_web_sm"}


@app.post("/parse", response_model=ParseResponse)
def parse(req: ParseRequest) -> ParseResponse:
    doc = nlp(req.text)
    sentences: list[Sentence] = []

    for sent in doc.sents:
        base_i = sent.start  # doc-token index of the sentence's first token
        base_char = sent.start_char  # char offset of the sentence in req.text

        tokens = [
            Token(
                index=tok.i - base_i,
                text=tok.text,
                lemma=tok.lemma_,
                pos=tok.pos_,
                tag=tok.tag_,
                dep=tok.dep_,
                morph=tok.morph.to_dict(),
                head=tok.head.i - base_i,
                start=tok.idx - base_char,
                end=tok.idx + len(tok.text) - base_char,
            )
            for tok in sent
        ]

        sentences.append(
            Sentence(
                text=sent.text,
                start=sent.start_char,
                end=sent.end_char,
                tokens=tokens,
            )
        )

    return ParseResponse(sentences=sentences)
