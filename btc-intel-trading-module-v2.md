# 📊 BTC Intelligence Hub — Módulo de Trading v2.0

> ACTUALIZACIÓN del sistema de señales existente.
> No reemplaza: EXTIENDE los 9 indicadores actuales con Motor de Niveles,
> Fibonacci, Patrones de Velas y Detección de Setups.

---

## 🔄 Qué cambia vs el sistema actual

| Aspecto | Sistema actual (v1) | Con módulo v2 |
|---------|-------------------|---------------|
| **Indicadores** | 9 indicadores con pesos por TF | 9 indicadores + 4 nuevas capas |
| **Niveles** | ATR + Bollinger + SMAs para TP/SL | Motor de Niveles: Grandes S/R + Fibonacci + Confluencia |
| **TP/SL** | ATR × multiplicador + Bollinger fallback | Estructura + Niveles + Fib + ATR buffer |
| **Patrones** | No detecta velas | 10 patrones de velas como confirmación |
| **Setups** | Solo dirección LONG/SHORT | 3 tipos: Pullback, Breakout, Reversal |
| **Scoring** | 9 indicadores × peso = score | Score actual + bonus niveles + bonus velas + bonus on-chain |
| **Backtesting** | Snapshot dirección + eval | + tipo setup + niveles usados + accuracy por tipo |

### Principio: ADITIVO, no destructivo

```
SCORE FINAL = Score actual (9 indicadores × pesos)
            + Bonus Niveles (0 a +20)
            + Bonus Velas (0 to +10)  
            + Bonus On-Chain (0 to +10)  ← Ya parcialmente existe
            - Penalización contradicciones (0 to -15)

El score de 9 indicadores SIGUE siendo el core (máx 100).
Los bonus pueden subirlo a un máximo teórico de 140.
Se normaliza a 0-100 para display.
```

---

## 🏰 NUEVA CAPA: Motor de Niveles

### Qué detecta automáticamente

**1. Swing Highs/Lows Multi-Timeframe**

```python
class SwingDetector:
    """
    Detecta puntos de giro del precio.
    Un swing high necesita N velas más bajas a cada lado.
    """
    
    PIVOT_BARS = {
        "1H": 5,     # 5 velas a cada lado
        "4H": 7,
        "1D": 10,
        "1W": 5,
    }
    
    def detect(self, timeframe: str, prices: pd.DataFrame) -> list[SwingPoint]:
        n = self.PIVOT_BARS[timeframe]
        swings = []
        
        for i in range(n, len(prices) - n):
            high = prices.iloc[i]["high"]
            low = prices.iloc[i]["low"]
            
            # Swing High: máximo local
            if all(high >= prices.iloc[i-j]["high"] for j in range(1, n+1)) and \
               all(high >= prices.iloc[i+j]["high"] for j in range(1, n+1)):
                swings.append(SwingPoint(
                    price=high, type="high",
                    date=prices.iloc[i]["date"],
                    timeframe=timeframe
                ))
            
            # Swing Low: mínimo local
            if all(low <= prices.iloc[i-j]["low"] for j in range(1, n+1)) and \
               all(low <= prices.iloc[i+j]["low"] for j in range(1, n+1)):
                swings.append(SwingPoint(
                    price=low, type="low",
                    date=prices.iloc[i]["date"],
                    timeframe=timeframe
                ))
        
        return swings
```

**2. Zonas de Volumen (Volume Clustering)**

```python
def detect_volume_zones(prices_df: pd.DataFrame, num_bins: int = 100) -> list[dict]:
    """
    Agrupa precios en rangos y suma volumen por rango.
    Los rangos con más volumen = zonas de alto interés del mercado.
    Similar a Volume Profile simplificado.
    Usa datos de btc_prices (ya tenemos OHLCV).
    """
    price_min, price_max = prices_df["low"].min(), prices_df["high"].max()
    bin_size = (price_max - price_min) / num_bins
    
    volume_profile = {}
    for _, row in prices_df.iterrows():
        # Distribuir volumen entre low y high de cada vela
        bins_touched = range(
            int((row["low"] - price_min) / bin_size),
            int((row["high"] - price_min) / bin_size) + 1
        )
        for b in bins_touched:
            price_level = price_min + b * bin_size
            volume_profile[price_level] = volume_profile.get(price_level, 0) + row["volume"] / len(bins_touched)
    
    # Top 10% = zonas de alto volumen
    threshold = sorted(volume_profile.values(), reverse=True)[num_bins // 10]
    return [
        {"price": round(k, 2), "volume": v, "is_high_volume": True}
        for k, v in volume_profile.items() if v >= threshold
    ]
```

**3. Números Psicológicos**

```python
def get_nearby_psychological_levels(current_price: float, range_pct: float = 30) -> list[float]:
    """Niveles redondos que el mercado respeta, filtrados al ±30% del precio actual."""
    ALL_LEVELS = [
        10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000,
        50000, 55000, 60000, 65000, 70000, 75000, 80000, 85000,
        90000, 95000, 100000, 110000, 120000, 125000, 150000,
        175000, 200000, 250000, 300000, 500000
    ]
    low = current_price * (1 - range_pct / 100)
    high = current_price * (1 + range_pct / 100)
    return [l for l in ALL_LEVELS if low <= l <= high]
```

**4. Detección de Cambio de Rol (S↔R Flip)**

```python
def detect_role_flips(levels: list[PriceLevel], prices_df: pd.DataFrame) -> list[PriceLevel]:
    """
    Detecta niveles que cambiaron de rol:
    - Era resistencia (precio rechazado desde abajo 2+ veces)
    - Precio rompió por encima con cierre completo
    - Precio volvió a testear desde arriba
    - Si rebotó → Support-Resistance Flip confirmado
    """
    flips = []
    for level in levels:
        # Buscar si hubo al menos 2 rechazos como resistencia
        rejections_as_resistance = count_rejections(prices_df, level.price, "above")
        if rejections_as_resistance < 2:
            continue
        
        # Buscar si hubo un breakout posterior
        breakout = find_breakout(prices_df, level.price, "above")
        if not breakout:
            continue
        
        # Buscar si hubo retest como soporte después del breakout
        retest = find_retest(prices_df, level.price, "from_above", after=breakout.date)
        if retest and retest.bounced:
            level.is_role_flip = True
            level.flip_date = retest.date
            flips.append(level)
    
    return flips
```

