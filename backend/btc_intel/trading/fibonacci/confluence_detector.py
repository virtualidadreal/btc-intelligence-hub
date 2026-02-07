"""Fibonacci Confluence Detector — Finds multi-timeframe Fibonacci alignment.

When Fibonacci levels from different timeframes converge on a similar price,
it creates a high-probability zone.  This module clusters those overlapping
levels and persists the resulting confluence zones.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from btc_intel.db import get_supabase

logger = logging.getLogger(__name__)

# Default tolerance: two Fib levels within 0.5 % of each other are
# considered "confluent".
DEFAULT_TOLERANCE_PCT = 0.5


class FibConfluenceDetector:
    """Detect and persist confluences across Fibonacci levels from multiple TFs."""

    def find_confluences(
        self,
        fib_data: dict[str, dict],
        tolerance_pct: float = DEFAULT_TOLERANCE_PCT,
    ) -> list[dict]:
        """Find prices where 2+ Fib levels from DIFFERENT timeframes coincide.

        Args:
            fib_data: Mapping of timeframe -> analysis dict as returned by
                      ``FibonacciEngine.calculate_for_timeframe``.  Each value
                      must contain ``retracements`` and ``extensions`` lists
                      plus ``timeframe`` and ``direction``.
            tolerance_pct: Maximum percentage difference between two prices to
                           consider them confluent.

        Returns:
            List of confluence dicts sorted by ``num_timeframes`` descending,
            each containing: price, timeframes, fib_ratios, fib_labels,
            directions, num_timeframes, max_quality.
        """
        # Step 1: collect every individual Fib level across all timeframes.
        all_levels = self._collect_levels(fib_data)
        if len(all_levels) < 2:
            return []

        # Step 2: cluster levels that are within tolerance of each other AND
        # come from different timeframes.
        confluences = self._cluster_levels(all_levels, tolerance_pct)

        # Step 3: sort by number of contributing timeframes (descending),
        # then by max_quality descending.
        confluences.sort(
            key=lambda c: (c["num_timeframes"], c["max_quality"]),
            reverse=True,
        )

        return confluences

    def persist_confluences(
        self,
        confluences: list[dict],
        current_price: float,
    ) -> None:
        """Save confluence zones to the ``confluence_zones`` Supabase table."""
        if not confluences:
            return

        sb = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        rows: list[dict] = []
        for conf in confluences:
            distance_pct = round(
                abs(conf["price"] - current_price) / current_price * 100, 2
            )
            rows.append(
                {
                    "price": conf["price"],
                    "timeframes": conf["timeframes"],
                    "fib_ratios": conf["fib_ratios"],
                    "fib_labels": conf["fib_labels"],
                    "directions": conf["directions"],
                    "num_timeframes": conf["num_timeframes"],
                    "max_quality": conf["max_quality"],
                    "distance_pct": distance_pct,
                    "current_price": current_price,
                    "updated_at": now,
                }
            )

        try:
            # Replace all confluence zones on each run.
            sb.table("confluence_zones").delete().neq(
                "price", -1
            ).execute()  # clear table
            sb.table("confluence_zones").insert(rows).execute()
            logger.info("Persisted %d confluence zones", len(rows))
        except Exception:
            logger.exception("Failed to persist confluence zones")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _collect_levels(fib_data: dict[str, dict]) -> list[dict]:
        """Flatten all Fibonacci levels into a single list of annotated dicts."""
        levels: list[dict] = []

        for tf, data in fib_data.items():
            direction = data.get("direction", "LONG")

            for r in data.get("retracements", []):
                levels.append(
                    {
                        "price": r["price"],
                        "ratio": r["ratio"],
                        "label": r["label"],
                        "entry_quality": r.get("entry_quality", 0),
                        "timeframe": tf,
                        "direction": direction,
                        "type": "retracement",
                    }
                )

            for e in data.get("extensions", []):
                levels.append(
                    {
                        "price": e["price"],
                        "ratio": e["ratio"],
                        "label": e["label"],
                        "entry_quality": 0,
                        "timeframe": tf,
                        "direction": direction,
                        "type": "extension",
                    }
                )

        return levels

    @staticmethod
    def _cluster_levels(
        levels: list[dict],
        tolerance_pct: float,
    ) -> list[dict]:
        """Group levels that are close in price and span multiple timeframes.

        Uses a simple greedy clustering: sort by price, sweep through, and
        merge consecutive levels within tolerance.  Only clusters containing
        levels from >= 2 distinct timeframes are kept.
        """
        sorted_levels = sorted(levels, key=lambda lv: lv["price"])
        used = [False] * len(sorted_levels)
        confluences: list[dict] = []

        for i, base in enumerate(sorted_levels):
            if used[i]:
                continue

            cluster = [base]
            used[i] = True

            for j in range(i + 1, len(sorted_levels)):
                if used[j]:
                    continue
                candidate = sorted_levels[j]
                # Check if candidate is within tolerance of the cluster's
                # average price (anchored to the base for simplicity).
                if base["price"] == 0:
                    continue
                pct_diff = abs(candidate["price"] - base["price"]) / base["price"] * 100
                if pct_diff <= tolerance_pct:
                    cluster.append(candidate)
                    used[j] = True
                else:
                    # Since sorted, no further levels will be in range.
                    break

            # Only keep clusters with levels from 2+ different timeframes.
            unique_tfs = list({lv["timeframe"] for lv in cluster})
            if len(unique_tfs) < 2:
                continue

            avg_price = round(
                sum(lv["price"] for lv in cluster) / len(cluster), 2
            )
            ratios = list({lv["ratio"] for lv in cluster})
            labels = list({lv["label"] for lv in cluster})
            directions = list({lv["direction"] for lv in cluster})
            max_quality = max(lv["entry_quality"] for lv in cluster)

            confluences.append(
                {
                    "price": avg_price,
                    "timeframes": unique_tfs,
                    "fib_ratios": sorted(ratios),
                    "fib_labels": labels,
                    "directions": directions,
                    "num_timeframes": len(unique_tfs),
                    "max_quality": max_quality,
                }
            )

        return confluences
