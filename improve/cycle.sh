#!/bin/bash
# ═══════════════════════════════════════
# Site X-Ray Self-Improvement Cycle v3
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
      // Enrich failure with diff summary and per-site regressions
      const entry = {
        version: '$version',
        attempted_score: $score,
        prev_score: $prev_score,
        reason: '$reason',
        date: new Date().toISOString()
      };
      // Add diff summary if available
      const diffFile = 'improve/last-attempt.diff';
      if (fs.existsSync(diffFile)) {
        const diff = fs.readFileSync(diffFile, 'utf-8');
        entry.diff_lines_added = (diff.match(/^>/gm) || []).length;
        entry.diff_lines_removed = (diff.match(/^</gm) || []).length;
        const summaryLines = diff.split('\\n')
          .filter(l => l.startsWith('>'))
          .filter(l => /\/\/\s|function\s|const\s|let\s|class\s|async\s/.test(l))
          .slice(0, 8)
          .map(l => l.replace(/^>\s*/, '').trim());
        if (summaryLines.length) entry.diff_summary = summaryLines.join('; ');
      }
      // Add per-site score comparison if available
      const scoresFile = 'improve/last-attempt-scores.json';
      if (fs.existsSync(scoresFile)) {
        try {
          const scores = JSON.parse(fs.readFileSync(scoresFile, 'utf-8'));
          const regs = scores.filter(s => s.diff < -3).map(s => s.site + ': ' + s.old + '→' + s.new + ' (' + s.diff + ')');
          if (regs.length) entry.regressions = regs;
          const imps = scores.filter(s => s.diff > 3).map(s => s.site + ': ' + s.old + '→' + s.new + ' (+' + s.diff + ')');
          if (imps.length) entry.improvements = imps;
        } catch(e) {}
      }
      kb.failed_approaches.push(entry);
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
echo "  Site X-Ray Self-Improvement Cycle v3"
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

# ── Cross-run persistent context ──
FOCUS_FILE="$XRAY_DIR/improve/current-focus.json"
if [ ! -f "$FOCUS_FILE" ]; then
  echo '{"consecutive_failures":0,"last_approaches":[],"regressions_seen":[],"current_strategy":"universal"}' > "$FOCUS_FILE"
  echo "   Created fresh cross-run context"
else
  CONSEC=$(node -e "const f=JSON.parse(require('fs').readFileSync('$FOCUS_FILE','utf-8'));console.log(f.consecutive_failures||0)" 2>/dev/null || echo "?")
  echo "   Cross-run context loaded (consecutive failures: ${CONSEC})"
fi

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

# ── Auto-select strategy based on score + failure count ──
STRATEGY=$(node -e "
  const fs=require('fs');
  const focus=JSON.parse(fs.readFileSync('improve/current-focus.json','utf-8'));
  const score=${CURRENT_SCORE};
  const fails=focus.consecutive_failures||0;
  if(fails>=10) console.log('refactor');
  else if(score>=93 && fails<10) console.log('metric-focus');
  else if(score>=90) console.log('per-site');
  else console.log('universal');
" 2>/dev/null || echo "universal")

CONSEC_FOR_LOG=$(node -e "const f=JSON.parse(require('fs').readFileSync('improve/current-focus.json','utf-8'));console.log(f.consecutive_failures||0)" 2>/dev/null || echo 0)
echo "   Strategy: ${STRATEGY} (score: ${CURRENT_SCORE}, failures: ${CONSEC_FOR_LOG})"

# Save strategy to focus file
node -e "const fs=require('fs');const f=JSON.parse(fs.readFileSync('improve/current-focus.json','utf-8'));f.current_strategy='${STRATEGY}';fs.writeFileSync('improve/current-focus.json',JSON.stringify(f,null,2));" 2>/dev/null

# Adjust max-turns based on strategy
case "$STRATEGY" in
  universal) MAX_TURNS=50;;
  per-site) MAX_TURNS=80;;
  metric-focus) MAX_TURNS=70;;
  refactor) MAX_TURNS=30;;
  *) MAX_TURNS=50;;
esac
echo "   Max turns: ${MAX_TURNS}"

# Generate focused improvement brief
node improve/generate-brief.js "$XRAY_DIR" "$CURRENT_V" "$STRATEGY" 2>/dev/null
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

  # Read cross-run context for prompt injection
  FOCUS_CONTEXT=""
  if [ -f "$FOCUS_FILE" ]; then
    FOCUS_CONTEXT=$(cat "$FOCUS_FILE")
  fi

  cat > "$PROMPT_FILE" <<PROMPT_EOF
You are improving site-xray, a web cloning tool.

