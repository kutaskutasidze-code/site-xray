## IMPROVEMENT BRIEF — v19
Current: v18, 0/100, 2362 lines
Strategy: **UNIVERSAL**
Consecutive failures: 19
Mastered: 2 | Active: 8 | Queue: 8

### MODE: UNIVERSAL
Find fixes that improve 3+ sites simultaneously.


### SITE SCORES (worst → best)
[NEEDS_WORK] www.cravath.com           0/100

### METRIC AVERAGES

### RECENT TECHNIQUES THAT WORKED
  v14: www/non-www URL rewriting → Rooms Hotels images: 0→100 rendered, score 54→85
  v14: Universal overlay dismissal via viewport coverage → Removed promotional popups on Rooms Hotels and similar sites
  v14: Final external URL cleanup pass → Reduced external refs remaining across all sites

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v18: all_retries_exhausted
  v18: all_retries_exhausted
  v19: all_retries_exhausted

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

### INSTRUCTIONS
1. Read v18-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v19-stable.js <worst-url> /tmp/test-v19 3
4. Quick single-site test available: node test/suite.js v19 --site <hostname>
5. Read improve/CLAUDE.md for rules
