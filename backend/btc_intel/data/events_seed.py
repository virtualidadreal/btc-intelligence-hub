"""Events Seed — Carga eventos históricos curados."""

from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

EVENTS = [
    # Halvings
    {"date": "2012-11-28", "title": "1er Halving Bitcoin", "description": "Block reward: 50 → 25 BTC. Precio: ~$12", "category": "halving", "impact": "positive", "btc_price": 12.35},
    {"date": "2016-07-09", "title": "2do Halving Bitcoin", "description": "Block reward: 25 → 12.5 BTC. Precio: ~$650", "category": "halving", "impact": "positive", "btc_price": 650.63},
    {"date": "2020-05-11", "title": "3er Halving Bitcoin", "description": "Block reward: 12.5 → 6.25 BTC. Precio: ~$8,600", "category": "halving", "impact": "positive", "btc_price": 8607.00},
    {"date": "2024-04-20", "title": "4to Halving Bitcoin", "description": "Block reward: 6.25 → 3.125 BTC. Precio: ~$64,000", "category": "halving", "impact": "positive", "btc_price": 64000.00},

    # Crashes
    {"date": "2014-02-24", "title": "Colapso Mt. Gox", "description": "Mt. Gox suspende trading y declara bancarrota. 850K BTC perdidos.", "category": "crash", "impact": "negative", "btc_price": 520.00},
    {"date": "2017-09-04", "title": "China banea ICOs", "description": "PBoC declara ilegales las ICOs. Caída del 20%.", "category": "regulation", "impact": "negative", "btc_price": 4300.00},
    {"date": "2020-03-12", "title": "Black Thursday — COVID Crash", "description": "BTC cae 50% en un día por pánico COVID-19. De $8K a $3.8K.", "category": "crash", "impact": "negative", "btc_price": 3850.00},
    {"date": "2021-05-19", "title": "China banea minería crypto", "description": "China prohíbe minería de criptomonedas. Hash rate cae 50%.", "category": "regulation", "impact": "negative", "btc_price": 36700.00},
    {"date": "2022-05-09", "title": "Colapso Terra/LUNA", "description": "UST pierde peg, LUNA colapsa. Contagio masivo en crypto.", "category": "crash", "impact": "negative", "btc_price": 31000.00},
    {"date": "2022-11-11", "title": "Colapso FTX", "description": "FTX se declara en bancarrota. BTC cae a mínimos del ciclo.", "category": "crash", "impact": "negative", "btc_price": 16800.00},

    # Adopción
    {"date": "2021-02-08", "title": "Tesla compra $1.5B en BTC", "description": "Tesla anuncia compra de Bitcoin. BTC sube a $44K.", "category": "adoption", "impact": "positive", "btc_price": 44000.00},
    {"date": "2021-09-07", "title": "El Salvador adopta BTC como moneda legal", "description": "Primer país en adoptar Bitcoin como moneda de curso legal.", "category": "adoption", "impact": "positive", "btc_price": 46000.00},
    {"date": "2024-01-10", "title": "ETF Spot Bitcoin aprobado (SEC)", "description": "SEC aprueba 11 ETFs spot de Bitcoin. Momento histórico.", "category": "adoption", "impact": "positive", "btc_price": 46600.00},
    {"date": "2024-07-23", "title": "ETF Spot Ethereum aprobado", "description": "SEC aprueba ETFs spot de Ethereum.", "category": "adoption", "impact": "positive", "btc_price": 66000.00},
    {"date": "2025-01-20", "title": "Trump asume como presidente pro-crypto", "description": "Administración Trump pro-crypto. Reserva estratégica de BTC.", "category": "adoption", "impact": "positive", "btc_price": 102000.00},

    # Macro
    {"date": "2020-03-15", "title": "Fed recorta tasas a 0% (COVID)", "description": "Emergency rate cut. Inicio de QE masivo.", "category": "macro", "impact": "positive", "btc_price": 5100.00},
    {"date": "2020-04-09", "title": "Fed anuncia QE ilimitado", "description": "Impresión de dinero sin precedentes. Stimulus checks.", "category": "macro", "impact": "positive", "btc_price": 7300.00},
    {"date": "2022-03-16", "title": "Fed sube tasas por primera vez desde 2018", "description": "Inicio del ciclo de subidas. 0.25% → objetivo 5%+.", "category": "macro", "impact": "negative", "btc_price": 41000.00},
    {"date": "2024-09-18", "title": "Fed primer recorte de tasas", "description": "Fed recorta 50bp. Fin del ciclo de subidas.", "category": "macro", "impact": "positive", "btc_price": 62000.00},

    # Technical milestones
    {"date": "2017-12-17", "title": "BTC alcanza $20,000 por primera vez", "description": "ATH del ciclo 2017. Euforia máxima.", "category": "technical", "impact": "neutral", "btc_price": 19783.00},
    {"date": "2021-03-13", "title": "BTC supera $60,000", "description": "Nuevo ATH impulsado por adopción institucional.", "category": "technical", "impact": "positive", "btc_price": 61243.00},
    {"date": "2021-11-10", "title": "BTC ATH $69,000", "description": "ATH absoluto del ciclo 2020-2021.", "category": "technical", "impact": "neutral", "btc_price": 69000.00},
    {"date": "2024-03-14", "title": "BTC nuevo ATH $73,700", "description": "Primer ATH post-halving impulsado por ETFs.", "category": "technical", "impact": "positive", "btc_price": 73700.00},
    {"date": "2024-12-05", "title": "BTC supera $100,000", "description": "Bitcoin supera los $100K por primera vez.", "category": "technical", "impact": "positive", "btc_price": 100000.00},
]


def seed_events() -> int:
    """Carga eventos históricos en Supabase."""
    db = get_supabase()
    console.print("[cyan]Cargando eventos históricos...[/cyan]")

    inserted = 0
    for event in EVENTS:
        try:
            # Check if exists
            existing = (
                db.table("events")
                .select("id")
                .eq("date", event["date"])
                .eq("title", event["title"])
                .execute()
            )
            if existing.data:
                continue

            db.table("events").insert(event).execute()
            inserted += 1
        except Exception as e:
            console.print(f"  [red]Error: {event['title']} — {e}[/red]")

    console.print(f"[green]✅ Eventos: {inserted} nuevos de {len(EVENTS)} totales[/green]")
    return inserted
