# PRD — BTC Intelligence Hub v1.0

> Sistema de inteligencia Bitcoin automatizado que recopila datos de 5 fuentes, calcula 25+ indicadores, genera señales de trading ponderadas por timeframe, y presenta todo en un dashboard de 14 páginas con i18n ES/EN.

**URL**: https://btc-intel.franmilla.com
**Repo**: github.com/virtualidadreal/btc-intelligence-hub
**Coste mensual**: $0 (100% free tier)

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                   GITHUB ACTIONS                          │
│  Hourly: update-data + analyze full (cron: 5 * * * *)   │
│  Daily:  ai-report (cron: 0 8 * * * UTC)                │
└──────────────┬───────────────────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────────┐
│                    SUPABASE (schema: btc_hub)             │
│  13 tablas · PostgreSQL · RLS public read                │
└──────────────┬───────────────────┬───────────────────────┘
               ▲                   ▼
     ┌─────────┘                   └──────────┐
     │                                         │
┌────────────────┐                  ┌──────────────────────┐
│ BACKEND        │                  │ FRONTEND (Vercel)    │
│ Python 3.12    │                  │ React 19 + TS + Vite │
│ CLI: btc-intel │                  │ Recharts + Tailwind  │
│ (Typer + Rich) │                  │ Binance WebSocket    │
└────────────────┘                  └──────────────────────┘
```

---

## 1. Fuentes de Datos Externas

| # | Fuente | API | Datos | Tabla destino | Auth |
|---|--------|-----|-------|---------------|------|
| 1 | **Yahoo Finance** | yfinance lib | BTC-USD OHLCV diario (desde 2014) | `btc_prices` | No |
| 2 | **Yahoo Finance** | yfinance lib | SPX, GOLD, DXY, US_10Y | `macro_data` | No |
| 3 | **FRED** | fredapi lib | FED_RATE, M2 | `macro_data` | API key |
| 4 | **Blockchain.com** | REST API | HASH_RATE, ACTIVE_ADDRESSES, TRANSACTION_COUNT, MARKET_CAP, MINERS_REVENUE, DIFFICULTY | `onchain_metrics` | No |
| 5 | **Blockchain.com** | Calculado | NVT_RATIO = MARKET_CAP / TRANSACTION_COUNT | `onchain_metrics` | No |
| 6 | **Alternative.me** | REST API | Fear & Greed Index | `sentiment_data` | No |
| 7 | **Google Trends** | pytrends lib | Keyword "bitcoin" | `sentiment_data` | No |
| 8 | **OKX** | REST API pública | FUNDING_RATE, OPEN_INTEREST | `onchain_metrics` | No |
| 9 | **Binance** | WebSocket (frontend) | Precio BTC en tiempo real | Solo memoria (no persiste) | No |

---

## 2. Base de Datos — 13 Tablas

### Tablas principales (Migration 001)

| Tabla | Unique | Filas aprox | Contenido |
|-------|--------|-------------|-----------|
| `btc_prices` | `date` | ~4,200 | OHLCV diario desde 2014 |
| `technical_indicators` | `date, indicator` | ~37,000 | RSI, MACD, SMA, EMA, BB, ATR + 12 correlaciones macro |
| `onchain_metrics` | `date, metric` | ~11,000 | 6 métricas blockchain + NVT + derivatives |
| `macro_data` | `date, asset` | ~14,000 | 6 activos macro |
| `sentiment_data` | `date, metric` | ~6,000 | Fear & Greed + Google Trends |
| `cycles` | — | 10 | 4 halvings + 3 bulls + 3 bears (seed) |
| `events` | — | 24 | Eventos históricos curados (seed) |
| `alerts` | — | variable | Alertas automáticas (cycle score extremo, patrones) |
| `conclusions` | — | variable | Diario de inteligencia con versionado |
| `cycle_score_history` | `date` | ~diario | Score compuesto 0-100 |
| `reports` | — | variable | Informes generados (sistema + AI) |

### Tablas adicionales (Migrations 002-003)

| Tabla | Unique | Contenido |
|-------|--------|-----------|
| `signal_history` | `date, timeframe` | Snapshots de señales + evaluación |
| `portfolio_positions` | — | Posiciones abiertas/cerradas con PnL |

---

## 3. Backend — Motor de Análisis

### 3.1 Indicadores Técnicos (`analyze technical`)

Calcula desde `btc_prices` y escribe a `technical_indicators`:

| Indicador | Parámetros | Clasificación |
|-----------|------------|---------------|
| RSI_14 | periodo=14 | >80 extreme_bearish, >70 bearish, >55 bullish, >45 neutral, >30 bearish, <=30 extreme_bullish |
| MACD | 12/26/9 | macd > signal + hist > 0 = bullish; opuesto = bearish |
| MACD_SIGNAL | — | Misma señal que MACD |
| MACD_HIST | — | Misma señal que MACD |
| SMA_50 | periodo=50 | neutral (valor crudo) |
| SMA_200 | periodo=200 | neutral (valor crudo) |
| SMA_CROSS | SMA50-SMA200 | ratio >0.05 = golden cross, <-0.05 = death cross |
| EMA_21 | periodo=21 | neutral (valor crudo) |
| BB_UPPER/MID/LOWER | 20, std=2 | Posición del precio en bandas (0-1 normalizado) |
| ATR_14 | periodo=14 | neutral (valor crudo, usado para TP/SL) |

### 3.2 Análisis On-Chain (`analyze onchain`)

| Métrica derivada | Fuente | Señal |
|-----------------|--------|-------|
| HASH_RATE_MOM_30D | pct_change(HASH_RATE, 30d) | >10% bullish, >2% bullish, <-2% bearish, <-10% extreme_bearish |
| NVT_RATIO señal | valor NVT existente | >150 bearish, >100 bearish, >50 neutral, >25 bullish, <=25 extreme_bullish |

### 3.3 Derivados (`analyze derivatives`)

| Métrica | Fuente | Señal (lógica contrarian) |
|---------|--------|--------------------------|
| FUNDING_RATE | OKX | >0.1% extreme_bearish (todos long), <-0.05% extreme_bullish (todos short) |
| OPEN_INTEREST | OKX vs media 30d | >20% por encima = bearish (riesgo liquidaciones), <-20% = bullish (mercado orgánico) |

### 3.4 Correlaciones Macro (`analyze macro`)

Calcula correlación rolling de retornos diarios BTC vs cada activo:

| Par | Ventanas | Almacenado como |
|-----|----------|-----------------|
| BTC vs SPX | 30d, 90d, 365d | CORR_BTC_SPX_30D/90D/365D |
| BTC vs GOLD | 30d, 90d, 365d | CORR_BTC_GOLD_30D/90D/365D |
| BTC vs DXY | 30d, 90d, 365d | CORR_BTC_DXY_30D/90D/365D |
| BTC vs US_10Y | 30d, 90d, 365d | CORR_BTC_US_10Y_30D/90D/365D |

### 3.5 Sentimiento (`analyze sentiment`)

| Métrica | Cálculo | Señal |
|---------|---------|-------|
| FEAR_GREED_30D | Media móvil 30d del Fear & Greed | >80 extreme_bearish, >60 bearish, >40 neutral, >20 bullish, <=20 extreme_bullish |

### 3.6 Ciclos (`analyze cycles`)

- Halvings hardcoded: 2012-11-28, 2016-07-09, 2020-05-11, 2024-04-20
- Calcula: días desde halving, ROI desde halving
- Compara posición actual (día N del ciclo) con ciclos anteriores

### 3.7 Riesgo (`analyze risk`)

| Métrica | Fórmula |
|---------|---------|
| Drawdown actual | (precio - máximo histórico) / máximo histórico × 100 |
| Max drawdown | Mínimo drawdown histórico |
| Volatilidad 30/90/365d | std(returns) × sqrt(365) × 100 (anualizada) |
| Sharpe 365d | mean_return / std_return (risk-free = 0%) |
| VaR 95% | mean - 1.645 × std |
| VaR 99% | mean - 2.326 × std |
| Beta vs SPX | cov(btc, spx) / var(spx) sobre 365d |

### 3.8 Cycle Score (`analyze cycle-score`)

Score compuesto 0-100 que indica la fase del ciclo:

| Componente | Peso | Normalización |
|------------|------|---------------|
| SMA Position (SMA50-SMA200) | 20% | -20000→0, 0→50, +20000→100 |
| Price Position (vs ATH y cycle low) | 20% | 0=cycle low, 100=ATH |
| Halving (días desde último) | 15% | 0 días=0, 1460 días=100 |
| RSI mensual | 10% | Valor directo 0-100 |
| Hash Rate Momentum | 10% | 50 + val×2, clamp 0-100 |
| Fear & Greed | 5% | Valor directo 0-100 |
| Fear & Greed 30D | 5% | Valor directo 0-100 |

**Fases:**

| Score | Fase |
|-------|------|
| 0-14 | Capitulation |
| 15-29 | Accumulation |
| 30-44 | Early Bull |
| 45-59 | Mid Bull |
| 60-74 | Late Bull |
| 75-84 | Distribution |
| 85-100 | Euphoria |

### 3.9 Alertas automáticas

**Patrones detectados:**

| Patrón | Condición | Severidad |
|--------|-----------|-----------|
| Golden Cross | SMA_CROSS cruza de negativo a positivo | warning |
| Death Cross | SMA_CROSS cruza de positivo a negativo | warning |
| Golden Cross inminente | SMA_CROSS < 0 y abs(valor) < 500 | info |
| Death Cross inminente | SMA_CROSS > 0 y abs(valor) < 500 | info |
| RSI sobrecompra | RSI > 70 | warning |
| RSI sobreventa | RSI < 30 | warning |
| Cycle Score Euforia | Score > 85 | critical |
| Cycle Score Capitulación | Score < 15 | critical |

### 3.10 Backtesting de Señales (sistema actual)

**Snapshot** (cada hora): Replica los pesos del frontend, calcula score ponderado por timeframe (1H/4H/1D/1W), guarda dirección (LONG/SHORT/NEUTRAL) + confianza + precio.

**Evaluación**: Compara dirección predicha con movimiento real del precio. Si LONG y precio subió = correct. Si LONG y precio bajó = incorrect. NEUTRAL correct si movimiento < 1%.

**Problema conocido**: Usa `date` en vez de `datetime` para calcular el período de evaluación, lo que hace que las evaluaciones de 1H/4H sean incorrectas (comparan con el mismo día).

### 3.11 Informe AI diario

- **Modelo**: Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Input**: `build_context(scope="morning")` — precio, cambios, señales técnicas, on-chain, sentimiento, alertas, conclusiones
- **Output**: Informe ~500 palabras con: Market Overview, Technical Analysis, On-Chain Health, Sentiment & Macro, Trading Outlook, Risk Factors
- **Coste**: ~$0.008/informe
- **Almacenamiento**: Tabla `reports` con `generated_by: "claude-sonnet"`

### 3.12 Contexto para Claude Code

4 scopes de contexto generado como markdown:

| Scope | ~Tokens | Contenido |
|-------|---------|-----------|
| summary | 500-800 | Precio, Cycle Score, señales, confluencias, alertas |
| morning | ~1500 | Todo summary + cambios vs ayer + eventos próximos + riesgo |
| deep | 2000-3000 | Precio + detalle completo de 1 área + cycle score + riesgo |
| compare | ~3000 | Comparación side-by-side de dos fechas |

### 3.13 Conclusiones (diario de inteligencia)

CRUD completo con:
- Versionado (refine crea nueva versión vinculada a parent_id)
- Validación (correct/incorrect/partial)
- Data snapshot automático (precio BTC, cycle score, RSI, F&G al momento)
- Scoring de precisión: `accuracy = (correct + partial×0.5) / total × 100`
- Filtro por categoría: technical, onchain, macro, sentiment, cycle, general

---

## 4. Frontend — 14 Páginas

### 4.1 Overview (`/`)

| Elemento | Datos |
|----------|-------|
| **Precio hero** | Precio live (Binance WS) con fallback DB. Cambios 24h/7d/30d. Sparkline 7 días |
| **Gauge Cycle Score** | SVG circular 0-100 con color por fase |
| **4 MetricCards** | Precio, Fear & Greed (con label), Alertas activas, Conclusiones |
| **Señales Trading** | 4 tarjetas (1H/4H/1D/1W): dirección, confianza, TP1/SL. Link a /trading |
| **Chips señales activas** | RSI, MACD, SMA_CROSS con valor y badge de color |
| **Panel alertas** | 5 alertas más recientes |
| **Panel conclusiones** | 3 conclusiones más recientes |

### 4.2 Trading (`/trading`)

| Elemento | Datos |
|----------|-------|
| **Barra precio** | BTC con cambio 24h |
| **4 tarjetas resumen** | Por timeframe: dirección, confianza, TP2/TP1/SL, señales bull/bear/neutral |
| **Chips señales** | RSI, MACD, SMA_CROSS |
| **4 paneles detallados** (uno por timeframe): | |
| — Tesis de trading | Texto generado: "Por qué LONG/SHORT", "Cuándo entrar", "Riesgos clave" |
| — Niveles TP/SL | Escalera visual: TP2, TP1, ENTRY, SL con precios, %, R:R |
| — Tabla de señales | 9 indicadores: nombre, valor, señal, peso%, contribución visual |
| — Razonamiento | Explicación por indicador |
| **Signal Accuracy** | Win rate global, por timeframe, total señales correct/incorrect |
| **Disclaimer** | No es consejo financiero |

### 4.3 Technical (`/technical`)

| Elemento | Datos |
|----------|-------|
| **Chips señales** | RSI, MACD, SMA_CROSS actuales |
| **Chart Precio + MAs** | Precio (area), EMA 21, SMA 50, SMA 200. Selector: 1M/3M/6M/1Y/ALL |
| **Chart RSI** | Línea RSI con referencias en 70 (rojo) y 30 (verde) |
| **Chart MACD** | MACD line, Signal line, Histograma. Puntos de cruce bull/bear |
| **Interpretación** | RSI (sobrecompra/sobreventa), MACD (cruces), EMA (proximidad), SMA (estructura) |

### 4.4 On-Chain (`/onchain`)

| Elemento | Datos |
|----------|-------|
| **5 MetricCards** | Hash Rate (EH/s), HR Momentum 30D (%), NVT Ratio, Funding Rate (%), Open Interest ($B) |
| **Chart HR Momentum** | 365 días, línea verde con referencia en 0 |
| **Chart NVT** | 365 días, línea naranja |
| **Chart Funding Rate** | 90 días, línea morada con referencia en 0 |
| **Interpretación** | HR creciendo/cayendo, NVT alto/bajo, FR extremo/neutral, OI alto/bajo, resumen red |

### 4.5 Macro (`/macro`)

| Elemento | Datos |
|----------|-------|
| **4 MetricCards** | Correlación 30D: BTC vs SPX, GOLD, DXY, US_10Y. Subtítulo con 90D |
| **Heatmap matrix** | 4×4 coloreado (verde positivo, rojo negativo, opacidad por magnitud) |
| **Interpretación** | SPX (risk-on/off), DXY (dólar fuerte/débil), GOLD (store of value), resumen favorable/desfavorable |

### 4.6 Sentiment (`/sentiment`)

| Elemento | Datos |
|----------|-------|
| **Gauge Fear & Greed** | SVG circular 0-100 con gradiente rojo→verde |
| **4 MetricCards** | Valor actual + label, Media 30D, Zona (con señal extrema), Divergencia (actual vs 30D) |
| **Chart F&G History** | 365 días, area chart amarillo |
| **Interpretación** | <=20 Extreme Fear (contrarian bullish), >=80 Extreme Greed (contrarian bearish), divergencia >15 = posible cambio tendencia |

### 4.7 Cycles (`/cycles`)

| Elemento | Datos |
|----------|-------|
| **Timeline halvings** | 4 halvings horizontales (2012, 2016, 2020, 2024) |
| **4 MetricCards** | Ciclo actual (#4), Días desde halving, Ciclos halving, Bulls/Bears |
| **Días entre picos** | Peak-to-peak con fechas, precios, duración. Media |
| **Días entre suelos** | Bottom-to-bottom |
| **Peak a Bottom** | Duración de crashes con % drawdown |
| **Proyecciones** | Próximo bottom y peak basado en medias históricas |
| **Tabla completa** | Todos los ciclos: nombre, tipo, inicio, fin, duración, ROI%, max drawdown |

### 4.8 Cycle Score (`/cycle-score`)

| Elemento | Datos |
|----------|-------|
| **Gauge Score** | SVG circular 0-100, color por fase |
| **4 MetricCards** | Score, Fase, Componentes activos, Fecha |
| **Breakdown componentes** | 7 barras de progreso: SMA Position, Price Position, Halving, RSI, HR Mom, F&G, F&G 30D |
| **Chart historia** | 90 días, línea naranja |
| **Interpretación** | Descripción fase, componente más bearish/bullish, tendencia 30d |

### 4.9 Risk (`/risk`)

| Elemento | Datos |
|----------|-------|
| **5 MetricCards** | Drawdown actual, Max Drawdown, Vol 30D (anualizada), Sharpe, VaR 95% |
| **Chart Drawdown** | Area chart rojo sobre tiempo |
| **Interpretación** | Drawdown severity, nivel volatilidad, calidad Sharpe, VaR diario |

Nota: Todo calculado client-side desde datos de precio.

### 4.10 Alerts (`/alerts`)

| Elemento | Datos |
|----------|-------|
| **Contador** | Alertas activas |
| **Cards** | Severity (critical=rojo, warning=amarillo, info=azul), título, descripción, tipo, señal, fecha |
| **Estado vacío** | Check verde "No active alerts" |

### 4.11 Reports (`/reports`)

| Elemento | Datos |
|----------|-------|
| **Lista lateral** | Título, tipo, fecha, badge "AI" si generated_by=claude-sonnet |
| **Visor** | Título, fecha, contenido pre-formateado |

### 4.12 Conclusions (`/conclusions`)

| Elemento | Datos |
|----------|-------|
| **Accuracy** | Porcentaje de conclusiones validadas correctamente |
| **Filtros** | all, technical, onchain, macro, sentiment, cycle, general |
| **Cards** | Icono bot/user, título, confidence/10, outcome badge, contenido, fecha, categoría, tags, data snapshot |

### 4.13 Portfolio (`/portfolio`)

| Elemento | Datos |
|----------|-------|
| **4 Stats** | Total PnL, Win Rate, Total Trades, Avg PnL |
| **Formulario** | Dirección (LONG/SHORT), Entry Price (auto-fill live), Size BTC, SL, TP1, TP2, Notes |
| **Posiciones abiertas** | Dirección, entry, size, PnL live (USD + %) via WebSocket, botón cerrar |
| **Historial** | Tabla: dirección, entry, exit, size, PnL $, PnL % |

### 4.14 Info (`/info`)

Página estática: qué es, secciones del dashboard, fuentes de datos, frecuencia de actualización, disclaimer.

---

## 5. Sistema de Señales de Trading (Core Engine)

### 5.1 Los 9 Indicadores

| # | Indicador | Fuente | Rango señal |
|---|-----------|--------|-------------|
| 1 | RSI_14 | DB signal_classifier | extreme_bearish → extreme_bullish |
| 2 | MACD | DB signal_classifier | bearish → bullish |
| 3 | SMA_CROSS | DB signal_classifier | bearish → bullish |
| 4 | BB (Bollinger) | DB signal_classifier | extreme_bearish → extreme_bullish |
| 5 | EMA_21 | Client-side: % distancia precio vs EMA | >5% extreme_bullish, <-5% extreme_bearish |
| 6 | FEAR_GREED | Client-side: valor directo | <=15 extreme_bearish, >80 extreme_bullish |
| 7 | HASH_RATE_MOM | DB signal_classifier | bearish → bullish |
| 8 | NVT_RATIO | DB signal_classifier | bearish → extreme_bullish |
| 9 | CYCLE_SCORE | Client-side: invertido | <=20 extreme_bullish (acumulación), >80 extreme_bearish (euforia) |

### 5.2 Puntuación de Señales

```
extreme_bullish  = +1.0
bullish          = +0.5
neutral          =  0.0
bearish          = -0.5
extreme_bearish  = -1.0
```

### 5.3 Pesos por Timeframe

| Indicador | 1H | 4H | 1D | 1W |
|-----------|-----|-----|-----|-----|
| RSI_14 | **25%** | 20% | 15% | 5% |
| MACD | **25%** | 20% | 15% | 10% |
| SMA_CROSS | 0% | 10% | 15% | **25%** |
| BB | 15% | 10% | 10% | 0% |
| EMA_21 | 15% | 15% | 10% | 5% |
| FEAR_GREED | 10% | 15% | 10% | 10% |
| HASH_RATE_MOM | 0% | 5% | 10% | **15%** |
| NVT_RATIO | 0% | 5% | 5% | 10% |
| CYCLE_SCORE | 10% | 0% | 10% | **20%** |

**Filosofía**: 1H dominado por momentum rápido (RSI+MACD=50%). 1W dominado por estructura (SMA_CROSS+CYCLE_SCORE+HR_MOM=60%).

### 5.4 Cálculo de Dirección y Confianza

```
totalScore = Σ (peso[i] × score[señal[i]])

