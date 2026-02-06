"""One-time fix: Update halving cycle bottom prices with correct bear market lows."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from btc_intel.db import get_supabase
from rich.console import Console

console = Console()

FIXES = [
    {
        "name": "Ciclo Halving 1 (2012-2016)",
        "btc_price_bottom": 178.10,
        "bottom_date": "2015-01-14",
    },
    {
        "name": "Ciclo Halving 2 (2016-2020)",
        "btc_price_bottom": 3200.00,
        "bottom_date": "2018-12-15",
    },
    {
        "name": "Ciclo Halving 3 (2020-2024)",
        "btc_price_bottom": 15500.00,
        "bottom_date": "2022-11-21",
    },
]


def main():
    db = get_supabase()
    console.print("[cyan]Fixing halving cycle bottom prices...[/cyan]")

    for fix in FIXES:
        name = fix.pop("name")
        result = db.table("cycles").update(fix).eq("name", name).execute()
        if result.data:
            console.print(f"  [green]Updated {name}: bottom=${fix['btc_price_bottom']} on {fix['bottom_date']}[/green]")
        else:
            console.print(f"  [yellow]Not found: {name}[/yellow]")

    console.print("[green]Done.[/green]")


if __name__ == "__main__":
    main()
