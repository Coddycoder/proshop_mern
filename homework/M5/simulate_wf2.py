#!/usr/bin/env python3
"""
simulate_wf2.py — log generator with a sine-wave error rate.

Appends success/error events to logs.json. error_rate(t) follows a sine wave so
the WF2 cron workflow sees it cross the threshold up and back down — the feature
auto-deactivates, then re-enables, then deactivates again (full toggle cycle).

    error_rate(t) = clamp(baseline + amplitude * sin(2π·t/period), 0, 1)

With the defaults (baseline 5%, amplitude 10%, period 300s):
  - trough  -> error_rate ~ 0%   (feature healthy)
  - peak    -> error_rate ~ 15%  (critical)
  - WF2 threshold = 5% -> crossed up/down roughly every period/2 seconds.

Usage:
    python3 simulate_wf2.py --output logs.json --duration 1800 --period 300
    python3 simulate_wf2.py ... --rps 5 --amplitude 0.10 --baseline 0.05
"""

import argparse
import json
import math
import random
import time
from datetime import datetime, timezone
from pathlib import Path


def sine_error_rate(t: float, period: float, amplitude: float, baseline: float) -> float:
    """Returns the instantaneous error_rate at time t, clamped to [0, 1]."""
    raw = baseline + amplitude * math.sin(2 * math.pi * t / period)
    return max(0.0, min(1.0, raw))


def run(
    output_path: Path,
    feature_id: str,
    duration: float,
    rps: float,
    period: float,
    amplitude: float,
    baseline: float,
) -> None:
    """Runs the log generator until duration expires."""
    if not output_path.exists():
        output_path.write_text("[]")

    start = time.time()
    interval = 1.0 / rps

    while time.time() - start < duration:
        t = time.time() - start
        rate = sine_error_rate(t, period, amplitude, baseline)
        status = "error" if random.random() < rate else "success"

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "feature_id": feature_id,
            "status": status,
            "error_rate_now": round(rate, 3),  # debug aid: the current sine point
        }

        # Read-modify-write the whole file. Fine for a homework-scale simulator.
        try:
            existing = json.loads(output_path.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            existing = []

        existing.append(event)
        # Cap the file so it never blows up the disk.
        if len(existing) > 10_000:
            existing = existing[-10_000:]
        output_path.write_text(json.dumps(existing, ensure_ascii=False))

        # Throttle stdout to roughly one line every 5 seconds.
        if int(t) % 5 == 0 and int(t * rps) % max(1, int(rps * 5)) == 0:
            print(f"t={int(t)}s rate={rate:.1%} status={status} total_events={len(existing)}")

        time.sleep(interval)


def main() -> None:
    p = argparse.ArgumentParser(description="WF2 log generator (sine error rate)")
    p.add_argument("--output", default="logs.json", help="Path to logs.json (default: ./logs.json)")
    p.add_argument("--feature-id", default="search_v2")
    p.add_argument("--duration", type=float, default=1800, help="Run for N seconds (default: 1800 = 30 min)")
    p.add_argument("--rps", type=float, default=5, help="Events per second (default: 5)")
    p.add_argument("--period", type=float, default=300, help="Sine period in seconds (default: 300 = 5 min)")
    p.add_argument("--amplitude", type=float, default=0.10, help="Sine amplitude (default: 0.10)")
    p.add_argument("--baseline", type=float, default=0.05, help="Sine baseline error_rate (default: 0.05)")
    args = p.parse_args()

    lo = max(0.0, args.baseline - args.amplitude)
    hi = min(1.0, args.baseline + args.amplitude)
    print(f"simulate_wf2.py — duration={args.duration}s, rps={args.rps}, period={args.period}s")
    print(f"sine: baseline={args.baseline:.1%}, amplitude={args.amplitude:.1%} -> rate in [{lo:.1%}; {hi:.1%}]")
    print(f"Threshold WF2 = 5% -> feature toggles roughly every {args.period / 2:.0f}s")
    print(f"File: {args.output}")
    print("---")

    run(
        output_path=Path(args.output),
        feature_id=args.feature_id,
        duration=args.duration,
        rps=args.rps,
        period=args.period,
        amplitude=args.amplitude,
        baseline=args.baseline,
    )


if __name__ == "__main__":
    main()
