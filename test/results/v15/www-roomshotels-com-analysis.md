# Analysis: https://www.roomshotels.com
**Category:** hospitality | **Score:** 84/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: WordPress
- CSS: 1 external sheets
- Images: standard <img>
- JS libs: none detected
- Scripts: 9 | Stylesheets: 1
- WebGL: no | SVGs: 11 | Iframes: 0

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 587 | 526 | -61 |
| Images (rendered) | 4 | 115 | 111 |
| Links | 22 | 20 | -2 |
| Buttons | 22 | 10 | -12 |
| Headings | 10 | 10 | 0 |
| Grids | 6 | 6 | 0 |
| Flexes | 159 | 62 | -97 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 100/100 | YES |
| CSS | 90/100 | NO |
| Links | 97/100 | NO |
| Content | 96/100 | YES |
| Layout | 94/100 | YES |
| Pixels | 52/100 | NO |
| Interactions | 42/100 | NO |
| Console | 100/100 | YES |
| Manifest | 85/100 | NO |

## Pixel Comparison
- Match: 51.9%
- Mismatched pixels: 623799 / 1296000
- Diff image: `www-roomshotels-com-diff.png`

## Capture Manifest
- HTML pages: 9
- Images: 99 (avg 634901 bytes)
- Fonts: 9
- Total size: 63029 KB
- External refs remaining: 6
- Issues: 
  - 6 external references still in HTML (should be 0)

## Root Causes
- CSS: size=570446, layout=true, fonts=33. Original uses: 1 external sheets
- LINKS: 35/36 working, 1 broken, 3 external. Broken: /favicon.ico
- INTERACTIONS: 7/10 buttons clickable, nav: false

## Suggested Fixes (universal)
- Download external stylesheets and inline them
- Rewrite ALL external links to local paths

## Screenshots
- Original: `www-roomshotels-com-original.png`
- Clone: `www-roomshotels-com-clone.png`
- Diff: `www-roomshotels-com-diff.png`
