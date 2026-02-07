"""Fibonacci Engine — Retracements, extensions, and multi-TF scanning.

Calculates Fibonacci retracement and extension levels from significant swings,
then persists results to the ``fibonacci_levels`` Supabase table.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import pandas as pd

from btc_intel.db import get_supabase
from btc_intel.trading import SwingPoint
from btc_intel.trading.fibonacci.swing_finder import SwingFinder

logger = logging.getLogger(__name__)

# ── Retracement Levels ──────────────────────────────────────────────────────
# ratio -> (label, entry_quality 1-10)
RETRACEMENT_LEVELS: dict[float, tuple[str, int]] = {
    0.236: ("Shallow", 2),
    0.382: ("Moderate", 5),
    0.500: ("Mid", 6),
    0.618: ("Golden Ratio", 9),
    0.650: ("Golden Pocket", 10),
    0.786: ("Deep", 7),
}

# ── Extension Levels ────────────────────────────────────────────────────────
# ratio -> label
EXTENSION_LEVELS: dict[float, str] = {
    1.000: "Measured Move",
    1.272: "Standard",
    1.618: "Golden Extension",
    2.000: "Double Move",
    2.618: "Extended",
}

TIMEFRAMES = ["1H", "4H", "1D", "1W"]

# Zone width: ±0.3 % around each Fibonacci level price.
ZONE_WIDTH_PCT = 0.003


# ── Pure calculation functions ──────────────────────────────────────────────

def calculate_retracements(
    swing_low: float,
    swing_high: float,
    direction: str,
) -> list[dict]:
    """Return retracement levels between two swing points.

    Args:
        swing_low:  Price of the swing low.
        swing_high: Price of the swing high.
        direction:  "LONG" (price pulled back from a high) or
                    "SHORT" (price bounced from a low).

    Returns:
        List of dicts with keys: ratio, label, price, zone_low, zone_high,
        entry_quality.
    """
    diff = swing_high - swing_low
    if diff <= 0:
        return []

    levels: list[dict] = []
    for ratio, (label, quality) in RETRACEMENT_LEVELS.items():
        if direction == "LONG":
            price = swing_high - diff * ratio
        else:  # SHORT
            price = swing_low + diff * ratio

        zone_low = round(price * (1 - ZONE_WIDTH_PCT), 2)
        zone_high = round(price * (1 + ZONE_WIDTH_PCT), 2)

        levels.append(
            {
                "ratio": ratio,
                "label": label,
                "price": round(price, 2),
                "zone_low": zone_low,
                "zone_high": zone_high,
                "entry_quality": quality,
            }
        )

    return levels


def calculate_extensions(
    swing_low: float,
    swing_high: float,
    pullback_end: float,
    direction: str,
) -> list[dict]:
    """Return extension levels projected from the pullback end.

    Args:
        swing_low:    Price of the swing low.
        swing_high:   Price of the swing high.
        pullback_end: Price where the retracement ended.
        direction:    "LONG" or "SHORT".

    Returns:
        List of dicts with keys: ratio, label, price.
    """
    impulse = swing_high - swing_low
    if impulse <= 0:
        return []

    levels: list[dict] = []
    for ratio, label in EXTENSION_LEVELS.items():
        if direction == "LONG":
            price = pullback_end + impulse * ratio
        else:  # SHORT
            price = pullback_end - impulse * ratio

        levels.append(
            {
                "ratio": ratio,
                "label": label,
                "price": round(price, 2),
            }
        )

    return levels


# ── Engine class ────────────────────────────────────────────────────────────

class FibonacciEngine:
    """Orchestrates Fibonacci analysis across multiple timeframes."""

    def __init__(self) -> None:
        self.swing_finder = SwingFinder()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate_for_timeframe(
        self,
        timeframe: str,
        prices_df: pd.DataFrame,
        current_price: float,
    ) -> dict | None:
        """Run Fibonacci analysis for a single timeframe.

        Returns a dict with keys ``retracements``, ``extensions``,
        ``direction``, ``swing_high``, ``swing_low`` — or ``None`` if there
        are not enough significant swings.
        """
        swings = self.swing_finder.find_significant_swings(prices_df, timeframe)
        if len(swings) < 2:
            logger.info("Not enough significant swings for %s", timeframe)
            return None

        # Identify the last significant high and low.
        last_high = self._last_swing_of_type(swings, "high")
        last_low = self._last_swing_of_type(swings, "low")

        if last_high is None or last_low is None:
            return None

        # Determine trend direction: if the high came after the low the
        # market moved up → look for LONG retracements (pullback to buy).
        if last_high.date >= last_low.date:
            direction = "LONG"
        else:
            direction = "SHORT"

        retracements = calculate_retracements(
            last_low.price, last_high.price, direction
        )

        # For extensions, estimate the pullback end as current price.
        extensions = calculate_extensions(
            last_low.price, last_high.price, current_price, direction
        )

        result = {
            "timeframe": timeframe,
            "direction": direction,
            "swing_high": last_high.price,
            "swing_high_date": last_high.date,
            "swing_low": last_low.price,
            "swing_low_date": last_low.date,
            "retracements": retracements,
            "extensions": extensions,
        }

        self._persist(result)
        return result

    def scan_all_timeframes(
        self,
        prices_df: pd.DataFrame,
        current_price: float,
    ) -> dict[str, dict]:
        """Run Fibonacci analysis on every configured timeframe.

        Returns:
            Mapping of timeframe -> analysis dict (skips timeframes without
            enough data).
        """
        results: dict[str, dict] = {}
        for tf in TIMEFRAMES:
            analysis = self.calculate_for_timeframe(tf, prices_df, current_price)
            if analysis is not None:
                results[tf] = analysis
        return results

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _persist(self, result: dict) -> None:
        """Upsert Fibonacci levels into the ``fibonacci_levels`` table.

        Rows are uniquely identified by (timeframe, type, direction).
        """
        sb = get_supabase()
        now = datetime.now(timezone.utc).isoformat()
        timeframe = result["timeframe"]
        direction = result["direction"]

        rows: list[dict] = []

        for r in result["retracements"]:
            rows.append(
                {
                    "timeframe": timeframe,
                    "type": "retracement",
                    "direction": direction,
                    "ratio": r["ratio"],
                    "label": r["label"],
                    "price": r["price"],
                    "zone_low": r["zone_low"],
                    "zone_high": r["zone_high"],
                    "entry_quality": r["entry_quality"],
                    "swing_high": result["swing_high"],
                    "swing_low": result["swing_low"],
                    "updated_at": now,
                }
            )

        for e in result["extensions"]:
            rows.append(
                {
                    "timeframe": timeframe,
                    "type": "extension",
                    "direction": direction,
                    "ratio": e["ratio"],
                    "label": e["label"],
                    "price": e["price"],
                    "zone_low": None,
                    "zone_high": None,
                    "entry_quality": None,
                    "swing_high": result["swing_high"],
                    "swing_low": result["swing_low"],
                    "updated_at": now,
                }
            )

        if rows:
            try:
                sb.table("fibonacci_levels").upsert(
                    rows,
                    on_conflict="timeframe,type,direction,ratio",
                ).execute()
                logger.info(
                    "Persisted %d Fibonacci levels for %s %s",
                    len(rows),
                    timeframe,
                    direction,
                )
            except Exception:
                logger.exception("Failed to persist Fibonacci levels for %s", timeframe)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _last_swing_of_type(
        swings: list[SwingPoint],
        swing_type: str,
    ) -> SwingPoint | None:
        """Return the most recent swing of the given type (by date)."""
        candidates = [s for s in swings if s.type == swing_type]
        if not candidates:
            return None
        return max(candidates, key=lambda s: s.date)
