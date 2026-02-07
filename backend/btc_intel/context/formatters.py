"""Formatters — Converts Supabase data into readable text."""

from datetime import date, timedelta

def format_price_section(db) -> str:
    """Current price + 24h/7d/30d changes."""
    prices = (
        db.table("btc_prices")
        .select("date,close")
        .order("date", desc=True)
        .limit(31)
        .execute()
    )
    if not prices.data:
        return "## Price\nNo price data.\n"

    current = float(prices.data[0]["close"])
    current_date = prices.data[0]["date"]

    changes = {}
    for label, days in [("24h", 1), ("7d", 7), ("30d", 30)]:
        if len(prices.data) > days:
            prev = float(prices.data[days]["close"])
            pct = (current - prev) / prev * 100
            changes[label] = f"{pct:+.2f}%"
        else:
            changes[label] = "N/A"

    lines = [
        "## BTC Price",
        f"- Current: **${current:,.2f}** ({current_date})",
        f"- Change 24h: {changes['24h']} | 7d: {changes['7d']} | 30d: {changes['30d']}",
        "",
    ]
    return "\n".join(lines)


def format_cycle_score_section(db) -> str:
    """Cycle Score + current phase."""
    cs = (
        db.table("cycle_score_history")
        .select("date,score,phase")
        .order("date", desc=True)
        .limit(2)
        .execute()
    )
    if not cs.data:
        return "## Cycle Score\nNo data.\n"

    current = cs.data[0]
    prev_score = cs.data[1]["score"] if len(cs.data) > 1 else None
    delta = f" ({current['score'] - prev_score:+d})" if prev_score is not None else ""

    phase_labels = {
        "capitulation": "CAPITULATION",
        "accumulation": "ACCUMULATION",
        "early_bull": "EARLY BULL",
        "mid_bull": "MID BULL",
        "late_bull": "LATE BULL",
        "distribution": "DISTRIBUTION",
        "euphoria": "EUPHORIA",
    }

    phase_label = phase_labels.get(current["phase"], current["phase"].upper())

    return (
        f"## Cycle Score\n"
        f"- Score: **{current['score']}/100**{delta} — Phase: **{phase_label}**\n"
    )


