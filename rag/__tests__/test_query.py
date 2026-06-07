"""Characterization tests for rag/query.py (RAG retrieval stage).

These tests pin the *observed* behavior of `query.search`, `query.format_result`
and `query.get_model` as documented in docs/specs/rag-pipeline-spec.md
("Suggested Characterization Tests" + "Edge Cases").

No real BGE-M3 model is loaded and no Qdrant server is contacted: both the
embedding model (`query.get_model` / `query.SentenceTransformer`) and the Qdrant
client (`query.QdrantClient`) are replaced with lightweight fakes that record
the arguments they receive, so the hit-shaping logic can be asserted in
isolation.

Assertions check concrete VALUES — formatted strings, snippet lengths, the
captured `limit`, the structure of the `query_filter`, field types — not mere
aliveness. Each test is independent and resets `query._MODEL` where the
module-level cache is in play.
"""

from __future__ import annotations

import types

import pytest

import query
from qdrant_client.models import Filter


# --------------------------------------------------------------------------- #
# Fakes / fixtures
# --------------------------------------------------------------------------- #

class _FakeEncoding:
    """Stand-in for the numpy array returned by SentenceTransformer.encode.

    The real code calls `.tolist()` on the encode result; we return a fixed
    deterministic vector so search() has something JSON-serializable to pass to
    Qdrant.
    """

    def __init__(self, vector):
        self._vector = vector

    def tolist(self):
        return self._vector


class _FakeModel:
    """Fake embedding model recording every encode() call's args/kwargs."""

    def __init__(self, vector):
        self._vector = vector
        self.encode_calls = []

    def encode(self, text, **kwargs):
        self.encode_calls.append((text, kwargs))
        return _FakeEncoding(self._vector)


class _FakeHit:
    """Mimics a Qdrant ScoredPoint: a `.score` float and a `.payload` dict."""

    def __init__(self, score, payload):
        self.score = score
        self.payload = payload


class _FakeQueryResponse:
    """Mimics the object returned by QdrantClient.query_points (has `.points`)."""

    def __init__(self, points):
        self.points = points


def _make_fake_client_class(points, recorder):
    """Build a fake QdrantClient class.

    `recorder` is a dict that captures construction count and the kwargs handed
    to query_points, so tests can assert what search() forwarded to Qdrant.
    """

    class _FakeQdrantClient:
        def __init__(self, *args, **kwargs):
            recorder["init_count"] = recorder.get("init_count", 0) + 1
            recorder.setdefault("init_kwargs", []).append(kwargs)

        def query_points(self, **kwargs):
            recorder["query_points_kwargs"] = kwargs
            return _FakeQueryResponse(points)

    return _FakeQdrantClient


@pytest.fixture
def fixed_vector():
    """A short deterministic 'embedding' (real one is 1024-dim; length is
    irrelevant to the fakes, only that .tolist() yields it)."""
    return [0.10, -0.20, 0.30, 0.40]


@pytest.fixture(autouse=True)
def _reset_model_cache():
    """Isolate the module-level _MODEL singleton between tests."""
    query._MODEL = None
    yield
    query._MODEL = None


def _install_search_doubles(monkeypatch, *, points, fixed_vector):
    """Wire fake model + fake QdrantClient into the `query` module.

    Returns (fake_model, recorder) so the test can inspect what was captured.
    """
    fake_model = _FakeModel(fixed_vector)
    monkeypatch.setattr(query, "get_model", lambda: fake_model)

    recorder: dict = {}
    fake_client_cls = _make_fake_client_class(points, recorder)
    monkeypatch.setattr(query, "QdrantClient", fake_client_cls)
    return fake_model, recorder


def _hit_dict(**overrides):
    """A realistic, fully-populated search-result dict (what format_result
    consumes). RU/EN doc-search flavored."""
    base = {
        "score": 0.8123456789,
        "chunk_id": "adr_database_choice__002",
        "source_file": "adrs/0001-database-choice.md",
        "file_path": "docs/project-data/adrs/0001-database-choice.md",
        "kind": "adr",
        "title": "ADR 0001: Choosing MongoDB over PostgreSQL",
        "parent_headings": ["Architecture Decisions", "Data Layer"],
        "snippet": "We selected MongoDB because the product catalog is document shaped.",
    }
    base.update(overrides)
    return base


# --------------------------------------------------------------------------- #
# format_result — pure rendering
# --------------------------------------------------------------------------- #

def test_format_result_renders_all_fields_with_4dp_score():
    hit = _hit_dict(score=0.8123456789)
    rendered = query.format_result(3, hit)

    # Score rounded/formatted to exactly 4 decimal places.
    assert "score=0.8123" in rendered
    assert "0.81234" not in rendered  # not 5 dp
    # Index, kind tag, file path on the header line.
    assert rendered.startswith("#3 score=0.8123  [adr]  "
                               "docs/project-data/adrs/0001-database-choice.md\n")
    # Labeled body lines carry the corresponding payload values.
    assert "chunk_id : adr_database_choice__002" in rendered
    assert "heading  : ADR 0001: Choosing MongoDB over PostgreSQL" in rendered
    assert ("snippet  : We selected MongoDB because the product catalog "
            "is document shaped.") in rendered