### Puntuación de Fuerza de Nivel (0-20)

```python
class LevelScorer:
    """
    Puntúa cada nivel detectado.
    Niveles con score >= 10 son "Grandes Niveles" y aparecen prominentes
    en el dashboard y en el cálculo de TP/SL.
    """
    
    def score(self, level: PriceLevel) -> int:
        s = 0
        s += min(level.touch_count * 2, 8)          # Toques (máx 8)
        
        if level.visible_in_timeframes >= 3:
            s += 4                                    # Multi-TF (3+ TFs)
        elif level.visible_in_timeframes >= 2:
            s += 2                                    # Multi-TF (2 TFs)
        
        if level.coincides_with_fib:
            s += 3                                    # Confluencia con Fibonacci
        if level.is_role_flip:
            s += 3                                    # Cambio de rol S↔R
        if level.is_high_volume_zone:
            s += 2                                    # Zona de alto volumen
        if level.is_psychological:
            s += 1                                    # Número redondo
        if level.last_touch_days < 30:
            s += 1                                    # Tocado recientemente
        
        return min(s, 20)
    
    # Clasificación visual:
    # 15-20: 🔴 NIVEL CRÍTICO — Todo el mercado lo vigila
    # 10-14: 🟠 NIVEL FUERTE — Alta probabilidad de reacción
    #  5-9:  🟡 NIVEL MODERADO — Puede reaccionar
    #  0-4:  ⚪ NIVEL DÉBIL — Solo referencia
```

### Agrupación en Zonas

Los niveles no son líneas exactas. Niveles dentro del 0.5% se fusionan:

```python
def cluster_levels_into_zones(levels: list, tolerance_pct: float = 0.5) -> list[Zone]:
    """
    Agrupa niveles cercanos en una sola zona.
    La zona hereda el score más alto y acumula los toques.
    """
    sorted_levels = sorted(levels, key=lambda x: x.price)
    zones = []
    used = set()
    
    for i, level in enumerate(sorted_levels):
        if i in used:
            continue
        cluster = [level]
        for j in range(i + 1, len(sorted_levels)):
            if j in used:
                continue
            if abs(sorted_levels[j].price - level.price) / level.price * 100 < tolerance_pct:
                cluster.append(sorted_levels[j])
                used.add(j)
        
        zones.append(Zone(
            price_low=min(l.price for l in cluster),
            price_high=max(l.price for l in cluster),
            price_mid=sum(l.price for l in cluster) / len(cluster),
            strength=max(l.score for l in cluster),
            type="support" if cluster[0].price < current_price else "resistance",
            sources=[l.source for l in cluster],
            touch_count=sum(l.touch_count for l in cluster),
        ))
    
    return sorted(zones, key=lambda z: z.strength, reverse=True)
```

---

## 🌀 NUEVA CAPA: Fibonacci

### Niveles de Retroceso (para entradas)

```
                            Swing High
                                │
    0.000  ────────────────────█───────────  100% del movimiento
    0.236  ──────────────────╱─────────────  Retroceso superficial
    0.382  ────────────────╱───────────────  Retroceso moderado
    0.500  ──────────────╱─────────────────  Nivel psicológico
   ┌──────────────────────────────────────┐
   │ 0.618  GOLDEN RATIO                  │  ⭐ Zona más fiable
   │ 0.650  GOLDEN POCKET                 │  ⭐ para entrar
   └──────────────────────────────────────┘
    0.786  ──────────╱─────────────────────  Último retroceso
    1.000  ─────────█──────────────────────  Si rompe = tendencia falla
                    │
                Swing Low
```

```python
RETRACEMENT_LEVELS = {
    0.236: {"name": "Shallow",       "entry_quality": 2},
    0.382: {"name": "Moderate",       "entry_quality": 5},
    0.500: {"name": "Mid",            "entry_quality": 6},
    0.618: {"name": "Golden Ratio",   "entry_quality": 9},
    0.650: {"name": "Golden Pocket",  "entry_quality": 10},
    0.786: {"name": "Deep",           "entry_quality": 7},
}

def calculate_retracements(swing_low: float, swing_high: float, direction: str) -> list:
    diff = swing_high - swing_low
    levels = []
    for ratio, meta in RETRACEMENT_LEVELS.items():
        if direction == "LONG":
            price = swing_high - (diff * ratio)
        else:
            price = swing_low + (diff * ratio)
        levels.append({
            "ratio": ratio, "price": round(price, 2),
            "name": meta["name"], "entry_quality": meta["entry_quality"],
            "zone_low": round(price * 0.997, 2),    # Zona ±0.3%
            "zone_high": round(price * 1.003, 2),
        })
    return levels
```

### Niveles de Extensión (para TPs)

```python
EXTENSION_LEVELS = {
    1.000: {"name": "Measured Move",    "tp_use": "TP1 conservador"},
    1.272: {"name": "Standard",         "tp_use": "TP1 o TP2"},
    1.618: {"name": "Golden Extension", "tp_use": "TP2 ideal"},
    2.000: {"name": "Double Move",      "tp_use": "TP2 en tendencia fuerte"},
    2.618: {"name": "Extended",         "tp_use": "Solo en euforia"},
}

def calculate_extensions(swing_low: float, swing_high: float,
                        pullback_end: float, direction: str) -> list:
    """
    Extensiones se proyectan DESDE el punto de pullback.
    swing_low → swing_high = impulso original.
    pullback_end = donde el precio rebotó (punto C).
    """
    impulse = swing_high - swing_low
    levels = []
    for ratio, meta in EXTENSION_LEVELS.items():
        if direction == "LONG":
            price = pullback_end + (impulse * ratio)
        else:
            price = pullback_end - (impulse * ratio)
        levels.append({
            "ratio": ratio, "price": round(price, 2),
            "name": meta["name"], "tp_use": meta["tp_use"],
        })
    return levels
```

