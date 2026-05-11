"""Feature Flags MCP server for proshop_mern.

Reads and mutates backend/features.json. All writes are atomic (write to temp
file then os.replace) so concurrent reads from the backend never see a partial
file.
"""

from __future__ import annotations

import json
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

from fastmcp import FastMCP

VALID_STATES = ("Disabled", "Testing", "Enabled")

DEFAULT_FEATURES_PATH = (
    Path(__file__).resolve().parent.parent.parent / "backend" / "features.json"
)
FEATURES_PATH = Path(
    os.environ.get("PROSHOP_FEATURES_PATH", str(DEFAULT_FEATURES_PATH))
).resolve()


mcp = FastMCP("proshop-feature-flags")


def _read_features() -> dict[str, Any]:
    if not FEATURES_PATH.exists():
        raise FileNotFoundError(
            f"features.json not found at {FEATURES_PATH}. "
            "Set PROSHOP_FEATURES_PATH env var or place the file next to backend/."
        )
    with FEATURES_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _write_features(features: dict[str, Any]) -> None:
    FEATURES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=str(FEATURES_PATH.parent),
        prefix=".features.",
        suffix=".tmp",
        delete=False,
    ) as tmp:
        json.dump(features, tmp, indent=2, ensure_ascii=False)
        tmp.write("\n")
        tmp_path = Path(tmp.name)
    os.replace(tmp_path, FEATURES_PATH)


def _today() -> str:
    return date.today().isoformat()


def _dependency_statuses(
    features: dict[str, Any], feature_id: str
) -> list[dict[str, str]]:
    feature = features[feature_id]
    dep_ids: list[str] = feature.get("dependencies", []) or []
    out: list[dict[str, str]] = []
    for dep_id in dep_ids:
        dep = features.get(dep_id)
        out.append(
            {
                "feature_id": dep_id,
                "status": dep["status"] if dep else "MISSING",
            }
        )
    return out


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


@mcp.tool
def list_features() -> dict[str, Any]:
    """Return a compact summary of every feature flag.

    WHEN TO USE:
      - User asks for an overview: "what flags are there?", "show all features",
        "list features in Testing", "which flags depend on search_v2?".
      - You need to discover available feature_id values before calling other
        tools. ALWAYS prefer this over grep'ing backend/features.json.

    WHEN NOT TO USE:
      - User asks about a single specific feature -> use get_feature_info.
      - You need full description / targeted_segments / rollout_strategy ->
        get_feature_info returns the complete record.

    Returns: {"count": int, "features": [{feature_id, name, status,
              traffic_percentage, dependencies}]}

    Example:
      list_features() ->
        {"count": 25, "features": [
          {"feature_id": "search_v2", "name": "New Search Algorithm",
           "status": "Testing", "traffic_percentage": 15, "dependencies": []},
          ...
        ]}
    """
    features = _read_features()
    summaries = []
    for fid, f in features.items():
        summaries.append(
            {
                "feature_id": fid,
                "name": f.get("name"),
                "status": f.get("status"),
                "traffic_percentage": f.get("traffic_percentage"),
                "dependencies": f.get("dependencies", []) or [],
            }
        )
    return {"count": len(summaries), "features": summaries}


@mcp.tool
def get_feature_info(feature_id: str) -> dict[str, Any]:
    """Return the complete current state of a single feature flag.

    WHEN TO USE:
      - User asks about ONE specific feature: "what is the status of dark_mode?",
        "show the search_v2 config", "is gift_message enabled?".
      - Before mutating a flag with set_feature_state or
        adjust_traffic_rollout, call this first to confirm the current state
        and inspect dependencies.

    WHEN NOT TO USE:
      - User asks for an overview / multiple features -> list_features.
      - You only need to mutate state and do not care about the previous value.

    Args:
      feature_id: snake_case key from features.json, e.g. "search_v2".

    Returns the full feature object plus a "dependencies_state" array with
    each dependency's current status. On unknown feature_id returns
    {"error": "FEATURE_NOT_FOUND", ...}.

    Example:
      get_feature_info("semantic_search") ->
        {"feature_id": "semantic_search", "name": "Semantic Vector Search",
         "status": "Disabled", "traffic_percentage": 0,
         "last_modified": "2026-02-14", "dependencies": ["search_v2"],
         "dependencies_state": [{"feature_id": "search_v2",
                                  "status": "Testing"}], ...}
    """
    features = _read_features()
    if feature_id not in features:
        return {
            "error": "FEATURE_NOT_FOUND",
            "message": f"No feature with ID '{feature_id}' exists in features.json.",
            "feature_id": feature_id,
        }
    feature = features[feature_id]
    return {
        "feature_id": feature_id,
        **feature,
        "dependencies_state": _dependency_statuses(features, feature_id),
    }


