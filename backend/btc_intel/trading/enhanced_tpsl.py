"""Enhanced TP/SL — Structure-based targets using Levels + Fibonacci + Swings.

Extends the existing ATR + Bollinger TP/SL system with a structural layer
that considers strong support/resistance levels, Fibonacci retracement and
extension prices, and swing points.

Priority system for each target:
  SL:  Strong Level > Fib 0.786 > Swing Point > ATR fallback
  TP1: Fib Extension at Level > Strong Level > Swing High > ATR fallback
  TP2: Fib 1.618 at Level > Next Level beyond TP1 > Fib 1.618 > ATR fallback
"""

from __future__ import annotations

import logging

from btc_intel.trading import PriceLevel, SwingPoint

logger = logging.getLogger(__name__)

# ATR buffer multipliers per timeframe (applied around structural levels).
ATR_BUFFER = {"1H": 1.0, "4H": 1.5, "1D": 2.0, "1W": 2.5}

# Maximum allowed SL distance as % of entry price.
MAX_SL_PERCENT = {"1H": 2.0, "4H": 4.0, "1D": 7.0, "1W": 12.0}

# Minimum acceptable Risk:Reward ratio for TP1 and TP2.
MIN_RR_TP1 = {"1H": 1.2, "4H": 1.5, "1D": 1.5, "1W": 2.0}
MIN_RR_TP2 = {"1H": 2.0, "4H": 2.5, "1D": 3.0, "1W": 4.0}


