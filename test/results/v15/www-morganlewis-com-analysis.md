# Analysis: https://www.morganlewis.com
**Category:** corporate | **Score:** 88/100 | **Perfect:** false

## Tech Stack (Original)
- Framework: Unknown
- CSS: 2 external sheets
- Images: standard <img>
- JS libs: none detected
- Scripts: 20 | Stylesheets: 2
- WebGL: no | SVGs: 4 | Iframes: 1

## Element Comparison (Original → Clone)
| Element | Original | Clone | Delta |
|---------|----------|-------|-------|
| Visible | 392 | 341 | -51 |
| Images (rendered) | 16 | 14 | -2 |
| Links | 82 | 63 | -19 |
| Buttons | 19 | 7 | -12 |
| Headings | 18 | 4 | -14 |
| Grids | 0 | 0 | 0 |
| Flexes | 49 | 45 | -4 |

## Scores
| Metric | Score | Perfect |
|--------|-------|---------|
| Images | 100/100 | YES |
| CSS | 90/100 | NO |
| Links | 81/100 | NO |
| Content | 93/100 | NO |
| Layout | 93/100 | YES |
| Pixels | 91/100 | NO |
| Interactions | 57/100 | NO |
| Console | 100/100 | YES |
| Manifest | 70/100 | NO |

## Pixel Comparison
- Match: 90.6%
- Mismatched pixels: 121354 / 1296000
- Diff image: `www-morganlewis-com-diff.png`

## Capture Manifest
- HTML pages: 393
- Images: 131 (avg 112382 bytes)
- Fonts: 45
- Total size: 556473 KB
- External refs remaining: 2753
- Issues: 
  - Tiny image (likely broken): img-107.png (76b)
  - 2753 external references still in HTML (should be 0)

## Root Causes
- CSS: size=1211813, layout=true, fonts=53. Original uses: 2 external sheets
- LINKS: 5054/6235 working, 1181 broken, 2359 external. Broken: /CareersContents/plugins/mediaelement/mediaelementplayer.min.v-3w4wrmpazz9lqgav26iw.css, /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css, /favicon.ico, /CareersContents/plugins/mediaelement/mediaelementplayer.min.v-3w4wrmpazz9lqgav26iw.css, /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css
- CONTENT: 328/353 words matched (93%). Clone has 328 words.
- INTERACTIONS: 2/7 buttons clickable, nav: true

## Suggested Fixes (universal)
- Download external stylesheets and inline them
- Rewrite ALL external links to local paths

## Screenshots
- Original: `www-morganlewis-com-original.png`
- Clone: `www-morganlewis-com-clone.png`
- Diff: `www-morganlewis-com-diff.png`
