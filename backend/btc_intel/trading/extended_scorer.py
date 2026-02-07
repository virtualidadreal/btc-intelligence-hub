"""Extended Signal Scorer — Adds bonuses and penalties on top of the base score.

The base system uses 9 weighted indicators to produce a confidence 0-100.
This module EXTENDS (never replaces) that score with structural bonuses
from the Level Engine, Fibonacci, Candle Patterns, and On-Chain data.

Final score = base + level_bonus(max 20) + candle_bonus(max 10)
            + onchain_bonus(max 10) + penalties(max -15)
Clamped to 0-100 for display.
"""

from __future__ import annotations

import logging

from btc_intel.trading import CandlePattern, PriceLevel

logger = logging.getLogger(__name__)


# ── Bonus tables ──────────────────────────────────────────────────────────────

LEVEL_BONUSES = {
    "at_gran_nivel": 8,
    "fib_golden_pocket": 7,
    "multi_tf_fib_confluence": 6,
    "level_plus_fib": 5,
    "at_ema_key": 3,
    "role_flip_level": 4,
    "psychological_level": 1,
}

CANDLE_BONUSES = {
    "strong_pattern_at_level": 8,
    "moderate_pattern_at_level": 5,
    "strong_pattern_no_level": 4,
    "volume_confirms_pattern": 2,
}

ONCHAIN_BONUSES = {
    "fear_extreme_long": 4,
    "greed_extreme_short": 4,
    "funding_contrarian": 3,
    "oi_low_organic": 3,
}

PENALTIES = {
    "no_clear_level": -5,
    "against_htf_trend": -8,
    "overextended_from_ema": -5,
    "low_volume": -3,
    "contradicting_onchain": -5,
}