class EnhancedTPSL:
    """Calculate structure-based TP/SL levels."""

    def __init__(self) -> None:
        self._last_sl_method: str = ""
        self._last_tp1_method: str = ""
        self._last_tp2_method: str = ""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate(
        self,
        entry: float,
        direction: str,
        timeframe: str,
        atr: float,
        bb: dict,
        levels: list[PriceLevel],
        fibs: dict | None,
        swing_points: list[SwingPoint],
    ) -> dict:
        """Compute SL, TP1, and TP2 using structural levels.

        Args:
            entry:        Entry price (current price).
            direction:    "LONG" or "SHORT".
            timeframe:    e.g. "1H", "4H", "1D", "1W".
            atr:          Current ATR value for this timeframe.
            bb:           Bollinger Band dict with keys upper, mid, lower.
            levels:       Scored PriceLevels from the Level Engine.
            fibs:         Fibonacci analysis dict (may be None).
            swing_points: Recent SwingPoint objects.

        Returns:
            Dict with sl, tp1, tp2, their methods, percentages, R:R ratios,
            and a 'valid' flag.
        """
        if atr <= 0:
            return {"valid": False, "reason": "ATR is zero or negative"}

        buffer = atr * ATR_BUFFER.get(timeframe, 1.5)
        max_sl_pct = MAX_SL_PERCENT.get(timeframe, 4.0)

        # === STOP LOSS ===
        sl = self._calculate_sl(entry, direction, timeframe, buffer, bb, levels, fibs, swing_points)

        # Validate SL distance
        sl_pct = abs(entry - sl) / entry * 100
        if sl_pct > max_sl_pct:
            # Try tighter fallback
            sl = self._atr_fallback_sl(entry, direction, buffer)
            sl_pct = abs(entry - sl) / entry * 100
            self._last_sl_method = "atr_fallback"
            if sl_pct > max_sl_pct:
                return {
                    "valid": False,
                    "reason": f"SL {sl_pct:.1f}% exceeds max {max_sl_pct}%",
                }

        risk = abs(entry - sl)
        if risk == 0:
            return {"valid": False, "reason": "Risk is zero (SL = entry)"}

        # === TAKE PROFIT 1 ===
        tp1 = self._calculate_tp1(entry, direction, timeframe, risk, buffer, bb, levels, fibs, swing_points)

        # Enforce minimum R:R for TP1
        rr1 = abs(tp1 - entry) / risk
        min_rr1 = MIN_RR_TP1.get(timeframe, 1.5)
        if rr1 < min_rr1:
            if direction == "LONG":
                tp1 = entry + risk * min_rr1
            else:
                tp1 = entry - risk * min_rr1
            self._last_tp1_method = "min_rr_fallback"

        # === TAKE PROFIT 2 ===
        tp2 = self._calculate_tp2(entry, direction, timeframe, risk, buffer, bb, levels, fibs, swing_points, tp1)

        # Enforce minimum R:R for TP2
        rr2 = abs(tp2 - entry) / risk
        min_rr2 = MIN_RR_TP2.get(timeframe, 2.5)
        if rr2 < min_rr2:
            if direction == "LONG":
                tp2 = entry + risk * min_rr2
            else:
                tp2 = entry - risk * min_rr2
            self._last_tp2_method = "min_rr_fallback"

        rr1_final = round(abs(tp1 - entry) / risk, 2)
        rr2_final = round(abs(tp2 - entry) / risk, 2)

        return {
            "valid": True,
            "sl": round(sl, 2),
            "tp1": round(tp1, 2),
            "tp2": round(tp2, 2),
            "sl_pct": round(abs(entry - sl) / entry * 100, 2),
            "tp1_pct": round(abs(tp1 - entry) / entry * 100, 2),
            "tp2_pct": round(abs(tp2 - entry) / entry * 100, 2),
            "rr_tp1": rr1_final,
            "rr_tp2": rr2_final,
            "sl_method": self._last_sl_method,
            "tp1_method": self._last_tp1_method,
            "tp2_method": self._last_tp2_method,
        }

    # ------------------------------------------------------------------
    # Stop Loss
    # ------------------------------------------------------------------

    def _calculate_sl(
        self,
        entry: float,
        direction: str,
        timeframe: str,
        buffer: float,
        bb: dict,
        levels: list[PriceLevel],
        fibs: dict | None,
        swing_points: list[SwingPoint],
    ) -> float:
        """Pick the best SL from structural candidates."""
        candidates: list[tuple[str, float]] = []

        if direction == "LONG":
            # Candidate 1: Strong support below entry
            supports = [
                lv for lv in levels
                if lv.type == "support" and lv.price < entry and lv.strength >= 10
            ]
            if supports:
                best = max(supports, key=lambda lv: lv.price)  # closest below
                candidates.append(("gran_soporte", best.price - buffer))

            # Candidate 2: Fibonacci 0.786
            if fibs:
                fib_786 = _find_fib_retracement(fibs, 0.786)
                if fib_786 and fib_786 < entry:
                    candidates.append(("fib_0786", fib_786 - buffer))

            # Candidate 3: Nearest swing low
            recent_lows = [s for s in swing_points if s.type == "low" and s.price < entry]
            if recent_lows:
                nearest = max(recent_lows, key=lambda s: s.price)
                candidates.append(("swing_low", nearest.price - buffer))

            # Candidate 4: Bollinger lower
            bb_lower = bb.get("lower")
            if bb_lower and bb_lower < entry:
                candidates.append(("bb_lower", bb_lower - buffer * 0.5))

            # Candidate 5: ATR fallback
            candidates.append(("atr_fallback", entry - buffer * 1.5))

        else:  # SHORT
            # Candidate 1: Strong resistance above entry
            resistances = [
                lv for lv in levels
                if lv.type == "resistance" and lv.price > entry and lv.strength >= 10
            ]
            if resistances:
                best = min(resistances, key=lambda lv: lv.price)  # closest above
                candidates.append(("gran_resistencia", best.price + buffer))

            # Candidate 2: Fibonacci 0.786
            if fibs:
                fib_786 = _find_fib_retracement(fibs, 0.786)
                if fib_786 and fib_786 > entry:
                    candidates.append(("fib_0786", fib_786 + buffer))

            # Candidate 3: Nearest swing high
            recent_highs = [s for s in swing_points if s.type == "high" and s.price > entry]
            if recent_highs:
                nearest = min(recent_highs, key=lambda s: s.price)
                candidates.append(("swing_high", nearest.price + buffer))

            # Candidate 4: Bollinger upper
            bb_upper = bb.get("upper")
            if bb_upper and bb_upper > entry:
                candidates.append(("bb_upper", bb_upper + buffer * 0.5))

            # Candidate 5: ATR fallback
            candidates.append(("atr_fallback", entry + buffer * 1.5))

        # Pick: closest to entry that respects the max SL percent
        max_sl_pct = MAX_SL_PERCENT.get(timeframe, 4.0)
        if direction == "LONG":
            max_sl_price = entry * (1 - max_sl_pct / 100)
            valid = [(name, p) for name, p in candidates if p >= max_sl_price]
            if valid:
                best_name, best_price = max(valid, key=lambda c: c[1])
                self._last_sl_method = best_name
                return best_price
        else:
            max_sl_price = entry * (1 + max_sl_pct / 100)
            valid = [(name, p) for name, p in candidates if p <= max_sl_price]
            if valid:
                best_name, best_price = min(valid, key=lambda c: c[1])
                self._last_sl_method = best_name
                return best_price

        # Ultimate fallback
        self._last_sl_method = "atr_fallback"
        return self._atr_fallback_sl(entry, direction, buffer)

    # ------------------------------------------------------------------
    # Take Profit 1
    # ------------------------------------------------------------------

    def _calculate_tp1(
        self,
        entry: float,
        direction: str,
        timeframe: str,
        risk: float,
        buffer: float,
        bb: dict,
        levels: list[PriceLevel],
        fibs: dict | None,
        swing_points: list[SwingPoint],
    ) -> float:
        """Pick the best TP1 from structural candidates."""
        candidates: list[tuple[str, float]] = []

        if direction == "LONG":
            # Candidate 1: Fib extension at a strong resistance
            if fibs:
                for ext in fibs.get("extensions", []):
                    if ext["price"] > entry:
                        for lv in levels:
                            if lv.type == "resistance" and lv.strength >= 8:
                                if _near(ext["price"], lv.price, 1.0):
                                    candidates.append(("fib_ext_at_level", ext["price"]))
                                    break

            # Candidate 2: Nearest strong resistance
            resistances = [
                lv for lv in levels
                if lv.type == "resistance" and lv.price > entry and lv.strength >= 8
            ]
            if resistances:
                nearest = min(resistances, key=lambda lv: lv.price)
                candidates.append(("strong_resistance", nearest.price))

            # Candidate 3: Swing high
            highs = [s for s in swing_points if s.type == "high" and s.price > entry]
            if highs:
                nearest = min(highs, key=lambda s: s.price)
                candidates.append(("swing_high", nearest.price))

            # Candidate 4: Bollinger mid
            bb_mid = bb.get("mid")
            if bb_mid and bb_mid > entry:
                candidates.append(("bb_mid", bb_mid))

            # Candidate 5: ATR fallback
            min_rr = MIN_RR_TP1.get(timeframe, 1.5)
            candidates.append(("atr_fallback", entry + risk * min_rr))

        else:  # SHORT
            # Candidate 1: Fib extension at strong support
            if fibs:
                for ext in fibs.get("extensions", []):
                    if ext["price"] < entry:
                        for lv in levels:
                            if lv.type == "support" and lv.strength >= 8:
                                if _near(ext["price"], lv.price, 1.0):
                                    candidates.append(("fib_ext_at_level", ext["price"]))
                                    break

            # Candidate 2: Nearest strong support
            supports = [
                lv for lv in levels
                if lv.type == "support" and lv.price < entry and lv.strength >= 8
            ]
            if supports:
                nearest = max(supports, key=lambda lv: lv.price)
                candidates.append(("strong_support", nearest.price))

            # Candidate 3: Swing low
            lows = [s for s in swing_points if s.type == "low" and s.price < entry]
            if lows:
                nearest = max(lows, key=lambda s: s.price)
                candidates.append(("swing_low", nearest.price))

            # Candidate 4: Bollinger mid
            bb_mid = bb.get("mid")
            if bb_mid and bb_mid < entry:
                candidates.append(("bb_mid", bb_mid))

            # Candidate 5: ATR fallback
            min_rr = MIN_RR_TP1.get(timeframe, 1.5)
            candidates.append(("atr_fallback", entry - risk * min_rr))

        return self._pick_tp(candidates, entry, direction, "tp1")

    # ------------------------------------------------------------------
    # Take Profit 2
    # ------------------------------------------------------------------

    def _calculate_tp2(
        self,
        entry: float,
        direction: str,
        timeframe: str,
        risk: float,
        buffer: float,
        bb: dict,
        levels: list[PriceLevel],
        fibs: dict | None,
        swing_points: list[SwingPoint],
        tp1: float,
    ) -> float:
        """Pick the best TP2 (beyond TP1) from structural candidates."""
        candidates: list[tuple[str, float]] = []

        if direction == "LONG":
            # Candidate 1: Fib 1.618 extension at strong resistance
            if fibs:
                for ext in fibs.get("extensions", []):
                    if ext["ratio"] == 1.618 and ext["price"] > tp1:
                        for lv in levels:
                            if lv.type == "resistance" and lv.strength >= 8:
                                if _near(ext["price"], lv.price, 1.5):
                                    candidates.append(("fib_1618_at_level", ext["price"]))
                                    break

            # Candidate 2: Next strong resistance beyond TP1
            resistances = [
                lv for lv in levels
                if lv.type == "resistance" and lv.price > tp1 and lv.strength >= 8
            ]
            if resistances:
                nearest = min(resistances, key=lambda lv: lv.price)
                candidates.append(("next_resistance", nearest.price))

            # Candidate 3: Fib 1.618 extension
            if fibs:
                for ext in fibs.get("extensions", []):
                    if ext["ratio"] == 1.618 and ext["price"] > tp1:
                        candidates.append(("fib_1618", ext["price"]))
                        break

            # Candidate 4: Bollinger upper
            bb_upper = bb.get("upper")
            if bb_upper and bb_upper > tp1:
                candidates.append(("bb_upper", bb_upper))

            # Candidate 5: ATR fallback
            min_rr = MIN_RR_TP2.get(timeframe, 2.5)
            candidates.append(("atr_fallback", entry + risk * min_rr))

        else:  # SHORT
            # Candidate 1: Fib 1.618 extension at strong support
            if fibs:
                for ext in fibs.get("extensions", []):
                    if ext["ratio"] == 1.618 and ext["price"] < tp1:
                        for lv in levels:
                            if lv.type == "support" and lv.strength >= 8:
                                if _near(ext["price"], lv.price, 1.5):
                                    candidates.append(("fib_1618_at_level", ext["price"]))
                                    break

            # Candidate 2: Next strong support below TP1
            supports = [
                lv for lv in levels
                if lv.type == "support" and lv.price < tp1 and lv.strength >= 8
            ]
            if supports:
                nearest = max(supports, key=lambda lv: lv.price)
                candidates.append(("next_support", nearest.price))

            # Candidate 3: Fib 1.618
            if fibs:
                for ext in fibs.get("extensions", []):
                    if ext["ratio"] == 1.618 and ext["price"] < tp1:
                        candidates.append(("fib_1618", ext["price"]))
                        break

            # Candidate 4: Bollinger lower
            bb_lower = bb.get("lower")
            if bb_lower and bb_lower < tp1:
                candidates.append(("bb_lower", bb_lower))

            # Candidate 5: ATR fallback
            min_rr = MIN_RR_TP2.get(timeframe, 2.5)
            candidates.append(("atr_fallback", entry - risk * min_rr))

        return self._pick_tp(candidates, entry, direction, "tp2")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _pick_tp(
        self,
        candidates: list[tuple[str, float]],
        entry: float,
        direction: str,
        tp_label: str,
    ) -> float:
        """Pick the best TP candidate: closest structural level beyond entry."""
        if not candidates:
            return entry

        if direction == "LONG":
            valid = [(n, p) for n, p in candidates if p > entry]
            if valid:
                best_name, best_price = min(valid, key=lambda c: c[1])
            else:
                best_name, best_price = candidates[-1]  # fallback
        else:
            valid = [(n, p) for n, p in candidates if p < entry]
            if valid:
                best_name, best_price = max(valid, key=lambda c: c[1])
            else:
                best_name, best_price = candidates[-1]

        if tp_label == "tp1":
            self._last_tp1_method = best_name
        else:
            self._last_tp2_method = best_name

        return best_price

    @staticmethod
    def _atr_fallback_sl(entry: float, direction: str, buffer: float) -> float:
        if direction == "LONG":
            return entry - buffer * 1.5
        else:
            return entry + buffer * 1.5


# ── Module-level helpers ──────────────────────────────────────────────────────

def _find_fib_retracement(fibs: dict, ratio: float) -> float | None:
    """Find the price for a specific Fib retracement ratio."""
    for r in fibs.get("retracements", []):
        if r["ratio"] == ratio:
            return r["price"]
    return None


def _near(price_a: float, price_b: float, tolerance_pct: float) -> bool:
    """Check if two prices are within tolerance_pct of each other."""
    if price_b == 0:
        return False
    return abs(price_a - price_b) / price_b * 100 <= tolerance_pct
