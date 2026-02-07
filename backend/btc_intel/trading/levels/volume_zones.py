"""Volume Zone Detector — Simplified Volume Profile analysis."""

import numpy as np
import pandas as pd


def detect_volume_zones(prices_df: pd.DataFrame, num_bins: int = 100) -> list[dict]:
    """Build a volume profile and return high-volume price zones.

    The price range is divided into `num_bins` equal bins. Each candle's
    volume is distributed uniformly across all bins its high-low range
    touches. Zones in the top 10% of accumulated volume are returned.

    Args:
        prices_df: DataFrame with columns [date, open, high, low, close, volume].
        num_bins: Number of bins to divide the price range into.

    Returns:
        List of dicts with keys: price, volume, is_high_volume.
    """
    if prices_df.empty:
        return []

    price_min = float(prices_df["low"].min())
    price_max = float(prices_df["high"].max())

    if price_max <= price_min:
        return []

    bin_edges = np.linspace(price_min, price_max, num_bins + 1)
    bin_volumes = np.zeros(num_bins, dtype=np.float64)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0
    bin_width = bin_edges[1] - bin_edges[0]

    if bin_width == 0:
        return []

    # Distribute each candle's volume across the bins it covers
    for _, row in prices_df.iterrows():
        low = float(row["low"])
        high = float(row["high"])
        vol = float(row["volume"])

        if vol <= 0 or high <= low:
            continue

        # Find which bins this candle overlaps
        first_bin = int((low - price_min) / bin_width)
        last_bin = int((high - price_min) / bin_width)

        # Clamp to valid range
        first_bin = max(0, min(first_bin, num_bins - 1))
        last_bin = max(0, min(last_bin, num_bins - 1))

        num_touched = last_bin - first_bin + 1
        vol_per_bin = vol / num_touched

        bin_volumes[first_bin : last_bin + 1] += vol_per_bin

    # Top 10% threshold
    threshold = np.percentile(bin_volumes[bin_volumes > 0], 90) if np.any(bin_volumes > 0) else 0

    zones: list[dict] = []
    for i in range(num_bins):
        if bin_volumes[i] >= threshold and bin_volumes[i] > 0:
            zones.append(
                {
                    "price": round(float(bin_centers[i]), 2),
                    "volume": round(float(bin_volumes[i]), 2),
                    "is_high_volume": True,
                }
            )

    return zones
