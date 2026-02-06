"""Signal Classifier — Convierte valores numéricos en señales claras."""


class SignalClassifier:
    """Clasificador unificado de señales para todos los indicadores."""

    @staticmethod
    def classify_rsi(value: float) -> dict:
        if value > 80: return {"signal": "extreme_bearish", "label": "MUY SOBRECOMPRADO"}
        if value > 70: return {"signal": "bearish", "label": "SOBRECOMPRADO"}
        if value > 55: return {"signal": "bullish", "label": "ALCISTA MODERADO"}
        if value > 45: return {"signal": "neutral", "label": "NEUTRAL"}
        if value > 30: return {"signal": "bearish", "label": "BAJISTA MODERADO"}
        return {"signal": "extreme_bullish", "label": "MUY SOBREVENDIDO"}

    @staticmethod
    def classify_macd(macd: float, signal: float, histogram: float) -> dict:
        if macd > signal and histogram > 0:
            if histogram > abs(macd) * 0.1:
                return {"signal": "bullish", "label": "MACD ALCISTA FUERTE"}
            return {"signal": "bullish", "label": "MACD ALCISTA"}
        if macd < signal and histogram < 0:
            if abs(histogram) > abs(macd) * 0.1:
                return {"signal": "bearish", "label": "MACD BAJISTA FUERTE"}
            return {"signal": "bearish", "label": "MACD BAJISTA"}
        return {"signal": "neutral", "label": "MACD NEUTRAL"}

    @staticmethod
    def classify_sma_cross(sma50: float, sma200: float) -> dict:
        ratio = (sma50 - sma200) / sma200 if sma200 != 0 else 0
        if ratio > 0.05: return {"signal": "bullish", "label": "GOLDEN CROSS CONFIRMADO"}
        if ratio > 0: return {"signal": "bullish", "label": "SMA50 > SMA200"}
        if ratio > -0.02: return {"signal": "neutral", "label": "CRUCE INMINENTE"}
        if ratio > -0.05: return {"signal": "bearish", "label": "SMA50 < SMA200"}
        return {"signal": "bearish", "label": "DEATH CROSS CONFIRMADO"}

    @staticmethod
    def classify_bollinger(price: float, upper: float, lower: float, mid: float) -> dict:
        if upper == lower:
            return {"signal": "neutral", "label": "BOLLINGER SIN DATOS"}
        position = (price - lower) / (upper - lower)
        if position > 0.95: return {"signal": "extreme_bearish", "label": "SOBRE BANDA SUPERIOR"}
        if position > 0.8: return {"signal": "bearish", "label": "CERCA BANDA SUPERIOR"}
        if position > 0.6: return {"signal": "bullish", "label": "ZONA ALTA"}
        if position > 0.4: return {"signal": "neutral", "label": "ZONA MEDIA"}
        if position > 0.2: return {"signal": "bearish", "label": "ZONA BAJA"}
        if position > 0.05: return {"signal": "bullish", "label": "CERCA BANDA INFERIOR"}
        return {"signal": "extreme_bullish", "label": "BAJO BANDA INFERIOR"}

    @staticmethod
    def classify_mvrv(value: float) -> dict:
        if value > 7: return {"signal": "extreme_bearish", "label": "TOP PROBABLE"}
        if value > 3: return {"signal": "bearish", "label": "SOBRECALENTADO"}
        if value > 1: return {"signal": "bullish", "label": "ZONA SALUDABLE"}
        if value > 0: return {"signal": "neutral", "label": "INFRAVALORADO"}
        return {"signal": "extreme_bullish", "label": "BOTTOM PROBABLE"}

    @staticmethod
    def classify_sopr(value: float) -> dict:
        if value > 1.05: return {"signal": "bearish", "label": "PROFIT TAKING ALTO"}
        if value > 1.0: return {"signal": "neutral", "label": "PROFIT MODERADO"}
        if value >= 0.99: return {"signal": "neutral", "label": "BREAKEVEN"}
        return {"signal": "bullish", "label": "CAPITULACION"}

    @staticmethod
    def classify_nupl(value: float) -> dict:
        if value > 0.75: return {"signal": "extreme_bearish", "label": "EUFORIA"}
        if value > 0.5: return {"signal": "bearish", "label": "CODICIA"}
        if value > 0.25: return {"signal": "bullish", "label": "OPTIMISMO"}
        if value > 0: return {"signal": "neutral", "label": "ESPERANZA"}
        if value > -0.25: return {"signal": "bullish", "label": "MIEDO"}
        return {"signal": "extreme_bullish", "label": "CAPITULACION"}

    @staticmethod
    def classify_fear_greed(value: int) -> dict:
        if value > 80: return {"signal": "extreme_bearish", "label": "EXTREME GREED"}
        if value > 60: return {"signal": "bearish", "label": "GREED"}
        if value > 40: return {"signal": "neutral", "label": "NEUTRAL"}
        if value > 20: return {"signal": "bullish", "label": "FEAR"}
        return {"signal": "extreme_bullish", "label": "EXTREME FEAR"}

    @staticmethod
    def classify_hash_rate_change(pct_change_30d: float) -> dict:
        if pct_change_30d > 10: return {"signal": "bullish", "label": "HASH RATE CRECIENDO RAPIDO"}
        if pct_change_30d > 2: return {"signal": "bullish", "label": "HASH RATE CRECIENDO"}
        if pct_change_30d > -2: return {"signal": "neutral", "label": "HASH RATE ESTABLE"}
        if pct_change_30d > -10: return {"signal": "bearish", "label": "HASH RATE CAYENDO"}
        return {"signal": "extreme_bearish", "label": "HASH RATE DESPLOMANDOSE"}

    @staticmethod
    def classify_exchange_flow(net_flow: float) -> dict:
        """net_flow positivo = más BTC entrando a exchanges (bearish)."""
        if net_flow > 1000: return {"signal": "bearish", "label": "INFLOW MASIVO A EXCHANGES"}
        if net_flow > 100: return {"signal": "bearish", "label": "INFLOW A EXCHANGES"}
        if net_flow > -100: return {"signal": "neutral", "label": "FLUJO NEUTRAL"}
        if net_flow > -1000: return {"signal": "bullish", "label": "OUTFLOW DE EXCHANGES"}
        return {"signal": "extreme_bullish", "label": "OUTFLOW MASIVO DE EXCHANGES"}

    @staticmethod
    def classify_nvt(value: float) -> dict:
        if value > 150: return {"signal": "bearish", "label": "NVT MUY ALTO — SOBREVALORACION"}
        if value > 100: return {"signal": "bearish", "label": "NVT ALTO"}
        if value > 50: return {"signal": "neutral", "label": "NVT NORMAL"}
        if value > 25: return {"signal": "bullish", "label": "NVT BAJO — INFRAVALORADO"}
        return {"signal": "extreme_bullish", "label": "NVT MUY BAJO"}

    @staticmethod
    def classify_funding_rate(rate_pct: float) -> dict:
        """Classify funding rate (contrarian). High positive = bearish, high negative = bullish."""
        if rate_pct > 0.1: return {"signal": "extreme_bearish", "label": "FUNDING EXTREMO POSITIVO — CONTRARIAN BEARISH"}
        if rate_pct > 0.03: return {"signal": "bearish", "label": "FUNDING POSITIVO — MERCADO LARGO"}
        if rate_pct > -0.03: return {"signal": "neutral", "label": "FUNDING NEUTRAL"}
        if rate_pct > -0.05: return {"signal": "bullish", "label": "FUNDING NEGATIVO — CONTRARIAN BULLISH"}
        return {"signal": "extreme_bullish", "label": "FUNDING EXTREMO NEGATIVO — CONTRARIAN BULLISH FUERTE"}

    @staticmethod
    def classify_open_interest_change(current: float, avg_30d: float) -> dict:
        """Classify OI change vs 30D average."""
        if avg_30d == 0:
            return {"signal": "neutral", "label": "OI SIN REFERENCIA"}
        pct = ((current - avg_30d) / avg_30d) * 100
        if pct > 20: return {"signal": "bearish", "label": "OI MUY ALTO — RIESGO LIQUIDACIONES"}
        if pct > 5: return {"signal": "neutral", "label": "OI ELEVADO"}
        if pct > -5: return {"signal": "neutral", "label": "OI NORMAL"}
        if pct > -20: return {"signal": "neutral", "label": "OI BAJO"}
        return {"signal": "bullish", "label": "OI MUY BAJO — MERCADO ORGANICO"}

    @staticmethod
    def classify_volatility(vol_30d: float, vol_avg: float) -> dict:
        ratio = vol_30d / vol_avg if vol_avg > 0 else 1
        if ratio > 1.5: return {"signal": "bearish", "label": "VOLATILIDAD MUY ALTA"}
        if ratio > 1.2: return {"signal": "neutral", "label": "VOLATILIDAD ALTA"}
        if ratio > 0.8: return {"signal": "neutral", "label": "VOLATILIDAD NORMAL"}
        if ratio > 0.5: return {"signal": "bullish", "label": "VOLATILIDAD BAJA"}
        return {"signal": "bullish", "label": "VOLATILIDAD MUY BAJA — SQUEEZE"}
