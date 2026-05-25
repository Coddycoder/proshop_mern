"""Embed docs/chunks.jsonl with BGE-M3 and upsert into Qdrant.

Run with:
    uv run python ingest.py             # incremental upsert (idempotent)
    uv run python ingest.py --reset     # drop collection first, full reindex

Qdrant expected at QDRANT_URL (default http://localhost:6333).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path

import torch
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PayloadSchemaType, PointStruct, VectorParams
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
CHUNKS_PATH = ROOT / "docs" / "chunks.jsonl"

COLLECTION = os.environ.get("QDRANT_COLLECTION", "proshop_docs")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
MODEL_NAME = os.environ.get("EMBED_MODEL", "BAAI/bge-m3")
EMBED_DIM = 1024  # BGE-M3 dense output
BATCH_SIZE = int(os.environ.get("EMBED_BATCH", "8"))


def pick_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def load_chunks(path: Path) -> list[dict]:
    chunks: list[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            chunks.append(json.loads(line))
    return chunks


def chunk_to_point_id(chunk_id: str) -> str:
    """Deterministic UUID5 so repeated ingest is idempotent."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, chunk_id))


def ensure_collection(client: QdrantClient, *, reset: bool) -> None:
    exists = client.collection_exists(COLLECTION)
    if exists and reset:
        print(f"[reset] deleting existing collection '{COLLECTION}'")
        client.delete_collection(COLLECTION)
        exists = False
    if not exists:
        print(f"[setup] creating collection '{COLLECTION}' (dim={EMBED_DIM}, cosine)")
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
        )
        # Payload indices speed up filtering in Part 4 / search-docs MCP.
        for field in ("kind", "source_file", "file_path", "language"):
            client.create_payload_index(
                collection_name=COLLECTION,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop collection before re-ingesting (full reindex).",
    )
    args = parser.parse_args()

    if not CHUNKS_PATH.exists():
        print(f"chunks file not found: {CHUNKS_PATH}", file=sys.stderr)
        sys.exit(1)

    chunks = load_chunks(CHUNKS_PATH)
    print(f"[load] {len(chunks)} chunks from {CHUNKS_PATH.relative_to(ROOT)}")

    client = QdrantClient(url=QDRANT_URL)
    ensure_collection(client, reset=args.reset)

    device = pick_device()
    print(f"[model] loading {MODEL_NAME} on device={device}")
    t0 = time.perf_counter()
    model = SentenceTransformer(MODEL_NAME, device=device)
    print(f"[model] ready in {time.perf_counter() - t0:.1f}s")

    texts = [c["text"] for c in chunks]
    print(f"[embed] encoding {len(texts)} chunks (batch={BATCH_SIZE})")
    t0 = time.perf_counter()
    vectors = model.encode(
        texts,
        batch_size=BATCH_SIZE,
        show_progress_bar=True,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    elapsed = time.perf_counter() - t0
    print(
        f"[embed] done in {elapsed:.1f}s "
        f"({len(texts) / elapsed:.1f} chunks/s, shape={vectors.shape})"
    )

    points: list[PointStruct] = []
    for chunk, vec in zip(chunks, vectors):
        meta = chunk["metadata"]
        payload = {**meta, "text": chunk["text"]}
        points.append(
            PointStruct(
                id=chunk_to_point_id(meta["chunk_id"]),
                vector=vec.tolist(),
                payload=payload,
            )
        )

    print(f"[upsert] sending {len(points)} points to '{COLLECTION}'")
    UPSERT_BATCH = 64
    for i in tqdm(range(0, len(points), UPSERT_BATCH)):
        client.upsert(
            collection_name=COLLECTION,
            points=points[i : i + UPSERT_BATCH],
            wait=True,
        )

    info = client.get_collection(COLLECTION)
    print(
        f"[done] collection '{COLLECTION}': "
        f"vectors_count={info.points_count}, status={info.status}"
    )


if __name__ == "__main__":
    main()
