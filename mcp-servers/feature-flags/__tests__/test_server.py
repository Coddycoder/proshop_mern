"""Characterization tests for the feature-flags MCP server.

The ``@mcp.tool`` decorator on this FastMCP version does NOT wrap the function,
so ``server.list_features`` / ``get_feature_info`` / ``set_feature_state`` /
``adjust_traffic_rollout`` are plain callables and are invoked directly.

Every test asserts concrete VALUES — error codes, numeric traffic, persisted
file contents — never mere aliveness. Each test stands alone via the
``features_file`` fixture, which monkeypatches ``server.FEATURES_PATH`` to a
fresh temp file (the real backend/features.json is never touched).
"""

from __future__ import annotations

import glob
import json
import os

import server


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_disk(path):
    """Re-read the on-disk features.json so we test persistence, not memory."""
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# list_features
# ---------------------------------------------------------------------------


def test_list_features_reports_count_and_known_flag_summary(features_file):
    result = server.list_features()

    assert result["count"] == 4
    assert len(result["features"]) == 4

    by_id = {f["feature_id"]: f for f in result["features"]}
    search_v2 = by_id["search_v2"]
    assert search_v2["name"] == "New Search Algorithm"
    assert search_v2["status"] == "Testing"
    assert search_v2["traffic_percentage"] == 15
    # A flag with no dependencies key is normalized to an empty list.
    assert search_v2["dependencies"] == []
    # The dependency edge is surfaced in the summary.
    assert by_id["semantic_search"]["dependencies"] == ["search_v2"]


# ---------------------------------------------------------------------------
# get_feature_info
# ---------------------------------------------------------------------------


def test_get_feature_info_returns_full_record_with_resolved_dependency_status(
    features_file,
):
    result = server.get_feature_info("semantic_search")

    assert result["feature_id"] == "semantic_search"
    assert result["status"] == "Disabled"
    assert result["traffic_percentage"] == 0
    assert result["dependencies"] == ["search_v2"]
    assert result["rollout_strategy"] == "canary"
    # dependencies_state must reflect search_v2's real current status (Testing).
    assert result["dependencies_state"] == [
        {"feature_id": "search_v2", "status": "Testing"}
    ]


def test_get_feature_info_unknown_id_returns_feature_not_found_and_echoes_id(
    features_file,
):
    before = _read_disk(features_file)

    result = server.get_feature_info("does_not_exist")

    assert result["error"] == "FEATURE_NOT_FOUND"
    assert result["feature_id"] == "does_not_exist"
    # A pure read of a bogus id must not mutate the file.
    assert _read_disk(features_file) == before


# ---------------------------------------------------------------------------
# set_feature_state
# ---------------------------------------------------------------------------


def test_set_feature_state_disabled_forces_traffic_zero_and_persists(
    features_file, today_iso
):
    # dark_mode starts Enabled at 100%; disabling must drive traffic to 0.
    result = server.set_feature_state("dark_mode", "Disabled")

    assert result["status"] == "Disabled"
    assert result["traffic_percentage"] == 0
    assert result["last_modified"] == today_iso

    on_disk = _read_disk(features_file)["dark_mode"]
    assert on_disk["status"] == "Disabled"
    assert on_disk["traffic_percentage"] == 0
    assert on_disk["last_modified"] == today_iso


def test_set_feature_state_enabled_blocked_by_disabled_dependency_leaves_file_unchanged(
    features_file,
):
    # semantic_search depends on search_v2 which is only Testing... but to hit
    # DEPENDENCY_DISABLED we first force the dependency Disabled.
    server.set_feature_state("search_v2", "Disabled")
    snapshot = _read_disk(features_file)

    result = server.set_feature_state("semantic_search", "Enabled")

    assert result["error"] == "DEPENDENCY_DISABLED"
    assert result["feature_id"] == "semantic_search"
    assert result["blocking_dependencies"] == ["search_v2"]
    # The blocked target must NOT have been written.
    after = _read_disk(features_file)
    assert after["semantic_search"] == snapshot["semantic_search"]
    assert after["semantic_search"]["status"] == "Disabled"


def test_set_feature_state_enabled_with_testing_dependency_succeeds_with_warning(
    features_file,
):
    # semantic_search depends on search_v2, which is Testing (not Enabled): the
    # enable should succeed at 100% but carry a soft warning naming the dep.
    result = server.set_feature_state("semantic_search", "Enabled")

    assert result["status"] == "Enabled"
    assert result["traffic_percentage"] == 100
    assert any("search_v2" in w for w in result["warnings"])
    assert _read_disk(features_file)["semantic_search"]["status"] == "Enabled"


