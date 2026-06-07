# Stage 3 Synthesis — Living Documentation pack

**Date:** 2026-06-07 · **Role:** main CC session as `legacy-auditor-mate`
**Inputs:** 4 reverse-engineering specs (Phase 3) + Stage 1 `synthesis.md` (reused as findings, read-only) + Phase 1.5 `docs-audit.md`.

This is the Stage 3 value-add aggregation. It does **not** re-run security/perf/arch (Phase 3.0: Stage 1 already did) and does **not** overwrite the graded `stage1-code-review/synthesis.md`.

## Deliverables produced

| Artifact | Location |
|---|---|
| Machine-readable repo map | `project-index.json` (root) — 6 subprojects, 9 hard_rules, 8 ai_routing, depth-4 tree |
| Index updater | `.claude/scripts/update_project_index.py` (WATCH_PATHS = backend/, frontend/src/, mcp-servers/, rag/) |
| PostToolUse + SessionStart hooks | `.claude/settings.local.json` |
| New docs layers | `docs/README.md`, `docs/architecture/overview.md`, `docs/specs/×4`, `docs/adr/×7` |
| CLAUDE.md sections | "⭐ START HERE" + "⭐ Keeping project-index.json current" + port fix (:5000→:5001) |
| Archive | `docs-archived-2026-06-07/` (FINDINGS.md, report.md, docs-report.md) |

## Module specs (Phase 3 — 4-step reverse engineering)

| Module | Spec | Edge cases | Stand-out finding from the pass |
|---|---|---|---|
| feature-flags MCP (write) | [`feature-flags-mcp-spec.md`](../../docs/specs/feature-flags-mcp-spec.md) | 16 | **Lost-update race**: atomic `os.replace` prevents torn *reads*, but the read-modify-write pair has no lock → concurrent writers (n8n + Claude over HTTP) silently last-write-wins. Dependency validation is one level deep (no cycle/transitive detection). |
| search-docs MCP | [`search-docs-mcp-spec.md`](../../docs/specs/search-docs-mcp-spec.md) | 16 | Validation (`kind`, `top_k` 1–25) lives in the MCP wrapper; Qdrant/model failures propagate **unhandled** (asymmetric with structured validation errors). New `QdrantClient` per call. |
| RAG pipeline | [`rag-pipeline-spec.md`](../../docs/specs/rag-pipeline-spec.md) | 16 | `EMBED_DIM=1024` hardcoded (silent divergence if model swapped). Re-ingest is add/update-only → **orphan vectors** for deleted chunks until `--reset`. Per-call client at `rag/query.py:52` (matches Stage 1 perf HIGH). |
| feature-flags backend (read) | [`feature-flags-backend-spec.md`](../../docs/specs/feature-flags-backend-spec.md) | 14 | **Prototype-pollution-ish lookup**: `features[req.params.name]` is unguarded bracket access → `__proto__`/`constructor`/`toString` resolve to inherited members and read as a "found" flag instead of 404. No caching (re-read+parse per request). |

Each spec carries a `## Suggested Characterization Tests` section → direct input to **Stage 4** (test-writer-mate).

## Stage 1 findings — status after Stage 2

From `stage1-code-review/synthesis.md` (reused as the findings input):

- ✅ **Fixed in Stage 2:** IDOR `getOrderById`, `getUsers` password-hash leak, `updateOrderToPaid` trust+IDOR+crash.
- ⏳ **Still open (documented, not fixed):** unauthenticated `POST /api/upload`, public `GET /api/feature-flags` (needs frontend token), no login rate-limit (needs dep), dependency CVEs (controlled bump), `features.json` shared-store contract → now captured as **ADR-006**, Auto-Pilot pipeline → **ADR-007**.

## Newly surfaced in Phase 3 (not in Stage 1)

These came out of the per-module reverse engineering — candidates for a future Stage 2-style pass (not fixed here):

1. **feature-flags MCP lost-update race** (read-modify-write, no lock) — `mcp-servers/feature-flags/server.py`.
2. **Unguarded bracket access** in `getFeatureFlagByName` — `featureFlagsController.js` (`features[req.params.name]`).
3. **Unhandled Qdrant/model errors** in search-docs MCP (raw exceptions vs structured validation).
4. **RAG orphan vectors** on re-ingest without `--reset`; `EMBED_DIM` hardcoded.

## Docs audit outcome (Phase 1.5)

✅ 20 · 🔄 5 (TODO-marked in place) · 📦 3 (archived) · ❌ 0. The live `docs/project-data/` RAG corpus + `docs/chunks.jsonl` were **kept in place** (moving them would break `rag/ingest.py` + the search-docs MCP). Full table: [`docs-audit.md`](docs-audit.md).

## Follow-ups

- Re-ingest RAG (`python rag/ingest.py`) so search-docs reflects the 3 TODO-marked corpus files.
- Adopt a `schema_version` field on `features.json` (ADR-006 recommends it).
- The 4 newly-surfaced items above are good Stage-2 candidates for a next iteration.
