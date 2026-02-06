-- Portfolio Positions — Track trading positions
CREATE TABLE IF NOT EXISTS btc_hub.portfolio_positions (
    id BIGSERIAL PRIMARY KEY,
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    direction TEXT NOT NULL,            -- LONG, SHORT
    entry_price NUMERIC(12,2) NOT NULL,
    exit_price NUMERIC(12,2),
    size_btc NUMERIC(10,6) NOT NULL,
    sl NUMERIC(12,2),
    tp1 NUMERIC(12,2),
    tp2 NUMERIC(12,2),
    status TEXT DEFAULT 'open',         -- open, closed
    pnl_usd NUMERIC(12,2),
    pnl_percent NUMERIC(8,4),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying open/closed positions
CREATE INDEX IF NOT EXISTS idx_portfolio_status ON btc_hub.portfolio_positions(status);
CREATE INDEX IF NOT EXISTS idx_portfolio_opened ON btc_hub.portfolio_positions(opened_at DESC);
