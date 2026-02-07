"""Macro Engine — Correlations and macro analysis."""

import pandas as pd
import numpy as np
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def analyze_macro() -> int:
    """Calcula correlaciones rolling BTC vs activos macro."""
    db = get_supabase()
    console.print("[cyan]Calculando correlaciones macro...[/cyan]")

    # Cargar BTC prices (paginated to avoid PostgREST row limit)
    all_prices = []
    page_size = 1000
    offset = 0
    while True:
        result = db.table("btc_prices").select("date,close").order("date").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_prices.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    if not all_prices:
        return 0

    btc_df = pd.DataFrame(all_prices).rename(columns={"close": "btc"})
    btc_df["btc"] = btc_df["btc"].astype(float)
    btc_df["btc_ret"] = btc_df["btc"].pct_change()

    total = 0
    for asset in ["SPX", "GOLD", "DXY", "US_10Y"]:
        # Paginated fetch for macro data
        macro_data = []
        offset = 0
        while True:
            result = db.table("macro_data").select("date,value").eq("asset", asset).order("date").range(offset, offset + page_size - 1).execute()
            if not result.data:
                break
            macro_data.extend(result.data)
            if len(result.data) < page_size:
                break
            offset += page_size

        if not macro_data:
            continue

        macro_df = pd.DataFrame(macro_data).rename(columns={"value": asset.lower()})
        macro_df[asset.lower()] = macro_df[asset.lower()].astype(float)

        merged = btc_df.merge(macro_df, on="date")
        merged[f"{asset.lower()}_ret"] = merged[asset.lower()].pct_change()

        # Rolling correlations
        for window in [30, 90, 365]:
            corr = merged["btc_ret"].rolling(window).corr(merged[f"{asset.lower()}_ret"])
            rows = []
            for i, val in enumerate(corr):
                if pd.notna(val):
                    rows.append({
                        "date": merged.iloc[i]["date"],
                        "indicator": f"CORR_BTC_{asset}_{window}D",
                        "value": round(float(val), 8),
                        "signal": "neutral",
                        "params": {"asset": asset, "window": window},
                    })

            if rows:
                for j in range(0, len(rows), 500):
                    db.table("technical_indicators").upsert(rows[j:j+500], on_conflict="date,indicator").execute()
                    total += len(rows[j:j+500])
                console.print(f"  [green]CORR_BTC_{asset}_{window}D: {len(rows)} filas[/green]")

    console.print(f"[green]✅ Macro analysis: {total} correlaciones guardadas[/green]")
    return total
