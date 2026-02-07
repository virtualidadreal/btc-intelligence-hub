"""Swing Point Detector — Identifies swing highs and lows from OHLCV data."""

import pandas as pd

from btc_intel.trading import SwingPoint

# Number of bars on each side required to confirm a pivot.
# For intraday TFs we use smaller pivots on the same daily data.
PIVOT_BARS: dict[str, int] = {
    "1H": 5,
    "4H": 7,
    "1D": 10,
    "1W": 5,
}


def detect_swings(timeframe: str, prices_df: pd.DataFrame) -> list[SwingPoint]:
    """Detect swing highs and lows for a given timeframe.

    Args:
        timeframe: One of "1H", "4H", "1D", "1W".
        prices_df: DataFrame with columns [date, open, high, low, close, volume].
                   Must be sorted by date ascending.

    Returns:
        List of SwingPoint instances found in the data.
    """
    n = PIVOT_BARS.get(timeframe, 10)
    df = prices_df.reset_index(drop=True)
    total = len(df)

    if total < (2 * n + 1):
        return []

    highs = df["high"].values
    lows = df["low"].values
    dates = df["date"].values
    closes = df["close"].values

    swings: list[SwingPoint] = []

    for i in range(n, total - n):
        # --- Swing High check ---
        is_swing_high = True
        for j in range(i - n, i + n + 1):
            if j == i:
                continue
            if highs[j] > highs[i]:
                is_swing_high = False
                break

        if is_swing_high:
            # Compute percentage move from the swing high to the next local low
            pct_move = _percent_move_after(closes, i, direction="down")
            swings.append(
                SwingPoint(
                    price=float(highs[i]),
                    type="high",
                    date=str(dates[i]),
                    timeframe=timeframe,
                    percent_move=pct_move,
                )
            )

        # --- Swing Low check ---
        is_swing_low = True
        for j in range(i - n, i + n + 1):
            if j == i:
                continue
            if lows[j] < lows[i]:
                is_swing_low = False
                break

        if is_swing_low:
            pct_move = _percent_move_after(closes, i, direction="up")
            swings.append(
                SwingPoint(
                    price=float(lows[i]),
                    type="low",
                    date=str(dates[i]),
                    timeframe=timeframe,
                    percent_move=pct_move,
                )
            )

    return swings


def _percent_move_after(closes, idx: int, direction: str, lookforward: int = 20) -> float:
    """Compute the max percentage move in `direction` within `lookforward` bars."""
    end = min(idx + lookforward + 1, len(closes))
    if idx + 1 >= end:
        return 0.0

    base = closes[idx]
    if base == 0:
        return 0.0

    segment = closes[idx + 1 : end]
    if len(segment) == 0:
        return 0.0

    if direction == "down":
        extreme = min(segment)
        return round(abs((base - extreme) / base) * 100, 2)
    else:
        extreme = max(segment)
        return round(abs((extreme - base) / base) * 100, 2)
