-- 005_fix_fibonacci.sql
-- Fix Fibonacci persistence: add unique constraint for (timeframe, type, direction)
-- and clean up stale rows that lack JSONB levels.

-- Remove rows without valid levels (legacy data from old schema)
DELETE FROM btc_hub.fibonacci_levels WHERE levels IS NULL;

-- Add unique constraint so delete+insert pattern is safe
-- and prevents duplicate rows per (timeframe, type, direction)
ALTER TABLE btc_hub.fibonacci_levels
  ADD CONSTRAINT uq_fib_tf_type_dir UNIQUE (timeframe, type, direction);

-- Index on confluence_zones status for faster queries
CREATE INDEX IF NOT EXISTS idx_conf_status ON btc_hub.confluence_zones(status);
