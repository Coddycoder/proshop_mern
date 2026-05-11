"""Runs the search_v2 test scenario against the local features.json.

Used once to produce a reference log for report.md. After the MCP server is
loaded into Claude Code via .mcp.json, the assistant should regenerate the
same log by issuing the homework prompt directly — both paths exercise the
same server.py code.
"""

from __future__ import annotations

import json

from server import (
    adjust_traffic_rollout,
    get_feature_info,
    list_features,
    set_feature_state,
)


def show(label: str, args: dict, result: dict) -> None:
    print(f"\n### {label}")
    print(f"args: {json.dumps(args, ensure_ascii=False)}")
    print("result:")
    print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    # Setup: put search_v2 into Disabled so the scenario covers
    # get_feature_info -> set_feature_state -> adjust_traffic_rollout -> get_feature_info.
    print("# Setup: reset search_v2 to Disabled (so the canonical scenario "
          "starts from the documented initial state)")
    setup_args = {"feature_id": "search_v2", "state": "Disabled"}
    setup_result = set_feature_state(**setup_args)
    show("[setup] set_feature_state", setup_args, setup_result)

    print("\n\n# ---- Scenario start ----")

    # 1) Discovery via list_features (optional but recommended tool)
    discovery_result = list_features()
    show(
        "1. list_features (recommended discovery call)",
        {},
        {
            "count": discovery_result["count"],
            "features[search_v2]": next(
                f for f in discovery_result["features"]
                if f["feature_id"] == "search_v2"
            ),
        },
    )

    # 2) get_feature_info — check current state
    args = {"feature_id": "search_v2"}
    show("2. get_feature_info (initial state)", args, get_feature_info(**args))

    # 3) set_feature_state -> Testing
    args = {"feature_id": "search_v2", "state": "Testing"}
    show("3. set_feature_state -> Testing", args, set_feature_state(**args))

    # 4) adjust_traffic_rollout -> 25
    args = {"feature_id": "search_v2", "percentage": 25}
    show("4. adjust_traffic_rollout -> 25", args, adjust_traffic_rollout(**args))

    # 5) get_feature_info — confirm final state
    args = {"feature_id": "search_v2"}
    show("5. get_feature_info (confirmation)", args, get_feature_info(**args))


if __name__ == "__main__":
    main()
