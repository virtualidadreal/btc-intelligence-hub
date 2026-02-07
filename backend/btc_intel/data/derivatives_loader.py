"""Derivatives Loader — Funding Rate & Open Interest from OKX (free, no auth, global access)."""

from datetime import date

import httpx
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

HEADERS = {"User-Agent": "btc-intel/1.0"}


async def load_derivatives_data() -> int:
    """Load funding rate and open interest from OKX public API."""
    db = get_supabase()
    total = 0

    async with httpx.AsyncClient(timeout=30, headers=HEADERS) as client:
        # --- Funding Rate ---
        try:
            resp = await client.get(
                "https://www.okx.com/api/v5/public/funding-rate",
                params={"instId": "BTC-USDT-SWAP"},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("data", [])

            if items:
                # settFundingRate = last settled rate, fundingRate = current predicted
                settled = items[0].get("settFundingRate", "")
                current = items[0].get("fundingRate", "")
                rate_str = settled if settled else current
                funding_rate = float(rate_str) * 100 if rate_str else 0  # to percentage

                record = {
                    "date": date.today().isoformat(),
                    "metric": "FUNDING_RATE",
                    "value": funding_rate,
                    "signal": _classify_funding_rate(funding_rate),
                    "source": "okx",
                }
                db.table("onchain_metrics").upsert(
                    record, on_conflict="date,metric"
                ).execute()
                total += 1
                console.print(f"  Funding Rate: {funding_rate:.4f}%")
        except Exception as e:
            console.print(f"  [yellow]Funding Rate error: {e}[/yellow]")

        # --- Open Interest ---
        try:
            resp = await client.get(
                "https://www.okx.com/api/v5/public/open-interest",
                params={"instType": "SWAP", "instId": "BTC-USDT-SWAP"},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("data", [])

            if items:
                oi_usd = float(items[0].get("oiUsd", 0))

                record = {
                    "date": date.today().isoformat(),
                    "metric": "OPEN_INTEREST",
                    "value": oi_usd,
                    "signal": None,  # Signal computed in analysis step
                    "source": "okx",
                }
                db.table("onchain_metrics").upsert(
                    record, on_conflict="date,metric"
                ).execute()
                total += 1
                oi_btc = float(items[0].get("oiCcy", 0))
                console.print(f"  Open Interest: {oi_btc:.2f} BTC (${oi_usd:,.0f})")
        except Exception as e:
            console.print(f"  [yellow]Open Interest error: {e}[/yellow]")

    console.print(f"  [green]Derivatives: {total} metricas actualizadas[/green]")
    return total


def _classify_funding_rate(rate_pct: float) -> str:
    """Quick classification for storage. Detailed analysis in analysis/derivatives.py."""
    if rate_pct > 0.1:
        return "extreme_bearish"
    if rate_pct > 0.03:
        return "bearish"
    if rate_pct > -0.03:
        return "neutral"
    if rate_pct > -0.05:
        return "bullish"
    return "extreme_bullish"
