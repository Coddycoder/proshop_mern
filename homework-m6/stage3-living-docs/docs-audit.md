# Existing docs audit — proshop_mern fork (M6 Stage 3, Phase 1.5)

**Auditor:** main CC session in `legacy-auditor-mate` role
**Audit date:** 2026-06-07
**Repo:** fork of `proshop_mern` (MERN) + 2 Python MCP servers + Python RAG + feature-flags layer
**Existing docs scanned:** 59 files across `docs/`, `docs/project-data/` (+ 6 subfolders), and 5 loose root/`docs` files

## Verdict legend

| Symbol | Verdict | Action in Phase 4 |
|---|---|---|
| ✅ | **ACCURATE** — matches code, well-maintained | Keep / carry into new structure |
| 🔄 | **PARTIALLY** — mostly right, has stale sections | Carry + add `TODO(audit-2026-06-07)` markers |
| 📦 | **HISTORICAL** — old but worth preserving | Move to `docs-archived-2026-06-07/`, never `rm`; link from new overview |
| ❌ | **STALE / REDUNDANT** — superseded | Archive first, then ignore |

> ⚠️ **Live-infrastructure guard.** `docs/project-data/` is the **RAG knowledge corpus** (chunked into `docs/chunks.jsonl`, embedded with BGE-M3, served by the `search-docs` MCP over Qdrant). `docs/chunks.jsonl` is read directly by `rag/ingest.py:27`. Neither may be archived/moved without breaking RAG — they are treated as **live ✅ infrastructure**, not "old docs".

---

## Inventory — `docs/project-data/` (RAG corpus)

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `architecture.md` (746) | core ref | 🔄 | Routes/middleware accurate, but claims `POST /api/upload` is admin-only (code: `uploadRoutes.js:37` has **no** `protect,admin`) and claims the userModel pre-save hook prevents re-hashing (code: `userModel.js:34` missing `return next()` → double-hash). | Carry; TODO markers on those 2 sections |
| `best-practices.md` (806) | advisory | ✅ | 2020-vs-2026 guidance, generic & still valid; educational not prescriptive. | Keep |
| `dev-history.md` (293) | history | ✅ | Timeline coherent; incident refs (i-001/2/3) exist; institutional context. | Keep (also link from overview) |
| `feature-flags-spec.md` (751) | contract | ✅ | MCP tools match `server.py` exactly (`list_features`/`get_feature_info`/`set_feature_state`/`adjust_traffic_rollout`); status + traffic semantics match `features.json`. | Keep (canonical) |
| `features-analysis-ru.md` (182) | nav guide | ✅ | 25 flags match `features.json`; dependency graph correct. | Keep |
| `glossary.md` (427) | domain ref | ✅ | Customer/Product/Order/Cart definitions match schemas. | Keep |
| `adrs/` (5) | decision log | ✅ | ADR-001..005 reflect implemented decisions (Mongo, Redux, JWT, PayPal, Bootstrap). | Carry into new `docs/adr/`; **preserve numbering** |
| `api/` (5) | API ref | 🔄 | auth/orders/products/users accurate; **`uploads.md`** claims Private/Admin auth the code doesn't enforce. | Carry; TODO marker on `uploads.md` |
| `features/` (6) | feature specs | ✅ | admin/auth/cart/catalog/checkout/payments match code + flags. | Keep |
| `incidents/` (3) | post-mortems | ✅ | i-001 PayPal double-charge, i-002 Mongo pool, i-003 JWT leak — coherent records. | Keep (link from ADRs) |
| `runbooks/` (6) | ops | 🔄 | local-setup/db-seed/deploy/ab-test/incident-response OK; **`feature-flag-toggle.md`** describes a MongoDB `FeatureFlag` collection that doesn't exist — real impl is `features.json` + MCP. | Carry; TODO marker on `feature-flag-toggle.md` |
| `pages/` (16+INDEX) | UI walk | ✅ | Screen/route/component names match `frontend/src`. | Keep |

**project-data subtotal:** ✅ 15 · 🔄 3 · 📦 0 · ❌ 0

---

## Inventory — loose `docs/` + root files

