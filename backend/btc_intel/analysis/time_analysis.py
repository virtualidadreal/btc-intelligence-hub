"""Time Analysis — Estacionalidad y rendimiento temporal."""

import pandas as pd
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def analyze_time() -> dict:
    """Calcula rendimiento por mes, día de semana, y trimestre post-halving."""
    db = get_supabase()
    console.print("[cyan]Analizando estacionalidad...[/cyan]")

    # Paginated fetch to avoid PostgREST row limit
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
    df["date"] = pd.to_datetime(df["date"])
    df["returns"] = df["close"].pct_change()
    df["month"] = df["date"].dt.month
    df["dow"] = df["date"].dt.dayofweek  # 0=Mon, 6=Sun
    df["year"] = df["date"].dt.year

    # Rendimiento medio por mes
    monthly = df.groupby("month")["returns"].mean() * 100
    monthly_dict = {int(k): round(v, 4) for k, v in monthly.items()}

    # Rendimiento por día de semana
    dow_names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    dow = df.groupby("dow")["returns"].mean() * 100
    dow_dict = {dow_names[int(k)]: round(v, 4) for k, v in dow.items()}

    # Heatmap: año x mes
    heatmap = df.groupby(["year", "month"])["returns"].sum() * 100
    heatmap_dict = {
        f"{int(y)}-{int(m):02d}": round(v, 2)
        for (y, m), v in heatmap.items()
    }

    result = {
        "monthly_avg_return": monthly_dict,
        "dow_avg_return": dow_dict,
        "heatmap": heatmap_dict,
    }

    console.print(f"[green]✅ Time analysis completado[/green]")
    return result
