# Audit Plan — proshop_mern fork (M6 Stage 3, living documentation)

**Role:** main CC session acting as `legacy-auditor-mate` (not via Task).
**Output dir:** `homework-m6/stage3-living-docs/`. Deliverables (project-index.json, new docs/, scripts, hook, CLAUDE.md edits) land in the repo, then copied to the output dir per Шаг 3.7.

## Project shape (Phase 1 — Discovery)

- **Type:** fullstack monorepo. Root `package.json` = backend (Express + Mongoose, ESM); `frontend/` = separate CRA app.
- **Tech stack:** Node 20 + Express 4.17 + Mongoose 5 + MongoDB · React 16 + classic Redux + redux-thunk + react-router v5 · Python (uv) MCP servers (FastMCP) · Python RAG (BGE-M3 + Qdrant).
- **Subprojects discovered:**
  - `backend/` — Express REST API (controllers/routes/models/middleware/utils/config) + `features.json`.
  - `frontend/src/` — React/Redux SPA incl. the M4 Feature Dashboard.
  - `mcp-servers/feature-flags/server.py` — feature-flags MCP (list/get/set/adjust over `backend/features.json`, atomic writes).
  - `mcp-servers/search-docs/server.py` — docs-search MCP (vector search over the corpus).
  - `rag/ingest.py` + `rag/query.py` — RAG: ingest `docs/chunks.jsonl` → Qdrant; query with BGE-M3.
  - `backend/features.json` — feature-flags state (shared store).
- **Docs surface:** `docs/project-data/` (RAG corpus, 47 md), `docs/{architecture,chunking-spec,report}.md` + `docs/chunks.jsonl`, loose root MD (README, DESIGN, CLAUDE, FINDINGS, report).
- **Tests surface:** none in backend (Stage 2 added `homework-m6/.../tests/` via node:test); frontend CRA/jest configured but unused; Python services have no tests (Stage 4 target).
- **Legacy markers:** upstream deprecated (proshop-v2 exists); React 16 / Mongoose 5 pinned; doc-vs-code drift in 3 corpus files (see docs-audit).

## Existing docs audit (Phase 1.5) — full table: [`docs-audit.md`](docs-audit.md)

- ✅ Keep / carry: 21 · 🔄 carry+TODO: 5 · 📦 archive: 2 · ❌: 0
- **Live-infra guard:** `docs/project-data/` (RAG corpus) + `docs/chunks.jsonl` (read by `rag/ingest.py:27`) stay in place — additive restructure only.
- **Archive (📦):** `FINDINGS.md`, `docs/report.md`. (root `report.md` kept — active cross-module work journal.)

## Audit scope

- **In scope:** whole repo (backend, frontend, mcp-servers, rag, feature-flags, all docs).
- **Out of scope:** `node_modules/`, `*/.venv/`, `frontend/build`, `frontend/public`, `homework/M5/` (M5 artifacts), `uploads/`, `tmp/`.
- **Findings input:** reuse Stage 1 `homework-m6/stage1-code-review/synthesis.md` (Phase 3.0 — specialists already ran; do NOT re-dispatch security/perf/arch).

## Phase 3 — DISPATCH / reverse-engineering
- [x] 3.0 Prior synthesis exists (`stage1-code-review/synthesis.md`) → reuse as findings input; skip 3.1-3.3 (no re-run of security/perf/arch).
- [x] 3.4 4-step reverse engineering (UNDERSTAND → DECISION TABLE → SEQUENCE DIAGRAM → EDGE CASES) per module → `docs/specs/<module>-spec.md`. Modules (parallel sub-agents):
  - [x] `feature-flags-mcp-spec.md` ← `mcp-servers/feature-flags/server.py`
  - [x] `search-docs-mcp-spec.md` ← `mcp-servers/search-docs/server.py`
  - [x] `rag-pipeline-spec.md` ← `rag/ingest.py` + `rag/query.py`
  - [x] `feature-flags-backend-spec.md` ← `backend/controllers/featureFlagsController.js` + `routes/featureFlagsRoutes.js`
  (≥2 required; doing 4 to cover the M3-M5 additions. Each: 6 sections, ≥10 edge cases, mermaid.)

## Phase 4 — AGGREGATE
- [x] 4.1 `stage3-synthesis.md` — aggregate the 4 specs + Stage 1 findings (Stage 1 `synthesis.md` read-only; it's a graded artifact).
- [x] 4.2 `project-index.json` at repo root (real structure; schema below).
- [x] 4.3 Build additive new docs layers **inside `docs/`**:
  - `docs/README.md` — index/navigation hub for the whole docs tree.
  - `docs/architecture/overview.md` — seeded from `docs/architecture.md` (🔄, carry) + extended with MCP/RAG/feature-flags + a system mermaid.
  - `docs/specs/` — the 4 reverse-eng specs from Phase 3.
  - `docs/adr/` — copy `project-data/adrs/adr-001..005` + add `adr-006`, `adr-007` (from Stage 1 `proposed-adrs/`), preserve numbering.
  - TODO(audit-2026-06-07) markers on the 3 🔄 corpus files + `docs/architecture.md`.
- [x] 4.4 Archive 📦 only: `git mv FINDINGS.md docs/report.md docs-archived-2026-06-07/`. (project-data + chunks.jsonl untouched; root `report.md` kept — active work journal.)
- [x] 4.5 No atomic swap needed — restructure is additive inside `docs/`.

## Phase 5 — AUTOMATE
- [x] 5.1 Copy `update_project_index.py` → `.claude/scripts/`, `chmod +x`.
- [x] 5.2 Adapt `WATCH_PATHS` → `("backend/", "frontend/src/", "mcp-servers/", "rag/")`.
- [x] 5.3 Standalone test: expect `[update-index manual] ✅ updated …` then idempotent `no structural change`.
- [x] 5.4 (opt) PostToolUse + SessionStart hook in `.claude/settings.local.json`; smoke-test.
- [x] 5.5 Add two sections to `CLAUDE.md` (START HERE + keep-index-current) + fix the `:5000`→`:5001` port note.
- [x] 5.6 Copy deliverables into `homework-m6/stage3-living-docs/` (project-index.json, update_project_index.py, docs-new/, docs-archived/, CLAUDE.md).

## project-index.json schema (real structure)
`name, type=fullstack-monorepo, description, tech_stack, subprojects{backend,frontend,feature_flags_mcp,search_docs_mcp,rag,feature_flags_layer}, system_folders{.claude/,docs/,uploads/}, root_files, hard_rules(≥5 incl. "read project-index.json FIRST" + MCP-only features.json + search via MCP), ai_routing{feature_flag→MCP, docs_search→MCP, structure→this file}, filesystem_tree(depth 4), last_updated(ISO)`.

## Time estimate
- Phase 3: ~15-25 min (4 parallel reverse-eng sub-agents)
- Phase 4: ~20-30 min
- Phase 5: ~10-15 min

## Open questions for the user (approval gate)
1. **Archive set** = 2 files (`FINDINGS.md`, `docs/report.md`); root `report.md` kept (active work journal). The big `docs/project-data/` corpus + `docs/chunks.jsonl` stay (live RAG). OK?
2. **Edit `CLAUDE.md`** in place (2 new sections + port-note fix). OK to modify the project rules file?
3. **PostToolUse hook** auto-runs `update_project_index.py` on every Write/Edit/Bash — install it (optional per spec), or skip and rely on manual/SessionStart only?
4. **TODO markers** added to 3 live RAG-corpus files (would need a re-ingest to reflect in search) — apply, or record divergences only in the new overview?
