# Synthesis Report — v15
**Date:** 2026-04-02T00:49:56.863Z
**Sites tested:** 8 | **Perfect:** 0 | **Average:** 91/100
**Pipeline time:** 406s

## Failure Categories (cross-site)
- **CSS**: 5/8 sites affected
- **INTERACTIONS**: 4/8 sites affected
- **LINKS**: 3/8 sites affected
- **CONTENT**: 2/8 sites affected
- **IMAGES**: 1/8 sites affected

## Framework Distribution (failing sites)
- Unknown: 4 sites
- Next.js: 3 sites
- WordPress: 1 sites

## Ranked Fix Suggestions (by cross-site impact)
1. [5 sites] Download external stylesheets and inline them
2. [3 sites] Rewrite ALL external links to local paths
3. [1 sites] undefined renders content via JS — may need to wait longer or use networkidle

## Per-Site Root Causes
### linear-app
- CONTENT: undefined/undefined words matched (50%). Clone has undefined words.

### cuberto-com
- INTERACTIONS: 0/1 buttons clickable, nav: true

### www-morganlewis-com
- CSS: size=1211813, layout=true, fonts=53. Original uses: 2 external sheets
- LINKS: 5054/6235 working, 1181 broken, 2359 external. Broken: /CareersContents/plugins/mediaelement/mediaelementplayer.min.v-3w4wrmpazz9lqgav26iw.css, /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css, /favicon.ico, /CareersContents/plugins/mediaelement/mediaelementplayer.min.v-3w4wrmpazz9lqgav26iw.css, /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css
- CONTENT: 328/353 words matched (93%). Clone has 328 words.
- INTERACTIONS: 2/7 buttons clickable, nav: true

### pentagram-com
- IMAGES: 108/108 rendered (0 missing). Strategy: <picture> element. Broken: 
- CSS: size=1115656, layout=true, fonts=12. Original uses: 1 external sheets
- LINKS: 5600/5736 working, 136 broken, 1496 external. Broken: humans.txt, humans.txt, humans.txt, humans.txt, humans.txt

### www-roomshotels-com
- CSS: size=570446, layout=true, fonts=33. Original uses: 1 external sheets
- LINKS: 35/36 working, 1 broken, 3 external. Broken: /favicon.ico
- INTERACTIONS: 7/10 buttons clickable, nav: false

### stripe-com
- CSS: size=435082, layout=true, fonts=4. Original uses: 7 external sheets

### www-cravath-com
- CSS: size=238161, layout=true, fonts=36. Original uses: 1 external sheets
- INTERACTIONS: 13/15 buttons clickable, nav: false

### vercel-com


## Recommended Action Plan
Focus on fixes that appear in 4+ sites (most universal impact):
1. Download external stylesheets and inline them (5 sites)
2. Rewrite ALL external links to local paths (3 sites)

## Screenshots to Review
- `linear-app-original.png` vs `linear-app-clone.png`
- `cuberto-com-original.png` vs `cuberto-com-clone.png`
- `www-morganlewis-com-original.png` vs `www-morganlewis-com-clone.png`
- `pentagram-com-original.png` vs `pentagram-com-clone.png`
- `www-roomshotels-com-original.png` vs `www-roomshotels-com-clone.png`
- `stripe-com-original.png` vs `stripe-com-clone.png`
- `www-cravath-com-original.png` vs `www-cravath-com-clone.png`
- `vercel-com-original.png` vs `vercel-com-clone.png`