class ExtendedSignalScorer:
    """Calculate extended score with bonuses and penalties."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate(
        self,
        base_confidence: float,
        price: float,
        direction: str,
        timeframe: str,
        levels: list[PriceLevel],
        fibs: dict | None,
        confluences: list[dict],
        candle_patterns: list[CandlePattern],
        onchain: dict,
        indicators: dict,
        htf_direction: str | None = None,
    ) -> dict:
        """Compute the extended score.

        Args:
            base_confidence: 0-100 from the 9-indicator system.
            price:           Current BTC price.
            direction:       Signal direction ("LONG" or "SHORT").
            timeframe:       e.g. "1H", "4H".
            levels:          Scored PriceLevels from the Level Engine.
            fibs:            Fibonacci analysis dict for this TF (may be None).
            confluences:     Multi-TF Fibonacci confluences.
            candle_patterns: Detected CandlePattern list.
            onchain:         Dict with keys like fear_greed, funding_rate, etc.
            indicators:      Dict with rsi, atr, volume, sma20_volume,
                             ema_21, ema_50, sma_200, etc.
            htf_direction:   Direction of the higher-timeframe signal (optional).

        Returns:
            Dict with bonus breakdown and final_score.
        """
        bonus_levels = self._calc_level_bonus(price, direction, levels, fibs, confluences)
        bonus_candles = self._calc_candle_bonus(candle_patterns, price, direction, levels, indicators)
        bonus_onchain = self._calc_onchain_bonus(onchain, direction, timeframe)
        penalties = self._calc_penalties(
            price, direction, timeframe, levels, indicators, onchain, htf_direction
        )

        # Clamp individual components
        bonus_levels = min(bonus_levels, 20)
        bonus_candles = min(bonus_candles, 10)
        bonus_onchain = min(bonus_onchain, 10)
        penalties = max(penalties, -15)

        raw = base_confidence + bonus_levels + bonus_candles + bonus_onchain + penalties
        final_score = max(0, min(100, round(raw)))

        return {
            "base_confidence": round(base_confidence, 1),
            "bonus_levels": bonus_levels,
            "bonus_candles": bonus_candles,
            "bonus_onchain": bonus_onchain,
            "penalties": penalties,
            "final_score": final_score,
            "classification": self._classify(final_score),
        }

    # ------------------------------------------------------------------
    # Level bonus (max +20)
    # ------------------------------------------------------------------

    def _calc_level_bonus(
        self,
        price: float,
        direction: str,
        levels: list[PriceLevel],
        fibs: dict | None,
        confluences: list[dict],
    ) -> int:
        """Sum applicable level bonuses, capped at 20."""
        bonus = 0
        proximity_pct = 1.0  # within 1% of price

        nearby = [
            lv for lv in levels
            if _near(price, lv.price, proximity_pct)
        ]

        # Gran nivel (strength >= 10)
        gran = [lv for lv in nearby if lv.strength >= 10]
        if gran:
            bonus += LEVEL_BONUSES["at_gran_nivel"]

        # Golden Pocket (Fib 0.618-0.650)
        at_golden_pocket = False
        if fibs:
            for r in fibs.get("retracements", []):
                if r["ratio"] in (0.618, 0.650) and _near(price, r["price"], proximity_pct):
                    bonus += LEVEL_BONUSES["fib_golden_pocket"]
                    at_golden_pocket = True
                    break

        # Multi-TF Fibonacci confluence
        for conf in confluences:
            if _near(price, conf["price"], proximity_pct) and conf.get("num_timeframes", 0) >= 2:
                bonus += LEVEL_BONUSES["multi_tf_fib_confluence"]
                break

        # Level + Fib combo (only if not already counted golden pocket)
        if not at_golden_pocket and gran and fibs:
            for r in fibs.get("retracements", []):
                if _near(price, r["price"], proximity_pct):
                    bonus += LEVEL_BONUSES["level_plus_fib"]
                    break

        # Role flip level
        role_flips = [lv for lv in nearby if lv.is_role_flip]
        if role_flips:
            bonus += LEVEL_BONUSES["role_flip_level"]

        # Psychological level
        psycho = [lv for lv in nearby if lv.is_psychological]
        if psycho:
            bonus += LEVEL_BONUSES["psychological_level"]

        return min(bonus, 20)

    # ------------------------------------------------------------------
    # Candle bonus (max +10)
    # ------------------------------------------------------------------

    def _calc_candle_bonus(
        self,
        patterns: list[CandlePattern],
        price: float,
        direction: str,
        levels: list[PriceLevel],
        indicators: dict,
    ) -> int:
        """Sum applicable candle bonuses, capped at 10."""
        if not patterns:
            return 0

        bonus = 0
        matching = [p for p in patterns if p.direction == direction]
        if not matching:
            return 0

        strongest = max(matching, key=lambda p: p.strength)

        # Check if pattern occurs at a significant level
        at_level = any(
            lv.strength >= 8 and _near(price, lv.price, 1.0)
            for lv in levels
        )

        if strongest.strength >= 7 and at_level:
            bonus += CANDLE_BONUSES["strong_pattern_at_level"]
        elif strongest.strength >= 5 and at_level:
            bonus += CANDLE_BONUSES["moderate_pattern_at_level"]
        elif strongest.strength >= 7:
            bonus += CANDLE_BONUSES["strong_pattern_no_level"]

        # Volume confirmation
        volume = indicators.get("volume", 0)
        sma20_vol = indicators.get("sma20_volume", 0)
        if sma20_vol > 0 and volume > sma20_vol:
            bonus += CANDLE_BONUSES["volume_confirms_pattern"]

        return min(bonus, 10)

    # ------------------------------------------------------------------
    # On-chain bonus (max +10, for 4H+ only)
    # ------------------------------------------------------------------

    def _calc_onchain_bonus(
        self,
        onchain: dict,
        direction: str,
        timeframe: str,
    ) -> int:
        """Sum applicable on-chain bonuses, capped at 10."""
        # Only apply for higher timeframes
        if timeframe not in ("4H", "1D", "1W"):
            return 0

        bonus = 0

        fear_greed = onchain.get("fear_greed")
        if fear_greed is not None:
            if fear_greed < 20 and direction == "LONG":
                bonus += ONCHAIN_BONUSES["fear_extreme_long"]
            elif fear_greed > 80 and direction == "SHORT":
                bonus += ONCHAIN_BONUSES["greed_extreme_short"]

        funding_rate = onchain.get("funding_rate")
        if funding_rate is not None:
            # Contrarian: extreme positive funding + SHORT or extreme negative + LONG
            if funding_rate > 0.05 and direction == "SHORT":
                bonus += ONCHAIN_BONUSES["funding_contrarian"]
            elif funding_rate < -0.03 and direction == "LONG":
                bonus += ONCHAIN_BONUSES["funding_contrarian"]

        oi_change_pct = onchain.get("oi_change_pct")
        if oi_change_pct is not None:
            # Low OI means less leveraged positioning = more organic moves
            if oi_change_pct < -10:
                bonus += ONCHAIN_BONUSES["oi_low_organic"]

        return min(bonus, 10)

    # ------------------------------------------------------------------
    # Penalties (max -15)
    # ------------------------------------------------------------------

    def _calc_penalties(
        self,
        price: float,
        direction: str,
        timeframe: str,
        levels: list[PriceLevel],
        indicators: dict,
        onchain: dict,
        htf_direction: str | None,
    ) -> int:
        """Calculate penalty points (negative). Minimum -15."""
        penalty = 0
        proximity_pct = 2.0  # wider check for "no level" penalty

        # No clear level nearby
        nearby_strong = [
            lv for lv in levels
            if lv.strength >= 6 and _near(price, lv.price, proximity_pct)
        ]
        if not nearby_strong:
            penalty += PENALTIES["no_clear_level"]

        # Against higher timeframe trend
        if htf_direction and htf_direction != direction:
            penalty += PENALTIES["against_htf_trend"]

        # Overextended from EMA
        ema_21 = indicators.get("ema_21")
        if ema_21 and ema_21 > 0:
            dist_pct = abs(price - ema_21) / ema_21 * 100
            if dist_pct > 5:
                penalty += PENALTIES["overextended_from_ema"]

        # Low volume
        volume = indicators.get("volume", 0)
        sma20_vol = indicators.get("sma20_volume", 0)
        if sma20_vol > 0 and volume < sma20_vol * 0.7:
            penalty += PENALTIES["low_volume"]

        # Contradicting on-chain (fear_greed directional mismatch)
        fear_greed = onchain.get("fear_greed")
        if fear_greed is not None:
            if direction == "LONG" and fear_greed > 85:
                penalty += PENALTIES["contradicting_onchain"]
            elif direction == "SHORT" and fear_greed < 15:
                penalty += PENALTIES["contradicting_onchain"]

        return max(penalty, -15)

    # ------------------------------------------------------------------
    # Classification
    # ------------------------------------------------------------------

    @staticmethod
    def _classify(score: int) -> str:
        """Classify the final extended score into a quality tier."""
        if score >= 85:
            return "PREMIUM"
        if score >= 70:
            return "STRONG"
        if score >= 55:
            return "VALID"
        if score >= 40:
            return "WEAK"
        return "REJECTED"


# ── Module-level helper ───────────────────────────────────────────────────────

def _near(price: float, level_price: float, tolerance_pct: float) -> bool:
    """Check if two prices are within tolerance_pct of each other."""
    if level_price == 0:
        return False
    return abs(price - level_price) / level_price * 100 <= tolerance_pct
