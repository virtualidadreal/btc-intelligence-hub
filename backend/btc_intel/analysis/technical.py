"""Technical Engine — Calculates technical indicators."""

from datetime import date

import pandas as pd
import pandas_ta as ta
from rich.console import Console

from btc_intel.analysis.signal_classifier import SignalClassifier
from btc_intel.db import get_supabase

console = Console()
classifier = SignalClassifier()


def analyze_technical() -> int:
    """Calculate all technical indicators and save to Supabase."""
    db = get_supabase()
    console.print("[cyan]Calculating technical indicators...[/cyan]")

    # Cargar precios (paginated to avoid PostgREST row limit)
    all_prices = []
    page_size = 1000
    offset = 0
    while True:
        result = db.table("btc_prices").select("date,open,high,low,close,volume").order("date").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_prices.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    if not all_prices:
        console.print("[yellow]No price data[/yellow]")
        return 0

    console.print(f"[cyan]Loaded {len(all_prices)} prices[/cyan]")
    df = pd.DataFrame(all_prices)
    df["close"] = df["close"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)
    df["open"] = df["open"].astype(float)
    df["volume"] = df["volume"].astype(float).fillna(0)

    rows = []

    # RSI(14)
    rsi = ta.rsi(df["close"], length=14)
    if rsi is not None:
        for i, (idx, val) in enumerate(rsi.items()):
            if pd.notna(val):
                sig = classifier.classify_rsi(val)
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "RSI_14",
                    "value": round(float(val), 8),
                    "signal": sig["signal"],
                    "params": {"period": 14},
                })

    # SMA(50)
    sma50 = ta.sma(df["close"], length=50)
    if sma50 is not None:
        for i, val in enumerate(sma50):
            if pd.notna(val):
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "SMA_50",
                    "value": round(float(val), 8),
                    "signal": "neutral",
                    "params": {"period": 50},
                })

    # SMA(200)
    sma200 = ta.sma(df["close"], length=200)
    if sma200 is not None:
        for i, val in enumerate(sma200):
            if pd.notna(val):
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "SMA_200",
                    "value": round(float(val), 8),
                    "signal": "neutral",
                    "params": {"period": 200},
                })

    # SMA Cross signal
    if sma50 is not None and sma200 is not None:
        for i in range(len(df)):
            s50 = sma50.iloc[i] if i < len(sma50) else None
            s200 = sma200.iloc[i] if i < len(sma200) else None
            if pd.notna(s50) and pd.notna(s200):
                sig = classifier.classify_sma_cross(float(s50), float(s200))
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "SMA_CROSS",
                    "value": round(float(s50 - s200), 8),
                    "signal": sig["signal"],
                    "params": {"sma50": 50, "sma200": 200},
                })

    # EMA(21)
    ema21 = ta.ema(df["close"], length=21)
    if ema21 is not None:
        for i, val in enumerate(ema21):
            if pd.notna(val):
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "EMA_21",
                    "value": round(float(val), 8),
                    "signal": "neutral",
                    "params": {"period": 21},
                })

    # MACD(12,26,9)
    macd_df = ta.macd(df["close"], fast=12, slow=26, signal=9)
    if macd_df is not None and not macd_df.empty:
        for i in range(len(macd_df)):
            m = macd_df.iloc[i]
            macd_val = m.get("MACD_12_26_9")
            signal_val = m.get("MACDs_12_26_9")
            hist_val = m.get("MACDh_12_26_9")
            if pd.notna(macd_val) and pd.notna(signal_val) and pd.notna(hist_val):
                sig = classifier.classify_macd(float(macd_val), float(signal_val), float(hist_val))
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "MACD",
                    "value": round(float(macd_val), 8),
                    "signal": sig["signal"],
                    "params": {"fast": 12, "slow": 26, "signal": 9},
                })
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "MACD_SIGNAL",
                    "value": round(float(signal_val), 8),
                    "signal": sig["signal"],
                })
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "MACD_HIST",
                    "value": round(float(hist_val), 8),
                    "signal": sig["signal"],
                })

    # Bollinger Bands(20,2)
    bb = ta.bbands(df["close"], length=20, std=2)
    if bb is not None and not bb.empty:
        for i in range(len(bb)):
            row_bb = bb.iloc[i]
            upper = row_bb.get("BBU_20_2.0")
            mid = row_bb.get("BBM_20_2.0")
            lower = row_bb.get("BBL_20_2.0")
            if pd.notna(upper) and pd.notna(lower) and pd.notna(mid):
                price = df.iloc[i]["close"]
                sig = classifier.classify_bollinger(float(price), float(upper), float(lower), float(mid))
                rows.append({"date": df.iloc[i]["date"], "indicator": "BB_UPPER", "value": round(float(upper), 8), "signal": sig["signal"]})
                rows.append({"date": df.iloc[i]["date"], "indicator": "BB_LOWER", "value": round(float(lower), 8), "signal": sig["signal"]})
                rows.append({"date": df.iloc[i]["date"], "indicator": "BB_MID", "value": round(float(mid), 8), "signal": sig["signal"]})

    # ATR(14)
    atr = ta.atr(df["high"], df["low"], df["close"], length=14)
    if atr is not None:
        for i, val in enumerate(atr):
            if pd.notna(val):
                rows.append({
                    "date": df.iloc[i]["date"],
                    "indicator": "ATR_14",
                    "value": round(float(val), 8),
                    "signal": "neutral",
                    "params": {"period": 14},
                })

    if not rows:
        console.print("[yellow]No indicators calculated[/yellow]")
        return 0

    # Upsert en batches
    inserted = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("technical_indicators").upsert(batch, on_conflict="date,indicator").execute()
            inserted += len(batch)
        except Exception as e:
            console.print(f"[red]Error batch {i}: {e}[/red]")

    console.print(f"[green]Technical: {inserted} indicators saved[/green]")
    return inserted
