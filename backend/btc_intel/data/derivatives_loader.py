"""Derivatives Loader — Funding Rate & Open Interest from Binance Futures (free, no auth)."""

from datetime import date

import httpx
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

BINANCE_FUTURES_BASE = "https://fapi.binance.com"


async def load_derivatives_data() -> int:
    """Load funding rate and open interest from Binance Futures REST API."""
    db = get_supabase()
    total = 0

    async with httpx.AsyncClient(timeout=30) as client:
        # --- Funding Rate ---
        try:
            resp = await client.get(
                f"{BINANCE_FUTURES_BASE}/fapi/v1/fundingRate",
                params={"symbol": "BTCUSDT", "limit": 10},
            )
            resp.raise_for_status()
            funding_data = resp.json()

            if funding_data:
                latest = funding_data[-1]
                funding_rate = float(latest["fundingRate"]) * 100  # Convert to percentage
                funding_time = latest["fundingTime"]

                record = {
                    "date": date.today().isoformat(),
                    "metric": "FUNDING_RATE",
                    "value": funding_rate,
                    "signal": _classify_funding_rate(funding_rate),
                    "source": "binance_futures",
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
                f"{BINANCE_FUTURES_BASE}/fapi/v1/openInterest",
                params={"symbol": "BTCUSDT"},
            )
            resp.raise_for_status()
            oi_data = resp.json()

            if oi_data:
                oi_btc = float(oi_data["openInterest"])

                # Get current price for USD value
                price_resp = await client.get(
                    f"{BINANCE_FUTURES_BASE}/fapi/v1/ticker/price",
                    params={"symbol": "BTCUSDT"},
                )
                price_resp.raise_for_status()
                price = float(price_resp.json()["price"])
                oi_usd = oi_btc * price

                record = {
                    "date": date.today().isoformat(),
                    "metric": "OPEN_INTEREST",
                    "value": oi_usd,
                    "signal": None,  # Signal computed in analysis step
                    "source": "binance_futures",
                }
                db.table("onchain_metrics").upsert(
                    record, on_conflict="date,metric"
                ).execute()
                total += 1
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