def test_set_feature_state_testing_resets_zero_traffic_to_canary_ten(features_file):
    # semantic_search is Disabled at 0%; moving to Testing should reset to 10.
    result = server.set_feature_state("semantic_search", "Testing")

    assert result["status"] == "Testing"
    assert result["traffic_percentage"] == 10
    assert _read_disk(features_file)["semantic_search"]["traffic_percentage"] == 10


def test_set_feature_state_testing_preserves_in_band_traffic(features_file):
    # code_splitting_optimisation is already Testing at 50% (in 1..99 band):
    # re-asserting Testing must preserve the existing canary percentage.
    result = server.set_feature_state("code_splitting_optimisation", "Testing")

    assert result["status"] == "Testing"
    assert result["traffic_percentage"] == 50
    assert (
        _read_disk(features_file)["code_splitting_optimisation"]["traffic_percentage"]
        == 50
    )


def test_set_feature_state_rejects_lowercase_state_case_sensitively(features_file):
    before = _read_disk(features_file)

    result = server.set_feature_state("search_v2", "enabled")

    assert result["error"] == "INVALID_STATE"
    assert result["feature_id"] == "search_v2"
    # Invalid input must not write anything.
    assert _read_disk(features_file) == before


# ---------------------------------------------------------------------------
# adjust_traffic_rollout
# ---------------------------------------------------------------------------


def test_adjust_traffic_rollout_sets_mid_value_with_null_hint(features_file, today_iso):
    # search_v2 is Testing; ramping to a mid value writes it with no hint.
    result = server.adjust_traffic_rollout("search_v2", 40)

    assert result["status"] == "Testing"
    assert result["traffic_percentage"] == 40
    assert result["hint"] is None
    assert result["last_modified"] == today_iso
    assert _read_disk(features_file)["search_v2"]["traffic_percentage"] == 40


def test_adjust_traffic_rollout_rail_values_emit_nudge_hint(features_file):
    zero = server.adjust_traffic_rollout("search_v2", 0)
    assert zero["traffic_percentage"] == 0
    assert zero["hint"] is not None
    assert "set_feature_state" in zero["hint"]

    hundred = server.adjust_traffic_rollout("search_v2", 100)
    assert hundred["traffic_percentage"] == 100
    assert hundred["hint"] is not None
    assert "set_feature_state" in hundred["hint"]


def test_adjust_traffic_rollout_rejected_on_non_testing_flag(features_file):
    # dark_mode is Enabled, not Testing -> rollout tool must refuse and not write.
    before = _read_disk(features_file)

    result = server.adjust_traffic_rollout("dark_mode", 50)

    assert result["error"] == "WRONG_STATUS_FOR_ROLLOUT"
    assert result["feature_id"] == "dark_mode"
    assert _read_disk(features_file) == before


def test_adjust_traffic_rollout_rejects_out_of_range_and_boolean(features_file):
    before = _read_disk(features_file)

    too_high = server.adjust_traffic_rollout("search_v2", 150)
    assert too_high["error"] == "INVALID_PERCENTAGE"

    # True is an int subclass but must be explicitly rejected.
    boolean = server.adjust_traffic_rollout("search_v2", True)
    assert boolean["error"] == "INVALID_PERCENTAGE"

    # Neither invalid call may have mutated the file.
    assert _read_disk(features_file) == before


# ---------------------------------------------------------------------------
# Atomic-write integrity
# ---------------------------------------------------------------------------


def test_successful_write_leaves_no_temp_file_and_valid_json(features_file):
    server.set_feature_state("search_v2", "Disabled")

    # The atomic write writes ".features.*.tmp" then os.replace's it away.
    leftover = glob.glob(os.path.join(str(features_file.parent), ".features.*.tmp"))
    assert leftover == []

    # The destination is intact, valid JSON, and reflects the mutation.
    parsed = _read_disk(features_file)
    assert parsed["search_v2"]["status"] == "Disabled"
    assert parsed["search_v2"]["traffic_percentage"] == 0
    # Untouched flags are preserved intact by the read-modify-write cycle.
    assert parsed["dark_mode"]["status"] == "Enabled"
