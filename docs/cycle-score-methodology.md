# Metodologia del Cycle Score

## Que es el Cycle Score

El Cycle Score es un indicador compuesto propietario que condensa multiples metricas en un unico numero entre 0 y 100, indicando la posicion actual de Bitcoin en su ciclo de mercado.

- **0** = Bottom absoluto / maxima oportunidad de compra
- **100** = Top absoluto / maximo riesgo

## Fases del ciclo

```
  0 ──────── 15 ──── 30 ──── 45 ──── 60 ──── 75 ──── 85 ──── 100
  │CAPITULAC.│ ACUM  │ EARLY │  MID  │ LATE  │ DIST  │EUFORIA│
  │  Compra  │ Ideal │ Bueno │Cautela│Cuidado│Reducir│ Salir │
  │historica │       │       │       │       │       │       │
```

| Fase | Rango | Significado |
|------|-------|-------------|
| Capitulacion | 0-14 | Bottom probable. Maxima oportunidad. |
| Acumulacion | 15-29 | Zona ideal de entrada. Smart money comprando. |
| Early Bull | 30-44 | Inicio de tendencia alcista. Buena entrada. |
| Mid Bull | 45-59 | Tendencia establecida. Cautela creciente. |
| Late Bull | 60-74 | Fase avanzada. Tomar beneficios parciales. |
| Distribucion | 75-84 | Top acercandose. Reducir exposicion. |
| Euforia | 85-100 | Top probable. Maximo riesgo. |

## Componentes y pesos

### 1. SMA Position (20%)
Mide la distancia entre SMA 50 y SMA 200 (Golden Cross / Death Cross).

- **Input:** Campo `SMA_CROSS` de technical_indicators
- **Normalizacion:** -20000 = 0, 0 = 50, +20000 = 100
- **Logica:** Valores positivos (golden cross) indican mercado alcista

### 2. Price Position (20%)
Posicion del precio actual en el rango ciclo low - ATH.

- **Input:** Precios historicos desde el halving anterior
- **Normalizacion:** Ciclo low = 0, ATH = 100
- **Logica:** Cuanto mas cerca del ATH, mayor el score

### 3. Halving Position (15%)
Dias transcurridos desde el ultimo halving.

- **Input:** Fecha del ultimo halving (20 abril 2024)
- **Normalizacion:** 0 dias = 0, 1460 dias (4 anos) = 100
- **Logica:** Los tops historicos ocurren ~500-600 dias post-halving

### 4. RSI Mensual (10%)
RSI de 14 periodos sobre datos diarios.

- **Input:** Campo `RSI_14` de technical_indicators
- **Normalizacion:** Valor directo (ya esta en 0-100)
- **Logica:** RSI > 70 = sobrecompra, RSI < 30 = sobreventa

### 5. Hash Rate Momentum (10%)
Cambio porcentual del hash rate en 30 dias. Proxy de salud de la red.

- **Input:** Campo `HASH_RATE_MOM_30D` de onchain_metrics
- **Normalizacion:** -25% = 0, 0% = 50, +25% = 100
- **Logica:** Hash rate creciente = red saludable = alcista

### 6. Fear & Greed (5%)
Indice Fear & Greed actual.

- **Input:** Campo `FEAR_GREED` de sentiment_data
- **Normalizacion:** Valor directo (ya esta en 0-100)
- **Logica:** Extreme Greed = cautela, Extreme Fear = oportunidad

### 7. Fear & Greed 30D (5%)
Media movil 30 dias del Fear & Greed.

- **Input:** Campo `FEAR_GREED_30D` de sentiment_data
- **Normalizacion:** Valor directo
- **Logica:** Suaviza el ruido del F&G diario

## Calculo

```python
# Pseudocodigo
score = 0
total_weight = 0

for component_name, weight in WEIGHTS.items():
    if component_name in available_components:
        score += components[component_name] * weight
        total_weight += weight

# Normalizar si faltan componentes
if total_weight > 0:
    score = score / total_weight

# Clamp 0-100
score = max(0, min(100, round(score)))
```

**Nota:** Si algun componente no esta disponible (por falta de datos), el score se normaliza automaticamente distribuyendo el peso restante entre los componentes disponibles.

## Limitaciones

1. **No es predictivo** — Indica DONDE estamos en el ciclo, no DONDE iremos
2. **Depende de datos disponibles** — Sin datos on-chain avanzados (MVRV, SOPR), usa proxies
3. **Sesgo de halving** — Asume ciclos de ~4 anos basados en halvings
4. **Sin datos de exchange flows** — Usa hash rate momentum como proxy
5. **Sin Google Trends** — Usa Fear & Greed 30D como proxy de FOMO retail

## Historico de accuracy

El Cycle Score se auto-valida mediante el sistema de conclusiones:
- Cada conclusion registrada incluye el Cycle Score del momento
- Al validar conclusiones retroactivamente, se puede medir la accuracy
- Comando: `btc-intel conclude --score`

## Implementacion

Ver: `backend/btc_intel/analysis/cycle_score.py`
