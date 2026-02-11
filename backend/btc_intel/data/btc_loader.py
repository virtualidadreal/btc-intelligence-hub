"""BTC Price Loader — Download historical Bitcoin prices via yfinance."""

from datetime import date, datetime, timedelta, timezone

import pandas as pd
import yfinance as yf
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


async def load_btc_prices(since: date | None = None) -> int:
    """Descarga precios BTC OHLCV desde yfinance y los sube a Supabase.

    Si since es None, detecta la última fecha en la DB.
    Retorna el número de filas insertadas.
    """
    db = get_supabase()

    if since is None:
        result = db.table("btc_prices").select("date").order("date", desc=True).limit(1).execute()
        if result.data:
            last_date = date.fromisoformat(result.data[0]["date"])
            # Always re-fetch today to get the latest intraday price
            since = min(last_date, date.today())
        else:
            since = date(2014, 9, 17)  # Yahoo Finance BTC-USD start

    today = date.today()

    console.print(f"[cyan]Descargando BTC OHLCV ({since} → {today})...[/cyan]")

    ticker = yf.Ticker("BTC-USD")
    df = ticker.history(start=str(since), end=str(today + timedelta(days=1)))

    if df.empty:
        console.print("[yellow]No new BTC data[/yellow]")
        return 0

    rows = []
    for idx, row in df.iterrows():
        rows.append({
            "date": str(idx.date()),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": round(float(row["Volume"]), 8) if pd.notna(row["Volume"]) else None,
            "source": "yahoo_finance",
        })

    # Upsert en batches
    inserted = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("btc_prices").upsert(batch, on_conflict="date").execute()
            inserted += len(batch)
        except Exception as e:
            console.print(f"[red]Error upserting batch: {e}[/red]")

    console.print(f"[green]✅ BTC prices: {inserted} filas[/green]")
    return inserted


async def load_btc_hourly() -> int:
    """Download hourly BTC OHLCV from yfinance and upsert to btc_prices_1h.

    yfinance allows up to ~60 days of 1H data. We detect the latest
    timestamp in the DB and only fetch what's missing.
    Returns the number of rows inserted.
    """
    db = get_supabase()

    # Detect last hourly timestamp in DB
    result = (
        db.table("btc_prices_1h")
        .select("timestamp")
        .order("timestamp", desc=True)
        .limit(1)
        .execute()
    )

    if result.data:
        last_ts = datetime.fromisoformat(
            result.data[0]["timestamp"].replace("Z", "+00:00")
        )
        # Re-fetch from last_ts to capture any late candle updates
        start = last_ts - timedelta(hours=2)
        period = None
    else:
        # First load — grab as much as yfinance allows (~60 days)
        start = None
        period = "60d"

    console.print(
        f"[cyan]Descargando BTC 1H OHLCV "
        f"({'full 60d' if period else f'since {start:%Y-%m-%d %H:%M}'})...[/cyan]"
    )

    ticker = yf.Ticker("BTC-USD")
    if period:
        df = ticker.history(interval="1h", period=period)
    else:
        df = ticker.history(
            interval="1h",
            start=start.strftime("%Y-%m-%d"),
            end=(datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
        )

    if df.empty:
        console.print("[yellow]No new BTC hourly data[/yellow]")
        return 0

    rows = []
    for idx, row in df.iterrows():
        # yfinance returns timezone-aware DatetimeIndex
        ts = idx.to_pydatetime()
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        rows.append({
            "timestamp": ts.isoformat(),
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": round(float(row["Volume"]), 8) if pd.notna(row["Volume"]) else None,
            "source": "yahoo_finance",
        })

    # Upsert in batches
    inserted = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        try:
            db.table("btc_prices_1h").upsert(batch, on_conflict="timestamp").execute()
            inserted += len(batch)
        except Exception as e:
            console.print(f"[red]Error upserting hourly batch: {e}[/red]")

    console.print(f"[green]✅ BTC hourly prices: {inserted} filas[/green]")
    return inserted