def test_format_result_uses_dash_placeholder_when_no_parent_headings():
    hit = _hit_dict(parent_headings=[])
    rendered = query.format_result(1, hit)

    # Breadcrumb collapses to the em-dash placeholder, not an empty join.
    assert "»  —\n" in rendered
    # Title still precedes the placeholder.
    assert "heading  : ADR 0001: Choosing MongoDB over PostgreSQL  »  —" in rendered


def test_format_result_joins_multi_level_parent_headings_with_arrow():
    hit = _hit_dict(
        parent_headings=["Runbooks", "Checkout", "PayPal Capture Failure"],
        title="Restart the capture worker",
    )
    rendered = query.format_result(2, hit)

    assert ("heading  : Restart the capture worker  »  "
            "Runbooks > Checkout > PayPal Capture Failure") in rendered
    # The em-dash placeholder must NOT appear when headings exist.
    assert "»  —" not in rendered


def test_format_result_handles_cyrillic_title_and_snippet():
    hit = _hit_dict(
        kind="incident",
        title="Сбой оплаты PayPal в проде",
        parent_headings=["Инциденты", "Оплата"],
        snippet="Платежи не проходили из-за просроченного токена PayPal.",
    )
    rendered = query.format_result(7, hit)

    assert "#7 score=" in rendered
    assert "[incident]" in rendered
    assert "heading  : Сбой оплаты PayPal в проде  »  Инциденты > Оплата" in rendered
    assert "snippet  : Платежи не проходили из-за просроченного токена PayPal." in rendered


# --------------------------------------------------------------------------- #
# search — happy path / field mapping
# --------------------------------------------------------------------------- #

