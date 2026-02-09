"""Backtesting — Store signal snapshots and evaluate past signals."""

from datetime import date, datetime, timedelta, timezone

from rich.console import Console

from btc_intel.db import get_supabase

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

    # Load v2 data (levels, fib, candle patterns) if available
    v2_data = _load_v2_data(db, current_price)

    # Compute score for each timeframe
    now = datetime.now(timezone.utc).isoformat()
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
            "date": now,
            "timeframe": tf,
            "direction": direction,
            "confidence": confidence,
            "score": round(total_score, 4),
            "price_at_signal": current_price,
        }

        # Enrich with v2 data if available
        if v2_data:
            nearby = v2_data.get("nearby_levels", [])
            record["nearby_levels"] = nearby[:10] if nearby else None
            record["fib_context"] = v2_data.get("fib_context", {}).get(tf)

            # Extended scoring
            ext = v2_data.get("extended", {}).get(tf)
            if ext:
                record["level_score"] = ext.get("bonus_levels", 0)
                record["candle_score"] = ext.get("bonus_candles", 0)
                record["onchain_bonus"] = ext.get("bonus_onchain", 0)
                record["penalties"] = ext.get("penalties", 0)
                record["extended_score"] = ext.get("final_score")

            # Setup info
            setup = v2_data.get("setups", {}).get(tf)
            if setup:
                record["setup_type"] = setup.get("type")
                record["candle_pattern"] = setup.get("candle_pattern")

            # TP/SL
            tpsl = v2_data.get("tpsl", {}).get(tf)
            if tpsl and tpsl.get("valid"):
                record["sl"] = tpsl["sl"]
                record["tp1"] = tpsl["tp1"]
                record["tp2"] = tpsl["tp2"]
                record["sl_method"] = tpsl.get("sl_method", "")
                record["tp1_method"] = tpsl.get("tp1_method", "")
                record["tp2_method"] = tpsl.get("tp2_method", "")

        # Skip NO ENTRY signals (NEUTRAL direction or score < 40)
        final_score = record.get("extended_score") or confidence
        if direction == "NEUTRAL" or final_score < 40:
            continue

        try:
            db.table("signal_history").upsert(
                record, on_conflict="date,timeframe"
            ).execute()
            snapshots += 1
        except Exception as e:
            console.print(f"  [yellow]Error storing {tf} snapshot: {e}[/yellow]")

    console.print(f"  [green]{snapshots} signal snapshots stored (price: ${current_price:,.0f})[/green]")


def evaluate_past_signals():
    """Evaluate past signals using TP/SL hits and price direction fallback.

    If a signal has TP1/TP2/SL defined, evaluation checks which was hit first
    by scanning hourly prices after the signal was created. Otherwise falls
    back to simple price direction comparison.
    """
    db = get_supabase()

    console.print("[bold]Signal Backtesting — Evaluation[/bold]")

    # Get signals without outcome that are old enough to evaluate
    pending = (
        db.table("signal_history")
        .select("*")
        .is_("outcome", "null")
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

        eval_hours = EVAL_HOURS.get(tf, 24)

        # Parse signal date (now TIMESTAMPTZ format)
        try:
            signal_dt = datetime.fromisoformat(signal_date.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            try:
                signal_dt = datetime.strptime(signal_date[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except (ValueError, AttributeError):
                continue

        eval_after = signal_dt + timedelta(hours=eval_hours)

        # Check if enough time has passed
        if datetime.now(timezone.utc) < eval_after:
            continue

        # Get prices between signal and evaluation window
        prices_after = (
            db.table("btc_prices")
            .select("date,close,high,low")
            .gte("date", signal_date[:10])
            .lte("date", (eval_after + timedelta(days=1)).strftime("%Y-%m-%d"))
            .order("date", desc=False)
            .execute()
        )

        if not prices_after.data:
            continue

        sl = signal.get("sl")
        tp1 = signal.get("tp1")
        tp2 = signal.get("tp2")

        # TP/SL-based evaluation (v2)
        if sl and tp1:
            sl = float(sl)
            tp1 = float(tp1)
            tp2 = float(tp2) if tp2 else None

            outcome, hit_at = _evaluate_tpsl(
                direction, price_at, sl, tp1, tp2,
                prices_after.data, signal_dt
            )
        else:
            # Fallback: simple price direction
            price_later = float(prices_after.data[-1]["close"])
            pct_change = ((price_later - price_at) / price_at) * 100

            if direction == "LONG":
                outcome = "correct" if pct_change > 0 else "incorrect"
            elif direction == "SHORT":
                outcome = "correct" if pct_change < 0 else "incorrect"
            else:
                outcome = "correct" if abs(pct_change) < 1 else "incorrect"
            hit_at = None

        update = {"outcome": outcome}
        if hit_at:
            update["hit_at"] = hit_at

        try:
            db.table("signal_history").update(update).eq("id", signal["id"]).execute()
            evaluated += 1
        except Exception as e:
            console.print(f"  [yellow]Error evaluating signal {signal['id']}: {e}[/yellow]")

    console.print(f"  [green]{evaluated} signals evaluated[/green]")


def _evaluate_tpsl(
    direction: str,
    entry: float,
    sl: float,
    tp1: float,
    tp2: float | None,
    prices: list[dict],
    signal_dt: datetime,
) -> tuple[str, str | None]:
    """Check which target (SL/TP1/TP2) was hit first.

    Returns:
        (outcome, hit_at_date)
        outcome: "tp1_hit", "tp2_hit", "sl_hit", "pending"
    """
    tp1_hit = False

    for row in prices:
        high = float(row.get("high", row.get("close", 0)))
        low = float(row.get("low", row.get("close", 0)))
        row_date = row.get("date", "")

        if direction == "LONG":
            # SL hit: price went below SL
            if low <= sl:
                return "sl_hit", row_date
            # TP2 hit (after TP1): price went above TP2
            if tp2 and tp1_hit and high >= tp2:
                return "tp2_hit", row_date
            # TP1 hit: price went above TP1
            if high >= tp1:
                tp1_hit = True
        else:  # SHORT
            # SL hit: price went above SL
            if high >= sl:
                return "sl_hit", row_date
            # TP2 hit (after TP1)
            if tp2 and tp1_hit and low <= tp2:
                return "tp2_hit", row_date
            # TP1 hit
            if low <= tp1:
                tp1_hit = True

    if tp1_hit:
        return "tp1_hit", None

    return "pending", None


def _load_v2_data(db, current_price: float) -> dict | None:
    """Load v2 trading data (levels, fib, confluences) for enriching snapshots."""
    try:
        # Load levels
        levels_res = db.table("price_levels").select("price,type,strength,classification").order("strength", desc=True).limit(20).execute()
        nearby_levels = [
            {"price": r["price"], "type": r["type"], "strength": r["strength"], "class": r.get("classification")}
            for r in (levels_res.data or [])
        ]

        # Load fib data per timeframe (levels stored as JSONB)
        fib_res = db.table("fibonacci_levels").select("timeframe,type,direction,levels").execute()
        fib_context = {}
        for row in (fib_res.data or []):
            tf = row["timeframe"]
            if tf not in fib_context:
                fib_context[tf] = {"retracements": {}, "extensions": {}, "direction": row.get("direction")}
            if row["type"] == "retracement":
                fib_context[tf]["retracements"] = row.get("levels", {})
            else:
                fib_context[tf]["extensions"] = row.get("levels", {})

        return {
            "nearby_levels": nearby_levels,
            "fib_context": fib_context,
        }
    except Exception:
        return None
