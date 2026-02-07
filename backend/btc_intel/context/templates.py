"""Templates — Text templates for contexts."""

SUMMARY_TEMPLATE = """# BTC Intelligence Hub — Summary
Date: {date}

## BTC Price
- Current: **${price:,.2f}**
- Change 24h: {change_24h} | 7d: {change_7d} | 30d: {change_30d}

## Cycle Score
- Score: **{cycle_score}/100** — Phase: **{phase}**

## Signals
{signals}

## Confluences
{confluences}

## Alerts
{alerts}

## Recent Conclusions
{conclusions}
"""

MORNING_TEMPLATE = """# BTC Intelligence Hub — Morning Briefing
Date: {date}

{price_section}
{cycle_score_section}
{signals_section}
{changes_section}
{events_section}
{confluences_section}
{alerts_section}
{risk_section}
{conclusions_section}
"""

DEEP_TEMPLATE = """# BTC Intelligence Hub — Deep Analysis: {area}
Date: {date}

{price_section}
{area_section}
{cycle_score_section}
{risk_section}
{conclusions_section}
"""

COMPARE_TEMPLATE = """# BTC Intelligence Hub — Comparison
Period 1: {period1} | Period 2: {period2}

{compare_section}
"""
