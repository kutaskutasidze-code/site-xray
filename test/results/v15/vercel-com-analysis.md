# Analysis: https://vercel.com
**Category:** nextjs | **Score:** 92/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Next.js
- CSS: 12 external sheets
- Images: lazy-loading
- JS libs: none detected
- Scripts: 70 | Stylesheets: 12
- WebGL: no | SVGs: 112 | Iframes: 0

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 1215 | 1213 | -2 |
| Images (rendered) | 46 | 51 | 5 |
| Links | 132 | 132 | 0 |
| Buttons | 15 | 15 | 0 |
| Headings | 36 | 36 | 0 |
| Grids | 55 | 54 | -1 |
| Flexes | 492 | 492 | 0 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 100/100 | YES |
| CSS | 100/100 | YES |
| Links | 100/100 | NO |
| Content | 50/100 | NO |
| Layout | 100/100 | YES |
| Pixels | 100/100 | YES |
| Interactions | 92/100 | YES |
| Console | 100/100 | YES |
| Manifest | 85/100 | NO |

## Pixel Comparison
- Match: 99.8%
- Mismatched pixels: 3117 / 1296000
- Diff image: `vercel-com-diff.png`

## Capture Manifest
- HTML pages: 73
- Images: 131 (avg 45549 bytes)
- Fonts: 84
- Total size: 228995 KB
- External refs remaining: 892
- Issues: 
  - 892 external references still in HTML (should be 0)

## Root Causes
- CONTENT: undefined/undefined words matched (50%). Clone has undefined words.

## Suggested Fixes (universal)
- Next.js renders content via JS — may need to wait longer or use networkidle

## Screenshots
- Original: `vercel-com-original.png`
- Clone: `vercel-com-clone.png`
- Diff: `vercel-com-diff.png`
