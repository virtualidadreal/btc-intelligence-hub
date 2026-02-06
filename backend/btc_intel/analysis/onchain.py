"""On-Chain Engine — Procesa y clasifica métricas on-chain."""

import numpy as np
import pandas as pd
from rich.console import Console

from btc_intel.analysis.signal_classifier import SignalClassifier
from btc_intel.db import get_supabase

console = Console()
classifier = SignalClassifier()


def analyze_onchain() -> int:
    """Clasifica métricas on-chain y actualiza señales."""
    db = get_supabase()
    console.print("[cyan]Analizando métricas on-chain...[/cyan]")

    updated = 0

    # Hash Rate momentum (30d change)
    hr = db.table("onchain_metrics").select("date,value").eq("metric", "HASH_RATE").order("date").limit(100000).execute()
    if hr.data and len(hr.data) > 30:
        df = pd.DataFrame(hr.data)
        df["value"] = df["value"].astype(float)
        df["pct_30d"] = df["value"].pct_change(30) * 100

        rows = []
        for i, row in df.iterrows():
            if pd.notna(row["pct_30d"]) and np.isfinite(row["pct_30d"]):
                sig = classifier.classify_hash_rate_change(row["pct_30d"])
                rows.append({
                    "date": row["date"],
                    "metric": "HASH_RATE_MOM_30D",
                    "value": round(row["pct_30d"], 8),
                    "signal": sig["signal"],
                    "source": "calculated",
                })

        if rows:
            for i in range(0, len(rows), 500):
                db.table("onchain_metrics").upsert(rows[i:i+500], on_conflict="date,metric").execute()
                updated += len(rows[i:i+500])
            console.print(f"  [green]HASH_RATE_MOM: {len(rows)} filas[/green]")

    # NVT classification
    nvt = db.table("onchain_metrics").select("date,value").eq("metric", "NVT_RATIO").order("date").limit(100000).execute()
    if nvt.data:
        rows = []
        for entry in nvt.data:
            sig = classifier.classify_nvt(float(entry["value"]))
            rows.append({
                "date": entry["date"],
                "metric": "NVT_RATIO",
                "value": float(entry["value"]),
                "signal": sig["signal"],
                "source": "calculated",
            })

        if rows:
            for i in range(0, len(rows), 500):
                db.table("onchain_metrics").upsert(rows[i:i+500], on_conflict="date,metric").execute()
                updated += len(rows[i:i+500])

    console.print(f"[green]✅ On-chain analysis: {updated} señales actualizadas[/green]")
    return updated