Current version: v${CURRENT_V} (score: ${CURRENT_SCORE}/100)
PROMPT_EOF

  # Inject cross-run context if failures exist
  CONSEC_FAILURES=$(node -e "const f=JSON.parse(require('fs').readFileSync('$FOCUS_FILE','utf-8'));console.log(f.consecutive_failures||0)" 2>/dev/null || echo "0")
  if [ "$CONSEC_FAILURES" -gt 0 ] 2>/dev/null; then
    cat >> "$PROMPT_FILE" <<FOCUS_EOF

## Cross-Run Context (CRITICAL -- read this first)
This system has FAILED ${CONSEC_FAILURES} consecutive improvement cycles across multiple cron runs.
Full context of what was tried and what regressed:

${FOCUS_CONTEXT}

If consecutive_failures > 0, previous attempts are listed with what code they changed.
DO NOT repeat approaches that already failed. Try something fundamentally different.
If a site appears in regressions_seen multiple times, do NOT modify code that affects it.
Focus on SAFE, incremental changes that cannot regress existing high-scoring sites.
FOCUS_EOF
  fi

  if [ $ATTEMPT -gt 1 ]; then
    cat >> "$PROMPT_FILE" <<RETRY_EOF

## PREVIOUS ATTEMPT FAILED
This is retry #${ATTEMPT}. Previous attempt failed because:
${FAILURE_REASONS}

Try a DIFFERENT approach. Do NOT repeat what was tried before.
Read improve/knowledge.json for past failures to avoid.
RETRY_EOF
  fi

  cat >> "$PROMPT_FILE" <<VERSION_EOF

Strategy for this cycle: **${STRATEGY}**

