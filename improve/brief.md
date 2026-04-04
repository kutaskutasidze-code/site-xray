## IMPROVEMENT BRIEF — v21
Current: v20, 89/100, 2415 lines
Strategy: **UNIVERSAL**
Consecutive failures: 1
Mastered: 3 | Active: 8 | Queue: 7

### MODE: UNIVERSAL
Find fixes that improve 3+ sites simultaneously.


### SITE SCORES (worst → best)
[NEEDS_WORK] www.morganlewis.com       89/100

### METRIC AVERAGES
  interactions    avg:57  worst:57 (www.morganlewis.com)
  pixels          avg:69  worst:69 (www.morganlewis.com)
  layout          avg:84  worst:84 (www.morganlewis.com)
  content         avg:91  worst:91 (www.morganlewis.com)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  links           avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### LAST 2 FAILED APPROACHES (DO NOT REPEAT)
  Attempt #undefined: no summary
  Attempt #1: // v20: Robust download with retry on transient errors + redirect depth limit
function dl(url, dest, timeout = 15000, _redirects = 0) {
      if (_red

### RECENT TECHNIQUES THAT WORKED
  v14: Universal overlay dismissal via viewport coverage → Removed promotional popups on Rooms Hotels and similar sites
  v14: Final external URL cleanup pass → Reduced external refs remaining across all sites
  v20: User-Agent + Accept headers on dl() for CDN compatibility → pentagram content: 50→92 (+42), cuberto pixels: 72→84 (+12), awwwards +1. morganlewis pixels variable (noise).

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

### INSTRUCTIONS
1. Read v20-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v21-stable.js <worst-url> /tmp/test-v21 3
4. Quick single-site test available: node test/suite.js v21 --site <hostname>
5. Read improve/CLAUDE.md for rules
