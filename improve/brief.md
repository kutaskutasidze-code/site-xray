## IMPROVEMENT BRIEF — v32
Current: v31, 99/100, 2929 lines
Strategy: **METRIC-FOCUS**
Consecutive failures: 1
Mastered: 4 | Active: 6 | Queue: 0

### FOCUS: content metric (avg 90/100)
This is METRIC-FOCUS mode. Improve the "content" metric across all sites.
Worst: pentagram.com at 90/100

All metrics ranked by average:
  content         avg:90  worst:90 (pentagram.com)
  interactions    avg:99  worst:99 (pentagram.com)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  links           avg:100  worst:100 ()
  layout          avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  pixels          avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()


### SITE SCORES (worst → best)
[PERFECT   ] pentagram.com             99/100

### METRIC AVERAGES
  content         avg:90  worst:90 (pentagram.com)
  interactions    avg:99  worst:99 (pentagram.com)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  links           avg:100  worst:100 ()
  layout          avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  pixels          avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v27: all_retries_exhausted
  v30: score_dropped_due_to_new_site_in_pool — code: First attempt: gl.readPixels + hardcoded fallback + relaxed canvas condition — regressed lusion.co. Second attempt: Play
  v31: all_retries_exhausted — code: // v30: For full-viewport canvas sites (WebGL/WebGPU), sample pixel from Playwright screenshot; // v30: If body bg is st

### VOLATILE METRICS (IGNORE — scores fluctuate naturally)
  basement.studio pixels: ±11 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±22 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±15 (NON-DETERMINISTIC, don't try to fix)
  lusion.co content: ±27 (NON-DETERMINISTIC, don't try to fix)
  lusion.co pixels: ±80 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz content: ±100 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v31-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v32-stable.js <worst-url> /tmp/test-v32 3
4. Quick single-site test available: node test/suite.js v32 --site <hostname>
5. Read improve/CLAUDE.md for rules
