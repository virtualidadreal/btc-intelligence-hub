-- ============================================================
-- BTC Intelligence Hub — Schema inicial
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. btc_prices — Precio diario desde 2012
CREATE TABLE IF NOT EXISTS btc_prices (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE UNIQUE NOT NULL,
    open        DECIMAL(12,2) NOT NULL,
    high        DECIMAL(12,2) NOT NULL,
    low         DECIMAL(12,2) NOT NULL,
    close       DECIMAL(12,2) NOT NULL,
    volume      DECIMAL(20,8),
    source      VARCHAR(50) DEFAULT 'bitstamp',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_btc_prices_date ON btc_prices(date);

-- 2. technical_indicators — Indicadores calculados
CREATE TABLE IF NOT EXISTS technical_indicators (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    indicator   VARCHAR(50) NOT NULL,
    value       DECIMAL(18,8) NOT NULL,
    signal      VARCHAR(20),
    params      JSONB,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, indicator)
);
CREATE INDEX IF NOT EXISTS idx_tech_date ON technical_indicators(date);
CREATE INDEX IF NOT EXISTS idx_tech_indicator ON technical_indicators(indicator);

-- 3. onchain_metrics — Datos on-chain
CREATE TABLE IF NOT EXISTS onchain_metrics (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    metric      VARCHAR(50) NOT NULL,
    value       DECIMAL(24,8) NOT NULL,
    signal      VARCHAR(20),
    source      VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, metric)
);
CREATE INDEX IF NOT EXISTS idx_onchain_date ON onchain_metrics(date);
CREATE INDEX IF NOT EXISTS idx_onchain_metric ON onchain_metrics(metric);

-- 4. macro_data — Datos macro
CREATE TABLE IF NOT EXISTS macro_data (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    asset       VARCHAR(50) NOT NULL,
    value       DECIMAL(18,4) NOT NULL,
    source      VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, asset)
);
CREATE INDEX IF NOT EXISTS idx_macro_date_asset ON macro_data(date, asset);

-- 5. sentiment_data — Sentimiento
CREATE TABLE IF NOT EXISTS sentiment_data (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE NOT NULL,
    metric      VARCHAR(50) NOT NULL,
    value       DECIMAL(10,4) NOT NULL,
    label       VARCHAR(50),
    source      VARCHAR(50),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, metric)
);
CREATE INDEX IF NOT EXISTS idx_sentiment_date ON sentiment_data(date);

-- 6. cycles — Ciclos y halvings
CREATE TABLE IF NOT EXISTS cycles (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE,
    btc_price_start DECIMAL(12,2),
    btc_price_end   DECIMAL(12,2),
    btc_price_peak  DECIMAL(12,2),
    btc_price_bottom DECIMAL(12,2),
    peak_date       DATE,
    bottom_date     DATE,
    duration_days   INT,
    roi_percent     DECIMAL(10,2),
    max_drawdown    DECIMAL(10,2),
    notes           TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 7. events — Timeline de eventos históricos
CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50) NOT NULL,
    impact          VARCHAR(20),
    btc_price       DECIMAL(12,2),
    source_url      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- 8. alerts — Alertas automáticas
CREATE TABLE IF NOT EXISTS alerts (
    id              SERIAL PRIMARY KEY,
    date            TIMESTAMPTZ DEFAULT NOW(),
    type            VARCHAR(50) NOT NULL,
    severity        VARCHAR(20) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT,
    metric          VARCHAR(50),
    current_value   DECIMAL(18,8),
    threshold_value DECIMAL(18,8),
    signal          VARCHAR(20),
    acknowledged    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_date ON alerts(date);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(acknowledged);

-- 9. conclusions — Diario de inteligencia
CREATE TABLE IF NOT EXISTS conclusions (
    id              SERIAL PRIMARY KEY,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL,
    source          VARCHAR(20) NOT NULL,
    confidence      SMALLINT CHECK (confidence BETWEEN 1 AND 10),
    tags            TEXT[],
    related_period  DATERANGE,
    related_events  INT[],
    parent_id       INT REFERENCES conclusions(id),
    version         INT DEFAULT 1,
    validated_outcome VARCHAR(20),
    validated_at    TIMESTAMPTZ,
    data_snapshot   JSONB,
    status          VARCHAR(20) DEFAULT 'active',
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conclusions_category ON conclusions(category);
CREATE INDEX IF NOT EXISTS idx_conclusions_tags ON conclusions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_conclusions_status ON conclusions(status);
CREATE INDEX IF NOT EXISTS idx_conclusions_source ON conclusions(source);
CREATE INDEX IF NOT EXISTS idx_conclusions_date ON conclusions(date);

-- 10. cycle_score_history — Histórico del Cycle Score
CREATE TABLE IF NOT EXISTS cycle_score_history (
    id              SERIAL PRIMARY KEY,
    date            DATE UNIQUE NOT NULL,
    score           SMALLINT CHECK (score BETWEEN 0 AND 100),
    phase           VARCHAR(50),
    mvrv_component      SMALLINT,
    nupl_component      SMALLINT,
    halving_component   SMALLINT,
    rsi_monthly_component SMALLINT,
    sth_mvrv_component  SMALLINT,
    exchange_flow_component SMALLINT,
    google_trends_component SMALLINT,
    fear_greed_component SMALLINT,
    cycle_comparison_component SMALLINT,
    similar_historical  JSONB,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cycle_score_date ON cycle_score_history(date);

-- 11. reports — Informes generados
CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    content         TEXT NOT NULL,
    report_type     VARCHAR(50),
    period_start    DATE,
    period_end      DATE,
    conclusion_ids  INT[],
    cycle_score     SMALLINT,
    generated_by    VARCHAR(20),
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE btc_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read btc_prices" ON btc_prices FOR SELECT USING (true);

ALTER TABLE technical_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read technical_indicators" ON technical_indicators FOR SELECT USING (true);

ALTER TABLE onchain_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read onchain_metrics" ON onchain_metrics FOR SELECT USING (true);

ALTER TABLE macro_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read macro_data" ON macro_data FOR SELECT USING (true);

ALTER TABLE sentiment_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sentiment_data" ON sentiment_data FOR SELECT USING (true);

ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cycles" ON cycles FOR SELECT USING (true);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read alerts" ON alerts FOR SELECT USING (true);

ALTER TABLE conclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active conclusions" ON conclusions FOR SELECT USING (status = 'active');

ALTER TABLE cycle_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cycle_score_history" ON cycle_score_history FOR SELECT USING (true);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reports" ON reports FOR SELECT USING (true);
