# Documentation Index — proshop_mern

Navigation hub for this fork's documentation. **Start with [`/project-index.json`](../project-index.json)** (machine-readable repo map) and [`/CLAUDE.md`](../CLAUDE.md) (rules), then come here.

> ⚙️ For "how does feature X work" questions, prefer the **search-docs MCP**
> (`search_project_docs`) over grepping — it indexes `project-data/` below.

## Layout

| Path | What's here |
|---|---|
| [`architecture/overview.md`](architecture/overview.md) | **High-level system map** — all four runtimes (Express, React, MCP, RAG) + boundaries. Start here for the big picture. |
| [`architecture.md`](architecture.md) | C4 container view of the MERN core (Place-Order → Pay flow). |
| [`specs/`](specs/) | **Per-module reverse-engineering specs** (overview / decision table / sequence diagram / edge cases). Added in M6 Stage 3. |
| [`adr/`](adr/) | Architecture Decision Records — `adr-001..007` (numbering preserved). |
| [`project-data/`](project-data/) | **LIVE RAG knowledge corpus** — chunked into `chunks.jsonl`, embedded into Qdrant, served by the search-docs MCP. Architecture, API, features, incidents, runbooks, glossary, dev-history, best-practices, page docs. |
| [`chunking-spec.md`](chunking-spec.md) | How `project-data/` becomes `chunks.jsonl` (RAG ingest input). |
| [`chunks.jsonl`](chunks.jsonl) | Generated RAG ingest input (read by `rag/ingest.py`). |

## Module specs (M3–M5 additions)

- [feature-flags-mcp-spec.md](specs/feature-flags-mcp-spec.md) — feature-flags MCP (write-path over `features.json`).
- [feature-flags-backend-spec.md](specs/feature-flags-backend-spec.md) — Express read-path for `/api/feature-flags`.
- [search-docs-mcp-spec.md](specs/search-docs-mcp-spec.md) — docs-search MCP (`search_project_docs`).
- [rag-pipeline-spec.md](specs/rag-pipeline-spec.md) — ingest + query (BGE-M3 + Qdrant).

## ADRs

| ADR | Decision |
|---|---|
| [001](adr/adr-001-mongodb-vs-postgres.md) | MongoDB (Mongoose) over Postgres |
| [002](adr/adr-002-redux-vs-context.md) | Classic Redux over Context |
| [003](adr/adr-003-jwt-vs-session.md) | JWT (localStorage) over sessions |
| [004](adr/adr-004-paypal-vs-stripe.md) | PayPal over Stripe |
| [005](adr/adr-005-bootstrap-vs-tailwind.md) | Bootstrap over Tailwind |
| [006](adr/adr-006-features-json-shared-store.md) | `features.json` as a shared store, MCP-only write-path *(new, M6)* |
| [007](adr/adr-007-autopilot-n8n-mcp-pipeline.md) | Auto-Pilot via browser → n8n → MCP *(new, M6)* |

## Related (repo root)

- [`/DESIGN.md`](../DESIGN.md) — M4 design system (UI single source of truth).
- [`/homework-m6/`](../homework-m6/) — M6 audit artifacts (code review, fixes, this docs pack, tests agent).
- `docs-archived-2026-06-07/` (repo root) — archived historical docs (earlier `FINDINGS.md`, session reports). Superseded by `homework-m6/stage1-code-review/synthesis.md`.

---

*Docs restructured in M6 Stage 3 by the `legacy-auditor-mate` workflow. Audit verdicts per file: [`/homework-m6/stage3-living-docs/docs-audit.md`](../homework-m6/stage3-living-docs/docs-audit.md).*
