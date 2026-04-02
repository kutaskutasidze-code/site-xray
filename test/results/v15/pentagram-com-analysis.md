# Analysis: https://pentagram.com
**Category:** portfolio | **Score:** 84/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Next.js
- CSS: 1 external sheets
- Images: <picture> element
- JS libs: none detected
- Scripts: 4 | Stylesheets: 1
- WebGL: no | SVGs: 122 | Iframes: 0

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 2084 | 2084 | 0 |
| Images (rendered) | 89 | 108 | 19 |
| Links | 373 | 373 | 0 |
| Buttons | 104 | 104 | 0 |
| Headings | 102 | 102 | 0 |
| Grids | 3 | 3 | 0 |
| Flexes | 250 | 250 | 0 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 64/100 | NO |
| CSS | 90/100 | NO |
| Links | 98/100 | NO |
| Content | 100/100 | YES |
| Layout | 100/100 | YES |
| Pixels | 48/100 | NO |
| Interactions | 98/100 | YES |
| Console | 100/100 | YES |
| Manifest | 85/100 | NO |

## Pixel Comparison
- Match: 47.6%
- Mismatched pixels: 678407 / 1296000
- Diff image: `pentagram-com-diff.png`

## Capture Manifest
- HTML pages: 136
- Images: 857 (avg 203038 bytes)
- Fonts: 0
- Total size: 335942 KB
- External refs remaining: 1496
- Issues: 
  - 1496 external references still in HTML (should be 0)

## Root Causes
- IMAGES: 108/89 rendered (-19 missing). Strategy: <picture> element. Broken: 
- CSS: size=1115656, layout=true, fonts=12. Original uses: 1 external sheets
- LINKS: 5600/5736 working, 136 broken, 1496 external. Broken: humans.txt, humans.txt, humans.txt, humans.txt, humans.txt

## Suggested Fixes (universal)
- Download external stylesheets and inline them
- Rewrite ALL external links to local paths

## Screenshots
- Original: `pentagram-com-original.png`
- Clone: `pentagram-com-clone.png`
- Diff: `pentagram-com-diff.png`
