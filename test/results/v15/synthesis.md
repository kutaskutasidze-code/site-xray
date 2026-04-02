# Synthesis Report — v15
**Date:** 2026-04-02T00:39:43.349Z
**Sites tested:** 8 | **Perfect:** 0 | **Average:** 90/100
**Pipeline time:** 442s

## Failure Categories (cross-site)
- **CSS**: 5/8 sites affected
- **INTERACTIONS**: 4/8 sites affected
- **LINKS**: 3/8 sites affected
- **CONTENT**: 2/8 sites affected
- **IMAGES**: 2/8 sites affected

## Framework Distribution (failing sites)
- Unknown: 3 sites
- Next.js: 4 sites
- WordPress: 1 sites

## Ranked Fix Suggestions (by cross-site impact)
1. [5 sites] Download external stylesheets and inline them
2. [3 sites] Rewrite ALL external links to local paths
3. [1 sites] Next.js renders content via JS — may need to wait longer or use networkidle
4. [1 sites] Handle lazy-loading: scroll to trigger lazy images before capture, or rewrite data-src to src

## Per-Site Root Causes
### cuberto-com
- INTERACTIONS: 0/1 buttons clickable, nav: true

### www-cravath-com
- CSS: size=238161, layout=true, fonts=36. Original uses: 1 external sheets
- INTERACTIONS: 13/15 buttons clickable, nav: false

### www-morganlewis-com
- CSS: size=1211813, layout=true, fonts=53. Original uses: 2 external sheets
- LINKS: 5054/6235 working, 1181 broken, 2359 external. Broken: /CareersContents/plugins/mediaelement/mediaelementplayer.min.v-3w4wrmpazz9lqgav26iw.css, /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css, /favicon.ico, /CareersContents/plugins/mediaelement/mediaelementplayer.min.v-3w4wrmpazz9lqgav26iw.css, /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css
- CONTENT: 328/353 words matched (93%). Clone has 328 words.
- INTERACTIONS: 2/7 buttons clickable, nav: true

### stripe-com
- CSS: size=435082, layout=true, fonts=4. Original uses: 7 external sheets

### www-roomshotels-com
- CSS: size=570446, layout=true, fonts=33. Original uses: 1 external sheets
- LINKS: 35/36 working, 1 broken, 3 external. Broken: /favicon.ico
- INTERACTIONS: 7/10 buttons clickable, nav: false

### vercel-com
- CONTENT: undefined/undefined words matched (50%). Clone has undefined words.

### pentagram-com
- IMAGES: 108/89 rendered (-19 missing). Strategy: <picture> element. Broken: 
- CSS: size=1115656, layout=true, fonts=12. Original uses: 1 external sheets
- LINKS: 5600/5736 working, 136 broken, 1496 external. Broken: humans.txt, humans.txt, humans.txt, humans.txt, humans.txt

### linear-app
- IMAGES: 19/19 rendered (0 missing). Strategy: lazy-loading. Broken: http://localhost:19884/images/img-1.jpg, http://localhost:19884/images/img-15.jpg, http://localhost:19884/images/img-16.jpg, http://localhost:19884/images/img-17.jpg, http://localhost:19884/images/img-17.jpg

## Recommended Action Plan
Focus on fixes that appear in 4+ sites (most universal impact):
1. Download external stylesheets and inline them (5 sites)
2. Rewrite ALL external links to local paths (3 sites)

## Screenshots to Review
- `cuberto-com-original.png` vs `cuberto-com-clone.png`
- `www-cravath-com-original.png` vs `www-cravath-com-clone.png`
- `www-morganlewis-com-original.png` vs `www-morganlewis-com-clone.png`
- `stripe-com-original.png` vs `stripe-com-clone.png`
- `www-roomshotels-com-original.png` vs `www-roomshotels-com-clone.png`
- `vercel-com-original.png` vs `vercel-com-clone.png`
- `pentagram-com-original.png` vs `pentagram-com-clone.png`
- `linear-app-original.png` vs `linear-app-clone.png`