### Detección Automática de Swings para Fibonacci

```python
class FibonacciEngine:
    """
    Encuentra los swings significativos y calcula Fib automáticamente.
    Un swing significativo tiene al menos N% de movimiento.
    """
    
    MINIMUM_SWING_PERCENT = {
        "1H": 2.0,   "4H": 4.0,   "1D": 8.0,   "1W": 15.0,
    }
    
    def calculate_for_timeframe(self, timeframe: str) -> dict:
        # 1. Detectar swings significativos
        swings = self.swing_detector.detect(timeframe)
        significant = [s for s in swings 
                      if s.percent_move >= self.MINIMUM_SWING_PERCENT[timeframe]]
        
        if len(significant) < 2:
            return None
        
        # 2. Tomar el último impulso completo
        last_high = next(s for s in reversed(significant) if s.type == "high")
        last_low = next(s for s in reversed(significant) if s.type == "low")
        
        # 3. Calcular retrocesos y extensiones
        retracements = calculate_retracements(last_low.price, last_high.price, "LONG")
        extensions = calculate_extensions(
            last_low.price, last_high.price,
            pullback_end=current_price,  # Se actualizará cuando detecte el rebote
            direction="LONG"
        )
        
        return {
            "timeframe": timeframe,
            "swing_low": last_low, "swing_high": last_high,
            "retracements": retracements,
            "extensions": extensions,
        }
```

### Confluencia Fibonacci Multi-Timeframe

```python
class FibConfluenceDetector:
    """
    EL PODER REAL: cuando niveles Fib de distintos timeframes coinciden
    en la misma zona de precio.
    
    Ejemplo:
      Fib 0.618 del Daily = $94,200
      Fib 0.382 del Weekly = $94,500
      → CONFLUENCIA en $94,200-$94,500
      → Si además hay un Gran Soporte ahí → ZONA CRÍTICA
    """
    
    def find_confluences(self, tolerance_pct: float = 0.5) -> list[dict]:
        # Obtener Fibs de cada timeframe
        fibs = {tf: self.fib_engine.calculate_for_timeframe(tf) 
                for tf in ["1H", "4H", "1D", "1W"]}
        
        all_fib_levels = []
        for tf, data in fibs.items():
            if data is None:
                continue
            for level in data["retracements"]:
                all_fib_levels.append({
                    "tf": tf, "price": level["price"],
                    "ratio": level["ratio"], "quality": level["entry_quality"]
                })
        
        # Buscar precios donde 2+ Fibs de diferentes TFs coinciden
        confluences = []
        used = set()
        
        for i, fib1 in enumerate(all_fib_levels):
            if i in used:
                continue
            matching = [fib1]
            for j, fib2 in enumerate(all_fib_levels):
                if j <= i or j in used or fib2["tf"] == fib1["tf"]:
                    continue
                pct_diff = abs(fib1["price"] - fib2["price"]) / fib1["price"] * 100
                if pct_diff < tolerance_pct:
                    matching.append(fib2)
                    used.add(j)
            
            if len(matching) >= 2:
                avg_price = sum(m["price"] for m in matching) / len(matching)
                confluences.append({
                    "price": round(avg_price, 2),
                    "timeframes": [m["tf"] for m in matching],
                    "fib_ratios": [m["ratio"] for m in matching],
                    "num_timeframes": len(set(m["tf"] for m in matching)),
                    "max_quality": max(m["quality"] for m in matching),
                })
        
        return sorted(confluences, key=lambda c: c["num_timeframes"], reverse=True)
```

---

## 🕯️ NUEVA CAPA: Patrones de Velas

### Detección automática

