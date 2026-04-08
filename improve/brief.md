## IMPROVEMENT BRIEF — v36
Current: v35, 85/100, 3059 lines
Strategy: **UNIVERSAL**
Consecutive failures: 1
Mastered: 4 | Active: 6 | Queue: 0

### MODE: UNIVERSAL
Find fixes that improve 3+ sites simultaneously.


### SITE SCORES (worst → best)
[NEEDS_WORK] www.locomotive.ca         85/100

### METRIC AVERAGES
  pixels          avg:17  worst:17 (www.locomotive.ca)
  layout          avg:71  worst:71 (www.locomotive.ca)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  links           avg:100  worst:100 ()
  content         avg:100  worst:100 ()
  interactions    avg:100  worst:100 ()
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
  www.locomotive.ca images: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca css: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca links: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca content: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca layout: ±71 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca interactions: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca console: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca pixels: ±40 (NON-DETERMINISTIC, don't try to fix)
  www.locomotive.ca manifest: ±100 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±22 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±16 (NON-DETERMINISTIC, don't try to fix)
  lusion.co content: ±27 (NON-DETERMINISTIC, don't try to fix)
  lusion.co pixels: ±80 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz content: ±100 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v35-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v36-stable.js <worst-url> /tmp/test-v36 3
4. Quick single-site test available: node test/suite.js v36 --site <hostname>
5. Read improve/CLAUDE.md for rules
