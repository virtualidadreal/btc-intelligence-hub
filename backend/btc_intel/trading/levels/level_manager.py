"""Level Manager — Orchestrator for the full Level Engine pipeline."""

from datetime import datetime, timedelta

import pandas as pd
from rich.console import Console
from rich.table import Table

from btc_intel.db import get_supabase
from btc_intel.trading import PriceLevel, SwingPoint, Zone

from .level_scorer import classify_level, score_level
from .psychological import get_nearby_psychological_levels
from .role_flip import detect_role_flips
from .swing_detector import PIVOT_BARS, detect_swings
from .volume_zones import detect_volume_zones
from .zone_clusterer import cluster_levels_into_zones

console = Console()


def scan_levels() -> list[Zone]:
    """Run the full Level Engine pipeline.

    1. Load price data (last 365 days) from btc_prices.
    2. Detect swing points for each timeframe.
    3. Detect high-volume zones.
    4. Get nearby psychological levels.
    5. Detect role flips.
    6. Score every level.
    7. Cluster into zones.
    8. Persist to price_levels table.
    9. Return zones.

    Returns:
        List of Zone objects sorted by strength descending.
    """
    console.print("[bold cyan]Level Engine[/] — Starting full scan...\n")

    # ── Step 1: Load price data ──────────────────────────────────────────
    console.print("[dim]Loading price data (last 365 days)...[/]")
    prices_df = _load_prices(days=365)
    if prices_df.empty:
        console.print("[red]No price data found. Aborting.[/]")
        return []

    current_price = float(prices_df.iloc[-1]["close"])
    console.print(f"  Loaded {len(prices_df)} candles. Current price: ${current_price:,.0f}\n")

    # ── Step 2: Swing detection per timeframe ────────────────────────────
    console.print("[dim]Detecting swing points...[/]")
    all_swings: list[SwingPoint] = []
    for tf in PIVOT_BARS:
        swings = detect_swings(tf, prices_df)
        all_swings.extend(swings)
        console.print(f"  {tf}: {len(swings)} swings")

    # Convert swings to PriceLevels
    all_levels: list[PriceLevel] = _swings_to_levels(all_swings, current_price, prices_df)
    console.print(f"  Total unique swing-based levels: {len(all_levels)}\n")

    # ── Step 3: Volume zones ─────────────────────────────────────────────
    console.print("[dim]Detecting volume zones...[/]")
    vol_zones = detect_volume_zones(prices_df)
    vol_levels = _volume_zones_to_levels(vol_zones, current_price)
    console.print(f"  High-volume zones found: {len(vol_levels)}\n")

    # Merge volume info into existing levels or add new ones
    all_levels = _merge_levels(all_levels, vol_levels, tolerance_pct=0.3)

    # ── Step 4: Psychological levels ─────────────────────────────────────
    console.print("[dim]Getting psychological levels...[/]")
    psych_levels = get_nearby_psychological_levels(current_price)
    console.print(f"  Psychological levels: {len(psych_levels)}\n")

    all_levels = _merge_levels(all_levels, psych_levels, tolerance_pct=0.3)

    # ── Step 5: Role flip detection ──────────────────────────────────────
    console.print("[dim]Detecting role flips...[/]")
    all_levels = detect_role_flips(all_levels, prices_df)
    flip_count = sum(1 for lv in all_levels if lv.is_role_flip)
    console.print(f"  Role flips detected: {flip_count}\n")

    # ── Step 6: Score all levels ─────────────────────────────────────────
    console.print("[dim]Scoring levels...[/]")
    for level in all_levels:
        level.strength = score_level(level)
    console.print(f"  Scored {len(all_levels)} levels\n")

    # ── Step 7: Cluster into zones ───────────────────────────────────────
    console.print("[dim]Clustering into zones...[/]")
    zones = cluster_levels_into_zones(all_levels, current_price)
    console.print(f"  Zones created: {len(zones)}\n")

    # ── Step 8: Persist to Supabase ──────────────────────────────────────
    console.print("[dim]Persisting to database...[/]")
    _persist_levels(all_levels, zones)
    console.print("[green]  Saved to price_levels table.[/]\n")

    # ── Summary ──────────────────────────────────────────────────────────
    _print_summary(zones, current_price)

    return zones


def list_levels(min_strength: int = 0) -> list[dict]:
    """Read price levels from the database.

    Args:
        min_strength: Minimum strength score to include (0-20).

    Returns:
        List of dicts from the price_levels table.
    """
    sb = get_supabase()
    query = sb.table("price_levels").select("*")

    if min_strength > 0:
        query = query.gte("strength", min_strength)

    response = query.order("strength", desc=True).execute()
    return response.data or []


# ── Private helpers ──────────────────────────────────────────────────────────


def _load_prices(days: int = 365) -> pd.DataFrame:
    """Load OHLCV data from btc_prices table."""
    sb = get_supabase()
    cutoff = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    response = (
        sb.table("btc_prices")
        .select("date, open, high, low, close, volume")
        .gte("date", cutoff)
        .order("date", desc=False)
        .execute()
    )

    if not response.data:
        return pd.DataFrame()

    df = pd.DataFrame(response.data)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["open", "high", "low", "close"])
    return df