| Path | Type | Verdict | Reasoning | Action |
|---|---|---|---|---|
| `docs/architecture.md` (129) | C4 overview | 🔄 | Excellent C4 container view referencing real file paths + PlaceOrder→Pay flow. Accurate incl. proxy `:5001`. Slightly behind: covers **only** the original MERN stack — no MCP / RAG / feature-flags additions. | **Carry → `docs/architecture/overview.md`**, extend with M3-M5 additions |
| `docs/chunks.jsonl` (471) | RAG input | ✅ LIVE | Read by `rag/ingest.py:27` → Qdrant. Generated build artifact but **actively consumed**. | Keep in place, do not touch |
| `docs/chunking-spec.md` (156) | spec | ✅ | Documents how `chunks.jsonl` (the live input) is built; still valid. | Keep |
| `docs/report.md` (132) | build report | 📦 | One-time report of the M3 chunking run (471 chunks, 47 files). Point-in-time; nothing reads it. | **Archive** |
| `README.md` (229) | repo readme | ✅ | proshop overview + student run/PayPal/Mongo additions. | Keep at root (not part of docs swap) |
| `DESIGN.md` (386) | design system | ✅ | M4 visual language; CLAUDE.md names it the UI single-source-of-truth. | Keep at root; link from `docs/README.md` |
| `CLAUDE.md` (140) | agent rules | 🔄 | Accurate except the dev port: says backend `:5000` / proxy `:5000`, but `frontend/package.json` proxy = **`:5001`**. | Edit in Phase 5 (add 2 sections + fix port note) |
| `FINDINGS.md` (9-row table) | earlier audit | 📦 | Quality review from an earlier module; references fix `b7d6b09` (calcPrices, already applied). Superseded by Stage 1 `synthesis.md` (which re-found #3/#4/#6). Historical lineage. | **Archive** (synthesis.md is the live successor) |
| `report.md` (562, root) | session log | 📦 | Russian cross-module work journal (env, CLAUDE.md, README, M3…). Personal log, not code docs. | **Archive** |
| `frontend/README.md` (68) | CRA scaffold | ✅ | Default Create-React-App readme. Out of scope. | Leave untouched |

**loose subtotal:** ✅ 5 · 🔄 2 · 📦 3 · ❌ 0

---

## Summary

- ✅ Keep / carry: **20** items
- 🔄 Carry + TODO markers: **5** items (`project-data/architecture.md`, `project-data/api/uploads.md`, `project-data/runbooks/feature-flag-toggle.md`, `docs/architecture.md`, `CLAUDE.md`)
- 📦 Archive (historical): **3** items (`FINDINGS.md`, `report.md`, `docs/report.md`)
- ❌ Archive (stale): **0**

**Total reviewed:** 28 entries (folders counted once; 59 files).

Only **3 loose historical files** are archived. The entire `docs/project-data/` corpus and `docs/chunks.jsonl` stay in place — they are live RAG infrastructure and verified accurate. This is the "don't trash valid docs" principle: a blind `git mv docs/ docs-archived/` would have broken the search-docs MCP and the RAG ingest.

## Cross-references to preserve

- `docs/project-data/dev-history.md` → link from new `docs/architecture/overview.md`.
- ADR numbering: new `docs/adr/` keeps `adr-001..005` **and** adds `adr-006`, `adr-007` (from Stage 1 `proposed-adrs/`) — do not restart from 1.
- ADR ↔ incident links: ADR-001↔i-002 (Mongo pool), ADR-003↔i-003 (JWT leak), ADR-004↔i-001 (PayPal double-charge).
- `feature-flags-spec.md` ↔ `backend/features.json` ↔ feature-flags MCP — the spine of M3-M7; keep linked from the new module spec.
- Stage 1 `synthesis.md` supersedes `FINDINGS.md` — note the lineage when archiving.

## Notes for Phase 2

- Do **not** archive `docs/project-data/` or `docs/chunks.jsonl` (live RAG). New living-docs layers are **additive** inside `docs/`.
- The 3 🔄 corpus files get TODO markers in place → a RAG re-ingest (`python rag/ingest.py`) would be needed for search-docs to reflect them; flag as optional follow-up.
- `docs/architecture.md` is the natural seed for the new `docs/architecture/overview.md` but must be extended to cover MCP/RAG/feature-flags.
