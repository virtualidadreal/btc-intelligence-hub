"""Level Scorer — Assigns a 0-20 strength score to each PriceLevel."""

from btc_intel.trading import PriceLevel


def score_level(level: PriceLevel) -> int:
    """Score a single PriceLevel from 0 to 20.

    Scoring breakdown:
        - touch_count * 2, capped at 8
        - visible_in_timeframes >= 3: +4, >= 2: +2
        - coincides_with_fib: +3
        - is_role_flip: +3
        - is_high_volume_zone: +2
        - is_psychological: +1
        - last_touch_days < 30: +1

    Final score is capped at 20.

    Args:
        level: A PriceLevel to score.

    Returns:
        Integer score between 0 and 20.
    """
    score = 0

    # Touch count: each touch is +2, max 8
    score += min(level.touch_count * 2, 8)

    # Multi-timeframe visibility
    if level.visible_in_timeframes >= 3:
        score += 4
    elif level.visible_in_timeframes >= 2:
        score += 2

    # Fibonacci confluence
    if level.coincides_with_fib:
        score += 3

    # Support/resistance role flip
    if level.is_role_flip:
        score += 3

    # High volume zone
    if level.is_high_volume_zone:
        score += 2

    # Psychological round number
    if level.is_psychological:
        score += 1

    # Recency bonus
    if level.last_touch_days < 30:
        score += 1

    return min(score, 20)


def classify_level(score: int) -> str:
    """Classify a level based on its numeric score.

    Args:
        score: Integer score 0-20.

    Returns:
        Classification string: "critical", "strong", "moderate", or "weak".
    """
    if score >= 15:
        return "critical"
    elif score >= 10:
        return "strong"
    elif score >= 5:
        return "moderate"
    else:
        return "weak"
