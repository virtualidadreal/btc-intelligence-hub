"""Coordinated Updater — Updates all data incrementally."""

import asyncio

from rich.console import Console

from btc_intel.data.btc_loader import load_btc_prices, load_btc_hourly
from btc_intel.data.macro_loader import load_macro_data
from btc_intel.data.onchain_loader import load_onchain_data
from btc_intel.data.sentiment_loader import load_sentiment_data
from btc_intel.data.derivatives_loader import load_derivatives_data

console = Console()


async def update_all() -> dict:
    """Update all data incrementally."""
    console.print("[bold cyan]═══ Updating ALL data ═══[/bold cyan]\n")
    results = {}

    # BTC prices (daily)
    console.print("[bold]BTC Prices (Daily)[/bold]")
    results["btc"] = await load_btc_prices()
    console.print()

    # BTC prices (hourly)
    console.print("[bold]BTC Prices (Hourly)[/bold]")
    results["btc_hourly"] = await load_btc_hourly()
    console.print()

    # Macro data
    console.print("[bold]Macro Data[/bold]")
    results["macro"] = await load_macro_data()
    console.print()

    # On-chain
    console.print("[bold]On-Chain Data[/bold]")
    results["onchain"] = await load_onchain_data()
    console.print()

    # Sentiment
    console.print("[bold]Sentiment Data[/bold]")
    results["sentiment"] = await load_sentiment_data()
    console.print()

    # Derivatives (Funding Rate, Open Interest)
    console.print("[bold]Derivatives Data[/bold]")
    results["derivatives"] = await load_derivatives_data()
    console.print()

    total = sum(results.values())
    console.print(f"[bold green]═══ Total: {total} rows updated ═══[/bold green]")
    return results


async def update_only(category: str) -> int:
    """Update a single category."""
    loaders = {
        "btc": load_btc_prices,
        "btc_hourly": load_btc_hourly,
        "macro": load_macro_data,
        "onchain": load_onchain_data,
        "sentiment": load_sentiment_data,
        "derivatives": load_derivatives_data,
    }

    if category not in loaders:
        console.print(f"[red]Unknown category: {category}[/red]")
        console.print(f"[dim]Options: {', '.join(loaders.keys())}[/dim]")
        return 0

    return await loaders[category]()