def test_search_maps_payload_into_expected_result_dict(monkeypatch, fixed_vector):
    payload = {
        "chunk_id": "features_search_v2__001",
        "source_file": "features/search-v2.md",
        "file_path": "docs/project-data/features/search-v2.md",
        "kind": "feature",
        "title": "search_v2 rollout",
        "parent_headings": ["Features", "Search"],
        "text": "search_v2 enables BGE-M3 semantic ranking over the catalog.",
    }
    hits = [_FakeHit(score=0.731, payload=payload)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    results = query.search("how does search_v2 rank results?", top_k=5)

    assert len(results) == 1
    r = results[0]
    # Exact set of output keys (the public contract).
    assert set(r.keys()) == {
        "score", "chunk_id", "source_file", "file_path",
        "kind", "title", "parent_headings", "snippet",
    }
    assert r["score"] == pytest.approx(0.731)
    assert r["chunk_id"] == "features_search_v2__001"
    assert r["file_path"] == "docs/project-data/features/search-v2.md"
    assert r["kind"] == "feature"
    assert r["parent_headings"] == ["Features", "Search"]
    # snippet is derived from payload['text'].
    assert r["snippet"] == "search_v2 enables BGE-M3 semantic ranking over the catalog."


def test_search_coerces_integer_score_to_float(monkeypatch, fixed_vector):
    # Qdrant scores are floats; pin that search() coerces via float() even if a
    # backend hands back an int-like score.
    payload = {"text": "edge", "chunk_id": "c1"}
    hits = [_FakeHit(score=1, payload=payload)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    results = query.search("edge score", top_k=1)

    assert results[0]["score"] == 1.0
    assert isinstance(results[0]["score"], float)


# --------------------------------------------------------------------------- #
# search — snippet shaping
# --------------------------------------------------------------------------- #

def test_search_truncates_long_snippet_to_240_plus_ellipsis(monkeypatch, fixed_vector):
    long_text = "А" * 1000  # 1000 chars, well over the 240 limit
    payload = {"text": long_text, "chunk_id": "long_chunk__001"}
    hits = [_FakeHit(score=0.5, payload=payload)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    snippet = query.search("truncate me", top_k=1)[0]["snippet"]

    assert snippet.endswith("...")
    assert len(snippet) == 243  # 240 chars + "..."
    assert snippet[:240] == "А" * 240


def test_search_does_not_truncate_short_snippet(monkeypatch, fixed_vector):
    short_text = "Short doc snippet under the limit."
    payload = {"text": short_text, "chunk_id": "short_chunk__001"}
    hits = [_FakeHit(score=0.9, payload=payload)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    snippet = query.search("short", top_k=1)[0]["snippet"]

    assert snippet == short_text
    assert not snippet.endswith("...")


def test_search_normalizes_newlines_to_spaces_in_snippet(monkeypatch, fixed_vector):
    payload = {
        "text": "Line one\nLine two\nLine three",
        "chunk_id": "multiline_chunk__001",
    }
    hits = [_FakeHit(score=0.42, payload=payload)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    snippet = query.search("multiline", top_k=1)[0]["snippet"]

    assert "\n" not in snippet
    assert snippet == "Line one Line two Line three"


# --------------------------------------------------------------------------- #
# search — passthrough of top_k / kind filter
# --------------------------------------------------------------------------- #

def test_search_forwards_top_k_as_qdrant_limit(monkeypatch, fixed_vector):
    payload = {"text": "anything", "chunk_id": "c1"}
    hits = [_FakeHit(score=0.5, payload=payload)]
    _, recorder = _install_search_doubles(
        monkeypatch, points=hits, fixed_vector=fixed_vector
    )

    query.search("limit passthrough", top_k=3)

    assert recorder["query_points_kwargs"]["limit"] == 3
    assert recorder["query_points_kwargs"]["collection_name"] == query.COLLECTION
    # The embedded query vector is forwarded verbatim.
    assert recorder["query_points_kwargs"]["query"] == fixed_vector


def test_search_builds_kind_filter_when_kind_given(monkeypatch, fixed_vector):
    payload = {"text": "adr body", "chunk_id": "adr1", "kind": "adr"}
    hits = [_FakeHit(score=0.6, payload=payload)]
    _, recorder = _install_search_doubles(
        monkeypatch, points=hits, fixed_vector=fixed_vector
    )

    query.search("why mongodb", top_k=5, kind="adr")

    qfilter = recorder["query_points_kwargs"]["query_filter"]
    assert isinstance(qfilter, Filter)
    # The single FieldCondition pins kind == "adr".
    assert len(qfilter.must) == 1
    cond = qfilter.must[0]
    assert cond.key == "kind"
    assert cond.match.value == "adr"


def test_search_passes_no_filter_when_kind_is_none(monkeypatch, fixed_vector):
    payload = {"text": "unfiltered", "chunk_id": "c1"}
    hits = [_FakeHit(score=0.6, payload=payload)]
    _, recorder = _install_search_doubles(
        monkeypatch, points=hits, fixed_vector=fixed_vector
    )

    query.search("no kind filter", top_k=5, kind=None)

    assert recorder["query_points_kwargs"]["query_filter"] is None


# --------------------------------------------------------------------------- #
# search — empty / defensive payload handling
# --------------------------------------------------------------------------- #

def test_search_returns_empty_list_when_no_hits(monkeypatch, fixed_vector):
    _install_search_doubles(monkeypatch, points=[], fixed_vector=fixed_vector)

    results = query.search("nothing matches this query", top_k=5)

    assert results == []


def test_search_applies_defaults_for_missing_payload_keys(monkeypatch, fixed_vector):
    # Payload missing text, parent_headings, and most metadata — search() must
    # default snippet "" and parent_headings [] without raising KeyError.
    sparse_payload = {"chunk_id": "sparse__001"}
    hits = [_FakeHit(score=0.33, payload=sparse_payload)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    r = query.search("sparse payload", top_k=1)[0]

    assert r["snippet"] == ""
    assert r["parent_headings"] == []
    assert r["title"] is None
    assert r["source_file"] is None
    assert r["file_path"] is None
    assert r["kind"] is None
    assert r["chunk_id"] == "sparse__001"


def test_search_treats_none_payload_as_empty_dict(monkeypatch, fixed_vector):
    # Qdrant can return a hit with payload=None; `payload or {}` must guard it.
    hits = [_FakeHit(score=0.21, payload=None)]
    _install_search_doubles(monkeypatch, points=hits, fixed_vector=fixed_vector)

    r = query.search("null payload", top_k=1)[0]

    assert r["snippet"] == ""
    assert r["parent_headings"] == []
    assert r["chunk_id"] is None


def test_search_encodes_query_with_normalization_flags(monkeypatch, fixed_vector):
    # Pin that search() asks the model to L2-normalize and return numpy, matching
    # the ingest-side encoding so cosine scores are comparable.
    payload = {"text": "doc", "chunk_id": "c1"}
    hits = [_FakeHit(score=0.5, payload=payload)]
    fake_model, _ = _install_search_doubles(
        monkeypatch, points=hits, fixed_vector=fixed_vector
    )

    query.search("Какая БД используется в proshop_mern?", top_k=5)

    assert len(fake_model.encode_calls) == 1
    text_arg, kwargs = fake_model.encode_calls[0]
    assert text_arg == "Какая БД используется в proshop_mern?"
    assert kwargs.get("normalize_embeddings") is True
    assert kwargs.get("convert_to_numpy") is True


# --------------------------------------------------------------------------- #
# get_model — module-level singleton cache
# --------------------------------------------------------------------------- #

def test_get_model_constructs_model_only_once_across_calls(monkeypatch):
    construction_count = {"n": 0}

    def _counting_ctor(model_name, device=None):
        construction_count["n"] += 1
        return types.SimpleNamespace(name=model_name, device=device)

    monkeypatch.setattr(query, "SentenceTransformer", _counting_ctor)
    query._MODEL = None  # ensure cold cache (also reset by autouse fixture)

    first = query.get_model()
    second = query.get_model()

    # The expensive constructor ran exactly once; both calls share the instance.
    assert construction_count["n"] == 1
    assert first is second
    assert first.name == query.MODEL_NAME
