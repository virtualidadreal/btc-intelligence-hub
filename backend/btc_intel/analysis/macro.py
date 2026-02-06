"""Macro Engine — Correlaciones y análisis macro."""

import pandas as pd
import numpy as np
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def analyze_macro() -> int:
    """Calcula correlaciones rolling BTC vs activos macro."""
    db = get_supabase()
    console.print("[cyan]Calculando correlaciones macro...[/cyan]")

    # Cargar BTC prices
    btc = db.table("btc_prices").select("date,close").order("date").limit(100000).execute()
    if not btc.data:
        return 0

    btc_df = pd.DataFrame(btc.data).rename(columns={"close": "btc"})
    btc_df["btc"] = btc_df["btc"].astype(float)
    btc_df["btc_ret"] = btc_df["btc"].pct_change()

    total = 0
    for asset in ["SPX", "GOLD", "DXY", "US_10Y"]:
        macro = db.table("macro_data").select("date,value").eq("asset", asset).order("date").limit(100000).execute()
        if not macro.data:
            continue

        macro_df = pd.DataFrame(macro.data).rename(columns={"value": asset.lower()})
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