```python
class CandlePatternDetector:
    """
    Detecta patrones de velas usando pandas-ta (ya es dependencia del proyecto).
    pandas-ta incluye detección de patrones via TA-Lib wrappers.
    
    Para los que pandas-ta no cubra, implementación manual.
    """
    
    PATTERNS = {
        # Patrones alcistas (en soporte = señal LONG)
        "bullish_engulfing":   {"direction": "LONG",  "strength": 8, "candles": 2},
        "hammer":              {"direction": "LONG",  "strength": 7, "candles": 1},
        "inverted_hammer":     {"direction": "LONG",  "strength": 6, "candles": 1},
        "morning_star":        {"direction": "LONG",  "strength": 9, "candles": 3},
        "three_white_soldiers":{"direction": "LONG",  "strength": 8, "candles": 3},
        "bullish_pin_bar":     {"direction": "LONG",  "strength": 8, "candles": 1},
        
        # Patrones bajistas (en resistencia = señal SHORT)
        "bearish_engulfing":   {"direction": "SHORT", "strength": 8, "candles": 2},
        "shooting_star":       {"direction": "SHORT", "strength": 7, "candles": 1},
        "evening_star":        {"direction": "SHORT", "strength": 9, "candles": 3},
        "three_black_crows":   {"direction": "SHORT", "strength": 8, "candles": 3},
        "bearish_pin_bar":     {"direction": "SHORT", "strength": 8, "candles": 1},
        
        # Indecisión (requiere confirmación de siguiente vela)
        "doji":                {"direction": "NEUTRAL", "strength": 3, "candles": 1},
    }
    
    def detect_pin_bar(self, candle: dict, direction: str) -> bool:
        """
        Pin Bar: mecha larga en dirección contraria al trade.
        Para LONG: mecha inferior >= 2x el cuerpo, mecha superior pequeña.
        """
        body = abs(candle["close"] - candle["open"])
        upper_wick = candle["high"] - max(candle["close"], candle["open"])
        lower_wick = min(candle["close"], candle["open"]) - candle["low"]
        
        if body == 0:
            return False
        
        if direction == "LONG":
            return lower_wick >= body * 2 and upper_wick <= body * 0.5
        else:  # SHORT
            return upper_wick >= body * 2 and lower_wick <= body * 0.5
    
    def detect_engulfing(self, prev: dict, curr: dict, direction: str) -> bool:
        """Bullish Engulfing: vela actual verde envuelve completamente la anterior roja."""
        if direction == "LONG":
            return (prev["close"] < prev["open"] and      # Prev es roja
                    curr["close"] > curr["open"] and       # Curr es verde
                    curr["open"] <= prev["close"] and      # Abre debajo del cierre prev
                    curr["close"] >= prev["open"])          # Cierra encima de apertura prev
        else:
            return (prev["close"] > prev["open"] and
                    curr["close"] < curr["open"] and
                    curr["open"] >= prev["close"] and
                    curr["close"] <= prev["open"])
    
    def detect_all(self, prices_df: pd.DataFrame, timeframe: str) -> list[dict]:
        """Escanea las últimas velas buscando patrones válidos."""
        detected = []
        candles = prices_df.tail(5).to_dict("records")  # Últimas 5 velas
        
        curr = candles[-1]
        prev = candles[-2] if len(candles) >= 2 else None
        
        # Pin Bars
        if self.detect_pin_bar(curr, "LONG"):
            detected.append({"pattern": "bullish_pin_bar", **self.PATTERNS["bullish_pin_bar"]})
        if self.detect_pin_bar(curr, "SHORT"):
            detected.append({"pattern": "bearish_pin_bar", **self.PATTERNS["bearish_pin_bar"]})
        
        # Engulfing
        if prev:
            if self.detect_engulfing(prev, curr, "LONG"):
                detected.append({"pattern": "bullish_engulfing", **self.PATTERNS["bullish_engulfing"]})
            if self.detect_engulfing(prev, curr, "SHORT"):
                detected.append({"pattern": "bearish_engulfing", **self.PATTERNS["bearish_engulfing"]})
        
        # Hammer: cuerpo pequeño arriba, mecha inferior larga, mecha superior mínima
        body = abs(curr["close"] - curr["open"])
        lower_wick = min(curr["close"], curr["open"]) - curr["low"]
        upper_wick = curr["high"] - max(curr["close"], curr["open"])
        if body > 0 and lower_wick >= body * 2 and upper_wick <= body * 0.3:
            detected.append({"pattern": "hammer", **self.PATTERNS["hammer"]})
        
        # Shooting Star: opuesto al hammer
        if body > 0 and upper_wick >= body * 2 and lower_wick <= body * 0.3:
            detected.append({"pattern": "shooting_star", **self.PATTERNS["shooting_star"]})
        
        # Doji: cuerpo muy pequeño vs rango total
        total_range = curr["high"] - curr["low"]
        if total_range > 0 and body / total_range < 0.1:
            detected.append({"pattern": "doji", **self.PATTERNS["doji"]})
        
        return detected
```

---

## 🔗 NUEVA CAPA: Detección de Setups

### El sistema actual solo da dirección. Los setups dan CONTEXTO.

```python
class SetupDetector:
    """
    Identifica el TIPO de oportunidad de trading.
    Esto cambia la gestión del trade y los niveles de TP/SL.
    """
    
    def detect(self, timeframe: str, trend: str, 
               price: float, levels: list, fibs: dict,
               indicators: dict) -> list[Setup]:
        
        setups = []
        
        # SETUP 1: TREND PULLBACK
        # Precio retrocede a zona de valor en tendencia establecida
        if trend in ["bullish", "strong_bullish"]:
            pullback_zone = self._find_pullback_zone(price, levels, fibs, "LONG")
            if pullback_zone:
                setups.append(Setup(
                    type="pullback",
                    direction="LONG",
                    entry_zone=pullback_zone,
                    description=f"Pullback a {pullback_zone['name']} en tendencia alcista",
                    reliability="high",
                ))
        
        # SETUP 2: BREAKOUT
        # Precio rompe nivel importante con volumen
        breakout = self._detect_breakout(price, levels, indicators)
        if breakout:
            setups.append(Setup(
                type="breakout",
                direction=breakout["direction"],
                entry_zone=breakout["zone"],
                description=f"Breakout de {breakout['level_name']}",
                reliability="medium",
            ))
        
        # SETUP 3: REVERSAL
        # Señales de agotamiento en extremos
        reversal = self._detect_reversal(price, levels, fibs, indicators)
        if reversal:
            setups.append(Setup(
                type="reversal",
                direction=reversal["direction"],
                entry_zone=reversal["zone"],
                description=f"Reversal en {reversal['level_name']}",
                reliability="low",  # Siempre menor fiabilidad
            ))
        
        return setups
    
    def _find_pullback_zone(self, price, levels, fibs, direction):
        """
        ¿Está el precio en una zona de valor para entrar con la tendencia?
        
        Orden de prioridad:
        1. Golden Pocket (Fib 0.618-0.65) + Gran Nivel = PERFECT
        2. Confluencia Fib multi-TF = EXCELLENT
        3. Gran Soporte/Resistencia solo = GOOD
        4. Fib level + EMA = DECENT
        5. Solo Fib level = MINIMUM
        """
        for zone_type, checker in [
            ("golden_pocket_plus_level", self._check_golden_pocket_at_level),
            ("fib_multi_tf_confluence", self._check_fib_confluence),
            ("gran_nivel", self._check_at_gran_nivel),
            ("fib_plus_ema", self._check_fib_plus_ema),
            ("fib_only", self._check_at_fib_level),
        ]:
            result = checker(price, levels, fibs, direction)
            if result:
                result["zone_type"] = zone_type
                return result
        return None
```

