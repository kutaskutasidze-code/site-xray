#!/bin/bash
# ═══════════════════════════════════════
# Site X-Ray Self-Improvement Cycle v2
#
# Safety: PID lock, timeout, disk cleanup, health check
# Quality: per-site regression gate, retry with learning, knowledge base
# Notifications: webhook (works on Linux + macOS)
#
# Usage: ./improve/cycle.sh [--auto] [--notify] [--max-retries N]
# ═══════════════════════════════════════

set -euo pipefail
XRAY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$XRAY_DIR"

# ── Config ──
LOCK_FILE="/tmp/site-xray-cycle.lock"
MAX_CYCLE_TIME=5400  # 90 minutes max per cycle
MAX_RETRIES=2        # retry up to 2 times if improvement fails
KEEP_RESULTS=5       # keep last N test result directories
MIN_DISK_GB=5        # minimum free disk space in GB
WEBHOOK_URL=""       # set to Discord/Slack webhook URL for notifications
LOG_DIR="/var/log/site-xray"

AUTO=false
NOTIFY=false
for arg in "$@"; do
  case $arg in
    --auto) AUTO=true;;
    --notify) NOTIFY=true;;
    --max-retries=*) MAX_RETRIES="${arg#*=}";;
  esac
done

mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR="$XRAY_DIR/improve/logs" && mkdir -p "$LOG_DIR"

# ═══════════════════════════════════════
# SAFETY: PID lock — prevent overlapping cycles
# ═══════════════════════════════════════
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "❌ Cycle already running (PID $OLD_PID). Exiting."
    exit 1
  else
    echo "⚠ Stale lock found (PID $OLD_PID dead). Cleaning up."
    rm -f "$LOCK_FILE"
  fi
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

# ═══════════════════════════════════════
# SAFETY: Health check
# ═══════════════════════════════════════
health_check() {
  local ok=true

  # Check disk space
  local free_gb
  free_gb=$(df -BG "$XRAY_DIR" 2>/dev/null | tail -1 | awk '{print $4}' | tr -d 'G' || echo "999")
  if [ "$free_gb" -lt "$MIN_DISK_GB" ] 2>/dev/null; then
    echo "❌ HEALTH: Disk space low (${free_gb}GB free, need ${MIN_DISK_GB}GB)"
    ok=false
  fi

  # Check node
  if ! command -v node &>/dev/null; then
    echo "❌ HEALTH: Node.js not found"
    ok=false
  fi

  # Check playwright
  if ! node -e "require('playwright')" 2>/dev/null; then
    echo "❌ HEALTH: Playwright not installed"
    ok=false
  fi

  # Check Claude Code (only in auto mode)
  if [ "$AUTO" = true ]; then
    if ! command -v claude &>/dev/null; then
      echo "❌ HEALTH: Claude Code CLI not found"
      ok=false
    fi
  fi

  if [ "$ok" = false ]; then
    send_notification "❌ Site X-Ray health check FAILED — cycle skipped"
    exit 1
  fi
  echo "✓ Health check passed (${free_gb}GB free)"
}

# ═══════════════════════════════════════
# SAFETY: Disk cleanup — keep last N results
# ═══════════════════════════════════════
disk_cleanup() {
  local results_dir="$XRAY_DIR/test/results"
  if [ -d "$results_dir" ]; then
    local count
    count=$(ls -d "$results_dir"/v* 2>/dev/null | wc -l)
    if [ "$count" -gt "$((KEEP_RESULTS * 2))" ]; then
      echo "   Cleaning old results (keeping last $KEEP_RESULTS)..."
      ls -dt "$results_dir"/v*/ 2>/dev/null | tail -n +"$((KEEP_RESULTS + 1))" | xargs rm -rf 2>/dev/null || true
      ls -t "$results_dir"/v*.json 2>/dev/null | tail -n +"$((KEEP_RESULTS + 1))" | xargs rm -f 2>/dev/null || true
    fi
  fi
  # Clean old cycle logs
  ls -t "$XRAY_DIR"/improve/cycle-v*.log 2>/dev/null | tail -n +"$((KEEP_RESULTS + 1))" | xargs rm -f 2>/dev/null || true
}