## Step 1: READ THE BRIEF
Read \`improve/brief.md\` — it contains everything pre-digested:
- Current scores per site and per metric
- What strategy to use and what to focus on
- Last failed approaches (DO NOT repeat them)
- Sites that regressed in past attempts
- Recent techniques that worked
- Volatile metrics to ignore

Then read \`v${CURRENT_V}-stable.js\` — the code to improve.
Then read \`improve/CLAUDE.md\` for rules.
That's it. Do NOT spend turns reading synthesis.md, analysis files, or history — the brief already has everything.

## Step 2: THINK (use structured reasoning, do NOT skip)
Before writing ANY code, reason through:
a) Based on the brief's strategy (${STRATEGY}), what is the SPECIFIC focus?
b) What are the root causes of the lowest scores?
c) What 2-4 targeted fixes address these root causes?
d) Could any fix REGRESS existing sites? How to prevent?
Write your reasoning out before proceeding.

## Step 3: IMPLEMENT
- Copy v${CURRENT_V}-stable.js to v${NEXT_V}-stable.js
- Implement 2-4 targeted fixes based on the strategy
- Each fix: try/catch wrapped, clearly commented
- Update version strings to v${NEXT_V}

## Step 4: VERIFY
- Run: node v${NEXT_V}-stable.js <worst-site-url> /tmp/test-v${NEXT_V} 3
- Quick single-site test: node test/suite.js v${NEXT_V} --site <hostname>
- Check no regressions on a previously-good site too

Do NOT modify v${CURRENT_V}-stable.js — only create v${NEXT_V}-stable.js.
VERSION_EOF

  if [ "$AUTO" = true ]; then
    # Run with timeout protection — pipe prompt file to claude
    if timeout "$MAX_CYCLE_TIME" bash -c "cat '$PROMPT_FILE' | claude -p --allowedTools 'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch' --max-turns ${MAX_TURNS} > 'improve/cycle-v${NEXT_V}.log' 2>&1"; then
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

  # ── Save what Claude changed (for learning from failures) ──
  diff "v${CURRENT_V}-stable.js" "v${NEXT_V}-stable.js" > "improve/last-attempt.diff" 2>/dev/null || true
  DIFF_LINES_ADDED=$(grep -c '^>' "improve/last-attempt.diff" 2>/dev/null || echo 0)
  DIFF_LINES_REMOVED=$(grep -c '^<' "improve/last-attempt.diff" 2>/dev/null || echo 0)
  DIFF_SUMMARY=$(grep '^>' "improve/last-attempt.diff" | grep -E '// |function |const ' | head -5 | sed 's/^> //' | tr '\n' '; ' || echo "no summary")
  echo "   Diff captured: +${DIFF_LINES_ADDED}/-${DIFF_LINES_REMOVED} lines"

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

  # ── Save per-site score comparison (before accept/reject decision) ──
  node -e "
    const fs=require('fs');
    const oldR=JSON.parse(fs.readFileSync('test/results/v${CURRENT_V}.json','utf-8'));
    const newR=JSON.parse(fs.readFileSync('test/results/v${NEXT_V}.json','utf-8'));
    const comparison=oldR.sites.map(o=>{
      const n=newR.sites.find(s=>s.site===o.site);
      return {site:o.site, old:o.totalScore, new:n?.totalScore||0, diff:(n?.totalScore||0)-o.totalScore};
    }).sort((a,b)=>a.diff-b.diff);
    fs.writeFileSync('improve/last-attempt-scores.json',JSON.stringify(comparison,null,2));
  " 2>/dev/null || true

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
      # Update cross-run context with failure details
      node -e "
        const fs=require('fs');
        const f=JSON.parse(fs.readFileSync('$FOCUS_FILE','utf-8'));
        f.consecutive_failures++;
        const diffSum=fs.existsSync('improve/last-attempt.diff') ?
          require('child_process').execSync('grep \"^>\" improve/last-attempt.diff | grep -E \"// |function |const \" | head -5 | sed \"s/^> //\"', {encoding:'utf-8'}).trim() : '';
        if(diffSum) f.last_approaches.push({attempt:f.consecutive_failures, summary:diffSum, date:new Date().toISOString()});
        f.last_approaches=f.last_approaches.slice(-10);
        const scores=fs.existsSync('improve/last-attempt-scores.json')?JSON.parse(fs.readFileSync('improve/last-attempt-scores.json','utf-8')):[];
        const regs=scores.filter(s=>s.diff<-3).map(s=>s.site+': '+s.old+'->'+s.new);
        if(regs.length) f.regressions_seen.push(...regs);
        f.regressions_seen=[...new Set(f.regressions_seen)].slice(-10);
        f.last_failure_date=new Date().toISOString();
        fs.writeFileSync('$FOCUS_FILE',JSON.stringify(f,null,2));
      " 2>/dev/null || true
      rm -f "v${NEXT_V}-stable.js"
    fi
  else
    echo "   ❌ Per-site regression detected (attempt $ATTEMPT)"
    FAILURE_REASONS="One or more sites regressed by more than 5 points. The fix helped some sites but broke others."
    save_knowledge "v${NEXT_V}" "failed" "$NEW_SCORE" "$CURRENT_SCORE" "per_site_regression"
    # Update cross-run context with failure details
    node -e "
      const fs=require('fs');
      const f=JSON.parse(fs.readFileSync('$FOCUS_FILE','utf-8'));
      f.consecutive_failures++;
      const diffSum=fs.existsSync('improve/last-attempt.diff') ?
        require('child_process').execSync('grep \"^>\" improve/last-attempt.diff | grep -E \"// |function |const \" | head -5 | sed \"s/^> //\"', {encoding:'utf-8'}).trim() : '';
      if(diffSum) f.last_approaches.push({attempt:f.consecutive_failures, summary:diffSum, date:new Date().toISOString()});
      f.last_approaches=f.last_approaches.slice(-10);
      const scores=fs.existsSync('improve/last-attempt-scores.json')?JSON.parse(fs.readFileSync('improve/last-attempt-scores.json','utf-8')):[];
      const regs=scores.filter(s=>s.diff<-3).map(s=>s.site+': '+s.old+'->'+s.new);
      if(regs.length) f.regressions_seen.push(...regs);
      f.regressions_seen=[...new Set(f.regressions_seen)].slice(-10);
      f.last_failure_date=new Date().toISOString();
      fs.writeFileSync('$FOCUS_FILE',JSON.stringify(f,null,2));
    " 2>/dev/null || true
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

  # Reset cross-run context on success
  node -e "
    const fs=require('fs');
    fs.writeFileSync('$FOCUS_FILE',JSON.stringify({
      consecutive_failures:0,
      last_approaches:[],
      regressions_seen:[],
      current_strategy:'universal',
      last_success_date:new Date().toISOString(),
      last_success_version:'v${NEXT_V}',
      last_success_score:${NEW_SCORE}
    },null,2));
  " 2>/dev/null || true

  # Git commit + push to GitHub
  git add -A
  git commit -m "v${NEXT_V}: auto-improved (score: ${CURRENT_SCORE}→${NEW_SCORE}, +${DIFF}, strategy: ${STRATEGY}, attempts: ${ATTEMPT})"
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

  # Update cross-run context for total failure (if not already updated per-attempt)
  node -e "
    const fs=require('fs');
    const f=JSON.parse(fs.readFileSync('$FOCUS_FILE','utf-8'));
    // Only increment if inner loop didn't already (e.g. Claude never created the file)
    if(f.consecutive_failures < 1) f.consecutive_failures = 1;
    f.last_failure_date=new Date().toISOString();
    f.last_failure_reason='${FAILURE_REASONS}'.slice(0,200);
    fs.writeFileSync('$FOCUS_FILE',JSON.stringify(f,null,2));
  " 2>/dev/null || true

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
