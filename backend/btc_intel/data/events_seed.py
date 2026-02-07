"""Events Seed — Load curated historical events."""

from rich.console import Console

from btc_intel.db import get_supabase

console = Console()

EVENTS = [
    # Halvings
    {"date": "2012-11-28", "title": "1st Bitcoin Halving", "description": "Block reward: 50 → 25 BTC. Price: ~$12", "category": "halving", "impact": "positive", "btc_price": 12.35},
    {"date": "2016-07-09", "title": "2nd Bitcoin Halving", "description": "Block reward: 25 → 12.5 BTC. Price: ~$650", "category": "halving", "impact": "positive", "btc_price": 650.63},
    {"date": "2020-05-11", "title": "3rd Bitcoin Halving", "description": "Block reward: 12.5 → 6.25 BTC. Price: ~$8,600", "category": "halving", "impact": "positive", "btc_price": 8607.00},
    {"date": "2024-04-20", "title": "4th Bitcoin Halving", "description": "Block reward: 6.25 → 3.125 BTC. Price: ~$64,000", "category": "halving", "impact": "positive", "btc_price": 64000.00},

    # Crashes
    {"date": "2014-02-24", "title": "Mt. Gox Collapse", "description": "Mt. Gox suspends trading and files for bankruptcy. 850K BTC lost.", "category": "crash", "impact": "negative", "btc_price": 520.00},
    {"date": "2017-09-04", "title": "China Bans ICOs", "description": "PBoC declares ICOs illegal. 20% drop.", "category": "regulation", "impact": "negative", "btc_price": 4300.00},
    {"date": "2020-03-12", "title": "Black Thursday — COVID Crash", "description": "BTC drops 50% in one day due to COVID-19 panic. From $8K to $3.8K.", "category": "crash", "impact": "negative", "btc_price": 3850.00},
    {"date": "2021-05-19", "title": "China Bans Crypto Mining", "description": "China bans cryptocurrency mining. Hash rate drops 50%.", "category": "regulation", "impact": "negative", "btc_price": 36700.00},
    {"date": "2022-05-09", "title": "Terra/LUNA Collapse", "description": "UST loses peg, LUNA collapses. Massive contagion in crypto.", "category": "crash", "impact": "negative", "btc_price": 31000.00},
    {"date": "2022-11-11", "title": "FTX Collapse", "description": "FTX files for bankruptcy. BTC falls to cycle lows.", "category": "crash", "impact": "negative", "btc_price": 16800.00},

    # Adoption
    {"date": "2021-02-08", "title": "Tesla Buys $1.5B in BTC", "description": "Tesla announces Bitcoin purchase. BTC rises to $44K.", "category": "adoption", "impact": "positive", "btc_price": 44000.00},
    {"date": "2021-09-07", "title": "El Salvador Adopts BTC as Legal Tender", "description": "First country to adopt Bitcoin as legal tender.", "category": "adoption", "impact": "positive", "btc_price": 46000.00},
    {"date": "2024-01-10", "title": "Spot Bitcoin ETF Approved (SEC)", "description": "SEC approves 11 spot Bitcoin ETFs. Historic moment.", "category": "adoption", "impact": "positive", "btc_price": 46600.00},
    {"date": "2024-07-23", "title": "Spot Ethereum ETF Approved", "description": "SEC approves spot Ethereum ETFs.", "category": "adoption", "impact": "positive", "btc_price": 66000.00},
    {"date": "2025-01-20", "title": "Trump Inaugurated as Pro-Crypto President", "description": "Pro-crypto Trump administration. Strategic BTC reserve.", "category": "adoption", "impact": "positive", "btc_price": 102000.00},

    # Macro
    {"date": "2020-03-15", "title": "Fed Cuts Rates to 0% (COVID)", "description": "Emergency rate cut. Start of massive QE.", "category": "macro", "impact": "positive", "btc_price": 5100.00},
    {"date": "2020-04-09", "title": "Fed Announces Unlimited QE", "description": "Unprecedented money printing. Stimulus checks.", "category": "macro", "impact": "positive", "btc_price": 7300.00},
    {"date": "2022-03-16", "title": "Fed Raises Rates for First Time Since 2018", "description": "Start of rate hike cycle. 0.25% → target 5%+.", "category": "macro", "impact": "negative", "btc_price": 41000.00},
    {"date": "2024-09-18", "title": "Fed First Rate Cut", "description": "Fed cuts 50bp. End of hiking cycle.", "category": "macro", "impact": "positive", "btc_price": 62000.00},

    # Technical milestones
    {"date": "2017-12-17", "title": "BTC Reaches $20,000 for First Time", "description": "2017 cycle ATH. Peak euphoria.", "category": "technical", "impact": "neutral", "btc_price": 19783.00},
    {"date": "2021-03-13", "title": "BTC Breaks $60,000", "description": "New ATH driven by institutional adoption.", "category": "technical", "impact": "positive", "btc_price": 61243.00},
    {"date": "2021-11-10", "title": "BTC ATH $69,000", "description": "Absolute ATH of the 2020-2021 cycle.", "category": "technical", "impact": "neutral", "btc_price": 69000.00},
    {"date": "2024-03-14", "title": "BTC New ATH $73,700", "description": "First post-halving ATH driven by ETFs.", "category": "technical", "impact": "positive", "btc_price": 73700.00},
    {"date": "2024-12-05", "title": "BTC Breaks $100,000", "description": "Bitcoin surpasses $100K for the first time.", "category": "technical", "impact": "positive", "btc_price": 100000.00},
]


def seed_events() -> int:
    """Load historical events into Supabase."""
    db = get_supabase()
    console.print("[cyan]Loading historical events...[/cyan]")

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

    console.print(f"[green]Events: {inserted} new of {len(EVENTS)} total[/green]")
    return inserted
