"""Updater coordinado — Actualiza todos los datos de forma incremental."""

import asyncio

from rich.console import Console

from btc_intel.data.btc_loader import load_btc_prices
from btc_intel.data.macro_loader import load_macro_data
from btc_intel.data.onchain_loader import load_onchain_data
from btc_intel.data.sentiment_loader import load_sentiment_data
from btc_intel.data.derivatives_loader import load_derivatives_data

console = Console()


async def update_all() -> dict:
    """Actualiza todos los datos de forma incremental."""
    console.print("[bold cyan]═══ Actualizando TODOS los datos ═══[/bold cyan]\n")
    results = {}

    # BTC prices
    console.print("[bold]📊 BTC Prices[/bold]")
    results["btc"] = await load_btc_prices()
    console.print()

    # Macro data
    console.print("[bold]🌍 Macro Data[/bold]")
    results["macro"] = await load_macro_data()
    console.print()

    # On-chain
    console.print("[bold]📡 On-Chain Data[/bold]")
    results["onchain"] = await load_onchain_data()
    console.print()

    # Sentiment
    console.print("[bold]💭 Sentiment Data[/bold]")
    results["sentiment"] = await load_sentiment_data()
    console.print()

    # Derivatives (Funding Rate, Open Interest)
    console.print("[bold]📈 Derivatives Data[/bold]")
    results["derivatives"] = await load_derivatives_data()
    console.print()

    total = sum(results.values())
    console.print(f"[bold green]═══ Total: {total} filas actualizadas ═══[/bold green]")
    return results


async def update_only(category: str) -> int:
    """Actualiza solo una categoría."""
    loaders = {
        "btc": load_btc_prices,
        "macro": load_macro_data,
        "onchain": load_onchain_data,
        "sentiment": load_sentiment_data,
        "derivatives": load_derivatives_data,
    }

    if category not in loaders:
        console.print(f"[red]Categoría desconocida: {category}[/red]")
        console.print(f"[dim]Opciones: {', '.join(loaders.keys())}[/dim]")
        return 0

    return await loaders[category]()
