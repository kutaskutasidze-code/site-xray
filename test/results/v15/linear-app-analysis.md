# Analysis: https://linear.app
**Category:** nextjs | **Score:** 93/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Next.js
- CSS: 16 external sheets
- Images: lazy-loading
- JS libs: none detected
- Scripts: 11 | Stylesheets: 16
- WebGL: no | SVGs: 176 | Iframes: 0

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 1603 | 1603 | 0 |
| Images (rendered) | 19 | 19 | 0 |
| Links | 74 | 74 | 0 |
| Buttons | 85 | 85 | 0 |
| Headings | 17 | 17 | 0 |
| Grids | 98 | 98 | 0 |
| Flexes | 492 | 492 | 0 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 61/100 | NO |
| CSS | 100/100 | YES |
| Links | 100/100 | NO |
| Content | 100/100 | YES |
| Layout | 100/100 | YES |
| Pixels | 100/100 | YES |
| Interactions | 98/100 | YES |
| Console | 100/100 | YES |
| Manifest | 85/100 | NO |

## Pixel Comparison
- Match: 99.8%
- Mismatched pixels: 2018 / 1296000
- Diff image: `linear-app-diff.png`

## Capture Manifest
- HTML pages: 46
- Images: 47 (avg 280910 bytes)
- Fonts: 3
- Total size: 108955 KB
- External refs remaining: 240
- Issues: 
  - 240 external references still in HTML (should be 0)

## Root Causes
- IMAGES: 19/19 rendered (0 missing). Strategy: lazy-loading. Broken: http://localhost:19884/images/img-1.jpg, http://localhost:19884/images/img-15.jpg, http://localhost:19884/images/img-16.jpg, http://localhost:19884/images/img-17.jpg, http://localhost:19884/images/img-17.jpg

## Suggested Fixes (universal)
- Handle lazy-loading: scroll to trigger lazy images before capture, or rewrite data-src to src

## Screenshots
- Original: `linear-app-original.png`
- Clone: `linear-app-clone.png`
- Diff: `linear-app-diff.png`
