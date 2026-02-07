"""Candle Pattern Detector — Identifies candlestick patterns from OHLCV data.

Detects 12 classic candlestick patterns (bullish, bearish, and neutral) from
the most recent candles in a price DataFrame and returns structured
``CandlePattern`` objects.
"""

from __future__ import annotations

import pandas as pd

from btc_intel.trading import CandlePattern

# ── Pattern catalogue ───────────────────────────────────────────────────────
# pattern_id -> (direction, strength 1-10, candles_required)

PATTERNS: dict[str, tuple[str, int, int]] = {
    # Bullish
    "bullish_engulfing": ("LONG", 8, 2),
    "hammer": ("LONG", 7, 1),
    "inverted_hammer": ("LONG", 6, 1),
    "morning_star": ("LONG", 9, 3),
    "three_white_soldiers": ("LONG", 8, 3),
    "bullish_pin_bar": ("LONG", 8, 1),
    # Bearish
    "bearish_engulfing": ("SHORT", 8, 2),
    "shooting_star": ("SHORT", 7, 1),
    "evening_star": ("SHORT", 9, 3),
    "three_black_crows": ("SHORT", 8, 3),
    "bearish_pin_bar": ("SHORT", 8, 1),
    # Neutral
    "doji": ("NEUTRAL", 3, 1),
}


