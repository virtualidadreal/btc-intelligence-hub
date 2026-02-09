"""Backtesting — Store signal snapshots and evaluate past signals."""

from datetime import date, datetime, timedelta, timezone

from rich.console import Console

from btc_intel.db import get_supabase
from btc_intel.trading import CandlePattern, PriceLevel, SwingPoint
from btc_intel.trading.extended_scorer import ExtendedSignalScorer
from btc_intel.trading.enhanced_tpsl import EnhancedTPSL

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

# ATR scaling from daily ATR to approximate other timeframes
ATR_SCALE = {"1H": 0.15, "4H": 0.35, "1D": 1.0, "1W": 2.0}

# HTF lookup for penalty checks
HTF_MAP = {"1H": "4H", "4H": "1D", "1D": "1W", "1W": None}


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

    # Get latest indicators (include ATR_14 for TP/SL)
    indicators = (
        db.table("technical_indicators")
        .select("indicator,value,signal")
        .in_("indicator", ["RSI_14", "MACD", "SMA_CROSS", "BB_UPPER", "BB_LOWER", "EMA_21", "ATR_14"])
        .order("date", desc=True)
        .limit(30)
    ).execute()

    signal_map = {}
    indicator_values = {}  # Numeric values for v2 scoring
    for ind in indicators.data or []:
        name = ind["indicator"]
        if name not in signal_map and ind.get("signal"):
            signal_map[name] = ind["signal"]
        if name not in indicator_values and ind.get("value") is not None:
            try:
                indicator_values[name] = float(ind["value"])
            except (ValueError, TypeError):
                pass

    # BB composite signal
    if "BB_UPPER" in signal_map:
        signal_map["BB"] = signal_map.pop("BB_UPPER")
    elif "BB_LOWER" in signal_map:
        signal_map["BB"] = signal_map.pop("BB_LOWER")

    # Fear & Greed (keep numeric value for onchain scoring)
    fg_value = None
    fg = db.table("sentiment_data").select("value").eq("metric", "FEAR_GREED").order("date", desc=True).limit(1).execute()
    if fg.data:
        fg_value = int(fg.data[0]["value"])
        if fg_value <= 15: signal_map["FEAR_GREED"] = "extreme_bearish"
        elif fg_value <= 30: signal_map["FEAR_GREED"] = "bearish"
        elif fg_value <= 55: signal_map["FEAR_GREED"] = "neutral"
        elif fg_value <= 80: signal_map["FEAR_GREED"] = "bullish"
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
    ema_val = indicator_values.get("EMA_21")
    if ema_val and current_price:
        pct = ((current_price - ema_val) / ema_val) * 100
        if pct > 5: signal_map["EMA_21"] = "extreme_bullish"
        elif pct > 1: signal_map["EMA_21"] = "bullish"
        elif pct > -1: signal_map["EMA_21"] = "neutral"
        elif pct > -5: signal_map["EMA_21"] = "bearish"
        else: signal_map["EMA_21"] = "extreme_bearish"

    # Load v2 data (levels, fib, ATR, BB, on-chain values)
    v2_data = _load_v2_data(db, current_price, indicator_values, fg_value)

    # ── PASS 1: Compute base confidence + direction for all TFs ──
    base_signals = {}
    now = datetime.now(timezone.utc).isoformat()

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
        base_signals[tf] = {
            "direction": direction,
            "confidence": confidence,
            "score": round(total_score, 4),
        }

    # ── PASS 2: Extended scoring + TP/SL + store ──
    scorer = ExtendedSignalScorer()
    tpsl_calc = EnhancedTPSL()
    snapshots = 0

    for tf in WEIGHTS:
        base = base_signals[tf]
        direction = base["direction"]
        confidence = base["confidence"]

        # Skip NEUTRAL
        if direction == "NEUTRAL":
            continue

        record = {
            "date": now,
            "timeframe": tf,
            "direction": direction,
            "confidence": confidence,
            "score": base["score"],
            "price_at_signal": current_price,
        }

        # Enrich with v2 data if available
        if v2_data:
            nearby = v2_data.get("nearby_levels_raw", [])
            record["nearby_levels"] = nearby[:10] if nearby else None
            record["fib_context"] = v2_data.get("fib_context", {}).get(tf)

            # ── Extended Scoring ──
            levels = v2_data.get("levels", [])
            fibs_for_tf = v2_data.get("fibs_list", {}).get(tf)
            confluences = v2_data.get("confluences", [])
            candle_patterns = v2_data.get("candle_patterns", [])
            onchain_data = v2_data.get("onchain", {})
            ind_data = v2_data.get("indicators", {})

            # HTF direction for penalty check
            htf_tf = HTF_MAP.get(tf)
            htf_direction = base_signals.get(htf_tf, {}).get("direction") if htf_tf else None

            try:
                ext_result = scorer.calculate(
                    base_confidence=confidence,
                    price=current_price,
                    direction=direction,
                    timeframe=tf,
                    levels=levels,
                    fibs=fibs_for_tf,
                    confluences=confluences,
                    candle_patterns=candle_patterns,
                    onchain=onchain_data,
                    indicators=ind_data,
                    htf_direction=htf_direction,
                )
                record["level_score"] = ext_result.get("bonus_levels", 0)
                record["candle_score"] = ext_result.get("bonus_candles", 0)
                record["onchain_bonus"] = ext_result.get("bonus_onchain", 0)
                record["penalties"] = ext_result.get("penalties", 0)
                record["extended_score"] = ext_result.get("final_score")
            except Exception as e:
                console.print(f"  [yellow]Extended scorer error for {tf}: {e}[/yellow]")

            # ── TP/SL Calculation ──
            atr_daily = v2_data.get("atr", 0)
            atr_tf = atr_daily * ATR_SCALE.get(tf, 1.0)
            bb = v2_data.get("bb", {})
            swing_points = v2_data.get("swing_points", [])

            if atr_tf > 0:
                try:
                    tpsl_result = tpsl_calc.calculate(
                        entry=current_price,
                        direction=direction,
                        timeframe=tf,
                        atr=atr_tf,
                        bb=bb,
                        levels=levels,
                        fibs=fibs_for_tf,
                        swing_points=swing_points,
                    )
                    if tpsl_result.get("valid"):
                        record["sl"] = tpsl_result["sl"]
                        record["tp1"] = tpsl_result["tp1"]
                        record["tp2"] = tpsl_result["tp2"]
                        record["sl_method"] = tpsl_result.get("sl_method", "")
                        record["tp1_method"] = tpsl_result.get("tp1_method", "")
                        record["tp2_method"] = tpsl_result.get("tp2_method", "")
                    else:
                        console.print(f"  [dim]{tf} TP/SL invalid: {tpsl_result.get('reason', '?')}[/dim]")
                except Exception as e:
                    console.print(f"  [yellow]TP/SL error for {tf}: {e}[/yellow]")

        # Classify signal quality using extended_score if available
        ext_score = record.get("extended_score")
        display_score = ext_score if ext_score is not None else confidence
        if display_score >= 85:
            classification = "PREMIUM"
        elif display_score >= 70:
            classification = "STRONG"
        elif display_score >= 55:
            classification = "VALID"
        elif display_score >= 40:
            classification = "WEAK"
        else:
            classification = "NO ENTRY"

        # Use base confidence for storage threshold (backwards compatible)
        # Extended score is informational — penalties shouldn't block storage
        if confidence < 55:
            continue

        record["classification"] = classification

        # Log the enrichment
        tp1 = record.get("tp1")
        sl = record.get("sl")
        tp1_str = f"${tp1:,.0f}" if tp1 else "N/A"
        sl_str = f"${sl:,.0f}" if sl else "N/A"
        ext_str = f"ext={display_score}" if ext_score is not None else "ext=N/A"
        console.print(f"  {tf} {direction} conf={confidence} {ext_str} tp1={tp1_str} sl={sl_str} [{classification}]")

        try:
            db.table("signal_history").upsert(
                record, on_conflict="date,timeframe"
            ).execute()
            snapshots += 1
        except Exception as e:
            # If classification column doesn't exist yet, retry without it
            if "classification" in str(e):
                record.pop("classification", None)
                try:
                    db.table("signal_history").upsert(
                        record, on_conflict="date,timeframe"
                    ).execute()
                    snapshots += 1
                except Exception as e2:
                    console.print(f"  [yellow]Error storing {tf} snapshot: {e2}[/yellow]")
            else:
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


