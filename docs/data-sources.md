# Fuentes de Datos

## Precio BTC

| Campo | Detalle |
|-------|---------|
| **Fuente** | Bitstamp via GitHub (ff137/bitstamp-ohlc-data) |
| **Rango** | 2012 - presente |
| **Frecuencia** | Diaria (OHLCV) |
| **Coste** | Gratis |
| **Tabla** | `btc_prices` |
| **Actualizacion** | `btc-intel update-data --only btc` |

## Datos Macro

### S&P 500 (SPX)
- **Fuente:** Yahoo Finance (yfinance, ticker `^GSPC`)
- **Rango:** 2012 - presente
- **Tabla:** `macro_data` (asset = 'SPX')

### Oro (GOLD)
- **Fuente:** Yahoo Finance (yfinance, ticker `GC=F`)
- **Rango:** 2012 - presente
- **Tabla:** `macro_data` (asset = 'GOLD')

### Dollar Index (DXY)
- **Fuente:** Yahoo Finance (yfinance, ticker `DX-Y.NYB`)
- **Rango:** 2012 - presente
- **Tabla:** `macro_data` (asset = 'DXY')

### US 10Y Treasury Yield
- **Fuente:** Yahoo Finance (yfinance, ticker `^TNX`)
- **Rango:** 2012 - presente
- **Tabla:** `macro_data` (asset = 'US_10Y')

### Federal Funds Rate
- **Fuente:** FRED API (serie `FEDFUNDS`)
- **Requiere:** `FRED_API_KEY` en .env
- **Tabla:** `macro_data` (asset = 'FED_RATE')

### M2 Money Supply
- **Fuente:** FRED API (serie `M2SL`)
- **Requiere:** `FRED_API_KEY` en .env
- **Tabla:** `macro_data` (asset = 'M2')

**Actualizacion:** `btc-intel update-data --only macro`

## Metricas On-Chain

### Hash Rate
- **Fuente:** Blockchain.com API
- **Endpoint:** `https://api.blockchain.info/charts/hash-rate`
- **Tabla:** `onchain_metrics` (metric = 'HASH_RATE')

### Hash Rate Momentum 30D
- **Calculado:** Cambio porcentual 30 dias del hash rate
- **Tabla:** `onchain_metrics` (metric = 'HASH_RATE_MOM_30D')

### NVT Ratio
- **Fuente:** Blockchain.com API (tx volume + market cap)
- **Tabla:** `onchain_metrics` (metric = 'NVT_RATIO')

### Transaction Count, Active Addresses
- **Fuente:** Blockchain.com API
- **Tabla:** `onchain_metrics`

**Actualizacion:** `btc-intel update-data --only onchain`

## Sentimiento

### Fear & Greed Index
- **Fuente:** alternative.me API
- **Endpoint:** `https://api.alternative.me/fng/`
- **Rango:** 0 (extreme fear) - 100 (extreme greed)
- **Tabla:** `sentiment_data` (metric = 'FEAR_GREED')

### Fear & Greed 30D Average
- **Calculado:** Media movil 30 dias del F&G
- **Tabla:** `sentiment_data` (metric = 'FEAR_GREED_30D')

**Actualizacion:** `btc-intel update-data --only sentiment`

## Datos Curados

### Eventos Historicos
- **Fuente:** Curado manualmente
- **Incluye:** Halvings, regulaciones, crashes, adopcion institucional
- **Tabla:** `events`
- **Carga:** `btc-intel seed-events`

### Ciclos Historicos
- **Fuente:** Curado manualmente
- **Incluye:** Halving cycles, bull markets, bear markets con ROI y max drawdown
- **Tabla:** `cycles`
- **Carga:** `btc-intel seed-cycles`

## Indicadores Calculados

Los siguientes indicadores se calculan a partir de los datos anteriores:

| Indicador | Motor | Inputs |
|-----------|-------|--------|
| RSI (14) | technical.py | btc_prices |
| MACD | technical.py | btc_prices |
| Bollinger Bands | technical.py | btc_prices |
| SMA 50/200 | technical.py | btc_prices |
| EMA 21 | technical.py | btc_prices |
| ATR (14) | technical.py | btc_prices |
| SMA Cross | technical.py | SMA 50, SMA 200 |
| Correlaciones | macro.py | btc_prices, macro_data |
| Volatilidad | risk.py | btc_prices |
| Sharpe Ratio | risk.py | btc_prices |
| VaR 95% | risk.py | btc_prices |
| Drawdown | risk.py | btc_prices |
| Cycle Score | cycle_score.py | Todos los anteriores |
