-- Migration 004: Trading Module v2 — Levels, Fibonacci, Confluence
-- Extends the existing system with structural price analysis

-- Niveles de precio detectados automaticamente
CREATE TABLE IF NOT EXISTS btc_hub.price_levels (
    id              SERIAL PRIMARY KEY,
    price           DECIMAL(12,2) NOT NULL,
    price_low       DECIMAL(12,2),
    price_high      DECIMAL(12,2),
    type            VARCHAR(20) NOT NULL,
    strength        SMALLINT CHECK (strength BETWEEN 0 AND 20),
    classification  VARCHAR(20),
    source          TEXT[],
    timeframes      VARCHAR(5)[],
    touch_count     SMALLINT DEFAULT 0,
    last_touch_date DATE,
    fib_level       DECIMAL(5,3),
    is_role_flip    BOOLEAN DEFAULT FALSE,
    is_psychological BOOLEAN DEFAULT FALSE,
    is_high_volume  BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) DEFAULT 'active',
    broken_at       TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_levels_price ON btc_hub.price_levels(price);
CREATE INDEX idx_levels_strength ON btc_hub.price_levels(strength DESC);
CREATE INDEX idx_levels_status ON btc_hub.price_levels(status);

-- Niveles Fibonacci por timeframe
CREATE TABLE IF NOT EXISTS btc_hub.fibonacci_levels (
    id              SERIAL PRIMARY KEY,
    timeframe       VARCHAR(5) NOT NULL,
    type            VARCHAR(20) NOT NULL,
    direction       VARCHAR(5) NOT NULL,
    swing_low       DECIMAL(12,2) NOT NULL,
    swing_high      DECIMAL(12,2) NOT NULL,
    swing_low_date  DATE,
    swing_high_date DATE,
    pullback_end    DECIMAL(12,2),
    levels          JSONB NOT NULL,
    status          VARCHAR(20) DEFAULT 'active',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fib_tf ON btc_hub.fibonacci_levels(timeframe);
CREATE INDEX idx_fib_status ON btc_hub.fibonacci_levels(status);

-- Zonas de confluencia (multi-TF Fibonacci + S/R)
CREATE TABLE IF NOT EXISTS btc_hub.confluence_zones (
    id              SERIAL PRIMARY KEY,
    price_low       DECIMAL(12,2) NOT NULL,
    price_high      DECIMAL(12,2) NOT NULL,
    price_mid       DECIMAL(12,2) NOT NULL,
    type            VARCHAR(20) NOT NULL,
    timeframes      VARCHAR(5)[] NOT NULL,
    fib_ratios      DECIMAL(5,3)[],
    num_timeframes  SMALLINT,
    strength        SMALLINT,
    has_gran_nivel  BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) DEFAULT 'active',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conf_price ON btc_hub.confluence_zones(price_mid);
CREATE INDEX idx_conf_strength ON btc_hub.confluence_zones(strength DESC);

-- Extender signal_history con info de niveles y setup
ALTER TABLE btc_hub.signal_history
    ADD COLUMN IF NOT EXISTS setup_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sl DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS tp1 DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS tp2 DECIMAL(12,2),
    ADD COLUMN IF NOT EXISTS sl_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tp1_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tp2_method VARCHAR(50),
    ADD COLUMN IF NOT EXISTS level_score SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS candle_pattern VARCHAR(50),
    ADD COLUMN IF NOT EXISTS candle_score SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS onchain_bonus SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS penalties SMALLINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS extended_score SMALLINT,
    ADD COLUMN IF NOT EXISTS nearby_levels JSONB,
    ADD COLUMN IF NOT EXISTS fib_context JSONB;

-- Cambiar outcome a sistema TP/SL en vez de simple up/down
ALTER TABLE btc_hub.signal_history
    ADD COLUMN IF NOT EXISTS outcome VARCHAR(20),
    ADD COLUMN IF NOT EXISTS hit_at TIMESTAMPTZ;

-- RLS
ALTER TABLE btc_hub.price_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE btc_hub.fibonacci_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE btc_hub.confluence_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_levels_public_read" ON btc_hub.price_levels FOR SELECT USING (true);
CREATE POLICY "fibonacci_levels_public_read" ON btc_hub.fibonacci_levels FOR SELECT USING (true);
CREATE POLICY "confluence_zones_public_read" ON btc_hub.confluence_zones FOR SELECT USING (true);
