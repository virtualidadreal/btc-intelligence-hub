"""Risk Engine — Volatilidad, drawdown, Sharpe, VaR."""

import numpy as np
import pandas as pd
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def analyze_risk() -> dict:
    """Calcula métricas de riesgo."""
    db = get_supabase()
    console.print("[cyan]Calculando métricas de riesgo...[/cyan]")

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

    if not all_prices or len(all_prices) < 30:
        return {}

    df = pd.DataFrame(all_prices)
    df["close"] = df["close"].astype(float)
    df["returns"] = df["close"].pct_change()

    # Drawdown actual
    df["cummax"] = df["close"].cummax()
    df["drawdown"] = (df["close"] - df["cummax"]) / df["cummax"] * 100

    current_drawdown = float(df["drawdown"].iloc[-1])
    max_drawdown = float(df["drawdown"].min())

    # Volatilidad realizada (anualizada)
    vol_30d = float(df["returns"].tail(30).std() * np.sqrt(365) * 100)
    vol_90d = float(df["returns"].tail(90).std() * np.sqrt(365) * 100)
    vol_365d = float(df["returns"].tail(365).std() * np.sqrt(365) * 100)
    vol_all = float(df["returns"].std() * np.sqrt(365) * 100)

    # Sharpe Ratio (usando 0% risk free para simplificar)
    mean_ret_365d = df["returns"].tail(365).mean() * 365
    std_ret_365d = df["returns"].tail(365).std() * np.sqrt(365)
    sharpe_365d = float(mean_ret_365d / std_ret_365d) if std_ret_365d > 0 else 0

    # VaR paramétrico
    mean_ret = df["returns"].mean()
    std_ret = df["returns"].std()
    var_95 = float(mean_ret - 1.645 * std_ret) * 100
    var_99 = float(mean_ret - 2.326 * std_ret) * 100

    # Beta vs SPX (paginated fetch)
    spx_data = []
    offset = 0
    while True:
        result = db.table("macro_data").select("date,value").eq("asset", "SPX").order("date").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        spx_data.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    beta = None
    if spx_data:
        spx_df = pd.DataFrame(spx_data).rename(columns={"value": "spx"})
        spx_df["spx"] = spx_df["spx"].astype(float)
        merged = df.merge(spx_df, on="date")
        merged["spx_ret"] = merged["spx"].pct_change()
        if len(merged) > 30:
            cov = merged[["returns", "spx_ret"]].tail(365).cov()
            var_spx = merged["spx_ret"].tail(365).var()
            if var_spx > 0:
                beta = float(cov.iloc[0, 1] / var_spx)

    result = {
        "current_drawdown": round(current_drawdown, 2),
        "max_drawdown": round(max_drawdown, 2),
        "volatility_30d": round(vol_30d, 2),
        "volatility_90d": round(vol_90d, 2),
        "volatility_365d": round(vol_365d, 2),
        "volatility_avg": round(vol_all, 2),
        "sharpe_365d": round(sharpe_365d, 4),
        "var_95": round(var_95, 2),
        "var_99": round(var_99, 2),
        "beta_vs_spx": round(beta, 4) if beta else None,
    }

    console.print(f"  Drawdown actual: {current_drawdown:.2f}%")
    console.print(f"  Volatilidad 30d: {vol_30d:.2f}%")
    console.print(f"  Sharpe (365d): {sharpe_365d:.4f}")
    console.print(f"  VaR 95%: {var_95:.2f}%")
    console.print(f"[green]✅ Risk analysis completado[/green]")
    return result
