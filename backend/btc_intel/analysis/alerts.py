"""Alerts Engine — Automatic alerts engine."""

from rich.console import Console
from rich.table import Table

from btc_intel.db import get_supabase

console = Console()


def check_alerts() -> int:
    """Run alert rules and create applicable ones."""
    db = get_supabase()
    console.print("[cyan]Checking alert rules...[/cyan]")

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
                         f"Cycle Score >85 — Euphoria zone ({score})",
                         f"Current score: {score}. Phase: {cs.data[0]['phase']}",
                         "CYCLE_SCORE", score, 85, "bearish")
            alerts_created += 1
        elif score < 15:
            _create_alert(db, "cycle", "critical",
                         f"Cycle Score <15 — Capitulation zone ({score})",
                         f"Current score: {score}. Phase: {cs.data[0]['phase']}",
                         "CYCLE_SCORE", score, 15, "bullish")
            alerts_created += 1

    console.print(f"[green]Alerts: {alerts_created} new[/green]")
    return alerts_created


def list_alerts(severity: str | None = None) -> list:
    """List active alerts."""
    db = get_supabase()

    query = db.table("alerts").select("*").eq("acknowledged", False).order("date", desc=True)
    if severity:
        query = query.eq("severity", severity)

    result = query.limit(50).execute()

    if not result.data:
        console.print("[dim]No active alerts[/dim]")
        return []

    table = Table(title="Active Alerts", border_style="bright_blue")
    table.add_column("ID", style="dim")
    table.add_column("Sev", style="bold")
    table.add_column("Type")
    table.add_column("Title")
    table.add_column("Signal")
    table.add_column("Date", style="dim")

    sev_colors = {"critical": "red", "warning": "yellow", "info": "blue"}

    for alert in result.data:
        color = sev_colors.get(alert["severity"], "white")
        table.add_row(
            str(alert["id"]),
            f"[{color}]{alert['severity'].upper()}[/{color}]",
            alert.get("type", ""),
            alert.get("title", "")[:50],
            alert.get("signal", "—"),
            str(alert.get("date", ""))[:10],
        )

    console.print(table)
    return result.data


def ack_alert(alert_id: int):
    """Acknowledge an alert."""
    db = get_supabase()
    db.table("alerts").update({"acknowledged": True}).eq("id", alert_id).execute()
    console.print(f"[green]Alert #{alert_id} acknowledged[/green]")


def _create_alert(db, type_: str, severity: str, title: str,
                  description: str, metric: str, current_value: float,
                  threshold_value: float, signal: str):
    """Create an alert if it doesn't already exist today."""
    from datetime import date
    existing = (
        db.table("alerts")
        .select("id")
        .eq("type", type_)
        .eq("title", title)
        .gte("date", str(date.today()))
        .execute()
    )
    if existing.data:
        return

    db.table("alerts").insert({
        "date": str(date.today()),
        "type": type_,
        "severity": severity,
        "title": title,
        "description": description,
        "metric": metric,
        "current_value": current_value,
        "threshold_value": threshold_value,
        "signal": signal,
        "acknowledged": False,
    }).execute()
