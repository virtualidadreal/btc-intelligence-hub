"""Macro Data Loader — SPX, Gold, DXY, US10Y, Fed Rate, M2."""

from datetime import date, timedelta

import pandas as pd
import yfinance as yf
from rich.console import Console

from btc_intel.config import settings
from btc_intel.db import get_supabase

console = Console()

YAHOO_ASSETS = {
    "SPX": "^GSPC",
    "GOLD": "GC=F",
    "DXY": "DX-Y.NYB",
    "US_10Y": "^TNX",
}

FRED_SERIES = {
    "FED_RATE": "FEDFUNDS",
    "M2": "M2SL",
}


async def load_macro_data(since: date | None = None) -> int:
    """Descarga datos macro y los sube a Supabase."""
    db = get_supabase()
    total = 0

    for asset_name, ticker_symbol in YAHOO_ASSETS.items():
        total += _load_yahoo_asset(db, asset_name, ticker_symbol, since)

    if settings.fred_api_key:
        for asset_name, series_id in FRED_SERIES.items():
            total += _load_fred_series(db, asset_name, series_id, since)
    else:
        console.print("[yellow]FRED_API_KEY no configurada — saltando Fed Rate y M2[/yellow]")

    console.print(f"[green]✅ Macro data: {total} filas totales[/green]")
    return total


def _load_yahoo_asset(db, asset_name: str, ticker: str, since: date | None) -> int:
    """Descarga un activo de Yahoo Finance."""
    if since is None:
        result = (
            db.table("macro_data")
            .select("date")
            .eq("asset", asset_name)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        since = (
            date.fromisoformat(result.data[0]["date"]) + timedelta(days=1)
            if result.data
            else date(2012, 1, 1)
        )

    today = date.today()
    if since >= today:
        console.print(f"  [dim]{asset_name}: ya actualizado[/dim]")
        return 0

    console.print(f"  [cyan]{asset_name} ({ticker}): {since} → {today}[/cyan]")

    try:
        t = yf.Ticker(ticker)
        df = t.history(start=str(since), end=str(today + timedelta(days=1)))

        if df.empty:
            console.print(f"  [yellow]{asset_name}: sin datos nuevos[/yellow]")
            return 0

        rows = [
            {
                "date": str(idx.date()),
                "asset": asset_name,
                "value": round(float(row["Close"]), 4),
                "source": "yahoo_finance",
            }
            for idx, row in df.iterrows()
        ]

        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i + 500]
            db.table("macro_data").upsert(batch, on_conflict="date,asset").execute()
            inserted += len(batch)

        console.print(f"  [green]{asset_name}: {inserted} filas[/green]")
        return inserted
    except Exception as e:
        console.print(f"  [red]{asset_name}: error — {e}[/red]")
        return 0


def _load_fred_series(db, asset_name: str, series_id: str, since: date | None) -> int:
    """Descarga una serie de FRED."""
    from fredapi import Fred

    if since is None:
        result = (
            db.table("macro_data")
            .select("date")
            .eq("asset", asset_name)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        since = (
            date.fromisoformat(result.data[0]["date"]) + timedelta(days=1)
            if result.data
            else date(2012, 1, 1)
        )

    today = date.today()
    if since >= today:
        console.print(f"  [dim]{asset_name}: ya actualizado[/dim]")
        return 0

    console.print(f"  [cyan]{asset_name} (FRED {series_id}): {since} → {today}[/cyan]")

    try:
        fred = Fred(api_key=settings.fred_api_key)
        series = fred.get_series(series_id, observation_start=str(since))

        if series.empty:
            console.print(f"  [yellow]{asset_name}: sin datos nuevos[/yellow]")
            return 0

        rows = [
            {
                "date": str(idx.date()),
                "asset": asset_name,
                "value": round(float(value), 4),
                "source": "fred",
            }
            for idx, value in series.items()
            if pd.notna(value)
        ]

        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i + 500]
            db.table("macro_data").upsert(batch, on_conflict="date,asset").execute()
            inserted += len(batch)

        console.print(f"  [green]{asset_name}: {inserted} filas[/green]")
        return inserted
    except Exception as e:
        console.print(f"  [red]{asset_name}: error — {e}[/red]")
        return 0