---

## 📊 Sistema de Scoring Extendido

### Cómo se integra con los 9 indicadores existentes

```python
class ExtendedSignalScorer:
    """
    EXTIENDE (no reemplaza) el scoring actual.
    
    El sistema actual calcula:
      totalScore = Σ(peso[i] × score[señal[i]]) → rango -1 a +1
      confianza = |totalScore| × 100 → 0 a 100
    
    El scoring extendido SUMA bonus y penalizaciones:
    """
    
    # BONUS POR NIVELES (máx +20 puntos sobre la confianza)
    LEVEL_BONUSES = {
        "at_gran_nivel":               +8,   # Precio en Gran S/R (strength >= 10)
        "fib_golden_pocket":           +7,   # En Golden Pocket (0.618-0.65)
        "multi_tf_fib_confluence":     +6,   # Fib de 2+ TFs coinciden
        "level_plus_fib":              +5,   # Gran S/R + Fib en misma zona
        "at_ema_key":                  +3,   # En EMA 21/50/200
        "psychological_level":         +1,   # En número redondo
        "role_flip_level":             +4,   # En nivel de cambio de rol S↔R
    }
    # Nota: No se suman todos. Máximo +20 del mejor combo.
    
    # BONUS POR VELAS (máx +10 puntos)
    CANDLE_BONUSES = {
        "strong_pattern_at_level":     +8,   # Patrón fuerte EN un Gran Nivel
        "moderate_pattern_at_level":   +5,   # Patrón moderado en nivel
        "strong_pattern_no_level":     +4,   # Patrón fuerte pero sin nivel claro
        "volume_confirms_pattern":     +2,   # Volumen > SMA20 en la vela
    }
    # Máximo +10 del mejor combo.
    
    # BONUS ON-CHAIN (para 4H+, máx +10 puntos)
    # Ya parcialmente implementado via HASH_RATE_MOM y NVT_RATIO en los 9 indicadores.
    # Estos son EXTRAS para condiciones extremas:
    ONCHAIN_BONUSES = {
        "fear_extreme_long":           +4,   # F&G < 20 + dirección LONG
        "greed_extreme_short":         +4,   # F&G > 80 + dirección SHORT
        "funding_contrarian":          +3,   # Funding Rate extremo en dirección contraria
        "oi_low_organic":              +3,   # OI bajo → movimiento más orgánico
    }
    # Máximo +10.
    
    # PENALIZACIONES (máx -15 puntos)
    PENALTIES = {
        "no_clear_level":              -5,   # No hay nivel significativo cerca
        "against_htf_trend":           -8,   # Contra tendencia del TF superior
        "overextended_from_ema":       -5,   # Precio muy lejos de EMAs (>5%)
        "low_volume":                  -3,   # Volumen < 0.7× SMA20
        "contradicting_onchain":       -5,   # On-chain dice lo contrario
    }
    
    def calculate_extended_score(self, 
                                 base_confidence: float,  # 0-100 del sistema actual
                                 price: float,
                                 direction: str,
                                 timeframe: str,
                                 levels: list,
                                 fibs: dict,
                                 candle_patterns: list,
                                 onchain: dict) -> dict:
        
        bonus_levels = self._calc_level_bonus(price, direction, levels, fibs)
        bonus_candles = self._calc_candle_bonus(candle_patterns, price, levels, direction)
        bonus_onchain = self._calc_onchain_bonus(onchain, direction, timeframe)
        penalties = self._calc_penalties(price, direction, timeframe, levels)
        
        # Clamp bonuses
        bonus_levels = min(bonus_levels, 20)
        bonus_candles = min(bonus_candles, 10)
        bonus_onchain = min(bonus_onchain, 10)
        penalties = max(penalties, -15)
        
        extended_score = base_confidence + bonus_levels + bonus_candles + bonus_onchain + penalties
        final_score = max(0, min(100, extended_score))  # Clamp 0-100
        
        return {
            "base_confidence": base_confidence,
            "bonus_levels": bonus_levels,
            "bonus_candles": bonus_candles,
            "bonus_onchain": bonus_onchain,
            "penalties": penalties,
            "final_score": final_score,
            "classification": self._classify(final_score),
        }
    
    def _classify(self, score: int) -> str:
        if score >= 85: return "⭐⭐⭐ PREMIUM"
        if score >= 70: return "⭐⭐ FUERTE"
        if score >= 55: return "⭐ VÁLIDA"
        if score >= 40: return "⚠️ DÉBIL"
        return "❌ RECHAZADA"
```

---

## 🛑 TP/SL Mejorado

### Cómo mejora el cálculo actual

El sistema actual usa: ATR × multiplicador + Bollinger como fallback.
Ahora se añade una CAPA DE NIVELES encima:

