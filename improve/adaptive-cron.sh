#!/bin/bash
# ═══════════════════════════════════════
# Adaptive Cron Runner for X-Ray Evolution
#
# Instead of fixed 6h intervals, adapts based on results:
#   Success → 3h (momentum)
#   1-3 failures → 6h (normal)
#   4-5 failures → 12h (back off)
#   6+ failures → 24h (deep back-off, strategy switches)
#   Rate limited → wait until reset
#
# Usage: Run from crontab every hour. Self-skips when not due.
# ═══════════════════════════════════════

XRAY_DIR="/opt/site-xray-creative"
SCHEDULE_FILE="$XRAY_DIR/improve/next-run.txt"

# Check if it's time to run
if [ -f "$SCHEDULE_FILE" ]; then
  NEXT_RUN=$(cat "$SCHEDULE_FILE" 2>/dev/null)
  NOW=$(date +%s)
  if [ "$NOW" -lt "$NEXT_RUN" ] 2>/dev/null; then
    # Not time yet
    exit 0
  fi
fi

# Run the cycle
cd "$XRAY_DIR"
./improve/cycle.sh --auto --notify >> /var/log/site-xray-creative/cycle.log 2>&1
EXIT_CODE=$?

# Determine next run delay based on result
FOCUS_FILE="$XRAY_DIR/improve/current-focus.json"
CONSECUTIVE_FAILS=0
if [ -f "$FOCUS_FILE" ]; then
  CONSECUTIVE_FAILS=$(node -e "const f=JSON.parse(require('fs').readFileSync('$FOCUS_FILE','utf-8'));console.log(f.consecutive_failures||0)" 2>/dev/null || echo 0)
fi

# Check for rate limiting
if grep -qi "rate limit\|hit your limit" /var/log/site-xray-creative/cycle.log 2>/dev/null | tail -5 | grep -qi "rate limit"; then
  # Rate limited — wait 6 hours from now
  DELAY=21600
  echo "   Adaptive: rate limited, next run in 6h"
elif [ "$CONSECUTIVE_FAILS" -eq 0 ]; then
  # Success! Run again in 3 hours
  DELAY=10800
  echo "   Adaptive: success, next run in 3h"
elif [ "$CONSECUTIVE_FAILS" -le 3 ]; then
  DELAY=21600  # 6h
  echo "   Adaptive: $CONSECUTIVE_FAILS failures, next run in 6h"
elif [ "$CONSECUTIVE_FAILS" -le 5 ]; then
  DELAY=43200  # 12h
  echo "   Adaptive: $CONSECUTIVE_FAILS failures, next run in 12h"
else
  DELAY=86400  # 24h
  echo "   Adaptive: $CONSECUTIVE_FAILS failures, next run in 24h"
fi

# Write next run time
NEXT=$(( $(date +%s) + DELAY ))
echo "$NEXT" > "$SCHEDULE_FILE"
echo "   Next run: $(date -d @$NEXT 2>/dev/null || date -r $NEXT 2>/dev/null || echo 'in ${DELAY}s')"
