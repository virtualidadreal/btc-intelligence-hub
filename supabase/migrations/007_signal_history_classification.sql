-- Migration 007: Add classification column and clean signal_history
-- Only VALID, STRONG and PREMIUM signals should be stored (score >= 55)

-- Add classification column
ALTER TABLE btc_hub.signal_history
    ADD COLUMN IF NOT EXISTS classification TEXT;

-- Clean all existing data to start fresh with new criteria
TRUNCATE TABLE btc_hub.signal_history;
