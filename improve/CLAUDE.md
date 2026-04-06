# Site X-Ray Self-Improvement Instructions


## CREATIVE TRACK — READ THIS FIRST
You are working on the CREATIVE track of X-Ray evolution. This is a PARALLEL system to the main X-Ray.

**Your test sites are ALL creative/design/WebGL sites**, not corporate sites:
- ingamana.com (design agency, Next.js)
- basement.studio (creative agency)  
- locomotive.ca (creative studio, smooth scroll)
- cuberto.com (creative agency)
- bruno-simon.com (3D Three.js portfolio)
- pentagram.com (design firm)

**Different optimization goals than main X-Ray:**
- Preserve visual fidelity over link integrity
- Keep external CDN resources (fonts, videos, scripts)
- Don't freeze dynamic layouts — creative sites use calc()/clamp() responsively
- Don't remove overlays aggressively — creative sites use full-viewport elements intentionally
- Preserve opacity:0 reveal states — they're part of scroll animations
- Prioritize: images rendering in correct positions, custom fonts loading, brand colors preserved

**v25 baseline issues observed on these sites:**
- Images load but don't render in grid containers (especially ingamana project cards)
- Layout freeze breaks responsive CSS (calc/min/max functions)
- Aggressive external ref cleanup strips CDN-hosted assets

Start with SIMPLER fixes. A creative site clone that looks right is worth more than one with perfect link scores.

You are improving site-xray, a universal web cloning tool.

## Quick Reference
- Location: `/opt/site-xray/`
- Architecture: single JS file per version (`v{N}-stable.js`)
- Dependencies: playwright only
- Quick test: `node test/suite.js v{N} --site hostname.com` (single site, ~2 min)
- Full test: `node test/suite.js v{N}` (all sites, ~7 min)

## Your Workflow

### 1. READ THE BRIEF (start here)
Read `improve/brief.md` — it contains everything pre-digested:
- Current strategy (UNIVERSAL / PER-SITE / METRIC-FOCUS / REFACTOR)
- All site scores and metric breakdowns
- Failed approaches from past cycles (DO NOT repeat them)
- Sites that regressed in past attempts (be careful with those)
- Volatile metrics to ignore (non-deterministic, don't waste turns)

Then read `v{N}-stable.js` — the code to improve.

**That's it for reading.** The brief already digests synthesis, analysis, knowledge, and history. Don't waste turns re-reading those files.

### 2. THINK (short, focused)
Based on the brief's strategy mode:
- **UNIVERSAL**: What fix helps 3+ sites? Pick the lowest-hanging fruit.
- **PER-SITE**: What specifically breaks on the target site? Fix ONLY that.
- **METRIC-FOCUS**: What single code change improves the worst metric everywhere?
- **REFACTOR**: What's the most fragile code? Make it robust, don't add features.

Write 3-5 sentences of reasoning, then start coding. Don't over-plan.

### 3. IMPLEMENT + TEST
1. Copy `v{N}-stable.js` → `v{N+1}-stable.js`
2. Implement 2-4 focused fixes (match the strategy)
3. Quick-test the worst site: `node v{N+1}-stable.js <url> /tmp/test 3`
4. Read the clone — does it look right?
5. Single-site score: `node test/suite.js v{N+1} --site <hostname>`
6. If it improved, run full suite: `node test/suite.js v{N+1}`

### 4. RULES
- NEVER modify previous versions
- Copy before editing
- Each fix: try/catch wrapped
- In PER-SITE mode: site-specific fixes ARE allowed
- In UNIVERSAL mode: fix must help 3+ sites
- No site may drop more than 5 points (auto-enforced)

## Scoring Weights (9 metrics)
| Metric | Weight | What it measures |
|--------|--------|-----------------|
| Images | 15% | naturalWidth > 0 for every img |
| Pixels | 15% | pixelmatch vs original screenshot |
| CSS | 12% | stylesheet size, layout, fonts |
| Links | 12% | every internal href resolves |
| Content | 12% | original text words in clone |
| Layout | 10% | visible element count ratio |
| Interactions | 8% | buttons clickable, nav exists |
| Console | 8% | zero JS errors |
| Manifest | 8% | no broken downloads, no external refs |

## The 100% Rule
- 100% = ALL metrics perfect (not just average)
- Mastered sites are locked as regression tests forever
- New harder sites rotate in from queue

## Pixel Diff
`{hostname}-diff.png` shows exactly which pixels differ. Red = different. Read this for visual debugging.

## Capture Manifest
`{hostname}-manifest.json` shows what was captured vs what exists. Check for broken downloads and remaining external refs.
