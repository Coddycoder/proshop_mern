"""Search-docs MCP server for proshop_mern.

Wraps the RAG pipeline from rag/query.py as a single MCP tool. The Qdrant
collection (proshop_docs) and the BGE-M3 model are reused as-is — this
server is a thin protocol adapter, not a second retrieval implementation.

Run:
    uv --directory mcp-servers/search-docs run python server.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

# Reuse rag/query.py:search without copying or re-implementing retrieval.
RAG_DIR = Path(__file__).resolve().parent.parent.parent / "rag"
if str(RAG_DIR) not in sys.path:
    sys.path.insert(0, str(RAG_DIR))

from query import search as _search  # noqa: E402

VALID_KINDS = (
    "adr",
    "api",
    "architecture",
    "best-practice",
    "feature",
    "glossary",
    "history",
    "incident",
    "page",
    "runbook",
    "spec",
)

mcp = FastMCP("proshop-search-docs")


SEARCH_DOCS_DESCRIPTION = """\
Semantic search over proshop_mern documentation (Qdrant + BGE-M3).

Indexed corpus (docs/project-data/, 471 chunks): architecture, ADRs,
feature specs, API reference, runbooks, postmortems, glossary, dev
history, best-practices, UI pages.

WHEN TO USE:
  - User asks anything about the proshop_mern product itself: how a
    feature works, why a decision was made, what an incident looked
    like, what an endpoint returns, what a term means.
  - You MUST use this FIRST before grep+read of docs/project-data/.
    Vector search is faster and returns chunks with breadcrumbs and
    source_file already attached.
  - To discover which file holds the answer before reading it in full.

WHEN NOT TO USE:
  - User asks about the CURRENT state of a feature flag
    (status / traffic_percentage / dependencies live state) -> use
    the feature-flags MCP (get_feature_info / list_features). This
    index is a frozen documentation snapshot, not runtime state.
  - User wants to mutate a flag -> feature-flags MCP
    (set_feature_state / adjust_traffic_rollout).
  - You already have the exact file path and need its full content
    verbatim -> fall back to Read on the source file. Vector search
    returns snippets, not whole files.

Args:
  query:  Natural-language question. RU and EN both work — corpus is
          mixed (445 EN + 26 RU chunks), embedding model is BGE-M3
          (multilingual).
  top_k:  Number of chunks to return. Default 5. Use 3-5 for focused
          factual lookups, 8-10 only for broad overview questions
          (context window dilutes above 8). Range 1..25.
  kind:   Optional filter on document type. One of: adr, api,
          architecture, best-practice, feature, glossary, history,
          incident, page, runbook, spec. Use when you already know
          the answer category (e.g. kind="incident" for postmortem
          questions, kind="adr" for "why did we pick X?").

Returns:
  {"query": str, "top_k": int, "kind": str | None, "count": int,
   "hits": [{score, chunk_id, source_file, file_path, kind, title,
              parent_headings, snippet}]}
  snippet is the first ~240 chars of the chunk text (one-line).
  To read the full chunk: open file_path from docs/project-data/.

Examples:
  search_project_docs("Какая БД используется и почему?")
    -> hits from architecture.md + adrs/adr-001-mongodb-vs-postgres.md

  search_project_docs("PayPal double charge incident", top_k=3,
                      kind="incident")
    -> hits scoped to incidents/i-001-paypal-double-charge.md only

  search_project_docs("semantic_search dependencies", kind="spec")
    -> hits from feature-flags-spec.md describing the flag contract
"""


@mcp.tool(description=SEARCH_DOCS_DESCRIPTION)
def search_project_docs(
    query: str,
    top_k: int = 5,
    kind: str | None = None,
) -> dict[str, Any]:
    if kind is not None and kind not in VALID_KINDS:
        return {
            "error": "INVALID_KIND",
            "message": (
                f"kind='{kind}' is not valid. Must be one of: "
                f"{', '.join(VALID_KINDS)} (or omit for no filter)."
            ),
            "query": query,
        }
    if not (1 <= top_k <= 25):
        return {
            "error": "INVALID_TOP_K",
            "message": "top_k must be between 1 and 25.",
            "query": query,
            "top_k": top_k,
        }

    hits = _search(query, top_k=top_k, kind=kind)
    return {
        "query": query,
        "top_k": top_k,
        "kind": kind,
        "count": len(hits),
        "hits": hits,
    }


if __name__ == "__main__":
    mcp.run()
