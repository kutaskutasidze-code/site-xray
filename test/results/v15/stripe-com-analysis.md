# Analysis: https://stripe.com
**Category:** heavy-js | **Score:** 96/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Next.js
- CSS: 7 external sheets
- Images: srcset/responsive
- JS libs: none detected
- Scripts: 68 | Stylesheets: 7
- WebGL: YES | SVGs: 185 | Iframes: 2

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 1302 | 1942 | 640 |
| Images (rendered) | 9 | 53 | 44 |
| Links | 174 | 174 | 0 |
| Buttons | 31 | 32 | 1 |
| Headings | 56 | 56 | 0 |
| Grids | 53 | 108 | 55 |
| Flexes | 372 | 580 | 208 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 100/100 | YES |
| CSS | 90/100 | NO |
| Links | 100/100 | NO |
| Content | 99/100 | YES |
| Layout | 100/100 | YES |
| Pixels | 99/100 | YES |
| Interactions | 96/100 | YES |
| Console | 100/100 | YES |
| Manifest | 70/100 | NO |

## Pixel Comparison
- Match: 99.2%
- Mismatched pixels: 10755 / 1296000
- Diff image: `stripe-com-diff.png`

## Capture Manifest
- HTML pages: 278
- Images: 256 (avg 298287 bytes)
- Fonts: 2
- Total size: 274938 KB
- External refs remaining: 7432
- Issues: 
  - Tiny image (likely broken): img-206.png (38b)
  - 7432 external references still in HTML (should be 0)

## Root Causes
- CSS: size=435082, layout=true, fonts=4. Original uses: 7 external sheets

## Suggested Fixes (universal)
- Download external stylesheets and inline them

## Screenshots
- Original: `stripe-com-original.png`
- Clone: `stripe-com-clone.png`
- Diff: `stripe-com-diff.png`
