#!/bin/bash
# BTC Intelligence Hub — Automated Alert Check
# Crontab: 0 * * * * /path/to/check_alerts.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/alerts_$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

echo "=== Alert check started: $(date) ===" >> "$LOG_FILE"

cd "$PROJECT_DIR" || exit 1

# Activate virtual environment if exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# Run alert check
python -m btc_intel.cli alerts check >> "$LOG_FILE" 2>&1

echo "=== Alert check completed: $(date) ===" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Cleanup old logs (keep 30 days)
find "$LOG_DIR" -name "alerts_*.log" -mtime +30 -delete 2>/dev/null