```python
class EnhancedTPSL:
    """
    EXTIENDE el cálculo actual de TP/SL.
    
    Prioridad para SL (LONG):
    1. Gran Soporte debajo + buffer ATR (si está dentro del % máximo)
    2. Fib 0.786 + buffer ATR
    3. Swing Low + buffer ATR
    4. [Fallback actual] BB Lower o ATR × mult
    
    Prioridad para TP1 (LONG):
    1. Fib Extension que coincide con Gran Resistencia (CONFLUENCIA)
    2. Gran Resistencia más cercana (strength >= 10)
    3. Zona confluencia Fib multi-TF
    4. Swing High anterior
    5. [Fallback actual] BB Mid o ATR × mult
    
    Prioridad para TP2 (LONG):
    1. Fib 1.618 que coincide con Gran Resistencia
    2. Siguiente Gran Resistencia más allá de TP1
    3. Fib 1.618 (Golden Extension)
    4. [Fallback actual] BB Upper o ATR × mult
    """
    
    ATR_BUFFER = {"1H": 1.0, "4H": 1.5, "1D": 2.0, "1W": 2.5}
    
    MAX_SL_PERCENT = {"1H": 2.0, "4H": 4.0, "1D": 7.0, "1W": 12.0}
    
    MIN_RR_TP1 = {"1H": 1.2, "4H": 1.5, "1D": 1.5, "1W": 2.0}
    MIN_RR_TP2 = {"1H": 2.0, "4H": 2.5, "1D": 3.0, "1W": 4.0}
    
    def calculate(self, entry: float, direction: str, timeframe: str,
                  atr: float, bb: dict, sma200: float,
                  levels: list, fibs: dict, swing_points: list) -> dict:
        
        # === STOP LOSS ===
        sl = self._calculate_sl(entry, direction, timeframe, atr, bb, sma200,
                                levels, fibs, swing_points)
        
        # Validar SL no excede máximo
        sl_pct = abs(entry - sl) / entry * 100
        if sl_pct > self.MAX_SL_PERCENT[timeframe]:
            return {"valid": False, "reason": f"SL {sl_pct:.1f}% > máx {self.MAX_SL_PERCENT[timeframe]}%"}
        
        risk = abs(entry - sl)
        
        # === TAKE PROFIT 1 ===
        tp1 = self._calculate_tp1(entry, direction, timeframe, risk, atr, bb,
                                   levels, fibs, swing_points)
        
        # Validar R:R mínimo TP1
        rr1 = abs(tp1 - entry) / risk
        if rr1 < self.MIN_RR_TP1[timeframe]:
            # Intentar fallback
            tp1 = entry + risk * self.MIN_RR_TP1[timeframe] if direction == "LONG" \
                  else entry - risk * self.MIN_RR_TP1[timeframe]
        
        # === TAKE PROFIT 2 ===
        tp2 = self._calculate_tp2(entry, direction, timeframe, risk, atr, bb,
                                   levels, fibs, swing_points, tp1)
        
        rr1_final = abs(tp1 - entry) / risk
        rr2_final = abs(tp2 - entry) / risk
        
        return {
            "valid": True,
            "sl": round(sl, 2),
            "tp1": round(tp1, 2),
            "tp2": round(tp2, 2),
            "sl_pct": round(sl_pct, 2),
            "tp1_pct": round(abs(tp1 - entry) / entry * 100, 2),
            "tp2_pct": round(abs(tp2 - entry) / entry * 100, 2),
            "rr_tp1": round(rr1_final, 2),
            "rr_tp2": round(rr2_final, 2),
            "sl_method": self._last_sl_method,
            "tp1_method": self._last_tp1_method,
            "tp2_method": self._last_tp2_method,
        }
    
    def _calculate_sl(self, entry, direction, timeframe, atr, bb, sma200,
                      levels, fibs, swing_points):
        buffer = atr * self.ATR_BUFFER[timeframe]
        candidates = []
        
        if direction == "LONG":
            # Candidato 1: Gran Soporte debajo
            gran_soportes = [l for l in levels 
                           if l.type == "support" and l.price < entry and l.strength >= 10]
            if gran_soportes:
                best = max(gran_soportes, key=lambda l: l.price)  # El más cercano debajo
                candidates.append(("gran_soporte", best.price - buffer))
            
            # Candidato 2: Fibonacci 0.786
            if fibs and "retracements" in fibs:
                fib_786 = next((f for f in fibs["retracements"] if f["ratio"] == 0.786), None)
                if fib_786 and fib_786["price"] < entry:
                    candidates.append(("fib_0786", fib_786["price"] - buffer))
            
            # Candidato 3: Swing Low
            recent_lows = [s for s in swing_points if s.type == "low" and s.price < entry]
            if recent_lows:
                nearest_low = max(recent_lows, key=lambda s: s.price)
                candidates.append(("swing_low", nearest_low.price - buffer))
            
            # Candidato 4: Fallback actual (BB Lower o ATR)
            if bb and bb.get("lower") and bb["lower"] < entry:
                candidates.append(("bb_lower", bb["lower"] - buffer * 0.5))
            candidates.append(("atr_fallback", entry - atr * self.ATR_BUFFER[timeframe] * 1.5))
        
        # Elegir: el candidato más cercano al entry (menos riesgo) que siga siendo lógico
        if candidates:
            # Filtrar los que están dentro del SL máximo
            max_sl = entry * (1 - self.MAX_SL_PERCENT[timeframe] / 100) if direction == "LONG" \
                     else entry * (1 + self.MAX_SL_PERCENT[timeframe] / 100)
            
            valid = [c for c in candidates 
                    if (direction == "LONG" and c[1] >= max_sl) or
                       (direction == "SHORT" and c[1] <= max_sl)]
            
            if valid:
                best = max(valid, key=lambda c: c[1]) if direction == "LONG" \
                       else min(valid, key=lambda c: c[1])
                self._last_sl_method = best[0]
                return best[1]
        
        # Ultimate fallback
        self._last_sl_method = "atr_fallback"
        return entry - atr * self.ATR_BUFFER[timeframe] * 1.5 if direction == "LONG" \
               else entry + atr * self.ATR_BUFFER[timeframe] * 1.5
```

---

## 🗄️ Nuevas Tablas Supabase

### Migration 004: Niveles y Fibonacci

