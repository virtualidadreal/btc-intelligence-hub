-- BTC Intelligence Hub — Optimizacion de indices
-- Ejecutar en Supabase SQL Editor

-- Indices ya creados en el schema inicial (verificar que existen):
-- idx_btc_prices_date ON btc_prices(date)
-- idx_tech_date ON technical_indicators(date)
-- idx_tech_indicator ON technical_indicators(indicator)
-- idx_onchain_date ON onchain_metrics(date)
-- idx_onchain_metric ON onchain_metrics(metric)
-- idx_macro_date_asset ON macro_data(date, asset)
-- idx_sentiment_date ON sentiment_data(date)
-- idx_events_date ON events(date)
-- idx_events_category ON events(category)
-- idx_alerts_date ON alerts(date)
-- idx_alerts_severity ON alerts(severity)
-- idx_alerts_acknowledged ON alerts(acknowledged)
-- idx_conclusions_category ON conclusions(category)
-- idx_conclusions_tags ON conclusions USING GIN(tags)
-- idx_conclusions_status ON conclusions(status)
-- idx_cycle_score_date ON cycle_score_history(date)

-- Indices adicionales para queries frecuentes del dashboard:

-- Indice compuesto para technical_indicators (query mas frecuente del frontend)
CREATE INDEX IF NOT EXISTS idx_tech_indicator_date
ON btc_hub.technical_indicators(indicator, date DESC);

-- Indice compuesto para onchain_metrics
CREATE INDEX IF NOT EXISTS idx_onchain_metric_date
ON btc_hub.onchain_metrics(metric, date DESC);

-- Indice compuesto para sentiment_data
CREATE INDEX IF NOT EXISTS idx_sentiment_metric_date
ON btc_hub.sentiment_data(metric, date DESC);

-- Indice para alertas no acknowledgeadas (query del dashboard)
CREATE INDEX IF NOT EXISTS idx_alerts_active
ON btc_hub.alerts(acknowledged, date DESC)
WHERE acknowledged = false;

-- Indice para conclusiones activas
CREATE INDEX IF NOT EXISTS idx_conclusions_active_date
ON btc_hub.conclusions(status, date DESC)
WHERE status = 'active';

-- Indice para reports por tipo
CREATE INDEX IF NOT EXISTS idx_reports_type_created
ON btc_hub.reports(report_type, created_at DESC);

-- RLS Policies (lectura publica para frontend)
-- Solo ejecutar si no estan ya creadas

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'btc_prices', 'technical_indicators', 'onchain_metrics',
            'macro_data', 'sentiment_data', 'cycles', 'events',
            'alerts', 'conclusions', 'cycle_score_history', 'reports'
        ])
    LOOP
        EXECUTE format('ALTER TABLE btc_hub.%I ENABLE ROW LEVEL SECURITY', tbl);
        BEGIN
            EXECUTE format(
                'CREATE POLICY "Public read %s" ON btc_hub.%I FOR SELECT USING (true)',
                tbl, tbl
            );
        EXCEPTION WHEN duplicate_object THEN
            -- Policy already exists
            NULL;
        END;
    END LOOP;
END $$;