Si totalScore > +0.25 → LONG
Si totalScore < -0.25 → SHORT
Else → NEUTRAL

confianza = min(|totalScore| × 100, 100)
```

### 5.5 Cálculo de TP/SL (sistema actual)

Basado en **ATR + Bollinger Bands + SMAs** con scaling por confianza.

**Multiplicadores ATR por timeframe:**

| Timeframe | SL | TP1 | TP2 |
|-----------|-----|------|------|
| 1H | 0.5× | 0.75× | 1.5× |
| 4H | 1.0× | 1.5× | 3.0× |
| 1D | 1.5× | 2.0× | 4.0× |
| 1W | 2.5× | 3.5× | 7.0× |

**Scaling de confianza para SL:**
```
confScale = 1.2 - (confianza/100) × 0.4
// 100% confianza → SL más ajustado (0.8×)
// 25% confianza → SL más amplio (1.1×)
```

**Prioridad de niveles (LONG):**

| Nivel | Prioridad 1 | Prioridad 2 | Fallback |
|-------|-------------|-------------|----------|
| SL | BB Lower (si < precio) - buffer | SMA 200 - buffer | precio - ATR × SL_mult × confScale |
| TP1 | BB Mid (si > precio y distancia > 0.3×ATR) | — | precio + ATR × TP1_mult |
| TP2 | BB Upper (si > TP1) | — | precio + ATR × TP2_mult |

Para SHORT: lógica invertida.

### 5.6 Tesis de Trading (generación automática)

Para cada timeframe se genera texto explicativo:

- **"Por qué LONG/SHORT"**: Cuántos indicadores analizados, driver principal (mayor contribución), contexto RSI, contexto EMA, Cycle Score, contra-señales
- **"Cuándo entrar"**: Condiciones según confianza (>=65% agresivo, >=40% moderado, <40% esperar), niveles EMA, timing RSI, invalidación SL
- **"Riesgos"**: F&G en extremos, caída hash rate, NVT elevado, baja confianza, contra-indicadores

---

## 6. CLI — Todos los Comandos

| Comando | Descripción |
|---------|-------------|
| `btc-intel status` | Precio actual, última fecha por fuente, conteo de registros |
| `btc-intel update-data` | Descarga datos de todas las fuentes |
| `btc-intel update-data --only [btc\|macro\|onchain\|sentiment\|derivatives]` | Solo una categoría |
| `btc-intel analyze full` | Ejecuta TODOS los engines + alertas + backtesting |
| `btc-intel analyze [technical\|onchain\|macro\|sentiment\|cycles\|risk\|cycle-score\|derivatives]` | Un engine específico |
| `btc-intel ai-context --scope [summary\|morning\|deep\|compare]` | Genera contexto markdown para Claude |
| `btc-intel alerts check` | Ejecuta reglas de alertas |
| `btc-intel alerts list` | Lista alertas activas |
| `btc-intel alerts ack [ID]` | Acknowledger una alerta |
| `btc-intel conclude --add --title "..." --category "..." --confidence N` | Crear conclusión |
| `btc-intel conclude --list` | Listar conclusiones |
| `btc-intel conclude --refine [ID]` | Crear nueva versión |
| `btc-intel conclude --validate [ID] --outcome [correct\|incorrect\|partial]` | Validar predicción |
| `btc-intel conclude --score` | Ver accuracy de predicciones |
| `btc-intel report --type [daily\|weekly\|cycle]` | Generar informe |
| `btc-intel ai-report` | Generar informe con Claude Sonnet |
| `btc-intel morning` | Rutina completa: update → analyze → alerts → context |
| `btc-intel weekly` | Rutina semanal: update → analyze → alerts → deep analysis → report |
| `btc-intel seed-events` | Cargar 24 eventos históricos |
| `btc-intel seed-cycles` | Cargar 10 ciclos históricos |
| `btc-intel seed-all` | Ambos seeds |
| `btc-intel dashboard --port 8000` | Lanzar servidor FastAPI |
| `btc-intel db-check` | Verificar conexión Supabase |

---

## 7. Automatización

### GitHub Actions

| Workflow | Cron | Qué hace | Secrets |
|----------|------|----------|---------|
| `hourly-update.yml` | `5 * * * *` (cada hora :05) | update-data → analyze full → status | SUPABASE_URL, SUPABASE_KEY, FRED_API_KEY |
| `daily-ai-report.yml` | `0 8 * * *` (8:00 UTC diario) | ai-report | + ANTHROPIC_API_KEY |

### Flujo horario completo

```
1. update-data
   ├── BTC prices (Yahoo Finance)
   ├── Macro (Yahoo Finance + FRED)
   ├── On-chain (Blockchain.com → 6 métricas + NVT calculado)
   ├── Sentiment (Alternative.me + Google Trends)
   └── Derivatives (OKX → Funding Rate + Open Interest)

