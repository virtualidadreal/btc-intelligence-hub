"""Role Flip Detector — Identifies support/resistance role changes."""

import pandas as pd

from btc_intel.trading import PriceLevel

# Tolerance for considering price "close to" a level
TOLERANCE_PCT = 0.3


def detect_role_flips(
    levels: list[PriceLevel], prices_df: pd.DataFrame
) -> list[PriceLevel]:
    """Detect support/resistance role flips on given price levels.

    A role flip occurs when:
    1. Price is rejected at a level 2+ times as resistance (high approaches
       the level but close stays below).
    2. Price then breaks above the level (close above).
    3. Price comes back down near the level and bounces (close stays above).

    When a flip is detected, the level's is_role_flip and flip_date are set.

    Args:
        levels: List of PriceLevel objects to evaluate.
        prices_df: DataFrame with columns [date, open, high, low, close].
                   Must be sorted by date ascending.

    Returns:
        The same list of PriceLevel objects, with flip flags updated.
    """
    if prices_df.empty or not levels:
        return levels

    df = prices_df.reset_index(drop=True)
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    dates = df["date"].values
    total = len(df)

    for level in levels:
        price = level.price
        tol = price * (TOLERANCE_PCT / 100)

        resistance_rejections = 0
        breakout_idx: int | None = None
        flip_confirmed = False
        flip_date_str: str | None = None

        for i in range(total):
            high_i = float(highs[i])
            close_i = float(closes[i])
            low_i = float(lows[i])

            if breakout_idx is None:
                # Phase 1 & 2: accumulate resistance rejections, detect breakout
                # Rejection: high comes close to level but close stays below
                if high_i >= (price - tol) and close_i < price:
                    resistance_rejections += 1

                # Breakout: close above level after 2+ rejections
                if resistance_rejections >= 2 and close_i > price:
                    breakout_idx = i
            else:
                # Phase 3: after breakout, look for a successful retest
                # Price must come back close to level from above and bounce
                if low_i <= (price + tol) and close_i > price:
                    flip_confirmed = True
                    flip_date_str = str(dates[i])
                    break

                # If price closes below the level again, the flip failed
                if close_i < (price - tol):
                    # Reset — could try to detect another flip sequence
                    breakout_idx = None

        if flip_confirmed:
            level.is_role_flip = True
            level.flip_date = flip_date_str

    return levels
