-- ============================================================
-- BTC Intelligence Hub — Hourly BTC prices
-- Separate from btc_prices (daily) to avoid breaking existing queries.
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS btc_prices_1h (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ UNIQUE NOT NULL,
    open        DECIMAL(12,2) NOT NULL,
    high        DECIMAL(12,2) NOT NULL,
    low         DECIMAL(12,2) NOT NULL,
    close       DECIMAL(12,2) NOT NULL,
    volume      DECIMAL(20,8),
    source      VARCHAR(50) DEFAULT 'yahoo_finance',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_btc_prices_1h_timestamp ON btc_prices_1h(timestamp);

-- RLS
ALTER TABLE btc_prices_1h ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read btc_prices_1h" ON btc_prices_1h FOR SELECT USING (true);
