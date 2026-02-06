"""Templates — Plantillas de texto para contextos."""

SUMMARY_TEMPLATE = """# BTC Intelligence Hub — Resumen
Fecha: {date}

## Precio BTC
- Actual: **${price:,.2f}**
- Cambio 24h: {change_24h} | 7d: {change_7d} | 30d: {change_30d}

## Cycle Score
- Score: **{cycle_score}/100** — Fase: **{phase}**

## Señales
{signals}

## Confluencias
{confluences}

## Alertas
{alerts}

## Conclusiones Recientes
{conclusions}
"""

MORNING_TEMPLATE = """# BTC Intelligence Hub — Morning Briefing
Fecha: {date}

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
Fecha: {date}

{price_section}
{area_section}
{cycle_score_section}
{risk_section}
{conclusions_section}
"""

COMPARE_TEMPLATE = """# BTC Intelligence Hub — Comparativa
Período 1: {period1} | Período 2: {period2}

{compare_section}
"""
