# Stage 4 — Tests Agent

Used the dedicated **`test-writer-mate`** (write-only agent; never touches production code, never runs mutation analysis) to generate tests for **2 services** from my M3–M5 code, driven by their Stage 3 reverse-engineering specs.

## Services covered

| # | Service | Source | Spec (Stage 3) | Tests | Coverage | Result |
|---|---|---|---|---|---|---|
| 1 | feature-flags MCP | `mcp-servers/feature-flags/server.py` | [`feature-flags-mcp-spec.md`](../stage3-living-docs/docs-new/specs/feature-flags-mcp-spec.md) | 14 | **89%** | ✅ all pass |
| 2 | RAG retrieval | `rag/query.py` | [`rag-pipeline-spec.md`](../stage3-living-docs/docs-new/specs/rag-pipeline-spec.md) | 17 | **75%** | ✅ all pass |

**Total: 31 tests, 0 failures.** Full run output: [`coverage-report.txt`](coverage-report.txt).

## Where the tests live

- Service 1 (submission copy): [`service-1-tests/`](service-1-tests/) ← `mcp-servers/feature-flags/__tests__/`
- Service 2 (submission copy): [`service-2-tests/`](service-2-tests/) ← `rag/__tests__/`
- Agent definition: [`test-writer-mate.md`](test-writer-mate.md) ← `.claude/agents/test-writer-mate.md`

## How to run

```bash
# Service 1 — feature-flags MCP
cd mcp-servers/feature-flags && uv run --with pytest pytest __tests__/ -v

# Service 2 — RAG retrieval
cd rag && uv run --with pytest pytest __tests__/ -v
```

Each service runs in its own `uv` venv. There was no pre-existing test suite in either service, so the agent established a `__tests__/test_*.py` + `conftest.py` convention (matching the homework's suggested layout) and kept it consistent across both.

## Test design (strong, not coverage-padding)

- **Value assertions, not aliveness** — e.g. `assert result["traffic_percentage"] == 100` / `len(snippet) == 243`, never `assert x is not None`.
- **4 types per unit**: happy path, edge cases, error paths, and integrity/security checks (atomic-write leaves no temp file + valid JSON; case-sensitive state rejection; out-of-range/boolean percentage rejection).
- **No real I/O**: feature-flags tests monkeypatch `server.FEATURES_PATH` to a temp `features.json` (the real `backend/features.json` is never touched); RAG tests replace `query.get_model` / `query.QdrantClient` / `query.SentenceTransformer` with recording fakes — no model download, no live Qdrant.
- **Persistence verified**: mutating-tool tests re-read the temp file from disk to confirm the write actually happened (or did NOT happen on the error paths).
- **Spec-driven inventory**: each test maps to an Edge Case / Suggested Characterization Test from the Stage 3 spec.

## Coverage notes (no failing tests)

- `server.py` **89%** — uncovered lines are the `argparse` CLI `main()` / transport branches (lines 410–433) and the `/health` HTTP route, not the tool logic. All four MCP tools + helpers are exercised.
- `query.py` **75%** — uncovered lines are the CLI `main()` / `__main__` block (101–122). The whole retrieval surface (`search`, `format_result`, `get_model` caching) is covered.

These entrypoints are thin argparse/transport wrappers (per `test-writer-mate`'s "don't test framework boilerplate" rule), so they're intentionally not unit-tested.

> No failing tests to explain. Every test passes on the current code.
> (`coverage-report.png` would be a screenshot of the same run — `coverage-report.txt` is the captured terminal output, since this run was headless.)
