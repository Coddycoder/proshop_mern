# Performance Mate — Review Summary

**Reviewer:** performance-mate (Senior Performance Engineer, READ-ONLY)
**Scope:** whole `proshop_mern` fork — backend (Express/Mongoose), frontend (CRA + classic Redux), 2 Python MCP servers, Python RAG service
**Scope size:** ~995 LOC backend + ~847 LOC Python (MCP + RAG) + frontend `src/` (screens, components, reducers, actions, store)
**Hot paths reviewed:** `/api/orders` (admin + myorders), `/api/products` (list + search), `/api/feature-flags`, RAG `search()` (behind `search_project_docs` MCP), feature-flags MCP read/write of `backend/features.json`

SLO note: no explicit SLO targets found in `CLAUDE.md` or `docs/project-data/runbooks/`. Severity graded on the role file's defaults (HIGH = event-loop block / unbounded growth / >100ms regression).

---

## Findings

- **HIGH:** 3 issues (RAG per-call Qdrant client, RAG model cold-start on request path, `/api/orders` unbounded no-pagination response)
- **MEDIUM:** 3 issues (missing `Order.user` index, unindexed product `$regex` search = full scan, uncached `features.json` read+parse per request)
- **LOW:** 3 issues (sync file I/O in feature-flags MCP HTTP transport, FeatureDashboard memo dep hazard, `getUsers` unbounded + password hashes)
- **CLEAN:** N+1 in Express controllers (orders use `$in` batch lookup, not a loop); no `fs.readFileSync`/sync HTTP in Express handlers.

---

## Top concerns (HIGH)

1. **`rag/query.py:52`** — `QdrantClient(url=...)` is constructed inside `search()`, so every `search_project_docs` MCP call builds a fresh HTTP client + connection while the model is correctly cached. Estimated **+10–30ms p50 per query** plus connection churn under load. Fix: module-level lazy `_CLIENT` singleton, mirroring `_MODEL`.
2. **`rag/query.py:28`** — BGE-M3 is lazy-loaded on first request via `get_model()`. The first search after process start blocks the single-threaded Python server for the **full model load (~2–8s CPU / ~1–3s MPS-CUDA, plus first-run download)**. Fix: warm `get_model()` at server boot in `search-docs/server.py` `__main__` before `mcp.run()`.
3. **`backend/controllers/orderController.js:147`** — `getOrders` does `Order.find({}).populate('user',...)` with no pagination, loading every order (with embedded `orderItems`) into memory and `JSON.stringify`-ing it on the event loop. At 10k orders ≈ **~20MB response built synchronously**, growing unbounded with order volume. Fix: paginate like `getProducts`.

---

## Medium

4. **`backend/models/orderModel.js:5`** — no index on `Order.user`, yet `getMyOrders` queries `Order.find({ user })`. Full collection scan; at 100k orders **+200–800ms per call** (vs ~1–5ms indexed). Invisible in the small dev DB — production-only. Fix: `orderSchema.index({ user: 1, createdAt: -1 })`.
5. **`backend/controllers/productController.js:12`** — keyword search uses an unanchored case-insensitive `$regex`, which **cannot use a btree index**, so both `countDocuments` and `find` are full scans (work done twice). At 50k products **~150–500ms per search**. Cross-mate: unanchored user regex is also a **ReDoS / scan-amplification** vector. Fix: MongoDB text index + `$text`, or anchor+escape with a collation index, and collapse count+page into one pipeline.
6. **`backend/controllers/featureFlagsController.js:7`** — `features.json` (14KB) is read from disk and `JSON.parse`d on **every** `GET /api/feature-flags` (dashboard initial load + every Refresh + after each Auto-Pilot mutation). Async read avoids blocking, but ~0.5–1ms parse + a syscall per request, scaling with file/traffic growth. Fix: cache in module scope, invalidate via `fs.watch` (MCP writes atomically via `os.replace`, so the watch fires reliably).

---

## Low

7. **`mcp-servers/feature-flags/server.py:48`** — synchronous `_read_features`/`_write_features`. Fine over stdio (one request at a time); under the supported `--transport http/sse` for n8n, concurrent callers serialize on these blocking calls. Atomic `os.replace` write itself is correct. Fix: offload to a thread if the HTTP transport is used in prod, or document single-writer.
8. **`frontend/src/screens/FeatureDashboardScreen.js:322`** — `filtered`/`counts` `useMemo`s read `statusOverrides` through the `getStatus`/`getTraffic` closures with a hand-patched dep array + `eslint-disable`. Correct today (≤25 flags, override is listed) but the disable removes the guardrail against a future stale-memo bug. No measurable cost at current scale. Fix: inline the override lookup inside the memo so the dependency is explicit.
9. **`backend/controllers/userController.js:110`** — `getUsers` returns the full users collection, unbounded and **including password hashes** (no `.select('-password')`). Same unbounded-array class as `getOrders`. Cross-mate: password-hash exposure → security-mate. Fix: paginate + `.select('-password')`.

---

## Total estimated impact

- **API latency (RAG search path):** +10–30ms p50 steady-state (per-call client), plus a one-time **2–8s freeze** on first query after restart (model cold start).
- **API latency (Mongo, production scale):** +200–800ms on `/api/orders/myorders` and +150–500ms on product keyword search once collections grow past ~50–100k docs (both index-fixable to single-digit ms).
- **Memory / payload:** `/api/orders` and `/api/users` responses grow unbounded with data volume (~20MB at 10k orders) and are serialized synchronously on the event loop — the dominant production risk.
- **Frontend bundle:** no bloat flagged — deps are lean (no `moment`/full-`lodash`/`chart.js`); React 16 + react-bootstrap is appropriate for a legacy fork. No code-splitting recommended (cold path, small app).

## Cross-mate observations

- **security-mate:** (a) unanchored user-supplied `$regex` in product search (`productController.js:12`) — ReDoS + scan amplification; (b) `getUsers` (`userController.js:110`) ships password hashes in the response; (c) unbounded `getOrders`/`getUsers` are DoS amplifiers if an admin token leaks.
- **architecture-mate:** the repeated unbounded-`find({})`-no-pagination pattern (orders, users) and the missing-index gap suggest there is no shared list/query helper — list endpoints each re-implement (or skip) paging ad hoc.

## Status

- ✅ N+1 scan complete (Express controllers clean — orders use `$in` batch, not a loop)
- ✅ Blocking I/O scan complete (Express clean; RAG model cold-start + MCP sync I/O flagged)
- ✅ Pagination / unbounded-growth scan complete (orders, users flagged)
- ✅ Index / query-plan review complete (no model indexes declared; regex-scan flagged)
- ✅ Caching opportunities identified (features.json read, RAG client)
- ✅ Bundle / asset review complete (no bloat — lean deps)
- ✅ Frontend render review complete (keys present, memo dep hazard noted)
