"""Conclusions Manager — Full CRUD with versioning and validation."""

from datetime import date

from rich.console import Console
from rich.table import Table

from btc_intel.db import get_supabase

console = Console()


def _get_data_snapshot(db) -> dict:
    """Capture snapshot of the current data state."""
    snapshot = {}

    # BTC Price
    price = db.table("btc_prices").select("close").order("date", desc=True).limit(1).execute()
    if price.data:
        snapshot["btc_price"] = float(price.data[0]["close"])

    # Cycle Score
    cs = db.table("cycle_score_history").select("score,phase").order("date", desc=True).limit(1).execute()
    if cs.data:
        snapshot["cycle_score"] = cs.data[0]["score"]
        snapshot["phase"] = cs.data[0]["phase"]

    # RSI
    rsi = (
        db.table("technical_indicators")
        .select("value")
        .eq("indicator", "RSI_14")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if rsi.data:
        snapshot["rsi"] = round(float(rsi.data[0]["value"]), 2)

    # Fear & Greed
    fg = (
        db.table("sentiment_data")
        .select("value")
        .eq("metric", "FEAR_GREED")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if fg.data:
        snapshot["fear_greed"] = int(float(fg.data[0]["value"]))

    return snapshot


def create(content: str, title: str, category: str = "general",
           confidence: int = 5, tags: str | None = None,
           source: str = "claude") -> dict:
    """Create a new conclusion with automatic data_snapshot."""
    db = get_supabase()

    snapshot = _get_data_snapshot(db)
    tags_list = [t.strip() for t in tags.split(",")] if tags else []

    record = {
        "date": str(date.today()),
        "title": title,
        "content": content,
        "category": category,
        "confidence": min(10, max(1, confidence)),
        "source": source,
        "tags": tags_list,
        "status": "active",
        "data_snapshot": snapshot,
    }

    result = db.table("conclusions").insert(record).execute()

    if result.data:
        conclusion = result.data[0]
        console.print(f"[green]Conclusion #{conclusion['id']} created: {title}[/green]")
        console.print(f"  Category: {category} | Confidence: {confidence}/10")
        console.print(f"  Snapshot: BTC ${snapshot.get('btc_price', 'N/A'):,.2f}, "
                      f"Score {snapshot.get('cycle_score', 'N/A')}")
        return conclusion

    console.print("[red]Error creating conclusion[/red]")
    return {}


def list_conclusions(category: str | None = None, status: str = "active",
                     tags: str | None = None, limit: int = 20) -> list:
    """List conclusions with filters."""
    db = get_supabase()

    query = db.table("conclusions").select("*").eq("status", status).order("created_at", desc=True)

    if category:
        query = query.eq("category", category)

    result = query.limit(limit).execute()

    if not result.data:
        console.print("[dim]No conclusions[/dim]")
        return []

    table = Table(title="Conclusions", border_style="bright_blue")
    table.add_column("ID", style="dim")
    table.add_column("Date", style="dim")
    table.add_column("Cat")
    table.add_column("Title")
    table.add_column("Conf", justify="center")
    table.add_column("Tags")
    table.add_column("Outcome")

    for c in result.data:
        tags_str = ", ".join(c.get("tags", []) or [])
        outcome = c.get("validated_outcome") or "—"
        table.add_row(
            str(c["id"]),
            str(c.get("date", ""))[:10],
            c.get("category", ""),
            c.get("title", "")[:40],
            str(c.get("confidence", "?")),
            tags_str[:20],
            outcome or "—",
        )

    console.print(table)
    return result.data


def refine(conclusion_id: int, new_content: str) -> dict:
    """Create a refined version of an existing conclusion."""
    db = get_supabase()

    original = db.table("conclusions").select("*").eq("id", conclusion_id).limit(1).execute()
    if not original.data:
        console.print(f"[red]Conclusion #{conclusion_id} not found[/red]")
        return {}

    orig = original.data[0]
    snapshot = _get_data_snapshot(db)

    record = {
        "date": str(date.today()),
        "title": f"[Refinement] {orig['title']}",
        "content": new_content,
        "category": orig["category"],
        "confidence": orig.get("confidence", 5),
        "source": orig.get("source", "claude"),
        "tags": orig.get("tags", []),
        "status": "active",
        "parent_id": conclusion_id,
        "data_snapshot": snapshot,
    }

    result = db.table("conclusions").insert(record).execute()

    if result.data:
        new = result.data[0]
        # Archive the original
        db.table("conclusions").update({"status": "refined"}).eq("id", conclusion_id).execute()
        console.print(f"[green]Refinement #{new['id']} created (parent: #{conclusion_id})[/green]")
        return new

    return {}


def validate(conclusion_id: int, outcome: str, notes: str | None = None) -> dict:
    """Mark a conclusion as correct/incorrect/partial."""
    db = get_supabase()

    valid_outcomes = ["correct", "incorrect", "partial"]
    if outcome not in valid_outcomes:
        console.print(f"[red]Invalid outcome. Options: {', '.join(valid_outcomes)}[/red]")
        return {}

    update = {
        "validated_outcome": outcome,
        "validated_at": str(date.today()),
    }

    result = db.table("conclusions").update(update).eq("id", conclusion_id).execute()

    if result.data:
        console.print(f"[green]Conclusion #{conclusion_id} validated: {outcome}[/green]")
        return result.data[0]

    console.print(f"[red]Error validating conclusion #{conclusion_id}[/red]")
    return {}


def auto_conclude():
    """Generate automatic conclusions based on current data state.

    Called by `analyze full` to keep conclusions fresh daily.
    Only creates conclusions if none exist for today.
    """
    db = get_supabase()
    today = str(date.today())

    # Check if we already have conclusions for today
    existing = (
        db.table("conclusions")
        .select("id")
        .eq("date", today)
        .eq("source", "system")
        .limit(1)
        .execute()
    )
    if existing.data:
        console.print("  [dim]Today's conclusions already exist, skipping[/dim]")
        return

    snapshot = _get_data_snapshot(db)
    btc_price = snapshot.get("btc_price", 0)
    rsi = snapshot.get("rsi", 50)
    fg = snapshot.get("fear_greed", 50)
    cycle_score = snapshot.get("cycle_score", 50)
    phase = snapshot.get("phase", "unknown")

    conclusions = []

    # Technical conclusion
    if rsi < 30:
        conclusions.append({
            "category": "technical",
            "title": f"RSI en sobreventa extrema ({rsi:.0f})",
            "content": f"RSI_14 en {rsi:.1f}, zona de sobreventa. Históricamente, niveles por debajo de 30 han precedido rebotes a corto plazo. BTC a ${btc_price:,.0f}.",
            "confidence": 7,
        })
    elif rsi > 70:
        conclusions.append({
            "category": "technical",
            "title": f"RSI en sobrecompra ({rsi:.0f})",
            "content": f"RSI_14 en {rsi:.1f}, zona de sobrecompra. Posible corrección a corto plazo. BTC a ${btc_price:,.0f}.",
            "confidence": 6,
        })

    # Sentiment conclusion
    if fg <= 15:
        conclusions.append({
            "category": "sentiment",
            "title": f"Miedo extremo — Fear & Greed en {fg}",
            "content": f"Fear & Greed Index en {fg}/100, nivel de miedo extremo. Históricamente señal contrarian de compra a medio plazo.",
            "confidence": 7,
        })
    elif fg >= 80:
        conclusions.append({
            "category": "sentiment",
            "title": f"Avaricia extrema — Fear & Greed en {fg}",
            "content": f"Fear & Greed Index en {fg}/100, nivel de avaricia extrema. Precaución: posible techo a corto plazo.",
            "confidence": 6,
        })

    # Cycle conclusion
    conclusions.append({
        "category": "cycle",
        "title": f"Cycle Score {cycle_score}/100 — Fase: {phase}",
        "content": f"Cycle Score en {cycle_score}/100 (fase {phase}). BTC a ${btc_price:,.0f}. " +
                   ("Zona de acumulación histórica." if cycle_score < 30 else
                    "Tendencia alcista temprana." if cycle_score < 50 else
                    "Zona neutral del ciclo." if cycle_score < 70 else
                    "Zona de distribución, precaución."),
        "confidence": 6,
    })

    # Price level conclusion
    prices = db.table("btc_prices").select("close").order("date", desc=True).limit(8).execute()
    if prices.data and len(prices.data) >= 7:
        week_ago_price = float(prices.data[6]["close"])
        pct_week = ((btc_price - week_ago_price) / week_ago_price) * 100
        if abs(pct_week) > 5:
            direction = "subido" if pct_week > 0 else "bajado"
            conclusions.append({
                "category": "general",
                "title": f"BTC ha {direction} {abs(pct_week):.1f}% en 7 días",
                "content": f"Precio de ${week_ago_price:,.0f} a ${btc_price:,.0f} ({pct_week:+.1f}%). Movimiento significativo que requiere atención.",
                "confidence": 8,
            })

    created = 0
    for c in conclusions:
        record = {
            "date": today,
            "title": c["title"],
            "content": c["content"],
            "category": c["category"],
            "confidence": c["confidence"],
            "source": "system",
            "tags": ["auto"],
            "status": "active",
            "data_snapshot": snapshot,
        }
        try:
            db.table("conclusions").insert(record).execute()
            created += 1
        except Exception as e:
            console.print(f"  [yellow]Error creating conclusion: {e}[/yellow]")

    console.print(f"  [green]{created} auto-conclusions created for {today}[/green]")


def archive(conclusion_id: int):
    """Archive a conclusion."""
    db = get_supabase()
    db.table("conclusions").update({"status": "archived"}).eq("id", conclusion_id).execute()
    console.print(f"[green]Conclusion #{conclusion_id} archived[/green]")


def score() -> dict:
    """Calculate prediction accuracy."""
    db = get_supabase()

    validated = (
        db.table("conclusions")
        .select("validated_outcome,confidence,category")
        .neq("validated_outcome", None)
        .execute()
    )

    if not validated.data:
        console.print("[dim]No validated conclusions[/dim]")
        return {"total": 0}

    total = len(validated.data)
    correct = sum(1 for c in validated.data if c["validated_outcome"] == "correct")
    partial = sum(1 for c in validated.data if c["validated_outcome"] == "partial")
    incorrect = sum(1 for c in validated.data if c["validated_outcome"] == "incorrect")

    accuracy = (correct + partial * 0.5) / total * 100 if total > 0 else 0

    # By category
    by_category = {}
    for c in validated.data:
        cat = c.get("category", "general")
        if cat not in by_category:
            by_category[cat] = {"total": 0, "correct": 0, "partial": 0, "incorrect": 0}
        by_category[cat]["total"] += 1
        if c["validated_outcome"] in by_category[cat]:
            by_category[cat][c["validated_outcome"]] += 1

    result = {
        "total": total,
        "correct": correct,
        "partial": partial,
        "incorrect": incorrect,
        "accuracy": round(accuracy, 1),
        "by_category": by_category,
    }

    console.print(f"\n[bold]Precision Score[/bold]")
    console.print(f"  Total validated: {total}")
    console.print(f"  Correct: {correct} | Partial: {partial} | Incorrect: {incorrect}")
    console.print(f"  [bold]Accuracy: {accuracy:.1f}%[/bold]")

    for cat, stats in by_category.items():
        cat_acc = (stats["correct"] + stats["partial"] * 0.5) / stats["total"] * 100
        console.print(f"  {cat}: {cat_acc:.0f}% ({stats['total']} validated)")

    return result
