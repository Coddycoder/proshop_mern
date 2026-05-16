"""Query Qdrant for top-K relevant chunks.

Examples:
    uv run python query.py "Какая БД используется в proshop_mern?"
    uv run python query.py "search_v2 dependencies" --top-k 3
    uv run python query.py "checkout incident" --kind incidents
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Optional

import torch
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, MatchValue
from sentence_transformers import SentenceTransformer

COLLECTION = os.environ.get("QDRANT_COLLECTION", "proshop_docs")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
MODEL_NAME = os.environ.get("EMBED_MODEL", "BAAI/bge-m3")

_MODEL: Optional[SentenceTransformer] = None


def get_model() -> SentenceTransformer:
    global _MODEL
    if _MODEL is None:
        device = (
            "mps" if torch.backends.mps.is_available()
            else "cuda" if torch.cuda.is_available()
            else "cpu"
        )
        _MODEL = SentenceTransformer(MODEL_NAME, device=device)
    return _MODEL


def search(
    query: str,
    *,
    top_k: int = 5,
    kind: Optional[str] = None,
    snippet_chars: int = 240,
) -> list[dict]:
    model = get_model()
    vector = model.encode(
        query, normalize_embeddings=True, convert_to_numpy=True
    ).tolist()

    client = QdrantClient(url=QDRANT_URL)

    qfilter = None
    if kind:
        qfilter = Filter(
            must=[FieldCondition(key="kind", match=MatchValue(value=kind))]
        )

    hits = client.query_points(
        collection_name=COLLECTION,
        query=vector,
        limit=top_k,
        query_filter=qfilter,
        with_payload=True,
    ).points

    out: list[dict] = []
    for h in hits:
        payload = h.payload or {}
        text = payload.get("text", "")
        snippet = text.replace("\n", " ").strip()
        if len(snippet) > snippet_chars:
            snippet = snippet[:snippet_chars] + "..."
        out.append(
            {
                "score": float(h.score),
                "chunk_id": payload.get("chunk_id"),
                "source_file": payload.get("source_file"),
                "file_path": payload.get("file_path"),
                "kind": payload.get("kind"),
                "title": payload.get("title"),
                "parent_headings": payload.get("parent_headings", []),
                "snippet": snippet,
            }
        )
    return out


def format_result(idx: int, hit: dict) -> str:
    bh = " > ".join(hit["parent_headings"]) if hit["parent_headings"] else "—"
    return (
        f"#{idx} score={hit['score']:.4f}  [{hit['kind']}]  {hit['file_path']}\n"
        f"   chunk_id : {hit['chunk_id']}\n"
        f"   heading  : {hit['title']}  »  {bh}\n"
        f"   snippet  : {hit['snippet']}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("query", type=str, help="Search query (natural language).")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument(
        "--kind",
        type=str,
        default=None,
        help="Filter by kind (adr, api, feature, incident, runbook, page, ...).",
    )
    args = parser.parse_args()

    print(f"\nQUERY: {args.query!r}  (top_k={args.top_k}, kind={args.kind})\n")
    hits = search(args.query, top_k=args.top_k, kind=args.kind)
    if not hits:
        print("No results.", file=sys.stderr)
        sys.exit(1)
    for i, hit in enumerate(hits, 1):
        print(format_result(i, hit))


if __name__ == "__main__":
    main()