2. analyze full
   ├── technical → RSI, MACD, SMA, EMA, BB, ATR → technical_indicators
   ├── onchain → HASH_RATE_MOM_30D, NVT señales → onchain_metrics
   ├── macro → 12 correlaciones rolling → technical_indicators
   ├── sentiment → FEAR_GREED_30D → sentiment_data
   ├── cycles → comparación posición ciclo (no persiste)
   ├── risk → drawdown, vol, Sharpe, VaR (no persiste)
   ├── cycle-score → score 0-100 + fase → cycle_score_history
   ├── derivatives → Funding Rate + OI señales → onchain_metrics
   ├── alertas → Golden/Death Cross, RSI extremo, Cycle Score extremo → alerts
   └── backtesting → snapshot señales + evaluación pasadas → signal_history
```

---

## 8. Frontend — Aspectos Técnicos

### Stack

| Tech | Versión | Uso |
|------|---------|-----|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7 | Build tool |
| Tailwind CSS | 4 | Styling (dark theme custom) |
| Recharts | 3.7 | Charts (LineChart, AreaChart, ComposedChart, BarChart) |
| React Router | 7 | Routing (lazy loading) |
| Supabase JS | 2.95 | Data fetching |
| Lucide React | — | Icons |
| Binance WS | — | Precio real-time |

### Tema visual

- Fondo: `#0a0a0f` (primary), `#12121a` (secondary)
- Acento: BTC naranja `#f7931a`, azul `#3b82f6`, morado `#8b5cf6`
- Señales: verde `#22c55e` (bullish), rojo `#ef4444` (bearish), amarillo `#eab308` (neutral)
- Fuentes: Space Grotesk (display), Inter (body), JetBrains Mono (mono)

