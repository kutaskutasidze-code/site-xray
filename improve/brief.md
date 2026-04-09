## IMPROVEMENT BRIEF — v37
Current: v36, 95/100, 3107 lines
Strategy: **METRIC-FOCUS**
Consecutive failures: 0
Mastered: 4 | Active: 6 | Queue: 0

### FOCUS: pixels metric (avg 74/100)
This is METRIC-FOCUS mode. Improve the "pixels" metric across all sites.
Worst: bruno-simon.com at 3/100

All metrics ranked by average:
  pixels          avg:74  worst:3 (bruno-simon.com)
  content         avg:94  worst:50 (bruno-simon.com)
  layout          avg:97  worst:66 (www.awwwards.com)
  links           avg:99  worst:86 (www.awwwards.com)
  images          avg:100  worst:95 (bruno-simon.com)
  css             avg:100  worst:100 ()
  interactions    avg:100  worst:98 (www.freezpak.com)
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()


### SITE SCORES (worst → best)
[NEEDS_WORK] bruno-simon.com           79/100
[NEEDS_WORK] www.locomotive.ca         89/100
[OK        ] www.awwwards.com          91/100
[OK        ] cuberto.com               96/100
[OK        ] basement.studio           97/100
[PERFECT   ] lusion.co                 98/100
[PERFECT   ] ingamana.com              99/100
[PERFECT   ] pentagram.com             99/100
[PERFECT   ] resn.co.nz                100/100
[PERFECT   ] www.freezpak.com          100/100

### METRIC AVERAGES
  pixels          avg:74  worst:3 (bruno-simon.com)
  content         avg:94  worst:50 (bruno-simon.com)
  layout          avg:97  worst:66 (www.awwwards.com)
  links           avg:99  worst:86 (www.awwwards.com)
  images          avg:100  worst:95 (bruno-simon.com)
  interactions    avg:100  worst:98 (www.freezpak.com)
  css             avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v32: score_dropped — code: let allCapturedText = new Set(); // v32: accumulate text from all pages and scroll positions; // v32: Enhanced capture —
  v32: all_retries_exhausted — code: let allCapturedText = new Set(); // v32: accumulate text from all pages and scroll positions; // v32: Enhanced capture —
  v35: all_retries_exhausted — code: // v34: PIXEL FIX — Capture viewport screenshot EARLY (right after page load, before scrolling); // For canvas/WebGL sit

### VOLATILE METRICS (IGNORE — scores fluctuate naturally)
  basement.studio images: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio css: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio links: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio content: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio layout: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio interactions: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio console: ±100 (NON-DETERMINISTIC, don't try to fix)
  basement.studio pixels: ±83 (NON-DETERMINISTIC, don't try to fix)
  basement.studio manifest: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca layout: ±29 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±22 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±82 (NON-DETERMINISTIC, don't try to fix)
  lusion.co content: ±27 (NON-DETERMINISTIC, don't try to fix)
  lusion.co pixels: ±80 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz content: ±100 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v36-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v37-stable.js <worst-url> /tmp/test-v37 3
4. Quick single-site test available: node test/suite.js v37 --site <hostname>
5. Read improve/CLAUDE.md for rules
