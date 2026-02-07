"""On-Chain Data Loader — On-chain metrics from Blockchain.com API."""

from datetime import date, datetime, timedelta

import asyncio
import httpx
import pandas as pd
from rich.console import Console

from btc_intel.data.retry import async_get_with_retry
from btc_intel.db import get_supabase

console = Console()

BLOCKCHAIN_METRICS = {
    "HASH_RATE": "https://api.blockchain.info/charts/hash-rate?timespan=all&format=json&sampled=true",
    "ACTIVE_ADDRESSES": "https://api.blockchain.info/charts/n-unique-addresses?timespan=all&format=json&sampled=true",
    "TRANSACTION_COUNT": "https://api.blockchain.info/charts/n-transactions?timespan=all&format=json&sampled=true",
    "MARKET_CAP": "https://api.blockchain.info/charts/market-cap?timespan=all&format=json&sampled=true",
    "MINERS_REVENUE": "https://api.blockchain.info/charts/miners-revenue?timespan=all&format=json&sampled=true",
    "DIFFICULTY": "https://api.blockchain.info/charts/difficulty?timespan=all&format=json&sampled=true",
}


async def load_onchain_data(since: date | None = None) -> int:
    """Descarga métricas on-chain y las sube a Supabase."""
    db = get_supabase()
    total = 0

    async with httpx.AsyncClient(timeout=60) as client:
        for metric_name, url in BLOCKCHAIN_METRICS.items():
            count = await _load_blockchain_metric(db, client, metric_name, url, since)
            total += count
            await asyncio.sleep(1)

    # Métricas derivadas
    total += _calculate_nvt(db, since)

    console.print(f"[green]✅ On-chain data: {total} filas totales[/green]")
    return total


async def _load_blockchain_metric(
    db, client: httpx.AsyncClient, metric_name: str, url: str, since: date | None
) -> int:
    """Descarga una métrica de Blockchain.com."""
    if since is None:
        result = (
            db.table("onchain_metrics")
            .select("date")
            .eq("metric", metric_name)
            .order("date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            since = date.fromisoformat(result.data[0]["date"]) + timedelta(days=1)

    console.print(f"  [cyan]{metric_name}: descargando...[/cyan]")

    try:
        resp = await async_get_with_retry(client, url)
        data = resp.json()

        if "values" not in data:
            console.print(f"  [yellow]{metric_name}: sin datos[/yellow]")
            return 0

        rows = []
        for point in data["values"]:
            d = datetime.fromtimestamp(point["x"]).date()
            if since and d < since:
                continue
            rows.append({
                "date": str(d),
                "metric": metric_name,
                "value": round(float(point["y"]), 8),
                "source": "blockchain_com",
            })

        if not rows:
            console.print(f"  [dim]{metric_name}: sin datos nuevos[/dim]")
            return 0

        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i + 500]
            db.table("onchain_metrics").upsert(batch, on_conflict="date,metric").execute()
            inserted += len(batch)

        console.print(f"  [green]{metric_name}: {inserted} filas[/green]")
        return inserted
    except Exception as e:
        console.print(f"  [red]{metric_name}: error — {e}[/red]")
        return 0


def _calculate_nvt(db, since: date | None) -> int:
    """Calcula NVT ratio = Market Cap / TX Count."""
    console.print("  [cyan]NVT_RATIO: calculando...[/cyan]")
    try:
        mc = db.table("onchain_metrics").select("date,value").eq("metric", "MARKET_CAP").order("date").execute()
        tx = db.table("onchain_metrics").select("date,value").eq("metric", "TRANSACTION_COUNT").order("date").execute()

        if not mc.data or not tx.data:
            return 0

        mc_df = pd.DataFrame(mc.data).rename(columns={"value": "mc"})
        tx_df = pd.DataFrame(tx.data).rename(columns={"value": "tx"})
        merged = mc_df.merge(tx_df, on="date")
        merged["mc"] = merged["mc"].astype(float)
        merged["tx"] = merged["tx"].astype(float).replace(0, float("nan"))
        merged["nvt"] = merged["mc"] / merged["tx"]

        rows = []
        for _, row in merged.iterrows():
            if pd.notna(row["nvt"]) and (since is None or date.fromisoformat(row["date"]) >= since):
                rows.append({
                    "date": row["date"],
                    "metric": "NVT_RATIO",
                    "value": round(float(row["nvt"]), 8),
                    "source": "calculated",
                })

        if not rows:
            return 0

        inserted = 0
        for i in range(0, len(rows), 500):
            batch = rows[i:i + 500]
            db.table("onchain_metrics").upsert(batch, on_conflict="date,metric").execute()
            inserted += len(batch)

        console.print(f"  [green]NVT_RATIO: {inserted} filas[/green]")
        return inserted
    except Exception as e:
        console.print(f"  [red]NVT_RATIO: error — {e}[/red]")
        return 0