@mcp.tool
def set_feature_state(feature_id: str, state: str) -> dict[str, Any]:
    """Change the status of a feature flag. Atomically updates features.json.

    WHEN TO USE:
      - User wants to flip a flag on / off / into testing: "disable
        stripe_alternative", "promote dark_mode to enabled", "put
        search_v2 in Testing".
      - You MUST use this instead of editing backend/features.json with
        Edit/Write.

    WHEN NOT TO USE:
      - User wants to change ONLY the traffic percent of an already-Testing
        flag -> use adjust_traffic_rollout.
      - You just want to read the state -> get_feature_info.

    State transitions performed for you:
      - "Disabled" -> traffic_percentage = 0.
      - "Enabled"  -> traffic_percentage = 100. BLOCKED if any dependency
                      currently has status "Disabled" (returns error
                      DEPENDENCY_DISABLED). Promote the dependency first.
      - "Testing"  -> traffic_percentage stays if currently in 1..99, otherwise
                      reset to 10 as a safe canary starting point.

    A warnings[] array is included whenever the new state is Testing or
    Enabled and any dependency is not yet Enabled.

    Args:
      feature_id: snake_case key from features.json.
      state:      EXACTLY one of "Disabled", "Testing", "Enabled" (case-sensitive).
                  You MUST pass the value with this exact capitalization.

    Examples:
      set_feature_state("search_v2", "Testing")
        -> {"feature_id": "search_v2", "status": "Testing",
            "traffic_percentage": 15, "last_modified": "<today>", "warnings": []}

      set_feature_state("semantic_search", "Enabled")  # search_v2 still Disabled
        -> {"error": "DEPENDENCY_DISABLED",
            "message": "Cannot Enable semantic_search: dependency 'search_v2'
                        is Disabled. Enable search_v2 first.",
            "blocking_dependencies": ["search_v2"]}
    """
    if state not in VALID_STATES:
        return {
            "error": "INVALID_STATE",
            "message": (
                f"State '{state}' is not valid. Must be one of: "
                f"{', '.join(VALID_STATES)} (case-sensitive)."
            ),
            "feature_id": feature_id,
        }

    features = _read_features()
    if feature_id not in features:
        return {
            "error": "FEATURE_NOT_FOUND",
            "message": f"No feature with ID '{feature_id}' exists in features.json.",
            "feature_id": feature_id,
        }

    feature = features[feature_id]
    dep_ids: list[str] = feature.get("dependencies", []) or []
    dep_states = {d: features[d]["status"] for d in dep_ids if d in features}

    warnings: list[str] = []

    if state == "Enabled":
        blocking = [d for d, s in dep_states.items() if s == "Disabled"]
        if blocking:
            return {
                "error": "DEPENDENCY_DISABLED",
                "message": (
                    f"Cannot Enable '{feature_id}': dependency "
                    f"{blocking[0] if len(blocking) == 1 else blocking} "
                    "is Disabled. Enable the dependency first via "
                    "set_feature_state."
                ),
                "feature_id": feature_id,
                "blocking_dependencies": blocking,
            }
        feature["traffic_percentage"] = 100
        for d, s in dep_states.items():
            if s != "Enabled":
                warnings.append(
                    f"Dependency '{d}' is in status '{s}', not 'Enabled'. "
                    f"{feature_id} may not function correctly."
                )
    elif state == "Disabled":
        feature["traffic_percentage"] = 0
    else:  # Testing
        current_traffic = feature.get("traffic_percentage", 0)
        if not (isinstance(current_traffic, int) and 1 <= current_traffic <= 99):
            feature["traffic_percentage"] = 10
        for d, s in dep_states.items():
            if s != "Enabled":
                warnings.append(
                    f"Dependency '{d}' is in status '{s}', not 'Enabled'. "
                    f"{feature_id} may not function correctly."
                )

    feature["status"] = state
    feature["last_modified"] = _today()
    features[feature_id] = feature
    _write_features(features)

    return {
        "feature_id": feature_id,
        **feature,
        "dependencies_state": _dependency_statuses(features, feature_id),
        "warnings": warnings,
    }


