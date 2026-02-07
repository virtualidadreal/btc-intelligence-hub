"""Main CLI — btc-intel."""

import asyncio
import functools

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

app = typer.Typer(
    name="btc-intel",
    help="BTC Intelligence Hub — Personal Bitcoin intelligence center",
    no_args_is_help=True,
)
console = Console()


def _run(coro):
    """Helper to run coroutines from synchronous CLI."""
    return asyncio.get_event_loop().run_until_complete(coro)


def handle_errors(func):
    """Decorator wrapping CLI commands with robust error handling."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ConnectionError as e:
            console.print(
                "[red bold]Connection error:[/red bold] "
                "Cannot connect to Supabase. "
                "Check SUPABASE_URL and SUPABASE_KEY in .env"
            )
            console.print(f"[dim]Detail: {e}[/dim]")
            raise typer.Exit(1)
        except RuntimeError as e:
            if "SUPABASE" in str(e):
                console.print(
                    "[red bold]Configuration:[/red bold] "
                    "Missing environment variables. "
                    "Check SUPABASE_URL and SUPABASE_KEY in .env"
                )
            else:
                console.print(f"[red bold]Runtime error:[/red bold] {e}")
            raise typer.Exit(1)
        except KeyError as e:
            console.print(
                f"[red bold]Missing data:[/red bold] "
                f"Key not found: {e}. "
                f"Run [bold]btc-intel update-data[/bold] first."
            )
            raise typer.Exit(1)
        except Exception as e:
            console.print(f"[red bold]Unexpected error:[/red bold] {type(e).__name__}: {e}")
            console.print(
                "[dim]Hint: Check your internet connection, "
                "environment variables in .env, "
                "and that data is up to date (btc-intel update-data).[/dim]"
            )
            raise typer.Exit(1)
    return wrapper


@app.command()
@handle_errors
def status():
    """Current status: price, cycle score, signals."""
    from btc_intel.db import get_supabase

    db = get_supabase()

    # Último precio BTC
    price_res = db.table("btc_prices").select("date,close").order("date", desc=True).limit(1).execute()

    if not price_res.data:
        console.print(
            Panel(
                "[yellow]No data. Run [bold]btc-intel update-data[/bold] to start.[/yellow]",
                title="BTC Intelligence Hub",
                border_style="bright_blue",
            )
        )
        return

    last = price_res.data[0]
    price = float(last["close"])

    # Contar records por tabla
    tables = {
        "btc_prices": "BTC Prices",
        "macro_data": "Macro",
        "onchain_metrics": "On-Chain",
        "sentiment_data": "Sentiment",
        "events": "Events",
        "cycles": "Cycles",
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

    table.add_row("BTC Price", f"[bold green]${price:,.2f}[/bold green]")
    table.add_row("Last BTC date", last["date"])
    table.add_row("Last Macro date", macro_res.data[0]["date"] if macro_res.data else "---")
    table.add_row("Last On-Chain date", onchain_res.data[0]["date"] if onchain_res.data else "---")
    table.add_row("Last Sentiment date", sentiment_res.data[0]["date"] if sentiment_res.data else "---")
    table.add_row("", "")
    for tbl, label in tables.items():
        table.add_row(f"{label}", f"{counts[tbl]:,} records")

    console.print(Panel(table, title="BTC Intelligence Hub --- Status", border_style="bright_blue"))


@app.command(name="update-data")
@handle_errors
def update_data(
    only: str = typer.Option(None, help="Only update: btc, macro, onchain, sentiment"),
):
    """Update data from external sources."""
    from btc_intel.data.updater import update_all, update_only

    if only:
        _run(update_only(only))
    else:
        _run(update_all())


@app.command(name="seed-events")
@handle_errors
def seed_events():
    """Load curated historical events."""
    from btc_intel.data.events_seed import seed_events as _seed
    _seed()


@app.command(name="seed-cycles")
@handle_errors
def seed_cycles():
    """Load historical cycles."""
    from btc_intel.data.cycles_seed import seed_cycles as _seed
    _seed()


@app.command(name="seed-all")
@handle_errors
def seed_all():
    """Load all seeds (events + cycles)."""
    from btc_intel.data.events_seed import seed_events as _seed_events
    from btc_intel.data.cycles_seed import seed_cycles as _seed_cycles
    _seed_events()
    _seed_cycles()


@app.command()
@handle_errors
def analyze(
    area: str = typer.Argument("full", help="Area: full, technical, onchain, macro, sentiment, cycles, risk, cycle-score"),
):
    """Recalculate indicators and analysis."""
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
        console.print("[bold cyan]═══ FULL ANALYSIS ═══[/bold cyan]\n")
        for name, func in engines.items():
            console.print(f"\n[bold]--- {name.upper()} ---[/bold]")
            func()
        console.print(f"\n[bold]--- ALERTS ---[/bold]")
        check_alerts()

        # Trading v2: Levels + Fibonacci + Confluence
        console.print(f"\n[bold]--- LEVELS ---[/bold]")
        from btc_intel.trading.levels import scan_levels
        scan_levels()

        console.print(f"\n[bold]--- FIBONACCI ---[/bold]")
        _run_fib_scan()

        # Backtesting: store signal snapshot after full analysis
        from btc_intel.analysis.backtesting import store_signal_snapshot, evaluate_past_signals
        console.print(f"\n[bold]--- BACKTESTING ---[/bold]")
        store_signal_snapshot()
        evaluate_past_signals()

        console.print("\n[bold green]═══ Full analysis completed ═══[/bold green]")
    elif area in engines:
        engines[area]()
    else:
        console.print(f"[red]Unknown area: {area}. Options: full, {', '.join(engines.keys())}[/red]")


@app.command(name="ai-context")
@handle_errors
def ai_context(
    scope: str = typer.Option("summary", help="Scope: summary, morning, deep, compare"),
    area: str = typer.Option(None, help="Area for deep: technical, onchain, macro, sentiment, cycle"),
    period1: str = typer.Option(None, help="Start date for compare (YYYY-MM-DD)"),
    period2: str = typer.Option(None, help="End date for compare (YYYY-MM-DD)"),
):
    """Generate context for Claude Code."""
    from btc_intel.context.builder import build_context
    ctx = build_context(scope=scope, area=area, period1=period1, period2=period2)
    console.print(ctx)


@app.command()
@handle_errors
def alerts(
    action: str = typer.Argument("list", help="Action: check, list, ack"),
    alert_id: int = typer.Argument(None),
    severity: str = typer.Option(None, help="Filter by severity: info, warning, critical"),
):
    """Alert management."""
    from btc_intel.analysis.alerts import check_alerts, list_alerts, ack_alert

    if action == "check":
        check_alerts()
    elif action == "list":
        list_alerts(severity)
    elif action == "ack" and alert_id:
        ack_alert(alert_id)
    else:
        console.print("[red]Usage: btc-intel alerts [check|list|ack] [id][/red]")


@app.command()
@handle_errors
def conclude(
    add: str = typer.Option(None, help="Conclusion text"),
    title: str = typer.Option(None, help="Title"),
    category: str = typer.Option("general", help="Category"),
    confidence: int = typer.Option(5, help="Confidence 1-10"),
    tags: str = typer.Option(None, help="Comma-separated tags"),
    list_: bool = typer.Option(False, "--list", help="List conclusions"),
    refine: int = typer.Option(None, help="Refine conclusion ID"),
    validate: int = typer.Option(None, help="Validate conclusion ID"),
    outcome: str = typer.Option(None, help="Outcome: correct, incorrect, partial"),
    score: bool = typer.Option(False, help="Show precision score"),
):
    """Conclusion management."""
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
        console.print("[red]Usage: btc-intel conclude --add 'text' --title 'title' [--category X] [--confidence N][/red]")
        console.print("[red]  or: btc-intel conclude --list[/red]")
        console.print("[red]  or: btc-intel conclude --validate ID --outcome correct|incorrect|partial[/red]")
        console.print("[red]  or: btc-intel conclude --refine ID --add 'new text'[/red]")
        console.print("[red]  or: btc-intel conclude --score[/red]")


@app.command()
@handle_errors
def report(
    type_: str = typer.Option("daily", "--type", help="Type: daily, weekly, cycle, macro, custom"),
    title: str = typer.Option(None, help="Title for custom reports"),
):
    """Generate reports."""
    from btc_intel.reports.generator import generate_report
    generate_report(type_=type_, title=title)


@app.command()
@handle_errors
def morning():
    """Complete morning routine."""
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

    console.print("[bold]1/4 Updating data...[/bold]")
    _run(update_all())

    console.print("\n[bold]2/4 Running analysis...[/bold]")
    for name, func in [
        ("technical", analyze_technical), ("onchain", analyze_onchain),
        ("macro", analyze_macro), ("sentiment", analyze_sentiment),
        ("cycles", analyze_cycles), ("risk", analyze_risk),
        ("cycle-score", calculate_cycle_score),
    ]:
        func()

    console.print("\n[bold]3/4 Checking alerts...[/bold]")
    check_alerts()

    console.print("\n[bold]4/4 Generating morning context...[/bold]")
    ctx = build_context(scope="morning")
    console.print(Panel(ctx, title="Morning Briefing", border_style="bright_blue"))

    console.print("\n[bold green]═══ MORNING ROUTINE COMPLETED ═══[/bold green]")


@app.command()
@handle_errors
def weekly():
    """Complete weekly routine."""
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

    console.print("[bold]1/5 Updating data...[/bold]")
    _run(update_all())

    console.print("\n[bold]2/5 Running analysis...[/bold]")
    for name, func in [
        ("technical", analyze_technical), ("onchain", analyze_onchain),
        ("macro", analyze_macro), ("sentiment", analyze_sentiment),
        ("cycles", analyze_cycles), ("risk", analyze_risk),
        ("cycle-score", calculate_cycle_score),
    ]:
        func()

    console.print("\n[bold]3/5 Checking alerts...[/bold]")
    check_alerts()

    console.print("\n[bold]4/5 Deep analysis by area...[/bold]")
    for area in ["technical", "onchain", "macro", "sentiment", "cycle"]:
        console.print(f"\n[bold]--- Deep: {area.upper()} ---[/bold]")
        ctx = build_context(scope="deep", area=area)
        console.print(ctx)

    console.print("\n[bold]5/5 Generating weekly report...[/bold]")
    generate_report(type_="weekly")

    console.print("\n[bold green]═══ WEEKLY ROUTINE COMPLETED ═══[/bold green]")


@app.command(name="ai-report")
@handle_errors
def ai_report():
    """Generate daily AI report (Claude Sonnet)."""
    from btc_intel.reports.ai_generator import generate_ai_report
    generate_ai_report()


@app.command()
@handle_errors
def dashboard(
    port: int = typer.Option(8000, help="Server port"),
):
    """Launch FastAPI server."""
    import uvicorn
    from btc_intel.main import app as fastapi_app

    console.print(f"[green]Launching dashboard at http://localhost:{port}[/green]")
    uvicorn.run(fastapi_app, host="0.0.0.0", port=port)


def _run_fib_scan():
    """Helper: run Fibonacci scan + confluence detection."""
    import pandas as pd
    from btc_intel.db import get_supabase
    from btc_intel.trading.fibonacci import FibonacciEngine, FibConfluenceDetector

    db = get_supabase()
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")
    res = db.table("btc_prices").select("date,open,high,low,close,volume").gte("date", cutoff).order("date", desc=False).execute()
    if not res.data:
        console.print("  [dim]No price data for Fibonacci[/dim]")
        return
    df = pd.DataFrame(res.data)
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["open", "high", "low", "close"])
    current_price = float(df.iloc[-1]["close"])

    engine = FibonacciEngine()
    fib_data = engine.scan_all_timeframes(df, current_price)
    console.print(f"  Fibonacci calculated for {len(fib_data)} timeframes")

    detector = FibConfluenceDetector()
    confluences = detector.find_confluences(fib_data)
    detector.persist_confluences(confluences, current_price)
    console.print(f"  Confluences detected: {len(confluences)}")


@app.command()
@handle_errors
def levels(
    action: str = typer.Argument("scan", help="Action: scan, list"),
    min_strength: int = typer.Option(0, help="Minimum strength for list (0-20)"),
):
    """Level Engine — Detect S/R, volume zones, psychological levels."""
    from btc_intel.trading.levels import scan_levels, list_levels as _list_levels
    from btc_intel.trading.levels.level_scorer import classify_level

    if action == "scan":
        scan_levels()
    elif action == "list":
        data = _list_levels(min_strength)
        if not data:
            console.print("[dim]No levels found. Run [bold]btc-intel levels scan[/bold] first.[/dim]")
            return
        table = Table(title=f"Price Levels (min strength {min_strength})")
        table.add_column("Price", style="cyan", justify="right")
        table.add_column("Type", style="bold")
        table.add_column("Strength", justify="center")
        table.add_column("Class")
        table.add_column("Sources")
        for row in data:
            strength = row.get("strength", 0)
            classification = classify_level(strength)
            cls_color = {"critical": "red bold", "strong": "yellow", "moderate": "green"}.get(classification, "dim")
            type_color = "green" if row.get("type") == "support" else "red"
            table.add_row(
                f"${row.get('price', 0):,.0f}",
                f"[{type_color}]{row.get('type', '').upper()}[/]",
                str(strength),
                f"[{cls_color}]{classification.upper()}[/]",
                ", ".join(row.get("sources", row.get("source", [])) or []),
            )
        console.print(table)
    else:
        console.print(f"[red]Unknown action: {action}. Options: scan, list[/red]")


@app.command()
@handle_errors
def fib(
    action: str = typer.Argument("scan", help="Action: scan, confluences"),
    tf: str = typer.Option(None, help="Timeframe filter for show (1H, 4H, 1D, 1W)"),
):
    """Fibonacci Engine — Retracements, extensions, confluences."""
    if action == "scan":
        _run_fib_scan()
    elif action == "confluences":
        from btc_intel.db import get_supabase
        db = get_supabase()
        res = db.table("confluence_zones").select("*").order("num_timeframes", desc=True).execute()
        if not res.data:
            console.print("[dim]No confluences found. Run [bold]btc-intel fib scan[/bold] first.[/dim]")
            return
        table = Table(title="Fibonacci Confluences (Multi-TF)")
        table.add_column("Price", style="cyan", justify="right")
        table.add_column("TFs", justify="center")
        table.add_column("Ratios")
        table.add_column("Quality", justify="center")
        for row in res.data:
            table.add_row(
                f"${row.get('price', 0):,.0f}",
                str(row.get("num_timeframes", 0)),
                ", ".join(str(r) for r in (row.get("fib_ratios") or [])),
                str(row.get("max_quality", 0)),
            )
        console.print(table)
    else:
        console.print(f"[red]Unknown action: {action}. Options: scan, confluences[/red]")


@app.command(name="db-check")
@handle_errors
def db_check():
    """Verify Supabase connection."""
    from btc_intel.db import get_supabase

    db = get_supabase()
    db.table("btc_prices").select("id").limit(1).execute()
    console.print("[green]Supabase connection OK[/green]")

    tables = [
        "btc_prices", "technical_indicators", "onchain_metrics",
        "macro_data", "sentiment_data", "cycles", "events",
        "alerts", "conclusions", "cycle_score_history", "reports",
    ]
    for table in tables:
        try:
            res = db.table(table).select("id", count="exact").limit(0).execute()
            count = res.count if res.count is not None else 0
            status_label = f"{count} records" if count > 0 else "empty"
            console.print(f"  {table}: {status_label}")
        except Exception:
            console.print(f"  {table}: table not found")
