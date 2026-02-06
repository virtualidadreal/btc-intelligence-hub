"""Sentiment Engine — Procesa datos de sentimiento."""

import pandas as pd
from rich.console import Console

from btc_intel.analysis.signal_classifier import SignalClassifier
from btc_intel.db import get_supabase

console = Console()
classifier = SignalClassifier()


def analyze_sentiment() -> int:
    """Calcula medias móviles y clasifica sentimiento."""
    db = get_supabase()
    console.print("[cyan]Analizando sentimiento...[/cyan]")

    total = 0

    # Fear & Greed 30d moving average
    fg = db.table("sentiment_data").select("date,value").eq("metric", "FEAR_GREED").order("date").execute()
    if fg.data and len(fg.data) > 30:
        df = pd.DataFrame(fg.data)
        df["value"] = df["value"].astype(float)
        df["ma30"] = df["value"].rolling(30).mean()

        rows = []
        for _, row in df.iterrows():
            if pd.notna(row["ma30"]):
                sig = classifier.classify_fear_greed(int(row["ma30"]))
                rows.append({
                    "date": row["date"],
                    "metric": "FEAR_GREED_30D",
                    "value": round(row["ma30"], 4),
                    "label": sig["label"],
                    "source": "calculated",
                })

        if rows:
            for i in range(0, len(rows), 500):
                db.table("sentiment_data").upsert(rows[i:i+500], on_conflict="date,metric").execute()
                total += len(rows[i:i+500])
            console.print(f"  [green]FEAR_GREED_30D: {len(rows)} filas[/green]")

    console.print(f"[green]✅ Sentiment analysis: {total} señales[/green]")
    return total