def _swings_to_levels(
    swings: list[SwingPoint], current_price: float, prices_df: pd.DataFrame
) -> list[PriceLevel]:
    """Convert raw SwingPoints into deduplicated PriceLevels.

    Swings at similar prices (within 0.3%) are merged into one level,
    accumulating touch count and timeframes.
    """
    if not swings:
        return []

    tolerance_pct = 0.3
    levels: list[PriceLevel] = []

    today = datetime.utcnow().date()

    for swing in swings:
        merged = False
        for existing in levels:
            pct_diff = abs(swing.price - existing.price) / existing.price * 100
            if pct_diff <= tolerance_pct:
                # Merge into existing level
                existing.touch_count += 1
                if swing.timeframe not in existing.timeframes:
                    existing.timeframes.append(swing.timeframe)
                    existing.visible_in_timeframes = len(existing.timeframes)
                if "swing" not in existing.source:
                    existing.source.append("swing")

                # Update last touch date
                try:
                    swing_date = datetime.strptime(swing.date[:10], "%Y-%m-%d").date()
                    days_ago = (today - swing_date).days
                    if days_ago < existing.last_touch_days:
                        existing.last_touch_days = days_ago
                        existing.last_touch_date = swing.date[:10]
                except (ValueError, TypeError):
                    pass

                merged = True
                break

        if not merged:
            level_type = "support" if swing.type == "low" else "resistance"

            last_touch_days = 999
            last_touch_date = None
            try:
                swing_date = datetime.strptime(swing.date[:10], "%Y-%m-%d").date()
                last_touch_days = (today - swing_date).days
                last_touch_date = swing.date[:10]
            except (ValueError, TypeError):
                pass

            levels.append(
                PriceLevel(
                    price=round(swing.price, 2),
                    type=level_type,
                    source=["swing"],
                    timeframes=[swing.timeframe],
                    touch_count=1,
                    visible_in_timeframes=1,
                    last_touch_days=last_touch_days,
                    last_touch_date=last_touch_date,
                )
            )

    return levels


def _volume_zones_to_levels(vol_zones: list[dict], current_price: float) -> list[PriceLevel]:
    """Convert volume zone dicts into PriceLevel objects."""
    levels: list[PriceLevel] = []
    for vz in vol_zones:
        price = vz["price"]
        level_type = "support" if price < current_price else "resistance"
        levels.append(
            PriceLevel(
                price=round(price, 2),
                type=level_type,
                source=["volume_profile"],
                is_high_volume_zone=True,
                touch_count=0,
            )
        )
    return levels


def _merge_levels(
    base: list[PriceLevel], new: list[PriceLevel], tolerance_pct: float = 0.3
) -> list[PriceLevel]:
    """Merge new levels into base, combining attributes for nearby prices."""
    for new_lv in new:
        merged = False
        for existing in base:
            pct_diff = abs(new_lv.price - existing.price) / existing.price * 100 if existing.price > 0 else float("inf")
            if pct_diff <= tolerance_pct:
                # Merge sources
                for src in new_lv.source:
                    if src not in existing.source:
                        existing.source.append(src)

                # Merge timeframes
                for tf in new_lv.timeframes:
                    if tf not in existing.timeframes:
                        existing.timeframes.append(tf)
                        existing.visible_in_timeframes = len(existing.timeframes)

                # Merge boolean flags (sticky True)
                existing.is_high_volume_zone = existing.is_high_volume_zone or new_lv.is_high_volume_zone
                existing.is_psychological = existing.is_psychological or new_lv.is_psychological

                # Take the better (more recent) touch info
                if new_lv.last_touch_days < existing.last_touch_days:
                    existing.last_touch_days = new_lv.last_touch_days
                    existing.last_touch_date = new_lv.last_touch_date

                existing.touch_count += new_lv.touch_count

                merged = True
                break

        if not merged:
            base.append(new_lv)

    return base


def _persist_levels(levels: list[PriceLevel], zones: list[Zone]) -> None:
    """Clear existing price_levels and insert fresh data."""
    sb = get_supabase()
    now = datetime.utcnow().isoformat()

    # Delete old records
    sb.table("price_levels").delete().neq("id", 0).execute()

    if not levels:
        return

    rows = []
    for lv in levels:
        classification = classify_level(lv.strength)
        rows.append(
            {
                "price": lv.price,
                "type": lv.type,
                "strength": lv.strength,
                "classification": classification,
                "source": lv.source,
                "timeframes": lv.timeframes,
                "touch_count": lv.touch_count,
                "last_touch_date": lv.last_touch_date,
                "fib_level": lv.fib_level,
                "is_role_flip": lv.is_role_flip,
                "is_high_volume": lv.is_high_volume_zone,
                "is_psychological": lv.is_psychological,
                "updated_at": now,
            }
        )

    # Insert in batches of 50
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        sb.table("price_levels").insert(batch).execute()


def _print_summary(zones: list[Zone], current_price: float) -> None:
    """Print a rich summary table of the top zones."""
    table = Table(title=f"Level Engine Results  |  BTC ${current_price:,.0f}")
    table.add_column("Zone", style="cyan", justify="right")
    table.add_column("Type", style="bold")
    table.add_column("Strength", justify="center")
    table.add_column("Class", style="bold")
    table.add_column("Touches", justify="center")
    table.add_column("Sources")
    table.add_column("Distance", justify="right")

    for zone in zones[:20]:
        zone_range = f"${zone.price_low:,.0f} - ${zone.price_high:,.0f}"
        if zone.price_low == zone.price_high:
            zone_range = f"${zone.price_mid:,.0f}"

        classification = classify_level(zone.strength)
        class_color = {
            "critical": "red bold",
            "strong": "yellow",
            "moderate": "green",
            "weak": "dim",
        }.get(classification, "white")

        type_color = "green" if zone.type == "support" else "red"
        distance_pct = round((zone.price_mid - current_price) / current_price * 100, 1)
        distance_str = f"{distance_pct:+.1f}%"

        table.add_row(
            zone_range,
            f"[{type_color}]{zone.type.upper()}[/]",
            str(zone.strength),
            f"[{class_color}]{classification.upper()}[/]",
            str(zone.touch_count),
            ", ".join(zone.sources),
            distance_str,
        )

    console.print(table)
    console.print()
