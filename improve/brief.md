## IMPROVEMENT BRIEF — v46
Current: v45, 92/100, 3304 lines
Strategy: **PER-SITE**
Consecutive failures: 3
Mastered: 4 | Active: 6 | Queue: 0

### FOCUS: www.awwwards.com (92/100)
This is PER-SITE mode. Fix ONLY www.awwwards.com. Other sites must not regress.
The "3+ sites" universality rule is RELAXED — site-specific fixes are OK.

Per-metric breakdown:
  images: 98/100
  css: 100/100
  links: 86/100
  content: 100/100
  layout: 63/100 ← FIX THIS
  interactions: 100/100
  console: 100/100
  pixels: 82/100
  manifest: 100/100

Analysis for www.awwwards.com:
# Analysis: https://www.awwwards.com/websites
**Category:** design-gallery | **Score:** 92/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Next.js
- CSS: CSS-in-JS / inline
- Images: srcset/responsive
- JS libs: none detected
- Scripts: 15 | Stylesheets: 0
- WebGL: no | SVGs: 114 | Iframes: 2

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 2508 | 981 | -1527 |
| Images (rendered) | 63 | 63 | 0 |
| Links | 594 | 204 | -390 |
| Buttons | 6 | 1 | -5 |
| Headings | 32 | 53 | 21 |
| Grids | 4 | 12 | 8 |
| Flexes | 826 | 344 | -482 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 98/100 | NO |
| CSS | 100/100 | YES |
| Links | 86/100 | NO |
| Content | 100/100 | YES |
| Layout | 63/100 | NO |
| Pixels | 82/100 | NO |
| Interactions | 100/100 | YES |
| Console | 100/100 | YES |
| Manifest | 100/100 | YES |

## Pixel Comparison
- Match: 81.8%
- Mismatched pixels: 236269 / 1296000
- Diff image: `www-awwwards-com-diff.png`

## Capture Manifest
- HTML pages: 544
- Images: 161 (avg 114781 bytes)
- Fonts: 3
- Total size: 252230 KB
- External refs remaining: 0
- Issues: none

## Root Causes
- IMAGES: 63/63 rendered (0 missing). Strategy: srcset/responsive. Broken: http://localhost:19870/images/img-113.png
- LINKS: 52765/61474 working, 8709 broken, 0 external. Broken: /images/img-94.svg#hamburger, /images/img-94.svg#arrow-dd, /images/img-94.svg#arrow, /images/

### SITE SCORES (worst → best)
[OK        ] www.awwwards.com          92/100

### METRIC AVERAGES
  layout          avg:63  worst:63 (www.awwwards.com)
  pixels          avg:82  worst:82 (www.awwwards.com)
  links           avg:86  worst:86 (www.awwwards.com)
  images          avg:98  worst:98 (www.awwwards.com)
  css             avg:100  worst:100 ()
  content         avg:100  worst:100 ()
  interactions    avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### LAST 2 FAILED APPROACHES (DO NOT REPEAT)
  Attempt #2: // v45: PIXEL FIX — Pause all CSS animations immediately after page load.
  // The snapshot captures the page at domcontentloaded+4s. Our networkidle 
  Attempt #3: // v45: PIXEL FIX — Freeze JS-driven animations immediately after page load.
  // Pauses GSAP global timeline to prevent carousel/slider advancement b

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v45: all_retries_exhausted — code: // v45: PIXEL FIX — Pause all CSS animations immediately after page load.; // The snapshot captures the page at domconte
  v45: score_dropped — code: // v45: PIXEL FIX — Freeze JS-driven animations immediately after page load.; // Pauses GSAP global timeline to prevent 
  v45: all_retries_exhausted — code: // v45: PIXEL FIX — Freeze JS-driven animations immediately after page load.; // Pauses GSAP global timeline to prevent 

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
  ingamana.com pixels: ±11 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com css: ±85 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com content: ±50 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com layout: ±100 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com interactions: ±50 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±23 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±75 (NON-DETERMINISTIC, don't try to fix)
  lusion.co pixels: ±92 (NON-DETERMINISTIC, don't try to fix)
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
1. Read v45-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v46-stable.js <worst-url> /tmp/test-v46 3
4. Quick single-site test available: node test/suite.js v46 --site <hostname>
5. Read improve/CLAUDE.md for rules
