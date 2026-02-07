"""Swing Finder — Identifies significant swings for Fibonacci calculation.

Reuses the same pivot-bar logic as the Level Engine swing detector, but applies
a minimum-percentage-move filter so that only swings large enough to produce
meaningful Fibonacci levels are returned.
"""

import pandas as pd

from btc_intel.trading import SwingPoint

# Minimum swing size (%) required per timeframe to qualify for Fibonacci analysis.
MINIMUM_SWING_PERCENT: dict[str, float] = {
    "1H": 2.0,
    "4H": 4.0,
    "1D": 8.0,
    "1W": 15.0,
}

# Number of bars on each side required to confirm a pivot (mirrors Level Engine).
PIVOT_BARS: dict[str, int] = {
    "1H": 5,
    "4H": 7,
    "1D": 10,
    "1W": 5,
}


class SwingFinder:
    """Find significant swing points that meet the minimum move threshold."""

    def find_significant_swings(
        self,
        prices_df: pd.DataFrame,
        timeframe: str,
    ) -> list[SwingPoint]:
        """Detect swings and keep only those with a large enough move.

        Args:
            prices_df: DataFrame with columns [date, open, high, low, close, volume].
                       Must be sorted by date ascending.
            timeframe: One of "1H", "4H", "1D", "1W".

        Returns:
            List of SwingPoint instances whose percent_move meets the threshold.
        """
        raw_swings = self._detect_raw_swings(prices_df, timeframe)
        raw_swings = self._compute_percent_moves(raw_swings)

        min_pct = MINIMUM_SWING_PERCENT.get(timeframe, 8.0)
        return [s for s in raw_swings if s.percent_move >= min_pct]

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_raw_swings(
        prices_df: pd.DataFrame,
        timeframe: str,
    ) -> list[SwingPoint]:
        """Pivot-bar swing detection (same algorithm as Level Engine)."""
        n = PIVOT_BARS.get(timeframe, 10)
        df = prices_df.reset_index(drop=True)
        total = len(df)

        if total < (2 * n + 1):
            return []

        highs = df["high"].values
        lows = df["low"].values
        dates = df["date"].values

        swings: list[SwingPoint] = []

        for i in range(n, total - n):
            # --- Swing High ---
            is_high = True
            for j in range(i - n, i + n + 1):
                if j == i:
                    continue
                if highs[j] > highs[i]:
                    is_high = False
                    break
            if is_high:
                swings.append(
                    SwingPoint(
                        price=float(highs[i]),
                        type="high",
                        date=str(dates[i]),
                        timeframe=timeframe,
                    )
                )

            # --- Swing Low ---
            is_low = True
            for j in range(i - n, i + n + 1):
                if j == i:
                    continue
                if lows[j] < lows[i]:
                    is_low = False
                    break
            if is_low:
                swings.append(
                    SwingPoint(
                        price=float(lows[i]),
                        type="low",
                        date=str(dates[i]),
                        timeframe=timeframe,
                    )
                )

        # Sort chronologically (stable ordering by date).
        swings.sort(key=lambda s: s.date)
        return swings

    @staticmethod
    def _compute_percent_moves(swings: list[SwingPoint]) -> list[SwingPoint]:
        """Calculate percent_move for each swing relative to the previous opposite swing.

        A swing high's percent_move is computed as the rise from the last swing
        low to this high.  A swing low's percent_move is the drop from the last
        swing high to this low.
        """
        last_high: SwingPoint | None = None
        last_low: SwingPoint | None = None

        for swing in swings:
            if swing.type == "high":
                if last_low is not None and last_low.price != 0:
                    swing.percent_move = round(
                        abs(swing.price - last_low.price) / last_low.price * 100, 2
                    )
                last_high = swing
            else:  # "low"
                if last_high is not None and last_high.price != 0:
                    swing.percent_move = round(
                        abs(last_high.price - swing.price) / last_high.price * 100, 2
                    )
                last_low = swing

        return swings
