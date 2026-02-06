"""Cycle Score — Indicador compuesto propietario 0-100."""

from datetime import date

import pandas as pd
import numpy as np
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

HALVINGS = [
    date(2012, 11, 28),
    date(2016, 7, 9),
    date(2020, 5, 11),
    date(2024, 4, 20),
]


def calculate_cycle_score() -> dict | None:
    """Calcula el Cycle Score compuesto y lo guarda en Supabase."""
    db = get_supabase()
    console.print("[cyan]Calculando Cycle Score...[/cyan]")

    components = {}

    # 1. RSI mensual (weight: 0.10) → normalizar a 0-100
    rsi = (
        db.table("technical_indicators")
        .select("value")
        .eq("indicator", "RSI_14")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if rsi.data:
        components["rsi"] = min(100, max(0, int(float(rsi.data[0]["value"]))))

    # 2. Halving position (weight: 0.15)
    today = date.today()
    last_halving = max(h for h in HALVINGS if h <= today)
    days = (today - last_halving).days
    # Normalizar: 0 días=0, ~1460 días (4 años)=100
    components["halving"] = min(100, int(days / 1460 * 100))

    # 3. Fear & Greed (weight: 0.05)
    fg = (
        db.table("sentiment_data")
        .select("value")
        .eq("metric", "FEAR_GREED")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if fg.data:
        components["fear_greed"] = int(float(fg.data[0]["value"]))

    # 4. Fear & Greed 30d (weight: 0.05)
    fg30 = (
        db.table("sentiment_data")
        .select("value")
        .eq("metric", "FEAR_GREED_30D")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if fg30.data:
        components["fear_greed_30d"] = int(float(fg30.data[0]["value"]))

    # 5. SMA Cross position (substitute for MVRV) (weight: 0.20)
    sma = (
        db.table("technical_indicators")
        .select("value")
        .eq("indicator", "SMA_CROSS")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if sma.data:
        sma_val = float(sma.data[0]["value"])
        # Normalizar: -20000=0, 0=50, +20000=100
        components["sma_position"] = min(100, max(0, int(50 + sma_val / 400)))

    # 6. Hash rate momentum (substitute for exchange flows) (weight: 0.10)
    hr = (
        db.table("onchain_metrics")
        .select("value")
        .eq("metric", "HASH_RATE_MOM_30D")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if hr.data:
        hr_val = float(hr.data[0]["value"])
        components["hash_rate_mom"] = min(100, max(0, int(50 + hr_val * 2)))

    # 7. Price position in cycle (substitute for MVRV Z-score) (weight: 0.20)
    btc = db.table("btc_prices").select("date,close").order("date").limit(100000).execute()
    if btc.data:
        prices = [float(r["close"]) for r in btc.data]
        current = prices[-1]
        ath = max(prices)
        cycle_prices = [float(r["close"]) for r in btc.data
                        if r["date"] >= str(last_halving - pd.Timedelta(days=180))]
        cycle_low = min(cycle_prices) if cycle_prices else min(prices)
        # Position: 0=at cycle low, 100=at ATH
        if ath > cycle_low:
            components["price_position"] = min(100, max(0, int((current - cycle_low) / (ath - cycle_low) * 100)))

    # Calculate weighted score
    weights = {
        "sma_position": 0.20,
        "price_position": 0.20,
        "halving": 0.15,
        "rsi": 0.10,
        "hash_rate_mom": 0.10,
        "fear_greed": 0.05,
        "fear_greed_30d": 0.05,
    }

    if not components:
        console.print("[yellow]Sin datos suficientes para Cycle Score[/yellow]")
        return None

    score = 0
    total_weight = 0
    for key, weight in weights.items():
        if key in components:
            score += components[key] * weight
            total_weight += weight

    # Normalizar si no tenemos todos los componentes
    if total_weight > 0:
        score = score / total_weight

    score = min(100, max(0, int(round(score))))

    # Determinar fase
    if score < 15:
        phase = "capitulation"
    elif score < 30:
        phase = "accumulation"
    elif score < 45:
        phase = "early_bull"
    elif score < 60:
        phase = "mid_bull"
    elif score < 75:
        phase = "late_bull"
    elif score < 85:
        phase = "distribution"
    else:
        phase = "euphoria"

    # Guardar en Supabase
    record = {
        "date": str(today),
        "score": score,
        "phase": phase,
        "rsi_monthly_component": components.get("rsi"),
        "halving_component": components.get("halving"),
        "fear_greed_component": components.get("fear_greed"),
        "exchange_flow_component": components.get("hash_rate_mom"),
        "google_trends_component": components.get("fear_greed_30d"),
        "mvrv_component": components.get("sma_position"),
        "nupl_component": components.get("price_position"),
    }

    try:
        db.table("cycle_score_history").upsert(record, on_conflict="date").execute()
    except Exception as e:
        console.print(f"[red]Error guardando Cycle Score: {e}[/red]")

    console.print(f"  [bold]Cycle Score: {score}/100 — {phase.upper()}[/bold]")
    console.print(f"  Componentes: {components}")
    console.print(f"[green]✅ Cycle Score guardado[/green]")

    return {"score": score, "phase": phase, "components": components}
