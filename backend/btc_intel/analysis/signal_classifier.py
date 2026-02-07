"""Signal Classifier — Converts numeric values into clear signals."""


class SignalClassifier:
    """Unified signal classifier for all indicators."""

    @staticmethod
    def classify_rsi(value: float) -> dict:
        if value > 80: return {"signal": "extreme_bearish", "label": "EXTREMELY OVERBOUGHT"}
        if value > 70: return {"signal": "bearish", "label": "OVERBOUGHT"}
        if value > 55: return {"signal": "bullish", "label": "MODERATE BULLISH"}
        if value > 45: return {"signal": "neutral", "label": "NEUTRAL"}
        if value > 30: return {"signal": "bearish", "label": "MODERATE BEARISH"}
        return {"signal": "extreme_bullish", "label": "EXTREMELY OVERSOLD"}

    @staticmethod
    def classify_macd(macd: float, signal: float, histogram: float) -> dict:
        if macd > signal and histogram > 0:
            if histogram > abs(macd) * 0.1:
                return {"signal": "bullish", "label": "MACD STRONG BULLISH"}
            return {"signal": "bullish", "label": "MACD BULLISH"}
        if macd < signal and histogram < 0:
            if abs(histogram) > abs(macd) * 0.1:
                return {"signal": "bearish", "label": "MACD STRONG BEARISH"}
            return {"signal": "bearish", "label": "MACD BEARISH"}
        return {"signal": "neutral", "label": "MACD NEUTRAL"}

    @staticmethod
    def classify_sma_cross(sma50: float, sma200: float) -> dict:
        ratio = (sma50 - sma200) / sma200 if sma200 != 0 else 0
        if ratio > 0.05: return {"signal": "bullish", "label": "GOLDEN CROSS CONFIRMED"}
        if ratio > 0: return {"signal": "bullish", "label": "SMA50 > SMA200"}
        if ratio > -0.02: return {"signal": "neutral", "label": "CROSS IMMINENT"}
        if ratio > -0.05: return {"signal": "bearish", "label": "SMA50 < SMA200"}
        return {"signal": "bearish", "label": "DEATH CROSS CONFIRMED"}

    @staticmethod
    def classify_bollinger(price: float, upper: float, lower: float, mid: float) -> dict:
        if upper == lower:
            return {"signal": "neutral", "label": "BOLLINGER NO DATA"}
        position = (price - lower) / (upper - lower)
        if position > 0.95: return {"signal": "extreme_bearish", "label": "ABOVE UPPER BAND"}
        if position > 0.8: return {"signal": "bearish", "label": "NEAR UPPER BAND"}
        if position > 0.6: return {"signal": "bullish", "label": "HIGH ZONE"}
        if position > 0.4: return {"signal": "neutral", "label": "MID ZONE"}
        if position > 0.2: return {"signal": "bearish", "label": "LOW ZONE"}
        if position > 0.05: return {"signal": "bullish", "label": "NEAR LOWER BAND"}
        return {"signal": "extreme_bullish", "label": "BELOW LOWER BAND"}

    @staticmethod
    def classify_mvrv(value: float) -> dict:
        if value > 7: return {"signal": "extreme_bearish", "label": "PROBABLE TOP"}
        if value > 3: return {"signal": "bearish", "label": "OVERHEATED"}
        if value > 1: return {"signal": "bullish", "label": "HEALTHY ZONE"}
        if value > 0: return {"signal": "neutral", "label": "UNDERVALUED"}
        return {"signal": "extreme_bullish", "label": "PROBABLE BOTTOM"}

    @staticmethod
    def classify_sopr(value: float) -> dict:
        if value > 1.05: return {"signal": "bearish", "label": "HIGH PROFIT TAKING"}
        if value > 1.0: return {"signal": "neutral", "label": "MODERATE PROFIT"}
        if value >= 0.99: return {"signal": "neutral", "label": "BREAKEVEN"}
        return {"signal": "bullish", "label": "CAPITULATION"}

    @staticmethod
    def classify_nupl(value: float) -> dict:
        if value > 0.75: return {"signal": "extreme_bearish", "label": "EUPHORIA"}
        if value > 0.5: return {"signal": "bearish", "label": "GREED"}
        if value > 0.25: return {"signal": "bullish", "label": "OPTIMISM"}
        if value > 0: return {"signal": "neutral", "label": "HOPE"}
        if value > -0.25: return {"signal": "bullish", "label": "FEAR"}
        return {"signal": "extreme_bullish", "label": "CAPITULATION"}

    @staticmethod
    def classify_fear_greed(value: int) -> dict:
        if value > 80: return {"signal": "extreme_bearish", "label": "EXTREME GREED"}
        if value > 60: return {"signal": "bearish", "label": "GREED"}
        if value > 40: return {"signal": "neutral", "label": "NEUTRAL"}
        if value > 20: return {"signal": "bullish", "label": "FEAR"}
        return {"signal": "extreme_bullish", "label": "EXTREME FEAR"}

    @staticmethod
    def classify_hash_rate_change(pct_change_30d: float) -> dict:
        if pct_change_30d > 10: return {"signal": "bullish", "label": "HASH RATE GROWING FAST"}
        if pct_change_30d > 2: return {"signal": "bullish", "label": "HASH RATE GROWING"}
        if pct_change_30d > -2: return {"signal": "neutral", "label": "HASH RATE STABLE"}
        if pct_change_30d > -10: return {"signal": "bearish", "label": "HASH RATE DECLINING"}
        return {"signal": "extreme_bearish", "label": "HASH RATE PLUMMETING"}

    @staticmethod
    def classify_exchange_flow(net_flow: float) -> dict:
        """net_flow positive = more BTC entering exchanges (bearish)."""
        if net_flow > 1000: return {"signal": "bearish", "label": "MASSIVE INFLOW TO EXCHANGES"}
        if net_flow > 100: return {"signal": "bearish", "label": "INFLOW TO EXCHANGES"}
        if net_flow > -100: return {"signal": "neutral", "label": "NEUTRAL FLOW"}
        if net_flow > -1000: return {"signal": "bullish", "label": "OUTFLOW FROM EXCHANGES"}
        return {"signal": "extreme_bullish", "label": "MASSIVE OUTFLOW FROM EXCHANGES"}

    @staticmethod
    def classify_nvt(value: float) -> dict:
        if value > 150: return {"signal": "bearish", "label": "NVT VERY HIGH — OVERVALUATION"}
        if value > 100: return {"signal": "bearish", "label": "NVT HIGH"}
        if value > 50: return {"signal": "neutral", "label": "NVT NORMAL"}
        if value > 25: return {"signal": "bullish", "label": "NVT LOW — UNDERVALUED"}
        return {"signal": "extreme_bullish", "label": "NVT VERY LOW"}

    @staticmethod
    def classify_funding_rate(rate_pct: float) -> dict:
        """Classify funding rate (contrarian). High positive = bearish, high negative = bullish."""
        if rate_pct > 0.1: return {"signal": "extreme_bearish", "label": "EXTREME POSITIVE FUNDING — CONTRARIAN BEARISH"}
        if rate_pct > 0.03: return {"signal": "bearish", "label": "POSITIVE FUNDING — MARKET LONG"}
        if rate_pct > -0.03: return {"signal": "neutral", "label": "NEUTRAL FUNDING"}
        if rate_pct > -0.05: return {"signal": "bullish", "label": "NEGATIVE FUNDING — CONTRARIAN BULLISH"}
        return {"signal": "extreme_bullish", "label": "EXTREME NEGATIVE FUNDING — STRONG CONTRARIAN BULLISH"}

    @staticmethod
    def classify_open_interest_change(current: float, avg_30d: float) -> dict:
        """Classify OI change vs 30D average."""
        if avg_30d == 0:
            return {"signal": "neutral", "label": "OI NO REFERENCE"}
        pct = ((current - avg_30d) / avg_30d) * 100
        if pct > 20: return {"signal": "bearish", "label": "OI VERY HIGH — LIQUIDATION RISK"}
        if pct > 5: return {"signal": "neutral", "label": "OI ELEVATED"}
        if pct > -5: return {"signal": "neutral", "label": "OI NORMAL"}
        if pct > -20: return {"signal": "neutral", "label": "OI LOW"}
        return {"signal": "bullish", "label": "OI VERY LOW — ORGANIC MARKET"}

    @staticmethod
    def classify_volatility(vol_30d: float, vol_avg: float) -> dict:
        ratio = vol_30d / vol_avg if vol_avg > 0 else 1
        if ratio > 1.5: return {"signal": "bearish", "label": "VERY HIGH VOLATILITY"}
        if ratio > 1.2: return {"signal": "neutral", "label": "HIGH VOLATILITY"}
        if ratio > 0.8: return {"signal": "neutral", "label": "NORMAL VOLATILITY"}
        if ratio > 0.5: return {"signal": "bullish", "label": "LOW VOLATILITY"}
        return {"signal": "bullish", "label": "VERY LOW VOLATILITY — SQUEEZE"}
