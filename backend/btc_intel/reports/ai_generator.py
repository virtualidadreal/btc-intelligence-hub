"""AI Report Generator — Uses Claude Sonnet to generate daily intelligence reports."""

from datetime import date

import httpx
from rich.console import Console

from btc_intel.config import settings
from btc_intel.context.builder import build_context
from btc_intel.db import get_supabase

console = Console()

SYSTEM_PROMPT = """You are a Bitcoin market analyst generating a daily intelligence report.
Write in a clear, professional tone. Include:
1. Market Overview (price, trend, key levels)
2. Technical Analysis Summary (RSI, MACD, EMA, SMA signals)
3. On-Chain Health (hash rate, NVT, funding rate if available)
4. Sentiment & Macro (Fear & Greed, correlations)
5. Trading Outlook (direction, key levels to watch)
6. Risk Factors

Keep it concise (~500 words). Use bullet points. End with a 1-line summary."""


def generate_ai_report():
    """Generate daily AI report using Claude Sonnet via Anthropic API."""
    if not settings.anthropic_api_key:
        console.print("[yellow]ANTHROPIC_API_KEY not set. Skipping AI report.[/yellow]")
        return

    db = get_supabase()
    console.print("[bold cyan]Generating AI Report...[/bold cyan]")

    # Build context from existing data
    context = build_context(scope="morning")

    # Call Claude Sonnet
    try:
        with httpx.Client(timeout=60) as client:
            resp = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-5-20250929",
                    "max_tokens": 2048,
                    "system": SYSTEM_PROMPT,
                    "messages": [
                        {
                            "role": "user",
                            "content": f"Generate today's BTC Intelligence Report based on this data:\n\n{context}",
                        }
                    ],
                },
            )
            resp.raise_for_status()
            result = resp.json()
            report_content = result["content"][0]["text"]
    except Exception as e:
        console.print(f"[red]Error calling Claude API: {e}[/red]")
        return

    # Get cycle score for the record
    cs = db.table("cycle_score_history").select("score").order("date", desc=True).limit(1).execute()
    current_cycle_score = cs.data[0]["score"] if cs.data else None

    # Save to Supabase
    today = date.today()
    record = {
        "report_type": "daily",
        "title": f"AI Daily Report — {today}",
        "content": report_content,
        "period_start": str(today),
        "period_end": str(today),
        "cycle_score": current_cycle_score,
        "generated_by": "claude-sonnet",
    }

    try:
        db.table("reports").insert(record).execute()
        console.print(f"[green]AI Report saved: '{record['title']}'[/green]")
    except Exception as e:
        console.print(f"[red]Error saving AI report: {e}[/red]")

    # Print usage estimate
    input_tokens = result.get("usage", {}).get("input_tokens", 0)
    output_tokens = result.get("usage", {}).get("output_tokens", 0)
    cost = (input_tokens * 3 / 1_000_000) + (output_tokens * 15 / 1_000_000)
    console.print(f"[dim]Tokens: {input_tokens} in / {output_tokens} out ≈ ${cost:.4f}[/dim]")
    console.print(f"\n{report_content}")
