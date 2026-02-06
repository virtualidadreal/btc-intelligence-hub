"""Derivatives Analysis — Funding Rate & Open Interest classification."""

from datetime import date, timedelta

from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def analyze_derivatives():
    """Classify funding rate and compute OI signal vs 30d average."""
    db = get_supabase()

    console.print("[bold]Derivatives Analysis[/bold]")

    # --- Funding Rate Classification ---
    fr = (
        db.table("onchain_metrics")
        .select("*")
        .eq("metric", "FUNDING_RATE")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    if fr.data:
        rate = float(fr.data[0]["value"])
        signal = classify_funding_rate(rate)
        db.table("onchain_metrics").update({"signal": signal}).eq(
            "id", fr.data[0]["id"]
        ).execute()
        console.print(f"  Funding Rate: {rate:.4f}% -> {signal}")
    else:
        console.print("  [dim]No funding rate data[/dim]")

    # --- Open Interest vs 30D Average ---
    today = date.today()
    d30_ago = str(today - timedelta(days=30))

    oi_history = (
        db.table("onchain_metrics")
        .select("*")
        .eq("metric", "OPEN_INTEREST")
        .gte("date", d30_ago)
        .order("date", desc=True)
        .execute()
    )

    if oi_history.data and len(oi_history.data) >= 2:
        current_oi = float(oi_history.data[0]["value"])
        avg_oi = sum(float(r["value"]) for r in oi_history.data) / len(oi_history.data)
        signal = classify_open_interest_change(current_oi, avg_oi)

        db.table("onchain_metrics").update({"signal": signal}).eq(
            "id", oi_history.data[0]["id"]
        ).execute()
        pct = ((current_oi - avg_oi) / avg_oi * 100) if avg_oi > 0 else 0
        console.print(f"  Open Interest: ${current_oi:,.0f} (vs 30D avg: ${avg_oi:,.0f}, {pct:+.1f}%) -> {signal}")
    else:
        console.print("  [dim]Not enough OI data for 30D comparison[/dim]")

    console.print("  [green]Derivatives analysis done[/green]")


def classify_funding_rate(rate_pct: float) -> str:
    """Classify funding rate with contrarian logic.

    High positive funding = everyone is long = contrarian bearish.
    High negative funding = everyone is short = contrarian bullish.
    """
    if rate_pct > 0.1:
        return "extreme_bearish"  # Extreme longs, contrarian sell signal
    if rate_pct > 0.03:
        return "bearish"  # Market leaning long
    if rate_pct > -0.03:
        return "neutral"
    if rate_pct > -0.05:
        return "bullish"  # Market leaning short, contrarian
    return "extreme_bullish"  # Extreme shorts, contrarian buy signal


def classify_open_interest_change(current: float, avg_30d: float) -> str:
    """Classify OI vs 30D average."""
    if avg_30d == 0:
        return "neutral"
    pct_change = ((current - avg_30d) / avg_30d) * 100
    if pct_change > 20:
        return "bearish"  # Very high leverage
    if pct_change > 5:
        return "neutral"
    if pct_change > -5:
        return "neutral"
    if pct_change > -20:
        return "neutral"
    return "bullish"  # Low leverage, organic market