```sql
-- Niveles de precio detectados automáticamente
CREATE TABLE IF NOT EXISTS price_levels (
    id              SERIAL PRIMARY KEY,
    price           DECIMAL(12,2) NOT NULL,
    price_low       DECIMAL(12,2),
    price_high      DECIMAL(12,2),
    type            VARCHAR(20) NOT NULL,          -- support, resistance
    strength        SMALLINT CHECK (strength BETWEEN 0 AND 20),
    classification  VARCHAR(20),                   -- critical, strong, moderate, weak
    source          TEXT[],                         -- swing, volume, psychological, fib, role_flip
    timeframes      VARCHAR(5)[],
    touch_count     SMALLINT DEFAULT 0,
    last_touch_date DATE,
    fib_level       DECIMAL(5,3),                  -- Si coincide con Fib (0.618, etc)
    is_role_flip    BOOLEAN DEFAULT FALSE,
    is_psychological BOOLEAN DEFAULT FALSE,
    is_high_volume  BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) DEFAULT 'active',   -- active, broken, retesting
    broken_at       TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_levels_price ON price_levels(price);
CREATE INDEX idx_levels_strength ON price_levels(strength DESC);
CREATE INDEX idx_levels_status ON price_levels(status);

-- Niveles Fibonacci por timeframe
CREATE TABLE IF NOT EXISTS fibonacci_levels (
    id              SERIAL PRIMARY KEY,
    timeframe       VARCHAR(5) NOT NULL,
    type            VARCHAR(20) NOT NULL,           -- retracement, extension
    direction       VARCHAR(5) NOT NULL,            -- LONG, SHORT
    swing_low       DECIMAL(12,2) NOT NULL,
    swing_high      DECIMAL(12,2) NOT NULL,
    swing_low_date  DATE,
    swing_high_date DATE,
    pullback_end    DECIMAL(12,2),
    levels          JSONB NOT NULL,                  -- Todos los ratios y precios
    status          VARCHAR(20) DEFAULT 'active',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fib_tf ON fibonacci_levels(timeframe);
CREATE INDEX idx_fib_status ON fibonacci_levels(status);

-- Zonas de confluencia (multi-TF Fibonacci + S/R)
CREATE TABLE IF NOT EXISTS confluence_zones (
    id              SERIAL PRIMARY KEY,
    price_low       DECIMAL(12,2) NOT NULL,
    price_high      DECIMAL(12,2) NOT NULL,
    price_mid       DECIMAL(12,2) NOT NULL,
    type            VARCHAR(20) NOT NULL,            -- support, resistance
    timeframes      VARCHAR(5)[] NOT NULL,
    fib_ratios      DECIMAL(5,3)[],
    num_timeframes  SMALLINT,
    strength        SMALLINT,
    has_gran_nivel  BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) DEFAULT 'active',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conf_price ON confluence_zones(price_mid);
CREATE INDEX idx_conf_strength ON confluence_zones(strength DESC);

-- Extender signal_history con info de niveles y setup
ALTER TABLE signal_history 
    ADD COLUMN IF NOT EXISTS setup_type VARCHAR(50),            -- pullback, breakout, reversal
    ADD COLUMN IF NOT EXISTS sl_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tp1_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tp2_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS level_score SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS candle_pattern VARCHAR(50),
    ADD COLUMN IF NOT EXISTS candle_score SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS onchain_bonus SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS extended_score SMALLINT,
    ADD COLUMN IF NOT EXISTS nearby_levels JSONB,               -- Niveles relevantes al momento
    ADD COLUMN IF NOT EXISTS fib_context JSONB;                 -- Fibonacci relevante al momento

-- RLS (misma política que las demás tablas)
ALTER TABLE price_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE fibonacci_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE confluence_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_levels_public_read" ON price_levels FOR SELECT USING (true);
CREATE POLICY "fibonacci_levels_public_read" ON fibonacci_levels FOR SELECT USING (true);
CREATE POLICY "confluence_zones_public_read" ON confluence_zones FOR SELECT USING (true);
```

---

## 📁 Archivos Nuevos

```
backend/btc_intel/
├── trading/                          # ← NUEVO directorio
│   ├── __init__.py
│   ├── levels/
│   │   ├── __init__.py
│   │   ├── swing_detector.py        # Detecta Swing H/L multi-TF
│   │   ├── volume_zones.py          # Zonas de alto volumen
│   │   ├── psychological.py         # Niveles psicológicos
│   │   ├── role_flip.py             # Detección cambio de rol S↔R
│   │   ├── level_scorer.py          # Puntuación 0-20 por nivel
│   │   ├── zone_clusterer.py        # Agrupa niveles en zonas
│   │   └── level_manager.py         # CRUD + scan completo
│   ├── fibonacci/
│   │   ├── __init__.py
│   │   ├── fibonacci_engine.py      # Retrocesos + Extensiones
│   │   ├── swing_finder.py          # Swings significativos para Fib
│   │   └── confluence_detector.py   # Confluencia multi-TF
│   ├── candle_patterns.py           # Detección de 12 patrones
│   ├── setup_detector.py            # Pullback, Breakout, Reversal
│   ├── extended_scorer.py           # Bonus/Penalties sobre score base
│   └── enhanced_tpsl.py             # TP/SL con niveles + Fib

frontend/src/
├── components/trading/               # ← ACTUALIZAR página existente
│   ├── LevelMap.tsx                  # Mapa visual de niveles arriba/abajo
│   ├── FibonacciOverlay.tsx          # Overlay Fib en gráfico de precio
│   ├── ConfluenceZones.tsx           # Zonas de confluencia destacadas
│   ├── CandlePatternBadge.tsx        # Badge del patrón detectado
│   └── SetupTypeBadge.tsx            # Badge tipo de setup
```

---

## 🖥️ CLI Nuevos Comandos

```bash
# NIVELES
btc-intel levels scan                        # Recalcula todos los niveles
btc-intel levels list                        # Lista niveles activos con score
btc-intel levels list --min-strength 10      # Solo Grandes Niveles
btc-intel levels map                         # Mapa visual: niveles arriba/abajo del precio

# FIBONACCI
btc-intel fib scan                           # Recalcula Fibonacci todos los TFs
btc-intel fib show --tf 1D                   # Muestra niveles Fib del Daily
btc-intel fib confluences                    # Zonas de confluencia multi-TF

# ANÁLISIS EXTENDIDO (se integra con analyze full)
btc-intel analyze full                       # Ahora TAMBIÉN ejecuta levels scan + fib scan
btc-intel analyze levels                     # Solo motor de niveles
btc-intel analyze fib                        # Solo Fibonacci
```

---

