## IMPROVEMENT BRIEF — v28
Current: v27, 90/100, 2675 lines
Strategy: **PER-SITE**
Consecutive failures: 1
Mastered: 3 | Active: 6 | Queue: 1

### FOCUS: bruno-simon.com (75/100)
This is PER-SITE mode. Fix ONLY bruno-simon.com. Other sites must not regress.
The "3+ sites" universality rule is RELAXED — site-specific fixes are OK.

Per-metric breakdown:
  images: 98/100
  css: 100/100
  links: 100/100
  content: 50/100 ← FIX THIS
  layout: 100/100
  interactions: 43/100 ← FIX THIS
  console: 100/100
  pixels: 3/100 ← FIX THIS
  manifest: 100/100

Analysis for bruno-simon.com:
# Analysis: https://bruno-simon.com
**Category:** 3d-portfolio | **Score:** 75/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Unknown
- CSS: 2 external sheets
- Images: lazy-loading
- JS libs: none detected
- Scripts: 2 | Stylesheets: 2
- WebGL: YES | SVGs: 7 | Iframes: 0

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 19 | 19 | 0 |
| Images (rendered) | 1 | 46 | 45 |
| Links | 21 | 21 | 0 |
| Buttons | 42 | 42 | 0 |
| Headings | 6 | 6 | 0 |
| Grids | 0 | 0 | 0 |
| Flexes | 58 | 58 | 0 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 98/100 | NO |
| CSS | 100/100 | YES |
| Links | 100/100 | YES |
| Content | 50/100 | NO |
| Layout | 100/100 | YES |
| Pixels | 3/100 | NO |
| Interactions | 43/100 | NO |
| Console | 100/100 | YES |
| Manifest | 100/100 | YES |

## Pixel Comparison
- Match: 2.9%
- Mismatched pixels: 1257886 / 1296000
- Diff image: `bruno-simon-com-diff.png`

## Capture Manifest
- HTML pages: 1
- Images: 64 (avg 22536 bytes)
- Fonts: 25
- Total size: 4601 KB
- External refs remaining: 0
- Issues: none

## Root Causes
- IMAGES: 46/1 rendered (-45 missing). Strategy: lazy-loading. Broken: 
- CONTENT: undefined/undefined words matched (50%). Clone has undefined words.
- INTERACTIONS: 2/42 buttons clickable, nav: true

## Suggested Fixes (universal)
- Handle lazy-loading: scroll to trigger lazy images before capture, or rewrite data-sr

### SITE SCORES (worst → best)
[NEEDS_WORK] bruno-simon.com           75/100
[NEEDS_WORK] resn.co.nz                80/100
[NEEDS_WORK] lusion.co                 82/100
[NEEDS_WORK] www.locomotive.ca         83/100
[OK        ] cuberto.com               96/100
[PERFECT   ] www.freezpak.com          98/100
[PERFECT   ] basement.studio           98/100
[PERFECT   ] ingamana.com              99/100
[PERFECT   ] pentagram.com             99/100

### METRIC AVERAGES
  pixels          avg:66  worst:3 (bruno-simon.com)
  content         avg:79  worst:0 (resn.co.nz)
  interactions    avg:84  worst:43 (bruno-simon.com)
  links           avg:92  worst:64 (www.locomotive.ca)
  layout          avg:97  worst:71 (www.locomotive.ca)
  images          avg:100  worst:98 (bruno-simon.com)
  css             avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v27: all_retries_exhausted

### VOLATILE METRICS (IGNORE — scores fluctuate naturally)
  basement.studio pixels: ±11 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±22 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±81 (NON-DETERMINISTIC, don't try to fix)
  lusion.co content: ±28 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v27-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v28-stable.js <worst-url> /tmp/test-v28 3
4. Quick single-site test available: node test/suite.js v28 --site <hostname>
5. Read improve/CLAUDE.md for rules
