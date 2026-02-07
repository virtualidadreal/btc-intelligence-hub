"""Pattern Detection — Detect technical patterns and generate alerts."""

from datetime import date

import pandas as pd
from rich.console import Console

from btc_intel.db import get_supabase

console = Console()


def detect_patterns() -> int:
    """Detecta patrones técnicos y los registra como alertas."""
    db = get_supabase()
    console.print("[cyan]Detectando patrones...[/cyan]")

    alerts_created = 0

    # Cargar indicadores recientes
    today = str(date.today())
    sma_cross = (
        db.table("technical_indicators")
        .select("date,value,signal")
        .eq("indicator", "SMA_CROSS")
        .order("date", desc=True)
        .limit(5)
        .execute()
    )

    rsi = (
        db.table("technical_indicators")
        .select("date,value,signal")
        .eq("indicator", "RSI_14")
        .order("date", desc=True)
        .limit(5)
        .execute()
    )

    # Golden Cross / Death Cross detection
    if sma_cross.data and len(sma_cross.data) >= 2:
        curr = float(sma_cross.data[0]["value"])
        prev = float(sma_cross.data[1]["value"])

        if curr > 0 and prev <= 0:
            _create_alert(db, "technical", "warning", "Golden Cross detectado",
                         "SMA50 ha cruzado por encima de SMA200", "SMA_CROSS", curr, 0, "bullish")
            alerts_created += 1
        elif curr < 0 and prev >= 0:
            _create_alert(db, "technical", "warning", "Death Cross detectado",
                         "SMA50 ha cruzado por debajo de SMA200", "SMA_CROSS", curr, 0, "bearish")
            alerts_created += 1

        # Golden/Death cross inminente
        if abs(curr) < 500 and curr < 0:
            _create_alert(db, "technical", "info", "Golden Cross inminente",
                         f"SMA50 a ${abs(curr):.0f} de SMA200", "SMA_CROSS", curr, 0, "bullish")
            alerts_created += 1
        elif abs(curr) < 500 and curr > 0:
            _create_alert(db, "technical", "info", "Death Cross inminente",
                         f"SMA50 a ${abs(curr):.0f} de SMA200", "SMA_CROSS", curr, 0, "bearish")
            alerts_created += 1

    # RSI extremos
    if rsi.data:
        rsi_val = float(rsi.data[0]["value"])
        if rsi_val > 70:
            _create_alert(db, "technical", "warning", "RSI en zona de sobrecompra",
                         f"RSI(14) = {rsi_val:.1f}", "RSI_14", rsi_val, 70, "bearish")
            alerts_created += 1
        elif rsi_val < 30:
            _create_alert(db, "technical", "warning", "RSI en zona de sobreventa",
                         f"RSI(14) = {rsi_val:.1f}", "RSI_14", rsi_val, 30, "bullish")
            alerts_created += 1

    console.print(f"[green]Patterns: {alerts_created} alerts created[/green]")
    return alerts_created


def _create_alert(db, type_: str, severity: str, title: str, description: str,
                  metric: str, current_value: float, threshold_value: float, signal: str):
    """Crea una alerta si no existe una similar reciente."""
    # No duplicar: verificar si hay alerta similar en últimas 24h
    existing = (
        db.table("alerts")
        .select("id")
        .eq("title", title)
        .eq("acknowledged", False)
        .limit(1)
        .execute()
    )
    if existing.data:
        return

    db.table("alerts").insert({
        "type": type_,
        "severity": severity,
        "title": title,
        "description": description,
        "metric": metric,
        "current_value": current_value,
        "threshold_value": threshold_value,
        "signal": signal,
    }).execute()
