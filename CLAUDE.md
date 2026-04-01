# Site X-Ray Self-Improvement Instructions

You are improving site-xray, a universal web cloning tool. Your job is to make each version significantly better than the last.

## The Tool
- Location: `/opt/site-xray/` (or wherever this repo lives)
- Current version: read `VERSION` file
- Architecture: single JS file per version (`v{N}-stable.js`)
- Dependencies: playwright only
- Test suite: `node test/suite.js v{N}` → scores clone quality

## Your Improvement Cycle

The test suite runs a full parallel pipeline BEFORE you start: clone → score → deep analysis → synthesis.
You get pre-built reports. Your job is to READ them, THINK deeply, then IMPLEMENT.

### 1. READ (the pipeline already did the heavy lifting)
The test suite produces these files in `test/results/v{N}/`:
- **`synthesis.md`** — cross-site pattern analysis with ranked fix suggestions
- **`{hostname}-analysis.md`** — per-site deep analysis (tech stack, element comparison, root causes)
- **`{hostname}-original.png`** and **`{hostname}-clone.png`** — visual comparison screenshots

Read in this order:
1. `synthesis.md` — understand the big picture, which failure categories affect most sites
2. Per-site analysis for the **3 worst scoring sites** — understand specific root causes
3. **Screenshot PNGs** — READ them with the Read tool, you CAN see images. This catches issues metrics miss.
4. `improve/history.json` — what was tried before? Don't repeat.
5. Previous 2-3 version files — understand the evolution
6. **WEB SEARCH** for techniques you don't know: "how to clone [framework]", "playwright capture [technique]", how other tools (httrack, SingleFile) solve similar problems

### 2. THINK (structured reasoning — do NOT skip)
Before writing ANY code, reason through these questions explicitly:
a) **Failure categories** — What are the top 3 from synthesis.md? How many sites each?
b) **Root causes** — For each category, what's the ACTUAL cause? (not the symptom)
   - "Images missing" is a symptom → "srcset URLs not resolved" is the cause
   - "Layout broken" is a symptom → "CSS Grid initialized by JS we stripped" is the cause
c) **Brainstorm 5-10 approaches** per category — diverge before converging:
   - Capture computed styles? Keep certain scripts? Download external CSS?
   - Wait longer? Intercept network requests? Use networkidle?
d) **Rank by universality** — Will each fix help 3+ sites or just 1? ONLY implement if 3+
e) **Risk assessment** — Could any fix REGRESS existing sites? How to prevent?

Write your reasoning out as text before touching code. This step is mandatory.

### Self-Evaluation Checklist (run BEFORE committing)
1. Read the screenshot of the WORST scoring clone — does it look like a real website?
2. Open the clone HTML in Playwright, click 3 navigation links — do they work?
3. Check: `grep -r "originaldomain.com" /tmp/clone/` — ZERO references to original domain?
4. Does the page have visible styled content? Not just unstyled text dump?
5. Do images actually RENDER? `page.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.naturalWidth > 0).length)`
If ANY of these fail, the version is NOT ready.

### 3. IMPLEMENT (converge — specialize each fix)
- Copy `v{N}-stable.js` → `v{N+1}-stable.js`
- Update version strings
- Implement each fix as a clearly commented section
- Each fix must be:
  - UNIVERSAL (works for any website, not just the failing one)
  - SAFE (wrapped in try/catch, won't break existing sites)
  - TESTED (verify it works on the failing site)
  - MODULAR (isolated logic, easy to understand)

### 4. TEST
- Run: `node test/suite.js v{N+1}`
- Compare with previous: scores must improve or stay equal
- NO REGRESSIONS: if any site scores lower, fix it before committing
- If a fix causes regression, revert that specific fix

### 5. COMMIT
- Update `VERSION` file
- Write changelog to `improve/history.json`
- Git commit with descriptive message

## Rules
- NEVER modify previous versions (v11, v12, etc. are frozen)
- ALWAYS copy to new version file before editing
- EVERY change must be universal
- Prefer CSS-based fixes over JS-based fixes
- Prefer capturing computed state over keeping original scripts
- The tool must remain a SINGLE FILE (no external modules yet)
- Maximum ~2000 lines per version file
- Test on at least 3 different sites before committing

## What Makes a Good Improvement
- Handles a new WEB TECHNIQUE we didn't handle before (e.g., Lottie, CSS Grid subgrid, container queries)
- Fixes a CATEGORY of failures, not just one site
- Improves the WORST scoring metric across all sites
- Adds DETECTION of site type → applies specialized handling
- Makes the output more FUNCTIONAL (links work, buttons work, menus work)

## Scoring Weights
- Image rendering: 20% (every img ACTUALLY RENDERS, naturalWidth > 0)
- CSS quality: 15% (layout, fonts, colors match original)
- Link integrity: 15% (every internal href resolves to a real file, ZERO external)
- Content preservation: 15% (original text words appear in clone)
- Layout fidelity: 15% (structural similarity — element counts, visible elements)
- Interactions: 10% (buttons clickable, nav exists)
- Console errors: 10% (zero JS errors in clone)

## The 100% Rule (CRITICAL)
- 100% means TRUE 100% — every metric must be individually perfect
- A site at 100% becomes a REGRESSION TEST — it must STAY at 100% forever
- Any new version that causes a regression on a mastered site is REJECTED
- When a site reaches 100%, it moves to the "mastered" list
- A NEW harder site from the "queue" replaces it in the active test pool
- The tool progressively masters harder and harder sites

## Site Categories (from easy to extreme)
- easy: static sites, simple WordPress
- medium: Next.js, Webflow, corporate sites
- hard: heavy JS, React SPAs, e-commerce
- extreme: WebGL, 3D, Lottie scroll, complex animations

The goal: master ALL categories up to "extreme".
