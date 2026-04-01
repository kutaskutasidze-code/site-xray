#!/bin/bash
# ═══════════════════════════════════════
# Site X-Ray Self-Improvement Cycle
# Runs Claude Code to analyze, improve, and test the cloning tool.
#
# Usage: ./improve/cycle.sh [--auto] [--notify]
#   --auto    Run without manual confirmation
#   --notify  Send iMessage notification on completion
# ═══════════════════════════════════════

set -e
XRAY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$XRAY_DIR"

AUTO=false
NOTIFY=false
for arg in "$@"; do
  case $arg in --auto) AUTO=true;; --notify) NOTIFY=true;; esac
done

# Detect current version
CURRENT_V=$(ls v*-stable.js 2>/dev/null | sed 's/v\([0-9]*\)-.*/\1/' | sort -n | tail -1)
NEXT_V=$((CURRENT_V + 1))

echo ""
echo "═══════════════════════════════════════"
echo "  Site X-Ray Self-Improvement Cycle"
echo "  Current: v${CURRENT_V} → Target: v${NEXT_V}"
echo "═══════════════════════════════════════"
echo ""

# ── Step 1: Test current version ──
echo "📊 Step 1: Testing v${CURRENT_V}..."
if [ ! -f "test/results/v${CURRENT_V}.json" ]; then
  node test/suite.js v${CURRENT_V}
else
  echo "   Using cached results for v${CURRENT_V}"
fi
CURRENT_SCORE=$(node -e "const r=require('./test/results/v${CURRENT_V}.json');console.log(r.averageScore)")
echo "   Current score: ${CURRENT_SCORE}/100"
echo ""

# ── Step 2: Run Claude Code to analyze and improve ──
echo "🤖 Step 2: Running Claude Code improvement cycle..."

PROMPT="You are improving site-xray, a web cloning tool.

Current version: v${CURRENT_V} (score: ${CURRENT_SCORE}/100)

The test suite already ran a full parallel pipeline: clone → score → deep analysis for ALL sites.
It produced per-site analysis reports and a cross-site synthesis. Your job is to READ these, THINK, then IMPLEMENT.

## Step 1: READ (do all of these first, before any code changes)
- Read \`test/results/v${CURRENT_V}/synthesis.md\` — the cross-site pattern analysis
- Read the individual \`*-analysis.md\` files for the 3 WORST scoring sites
- Read the screenshot PNGs for those sites (you can see images) — visually compare original vs clone
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
Read improve/CLAUDE.md for detailed rules."

if [ "$AUTO" = true ]; then
  echo "$PROMPT" | claude -p --allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch" --max-turns 50 > "improve/cycle-v${NEXT_V}.log" 2>&1
else
  echo "   Launching Claude Code interactively..."
  echo "   Prompt has been prepared. Run this in Claude Code:"
  echo ""
  echo "   $PROMPT" | head -5
  echo "   ..."
  echo ""
  read -p "   Press Enter after Claude Code completes, or Ctrl+C to cancel..."
fi

# ── Step 3: Verify new version exists ──
if [ ! -f "v${NEXT_V}-stable.js" ]; then
  echo "❌ v${NEXT_V}-stable.js was not created. Cycle failed."
  exit 1
fi
echo "   ✓ v${NEXT_V}-stable.js created ($(wc -l < v${NEXT_V}-stable.js) lines)"
echo ""

# ── Step 4: Test new version ──
echo "📊 Step 4: Testing v${NEXT_V}..."
node test/suite.js v${NEXT_V}
NEW_SCORE=$(node -e "const r=require('./test/results/v${NEXT_V}.json');console.log(r.averageScore)")
echo "   New score: ${NEW_SCORE}/100 (was ${CURRENT_SCORE}/100)"
echo ""

# ── Step 5: Compare ──
DIFF=$((NEW_SCORE - CURRENT_SCORE))
if [ $NEW_SCORE -ge $CURRENT_SCORE ]; then
  echo "✅ v${NEXT_V} improved by ${DIFF} points!"
  echo $NEXT_V > VERSION

  # Save to history
  node -e "
    const fs=require('fs');
    const h=fs.existsSync('improve/history.json')?JSON.parse(fs.readFileSync('improve/history.json','utf-8')):[];
    h.push({version:'v${NEXT_V}',score:${NEW_SCORE},prev_score:${CURRENT_SCORE},diff:${DIFF},date:new Date().toISOString()});
    fs.writeFileSync('improve/history.json',JSON.stringify(h,null,2));
  "

  # Git commit
  git add -A
  git commit -m "v${NEXT_V}: auto-improved (score: ${CURRENT_SCORE}→${NEW_SCORE}, +${DIFF})"

  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✅ Cycle complete: v${NEXT_V}"
  echo "  Score: ${CURRENT_SCORE} → ${NEW_SCORE} (+${DIFF})"
  echo "═══════════════════════════════════════"
else
  echo "❌ v${NEXT_V} scored lower (${NEW_SCORE} vs ${CURRENT_SCORE}). Discarding."
  rm -f "v${NEXT_V}-stable.js"
  echo "   Tip: re-run with different improvement focus"
fi

# ── Notify ──
if [ "$NOTIFY" = true ]; then
  MSG="🔬 Site X-Ray v${NEXT_V}: score ${CURRENT_SCORE}→${NEW_SCORE} (+${DIFF})"
  osascript -e "tell application \"Messages\" to send \"${MSG}\" to buddy \"591686262\" of (1st service whose service type = iMessage)" 2>/dev/null || true
fi