@mcp.tool
def adjust_traffic_rollout(feature_id: str, percentage: int) -> dict[str, Any]:
    """Change traffic_percentage for a feature currently in 'Testing' status.

    Use this to ramp a canary up or down (5% -> 25% -> 50% -> 100%) without
    flipping the overall state.

    WHEN TO USE:
      - "expand search_v2 to 50%", "ramp dark_mode to 25%", "dial
        cart_redesign back to 5%".

    WHEN NOT TO USE:
      - Feature is currently Disabled or Enabled -> call set_feature_state
        first to move it to Testing. You MUST NOT use this tool to "turn on"
        a Disabled flag.
      - You want to fully launch / kill the flag -> set_feature_state with
        "Enabled" / "Disabled".

    Validation:
      - percentage must be an INTEGER in [0, 100].
      - feature status MUST be exactly "Testing". Otherwise returns
        WRONG_STATUS_FOR_ROLLOUT.
      - traffic_percentage = 0 or 100 returns a "hint" suggesting the caller
        switch state via set_feature_state instead of parking the flag at a
        rail value while still nominally Testing.

    Args:
      feature_id: snake_case key from features.json.
      percentage: integer 0..100 inclusive.

    Examples:
      adjust_traffic_rollout("search_v2", 25)
        -> {"feature_id": "search_v2", "status": "Testing",
            "traffic_percentage": 25, "last_modified": "<today>", "hint": null}

      adjust_traffic_rollout("paypal_express_buttons", 50)  # currently Enabled
        -> {"error": "WRONG_STATUS_FOR_ROLLOUT",
            "message": "paypal_express_buttons is 'Enabled'. Use
                        set_feature_state to change status first."}
    """
    if not isinstance(percentage, int) or isinstance(percentage, bool):
        return {
            "error": "INVALID_PERCENTAGE",
            "message": "percentage must be an integer (no decimals, no booleans).",
            "feature_id": feature_id,
        }
    if percentage < 0 or percentage > 100:
        return {
            "error": "INVALID_PERCENTAGE",
            "message": f"percentage {percentage} is outside the allowed range 0..100.",
            "feature_id": feature_id,
        }

    features = _read_features()
    if feature_id not in features:
        return {
            "error": "FEATURE_NOT_FOUND",
            "message": f"No feature with ID '{feature_id}' exists in features.json.",
            "feature_id": feature_id,
        }

    feature = features[feature_id]
    if feature.get("status") != "Testing":
        return {
            "error": "WRONG_STATUS_FOR_ROLLOUT",
            "message": (
                f"adjust_traffic_rollout requires status 'Testing'. "
                f"'{feature_id}' is currently '{feature.get('status')}'. "
                "Use set_feature_state to change status first."
            ),
            "feature_id": feature_id,
        }

    feature["traffic_percentage"] = percentage
    feature["last_modified"] = _today()
    features[feature_id] = feature
    _write_features(features)

    hint = None
    if percentage == 0:
        hint = (
            "traffic_percentage is 0 but status is still 'Testing'. "
            "Consider set_feature_state('Disabled') to make intent explicit."
        )
    elif percentage == 100:
        hint = (
            "traffic_percentage is 100 but status is still 'Testing'. "
            "Consider set_feature_state('Enabled') to lock in the launch."
        )

    return {
        "feature_id": feature_id,
        **feature,
        "hint": hint,
    }


if __name__ == "__main__":
    mcp.run()
