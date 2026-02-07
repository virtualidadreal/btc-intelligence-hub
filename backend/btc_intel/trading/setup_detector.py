"""Setup Detector — Identifies Pullback, Breakout, and Reversal setups.

Analyses the current price relative to detected levels, Fibonacci zones,
and indicator state to classify the type of trading opportunity.
"""

from __future__ import annotations

import logging

from btc_intel.trading import CandlePattern, PriceLevel, Setup, Zone

logger = logging.getLogger(__name__)


class SetupDetector:
    """Identify the TYPE of trading opportunity beyond simple direction."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(
        self,
        price: float,
        direction: str,
        trend: str,
        timeframe: str,
        levels: list[PriceLevel],
        zones: list[Zone],
        fibs: dict | None,
        candle_patterns: list[CandlePattern],
        indicators: dict,
    ) -> Setup | None:
        """Return the highest-priority detected setup, or None.

        Priority order:
          1. Pullback (continuation) — highest reliability
          2. Breakout (momentum)     — medium reliability
          3. Reversal (exhaustion)   — lowest reliability

        Args:
            price:           Current BTC price.
            direction:       Signal direction ("LONG" or "SHORT").
            trend:           Trend state from indicators
                             ("strong_bullish", "bullish", "neutral",
                              "bearish", "strong_bearish").
            timeframe:       e.g. "1H", "4H", "1D", "1W".
            levels:          Scored PriceLevels from the Level Engine.
            zones:           Clustered Zone objects.
            fibs:            Fibonacci analysis dict for this TF (may be None).
            candle_patterns: Detected CandlePattern objects for this TF.
            indicators:      Dict of indicator values (rsi, atr, volume,
                             sma20_volume, ema_21, ema_50, sma_200, etc.).

        Returns:
            The best Setup detected, or None if no valid setup.
        """
        # Try in priority order, return first match.
        pullback = self._detect_pullback(
            price, direction, trend, levels, zones, fibs, candle_patterns
        )
        if pullback:
            return pullback

        breakout = self._detect_breakout(
            price, direction, levels, zones, indicators
        )
        if breakout:
            return breakout

        reversal = self._detect_reversal(
            price, direction, levels, zones, fibs, candle_patterns, indicators
        )
        if reversal:
            return reversal

        return None

    # ------------------------------------------------------------------
    # Setup 1: Trend Pullback
    # ------------------------------------------------------------------

    def _detect_pullback(
        self,
        price: float,
        direction: str,
        trend: str,
        levels: list[PriceLevel],
        zones: list[Zone],
        fibs: dict | None,
        candle_patterns: list[CandlePattern],
    ) -> Setup | None:
        """Pullback: price retraces to a value zone inside an established trend.

        Requirements:
          - Trend must align with direction (bullish for LONG, bearish for SHORT)
          - Price must be near a significant level or Fibonacci zone
        """
        trend_ok = (
            (direction == "LONG" and trend in ("bullish", "strong_bullish"))
            or (direction == "SHORT" and trend in ("bearish", "strong_bearish"))
        )
        if not trend_ok:
            return None

        pullback_zone = self._find_pullback_zone(price, direction, levels, zones, fibs)
        if not pullback_zone:
            return None

        # Bonus: confirming candle pattern
        confirming = self._has_confirming_pattern(candle_patterns, direction)
        desc_parts = [f"Pullback to {pullback_zone['name']}"]
        if confirming:
            desc_parts.append(f"+ {confirming.pattern}")

        reliability = "high" if pullback_zone.get("zone_type", "").startswith(("golden", "fib_multi")) else "medium"

        return Setup(
            type="pullback",
            direction=direction,
            entry_zone=pullback_zone,
            description=" ".join(desc_parts),
            reliability=reliability,
        )

    def _find_pullback_zone(
        self,
        price: float,
        direction: str,
        levels: list[PriceLevel],
        zones: list[Zone],
        fibs: dict | None,
    ) -> dict | None:
        """Check if price is at a value zone for pullback entry.

        Priority order:
          1. Golden Pocket (Fib 0.618-0.65) + Strong Level
          2. Multi-TF Fib confluence
          3. Strong level (strength >= 10)
          4. Fib retracement level alone
        """
        proximity_pct = 1.0  # within 1% of a zone

        # Check 1: Golden Pocket + Strong Level
        if fibs:
            golden = self._price_near_fib_level(price, fibs, [0.618, 0.650], proximity_pct)
            if golden:
                strong_levels = [
                    lv for lv in levels
                    if lv.strength >= 10 and self._near(price, lv.price, proximity_pct)
                ]
                if strong_levels:
                    return {
                        "zone_type": "golden_pocket_plus_level",
                        "name": f"Golden Pocket + {strong_levels[0].type.title()} ({strong_levels[0].strength}/20)",
                        "fib_ratio": golden["ratio"],
                        "level_price": strong_levels[0].price,
                        "fib_price": golden["price"],
                    }

        # Check 2: Strong level alone (Gran Nivel)
        gran_niveles = [
            lv for lv in levels
            if lv.strength >= 10 and self._near(price, lv.price, proximity_pct)
        ]
        if gran_niveles:
            best = max(gran_niveles, key=lambda lv: lv.strength)
            return {
                "zone_type": "gran_nivel",
                "name": f"Strong {best.type.title()} ({best.strength}/20)",
                "level_price": best.price,
            }

        # Check 3: Any Fibonacci retracement level
        if fibs:
            any_fib = self._price_near_any_fib(price, fibs, proximity_pct)
            if any_fib:
                return {
                    "zone_type": "fib_only",
                    "name": f"Fib {any_fib['ratio']} ({any_fib['label']})",
                    "fib_ratio": any_fib["ratio"],
                    "fib_price": any_fib["price"],
                }

        return None

    # ------------------------------------------------------------------
    # Setup 2: Breakout
    # ------------------------------------------------------------------

    def _detect_breakout(
        self,
        price: float,
        direction: str,
        levels: list[PriceLevel],
        zones: list[Zone],
        indicators: dict,
    ) -> Setup | None:
        """Breakout: price breaks through a significant level with volume.

        Requirements:
          - Price just crossed above resistance (LONG) or below support (SHORT)
          - Volume above average (> 1.2x SMA20 volume)
        """
        volume = indicators.get("volume", 0)
        sma20_vol = indicators.get("sma20_volume", 0)

        volume_ok = sma20_vol > 0 and volume > sma20_vol * 1.2

        if not volume_ok:
            return None

        breakout_pct = 0.5  # price must be within 0.5% above/below level

        if direction == "LONG":
            # Look for resistance levels that price just broke above
            broken = [
                lv for lv in levels
                if lv.type == "resistance"
                and lv.strength >= 6
                and lv.price < price
                and self._near(price, lv.price, breakout_pct)
            ]
        else:
            broken = [
                lv for lv in levels
                if lv.type == "support"
                and lv.strength >= 6
                and lv.price > price
                and self._near(price, lv.price, breakout_pct)
            ]

        if not broken:
            return None

        best = max(broken, key=lambda lv: lv.strength)
        vol_mult = round(volume / sma20_vol, 1) if sma20_vol > 0 else 0

        return Setup(
            type="breakout",
            direction=direction,
            entry_zone={
                "zone_type": "breakout",
                "name": f"Breakout {best.type.title()} ({best.strength}/20)",
                "level_price": best.price,
                "volume_multiplier": vol_mult,
            },
            description=f"Breakout of {best.type} at ${best.price:,.0f} with {vol_mult}x volume",
            reliability="medium",
        )

    # ------------------------------------------------------------------
    # Setup 3: Reversal
    # ------------------------------------------------------------------

    def _detect_reversal(
        self,
        price: float,
        direction: str,
        levels: list[PriceLevel],
        zones: list[Zone],
        fibs: dict | None,
        candle_patterns: list[CandlePattern],
        indicators: dict,
    ) -> Setup | None:
        """Reversal: exhaustion signals at extremes (counter-trend).

        Requirements:
          - Price at a strong level or Fibonacci extreme
          - Confirming candle pattern (engulfing, pin bar, morning/evening star)
          - RSI in overbought/oversold territory
        """
        confirming = self._has_confirming_pattern(candle_patterns, direction)
        if not confirming:
            return None

        rsi = indicators.get("rsi", 50)
        rsi_extreme = (direction == "LONG" and rsi < 30) or (direction == "SHORT" and rsi > 70)
        if not rsi_extreme:
            return None

        # Must be at a significant level
        at_level = any(
            lv.strength >= 8 and self._near(price, lv.price, 1.0)
            for lv in levels
        )
        at_fib = False
        if fibs:
            at_fib = self._price_near_any_fib(price, fibs, 1.0) is not None

        if not at_level and not at_fib:
            return None

        level_desc = ""
        if at_level:
            nearby = [lv for lv in levels if lv.strength >= 8 and self._near(price, lv.price, 1.0)]
            if nearby:
                best = max(nearby, key=lambda lv: lv.strength)
                level_desc = f"{best.type.title()} ({best.strength}/20)"

        return Setup(
            type="reversal",
            direction=direction,
            entry_zone={
                "zone_type": "reversal",
                "name": f"Reversal at {level_desc}" if level_desc else "Reversal at Fib extreme",
                "rsi": rsi,
                "pattern": confirming.pattern,
            },
            description=f"Reversal: {confirming.pattern} at {level_desc or 'Fib extreme'} (RSI {rsi:.0f})",
            reliability="low",
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _near(price: float, level_price: float, tolerance_pct: float) -> bool:
        """Check if price is within tolerance_pct of a level."""
        if level_price == 0:
            return False
        return abs(price - level_price) / level_price * 100 <= tolerance_pct

    @staticmethod
    def _has_confirming_pattern(
        patterns: list[CandlePattern], direction: str
    ) -> CandlePattern | None:
        """Return the strongest pattern that matches the direction, or None."""
        matching = [p for p in patterns if p.direction == direction and p.strength >= 6]
        if not matching:
            return None
        return max(matching, key=lambda p: p.strength)

    @staticmethod
    def _price_near_fib_level(
        price: float,
        fibs: dict,
        ratios: list[float],
        tolerance_pct: float,
    ) -> dict | None:
        """Check if price is near one of the specified Fib ratios."""
        for r in fibs.get("retracements", []):
            if r["ratio"] in ratios:
                pct_diff = abs(price - r["price"]) / r["price"] * 100 if r["price"] > 0 else 999
                if pct_diff <= tolerance_pct:
                    return r
        return None

    @staticmethod
    def _price_near_any_fib(
        price: float, fibs: dict, tolerance_pct: float
    ) -> dict | None:
        """Check if price is near ANY Fibonacci retracement level."""
        for r in fibs.get("retracements", []):
            if r["price"] > 0:
                pct_diff = abs(price - r["price"]) / r["price"] * 100
                if pct_diff <= tolerance_pct:
                    return r
        return None
