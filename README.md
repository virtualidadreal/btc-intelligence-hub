# BTC Intelligence Hub

Centro de inteligencia personal sobre Bitcoin. Analisis tecnico, on-chain, macro y sentimiento unificados en un sistema operado por Claude Code, con dashboard publico desplegado en Vercel.

## Arquitectura

```
                    TU MAQUINA (LOCAL)
  ┌──────────────────────────────────────────┐
  │  Claude Code (Terminal)                  │
  │  └─► btc-intel CLI (Python/Typer)        │
  │       ├── update-data   (fetch APIs)     │
  │       ├── analyze       (7 motores)      │
  │       ├── ai-context    (context builder)│
  │       ├── conclude      (diario intel)   │
  │       └── morning/weekly (rutinas auto)  │
  └──────────────┬───────────────────────────┘
                 │ Lee / Escribe
                 ▼
  ┌──────────────────────────────────────────┐
  │         SUPABASE (PostgreSQL Cloud)      │
  │  btc_prices | technical_indicators |     │
  │  onchain_metrics | macro_data |          │
  │  sentiment_data | cycles | alerts |      │
  │  conclusions | reports | cycle_score     │
  └──────────────┬───────────────────────────┘
                 │ Lectura directa
                 ▼
  ┌──────────────────────────────────────────┐
  │       FRONTEND (React + Vercel)          │
  │  11 paginas: Overview, Cycles, Technical │
  │  OnChain, Macro, Sentiment, CycleScore,  │
  │  Risk, Alerts, Conclusions, Reports      │
  └──────────────────────────────────────────┘
```

**Principio clave:** El backend es el cerebro (procesa), Supabase es la memoria (persiste), el frontend es la cara (visualiza), Claude Code es el piloto (dirige).

## Quick Start

### 1. Clonar y configurar

```bash
git clone https://github.com/tu-user/btc-intelligence-hub.git
cd btc-intelligence-hub
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase y FRED API key
```

### 3. Cargar datos iniciales

```bash
btc-intel update-data          # Descarga BTC + macro + onchain + sentiment
btc-intel seed-all             # Carga eventos historicos y ciclos
btc-intel analyze full         # Ejecuta todos los motores de analisis
btc-intel status               # Verifica que todo esta OK
```

### 4. Frontend

```bash
cd frontend
npm install

# Configurar Supabase
cp .env.example .env.local
# Editar .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

npm run dev                    # http://localhost:5173
```

### 5. Uso diario

```bash
btc-intel morning              # Rutina matutina completa
btc-intel ai-context --scope summary   # Briefing rapido
```

## CLI Reference

| Comando | Descripcion |
|---------|-------------|
| `btc-intel status` | Estado actual: precio, datos disponibles |
| `btc-intel update-data` | Actualiza todos los datos |
| `btc-intel update-data --only btc` | Solo precio BTC |
| `btc-intel analyze full` | Recalcula todos los indicadores |
| `btc-intel analyze technical` | Solo indicadores tecnicos |
| `btc-intel analyze cycle-score` | Recalcula Cycle Score |
| `btc-intel ai-context --scope summary` | Briefing ejecutivo |
| `btc-intel ai-context --scope morning` | Briefing matutino |
| `btc-intel ai-context --scope deep --area technical` | Deep dive |
| `btc-intel alerts check` | Comprueba reglas de alertas |
| `btc-intel alerts list` | Lista alertas activas |
| `btc-intel conclude --add "text" --title "title"` | Nueva conclusion |
| `btc-intel conclude --list` | Lista conclusiones |
| `btc-intel conclude --validate ID --outcome correct` | Validar prediccion |
| `btc-intel conclude --score` | Precision del analista |
| `btc-intel report --type daily` | Genera informe diario |
| `btc-intel morning` | Rutina matutina completa |
| `btc-intel weekly` | Rutina semanal completa |
| `btc-intel dashboard` | Lanza FastAPI en localhost:8000 |

## Cycle Score

Indicador compuesto propietario 0-100 que condensa multiples metricas:

```
  0 ────── 15 ──── 30 ──── 45 ──── 60 ──── 75 ──── 85 ──── 100
  │CAPITUL.│ ACUM  │ EARLY │  MID  │ LATE  │ DIST  │EUFORIA│
  │ Compra │ Ideal │ Bueno │Cautela│Cuidado│Reducir│ Salir │
```

### Componentes (ponderados)

| Componente | Peso | Fuente |
|-----------|------|--------|
| SMA Position | 20% | Golden/Death Cross distance |
| Price Position | 20% | Posicion en rango ciclo-ATH |
| Halving Position | 15% | Dias post-halving |
| RSI Mensual | 10% | Momentum largo plazo |
| Hash Rate Mom. | 10% | Salud de la red |
| Fear & Greed | 5% | Sentimiento actual |
| F&G 30D | 5% | Sentimiento medio plazo |

## Stack

- **Backend:** Python 3.12+ / Typer / pandas / pandas-ta / supabase-py / httpx
- **Frontend:** React 19 / TypeScript / Vite / Tailwind v4 / Recharts
- **DB:** Supabase (PostgreSQL cloud, schema `btc_hub`)
- **Deploy:** Vercel (frontend) / Local (backend)
- **Coste total:** $0/mes (todo free tier)

## Fuentes de datos

| Dato | Fuente | Coste |
|------|--------|-------|
| BTC OHLCV | Bitstamp (GitHub) | Gratis |
| S&P 500, Oro, DXY | Yahoo Finance | Gratis |
| Fed Rate, M2 | FRED API | Gratis |
| Hash Rate, NVT | Blockchain.com | Gratis |
| Fear & Greed | alternative.me | Gratis |
| Halvings/Events | Curado manual | -- |

## Documentacion

- [Setup completo](docs/setup.md)
- [Referencia CLI](docs/cli-reference.md)
- [Fuentes de datos](docs/data-sources.md)
- [Metodologia Cycle Score](docs/cycle-score-methodology.md)

## Alertas automaticas

Configurar crontab para verificar alertas cada hora:

```bash
crontab -e
# Anadir:
0 * * * * /path/to/backend/scripts/check_alerts.sh
```

## Licencia

Proyecto personal. No distribuir.
