## IMPROVEMENT BRIEF — v24
Current: v23, 95/100, 2530 lines
Strategy: **METRIC-FOCUS**
Consecutive failures: 0
Mastered: 3 | Active: 8 | Queue: 7

### FOCUS: pixels metric (avg 80/100)
This is METRIC-FOCUS mode. Improve the "pixels" metric across all sites.
Worst: pentagram.com at 39/100

All metrics ranked by average:
  pixels          avg:80  worst:39 (pentagram.com)
  interactions    avg:92  worst:42 (www.roomshotels.com)
  layout          avg:93  worst:59 (vercel.com)
  content         avg:95  worst:72 (notion.so)
  links           avg:98  worst:84 (www.awwwards.com)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()


### SITE SCORES (worst → best)
[NEEDS_WORK] notion.so                 88/100
[OK        ] pentagram.com             90/100
[OK        ] www.awwwards.com          93/100
[OK        ] www.morganlewis.com       94/100
[OK        ] cuberto.com               95/100
[OK        ] www.roomshotels.com       95/100
[OK        ] vercel.com                95/100
[OK        ] www.cravath.com           96/100
[PERFECT   ] www.apple.com             98/100
[PERFECT   ] linear.app                99/100
[PERFECT   ] stripe.com                100/100

### METRIC AVERAGES
  pixels          avg:80  worst:39 (pentagram.com)
  interactions    avg:92  worst:42 (www.roomshotels.com)
  layout          avg:93  worst:59 (vercel.com)
  content         avg:95  worst:72 (notion.so)
  links           avg:98  worst:84 (www.awwwards.com)
  images          avg:100  worst:100 ()
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
  www.cravath.com pixels: ±19 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±18 (NON-DETERMINISTIC, don't try to fix)
  www.morganlewis.com interactions: ±25 (NON-DETERMINISTIC, don't try to fix)
  www.morganlewis.com pixels: ±13 (NON-DETERMINISTIC, don't try to fix)
  www.roomshotels.com layout: ±18 (NON-DETERMINISTIC, don't try to fix)
  www.roomshotels.com pixels: ±41 (NON-DETERMINISTIC, don't try to fix)
  www.awwwards.com content: ±12 (NON-DETERMINISTIC, don't try to fix)
  www.awwwards.com pixels: ±70 (NON-DETERMINISTIC, don't try to fix)
  vercel.com layout: ±15 (NON-DETERMINISTIC, don't try to fix)
  notion.so pixels: ±13 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v23-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v24-stable.js <worst-url> /tmp/test-v24 3
4. Quick single-site test available: node test/suite.js v24 --site <hostname>
5. Read improve/CLAUDE.md for rules
