"""Backtesting — Store signal snapshots and evaluate past signals."""

from datetime import date, timedelta

from rich.console import Console

from btc_intel.db import get_supabase
from btc_intel.analysis.signal_classifier import SignalClassifier

console = Console()

# Replicate frontend WEIGHTS for scoring
WEIGHTS = {
    "1H": {"RSI_14": 0.25, "MACD": 0.25, "SMA_CROSS": 0.00, "BB": 0.15, "EMA_21": 0.15, "FEAR_GREED": 0.10, "HASH_RATE_MOM": 0.00, "NVT_RATIO": 0.00, "CYCLE_SCORE": 0.10},
    "4H": {"RSI_14": 0.20, "MACD": 0.20, "SMA_CROSS": 0.10, "BB": 0.10, "EMA_21": 0.15, "FEAR_GREED": 0.15, "HASH_RATE_MOM": 0.05, "NVT_RATIO": 0.05, "CYCLE_SCORE": 0.00},
    "1D": {"RSI_14": 0.15, "MACD": 0.15, "SMA_CROSS": 0.15, "BB": 0.10, "EMA_21": 0.10, "FEAR_GREED": 0.10, "HASH_RATE_MOM": 0.10, "NVT_RATIO": 0.05, "CYCLE_SCORE": 0.10},
    "1W": {"RSI_14": 0.05, "MACD": 0.10, "SMA_CROSS": 0.25, "BB": 0.00, "EMA_21": 0.05, "FEAR_GREED": 0.10, "HASH_RATE_MOM": 0.15, "NVT_RATIO": 0.10, "CYCLE_SCORE": 0.20},
}

SIGNAL_SCORE = {
    "extreme_bullish": 1.0,
    "bullish": 0.5,
    "neutral": 0.0,
    "bearish": -0.5,
    "extreme_bearish": -1.0,
}

# Hours to wait before evaluating each timeframe
EVAL_HOURS = {"1H": 1, "4H": 4, "1D": 24, "1W": 168}


def store_signal_snapshot():
    """Take a snapshot of current signals and store as signal_history."""
    db = get_supabase()

    console.print("[bold]Signal Backtesting — Snapshot[/bold]")

    # Get current price
    price_res = db.table("btc_prices").select("close").order("date", desc=True).limit(1).execute()
    if not price_res.data:
        console.print("  [dim]No price data, skipping snapshot[/dim]")
        return

    current_price = float(price_res.data[0]["close"])

    # Get latest indicators
    indicators = (
        db.table("technical_indicators")
        .select("indicator,value,signal")
        .in_("indicator", ["RSI_14", "MACD", "SMA_CROSS", "BB_UPPER", "BB_LOWER", "EMA_21"])
        .order("date", desc=True)
        .limit(20)
    ).execute()

    signal_map = {}
    for ind in indicators.data or []:
        if ind["indicator"] not in signal_map and ind.get("signal"):
            signal_map[ind["indicator"]] = ind["signal"]

    # BB composite signal
    if "BB_UPPER" in signal_map:
        signal_map["BB"] = signal_map.pop("BB_UPPER")
    elif "BB_LOWER" in signal_map:
        signal_map["BB"] = signal_map.pop("BB_LOWER")

    # Fear & Greed
    fg = db.table("sentiment_data").select("value").eq("metric", "FEAR_GREED").order("date", desc=True).limit(1).execute()
    if fg.data:
        val = int(fg.data[0]["value"])
        if val <= 15: signal_map["FEAR_GREED"] = "extreme_bearish"
        elif val <= 30: signal_map["FEAR_GREED"] = "bearish"
        elif val <= 55: signal_map["FEAR_GREED"] = "neutral"
        elif val <= 80: signal_map["FEAR_GREED"] = "bullish"
        else: signal_map["FEAR_GREED"] = "extreme_bullish"

    # On-chain
    onchain = db.table("onchain_metrics").select("metric,signal").in_("metric", ["HASH_RATE_MOM", "NVT_RATIO"]).order("date", desc=True).limit(4).execute()
    for oc in onchain.data or []:
        key = "HASH_RATE_MOM" if oc["metric"].startswith("HASH_RATE") else oc["metric"]
        if key not in signal_map and oc.get("signal"):
            signal_map[key] = oc["signal"]

    # Cycle Score
    cs = db.table("cycle_score_history").select("score").order("date", desc=True).limit(1).execute()
    if cs.data:
        score = float(cs.data[0]["score"])
        if score <= 20: signal_map["CYCLE_SCORE"] = "extreme_bullish"
        elif score <= 40: signal_map["CYCLE_SCORE"] = "bullish"
        elif score <= 60: signal_map["CYCLE_SCORE"] = "neutral"
        elif score <= 80: signal_map["CYCLE_SCORE"] = "bearish"
        else: signal_map["CYCLE_SCORE"] = "extreme_bearish"

    # EMA signal
    ema_val = None
    for ind in indicators.data or []:
        if ind["indicator"] == "EMA_21":
            ema_val = float(ind["value"])
            break
    if ema_val and current_price:
        pct = ((current_price - ema_val) / ema_val) * 100
        if pct > 5: signal_map["EMA_21"] = "extreme_bullish"
        elif pct > 1: signal_map["EMA_21"] = "bullish"
        elif pct > -1: signal_map["EMA_21"] = "neutral"
        elif pct > -5: signal_map["EMA_21"] = "bearish"
        else: signal_map["EMA_21"] = "extreme_bearish"

    # Compute score for each timeframe
    today = date.today().isoformat()
    snapshots = 0

    for tf, weights in WEIGHTS.items():
        total_score = 0.0
        for key, weight in weights.items():
            if weight == 0:
                continue
            sig = signal_map.get(key)
            if sig:
                total_score += weight * SIGNAL_SCORE.get(sig, 0)

        direction = "LONG" if total_score > 0.25 else "SHORT" if total_score < -0.25 else "NEUTRAL"
        confidence = min(round(abs(total_score) * 100), 100)

        record = {
            "date": today,
            "timeframe": tf,
            "direction": direction,
            "confidence": confidence,
            "score": round(total_score, 4),
            "price_at_signal": current_price,
        }

        try:
            db.table("signal_history").upsert(
                record, on_conflict="date,timeframe"
            ).execute()
            snapshots += 1
        except Exception as e:
            console.print(f"  [yellow]Error storing {tf} snapshot: {e}[/yellow]")

    console.print(f"  [green]{snapshots} signal snapshots stored (price: ${current_price:,.0f})[/green]")