### Caché

Hook `useSupabaseQuery` con SWR (stale-while-revalidate):
- TTL: 60 segundos
- Cache en memoria (`Map<string, CacheEntry>`)
- Devuelve datos stale inmediatamente mientras refresca en background

### WebSocket

- URL: `wss://stream.binance.com:9443/ws/btcusdt@trade`
- Throttle: 1 update/segundo
- Reconnect: Backoff exponencial (1s inicial, 30s máximo)
- Usado en: Header (precio global), Overview (hero), Trading (referencia), Portfolio (PnL live)

### i18n

- ~520 claves por idioma (ES + EN)
- Persistido en `localStorage` key `btc-intel-lang`
- Toggle en Sidebar
- `t(key)` para strings, `ta(key)` para arrays (modales de ayuda)

---

## 9. Dependencias Backend

```
fastapi>=0.115.0          uvicorn[standard]>=0.30.0
typer[all]>=0.12.0        rich>=13.0.0
pandas>=2.2.0             numpy>=1.26.0
pandas-ta>=0.3.14b1       supabase>=2.0.0
httpx>=0.27.0             python-dotenv>=1.0.0
yfinance>=0.2.40          pytrends>=4.9.0
fredapi>=0.5.0            pydantic>=2.0.0
pydantic-settings>=2.0.0
```

---

## 10. Coste Operativo

| Servicio | Plan | Uso mensual | Coste |
|----------|------|-------------|-------|
| Supabase | Free | ~50MB DB, <2GB bandwidth | $0 |
| Vercel | Free | <100GB bandwidth | $0 |
| GitHub Actions | Free | ~900 min/mes (de 2000 disponibles) | $0 |
| APIs externas | Free | Dentro de rate limits | $0 |
| Claude Sonnet (AI reports) | Pay-per-use | ~30 reports/mes × $0.008 | ~$0.24 |
| **TOTAL** | | | **~$0.24/mes** |
