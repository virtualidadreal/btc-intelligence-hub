"""Sentiment Data Loader — Fear & Greed Index + Google Trends."""

from datetime import date, datetime, timedelta

import httpx
from rich.console import Console

from btc_intel.data.retry import async_get_with_retry
from btc_intel.db import get_supabase

console = Console()

FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=0&format=json"


async def load_sentiment_data(since: date | None = None) -> int:
    """Descarga datos de sentimiento y los sube a Supabase."""
    db = get_supabase()
    total = 0

    total += await _load_fear_greed(db, since)
    total += _load_google_trends(db, since)

    console.print(f"[green]✅ Sentiment data: {total} filas totales[/green]")
    return total


async def _load_fear_greed(db, since: date | None) -> int:
    """Descarga Fear & Greed Index desde alternative.me."""
    if since is None:
        result = (
            db.table("sentiment_data")
            .select("date")
            .eq("metric", "FEAR_GREED")
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            since = date.fromisoformat(result.data[0]["date"]) + timedelta(days=1)

    console.print("  [cyan]FEAR_GREED: descargando...[/cyan]")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await async_get_with_retry(client, FEAR_GREED_URL)
            data = resp.json()

        if "data" not in data:
            console.print("  [yellow]FEAR_GREED: respuesta inesperada[/yellow]")
            return 0

        rows = []
        for entry in data["data"]:
            d = datetime.fromtimestamp(int(entry["timestamp"])).date()
            if since and d < since:
                continue
            rows.append({
                "date": str(d),
                "metric": "FEAR_GREED",
                "value": int(entry["value"]),
                "label": entry.get("value_classification", ""),
                "source": "alternative_me",
            })

        if not rows:
            console.print("  [dim]FEAR_GREED: sin datos nuevos[/dim]")
            return 0

        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i + 500]
            db.table("sentiment_data").upsert(batch, on_conflict="date,metric").execute()
            inserted += len(batch)

        console.print(f"  [green]FEAR_GREED: {inserted} filas[/green]")
        return inserted
    except Exception as e:
        console.print(f"  [red]FEAR_GREED: error — {e}[/red]")
        return 0


def _load_google_trends(db, since: date | None) -> int:
    """Descarga Google Trends para 'bitcoin'."""
    try:
        from pytrends.request import TrendReq
    except ImportError:
        console.print("  [yellow]pytrends no disponible, saltando Google Trends[/yellow]")
        return 0

    if since is None:
        result = (
            db.table("sentiment_data")
            .select("date")
            .eq("metric", "GOOGLE_TRENDS")
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            since = date.fromisoformat(result.data[0]["date"]) + timedelta(days=1)

    console.print("  [cyan]GOOGLE_TRENDS: descargando...[/cyan]")

    try:
        pytrends = TrendReq(hl="en-US", tz=0)
        pytrends.build_payload(["bitcoin"], timeframe="all")
        df = pytrends.interest_over_time()

        if df.empty:
            console.print("  [yellow]GOOGLE_TRENDS: sin datos[/yellow]")
            return 0

        rows = []
        for idx, row in df.iterrows():
            d = idx.date()
            if since and d < since:
                continue
            rows.append({
                "date": str(d),
                "metric": "GOOGLE_TRENDS",
                "value": int(row["bitcoin"]),
                "label": None,
                "source": "google_trends",
            })

        if not rows:
            console.print("  [dim]GOOGLE_TRENDS: sin datos nuevos[/dim]")
            return 0

        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i + 500]
            db.table("sentiment_data").upsert(batch, on_conflict="date,metric").execute()
            inserted += len(batch)

        console.print(f"  [green]GOOGLE_TRENDS: {inserted} filas[/green]")
        return inserted
    except Exception as e:
        console.print(f"  [red]GOOGLE_TRENDS: error — {e}[/red]")
        return 0
