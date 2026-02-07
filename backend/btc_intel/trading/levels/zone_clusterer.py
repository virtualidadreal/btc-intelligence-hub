"""Zone Clusterer — Groups nearby PriceLevels into consolidated Zones."""

from btc_intel.trading import PriceLevel, Zone


def cluster_levels_into_zones(
    levels: list[PriceLevel],
    current_price: float,
    tolerance_pct: float = 0.5,
) -> list[Zone]:
    """Cluster nearby price levels into zones.

    Levels within tolerance_pct% of each other are grouped together.
    Each resulting zone aggregates strength, touches, sources, and
    timeframes from its constituent levels.

    Args:
        levels: List of PriceLevel objects to cluster.
        current_price: Current BTC price, used to classify zone type.
        tolerance_pct: Max percentage distance to merge levels.

    Returns:
        List of Zone objects sorted by strength descending.
    """
    if not levels:
        return []

    # Sort by price ascending
    sorted_levels = sorted(levels, key=lambda lv: lv.price)

    clusters: list[list[PriceLevel]] = []
    current_cluster: list[PriceLevel] = [sorted_levels[0]]

    for i in range(1, len(sorted_levels)):
        prev_price = current_cluster[-1].price
        curr_price = sorted_levels[i].price

        # Check if this level is within tolerance of the cluster anchor
        cluster_mid = sum(lv.price for lv in current_cluster) / len(current_cluster)
        pct_diff = abs(curr_price - cluster_mid) / cluster_mid * 100 if cluster_mid > 0 else 0

        if pct_diff <= tolerance_pct:
            current_cluster.append(sorted_levels[i])
        else:
            clusters.append(current_cluster)
            current_cluster = [sorted_levels[i]]

    # Don't forget the last cluster
    clusters.append(current_cluster)

    # Build Zone objects from clusters
    zones: list[Zone] = []
    for cluster in clusters:
        zone = _build_zone(cluster, current_price)
        zones.append(zone)

    # Sort by strength descending
    zones.sort(key=lambda z: z.strength, reverse=True)
    return zones


def _build_zone(cluster: list[PriceLevel], current_price: float) -> Zone:
    """Build a single Zone from a cluster of PriceLevels."""
    prices = [lv.price for lv in cluster]
    price_low = min(prices)
    price_high = max(prices)
    price_mid = round(sum(prices) / len(prices), 2)

    # Max strength from any level in the cluster
    max_strength = max(lv.strength for lv in cluster)

    # Accumulated touch count
    total_touches = sum(lv.touch_count for lv in cluster)

    # Combined sources (unique)
    all_sources: set[str] = set()
    for lv in cluster:
        all_sources.update(lv.source)

    # Combined timeframes (unique)
    all_timeframes: set[str] = set()
    for lv in cluster:
        all_timeframes.update(lv.timeframes)

    # Fib ratios present in this cluster
    fib_ratios: list[float] = []
    for lv in cluster:
        if lv.coincides_with_fib and lv.fib_level is not None:
            if lv.fib_level not in fib_ratios:
                fib_ratios.append(lv.fib_level)

    # Zone type based on current price
    zone_type = "support" if price_mid < current_price else "resistance"

    # A "gran nivel" if strength >= 15 (critical classification)
    has_gran_nivel = max_strength >= 15

    return Zone(
        price_low=round(price_low, 2),
        price_high=round(price_high, 2),
        price_mid=price_mid,
        strength=max_strength,
        type=zone_type,
        sources=sorted(all_sources),
        touch_count=total_touches,
        timeframes=sorted(all_timeframes),
        fib_ratios=sorted(fib_ratios),
        has_gran_nivel=has_gran_nivel,
    )
