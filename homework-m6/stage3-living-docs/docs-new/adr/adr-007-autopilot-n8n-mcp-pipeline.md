# ADR-007: Auto-Pilot Feature Control via a Browser → n8n → MCP Pipeline

**Status:** Proposed (drafted by architecture-mate during whole-repo audit)
**Date:** 2026-06-07
**Deciders:** TBD (PR author + tech lead)

## Context

M5 added "Auto-Pilot" to the Feature Dashboard. A new control surface
(`frontend/src/components/AutoPilotControls.js`) lets an admin ask an AI agent
to flip a flag instead of doing it by hand. The call graph introduced is:

```
React component (AutoPilotControls)
  --HTTP POST {feature_id, action, ...}-->  n8n webhook  /feature-control
      --> n8n AI Agent decides -->  feature-flags MCP  (set_feature_state / adjust_traffic_rollout)
          --> writes backend/features.json (atomic)
React component  <--JSON verdict {success, message, current_state}-- n8n
  --> onUpdated()  -->  GET /api/feature-flags  (re-read source of truth)
```

Two architecturally significant properties are currently **undocumented**:

1. The React SPA calls the **n8n webhook directly from the browser**
   (`fetch(`${N8N_URL}/feature-control`)`), bypassing the Express backend. n8n
   becomes a *third* backend the frontend talks to, alongside the Express API
   and PayPal.
2. The n8n credential is shipped to the browser via a build-time env var
   (`REACT_APP_N8N_API_KEY`). The component author already flagged this as a
   simplification: *"For M5 the key lives on the frontend… in production the
   frontend would call its own backend, which holds the n8n key."*

There is also no written contract for the `/feature-control` request/response
JSON (`action ∈ {check, test, rollback, rollout}`, optional `target_state` /
`traffic_percentage`; response `{success, message, current_state}`).

## Decision

1. Document the Auto-Pilot integration as a first-class external boundary:
   browser → n8n webhook → AI agent → feature-flags MCP → `features.json`,
   followed by a dashboard re-read of `GET /api/feature-flags`.
2. Record the `/feature-control` request/response JSON contract so both the
   React component and the n8n workflow have a single reference.
3. Record the **intended production topology**: the frontend calls *its own
   Express backend*, which holds the n8n credential and proxies to n8n. The
   current direct-from-browser call with `REACT_APP_N8N_API_KEY` is an
   accepted M5 learning shortcut, **not** the target design.

## Consequences

### Positive
- The cross-process pipeline (SPA / n8n / MCP / file) is captured in one place
  instead of being implicit in component code.
- A written `/feature-control` contract decouples the React component from the
  n8n workflow internals and prevents silent drift.
- Naming the "browser → own backend → n8n" target topology stops the M5
  shortcut from calcifying into the permanent design.

### Negative / trade-offs
- Direct browser→n8n coupling makes the SPA depend on a webhook contract that
  lives outside the repo's Express API and has no shared TypeScript/JSON-schema
  type.
- A flag mutation now traverses four hops (browser, n8n, AI agent, MCP); failure
  modes (n8n down, agent error, MCP error) all surface as one opaque
  `result.message` string.

### Risks
- **Credential exposure:** `REACT_APP_N8N_API_KEY` is baked into the static JS
  bundle and readable by anyone — security-mate owns severity; this ADR records
  it as known, time-boxed debt with a defined exit (move the key behind Express).
- An unauthenticated party who learns the webhook URL can drive flag changes if
  n8n does not independently authenticate.

## Alternatives considered
- **Proxy through Express** (`POST /api/feature-flags/autopilot` → Express →
  n8n with the key server-side): removes the browser credential and keeps the
  SPA talking only to its own API. This is the recommended production design and
  is named as the target above; deferred for M5 to keep the workflow demo simple.
- **Call the MCP directly from the backend** (skip n8n): loses the agentic /
  workflow demonstration that is the whole point of M5.
- **Leave it undocumented:** rejected — the call graph and the credential
  trade-off are exactly the kind of decision an ADR exists to capture.
