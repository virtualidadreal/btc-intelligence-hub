"""Alerts Engine — Motor de alertas automáticas."""

from rich.console import Console
from rich.table import Table

from btc_intel.db import get_supabase

console = Console()


def check_alerts() -> int:
    """Ejecuta reglas de alertas y crea las que apliquen."""
    db = get_supabase()
    console.print("[cyan]Comprobando reglas de alertas...[/cyan]")

    from btc_intel.analysis.patterns import detect_patterns
    alerts_created = detect_patterns()

    # Cycle Score alerts
    cs = (
        db.table("cycle_score_history")
        .select("score,phase")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if cs.data:
        score = cs.data[0]["score"]
        if score > 85:
            _create_alert(db, "cycle", "critical",
                         f"Cycle Score >85 — Zona de euforia ({score})",
                         f"Score actual: {score}. Fase: {cs.data[0]['phase']}",
                         "CYCLE_SCORE", score, 85, "bearish")
            alerts_created += 1
        elif score < 15:
            _create_alert(db, "cycle", "critical",
                         f"Cycle Score <15 — Zona de capitulación ({score})",
                         f"Score actual: {score}. Fase: {cs.data[0]['phase']}",
                         "CYCLE_SCORE", score, 15, "bullish")
            alerts_created += 1

    console.print(f"[green]✅ Alertas: {alerts_created} nuevas[/green]")
    return alerts_created


def list_alerts(severity: str | None = None) -> list:
    """Lista alertas activas."""
    db = get_supabase()

    query = db.table("alerts").select("*").eq("acknowledged", False).order("date", desc=True)
    if severity:
        query = query.eq("severity", severity)

    result = query.limit(50).execute()

    if not result.data:
        console.print("[dim]No hay alertas activas[/dim]")
        return []

    table = Table(title="Alertas Activas", border_style="bright_blue")
    table.add_column("ID", style="dim")
    table.add_column("Sev", style="bold")
    table.add_column("Tipo")
    table.add_column("Título")
    table.add_column("Señal")
    table.add_column("Fecha", style="dim")

    sev_colors = {"critical": "red", "warning": "yellow", "info": "blue"}

    for alert in result.data:
        sev = alert["severity"]
        color = sev_colors.get(sev, "white")
        table.add_row(
            str(alert["id"]),
            f"[{color}]{sev.upper()}[/{color}]",
            alert["type"],
            alert["title"],
            alert.get("signal", "—"),
            str(alert["date"])[:10],
        )

    console.print(table)
    return result.data


def ack_alert(alert_id: int):
    """Marca una alerta como vista."""
    db = get_supabase()
    db.table("alerts").update({"acknowledged": True}).eq("id", alert_id).execute()
    console.print(f"[green]Alerta #{alert_id} marcada como vista[/green]")


def _create_alert(db, type_: str, severity: str, title: str, description: str,
                  metric: str, current_value: float, threshold_value: float, signal: str):
    """Crea alerta si no existe una similar."""
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
