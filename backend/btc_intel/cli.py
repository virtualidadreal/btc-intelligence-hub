"""CLI principal — btc-intel."""

import asyncio
import functools

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(
    name="btc-intel",
    help="BTC Intelligence Hub — Centro de inteligencia personal sobre Bitcoin",
    no_args_is_help=True,
)
console = Console()


def _run(coro):
    """Helper para ejecutar coroutines desde CLI síncrono."""
    return asyncio.get_event_loop().run_until_complete(coro)


def handle_errors(func):
    """Decorator que envuelve comandos CLI con manejo de errores robusto."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ConnectionError as e:
            console.print(
                "[red bold]Error de conexion:[/red bold] "
                "No se puede conectar a Supabase. "
                "Verifica SUPABASE_URL y SUPABASE_KEY en .env"
            )
            console.print(f"[dim]Detalle: {e}[/dim]")
            raise typer.Exit(1)
        except RuntimeError as e:
            if "SUPABASE" in str(e):
                console.print(
                    "[red bold]Configuracion:[/red bold] "
                    "Faltan variables de entorno. "
                    "Revisa SUPABASE_URL y SUPABASE_KEY en .env"
                )
            else:
                console.print(f"[red bold]Error de runtime:[/red bold] {e}")
            raise typer.Exit(1)
        except KeyError as e:
            console.print(
                f"[red bold]Datos faltantes:[/red bold] "
                f"Clave no encontrada: {e}. "
                f"Ejecuta [bold]btc-intel update-data[/bold] primero."
            )
            raise typer.Exit(1)
        except Exception as e:
            console.print(f"[red bold]Error inesperado:[/red bold] {type(e).__name__}: {e}")
            console.print(
                "[dim]Sugerencia: Verifica tu conexion a internet, "
                "las variables de entorno en .env, "
                "y que los datos esten actualizados (btc-intel update-data).[/dim]"
            )
            raise typer.Exit(1)
    return wrapper


@app.command()
@handle_errors
def status():
    """Estado actual: precio, cycle score, señales."""
    from btc_intel.db import get_supabase

    db = get_supabase()

    # Último precio BTC
    price_res = db.table("btc_prices").select("date,close").order("date", desc=True).limit(1).execute()

    if not price_res.data:
        console.print(
            Panel(
                "[yellow]No hay datos. Ejecuta [bold]btc-intel update-data[/bold] para empezar.[/yellow]",
                title="BTC Intelligence Hub",
                border_style="bright_blue",
            )
        )
        return

    last = price_res.data[0]
    price = float(last["close"])

    # Contar registros por tabla
    tables = {
        "btc_prices": "BTC Prices",
        "macro_data": "Macro",
        "onchain_metrics": "On-Chain",
        "sentiment_data": "Sentiment",
        "events": "Eventos",
        "cycles": "Ciclos",
    }
    counts = {}
    for table in tables:
        res = db.table(table).select("id", count="exact").limit(0).execute()
        counts[table] = res.count or 0

    # Últimas fechas
    macro_res = db.table("macro_data").select("date").order("date", desc=True).limit(1).execute()
    onchain_res = db.table("onchain_metrics").select("date").order("date", desc=True).limit(1).execute()
    sentiment_res = db.table("sentiment_data").select("date").order("date", desc=True).limit(1).execute()

    table = Table(show_header=False, border_style="bright_blue", padding=(0, 2))
    table.add_column("Key", style="bold")
    table.add_column("Value")

    table.add_row("Precio BTC", f"[bold green]${price:,.2f}[/bold green]")
    table.add_row("Última fecha BTC", last["date"])
    table.add_row("Última fecha Macro", macro_res.data[0]["date"] if macro_res.data else "---")
    table.add_row("Última fecha On-Chain", onchain_res.data[0]["date"] if onchain_res.data else "---")
    table.add_row("Última fecha Sentiment", sentiment_res.data[0]["date"] if sentiment_res.data else "---")
    table.add_row("", "")
    for tbl, label in tables.items():
        table.add_row(f"{label}", f"{counts[tbl]:,} registros")

    console.print(Panel(table, title="BTC Intelligence Hub --- Status", border_style="bright_blue"))


@app.command(name="update-data")
@handle_errors
def update_data(
    only: str = typer.Option(None, help="Solo actualizar: btc, macro, onchain, sentiment"),
):
    """Actualiza datos desde fuentes externas."""
    from btc_intel.data.updater import update_all, update_only

    if only:
        _run(update_only(only))
    else:
        _run(update_all())


@app.command(name="seed-events")
@handle_errors
def seed_events():
    """Carga eventos históricos curados."""
    from btc_intel.data.events_seed import seed_events as _seed
    _seed()


@app.command(name="seed-cycles")
@handle_errors
def seed_cycles():
    """Carga ciclos históricos."""
    from btc_intel.data.cycles_seed import seed_cycles as _seed
    _seed()


@app.command(name="seed-all")
@handle_errors
def seed_all():
    """Carga todos los seeds (eventos + ciclos)."""
    from btc_intel.data.events_seed import seed_events as _seed_events
    from btc_intel.data.cycles_seed import seed_cycles as _seed_cycles
    _seed_events()
    _seed_cycles()


@app.command()
@handle_errors
def analyze(
    area: str = typer.Argument("full", help="Área: full, technical, onchain, macro, sentiment, cycles, risk, cycle-score"),
):
    """Recalcula indicadores y análisis."""
    from btc_intel.analysis.technical import analyze_technical
    from btc_intel.analysis.onchain import analyze_onchain
    from btc_intel.analysis.macro import analyze_macro
    from btc_intel.analysis.sentiment import analyze_sentiment
    from btc_intel.analysis.cycles import analyze_cycles
    from btc_intel.analysis.risk import analyze_risk
    from btc_intel.analysis.cycle_score import calculate_cycle_score
    from btc_intel.analysis.alerts import check_alerts

    from btc_intel.analysis.derivatives import analyze_derivatives

    engines = {
        "technical": analyze_technical,
        "onchain": analyze_onchain,
        "macro": analyze_macro,
        "sentiment": analyze_sentiment,
        "cycles": analyze_cycles,
        "risk": analyze_risk,
        "cycle-score": calculate_cycle_score,
        "derivatives": analyze_derivatives,
    }

    if area == "full":
        console.print("[bold cyan]═══ Análisis COMPLETO ═══[/bold cyan]\n")
        for name, func in engines.items():
            console.print(f"\n[bold]--- {name.upper()} ---[/bold]")
            func()
        console.print(f"\n[bold]--- ALERTAS ---[/bold]")
        check_alerts()

        # Backtesting: store signal snapshot after full analysis
        from btc_intel.analysis.backtesting import store_signal_snapshot, evaluate_past_signals
        console.print(f"\n[bold]--- BACKTESTING ---[/bold]")
        store_signal_snapshot()
        evaluate_past_signals()

        console.print("\n[bold green]═══ Análisis completo terminado ═══[/bold green]")
    elif area in engines:
        engines[area]()
    else:
        console.print(f"[red]Área desconocida: {area}. Opciones: full, {', '.join(engines.keys())}[/red]")


@app.command(name="ai-context")
@handle_errors
def ai_context(
    scope: str = typer.Option("summary", help="Scope: summary, morning, deep, compare"),
    area: str = typer.Option(None, help="Área para deep: technical, onchain, macro, sentiment, cycle"),
    period1: str = typer.Option(None, help="Fecha inicio para compare (YYYY-MM-DD)"),
    period2: str = typer.Option(None, help="Fecha fin para compare (YYYY-MM-DD)"),
):
    """Genera contexto para Claude Code."""
    from btc_intel.context.builder import build_context
    ctx = build_context(scope=scope, area=area, period1=period1, period2=period2)
    console.print(ctx)


@app.command()
@handle_errors
def alerts(
    action: str = typer.Argument("list", help="Acción: check, list, ack"),
    alert_id: int = typer.Argument(None),
    severity: str = typer.Option(None, help="Filtrar por severidad: info, warning, critical"),
):
    """Gestión de alertas."""
    from btc_intel.analysis.alerts import check_alerts, list_alerts, ack_alert

    if action == "check":
        check_alerts()
    elif action == "list":
        list_alerts(severity)
    elif action == "ack" and alert_id:
        ack_alert(alert_id)
    else:
        console.print("[red]Uso: btc-intel alerts [check|list|ack] [id][/red]")


@app.command()
@handle_errors
def conclude(
    add: str = typer.Option(None, help="Texto de la conclusión"),
    title: str = typer.Option(None, help="Título"),
    category: str = typer.Option("general", help="Categoría"),
    confidence: int = typer.Option(5, help="Confianza 1-10"),
    tags: str = typer.Option(None, help="Tags separados por coma"),
    list_: bool = typer.Option(False, "--list", help="Listar conclusiones"),
    refine: int = typer.Option(None, help="Refinar conclusión ID"),
    validate: int = typer.Option(None, help="Validar conclusión ID"),
    outcome: str = typer.Option(None, help="Resultado: correct, incorrect, partial"),
    score: bool = typer.Option(False, help="Mostrar score de precisión"),
):
    """Gestión de conclusiones."""
    from btc_intel.conclusions.manager import (
        create, list_conclusions, refine as refine_fn,
        validate as validate_fn, score as score_fn,
    )

    if score:
        score_fn()
    elif list_:
        list_conclusions(category=category if category != "general" else None)
    elif validate is not None and outcome:
        validate_fn(validate, outcome)
    elif refine is not None and add:
        refine_fn(refine, add)
    elif add and title:
        create(content=add, title=title, category=category,
               confidence=confidence, tags=tags)
    else:
        console.print("[red]Uso: btc-intel conclude --add 'texto' --title 'título' [--category X] [--confidence N][/red]")
        console.print("[red]  o: btc-intel conclude --list[/red]")
        console.print("[red]  o: btc-intel conclude --validate ID --outcome correct|incorrect|partial[/red]")
        console.print("[red]  o: btc-intel conclude --refine ID --add 'nuevo texto'[/red]")
        console.print("[red]  o: btc-intel conclude --score[/red]")


@app.command()
@handle_errors
def report(
    type_: str = typer.Option("daily", "--type", help="Tipo: daily, weekly, cycle, macro, custom"),
    title: str = typer.Option(None, help="Título para custom reports"),
):
    """Genera informes."""
    from btc_intel.reports.generator import generate_report
    generate_report(type_=type_, title=title)


@app.command()
@handle_errors
def morning():
    """Rutina matutina completa."""
    from btc_intel.data.updater import update_all
    from btc_intel.analysis.technical import analyze_technical
    from btc_intel.analysis.onchain import analyze_onchain
    from btc_intel.analysis.macro import analyze_macro
    from btc_intel.analysis.sentiment import analyze_sentiment
    from btc_intel.analysis.cycles import analyze_cycles
    from btc_intel.analysis.risk import analyze_risk
    from btc_intel.analysis.cycle_score import calculate_cycle_score
    from btc_intel.analysis.alerts import check_alerts
    from btc_intel.context.builder import build_context

    console.print("[bold cyan]═══ MORNING ROUTINE ═══[/bold cyan]\n")

    console.print("[bold]1/4 Actualizando datos...[/bold]")
    _run(update_all())

    console.print("\n[bold]2/4 Ejecutando análisis...[/bold]")
    for name, func in [
        ("technical", analyze_technical), ("onchain", analyze_onchain),
        ("macro", analyze_macro), ("sentiment", analyze_sentiment),
        ("cycles", analyze_cycles), ("risk", analyze_risk),
        ("cycle-score", calculate_cycle_score),
    ]:
        func()

    console.print("\n[bold]3/4 Comprobando alertas...[/bold]")
    check_alerts()

    console.print("\n[bold]4/4 Generando contexto morning...[/bold]")
    ctx = build_context(scope="morning")
    console.print(Panel(ctx, title="Morning Briefing", border_style="bright_blue"))

    console.print("\n[bold green]═══ MORNING ROUTINE COMPLETADA ═══[/bold green]")


@app.command()
@handle_errors
def weekly():
    """Rutina semanal completa."""
    from btc_intel.data.updater import update_all
    from btc_intel.analysis.technical import analyze_technical
    from btc_intel.analysis.onchain import analyze_onchain
    from btc_intel.analysis.macro import analyze_macro
    from btc_intel.analysis.sentiment import analyze_sentiment
    from btc_intel.analysis.cycles import analyze_cycles
    from btc_intel.analysis.risk import analyze_risk
    from btc_intel.analysis.cycle_score import calculate_cycle_score
    from btc_intel.analysis.alerts import check_alerts
    from btc_intel.context.builder import build_context
    from btc_intel.reports.generator import generate_report

    console.print("[bold cyan]═══ WEEKLY ROUTINE ═══[/bold cyan]\n")

    console.print("[bold]1/5 Actualizando datos...[/bold]")
    _run(update_all())

    console.print("\n[bold]2/5 Ejecutando análisis...[/bold]")
    for name, func in [
        ("technical", analyze_technical), ("onchain", analyze_onchain),
        ("macro", analyze_macro), ("sentiment", analyze_sentiment),
        ("cycles", analyze_cycles), ("risk", analyze_risk),
        ("cycle-score", calculate_cycle_score),
    ]:
        func()

    console.print("\n[bold]3/5 Comprobando alertas...[/bold]")
    check_alerts()

    console.print("\n[bold]4/5 Deep analysis por área...[/bold]")
    for area in ["technical", "onchain", "macro", "sentiment", "cycle"]:
        console.print(f"\n[bold]--- Deep: {area.upper()} ---[/bold]")
        ctx = build_context(scope="deep", area=area)
        console.print(ctx)

    console.print("\n[bold]5/5 Generando informe semanal...[/bold]")
    generate_report(type_="weekly")

    console.print("\n[bold green]═══ WEEKLY ROUTINE COMPLETADA ═══[/bold green]")


@app.command(name="ai-report")
@handle_errors
def ai_report():
    """Genera informe diario con AI (Claude Sonnet)."""
    from btc_intel.reports.ai_generator import generate_ai_report
    generate_ai_report()


@app.command()
@handle_errors
def dashboard(
    port: int = typer.Option(8000, help="Puerto del servidor"),
):
    """Lanza el servidor FastAPI."""
    import uvicorn
    from btc_intel.main import app as fastapi_app

    console.print(f"[green]🚀 Lanzando dashboard en http://localhost:{port}[/green]")
    uvicorn.run(fastapi_app, host="0.0.0.0", port=port)


@app.command(name="db-check")
@handle_errors
def db_check():
    """Verifica la conexión a Supabase."""
    from btc_intel.db import get_supabase

    db = get_supabase()
    db.table("btc_prices").select("id").limit(1).execute()
    console.print("[green]Conexion a Supabase OK[/green]")

    tables = [
        "btc_prices", "technical_indicators", "onchain_metrics",
        "macro_data", "sentiment_data", "cycles", "events",
        "alerts", "conclusions", "cycle_score_history", "reports",
    ]
    for table in tables:
        try:
            res = db.table(table).select("id", count="exact").limit(0).execute()
            count = res.count if res.count is not None else 0
            status_label = f"{count} registros" if count > 0 else "vacia"
            console.print(f"  {table}: {status_label}")
        except Exception:
            console.print(f"  {table}: tabla no encontrada")
