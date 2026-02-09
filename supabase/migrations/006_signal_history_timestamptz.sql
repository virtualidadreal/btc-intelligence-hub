-- Migration 006: Change signal_history.date from DATE to TIMESTAMPTZ
-- This allows storing multiple snapshots per day (hourly cron)

-- Drop the old unique constraint
ALTER TABLE btc_hub.signal_history DROP CONSTRAINT IF EXISTS signal_history_date_timeframe_key;

-- Change column type from DATE to TIMESTAMPTZ
ALTER TABLE btc_hub.signal_history
    ALTER COLUMN date TYPE TIMESTAMPTZ USING date::timestamptz;

-- Recreate unique constraint on full timestamp + timeframe
ALTER TABLE btc_hub.signal_history
    ADD CONSTRAINT signal_history_date_timeframe_key UNIQUE (date, timeframe);