def evaluate_past_signals():
    """Evaluate past signals by comparing direction with actual price movement."""
    db = get_supabase()

    console.print("[bold]Signal Backtesting — Evaluation[/bold]")

    # Get signals without outcome that are old enough to evaluate
    pending = (
        db.table("signal_history")
        .select("*")
        .is_("outcome_1h", "null")
        .order("date", desc=False)
        .limit(200)
        .execute()
    )

    if not pending.data:
        console.print("  [dim]No pending signals to evaluate[/dim]")
        return

    evaluated = 0
    for signal in pending.data:
        signal_date = signal["date"]
        tf = signal["timeframe"]
        direction = signal["direction"]
        price_at = float(signal["price_at_signal"])

        # Get price at evaluation time
        eval_hours = EVAL_HOURS.get(tf, 24)
        eval_date = str(date.fromisoformat(signal_date) + timedelta(hours=eval_hours))

        later_price = (
            db.table("btc_prices")
            .select("close")
            .gte("date", eval_date)
            .order("date")
            .limit(1)
            .execute()
        )

        if not later_price.data:
            continue  # Not enough time has passed

        price_later = float(later_price.data[0]["close"])
        pct_change = ((price_later - price_at) / price_at) * 100

        # Determine outcome
        if direction == "LONG":
            outcome = "correct" if pct_change > 0 else "incorrect"
        elif direction == "SHORT":
            outcome = "correct" if pct_change < 0 else "incorrect"
        else:
            outcome = "correct" if abs(pct_change) < 1 else "incorrect"

        # Map timeframe to column
        col_price = f"price_{tf.lower()}_later"
        col_outcome = f"outcome_{tf.lower()}"

        # Use 1h column for all since schema has fixed columns
        update = {
            "outcome_1h": outcome,
            "price_1h_later": price_later,
        }

        try:
            db.table("signal_history").update(update).eq("id", signal["id"]).execute()
            evaluated += 1
        except Exception as e:
            console.print(f"  [yellow]Error evaluating signal {signal['id']}: {e}[/yellow]")

    console.print(f"  [green]{evaluated} signals evaluated[/green]")
