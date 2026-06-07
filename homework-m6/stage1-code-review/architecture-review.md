# Architecture Mate — Review Summary

**Reviewer:** architecture-mate (Opus, role per `.claude/agents/architecture-mate.md`)
**Scope:** Whole `proshop_mern` fork — `backend/` (server, controllers, routes, middleware, models, utils, config), `frontend/src/` (store, actions, reducers, screens, components, constants), `mcp-servers/feature-flags/server.py`, `mcp-servers/search-docs/server.py`, `rag/ingest.py`, `rag/query.py`, and the cross-cutting `features.json` boundary. Out of scope: tests, scripts, `frontend/public|build`, `node_modules`, `.venv`, `homework*/`, `docs/` contents (read ADRs + architecture.md for context only).
**Scope size:** ~25 source files across 4 sub-systems (Node/Express, React/Redux, Python MCP, Python RAG); RAG corpus 471 chunks; 25 feature flags.
**ADRs loaded:** 5 (ADR-001 MongoDB, ADR-002 Redux, ADR-003 JWT, ADR-004 PayPal, ADR-005 Bootstrap) + `architecture.md` + `CLAUDE.md`.

## Findings

- **C1 (HIGH):** 1 issue
- **C2 (MEDIUM):** 4 issues
- **C3 (LOW):** 5 issues
- Clean categories: God object, Circular dependency, API breaking change.

(Severity reflects *architectural* impact. Several C2/C3 items also have a security dimension — see Cross-mate section; security-mate owns the security severity for those.)

## Top concerns (C1)

1. **`backend/controllers/featureFlagsController.js:5`** — A second, parallel access path to `backend/features.json` (the Express read-path) was added with **no ADR**. `features.json` is now the shared source of truth for three runtimes (Express read API, Python MCP write API, n8n Auto-Pilot) with no DB, no lock coordination, and no schema/version contract. `CLAUDE.md` mandates *MCP-only mutation*, but that rule lives nowhere in the ADR set. This file-as-shared-database boundary spans `backend/` + `mcp-servers/` + n8n — an architecturally significant, undocumented decision. (ADR violated: none — gap. See **ADR-006 draft**.)

## All findings by area

**features.json boundary (the spine of the new system)**
- `featureFlagsController.js:5` — undocumented shared-store / dual access-path (C1, ADR-006).
- `featureFlagsController.js:15` + `featureFlagsRoutes.js:9` — read routes mounted **Public**, no `protect, admin`, despite handler comment saying "admin-only" and best-practices.md treating flag config as admin/financial data (C2).

**n8n / Auto-Pilot integration**
- `AutoPilotControls.js:41` — React component calls the n8n webhook **directly from the browser**, bypassing Express; ships `REACT_APP_N8N_API_KEY` into the bundle; no documented `/feature-control` contract (C2, ADR-007).

**Order / pricing**
- `orderController.js:11` — server-side `calcPrices` (good hardening over upstream, which trusted client prices) is undocumented; tax/shipping rules duplicated in backend + `PlaceOrderScreen.js:59-60` + OrderScreen (C3).
- `orderController.js:77` — `getOrderById` has no ownership/admin guard → any authenticated user reads any order (IDOR); contradicts documented "view their own orders" contract (C2).
- `orderController.js:104` — `req.body.payer.email_address` dereferenced with no validation; trusts entire client PayPal result and throws raw 500 on malformed input; no validation layer exists (C3).
- `orderController.js:5` / `productController.js:8` — hardcoded business-rule magic numbers, now duplicated frontend↔backend (C3).

**Upload**
- `uploadRoutes.js:37` — `POST /api/upload` mounted with **no `protect, admin`**, contradicting architecture.md §5.2/§5.6 ("admin-only"); only mutating endpoint with zero auth (C2).

**Domain model**
- `userModel.js:34` — pre-save hook missing `return next()`: unmodified passwords get re-hashed (double-hash on name/email-only profile updates). Code contradicts architecture.md §6.1 which claims this is prevented (C3).

**Python MCP / RAG coupling**
- `search-docs/server.py:20` — imports RAG retrieval via `sys.path` injection of `../../rag` rather than a declared dependency; path-fragile cross-package coupling across two separate `.venv`s (C3, acceptable but undocumented).

## Proposed ADRs

- `ADR-006-draft.md` — **`features.json` as a single shared store with an MCP-only write path.** Decision: one file, sole writer is the feature-flags MCP (atomic temp-file + `os.replace`, dependency validation, `last_modified`); Express is read-only; n8n mutates only via the MCP; no direct `Edit`/`Write`/`fs.writeFile`. Captures the consistency model and the missing schema/version field as accepted debt.
- `ADR-007-draft.md` — **Auto-Pilot feature control via a browser → n8n → MCP pipeline.** Decision: document the four-hop call graph, the `/feature-control` JSON contract, and the *intended production topology* (frontend → own Express backend → n8n, key held server-side). Records the M5 browser-key shortcut as time-boxed debt with a defined exit.

## Cross-specialist collaboration

No live mailbox traffic in this run. Hand-offs queued for the other mates:

- **→ security-mate (owns severity on these):**
  - `getOrderById` IDOR — `orderController.js:77` (no object-level authz).
  - `POST /api/upload` unauthenticated file write — `uploadRoutes.js:37`.
  - `GET /api/feature-flags` exposes full flag config unauthenticated — `featureFlagsController.js:15`.
  - n8n API key in the browser bundle — `AutoPilotControls.js:7`.
  - `updateOrderToPaid` trusts unverified client PayPal payload — `orderController.js:104` (also flagged in architecture.md §7.1/§10).
- **→ performance-mate:** no architectural N+1 introduced; existing known items (regex product search, no text index) are documented in architecture.md §10, not re-flagged here.
- **→ docs:** `userModel.js:34` behaviour and the `uploadRoutes.js` auth gate both **contradict** `architecture.md` (§6.1 and §5.2/§5.6 respectively) — the docs describe the intended/safe behaviour, the code diverges. Worth a docs-vs-code reconciliation in Stage 3.

## Status

- ✅ All 5 loaded ADRs cross-referenced against the scope (no direct ADR *violations* found — the gaps are *undocumented decisions*, hence two new ADR drafts).
- ✅ Layer boundaries scanned (controller↔model, component↔API, MCP↔RAG, browser↔n8n).
- ✅ API contract stability checked (no breaking changes to existing REST responses; two contract *gaps* — feature-flags auth, n8n webhook — flagged).
- ✅ Read-only throughout; no source files modified. Outputs written under `homework-m6/stage1-code-review/`.