def format_technical_section(db, brief: bool = True) -> str:
    """Technical indicators."""
    indicators = {}
    for ind in ["RSI_14", "MACD", "SMA_CROSS", "BB_UPPER", "BB_LOWER", "ATR_14"]:
        res = (
            db.table("technical_indicators")
            .select("indicator,value,signal")
            .eq("indicator", ind)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            indicators[ind] = res.data[0]

    if not indicators:
        return "- **Technical:** No data\n"

    if brief:
        signals = [f"{k}: {v['signal']}" for k, v in indicators.items() if v.get("signal")]
        bullish = sum(1 for v in indicators.values() if "bullish" in (v.get("signal") or ""))
        bearish = sum(1 for v in indicators.values() if "bearish" in (v.get("signal") or ""))
        return f"- **Technical:** {bullish} bullish, {bearish} bearish ({', '.join(signals[:3])})\n"

    lines = ["## Technical Indicators\n"]
    for name, data in indicators.items():
        val = data.get("value", "N/A")
        sig = data.get("signal", "neutral")
        if isinstance(val, (int, float)):
            val = f"{val:,.2f}" if abs(val) > 1 else f"{val:.6f}"
        lines.append(f"- **{name}:** {val} — Signal: {sig}")

    # RSI history 7d/30d
    if not brief:
        for period, days in [("7d", 7), ("30d", 30)]:
            rsi_hist = (
                db.table("technical_indicators")
                .select("value")
                .eq("indicator", "RSI_14")
                .order("date", desc=True)
                .limit(days + 1)
                .execute()
            )
            if rsi_hist.data and len(rsi_hist.data) > days:
                prev_rsi = float(rsi_hist.data[days]["value"])
                curr_rsi = float(rsi_hist.data[0]["value"])
                lines.append(f"- RSI {period} ago: {prev_rsi:.1f} (now: {curr_rsi:.1f})")

    lines.append("")
    return "\n".join(lines)


def format_onchain_section(db, brief: bool = True) -> str:
    """On-chain metrics."""
    metrics = {}
    for metric in ["HASH_RATE_MOM_30D", "NVT_RATIO"]:
        res = (
            db.table("onchain_metrics")
            .select("metric,value,signal")
            .eq("metric", metric)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            metrics[metric] = res.data[0]

    if not metrics:
        return "- **On-Chain:** No data\n"

    if brief:
        signals = [f"{k}: {v['signal']}" for k, v in metrics.items() if v.get("signal")]
        return f"- **On-Chain:** {', '.join(signals)}\n"

    lines = ["## On-Chain Metrics\n"]
    for name, data in metrics.items():
        val = data.get("value", "N/A")
        sig = data.get("signal", "neutral")
        if isinstance(val, (int, float)):
            val = f"{val:.4f}"
        lines.append(f"- **{name}:** {val} — Signal: {sig}")
    lines.append("")
    return "\n".join(lines)


def format_macro_section(db, brief: bool = True) -> str:
    """Macro correlations."""
    corrs = {}
    for pair in ["CORR_BTC_SPX_30D", "CORR_BTC_GOLD_30D", "CORR_BTC_DXY_30D"]:
        res = (
            db.table("technical_indicators")
            .select("indicator,value")
            .eq("indicator", pair)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            corrs[pair] = float(res.data[0]["value"])

    if not corrs:
        return "- **Macro:** No correlation data\n"

    if brief:
        parts = []
        for name, val in corrs.items():
            short = name.replace("CORR_BTC_", "").replace("_30D", "")
            parts.append(f"{short}: {val:+.2f}")
        return f"- **Macro (corr 30d):** {', '.join(parts)}\n"

    lines = ["## Macro Correlations\n"]
    for name, val in corrs.items():
        label = name.replace("CORR_BTC_", "").replace("_", " ")
        strength = "strong" if abs(val) > 0.6 else "moderate" if abs(val) > 0.3 else "weak"
        direction = "positive" if val > 0 else "negative"
        lines.append(f"- **{label}:** {val:+.4f} ({direction} {strength})")

    # Also fetch 90d correlations
    for pair in ["CORR_BTC_SPX_90D", "CORR_BTC_GOLD_90D", "CORR_BTC_DXY_90D"]:
        res = (
            db.table("technical_indicators")
            .select("indicator,value")
            .eq("indicator", pair)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            val = float(res.data[0]["value"])
            label = pair.replace("CORR_BTC_", "").replace("_", " ")
            lines.append(f"- **{label}:** {val:+.4f}")

    lines.append("")
    return "\n".join(lines)


def format_sentiment_section(db, brief: bool = True) -> str:
    """Sentiment."""
    fg = (
        db.table("sentiment_data")
        .select("metric,value")
        .eq("metric", "FEAR_GREED")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    fg30 = (
        db.table("sentiment_data")
        .select("metric,value")
        .eq("metric", "FEAR_GREED_30D")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )

    fg_val = int(float(fg.data[0]["value"])) if fg.data else None
    fg30_val = round(float(fg30.data[0]["value"]), 1) if fg30.data else None

    if fg_val is None:
        return "- **Sentiment:** No data\n"

    # Classify
    if fg_val <= 20:
        label = "Extreme Fear"
    elif fg_val <= 40:
        label = "Fear"
    elif fg_val <= 60:
        label = "Neutral"
    elif fg_val <= 80:
        label = "Greed"
    else:
        label = "Extreme Greed"

    if brief:
        ma_str = f" (MA30d: {fg30_val})" if fg30_val else ""
        return f"- **Sentiment:** Fear & Greed: {fg_val} ({label}){ma_str}\n"

    lines = ["## Sentiment\n"]
    lines.append(f"- **Fear & Greed Index:** {fg_val} — {label}")
    if fg30_val:
        lines.append(f"- **Fear & Greed 30d MA:** {fg30_val}")

    # Trend
    fg_hist = (
        db.table("sentiment_data")
        .select("value")
        .eq("metric", "FEAR_GREED")
        .order("date", desc=True)
        .limit(8)
        .execute()
    )
    if fg_hist.data and len(fg_hist.data) >= 7:
        week_ago = int(float(fg_hist.data[6]["value"]))
        diff = fg_val - week_ago
        lines.append(f"- **7d Change:** {diff:+d} (from {week_ago} to {fg_val})")

    lines.append("")
    return "\n".join(lines)


def format_confluences_section(db) -> str:
    """Detected confluences."""
    from btc_intel.analysis.confluence_detector import detect_confluences

    try:
        result = detect_confluences()
    except Exception:
        return ""

    if not result.get("confluences"):
        return (
            f"## Confluences\n"
            f"- Bullish: {result.get('bullish_count', 0)} | "
            f"Bearish: {result.get('bearish_count', 0)} | "
            f"Neutral: {result.get('neutral_count', 0)}\n"
            f"- No strong confluences detected\n"
        )

    lines = ["## Confluences\n"]
    for c in result["confluences"]:
        lines.append(f"- **{c['type'].upper()}:** {c['message']}")
    lines.append("")
    return "\n".join(lines)


def format_alerts_section(db, detailed: bool = False) -> str:
    """Active alerts."""
    alerts = (
        db.table("alerts")
        .select("*")
        .eq("acknowledged", False)
        .order("date", desc=True)
        .limit(10)
        .execute()
    )
    if not alerts.data:
        return "## Alerts\n- No active alerts\n"

    lines = [f"## Alerts ({len(alerts.data)} active)\n"]
    for alert in alerts.data:
        sev = alert["severity"].upper()
        if detailed:
            lines.append(f"- [{sev}] **{alert['title']}**")
            lines.append(f"  {alert.get('description', '')}")
            lines.append(f"  Type: {alert['type']} | Signal: {alert.get('signal', 'N/A')}")
        else:
            lines.append(f"- [{sev}] {alert['title']}")
    lines.append("")
    return "\n".join(lines)


def format_conclusions_section(db, limit: int = 3, category: str | None = None) -> str:
    """Recent conclusions."""
    query = (
        db.table("conclusions")
        .select("title,content,category,confidence,created_at")
        .eq("status", "active")
        .order("created_at", desc=True)
    )
    if category:
        query = query.eq("category", category)

    result = query.limit(limit).execute()

    if not result.data:
        label = f" ({category})" if category else ""
        return f"## Recent Conclusions{label}\n- No conclusions recorded\n"

    lines = [f"## Recent Conclusions ({len(result.data)})\n"]
    for c in result.data:
        conf = c.get("confidence", "?")
        cat = c.get("category", "general")
        lines.append(f"- [{cat}] **{c['title']}** (confidence: {conf}/10)")
        if c.get("content"):
            lines.append(f"  {c['content'][:150]}...")
    lines.append("")
    return "\n".join(lines)


def format_risk_section(db) -> str:
    """Risk metrics."""
    from btc_intel.analysis.risk import analyze_risk

    try:
        risk = analyze_risk()
    except Exception:
        return ""

    if not risk:
        return ""

    lines = ["## Risk\n"]
    lines.append(f"- Current drawdown: {risk.get('current_drawdown', 'N/A')}%")
    lines.append(f"- 30d volatility: {risk.get('volatility_30d', 'N/A')}%")
    lines.append(f"- Sharpe (365d): {risk.get('sharpe_365d', 'N/A')}")
    lines.append(f"- VaR 95%: {risk.get('var_95', 'N/A')}%")
    if risk.get("beta_vs_spx"):
        lines.append(f"- Beta vs SPX: {risk['beta_vs_spx']}")
    lines.append("")
    return "\n".join(lines)


def format_cycles_section(db) -> str:
    """Detailed cycle analysis."""
    from btc_intel.analysis.cycles import analyze_cycles

    try:
        cycles = analyze_cycles()
    except Exception:
        return ""

    if not cycles:
        return ""

    lines = ["## Cycle Analysis\n"]
    lines.append(f"- Cycle: #{cycles.get('cycle_number', '?')}")
    lines.append(f"- Last halving: {cycles.get('last_halving', 'N/A')}")
    lines.append(f"- Days since halving: {cycles.get('days_since_halving', 'N/A')}")
    lines.append(f"- Price at halving: ${cycles.get('halving_price', 0):,.2f}")
    lines.append(f"- Current price: ${cycles.get('current_price', 0):,.2f}")
    lines.append(f"- ROI since halving: {cycles.get('roi_since_halving', 0):+.2f}%")

    if cycles.get("comparisons"):
        lines.append("\n### Comparison with previous cycles")
        for name, comp in cycles["comparisons"].items():
            lines.append(f"- {name} - day {comp['days']}: ROI {comp['roi']:+.2f}%")

    lines.append("")
    return "\n".join(lines)


def format_events_section(db) -> str:
    """Upcoming or recent events."""
    today = str(date.today())
    week_ahead = str(date.today() + timedelta(days=7))

    events = (
        db.table("events")
        .select("date,title,category,impact")
        .gte("date", today)
        .lte("date", week_ahead)
        .order("date")
        .limit(10)
        .execute()
    )

    if not events.data:
        return ""

    lines = ["## Upcoming Events\n"]
    for e in events.data:
        impact = e.get("impact", "N/A")
        lines.append(f"- [{e['date']}] **{e['title']}** (type: {e.get('category', 'N/A')}, impact: {impact})")
    lines.append("")
    return "\n".join(lines)


def format_signal_changes(db) -> str:
    """Signals that changed since yesterday."""
    yesterday = str(date.today() - timedelta(days=1))
    today = str(date.today())

    changes = []

    # Check technical indicators
    for ind in ["RSI_14", "MACD", "SMA_CROSS"]:
        today_sig = (
            db.table("technical_indicators")
            .select("signal")
            .eq("indicator", ind)
            .lte("date", today)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        yest_sig = (
            db.table("technical_indicators")
            .select("signal")
            .eq("indicator", ind)
            .lte("date", yesterday)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )

        if today_sig.data and yest_sig.data:
            t = today_sig.data[0]["signal"]
            y = yest_sig.data[0]["signal"]
            if t != y:
                changes.append(f"- **{ind}:** {y} -> {t}")

    if not changes:
        return "## Changes Since Yesterday\n- No significant signal changes\n"

    lines = ["## Changes Since Yesterday\n"] + changes + [""]
    return "\n".join(lines)


def format_compare_section(db, date1: str, date2: str) -> str:
    """Compare two dates side-by-side."""
    lines = [f"## Comparison: {date1} vs {date2}\n"]

    # Prices
    for d in [date1, date2]:
        price = (
            db.table("btc_prices")
            .select("close")
            .lte("date", d)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if price.data:
            lines.append(f"- Price ({d}): ${float(price.data[0]['close']):,.2f}")

    # RSI
    lines.append("\n### RSI")
    for d in [date1, date2]:
        rsi = (
            db.table("technical_indicators")
            .select("value,signal")
            .eq("indicator", "RSI_14")
            .lte("date", d)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if rsi.data:
            lines.append(f"- RSI ({d}): {float(rsi.data[0]['value']):.1f} — {rsi.data[0]['signal']}")

    # Cycle Score
    lines.append("\n### Cycle Score")
    for d in [date1, date2]:
        cs = (
            db.table("cycle_score_history")
            .select("score,phase")
            .lte("date", d)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if cs.data:
            lines.append(f"- Score ({d}): {cs.data[0]['score']}/100 — {cs.data[0]['phase']}")

    # Fear & Greed
    lines.append("\n### Sentiment")
    for d in [date1, date2]:
        fg = (
            db.table("sentiment_data")
            .select("value")
            .eq("metric", "FEAR_GREED")
            .lte("date", d)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if fg.data:
            lines.append(f"- Fear & Greed ({d}): {int(float(fg.data[0]['value']))}")

    lines.append("")
    return "\n".join(lines)
