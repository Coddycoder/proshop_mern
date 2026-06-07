"""Shared pytest fixtures for the feature-flags MCP server tests.

The service-under-test reads ``server.FEATURES_PATH`` at call time, so every
test runs against a temporary ``features.json`` written by the ``features_file``
fixture and monkeypatched in. The real ``backend/features.json`` is never
touched.
"""

from __future__ import annotations

import json
import pathlib
import sys
from datetime import date

import pytest

# Make ``import server`` resolve to mcp-servers/feature-flags/server.py
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import server  # noqa: E402  (path mutation must happen first)


# A realistic features.json mirroring the shape of backend/features.json:
#   - search_v2:        Testing, 15% (the canary that everything depends on)
#   - semantic_search:  Disabled, 0%, depends on search_v2 (dependency edge)
#   - dark_mode:        Enabled, 100% (a fully launched flag)
#   - code_splitting:   Testing, 50% (a mid-band canary for rollout tests)
SEED_FEATURES = {
    "search_v2": {
        "name": "New Search Algorithm",
        "description": "Hybrid BM25 + TF-IDF ranking pipeline replacing legacy regex search.",
        "status": "Testing",
        "traffic_percentage": 15,
        "last_modified": "2026-05-11",
        "targeted_segments": ["beta_users", "internal"],
        "rollout_strategy": "canary",
    },
    "semantic_search": {
        "name": "Semantic Vector Search",
        "description": "Embedding-based semantic similarity layered on keyword search; needs search_v2.",
        "status": "Disabled",
        "traffic_percentage": 0,
        "last_modified": "2026-02-14",
        "targeted_segments": ["internal"],
        "rollout_strategy": "canary",
        "dependencies": ["search_v2"],
    },
    "dark_mode": {
        "name": "Dark Mode Theme",
        "description": "Theme toggle in the Header, persisted to localStorage.",
        "status": "Enabled",
        "traffic_percentage": 100,
        "last_modified": "2026-04-20",
        "targeted_segments": ["all"],
        "rollout_strategy": "ab_test",
    },
    "code_splitting_optimisation": {
        "name": "Route-Level Code Splitting",
        "description": "React.lazy + Suspense per route to shrink the initial bundle.",
        "status": "Testing",
        "traffic_percentage": 50,
        "last_modified": "2026-04-18",
        "targeted_segments": ["all"],
        "rollout_strategy": "canary",
    },
}


@pytest.fixture
def features_file(tmp_path, monkeypatch):
    """Write a realistic temp features.json and point the server at it.

    Yields the ``pathlib.Path`` to the temp file so tests can re-read it from
    disk and assert the server actually persisted (or did not persist) changes.
    """
    path = tmp_path / "features.json"
    path.write_text(json.dumps(SEED_FEATURES, indent=2), encoding="utf-8")
    monkeypatch.setattr(server, "FEATURES_PATH", path)
    yield path


@pytest.fixture
def today_iso():
    """Today's ISO date, matching server._today() output for last_modified checks."""
    return date.today().isoformat()
