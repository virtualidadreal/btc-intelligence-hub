"""Derivatives Loader — Funding Rate & Open Interest from Bybit (free, no auth, no geo-block)."""

from datetime import date

import httpx
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

BYBIT_BASE = "https://api.bybit.com"


async def load_derivatives_data() -> int:
    """Load funding rate and open interest from Bybit public API."""
    db = get_supabase()
    total = 0

    async with httpx.AsyncClient(timeout=30) as client:
        # --- Funding Rate ---
        try:
            resp = await client.get(
                f"{BYBIT_BASE}/v5/market/funding/history",
                params={"category": "linear", "symbol": "BTCUSDT", "limit": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("result", {}).get("list", [])

            if items:
                funding_rate = float(items[0]["fundingRate"]) * 100  # to percentage

                record = {
                    "date": date.today().isoformat(),
                    "metric": "FUNDING_RATE",
                    "value": funding_rate,
                    "signal": _classify_funding_rate(funding_rate),
                    "source": "bybit",
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
                f"{BYBIT_BASE}/v5/market/open-interest",
                params={"category": "linear", "symbol": "BTCUSDT", "intervalTime": "1h", "limit": 1},
            )
            resp.raise_for_status()
            data = resp.json()
            items = data.get("result", {}).get("list", [])

            if items:
                oi_value = float(items[0]["openInterest"])  # in USD for linear

                # Get price for reference
                ticker_resp = await client.get(
                    f"{BYBIT_BASE}/v5/market/tickers",
                    params={"category": "linear", "symbol": "BTCUSDT"},
                )
                ticker_resp.raise_for_status()
                ticker_data = ticker_resp.json()
                ticker_list = ticker_data.get("result", {}).get("list", [])
                price = float(ticker_list[0]["lastPrice"]) if ticker_list else 0

                # Bybit linear OI is in coins, multiply by price for USD
                oi_usd = oi_value * price if price > 0 else oi_value

                record = {
                    "date": date.today().isoformat(),
                    "metric": "OPEN_INTEREST",
                    "value": oi_usd,
                    "signal": None,  # Signal computed in analysis step
                    "source": "bybit",
                }
                db.table("onchain_metrics").upsert(
                    record, on_conflict="date,metric"
                ).execute()
                total += 1
                console.print(f"  Open Interest: {oi_value:.2f} BTC (${oi_usd:,.0f})")
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
