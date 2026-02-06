"""Tests for SignalClassifier — all classification methods and edge cases."""

import pytest

from btc_intel.analysis.signal_classifier import SignalClassifier


class TestClassifyRSI:
    """RSI boundaries: >80 extreme_bearish, >70 bearish, >55 bullish,
    >45 neutral, >30 bearish, <=30 extreme_bullish."""

    @pytest.mark.parametrize("value,expected_signal", [
        (90, "extreme_bearish"),
        (81, "extreme_bearish"),
        (80.1, "extreme_bearish"),
        (80, "bearish"),         # boundary: 80 is NOT > 80
        (75, "bearish"),
        (70.1, "bearish"),
        (70, "bullish"),         # boundary: 70 is NOT > 70
        (60, "bullish"),
        (55.1, "bullish"),
        (55, "neutral"),         # boundary: 55 is NOT > 55
        (50, "neutral"),
        (45.1, "neutral"),
        (45, "bearish"),         # boundary: 45 is NOT > 45
        (35, "bearish"),
        (30.1, "bearish"),
        (30, "extreme_bullish"), # boundary: 30 is NOT > 30
        (20, "extreme_bullish"),
        (0, "extreme_bullish"),
    ])
    def test_rsi_classification(self, value, expected_signal):
        result = SignalClassifier.classify_rsi(value)
        assert result["signal"] == expected_signal
        assert "label" in result

    def test_rsi_returns_label(self):
        result = SignalClassifier.classify_rsi(90)
        assert result["label"] == "MUY SOBRECOMPRADO"

    def test_rsi_neutral_label(self):
        result = SignalClassifier.classify_rsi(50)
        assert result["label"] == "NEUTRAL"


class TestClassifyMACD:
    """MACD classification depends on macd vs signal and histogram sign/magnitude."""

    def test_bullish_strong(self):
        # macd > signal, histogram > 0, histogram > abs(macd) * 0.1
        result = SignalClassifier.classify_macd(100, 80, 25)
        assert result["signal"] == "bullish"
        assert "FUERTE" in result["label"]

    def test_bullish_weak(self):
        # macd > signal, histogram > 0, histogram <= abs(macd) * 0.1
        result = SignalClassifier.classify_macd(100, 80, 5)
        assert result["signal"] == "bullish"
        assert "FUERTE" not in result["label"]

    def test_bearish_strong(self):
        # macd < signal, histogram < 0, abs(histogram) > abs(macd) * 0.1
        result = SignalClassifier.classify_macd(-100, -80, -25)
        assert result["signal"] == "bearish"
        assert "FUERTE" in result["label"]

    def test_bearish_weak(self):
        # macd < signal, histogram < 0, abs(histogram) <= abs(macd) * 0.1
        result = SignalClassifier.classify_macd(-100, -80, -5)
        assert result["signal"] == "bearish"
        assert "FUERTE" not in result["label"]

    def test_neutral_when_mixed(self):
        # macd > signal but histogram < 0 (contradictory)
        result = SignalClassifier.classify_macd(100, 80, -5)
        assert result["signal"] == "neutral"

    def test_neutral_equal_values(self):
        result = SignalClassifier.classify_macd(0, 0, 0)
        assert result["signal"] == "neutral"


class TestClassifySMACross:
    """SMA cross: ratio = (sma50 - sma200) / sma200."""

    @pytest.mark.parametrize("sma50,sma200,expected_signal", [
        (110, 100, "bullish"),   # ratio = 0.10 > 0.05
        (105.1, 100, "bullish"), # ratio = 0.051 > 0.05
        (103, 100, "bullish"),   # ratio = 0.03 — > 0 but <= 0.05
        (99, 100, "neutral"),    # ratio = -0.01 — > -0.02
        (96, 100, "bearish"),    # ratio = -0.04 — > -0.05
        (90, 100, "bearish"),    # ratio = -0.10 — <= -0.05
    ])
    def test_sma_cross_classification(self, sma50, sma200, expected_signal):
        result = SignalClassifier.classify_sma_cross(sma50, sma200)
        assert result["signal"] == expected_signal

    def test_sma200_zero_safe(self):
        """Should not crash when sma200 is 0."""
        result = SignalClassifier.classify_sma_cross(100, 0)
        assert "signal" in result

    def test_golden_cross_label(self):
        result = SignalClassifier.classify_sma_cross(110, 100)
        assert "GOLDEN CROSS" in result["label"]

    def test_death_cross_label(self):
        result = SignalClassifier.classify_sma_cross(90, 100)
        assert "DEATH CROSS" in result["label"]


class TestClassifyBollinger:
    """Bollinger: position = (price - lower) / (upper - lower)."""

    @pytest.mark.parametrize("price,upper,lower,mid,expected_signal", [
        (100, 100, 0, 50, "extreme_bearish"),  # position = 1.0 > 0.95
        (96, 100, 0, 50, "extreme_bearish"),    # position = 0.96 > 0.95
        (90, 100, 0, 50, "bearish"),            # position = 0.90, > 0.8
        (70, 100, 0, 50, "bullish"),            # position = 0.70, > 0.6
        (50, 100, 0, 50, "neutral"),            # position = 0.50, > 0.4
        (30, 100, 0, 50, "bearish"),            # position = 0.30, > 0.2
        (10, 100, 0, 50, "bullish"),            # position = 0.10, > 0.05
        (2, 100, 0, 50, "extreme_bullish"),     # position = 0.02, <= 0.05
    ])
    def test_bollinger_classification(self, price, upper, lower, mid, expected_signal):
        result = SignalClassifier.classify_bollinger(price, upper, lower, mid)
        assert result["signal"] == expected_signal

    def test_bollinger_equal_bands(self):
        """When upper == lower, should return neutral."""
        result = SignalClassifier.classify_bollinger(50, 50, 50, 50)
        assert result["signal"] == "neutral"
        assert "SIN DATOS" in result["label"]


