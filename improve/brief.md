## IMPROVEMENT BRIEF — v22
Current: v21, 93/100, 2449 lines
Strategy: **METRIC-FOCUS**
Consecutive failures: 0
Mastered: 3 | Active: 8 | Queue: 7

### FOCUS: pixels metric (avg 73/100)
This is METRIC-FOCUS mode. Improve the "pixels" metric across all sites.
Worst: www.awwwards.com at 12/100

All metrics ranked by average:
  pixels          avg:73  worst:12 (www.awwwards.com)
  layout          avg:88  worst:59 (vercel.com)
  content         avg:93  worst:72 (notion.so)
  interactions    avg:93  worst:34 (www.roomshotels.com)
  images          avg:97  worst:62 (pentagram.com)
  links           avg:99  worst:84 (www.awwwards.com)
  css             avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()


### SITE SCORES (worst → best)
[NEEDS_WORK] www.awwwards.com          81/100
[NEEDS_WORK] pentagram.com             84/100
[NEEDS_WORK] www.roomshotels.com       86/100
[NEEDS_WORK] notion.so                 88/100
[OK        ] www.morganlewis.com       93/100
[OK        ] vercel.com                96/100
[OK        ] www.cravath.com           97/100
[PERFECT   ] cuberto.com               98/100
[PERFECT   ] www.apple.com             98/100
[PERFECT   ] linear.app                100/100
[PERFECT   ] stripe.com                100/100

### METRIC AVERAGES
  pixels          avg:73  worst:12 (www.awwwards.com)
  layout          avg:88  worst:59 (vercel.com)
  content         avg:93  worst:72 (notion.so)
  interactions    avg:93  worst:34 (www.roomshotels.com)
  images          avg:97  worst:62 (pentagram.com)
  links           avg:99  worst:84 (www.awwwards.com)
  css             avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### RECENT TECHNIQUES THAT WORKED
  v20: User-Agent + Accept headers on dl() for CDN compatibility → pentagram content: 50→92 (+42), cuberto pixels: 72→84 (+12), awwwards +1. morganlewis pixels variable (noise).
  v21: Unhide buttons with display:none ancestors for interaction scoring → morganlewis interactions: 57→100 (+43), layout: 84→89 (+5), overall: 89→95 (+6). No regressions on other sites.
  v21: aria-hidden expansion is UNSAFE for layout scoring → Reverted. Do NOT expand aria-hidden globally — it breaks layout scoring.

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v19: all_retries_exhausted
  v20: score_dropped — code: // v20: Robust download with retry on transient errors + redirect depth limit; function dl(url, dest, timeout = 15000, _
  v20: all_retries_exhausted — code: // v20: Robust download with retry on transient errors + redirect depth limit; function dl(url, dest, timeout = 15000, _

### VOLATILE METRICS (IGNORE — scores fluctuate naturally)
  www.cravath.com images: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com css: ±90 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com links: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com content: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com layout: ±75 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com interactions: ±92 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com console: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com pixels: ±97 (NON-DETERMINISTIC, don't try to fix)
  www.cravath.com manifest: ±100 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±16 (NON-DETERMINISTIC, don't try to fix)
  www.morganlewis.com pixels: ±13 (NON-DETERMINISTIC, don't try to fix)
  www.roomshotels.com interactions: ±14 (NON-DETERMINISTIC, don't try to fix)
  vercel.com layout: ±15 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v21-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v22-stable.js <worst-url> /tmp/test-v22 3
4. Quick single-site test available: node test/suite.js v22 --site <hostname>
5. Read improve/CLAUDE.md for rules
