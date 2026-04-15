## IMPROVEMENT BRIEF — v48
Current: v47, 97/100, 3358 lines
Strategy: **METRIC-FOCUS**
Consecutive failures: 1
Mastered: 4 | Active: 6 | Queue: 0

### FOCUS: pixels metric (avg 77/100)
This is METRIC-FOCUS mode. Improve the "pixels" metric across all sites.
Worst: ingamana.com at 77/100

All metrics ranked by average:
  pixels          avg:77  worst:77 (ingamana.com)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  links           avg:100  worst:100 ()
  content         avg:100  worst:100 ()
  layout          avg:100  worst:100 ()
  interactions    avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()


### SITE SCORES (worst → best)
[OK        ] ingamana.com              97/100

### METRIC AVERAGES
  pixels          avg:77  worst:77 (ingamana.com)
  images          avg:100  worst:100 ()
  css             avg:100  worst:100 ()
  links           avg:100  worst:100 ()
  content         avg:100  worst:100 ()
  layout          avg:100  worst:100 ()
  interactions    avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v47: all_retries_exhausted — code: // v46: Handle SVG fragment references (e.g. /images/sprite.svg#icon); // These break the link checker because the #frag
  v48: score_dropped — code: // v48: PIXEL FIX — Fully reveal scroll-driven content before DOM capture.; // Problem: --base-height captured at a smal
  v48: all_retries_exhausted — code: // v48: PIXEL FIX — Reveal scroll-driven content before DOM capture.; // Setting --progress to 1 matches the "fully load

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
  www.locomotive.ca pixels: ±21 (NON-DETERMINISTIC, don't try to fix)
  pentagram.com css: ±85 (NON-DETERMINISTIC, don't try to fix)
  pentagram.com content: ±44 (NON-DETERMINISTIC, don't try to fix)
  pentagram.com layout: ±100 (NON-DETERMINISTIC, don't try to fix)
  pentagram.com interactions: ±49 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com images: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com css: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com links: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com content: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com layout: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com interactions: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com console: ±100 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com pixels: ±90 (NON-DETERMINISTIC, don't try to fix)
  ingamana.com manifest: ±70 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com css: ±85 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com content: ±50 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com layout: ±100 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com interactions: ±50 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±23 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±22 (NON-DETERMINISTIC, don't try to fix)
  lusion.co pixels: ±93 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz css: ±85 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz content: ±50 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz layout: ±45 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz interactions: ±50 (NON-DETERMINISTIC, don't try to fix)
  resn.co.nz pixels: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.freezpak.com css: ±85 (NON-DETERMINISTIC, don't try to fix)
  www.freezpak.com content: ±50 (NON-DETERMINISTIC, don't try to fix)
  www.freezpak.com layout: ±100 (NON-DETERMINISTIC, don't try to fix)
  www.freezpak.com interactions: ±48 (NON-DETERMINISTIC, don't try to fix)
  www.freezpak.com pixels: ±86 (NON-DETERMINISTIC, don't try to fix)
  www.awwwards.com css: ±60 (NON-DETERMINISTIC, don't try to fix)
  www.awwwards.com links: ±11 (NON-DETERMINISTIC, don't try to fix)
  www.awwwards.com layout: ±63 (NON-DETERMINISTIC, don't try to fix)
  www.awwwards.com pixels: ±52 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v47-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v48-stable.js <worst-url> /tmp/test-v48 3
4. Quick single-site test available: node test/suite.js v48 --site <hostname>
5. Read improve/CLAUDE.md for rules
