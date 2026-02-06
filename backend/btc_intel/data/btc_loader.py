"""BTC Price Loader — Descarga precios históricos de Bitcoin via yfinance."""

from datetime import date, timedelta

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
            since = date.fromisoformat(result.data[0]["date"]) + timedelta(days=1)
        else:
            since = date(2014, 9, 17)  # Yahoo Finance BTC-USD start

    today = date.today()
    if since >= today:
        console.print("[green]BTC prices ya están actualizados[/green]")
        return 0

    console.print(f"[cyan]Descargando BTC OHLCV ({since} → {today})...[/cyan]")

    ticker = yf.Ticker("BTC-USD")
    df = ticker.history(start=str(since), end=str(today + timedelta(days=1)))

    if df.empty:
        console.print("[yellow]Sin datos nuevos de BTC[/yellow]")
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
