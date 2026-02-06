"""Cycles Engine — Análisis de ciclos y comparativas."""

from datetime import date, timedelta

import pandas as pd
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

HALVINGS = [
    date(2012, 11, 28),
    date(2016, 7, 9),
    date(2020, 5, 11),
    date(2024, 4, 20),
]


def analyze_cycles() -> dict:
    """Analiza posición en el ciclo actual y compara con anteriores."""
    db = get_supabase()
    console.print("[cyan]Analizando ciclos...[/cyan]")

    today = date.today()
    last_halving = max(h for h in HALVINGS if h <= today)
    days_since_halving = (today - last_halving).days
    cycle_number = HALVINGS.index(last_halving) + 1

    # Cargar precios
    btc = db.table("btc_prices").select("date,close").order("date").limit(100000).execute()
    if not btc.data:
        return {}

    df = pd.DataFrame(btc.data)
    df["close"] = df["close"].astype(float)
    df["date"] = pd.to_datetime(df["date"]).dt.date

    # Precio al halving
    halving_price = None
    for row in btc.data:
        if row["date"] == str(last_halving):
            halving_price = float(row["close"])
            break

    if not halving_price:
        # Buscar el precio más cercano
        close_rows = [r for r in btc.data if r["date"] >= str(last_halving - timedelta(days=3))]
        if close_rows:
            halving_price = float(close_rows[0]["close"])

    current_price = float(btc.data[-1]["close"])
    roi_since_halving = ((current_price - halving_price) / halving_price * 100) if halving_price else 0

    # Comparativa con ciclos anteriores al mismo día
    comparisons = {}
    for i, halving in enumerate(HALVINGS[:-1]):
        target_date = halving + timedelta(days=days_since_halving)
        h_price = None
        t_price = None
        for row in btc.data:
            d = date.fromisoformat(row["date"]) if isinstance(row["date"], str) else row["date"]
            if d == halving or (h_price is None and d >= halving):
                h_price = float(row["close"])
            if d == target_date or (t_price is None and d >= target_date):
                t_price = float(row["close"])

        if h_price and t_price:
            roi = (t_price - h_price) / h_price * 100
            comparisons[f"Ciclo {i+1}"] = {
                "halving_date": str(halving),
                "days": days_since_halving,
                "halving_price": h_price,
                "price_at_day": t_price,
                "roi": round(roi, 2),
            }

    result = {
        "cycle_number": cycle_number,
        "last_halving": str(last_halving),
        "days_since_halving": days_since_halving,
        "halving_price": halving_price,
        "current_price": current_price,
        "roi_since_halving": round(roi_since_halving, 2),
        "comparisons": comparisons,
    }

    console.print(f"  Ciclo: #{cycle_number} | Días desde halving: {days_since_halving}")
    console.print(f"  ROI desde halving: {roi_since_halving:+.2f}%")
    for name, comp in comparisons.items():
        console.print(f"  {name} al día {days_since_halving}: {comp['roi']:+.2f}%")

    console.print(f"[green]✅ Cycle analysis completado[/green]")
    return result
