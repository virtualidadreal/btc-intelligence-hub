"""Confluence Detector — Detects confluences between signals."""

from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def detect_confluences() -> dict:
    """Collect signals from all areas and detect confluences."""
    db = get_supabase()
    console.print("[cyan]Detecting confluences...[/cyan]")

    signals = {}

    # Technical signals (latest values)
    for indicator in ["RSI_14", "MACD", "SMA_CROSS"]:
        res = (
            db.table("technical_indicators")
            .select("signal")
            .eq("indicator", indicator)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and res.data[0]["signal"]:
            signals[f"tech_{indicator}"] = res.data[0]["signal"]

    # On-chain signals
    for metric in ["HASH_RATE_MOM_30D", "NVT_RATIO"]:
        res = (
            db.table("onchain_metrics")
            .select("signal")
            .eq("metric", metric)
            .neq("signal", None)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and res.data[0]["signal"]:
            signals[f"onchain_{metric}"] = res.data[0]["signal"]

    # Sentiment
    res = (
        db.table("sentiment_data")
        .select("value")
        .eq("metric", "FEAR_GREED")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if res.data:
        val = float(res.data[0]["value"])
        if val > 60:
            signals["sentiment_FG"] = "bearish"
        elif val < 40:
            signals["sentiment_FG"] = "bullish"
        else:
            signals["sentiment_FG"] = "neutral"

    # Detect confluences
    bullish = [k for k, v in signals.items() if "bullish" in v]
    bearish = [k for k, v in signals.items() if "bearish" in v]
    neutral = [k for k, v in signals.items() if v == "neutral"]

    confluences = []

    if len(bullish) >= 3:
        confluences.append({
            "type": "bullish_confluence",
            "strength": len(bullish),
            "sources": bullish,
            "message": f"{len(bullish)} BULLISH signals aligned: {', '.join(bullish)}",
        })

    if len(bearish) >= 3:
        confluences.append({
            "type": "bearish_confluence",
            "strength": len(bearish),
            "sources": bearish,
            "message": f"{len(bearish)} BEARISH signals aligned: {', '.join(bearish)}",
        })

    if len(bullish) >= 2 and len(bearish) >= 2:
        confluences.append({
            "type": "divergence",
            "message": f"MIXED SIGNALS: bullish={', '.join(bullish)} vs bearish={', '.join(bearish)}",
        })

    result = {
        "signals": signals,
        "bullish_count": len(bullish),
        "bearish_count": len(bearish),
        "neutral_count": len(neutral),
        "confluences": confluences,
    }

    for c in confluences:
        console.print(f"  [{c['type']}] {c['message']}")

    console.print(f"[green]Confluences: {len(bullish)} bullish, {len(bearish)} bearish[/green]")
    return result
