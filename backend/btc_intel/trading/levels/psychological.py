"""Psychological Levels — Round-number price levels significant for BTC."""

from btc_intel.trading import PriceLevel

# Notable round-number price levels for Bitcoin
ALL_LEVELS: list[int] = [
    10000,
    15000,
    20000,
    25000,
    30000,
    35000,
    40000,
    45000,
    50000,
    55000,
    60000,
    65000,
    70000,
    75000,
    80000,
    85000,
    90000,
    95000,
    100000,
    110000,
    120000,
    125000,
    150000,
    175000,
    200000,
    250000,
    300000,
    500000,
]


def get_nearby_psychological_levels(
    current_price: float, range_pct: float = 30
) -> list[PriceLevel]:
    """Return psychological price levels within range_pct% of current price.

    Args:
        current_price: The current BTC price in USD.
        range_pct: Percentage range above and below to include.

    Returns:
        List of PriceLevel objects for each matching psychological level.
    """
    if current_price <= 0:
        return []

    lower_bound = current_price * (1 - range_pct / 100)
    upper_bound = current_price * (1 + range_pct / 100)

    levels: list[PriceLevel] = []

    for lvl in ALL_LEVELS:
        if lower_bound <= lvl <= upper_bound:
            level_type = "support" if lvl < current_price else "resistance"
            levels.append(
                PriceLevel(
                    price=float(lvl),
                    type=level_type,
                    source=["psychological"],
                    is_psychological=True,
                    touch_count=0,
                )
            )

    return levels
