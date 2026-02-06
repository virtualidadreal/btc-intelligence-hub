"""Cycles Seed — Define ciclos históricos de Bitcoin."""

from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

CYCLES = [
    # Halving cycles completos
    # bottom = bear market low after the peak, NOT the halving date price
    {
        "name": "Ciclo Halving 1 (2012-2016)",
        "type": "halving",
        "start_date": "2012-11-28",
        "end_date": "2016-07-09",
        "btc_price_start": 12.35,
        "btc_price_end": 650.63,
        "btc_price_peak": 1163.00,
        "btc_price_bottom": 178.10,
        "peak_date": "2013-11-30",
        "bottom_date": "2015-01-14",
        "duration_days": 1319,
        "roi_percent": 5167.00,
        "max_drawdown": -87.00,
    },
    {
        "name": "Ciclo Halving 2 (2016-2020)",
        "type": "halving",
        "start_date": "2016-07-09",
        "end_date": "2020-05-11",
        "btc_price_start": 650.63,
        "btc_price_end": 8607.00,
        "btc_price_peak": 19783.00,
        "btc_price_bottom": 3200.00,
        "peak_date": "2017-12-17",
        "bottom_date": "2018-12-15",
        "duration_days": 1402,
        "roi_percent": 1222.00,
        "max_drawdown": -84.00,
    },
    {
        "name": "Ciclo Halving 3 (2020-2024)",
        "type": "halving",
        "start_date": "2020-05-11",
        "end_date": "2024-04-20",
        "btc_price_start": 8607.00,
        "btc_price_end": 64000.00,
        "btc_price_peak": 69000.00,
        "btc_price_bottom": 15500.00,
        "peak_date": "2021-11-10",
        "bottom_date": "2022-11-21",
        "duration_days": 1441,
        "roi_percent": 643.00,
        "max_drawdown": -77.00,
    },
    {
        "name": "Ciclo Halving 4 (2024-presente)",
        "type": "halving",
        "start_date": "2024-04-20",
        "end_date": None,
        "btc_price_start": 64000.00,
        "btc_price_end": None,
        "btc_price_peak": 109000.00,
        "btc_price_bottom": 64000.00,
        "peak_date": "2025-01-20",
        "bottom_date": "2024-04-20",
        "duration_days": None,
        "roi_percent": None,
        "max_drawdown": None,
    },

    # Bull markets
    {
        "name": "Bull Market 2013",
        "type": "bull",
        "start_date": "2012-11-28",
        "end_date": "2013-11-30",
        "btc_price_start": 12.35,
        "btc_price_end": 1163.00,
        "btc_price_peak": 1163.00,
        "peak_date": "2013-11-30",
        "duration_days": 367,
        "roi_percent": 9316.00,
    },
    {
        "name": "Bull Market 2017",
        "type": "bull",
        "start_date": "2015-01-14",
        "end_date": "2017-12-17",
        "btc_price_start": 178.00,
        "btc_price_end": 19783.00,
        "btc_price_peak": 19783.00,
        "peak_date": "2017-12-17",
        "duration_days": 1068,
        "roi_percent": 11013.00,
    },
    {
        "name": "Bull Market 2021",
        "type": "bull",
        "start_date": "2018-12-15",
        "end_date": "2021-11-10",
        "btc_price_start": 3200.00,
        "btc_price_end": 69000.00,
        "btc_price_peak": 69000.00,
        "peak_date": "2021-11-10",
        "duration_days": 1061,
        "roi_percent": 2056.00,
    },

    # Bear markets
    {
        "name": "Bear Market 2014-2015",
        "type": "bear",
        "start_date": "2013-12-01",
        "end_date": "2015-01-14",
        "btc_price_start": 1163.00,
        "btc_price_end": 178.00,
        "btc_price_bottom": 178.00,
        "bottom_date": "2015-01-14",
        "duration_days": 410,
        "max_drawdown": -87.00,
    },
    {
        "name": "Bear Market 2018-2019",
        "type": "bear",
        "start_date": "2017-12-18",
        "end_date": "2018-12-15",
        "btc_price_start": 19783.00,
        "btc_price_end": 3200.00,
        "btc_price_bottom": 3200.00,
        "bottom_date": "2018-12-15",
        "duration_days": 362,
        "max_drawdown": -84.00,
    },
    {
        "name": "Bear Market 2022",
        "type": "bear",
        "start_date": "2021-11-11",
        "end_date": "2022-11-21",
        "btc_price_start": 69000.00,
        "btc_price_end": 15500.00,
        "btc_price_bottom": 15500.00,
        "bottom_date": "2022-11-21",
        "duration_days": 375,
        "max_drawdown": -77.00,
    },
]


def seed_cycles() -> int:
    """Carga ciclos históricos en Supabase."""
    db = get_supabase()
    console.print("[cyan]Cargando ciclos históricos...[/cyan]")

    inserted = 0
    for cycle in CYCLES:
        try:
            existing = (
                db.table("cycles")
                .select("id")
                .eq("name", cycle["name"])
                .execute()
            )
            if existing.data:
                continue

            db.table("cycles").insert(cycle).execute()
            inserted += 1
        except Exception as e:
            console.print(f"  [red]Error: {cycle['name']} — {e}[/red]")

    console.print(f"[green]✅ Ciclos: {inserted} nuevos de {len(CYCLES)} totales[/green]")
    return inserted