class CandlePatternDetector:
    """Detect candlestick patterns from OHLCV data."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect_all(
        self,
        prices_df: pd.DataFrame,
        timeframe: str,
    ) -> list[CandlePattern]:
        """Run every detector against the last 5 candles.

        Args:
            prices_df: DataFrame with columns [date, open, high, low, close].
                       Must be sorted by date ascending.
            timeframe: Timeframe label (informational, not used in logic).

        Returns:
            List of detected ``CandlePattern`` objects (may be empty).
        """
        if len(prices_df) < 5:
            return []

        df = prices_df.tail(5).reset_index(drop=True)
        found: list[CandlePattern] = []

        # Most recent candle
        curr = df.iloc[-1]
        prev = df.iloc[-2]
        last3 = [df.iloc[-3], df.iloc[-2], df.iloc[-1]]

        # --- Single-candle patterns (on current candle) ---
        if self.detect_hammer(curr):
            found.append(self._make("hammer"))

        if self.detect_shooting_star(curr):
            found.append(self._make("shooting_star"))

        if self.detect_doji(curr):
            found.append(self._make("doji"))

        if self.detect_pin_bar(curr, "LONG"):
            found.append(self._make("bullish_pin_bar"))

        if self.detect_pin_bar(curr, "SHORT"):
            found.append(self._make("bearish_pin_bar"))

        # Inverted hammer: same shape as shooting star but after a downtrend.
        if self._is_downtrend(df) and self.detect_shooting_star(curr):
            found.append(self._make("inverted_hammer"))

        # --- Two-candle patterns ---
        if self.detect_engulfing(prev, curr, "LONG"):
            found.append(self._make("bullish_engulfing"))

        if self.detect_engulfing(prev, curr, "SHORT"):
            found.append(self._make("bearish_engulfing"))

        # --- Three-candle patterns ---
        if self.detect_morning_star(last3):
            found.append(self._make("morning_star"))

        if self.detect_evening_star(last3):
            found.append(self._make("evening_star"))

        if self.detect_three_soldiers(last3):
            found.append(self._make("three_white_soldiers"))

        if self.detect_three_crows(last3):
            found.append(self._make("three_black_crows"))

        return found

    # ------------------------------------------------------------------
    # Detection methods
    # ------------------------------------------------------------------

    @staticmethod
    def detect_pin_bar(candle: pd.Series, direction: str) -> bool:
        """Detect a pin bar.

        A bullish pin bar (direction="LONG") has a long lower wick >= 2x the
        body and a short upper wick <= 0.5x the body.

        A bearish pin bar (direction="SHORT") has a long upper wick >= 2x the
        body and a short lower wick <= 0.5x the body.
        """
        body = abs(candle["close"] - candle["open"])
        if body == 0:
            body = 0.01  # avoid division by zero

        upper_wick = candle["high"] - max(candle["open"], candle["close"])
        lower_wick = min(candle["open"], candle["close"]) - candle["low"]

        if direction == "LONG":
            return lower_wick >= 2 * body and upper_wick <= 0.5 * body
        else:  # SHORT
            return upper_wick >= 2 * body and lower_wick <= 0.5 * body

    @staticmethod
    def detect_engulfing(
        prev: pd.Series,
        curr: pd.Series,
        direction: str,
    ) -> bool:
        """Detect an engulfing pattern.

        Bullish engulfing (direction="LONG"): previous candle is red, current
        is green, and the current body fully engulfs the previous body.

        Bearish engulfing (direction="SHORT"): opposite.
        """
        prev_open, prev_close = prev["open"], prev["close"]
        curr_open, curr_close = curr["open"], curr["close"]

        prev_body_top = max(prev_open, prev_close)
        prev_body_bot = min(prev_open, prev_close)
        curr_body_top = max(curr_open, curr_close)
        curr_body_bot = min(curr_open, curr_close)

        if direction == "LONG":
            prev_is_red = prev_close < prev_open
            curr_is_green = curr_close > curr_open
            engulfs = curr_body_top > prev_body_top and curr_body_bot < prev_body_bot
            return prev_is_red and curr_is_green and engulfs
        else:  # SHORT
            prev_is_green = prev_close > prev_open
            curr_is_red = curr_close < curr_open
            engulfs = curr_body_top > prev_body_top and curr_body_bot < prev_body_bot
            return prev_is_green and curr_is_red and engulfs

    @staticmethod
    def detect_hammer(candle: pd.Series) -> bool:
        """Detect a hammer: small body at top, long lower wick >= 2x body,
        upper wick <= 0.3x body."""
        body = abs(candle["close"] - candle["open"])
        if body == 0:
            body = 0.01

        upper_wick = candle["high"] - max(candle["open"], candle["close"])
        lower_wick = min(candle["open"], candle["close"]) - candle["low"]

        return lower_wick >= 2 * body and upper_wick <= 0.3 * body

    @staticmethod
    def detect_shooting_star(candle: pd.Series) -> bool:
        """Detect a shooting star: small body at bottom, long upper wick >= 2x
        body, lower wick <= 0.3x body."""
        body = abs(candle["close"] - candle["open"])
        if body == 0:
            body = 0.01

        upper_wick = candle["high"] - max(candle["open"], candle["close"])
        lower_wick = min(candle["open"], candle["close"]) - candle["low"]

        return upper_wick >= 2 * body and lower_wick <= 0.3 * body

    @staticmethod
    def detect_doji(candle: pd.Series) -> bool:
        """Detect a doji: body < 10 % of the total candle range."""
        total_range = candle["high"] - candle["low"]
        if total_range == 0:
            return False

        body = abs(candle["close"] - candle["open"])
        return body < 0.10 * total_range

    @staticmethod
    def detect_morning_star(candles: list[pd.Series]) -> bool:
        """Detect a morning star (3 candles).

        1. Big red candle.
        2. Small-body candle (gap down — body midpoint below candle 1 close).
        3. Big green candle that closes above the midpoint of candle 1's body.
        """
        c1, c2, c3 = candles

        c1_body = abs(c1["close"] - c1["open"])
        c2_body = abs(c2["close"] - c2["open"])
        c3_body = abs(c3["close"] - c3["open"])

        if c1_body == 0:
            return False

        c1_is_red = c1["close"] < c1["open"]
        c3_is_green = c3["close"] > c3["open"]

        # Small body for middle candle (less than half of first candle body).
        small_middle = c2_body < c1_body * 0.5

        # Gap down: middle candle body midpoint is below first candle close.
        c2_mid = (c2["open"] + c2["close"]) / 2
        gap_down = c2_mid < c1["close"]

        # Third candle closes above midpoint of first candle body.
        c1_mid = (c1["open"] + c1["close"]) / 2
        strong_close = c3["close"] > c1_mid

        return c1_is_red and c3_is_green and small_middle and gap_down and strong_close

    @staticmethod
    def detect_evening_star(candles: list[pd.Series]) -> bool:
        """Detect an evening star (3 candles) — mirror of morning star.

        1. Big green candle.
        2. Small-body candle (gap up — body midpoint above candle 1 close).
        3. Big red candle that closes below the midpoint of candle 1's body.
        """
        c1, c2, c3 = candles

        c1_body = abs(c1["close"] - c1["open"])
        c2_body = abs(c2["close"] - c2["open"])
        c3_body = abs(c3["close"] - c3["open"])

        if c1_body == 0:
            return False

        c1_is_green = c1["close"] > c1["open"]
        c3_is_red = c3["close"] < c3["open"]

        small_middle = c2_body < c1_body * 0.5

        c2_mid = (c2["open"] + c2["close"]) / 2
        gap_up = c2_mid > c1["close"]

        c1_mid = (c1["open"] + c1["close"]) / 2
        strong_close = c3["close"] < c1_mid

        return c1_is_green and c3_is_red and small_middle and gap_up and strong_close

    @staticmethod
    def detect_three_soldiers(candles: list[pd.Series]) -> bool:
        """Detect three white soldiers: 3 consecutive green candles with
        progressively higher closes."""
        for c in candles:
            if c["close"] <= c["open"]:
                return False

        return candles[1]["close"] > candles[0]["close"] and candles[2]["close"] > candles[1]["close"]

    @staticmethod
    def detect_three_crows(candles: list[pd.Series]) -> bool:
        """Detect three black crows: 3 consecutive red candles with
        progressively lower closes."""
        for c in candles:
            if c["close"] >= c["open"]:
                return False

        return candles[1]["close"] < candles[0]["close"] and candles[2]["close"] < candles[1]["close"]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make(pattern_id: str) -> CandlePattern:
        """Build a ``CandlePattern`` from the catalogue entry."""
        direction, strength, candles = PATTERNS[pattern_id]
        return CandlePattern(
            pattern=pattern_id,
            direction=direction,
            strength=strength,
            candles=candles,
        )

    @staticmethod
    def _is_downtrend(df: pd.DataFrame) -> bool:
        """Simple heuristic: the close 4 bars ago is higher than current close."""
        if len(df) < 5:
            return False
        return df.iloc[0]["close"] > df.iloc[-1]["close"]
