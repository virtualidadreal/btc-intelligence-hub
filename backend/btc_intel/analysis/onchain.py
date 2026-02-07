"""On-Chain Engine — Process and classify on-chain metrics."""

import numpy as np
import pandas as pd
from rich.console import Console

from btc_intel.analysis.signal_classifier import SignalClassifier
from btc_intel.db import get_supabase

console = Console()
classifier = SignalClassifier()


def analyze_onchain() -> int:
    """Classify on-chain metrics and update signals."""
    db = get_supabase()
    console.print("[cyan]Analyzing on-chain metrics...[/cyan]")

    updated = 0

    # Hash Rate momentum (30d change) - paginated fetch
    hr_data = []
    page_size = 1000
    offset = 0
    while True:
        result = db.table("onchain_metrics").select("date,value").eq("metric", "HASH_RATE").order("date").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        hr_data.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    if hr_data and len(hr_data) > 30:
        df = pd.DataFrame(hr_data)
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

    # NVT classification - paginated fetch
    nvt_data = []
    offset = 0
    while True:
        result = db.table("onchain_metrics").select("date,value").eq("metric", "NVT_RATIO").order("date").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        nvt_data.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    if nvt_data:
        rows = []
        for entry in nvt_data:
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

    console.print(f"[green]✅ On-chain analysis: {updated} signals updated[/green]")
    return updated