## 🖥️ Dashboard — Cambios en Página Trading

### Nuevos elementos a AÑADIR (no reemplazar):

**1. Mapa de Niveles (debajo del gráfico de precio)**
```
$108,500 ─── 🔴 ATH (16/20)
$105,000 ─── 🔴 Fib 1.618(4H) + Gran Resistencia (18/20) ← TP2
$102,500 ─── 🟠 Swing High 1D + Fib 1.0(4H) (12/20) ← TP1
$100,000 ─── 🟡 Psicológico (6/20)
         ═══ ▸▸▸ $98,000 PRECIO ACTUAL ◂◂◂
 $97,500 ─── 🔴 Golden Pocket(1D) + Gran Soporte + Fib(1W) (17/20)
 $95,000 ─── 🟡 EMA 50 (8/20)
 $92,000 ─── 🟠 Soporte multi-TF (11/20)
 $90,000 ─── 🟠 Psicológico + EMA 200 (13/20)
```

**2. Badge de setup en cada tarjeta de timeframe**
```
4H LONG (73% confianza) → "Pullback al Golden Pocket" + Badge "⭐⭐ FUERTE"
```

**3. Badge de patrón de vela**
```
🕯️ Bullish Engulfing detectado en soporte (+8 bonus)
```

**4. Desglose extendido del score**
```
Score base (9 indicadores):  63
+ Bonus niveles:            +15 (Golden Pocket + Gran Soporte)
+ Bonus velas:               +8 (Bullish Engulfing en nivel)
+ Bonus on-chain:            +4 (Fear < 25, funding contrarian)
- Penalización:               0
───────────────────────────
Score final:                 90 → ⭐⭐⭐ PREMIUM
```

---

## 📊 Ejemplo Completo de Señal v2

```
═══════════════════════════════════════════════════════════════
📊 SEÑAL BTC/USD — 4H LONG
═══════════════════════════════════════════════════════════════

  Setup:        Trend Pullback → Golden Pocket + Gran Soporte
  Score:        87/100 ⭐⭐ FUERTE

  ┌──────────────────────────────────────────────────────────┐
  │  TP2   $105,000  (+7.1%)   R:R 1:1.6                   │
  │        Fib Ext 1.618(4H) + Gran Resistencia (16/20)     │
  │                                                          │
  │  TP1   $102,500  (+4.6%)   R:R 1:1.0                   │
  │        Swing High 1D + Fib Ext 1.0(4H)                 │
  │                                                          │
  │  ▸▸▸   $98,000   ENTRY                                 │
  │                                                          │
  │  SL    $93,700   (-4.4%)                                │
  │        Gran Soporte $94,500 - 1.5×ATR buffer            │
  └──────────────────────────────────────────────────────────┘

  📍 ZONA DE ENTRADA:
  ✅ Fib Golden Pocket 0.618(1D) = $97,800
  ✅ Gran Soporte: $97,500 (14/20, 4 toques, visible en 4H+1D+1W)
  ✅ Fib 0.382(1W) = $98,100 ← Confluencia multi-TF
  ✅ EMA 21(1D) = $97,900
  → ZONA CONFLUENCIA: $97,500 - $98,100 (4 niveles alineados)

  📈 INDICADORES (9 del sistema actual):
  RSI: 45 → bullish (subiendo desde 38)          [peso 4H: 20%]
  MACD: Cruce alcista inminente                   [peso 4H: 20%]
  SMA_CROSS: Positivo (golden cross activo)       [peso 4H: 10%]
  BB: Precio en zona baja, squeeze formándose     [peso 4H: 10%]
  EMA_21: Precio en EMA (0% distancia)            [peso 4H: 15%]
  F&G: 32 → bullish (miedo moderado)              [peso 4H: 15%]
  HR_MOM: +5.2% → bullish                         [peso 4H:  5%]
  NVT: 68 → neutral                               [peso 4H:  5%]
  CYCLE: 48 (Mid Bull) → neutral                  [peso 4H:  0%]
  Base confidence: 63%

  🕯️ PATRÓN DETECTADO: Bullish Engulfing en zona de confluencia

  📊 DESGLOSE SCORE EXTENDIDO:
  Base (9 indicadores):      63
  + Niveles (Golden Pocket + Gran Soporte + Fib confluence): +15
  + Velas (Engulfing en nivel + volumen):                     +8
  + On-chain (Fear moderate):                                 +4
  - Penalizaciones:                                            0
  ─────────────────────────────────
  SCORE FINAL:               90 → ⭐⭐⭐ PREMIUM

  🎯 GESTIÓN:
  Cerrar 50% en TP1 ($102,500)
  Mover SL a breakeven ($98,000)
  Cerrar 50% restante en TP2 ($105,000)

═══════════════════════════════════════════════════════════════
```

---

## ⚠️ Problema conocido del backtesting

El PRD menciona: "Usa `date` en vez de `datetime` para evaluar, causando
que evaluaciones 1H/4H comparen con el mismo día."

**Fix recomendado:** Cambiar `signal_history.date` a `TIMESTAMPTZ` y evaluar
señales 1H contra el precio 1 hora después, 4H contra 4 horas después, etc.

---

## 🔄 Integración con `analyze full`

El comando `analyze full` actual ejecuta:
```
technical → onchain → macro → sentiment → cycles → risk → 
cycle-score → derivatives → alertas → backtesting
```

Con el módulo v2 se añade al final:
```
... → levels scan → fib scan → confluence detect
```

Los resultados de niveles/fib se persisten en Supabase y los usa
el frontend para mostrar el mapa de niveles y la página Trading
mejorada con setups, patrones y score extendido.

---

## ⚠️ Disclaimers

- No es consejo financiero
- No ejecuta operaciones automáticamente
- Las señales son probabilísticas, no garantías
- Siempre gestionar riesgo: máximo 1-2% del capital por operación
- El rendimiento pasado no garantiza resultados futuros
