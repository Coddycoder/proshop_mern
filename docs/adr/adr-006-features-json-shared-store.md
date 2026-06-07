# ADR-006: `backend/features.json` as a Single Shared Store with an MCP-Only Write Path

**Status:** Proposed (drafted by architecture-mate during whole-repo audit)
**Date:** 2026-06-07
**Deciders:** TBD (PR author + tech lead)

## Context

The feature-flag layer added in M3–M5 turned `backend/features.json` into the
shared source of truth for **three independent runtimes**:

1. **Express read-path** — `backend/controllers/featureFlagsController.js`
   reads the file with `fs.readFile` and exposes it at
   `GET /api/feature-flags` and `GET /api/feature-flags/:name`. Consumed by the
   React `FeatureDashboardScreen`.
2. **Python MCP write-path** — `mcp-servers/feature-flags/server.py` reads and
   **mutates** the file. Writes are atomic (`tempfile.NamedTemporaryFile` +
   `os.replace`), validate dependencies before promoting a flag to `Enabled`,
   and stamp `last_modified`.
3. **n8n Auto-Pilot** — turns the MCP knobs (item 2) on behalf of the dashboard.

The project rule (currently only in `CLAUDE.md`, not in any ADR) is:
**`features.json` must be mutated ONLY through the feature-flags MCP** — never
via direct `Edit`/`Write`/`fs.writeFile` — because manual edits bypass the
atomic write, the dependency validation, and the `last_modified` field, and
desync the Dashboard.

There is no database, no lock manager, and no schema/version field. The forces:
keep the demo dependency-light (no extra DB), guarantee the Express reader never
sees a torn file, and keep a single validated mutation choke-point.

## Decision

1. `backend/features.json` is the **single store** for feature-flag state. No
   second copy, no DB mirror.
2. The **only writer** is the feature-flags MCP (`set_feature_state`,
   `adjust_traffic_rollout`). All writes are atomic via temp-file + `os.replace`,
   which makes torn reads impossible for the Express reader.
3. The Express backend is a **read-only** consumer (`fs.readFile` + `JSON.parse`).
   It must never write the file.
4. n8n mutates state **only** by calling the MCP, never by writing the file
   directly.
5. Direct `Edit`/`Write`/`fs.writeFile` to the file by humans or agents is
   prohibited (already stated in `CLAUDE.md`; this ADR makes it an architectural
   contract).

## Consequences

### Positive
- Single validated mutation choke-point: dependency rules and `last_modified`
  cannot be bypassed.
- Atomic `os.replace` means the Express reader never observes a partial write —
  no lock coordination needed across the Node and Python processes.
- Zero extra infrastructure (no Redis/DB) for a learning-grade flag system.

### Negative / trade-offs
- A flat JSON file is not a real flag service: no audit log, no per-environment
  values, no concurrent multi-writer safety beyond last-write-wins.
- Two languages (Node read, Python write) share an on-disk contract with **no
  enforced schema and no `version` field** — a shape change must be coordinated
  by hand across `featureFlagsController.js`, `server.py`, and the dashboard.
- The read-path can drift from the MCP's view if anyone edits the file directly
  (the very thing this ADR forbids).

### Risks
- A future contributor adds a second writer (e.g. an Express admin mutation
  endpoint) and silently breaks the invariant. This ADR is the guardrail.
- No JSON schema means a malformed manual edit is only caught at read time.

## Alternatives considered
- **Store flags in MongoDB** (a `featureflags` collection): real atomicity,
  audit trail, queryable. Rejected for the exercise — adds a model/migration and
  loses the "MCP owns the file" teaching point. The right move if this ever goes
  beyond a demo.
- **Let the Express backend also write the file** (admin REST mutation): would
  duplicate the dependency-validation logic in JS and create two writers —
  exactly the desync this ADR prevents.
- **Add a JSON Schema + `version` field** to the file: low-cost hardening that
  could be adopted within this decision; recommended as a follow-up rather than
  a blocker.