# ═══════════════════════════════════════
# NOTIFICATION: webhook (Discord/Slack) + fallback iMessage
# ═══════════════════════════════════════
send_notification() {
  local msg="$1"

  # Try webhook first (works on any OS)
  if [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"content\": \"$msg\"}" 2>/dev/null || true
  fi

  # Try Telegram bot
  if [ -f "$XRAY_DIR/improve/telegram.conf" ]; then
    source "$XRAY_DIR/improve/telegram.conf"
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
      curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${msg}" \
        -d "parse_mode=Markdown" 2>/dev/null || true
    fi
  fi

  # Fallback: iMessage (macOS only)
  if command -v osascript &>/dev/null; then
    osascript -e "tell application \"Messages\" to send \"${msg}\" to buddy \"591686262\" of (1st service whose service type = iMessage)" 2>/dev/null || true
  fi
}

# ═══════════════════════════════════════
# PER-SITE REGRESSION CHECK
# ═══════════════════════════════════════
check_per_site_regression() {
  local old_results="$1"
  local new_results="$2"
  local max_drop="${3:-5}"  # max allowed per-site score drop

  local regressions
  regressions=$(node -e "
    const fs = require('fs');
    const oldR = JSON.parse(fs.readFileSync('$old_results', 'utf-8'));
    const newR = JSON.parse(fs.readFileSync('$new_results', 'utf-8'));
    const regressions = [];
    for (const oldSite of oldR.sites) {
      const newSite = newR.sites.find(s => s.site === oldSite.site);
      if (newSite && (oldSite.totalScore - newSite.totalScore) > $max_drop) {
        regressions.push({
          site: oldSite.site,
          old: oldSite.totalScore,
          new: newSite.totalScore,
          drop: oldSite.totalScore - newSite.totalScore
        });
      }
    }
    if (regressions.length > 0) {
      regressions.forEach(r => console.error('   REGRESSION: ' + r.site + ' dropped ' + r.drop + ' points (' + r.old + '→' + r.new + ')'));
      process.exit(1);
    }
    console.log('   ✓ No per-site regressions (max drop allowed: ${max_drop})');
  " 2>&1)

  local exit_code=$?
  echo "$regressions"
  return $exit_code
}

# ═══════════════════════════════════════
# KNOWLEDGE BASE: save learnings after each cycle
# ═══════════════════════════════════════
save_knowledge() {
  local version="$1"
  local result="$2"  # "success" or "failed"
  local score="$3"
  local prev_score="$4"
  local reason="${5:-}"

  node -e "
    const fs = require('fs');
    const kbFile = 'improve/knowledge.json';
    const kb = fs.existsSync(kbFile) ? JSON.parse(fs.readFileSync(kbFile, 'utf-8')) : { learnings: [], failed_approaches: [] };

    if ('$result' === 'success') {
      // Extract what changed from the cycle log
      const logFile = 'improve/cycle-$version.log';
      const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf-8').slice(-3000) : '';
      kb.learnings.push({
        version: '$version',
        score: $score,
        prev_score: $prev_score,
        diff: $score - $prev_score,
        date: new Date().toISOString(),
        log_tail: log.slice(-1000)
      });
    } else {
      kb.failed_approaches.push({
        version: '$version',
        attempted_score: $score,
        prev_score: $prev_score,
        reason: '$reason',
        date: new Date().toISOString()
      });
    }

    // Keep last 20 entries of each type
    kb.learnings = kb.learnings.slice(-20);
    kb.failed_approaches = kb.failed_approaches.slice(-20);

    fs.writeFileSync(kbFile, JSON.stringify(kb, null, 2));
  " 2>/dev/null || true
}

# ═══════════════════════════════════════
# MAIN CYCLE
# ═══════════════════════════════════════

echo ""
echo "═══════════════════════════════════════"
echo "  Site X-Ray Self-Improvement Cycle v2"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════"
echo ""

health_check
disk_cleanup

# Detect current version
CURRENT_V=$(ls v*-stable.js 2>/dev/null | sed 's/v\([0-9]*\)-.*/\1/' | sort -n | tail -1)
NEXT_V=$((CURRENT_V + 1))
echo "  Current: v${CURRENT_V} → Target: v${NEXT_V}"
echo ""

# ── Step 1: Test current version ──
echo "📊 Step 1: Testing v${CURRENT_V}..."
if [ ! -f "test/results/v${CURRENT_V}.json" ]; then
  timeout "$MAX_CYCLE_TIME" node test/suite.js v${CURRENT_V}
else
  echo "   Using cached results for v${CURRENT_V}"
fi
CURRENT_SCORE=$(node -e "const r=require('./test/results/v${CURRENT_V}.json');console.log(r.averageScore)")
echo "   Current score: ${CURRENT_SCORE}/100"
echo ""

# ── Step 2: Improvement loop (with retries) ──
ATTEMPT=0
SUCCESS=false
FAILURE_REASONS=""

while [ $ATTEMPT -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "🤖 Step 2: Improvement attempt ${ATTEMPT}/${MAX_RETRIES}..."

  # Build prompt to a temp file (avoids bash quoting issues with special chars in knowledge.json)
  PROMPT_FILE=$(mktemp /tmp/xray-prompt-XXXXX.txt)
  trap 'rm -f "$LOCK_FILE" "$PROMPT_FILE"' EXIT

  cat > "$PROMPT_FILE" <<PROMPT_EOF
You are improving site-xray, a web cloning tool.

Current version: v${CURRENT_V} (score: ${CURRENT_SCORE}/100)
PROMPT_EOF

  if [ $ATTEMPT -gt 1 ]; then
    cat >> "$PROMPT_FILE" <<RETRY_EOF

## PREVIOUS ATTEMPT FAILED
This is retry #${ATTEMPT}. Previous attempt failed because:
${FAILURE_REASONS}

Try a DIFFERENT approach. Do NOT repeat what was tried before.
Read improve/knowledge.json for past failures to avoid.
RETRY_EOF
  fi

  cat >> "$PROMPT_FILE" <<'STATIC_EOF'

The test suite already ran a full parallel pipeline: clone → score → deep analysis for ALL sites.
It produced per-site analysis reports and a cross-site synthesis. Your job is to READ these, THINK, then IMPLEMENT.

## Step 1: READ (do all of these first, before any code changes)
- Read `improve/knowledge.json` FIRST — see what worked and what FAILED in past cycles. Do NOT repeat failed approaches.
STATIC_EOF

  cat >> "$PROMPT_FILE" <<VERSION_EOF
- Read \`test/results/v${CURRENT_V}/synthesis.md\` — the cross-site pattern analysis
- Read the individual \`*-analysis.md\` files for the 3 WORST scoring sites
- Read the screenshot PNGs AND diff PNGs for those sites (you can see images) — visually compare original vs clone
- Read \`improve/history.json\` — see what was tried before
- Read \`v${CURRENT_V}-stable.js\` — understand current implementation

## Step 2: THINK (use structured reasoning, do NOT skip)
Before writing ANY code, reason through:
a) What are the top 3 failure CATEGORIES across sites? (from synthesis.md)
b) For each category: what is the ROOT CAUSE? (from per-site analyses)
c) What UNIVERSAL fix would address each root cause?
d) Will each fix help 3+ sites or just 1? (only implement if 3+)
e) Could any fix REGRESS existing sites? How to prevent?
Write your reasoning out before proceeding.

## Step 3: IMPLEMENT
- Copy v${CURRENT_V}-stable.js to v${NEXT_V}-stable.js
- Implement the 3-5 most universal fixes (ranked by cross-site impact from synthesis)
- Each fix: try/catch wrapped, clearly commented
- Update version strings to v${NEXT_V}

## Step 4: VERIFY
- Run: node v${NEXT_V}-stable.js <worst-site-url> /tmp/test-v${NEXT_V} 3
- Read the clone screenshots — does it look right?
- Check no regressions on a previously-good site too

Do NOT modify v${CURRENT_V}-stable.js — only create v${NEXT_V}-stable.js.
Read improve/CLAUDE.md for detailed rules.
VERSION_EOF

  if [ "$AUTO" = true ]; then
    # Run with timeout protection — pipe prompt file to claude
    if timeout "$MAX_CYCLE_TIME" bash -c "cat '$PROMPT_FILE' | claude -p --allowedTools 'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch' --max-turns 50 > 'improve/cycle-v${NEXT_V}.log' 2>&1"; then
      echo "   Claude Code completed."
    else
      # Check if it was a rate limit (not a timeout)
      if grep -qi "rate limit\|hit your limit\|resets.*UTC\|too many requests\|429" "improve/cycle-v${NEXT_V}.log" 2>/dev/null; then
        echo "   ⚠ Claude Code hit rate limit. Aborting cycle — will retry next cron window."
        FAILURE_REASONS="Claude Code rate limited. Waiting for limit reset."
        send_notification "⚠️ X-Ray cycle: Claude rate-limited. Will retry next cron window (6h)."
        # Break out of retry loop entirely — no point retrying rate limits
        break
      fi
      echo "   ⚠ Claude Code timed out or errored (attempt $ATTEMPT)"
      FAILURE_REASONS="Claude Code timed out or crashed. Try simpler, more focused fixes."
      continue
    fi
  else
    echo "   Prompt prepared. Run in Claude Code, then press Enter."
    echo ""
    echo "   $PROMPT" | head -5
    echo "   ..."
    echo ""
    read -p "   Press Enter after Claude Code completes, or Ctrl+C to cancel..."
  fi

  # ── Step 3: Verify new version exists ──
  if [ ! -f "v${NEXT_V}-stable.js" ]; then
    echo "   ❌ v${NEXT_V}-stable.js not created (attempt $ATTEMPT)"
    FAILURE_REASONS="v${NEXT_V}-stable.js was not created. Claude may have run out of turns."
    continue
  fi
  echo "   ✓ v${NEXT_V}-stable.js created ($(wc -l < v${NEXT_V}-stable.js | tr -d ' ') lines)"

  # ── Step 4: Test new version ──
  echo "📊 Step 4: Testing v${NEXT_V}..."
  if timeout "$MAX_CYCLE_TIME" node test/suite.js v${NEXT_V}; then
    echo "   Test complete."
  else
    echo "   ❌ Test suite failed or timed out (attempt $ATTEMPT)"
    FAILURE_REASONS="Test suite crashed or timed out. The new version may have a bug."
    rm -f "v${NEXT_V}-stable.js"
    continue
  fi

  NEW_SCORE=$(node -e "const r=require('./test/results/v${NEXT_V}.json');console.log(r.averageScore)")
  echo "   New score: ${NEW_SCORE}/100 (was ${CURRENT_SCORE}/100)"

  # ── Step 5: Per-site regression check ──
  echo ""
  echo "🔍 Step 5: Per-site regression check..."
  if check_per_site_regression "test/results/v${CURRENT_V}.json" "test/results/v${NEXT_V}.json" 5; then
    # No regressions — check if overall score improved
    DIFF=$((NEW_SCORE - CURRENT_SCORE))
    if [ $NEW_SCORE -ge $CURRENT_SCORE ]; then
      SUCCESS=true
    else
      echo "   ❌ Overall score dropped: ${NEW_SCORE} < ${CURRENT_SCORE} (attempt $ATTEMPT)"
      FAILURE_REASONS="Overall score dropped from ${CURRENT_SCORE} to ${NEW_SCORE}. Fixes may have hurt more sites than they helped."
      save_knowledge "v${NEXT_V}" "failed" "$NEW_SCORE" "$CURRENT_SCORE" "score_dropped"
      rm -f "v${NEXT_V}-stable.js"
    fi
  else
    echo "   ❌ Per-site regression detected (attempt $ATTEMPT)"
    FAILURE_REASONS="One or more sites regressed by more than 5 points. The fix helped some sites but broke others."
    save_knowledge "v${NEXT_V}" "failed" "$NEW_SCORE" "$CURRENT_SCORE" "per_site_regression"
    rm -f "v${NEXT_V}-stable.js"
  fi
done

# ── Step 6: Accept or reject ──
if [ "$SUCCESS" = true ]; then
  DIFF=$((NEW_SCORE - CURRENT_SCORE))
  echo ""
  echo "✅ v${NEXT_V} improved by ${DIFF} points! (${CURRENT_SCORE}→${NEW_SCORE})"
  echo $NEXT_V > VERSION

  # Save to history
  node -e "
    const fs=require('fs');
    const h=fs.existsSync('improve/history.json')?JSON.parse(fs.readFileSync('improve/history.json','utf-8')):[];
    h.push({version:'v${NEXT_V}',score:${NEW_SCORE},prev_score:${CURRENT_SCORE},diff:${DIFF},date:new Date().toISOString(),attempts:${ATTEMPT}});
    fs.writeFileSync('improve/history.json',JSON.stringify(h,null,2));
  "

  # Save knowledge
  save_knowledge "v${NEXT_V}" "success" "$NEW_SCORE" "$CURRENT_SCORE"

  # Git commit + push to GitHub
  git add -A
  git commit -m "v${NEXT_V}: auto-improved (score: ${CURRENT_SCORE}→${NEW_SCORE}, +${DIFF}, attempts: ${ATTEMPT})"
  GIT_SSH_COMMAND='ssh -o StrictHostKeyChecking=no' git push origin main 2>/dev/null || echo "   ⚠ Git push failed (non-critical)"

  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✅ Cycle complete: v${NEXT_V}"
  echo "  Score: ${CURRENT_SCORE} → ${NEW_SCORE} (+${DIFF})"
  echo "  Attempts: ${ATTEMPT}/${MAX_RETRIES}"
  echo "═══════════════════════════════════════"

  if [ "$NOTIFY" = true ]; then
    send_notification "✅ Site X-Ray v${NEXT_V}: ${CURRENT_SCORE}→${NEW_SCORE} (+${DIFF}) in ${ATTEMPT} attempt(s)"
  fi
else
  echo ""
  echo "═══════════════════════════════════════"
  echo "  ❌ All ${MAX_RETRIES} attempts failed"
  echo "  Score stuck at: ${CURRENT_SCORE}/100"
  echo "  Last failure: ${FAILURE_REASONS}"
  echo "═══════════════════════════════════════"

  save_knowledge "v${NEXT_V}" "failed" "${CURRENT_SCORE}" "${CURRENT_SCORE}" "all_retries_exhausted"

  # ── Plateau detection (only count entries with real scores) ──
  PLATEAU=$(node -e "
    const fs=require('fs');
    const h=fs.existsSync('improve/history.json')?JSON.parse(fs.readFileSync('improve/history.json','utf-8')):[];
    const scored=h.filter(r=>typeof r.score==='number' && typeof r.diff==='number');
    const recent=scored.slice(-3);
    if(recent.length>=3 && recent.every(r=>Math.abs(r.diff)<=1)){
      console.log('PLATEAU');
    } else { console.log('OK'); }
  " 2>/dev/null || echo "OK")

  if [ "$PLATEAU" = "PLATEAU" ]; then
    echo ""
    echo "  ⚠ PLATEAU DETECTED: Last 3 cycles improved ≤1 point each."
    echo "  Patching is no longer effective. Architecture review needed."
    if [ "$NOTIFY" = true ]; then
      send_notification "⚠ Site X-Ray PLATEAU at ${CURRENT_SCORE}/100 — architecture review needed"
    fi
  else
    if [ "$NOTIFY" = true ]; then
      send_notification "❌ Site X-Ray cycle failed after ${MAX_RETRIES} attempts. Score: ${CURRENT_SCORE}/100"
    fi
  fi
fi

# ── Final cleanup ──
disk_cleanup
echo ""
echo "  $(date '+%Y-%m-%d %H:%M:%S') — cycle done"