class TestClassifyMVRV:
    """MVRV Z-score classification."""

    @pytest.mark.parametrize("value,expected_signal", [
        (8, "extreme_bearish"),
        (4, "bearish"),
        (2, "bullish"),
        (0.5, "neutral"),
        (-1, "extreme_bullish"),
    ])
    def test_mvrv(self, value, expected_signal):
        result = SignalClassifier.classify_mvrv(value)
        assert result["signal"] == expected_signal


class TestClassifySopr:
    """SOPR classification."""

    @pytest.mark.parametrize("value,expected_signal", [
        (1.10, "bearish"),
        (1.02, "neutral"),
        (1.0, "neutral"),
        (0.995, "neutral"),    # >= 0.99 is BREAKEVEN
        (0.98, "bullish"),     # < 0.99 is CAPITULACION
    ])
    def test_sopr(self, value, expected_signal):
        result = SignalClassifier.classify_sopr(value)
        assert result["signal"] == expected_signal


class TestClassifyNupl:
    """NUPL classification."""

    @pytest.mark.parametrize("value,expected_signal", [
        (0.8, "extreme_bearish"),
        (0.6, "bearish"),
        (0.3, "bullish"),
        (0.1, "neutral"),
        (-0.1, "bullish"),
        (-0.3, "extreme_bullish"),
    ])
    def test_nupl(self, value, expected_signal):
        result = SignalClassifier.classify_nupl(value)
        assert result["signal"] == expected_signal


class TestClassifyFearGreed:
    """Fear & Greed index."""

    @pytest.mark.parametrize("value,expected_signal,expected_label", [
        (90, "extreme_bearish", "EXTREME GREED"),
        (70, "bearish", "GREED"),
        (50, "neutral", "NEUTRAL"),
        (30, "bullish", "FEAR"),
        (10, "extreme_bullish", "EXTREME FEAR"),
    ])
    def test_fear_greed(self, value, expected_signal, expected_label):
        result = SignalClassifier.classify_fear_greed(value)
        assert result["signal"] == expected_signal
        assert result["label"] == expected_label

    def test_boundary_80(self):
        """80 is NOT > 80, so it should be bearish (GREED), not extreme_bearish."""
        result = SignalClassifier.classify_fear_greed(80)
        assert result["signal"] == "bearish"

    def test_boundary_20(self):
        """20 is NOT > 20, so it should be extreme_bullish (EXTREME FEAR)."""
        result = SignalClassifier.classify_fear_greed(20)
        assert result["signal"] == "extreme_bullish"


class TestClassifyHashRateChange:
    """Hash rate 30d change classification."""

    @pytest.mark.parametrize("pct,expected_signal", [
        (15, "bullish"),
        (5, "bullish"),
        (0, "neutral"),
        (-5, "bearish"),
        (-15, "extreme_bearish"),
    ])
    def test_hash_rate(self, pct, expected_signal):
        result = SignalClassifier.classify_hash_rate_change(pct)
        assert result["signal"] == expected_signal


class TestClassifyExchangeFlow:
    """Exchange net flow: positive = bearish (BTC entering exchanges)."""

    @pytest.mark.parametrize("flow,expected_signal", [
        (2000, "bearish"),
        (500, "bearish"),
        (0, "neutral"),
        (-500, "bullish"),
        (-2000, "extreme_bullish"),
    ])
    def test_exchange_flow(self, flow, expected_signal):
        result = SignalClassifier.classify_exchange_flow(flow)
        assert result["signal"] == expected_signal


class TestClassifyNVT:
    """NVT ratio classification."""

    @pytest.mark.parametrize("value,expected_signal", [
        (200, "bearish"),
        (120, "bearish"),
        (75, "neutral"),
        (30, "bullish"),
        (10, "extreme_bullish"),
    ])
    def test_nvt(self, value, expected_signal):
        result = SignalClassifier.classify_nvt(value)
        assert result["signal"] == expected_signal


class TestClassifyVolatility:
    """Volatility: ratio = vol_30d / vol_avg."""

    @pytest.mark.parametrize("vol_30d,vol_avg,expected_signal", [
        (30, 10, "bearish"),    # ratio = 3.0 > 1.5
        (13, 10, "neutral"),    # ratio = 1.3 > 1.2
        (10, 10, "neutral"),    # ratio = 1.0 > 0.8
        (6, 10, "bullish"),     # ratio = 0.6 > 0.5
        (3, 10, "bullish"),     # ratio = 0.3 <= 0.5
    ])
    def test_volatility(self, vol_30d, vol_avg, expected_signal):
        result = SignalClassifier.classify_volatility(vol_30d, vol_avg)
        assert result["signal"] == expected_signal

    def test_volatility_avg_zero(self):
        """When vol_avg is 0, should default ratio to 1 (neutral-ish)."""
        result = SignalClassifier.classify_volatility(10, 0)
        assert result["signal"] == "neutral"

    def test_squeeze_label(self):
        result = SignalClassifier.classify_volatility(3, 10)
        assert "SQUEEZE" in result["label"]
