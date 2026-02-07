"""Context Builder — Generates structured context for Claude Code."""

from datetime import date, timedelta

from btc_intel.db import get_supabase
from btc_intel.context.formatters import (
    format_price_section,
    format_cycle_score_section,
    format_technical_section,
    format_onchain_section,
    format_macro_section,
    format_sentiment_section,
    format_confluences_section,
    format_alerts_section,
    format_conclusions_section,
    format_risk_section,
    format_cycles_section,
    format_events_section,
    format_signal_changes,
    format_compare_section,
)

def build_context(scope: str = "summary", area: str | None = None,
                  period1: str | None = None, period2: str | None = None) -> str:
    """Main entry point. Builds context based on scope."""
    if scope == "summary":
        return _build_summary()
    elif scope == "morning":
        return _build_morning()
    elif scope == "deep":
        return _build_deep(area or "technical")
    elif scope == "compare":
        return _build_compare(period1, period2)
    else:
        return f"Unknown scope: {scope}"


def _build_summary() -> str:
    """Summary: ~500-800 tokens. Quick view of current state."""
    db = get_supabase()
    sections = []

    sections.append("# BTC Intelligence Hub — Summary\n")
    sections.append(f"Date: {date.today()}\n")

    # Price
    sections.append(format_price_section(db))

    # Cycle Score
    sections.append(format_cycle_score_section(db))

    # Area signals (1 line each)
    sections.append("## Signals by Area\n")
    sections.append(format_technical_section(db, brief=True))
    sections.append(format_onchain_section(db, brief=True))
    sections.append(format_macro_section(db, brief=True))
    sections.append(format_sentiment_section(db, brief=True))

    # Confluences
    sections.append(format_confluences_section(db))

    # Active alerts
    sections.append(format_alerts_section(db))

    # Recent conclusions
    sections.append(format_conclusions_section(db, limit=3))

    return "\n".join(s for s in sections if s)


def _build_morning() -> str:
    """Morning: ~1500 tokens. Everything from summary + changes and events."""
    db = get_supabase()
    sections = []

    sections.append("# BTC Intelligence Hub — Morning Briefing\n")
    sections.append(f"Date: {date.today()}\n")

    # Price
    sections.append(format_price_section(db))

    # Cycle Score
    sections.append(format_cycle_score_section(db))

    # Signals by area
    sections.append("## Signals by Area\n")
    sections.append(format_technical_section(db, brief=True))
    sections.append(format_onchain_section(db, brief=True))
    sections.append(format_macro_section(db, brief=True))
    sections.append(format_sentiment_section(db, brief=True))

    # Changes since yesterday
    sections.append(format_signal_changes(db))

    # Upcoming events
    sections.append(format_events_section(db))

    # Confluences
    sections.append(format_confluences_section(db))

    # Detailed alerts
    sections.append(format_alerts_section(db, detailed=True))

    # Recent conclusions
    sections.append(format_conclusions_section(db, limit=5))

    # Risk
    sections.append(format_risk_section(db))

    return "\n".join(s for s in sections if s)


def _build_deep(area: str) -> str:
    """Deep: ~2000-3000 tokens. Full detail of an area."""
    db = get_supabase()
    sections = []

    sections.append(f"# BTC Intelligence Hub — Deep: {area.upper()}\n")
    sections.append(f"Date: {date.today()}\n")

    # Price as reference
    sections.append(format_price_section(db))

    area_map = {
        "technical": lambda: format_technical_section(db, brief=False),
        "onchain": lambda: format_onchain_section(db, brief=False),
        "macro": lambda: format_macro_section(db, brief=False),
        "sentiment": lambda: format_sentiment_section(db, brief=False),
        "cycle": lambda: format_cycles_section(db),
    }

    if area in area_map:
        sections.append(area_map[area]())
    else:
        sections.append(f"Unknown area: {area}")

    # Cycle Score
    sections.append(format_cycle_score_section(db))

    # Risk
    sections.append(format_risk_section(db))

    # Area conclusions
    sections.append(format_conclusions_section(db, limit=5, category=area))

    return "\n".join(s for s in sections if s)


def _build_compare(period1: str | None, period2: str | None) -> str:
    """Compare: ~3000 tokens. Two periods side by side."""
    db = get_supabase()
    sections = []

    p1 = period1 or str(date.today() - timedelta(days=30))
    p2 = period2 or str(date.today())

    sections.append(f"# BTC Intelligence Hub — Comparison\n")
    sections.append(f"Period 1: {p1} | Period 2: {p2}\n")

    sections.append(format_compare_section(db, p1, p2))

    return "\n".join(s for s in sections if s)
