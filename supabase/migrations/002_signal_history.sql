-- Signal History — Track trading signal snapshots for backtesting
CREATE TABLE IF NOT EXISTS btc_hub.signal_history (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    timeframe TEXT NOT NULL,           -- 1H, 4H, 1D, 1W
    direction TEXT NOT NULL,           -- LONG, SHORT, NEUTRAL
    confidence INTEGER DEFAULT 0,
    score NUMERIC(8,4) DEFAULT 0,
    price_at_signal NUMERIC(12,2),
    price_1h_later NUMERIC(12,2),
    outcome_1h TEXT,                   -- correct, incorrect, null
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(date, timeframe)
);

-- Index for querying recent signals
CREATE INDEX IF NOT EXISTS idx_signal_history_date ON btc_hub.signal_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_signal_history_tf ON btc_hub.signal_history(timeframe, date DESC);