def _load_v2_data(
    db, current_price: float, indicator_values: dict, fg_value: int | None
) -> dict | None:
    """Load v2 trading data for enriching snapshots with extended scoring and TP/SL."""
    try:
        # ── Price Levels as PriceLevel dataclasses ──
        levels_res = (
            db.table("price_levels")
            .select("*")
            .eq("status", "active")
            .order("strength", desc=True)
            .limit(30)
            .execute()
        )
        levels: list[PriceLevel] = []
        nearby_levels_raw: list[dict] = []
        for r in levels_res.data or []:
            src = r.get("source", [])
            if isinstance(src, str):
                src = [src]
            tfs = r.get("timeframes", [])
            if isinstance(tfs, str):
                tfs = [tfs]

            lv = PriceLevel(
                price=float(r["price"]),
                type=r.get("type", "support"),
                strength=int(r.get("strength", 0)),
                source=src or [],
                timeframes=tfs or [],
                touch_count=int(r.get("touch_count", 0)),
                last_touch_date=r.get("last_touch_date"),
                visible_in_timeframes=len(tfs) if tfs else 1,
                coincides_with_fib=r.get("fib_level") is not None,
                fib_level=float(r["fib_level"]) if r.get("fib_level") else None,
                is_role_flip=bool(r.get("is_role_flip", False)),
                flip_date=None,
                is_high_volume_zone=bool(r.get("is_high_volume", False)),
                is_psychological=bool(r.get("is_psychological", False)),
            )
            levels.append(lv)
            nearby_levels_raw.append({
                "price": r["price"],
                "type": r.get("type"),
                "strength": r.get("strength"),
                "class": r.get("classification"),
            })

        # ── Fibonacci levels (convert JSONB dict → list format for scorer/tpsl) ──
        fib_res = (
            db.table("fibonacci_levels")
            .select("timeframe,type,direction,levels,swing_low,swing_high,swing_low_date,swing_high_date")
            .execute()
        )
        fib_context: dict = {}  # Raw for storage in signal_history
        fibs_list: dict = {}    # Converted for scorer/tpsl
        swing_points: list[SwingPoint] = []
        seen_swings: set[tuple] = set()

        for row in fib_res.data or []:
            tf = row["timeframe"]
            if tf not in fib_context:
                fib_context[tf] = {"retracements": {}, "extensions": {}, "direction": row.get("direction")}
            if tf not in fibs_list:
                fibs_list[tf] = {"retracements": [], "extensions": [], "direction": row.get("direction")}

            # Convert JSONB dict → list of {ratio, price}
            raw_levels = row.get("levels", {})
            if isinstance(raw_levels, dict):
                converted = [
                    {"ratio": float(k), "price": float(v)}
                    for k, v in raw_levels.items()
                ]
            elif isinstance(raw_levels, list):
                converted = raw_levels
            else:
                converted = []

            if row["type"] == "retracement":
                fib_context[tf]["retracements"] = raw_levels
                fibs_list[tf]["retracements"] = converted
            else:
                fib_context[tf]["extensions"] = raw_levels
                fibs_list[tf]["extensions"] = converted

            # Extract swing points from fib data
            sw_low = row.get("swing_low")
            sw_high = row.get("swing_high")
            if sw_low:
                key = ("low", float(sw_low))
                if key not in seen_swings:
                    seen_swings.add(key)
                    swing_points.append(SwingPoint(
                        price=float(sw_low),
                        type="low",
                        date=row.get("swing_low_date", ""),
                        timeframe=tf,
                    ))
            if sw_high:
                key = ("high", float(sw_high))
                if key not in seen_swings:
                    seen_swings.add(key)
                    swing_points.append(SwingPoint(
                        price=float(sw_high),
                        type="high",
                        date=row.get("swing_high_date", ""),
                        timeframe=tf,
                    ))

        # ── Confluence zones ──
        confluences: list[dict] = []
        try:
            conf_res = (
                db.table("confluence_zones")
                .select("price_mid,num_timeframes,type")
                .eq("status", "active")
                .order("num_timeframes", desc=True)
                .limit(10)
                .execute()
            )
            for c in conf_res.data or []:
                confluences.append({
                    "price": float(c["price_mid"]),
                    "num_timeframes": int(c.get("num_timeframes", 1)),
                    "type": c.get("type", ""),
                })
        except Exception:
            pass

        # ── ATR (daily) ──
        atr = indicator_values.get("ATR_14", 0)

        # ── Bollinger Bands ──
        bb: dict = {}
        bb_upper = indicator_values.get("BB_UPPER")
        bb_lower = indicator_values.get("BB_LOWER")
        if bb_upper:
            bb["upper"] = bb_upper
        if bb_lower:
            bb["lower"] = bb_lower
        # Estimate mid if we have upper and lower
        if bb_upper and bb_lower:
            bb["mid"] = (bb_upper + bb_lower) / 2

        # ── On-chain data for scorer ──
        onchain: dict = {}
        if fg_value is not None:
            onchain["fear_greed"] = fg_value
        # Try to get funding rate and OI
        try:
            deriv = (
                db.table("onchain_metrics")
                .select("metric,value")
                .in_("metric", ["FUNDING_RATE", "OI_CHANGE_PCT"])
                .order("date", desc=True)
                .limit(4)
                .execute()
            )
            for d in deriv.data or []:
                if d["metric"] == "FUNDING_RATE" and d.get("value") is not None:
                    onchain.setdefault("funding_rate", float(d["value"]))
                elif d["metric"] == "OI_CHANGE_PCT" and d.get("value") is not None:
                    onchain.setdefault("oi_change_pct", float(d["value"]))
        except Exception:
            pass

        # ── Indicators for scorer ──
        ind_for_scorer = {
            "ema_21": indicator_values.get("EMA_21", 0),
        }

        return {
            "levels": levels,
            "nearby_levels_raw": nearby_levels_raw,
            "fib_context": fib_context,
            "fibs_list": fibs_list,
            "confluences": confluences,
            "candle_patterns": [],  # No dedicated table yet
            "swing_points": swing_points,
            "atr": atr,
            "bb": bb,
            "onchain": onchain,
            "indicators": ind_for_scorer,
        }
    except Exception as e:
        console.print(f"  [yellow]Error loading v2 data: {e}[/yellow]")
        return None
