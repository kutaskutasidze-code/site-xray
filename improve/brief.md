## IMPROVEMENT BRIEF — v30
Current: v29, 91/100, 2792 lines
Strategy: **PER-SITE**
Consecutive failures: 0
Mastered: 4 | Active: 7 | Queue: 0

### FOCUS: bruno-simon.com (79/100)
This is PER-SITE mode. Fix ONLY bruno-simon.com. Other sites must not regress.
The "3+ sites" universality rule is RELAXED — site-specific fixes are OK.

Per-metric breakdown:
  images: 95/100
  css: 100/100
  links: 100/100
  content: 50/100 ← FIX THIS
  layout: 100/100
  interactions: 100/100
  console: 100/100
  pixels: 3/100 ← FIX THIS
  manifest: 100/100

Analysis for bruno-simon.com:
# Analysis: https://bruno-simon.com
**Category:** 3d-portfolio | **Score:** 79/100 | **Perfect:** false

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
| Visible | 19 | 53 | 34 |
| Images (rendered) | 1 | 20 | 19 |
| Links | 21 | 21 | 0 |
| Buttons | 42 | 42 | 0 |
| Headings | 6 | 6 | 0 |
| Grids | 0 | 0 | 0 |
| Flexes | 58 | 34 | -24 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 95/100 | NO |
| CSS | 100/100 | YES |
| Links | 100/100 | YES |
| Content | 50/100 | NO |
| Layout | 100/100 | YES |
| Pixels | 3/100 | NO |
| Interactions | 100/100 | YES |
| Console | 100/100 | YES |
| Manifest | 100/100 | YES |

## Pixel Comparison
- Match: 3.2%
- Mismatched pixels: 1255138 / 1296000
- Diff image: `bruno-simon-com-diff.png`

## Capture Manifest
- HTML pages: 1
- Images: 62 (avg 10106 bytes)
- Fonts: 25
- Total size: 2158 KB
- External refs remaining: 0
- Issues: none

## Root Causes
- IMAGES: 20/1 rendered (-19 missing). Strategy: lazy-loading. Broken: 
- CONTENT: undefined/undefined words matched (50%). Clone has undefined words.

## Suggested Fixes (universal)
- Handle lazy-loading: scroll to trigger lazy images before capture, or rewrite data-src to src

## Screenshots
- Original: `bruno-s

### SITE SCORES (worst → best)
[NEEDS_WORK] bruno-simon.com           79/100
[NEEDS_WORK] resn.co.nz                80/100
[NEEDS_WORK] www.locomotive.ca         83/100
[NEEDS_WORK] lusion.co                 86/100
[NEEDS_WORK] www.awwwards.com          88/100
[OK        ] cuberto.com               96/100
[PERFECT   ] basement.studio           98/100
[PERFECT   ] ingamana.com              99/100
[PERFECT   ] pentagram.com             99/100
[PERFECT   ] www.freezpak.com          100/100

### METRIC AVERAGES
  pixels          avg:68  worst:3 (bruno-simon.com)
  content         avg:80  worst:0 (resn.co.nz)
  links           avg:92  worst:64 (www.locomotive.ca)
  layout          avg:94  worst:67 (www.awwwards.com)
  interactions    avg:95  worst:50 (resn.co.nz)
  images          avg:100  worst:95 (bruno-simon.com)
  css             avg:100  worst:100 ()
  console         avg:100  worst:100 ()
  manifest        avg:100  worst:100 ()

### RECENT FAILED APPROACHES FROM KNOWLEDGE BASE
  v27: all_retries_exhausted

### VOLATILE METRICS (IGNORE — scores fluctuate naturally)
  basement.studio pixels: ±11 (NON-DETERMINISTIC, don't try to fix)
  cuberto.com pixels: ±22 (NON-DETERMINISTIC, don't try to fix)
  bruno-simon.com pixels: ±86 (NON-DETERMINISTIC, don't try to fix)
  lusion.co content: ±28 (NON-DETERMINISTIC, don't try to fix)

### INSTRUCTIONS
1. Read v29-stable.js (the current code)
2. Based on the strategy above, implement 2-4 targeted fixes
3. Test on the worst site: node v30-stable.js <worst-url> /tmp/test-v30 3
4. Quick single-site test available: node test/suite.js v30 --site <hostname>
5. Read improve/CLAUDE.md for rules
