# CLI Reference - btc-intel

## Datos

### `btc-intel update-data`
Actualiza datos desde fuentes externas (CoinGecko, Yahoo Finance, FRED, alternative.me, Blockchain.com).

```bash
btc-intel update-data                # Actualiza todo
btc-intel update-data --only btc     # Solo precio BTC
btc-intel update-data --only macro   # Solo datos macro (SPX, Gold, DXY, Fed, M2)
btc-intel update-data --only onchain # Solo metricas on-chain
btc-intel update-data --only sentiment # Solo sentimiento
```

### `btc-intel status`
Muestra estado actual: ultimo precio BTC, fechas de datos, conteo de registros por tabla.

### `btc-intel seed-events`
Carga eventos historicos curados (halvings, regulaciones, crashes, adopcion).

### `btc-intel seed-cycles`
Carga ciclos historicos (halvings, bull/bear markets con datos de ROI y drawdown).

### `btc-intel seed-all`
Ejecuta seed-events + seed-cycles.

### `btc-intel db-check`
Verifica conexion a Supabase y lista todas las tablas con conteo de registros.

## Analisis

### `btc-intel analyze [area]`
Recalcula indicadores y analisis.

```bash
btc-intel analyze full         # Todos los motores + alertas
btc-intel analyze technical    # RSI, MACD, Bollinger, SMAs, EMAs, ATR
btc-intel analyze onchain      # Hash rate, NVT, momentum
btc-intel analyze macro        # Correlaciones BTC vs SPX/Gold/DXY/US10Y
btc-intel analyze sentiment    # Fear & Greed, promedios
btc-intel analyze cycles       # Deteccion de fases
btc-intel analyze risk         # Volatilidad, Sharpe, VaR, drawdown
btc-intel analyze cycle-score  # Cycle Score compuesto 0-100
```

## Contexto

### `btc-intel ai-context`
Genera contexto estructurado para Claude Code.

```bash
btc-intel ai-context --scope summary    # ~500 tokens, briefing ejecutivo
btc-intel ai-context --scope morning    # ~1500 tokens, rutina matutina
btc-intel ai-context --scope deep --area technical   # Deep dive tecnico
btc-intel ai-context --scope deep --area onchain     # Deep dive on-chain
btc-intel ai-context --scope deep --area macro       # Deep dive macro
btc-intel ai-context --scope deep --area sentiment   # Deep dive sentimiento
btc-intel ai-context --scope deep --area cycle       # Deep dive ciclos
btc-intel ai-context --scope compare --period1 "2024-01-01" --period2 "2025-01-01"
```

## Alertas

### `btc-intel alerts [action]`

```bash
btc-intel alerts check                  # Ejecuta reglas de alertas
btc-intel alerts list                   # Lista alertas activas
btc-intel alerts list --severity critical  # Solo criticas
btc-intel alerts ack 42                 # Marcar alerta como vista
```

### Reglas de alertas incluidas

| Regla | Tipo | Severidad |
|-------|------|-----------|
| RSI > 70 | technical | warning |
| RSI < 30 | technical | warning |
| Golden Cross inminente | technical | warning |
| Death Cross inminente | technical | warning |
| Cycle Score > 85 | cycle | critical |
| Cycle Score < 15 | cycle | critical |
| Fear & Greed extremo (>80 o <20) | sentiment | warning |

## Conclusiones

### `btc-intel conclude`
Gestion del diario de inteligencia.

```bash
# Crear conclusion
btc-intel conclude --add "Bitcoin muestra..." --title "Acumulacion confirmada" \
  --category technical --confidence 7 --tags "rsi,sma"

# Listar
btc-intel conclude --list
btc-intel conclude --list --category onchain

# Refinar (crear nueva version)
btc-intel conclude --refine 34 --add "Actualizo mi tesis..."

# Validar prediccion
btc-intel conclude --validate 34 --outcome correct
btc-intel conclude --validate 35 --outcome incorrect
btc-intel conclude --validate 36 --outcome partial

# Score de precision
btc-intel conclude --score
```

### Categorias: `technical`, `onchain`, `macro`, `sentiment`, `cycle`, `general`
### Confianza: 1-10 (1=especulativo, 10=extremo historico obvio)

## Informes

### `btc-intel report`

```bash
btc-intel report --type daily    # Briefing diario
btc-intel report --type weekly   # Informe semanal
btc-intel report --type cycle    # Analisis de ciclo
btc-intel report --type custom --title "Mi analisis Q1 2026"
```

## Rutinas

### `btc-intel morning`
Rutina matutina completa:
1. `update-data` — Actualiza todos los datos
2. `analyze full` — Recalcula indicadores
3. `alerts check` — Verifica alertas
4. `ai-context --scope morning` — Genera briefing

### `btc-intel weekly`
Rutina semanal:
1. `update-data`
2. `analyze full`
3. `alerts check`
4. Deep analysis por cada area
5. `report --type weekly`

## Dashboard

### `btc-intel dashboard`
Lanza el servidor FastAPI.

```bash
btc-intel dashboard              # http://localhost:8000
btc-intel dashboard --port 3001  # Puerto custom
```
