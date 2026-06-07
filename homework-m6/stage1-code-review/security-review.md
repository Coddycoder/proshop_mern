# Security Mate — Review Summary

**Reviewer:** security-mate (Senior Security Auditor, read-only)
**Scope:** Whole `proshop_mern` fork — backend (Express/Mongoose), frontend (React/Redux), 2 Python MCP servers, Python RAG service, feature-flags layer, env/secret handling.
**Scope size:** ~25 hand-written source files across backend/, frontend/src/, mcp-servers/, rag/ + dependency manifests.
**Method:** Read in-scope files; cross-checked against `CLAUDE.md` and `docs/project-data/adrs/` (ADR-003 pre-approves some JWT tradeoffs); ran `npm audit`; verified `.env` tracking and key entropy without printing secret values.

## Findings

- **HIGH:** 6 issues
- **MEDIUM:** 6 issues
- **LOW:** 7 issues
- **Total:** 19

## Top concerns (HIGH)

1. **backend/controllers/orderController.js:94** — `updateOrderToPaid` trusts fully client-supplied payment data and never verifies the capture with PayPal. A user can POST `{id,status,payer:{email_address}}` to mark any order paid for free. (A04 / A08) — SEC-01
2. **backend/controllers/orderController.js:77** — IDOR: `getOrderById` returns any order by id with no ownership/admin check. Any authenticated user reads other customers' orders, shipping addresses and emails. (A01) — SEC-02
3. **backend/controllers/orderController.js:94** (route `/:id/pay`, `protect`-only) — IDOR: no check that the order belongs to `req.user`; combined with SEC-01 lets one user mark another user's order paid. (A01) — SEC-03
4. **backend/controllers/userController.js:111** — `getUsers` (`User.find({})`) returns bcrypt password hashes and full user docs; missing `.select('-password')`. (A02 / A01) — SEC-04
5. **backend/routes/userRoutes.js:16** — No rate-limiting on `/login` or registration; unlimited credential brute-force. No `express-rate-limit` in the dependency tree. (A07) — SEC-06
6. **backend/controllers/featureFlagsController.js:15** — Feature-flags read API is fully public despite the in-code comment that it is "admin-only"; entire flag config (testing features, traffic %, dependencies) leaks to anonymous users. (A01) — SEC-09
7. **package.json** — `npm audit`: 2 critical + 10 high CVEs. Auth-critical `jsonwebtoken@8`, injection-prone `mongoose@5.10.6`, DoS-prone `multer@1.4.2`, `minimist` (critical), `express@4.17.1`. (A06) — SEC-12

> (7 items listed; SEC-12 is HIGH-severity and grouped here for visibility.)

## MEDIUM

- **SEC-05** `productController.js:12` — NoSQL regex injection / ReDoS: `req.query.keyword` flows unescaped into `$regex` (A03). Also a DoS vector — see Cross-mate note.
- **SEC-07** `userController.js:30` — No server-side password-strength / input validation on register or profile update (A07).
- **SEC-08** `uploadRoutes.js:13` — Upload filename built from user-controlled `originalname`; weak unanchored MIME/ext check; no `limits.fileSize` (A03 / A08).
- **SEC-10** `mcp-servers/feature-flags/server.py:433` — MCP write tools (`set_feature_state`, `adjust_traffic_rollout`) can be exposed over HTTP/SSE on `0.0.0.0` with no auth (docs instruct this for n8n) (A05 / A01).
- **SEC-11** `frontend/src/components/AutoPilotControls.js:7` — n8n API key shipped in the public CRA bundle via `REACT_APP_N8N_API_KEY` and sent as `X-API-Key` from the browser; on-disk `frontend/.env` holds a real 64-hex key (A02). Acknowledged in-code as an M5 simplification.
- **SEC-13** `.env` — `JWT_SECRET` appears to be ~10 chars (weak HMAC secret, offline-brute-forcible → admin-token forgery) (A02). The `.env` file itself is correctly gitignored and NOT tracked.
- **SEC-18** `userController.js:147` — Admin `updateUser` assigns `isAdmin` straight from `req.body` with no validation/audit (A04).

## LOW

- **SEC-14** `authMiddleware.js:33` — JWT 30-day TTL, no server-side revocation. ADR-003 accepts this. Note: `protect()` re-fetches the user from DB, so `isAdmin` is actually fresh — the stale-admin risk is lower than ADR-003 states.
- **SEC-15** `store.js:62` — JWT in `localStorage` (XSS-exfiltratable). Accepted ADR-003 tradeoff. No `dangerouslySetInnerHTML` found in the frontend (good).
- **SEC-16** `authMiddleware.js:21` — Raw error/stack logged on every auth failure; no audit logging of security events (A09).
- **SEC-17** `server.js:25` — No `helmet`, no CORS policy, no JSON body-size limit (A05).
- **SEC-19** `featureFlagsController.js:23` — User-controlled feature name reflected in error message (JSON context, low risk) (A03).

## Notes on what is NOT a finding (avoiding false positives)

- **`.env` and `frontend/.env` are NOT committed.** Only `frontend/.env.example` (placeholder values) is tracked. No secret is in git history. (Initial `git ls-files` glob looked ambiguous; `git ls-files --error-unmatch frontend/.env` confirms it is untracked.)
- **Password hashing uses bcrypt** (`bcryptjs`, cost 10) — acceptable, not flagged. (Minor unrelated bug: the `pre('save')` hook in `userModel.js:35-37` calls `next()` without `return`, so the hash block still runs when the password is unchanged — correctness/perf issue, not security; flagged to other mates.)
- **JWT signature IS verified** (`jwt.verify`, not `decode`) and the secret comes from env — the only crypto weakness is secret length (SEC-13).
- **Python services** (`rag/`, `mcp-servers/`) — no `eval`, no `subprocess(shell=True)`, no SQL string-concat. Atomic file writes in feature-flags are good. The only Python concern is the unauthenticated network transport (SEC-10).

## Cross-mate observations

- **performance-mate:** SEC-05 (unescaped `$regex` on product search) is also a **ReDoS / CPU-exhaustion DoS** vector — a crafted keyword with nested quantifiers can pin a CPU. SEC-08 (no upload size limit) and SEC-17 (no JSON body-size limit) are DoS surfaces too. Several list endpoints (`getUsers`, `getOrders`, `getMyOrders`) have **no pagination** — unbounded result sets are a memory/DoS concern in addition to the SEC-04 data-leak.
- **architecture-mate:** SEC-09 (public feature-flags endpoint) and SEC-10 (unauthenticated network MCP) contradict the documented "admin-only" intent in code/CLAUDE.md — worth an explicit access-control decision. SEC-01/02/03 (order trust model) are an insecure-design pattern, not a one-line bug; the order/payment flow needs a server-authoritative redesign. SEC-14/15 are explicitly recorded as accepted tech debt in **ADR-003** — not new violations.

## Status

- ✅ All OWASP Top 10 (2021) categories scanned
- ✅ Dependency audit completed (`npm audit`: 2 critical / 10 high / 3 moderate / 5 low)
- ✅ Secrets scan completed (`.env` files confirmed untracked; in-bundle frontend key flagged as SEC-11)
- ✅ ADRs read first (ADR-003 JWT tradeoffs honored — downgraded to LOW where pre-approved)
- ✅ Read-only throughout — no source files modified
