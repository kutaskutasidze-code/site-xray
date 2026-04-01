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
5. `improve/knowledge.json` — what WORKED and what FAILED in past cycles. Critical for avoiding repeated mistakes.
6. Previous 2-3 version files — understand the evolution
7. **WEB SEARCH** for techniques you don't know: "how to clone [framework]", "playwright capture [technique]", how other tools (httrack, SingleFile) solve similar problems

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
f) **Check knowledge.json** — Has this approach been tried before? Did it fail? Why?

Write your reasoning out as text before touching code. This step is mandatory.

### 3. IMPLEMENT WITH ISOLATED TESTING (CRITICAL — this is the key to quality)

**Do NOT implement all fixes at once.** Test each fix individually to know exactly what helps and what hurts.

#### Step-by-step process:

1. **Copy** `v{N}-stable.js` → `v{N+1}-stable.js`
2. **For EACH proposed fix (one at a time):**
   a. Create a temporary copy: `cp v{N+1}-stable.js v{N+1}-test.js`
   b. Implement ONLY this one fix in `v{N+1}-test.js`
   c. Quick-test on the 2 worst-scoring sites:
      ```bash
      node v{N+1}-test.js <worst-site> /tmp/fix-test 3
      ```
   d. Compare result vs baseline:
      - Does the clone look better? (Read screenshots)
      - Did the specific metric this fix targets improve?
      - Did anything else REGRESS?
   e. Record the result:
      ```
      FIX A (srcset handling): site1 +8, site2 +12 → KEEP
      FIX B (script preservation): site1 +3, site2 -5 → DROP (regresses site2)
      FIX C (font download): site1 +2, site2 +4 → KEEP
      ```
   f. If the fix HELPS: apply it to `v{N+1}-stable.js`
   g. If the fix HURTS or is neutral: discard it, don't include
3. **After all fixes tested individually**, run the full test suite:
   ```bash
   node test/suite.js v{N+1}
   ```
4. **Verify NO per-site regressions** — the cycle script will reject if any site drops >5 points

#### Why this matters:
- 5 fixes at once: if score drops, you don't know which fix caused it
- 1 fix at a time: you know EXACTLY what each fix contributes
- Result: only beneficial fixes ship, bad fixes get caught early

### Self-Evaluation Checklist (run BEFORE finishing)
1. Read the screenshot of the WORST scoring clone — does it look like a real website?
2. Open the clone HTML in Playwright, click 3 navigation links — do they work?
3. Check: `grep -r "originaldomain.com" /tmp/clone/` — ZERO references to original domain?
4. Does the page have visible styled content? Not just unstyled text dump?
5. Do images actually RENDER? `page.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.naturalWidth > 0).length)`
If ANY of these fail, the version is NOT ready.

### 4. TEST
- Run: `node test/suite.js v{N+1}`
- Compare with previous: scores must improve or stay equal
- **PER-SITE CHECK**: NO individual site may drop more than 5 points
- If a fix causes regression, revert that specific fix
- The cycle script enforces this automatically — but check yourself too

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
- Test each fix INDIVIDUALLY before combining

## What Makes a Good Improvement
- Handles a new WEB TECHNIQUE we didn't handle before (e.g., Lottie, CSS Grid subgrid, container queries)
- Fixes a CATEGORY of failures, not just one site
- Improves the WORST scoring metric across all sites
- Adds DETECTION of site type → applies specialized handling
- Makes the output more FUNCTIONAL (links work, buttons work, menus work)
- Has been VERIFIED individually to improve scores (not just assumed)

## Scoring Weights (9 metrics)
- Image rendering: 15% (every img ACTUALLY RENDERS, naturalWidth > 0)
- **Pixel fidelity: 15%** (pixelmatch comparison — original vs clone screenshot, NEW)
- CSS quality: 12% (layout, fonts, colors match original)
- Link integrity: 12% (every internal href resolves to a real file, ZERO external)
- Content preservation: 12% (original text words appear in clone)
- Layout fidelity: 10% (structural similarity — element counts, visible elements)
- Interactions: 8% (buttons clickable, nav exists)
- Console errors: 8% (zero JS errors in clone)
- **Capture manifest: 8%** (no broken downloads, no external refs remaining, NEW)

### New: Pixel Diff
The test suite now generates `{hostname}-diff.png` — a visual heatmap showing exactly which pixels differ between original and clone. READ THIS to see precisely where the clone fails visually. Red = different, transparent = matching.

### New: Capture Manifest
Each clone gets a `{hostname}-manifest.json` with:
- File counts by type (HTML, images, fonts, videos)
- File sizes and totals
- Issues detected (empty HTML, tiny/broken images, remaining external refs)
- Use this to understand WHAT was captured vs what should have been captured

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

## Knowledge Base
After EACH cycle (success or failure), the cycle script saves what happened to `improve/knowledge.json`.
- **Read this first** — avoid repeating failed approaches
- **Learnings**: techniques that worked, with version and score improvement
- **Failed approaches**: things that were tried but regressed or didn't help
- If you see a pattern like "srcset handling failed in v14 and v15", try a fundamentally different approach, not a tweak
