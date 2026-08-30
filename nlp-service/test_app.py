"""Contract tests for the nlp-service.

The NestJS `spacy_parse` stage relies on two invariants before it writes
anything (PLAN.md §12, all-or-nothing offset splice):

  * sentence offsets index the submitted text: text[s.start:s.end] == s.text
  * token offsets index their own sentence: s.text[t.start:t.end] == t.text

plus `head` being a sentence-local index and `index` being 0-based and
sequential. These tests lock that down; they do not assert spaCy's linguistic
labels beyond the one documented example.

Run:  .venv/bin/pytest
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def parse(text: str) -> list[dict]:
    res = client.post("/parse", json={"text": text})
    assert res.status_code == 200, res.text
    return res.json()["sentences"]


def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "model": "en_core_web_sm"}


def test_empty_text_is_rejected() -> None:
    assert client.post("/parse", json={"text": ""}).status_code == 422


@pytest.mark.parametrize(
    "text",
    [
        "Swimming is good for your health.",
        "She picked her sister up from school.",
        "The government kept tabs on results. Reporters took notes too.",
        "  leading spaces and\ttabs\nand newlines  ",
    ],
)
def test_offsets_round_trip(text: str) -> None:
    sentences = parse(text)
    assert sentences, "expected at least one sentence"

    for sent in sentences:
        # Sentence offsets index the submitted text.
        assert text[sent["start"] : sent["end"]] == sent["text"]

        tokens = sent["tokens"]
        assert [t["index"] for t in tokens] == list(range(len(tokens)))

        for tok in tokens:
            # Token offsets index the sentence's own text.
            assert sent["text"][tok["start"] : tok["end"]] == tok["text"]
            # head is a sentence-local index.
            assert 0 <= tok["head"] < len(tokens)
            assert isinstance(tok["morph"], dict)

        # Exactly one root, and a root points at itself.
        roots = [t for t in tokens if t["head"] == t["index"]]
        assert len(roots) >= 1


def test_multi_sentence_segmentation() -> None:
    sentences = parse("He runs. She walks.")
    assert len(sentences) == 2
    assert sentences[0]["text"] == "He runs."
    assert sentences[1]["text"] == "She walks."
    # Second sentence's token offsets are sentence-relative, not doc-relative.
    assert sentences[1]["tokens"][0]["start"] == 0
    assert sentences[1]["tokens"][0]["text"] == "She"


def test_documented_example() -> None:
    (sent,) = parse("Swimming is good for your health.")
    tokens = sent["tokens"]
    first = tokens[0]
    assert first["text"] == "Swimming"
    # Gerund used as a noun subject — spaCy tags it NOUN here (the case the
    # downstream gerund heuristic in build-sentences.ts has to correct).
    assert first["pos"] == "NOUN"
    # Its syntactic head is the copula "is".
    assert tokens[first["head"]]["text"] == "is"
