# Setup - Guia de Instalacion

## Requisitos previos

- Python 3.12+
- Node.js 20.19+ o 22.12+
- Cuenta Supabase (free tier)
- FRED API key (gratis en fred.stlouisfed.org)

## 1. Supabase

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar el SQL de `supabase/migrations/001_initial_schema.sql` en el SQL Editor
3. Todas las tablas se crean en el schema `btc_hub`
4. Configurar RLS policies (ver seccion abajo)
5. Obtener las credenciales:
   - `SUPABASE_URL` — URL del proyecto
   - `SUPABASE_KEY` — service_role key (para backend)
   - `SUPABASE_ANON_KEY` — anon key (para frontend)

## 2. Backend Python

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Linux/macOS
# .venv\Scripts\activate     # Windows

pip install -e .
```

### Variables de entorno

Crear archivo `.env` en `/backend/`:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...  # service_role key
FRED_API_KEY=xxxxx   # Obtener en fred.stlouisfed.org
```

### Verificar conexion

```bash
btc-intel db-check
```

## 3. Carga inicial de datos

```bash
# Descargar datos historicos (puede tardar unos minutos)
btc-intel update-data

# Cargar eventos historicos y ciclos
btc-intel seed-all

# Ejecutar analisis completo
btc-intel analyze full

# Verificar
btc-intel status
```

## 4. Frontend React

```bash
cd frontend
npm install
```

### Variables de entorno

Crear archivo `.env.local` en `/frontend/`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # anon key (NO service_role)
```

### Desarrollo local

```bash
npm run dev    # http://localhost:5173
```

### Build de produccion

```bash
npm run build
```

## 5. Deploy en Vercel

1. Push del frontend a GitHub
2. Conectar repo en Vercel
3. Configurar variables de entorno en Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automatico

## 6. Crontab (opcional)

Para alertas automaticas cada hora:

```bash
chmod +x backend/scripts/check_alerts.sh
crontab -e

# Anadir esta linea:
0 * * * * /ruta/completa/backend/scripts/check_alerts.sh
```

## RLS Policies

Las tablas necesitan Row Level Security para el acceso desde el frontend:

```sql
-- Para cada tabla:
ALTER TABLE btc_hub.btc_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON btc_hub.btc_prices FOR SELECT USING (true);

-- Repetir para: technical_indicators, onchain_metrics, macro_data,
-- sentiment_data, cycles, events, alerts, conclusions,
-- cycle_score_history, reports
```

## Troubleshooting

### "Token Infinity is invalid"
Algunos calculos on-chain producen valores infinitos. Asegurate de tener la ultima version del backend que los filtra.

### "min() iterable argument is empty"
El query a Supabase esta limitado a 1000 filas por defecto. Las queries del backend usan `.limit(100000)` para evitar esto.

### Frontend no muestra datos
1. Verificar que `.env.local` tiene la anon key correcta
2. Verificar que el schema `btc_hub` esta configurado en el cliente Supabase
3. Verificar RLS policies permiten lectura publica
