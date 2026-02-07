"""Cycles Engine — Cycle analysis and comparisons."""

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
    """Analyze position in the current cycle and compare with previous ones."""
    db = get_supabase()
    console.print("[cyan]Analyzing cycles...[/cyan]")

    today = date.today()
    last_halving = max(h for h in HALVINGS if h <= today)
    days_since_halving = (today - last_halving).days
    cycle_number = HALVINGS.index(last_halving) + 1

    # Load prices (paginated to avoid PostgREST row limit)
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
        return {}

    df = pd.DataFrame(all_prices)
    df["close"] = df["close"].astype(float)
    df["date"] = pd.to_datetime(df["date"]).dt.date

    # Price at halving
    halving_price = None
    for row in all_prices:
        if row["date"] == str(last_halving):
            halving_price = float(row["close"])
            break

    if not halving_price:
        # Find closest price
        close_rows = [r for r in all_prices if r["date"] >= str(last_halving - timedelta(days=3))]
        if close_rows:
            halving_price = float(close_rows[0]["close"])

    current_price = float(all_prices[-1]["close"])
    roi_since_halving = ((current_price - halving_price) / halving_price * 100) if halving_price else 0

    # Compare with previous cycles at the same day
    comparisons = {}
    for i, halving in enumerate(HALVINGS[:-1]):
        target_date = halving + timedelta(days=days_since_halving)
        h_price = None
        t_price = None
        for row in all_prices:
            d = date.fromisoformat(row["date"]) if isinstance(row["date"], str) else row["date"]
            if d == halving or (h_price is None and d >= halving):
                h_price = float(row["close"])
            if d == target_date or (t_price is None and d >= target_date):
                t_price = float(row["close"])

        if h_price and t_price:
            roi = (t_price - h_price) / h_price * 100
            comparisons[f"Cycle {i+1}"] = {
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

    console.print(f"  Cycle: #{cycle_number} | Days since halving: {days_since_halving}")
    console.print(f"  ROI since halving: {roi_since_halving:+.2f}%")
    for name, comp in comparisons.items():
        console.print(f"  {name} - day {days_since_halving}: {comp['roi']:+.2f}%")

    console.print(f"[green]Cycle analysis completed[/green]")
    return result
