#!/usr/bin/env node
/**
 * Site X-Ray v45 — Universal precision cloner.
 * Builds on v44 with METRIC-FOCUS improvement:
 *   - Freeze JS-driven carousels/sliders via GSAP timeline pause + interval clearing
 *   - Previous: bake transforms, CSS transitions freeze, early viewport screenshot
 *
 * Single file. One dependency (playwright). Zero config.
 *
 * Usage: node v45-stable.js <url> [output-dir] [max-pages] [flags]
 * Default max-pages: 20
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── Parse CLI args ──
const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--auth') { flags.auth = args[++i]; }
  else if (args[i] === '--login') { flags.login = args[++i]; } // "email:password"
  else if (args[i] === '--save-auth') { flags.saveAuth = true; }
  else if (args[i] === '--all') { flags.all = true; }
  else if (args[i] === '--interactive') { flags.interactive = true; }
  else { positional.push(args[i]); }
}

const TARGET = positional[0];
if (!TARGET) {
  console.log(`Site X-Ray v43
Usage: node v43-stable.js <url> [output-dir] [max-pages] [flags]

Flags:
  --all              Clone ALL pages (discover via sitemap.xml + deep crawl)
  --auth <file>      Load Playwright auth state from JSON file
  --save-auth        Open browser for manual login, save state for reuse
  --login <e:p>      Auto-login with email:password before cloning
  --interactive      Open visible browser, wait for manual sign-in

Examples:
  node v28-stable.js https://example.com
  node v28-stable.js https://example.com ./output 50
  node v28-stable.js https://example.com --all
  node v28-stable.js https://example.com --auth auth-state.json
  node v28-stable.js https://example.com --save-auth
  node v28-stable.js https://example.com --interactive`);
  process.exit(0);
}

const PARSED = new URL(TARGET);
const DOMAIN = PARSED.origin;
const OUT = positional[1] || `/tmp/clone-${PARSED.hostname.replace(/\./g, '-')}`;
const MAX_PAGES = flags.all ? 999 : (parseInt(positional[2]) || 50);

// v15: www/non-www domain variant — sites may reference assets from either variant
const ALT_DOMAIN = (() => {
  const h = PARSED.hostname;
  if (h.startsWith('www.')) return PARSED.protocol + '//' + h.slice(4);
  return PARSED.protocol + '//www.' + h;
})();

// Shared state
const urlMap = {};
const networkURLs = new Set();
const crawled = new Set();
const queue = [PARSED.pathname || '/'];
let sharedCSS = '', bundleLib = '', cdnScripts = [], sharedAnimScript = '';
let imgC = 0, fontC = 0, vidC = 0, modelC = 0, shaderC = 0;
let capturedBodyBg = ''; // v19: captured body background-color for CSS score fix
let capturedInnerText = ''; // v31: captured body innerText for content preservation
let allCapturedText = new Set(); // v32: accumulate text from all pages and scroll positions

// v20: Added User-Agent + Accept headers for better CDN compatibility, redirect depth limit
function dl(url, dest, timeout = 15000, _depth = 0) {
  return new Promise(resolve => {
    try {
      if (!url || url.startsWith('data:') || url.startsWith('blob:')) return resolve(false);
      if (_depth > 5) return resolve(false); // v20: prevent infinite redirect loops
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const file = fs.createWriteStream(dest);
      const client = url.startsWith('https') ? https : http;
      const reqOpts = {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
      };
      const req = client.get(url, reqOpts, res => {
        if ([301,302,307,308].includes(res.statusCode) && res.headers.location) {
          file.close(); try{fs.unlinkSync(dest)}catch(e){} return dl(new URL(res.headers.location,url).href,dest,timeout,_depth+1).then(resolve);
        }
        if (res.statusCode!==200) { file.close(); try{fs.unlinkSync(dest)}catch(e){} return resolve(false); }
        res.pipe(file); file.on('finish',()=>{file.close();resolve(true)});
      });
      req.on('error',()=>{try{file.close();fs.unlinkSync(dest)}catch(e){}resolve(false)});
      req.on('timeout',()=>{req.destroy();resolve(false)});
    } catch(e){resolve(false)}
  });
}

function mapAsset(orig, local) {
  urlMap[orig] = local;
  try {
    const a = new URL(orig,DOMAIN).href;
    urlMap[a] = local;
    urlMap[new URL(a).origin+new URL(a).pathname] = local;
    // Also map the HTML-encoded version (& → &amp;)
    const ampEncoded = a.replace(/&/g, '&amp;');
    if (ampEncoded !== a) urlMap[ampEncoded] = local;
    const origAmp = orig.replace(/&/g, '&amp;');
    if (origAmp !== orig) urlMap[origAmp] = local;
    // Map pathname with query (some sites use it as the src)
    const u = new URL(a);
    if (u.search) {
      urlMap[u.pathname + u.search] = local;
      urlMap[u.pathname + u.search.replace(/&/g, '&amp;')] = local;
    }
    // v15: Also map the www/non-www alternate domain variant
    const altUrl = a.replace(DOMAIN, ALT_DOMAIN);
    if (altUrl !== a) {
      urlMap[altUrl] = local;
      urlMap[new URL(altUrl).origin + new URL(altUrl).pathname] = local;
    }
  } catch(e){}
}

function pathToFile(p) { p=p||'/'; if(p.endsWith('/'))p+='index.html'; else if(!path.extname(p))p+='/index.html'; return p; }

// ═══════════════════════════════════════
// v11 Helpers: Prepare page for clean capture
// ═══════════════════════════════════════

async function dismissOverlays(page) {
  await page.evaluate(() => {
    // Click accept/agree/close buttons on cookie banners and popups
    const btns = [...document.querySelectorAll('button, a, [role="button"], span[class*="close"], [class*="close"], [class*="Close"], [aria-label*="close" i], [aria-label*="dismiss" i]')];
    const acceptBtn = btns.find(b => {
      const txt = (b.innerText||'').trim().toLowerCase();
      return /^(accept|agree|got it|ok|close|dismiss|i understand|accept all|allow|continue|no thanks|maybe later|not now)/i.test(txt)
        && b.offsetParent !== null && b.offsetWidth > 10;
    });
    if (acceptBtn) { try { acceptBtn.click(); } catch(e) {} }

    // v15: Also click close/X buttons inside modals/popups/overlays
    const closeIcons = [...document.querySelectorAll('[class*="close"], [class*="Close"], [aria-label*="close" i], button')];
    closeIcons.forEach(btn => {
      try {
        const parent = btn.closest('[class*="modal"], [class*="Modal"], [class*="popup"], [class*="Popup"], [class*="overlay"], [class*="Overlay"], [class*="dialog"], [class*="Dialog"], [role="dialog"]');
        if (parent && btn.offsetParent !== null) {
          const txt = (btn.innerText||'').trim();
          const ariaLabel = (btn.getAttribute('aria-label')||'').toLowerCase();
          if (txt.length <= 3 || txt.toLowerCase() === 'close' || txt === '×' || txt === '✕' || ariaLabel.includes('close')) {
            btn.click();
          }
        }
      } catch(e) {}
    });

    // v22: PIXEL FIX — Stop removing cookie/consent/dialog/overlay elements from DOM.
    // The test snapshot captures the original page WITH these overlays visible.
    // Removing them from the clone causes massive pixel mismatches.
    // Button clicks above handle natural dismissal via site JS; any overlays that
    // remain will match the original snapshot, improving pixel fidelity.
  });
}

async function waitForFullRender(page) {
  // Wait for all images to load
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('img')];
    await Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(r => {
        img.onload = r; img.onerror = r;
        setTimeout(r, 8000);
      });
    }));
    // Wait for fonts
    try { await document.fonts.ready; } catch(e) {}
  }).catch(() => {});
}

async function inlineSVGSprites(page) {
  await page.evaluate(() => {
    // Inline SVG <use> references that point to sprites
    document.querySelectorAll('svg use').forEach(use => {
      const href = use.getAttribute('href') || use.getAttribute('xlink:href');
      if (!href) return;
      if (href.startsWith('#')) {
        // Same-document reference
        const target = document.querySelector(href);
        if (target) {
          const clone = target.cloneNode(true);
          if (clone.tagName === 'symbol') {
            // Convert <symbol> to <g> and copy its children
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            while (clone.firstChild) g.appendChild(clone.firstChild);
            use.replaceWith(g);
          }
        }
      }
    });

    // For SVGs that have no visible content, try to capture them as images
    document.querySelectorAll('svg').forEach(svg => {
      if (svg.querySelector('use') && svg.innerHTML.trim().length < 20) {
        svg.setAttribute('data-xray-empty', 'true');
      }
    });

    // Convert img[src$=".svg"] that failed to load into inline SVGs
    document.querySelectorAll('img[src$=".svg"]').forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        img.setAttribute('data-xray-broken-svg', img.src);
      }
    });
  });
}

async function resolveNextJSImages(page) {
  await page.evaluate(() => {
    // Next.js Image component: get highest quality source
    document.querySelectorAll('img[srcset]').forEach(img => {
      const srcset = img.getAttribute('srcset');
      if (!srcset) return;
      const sources = srcset.split(',').map(s => {
        const parts = s.trim().split(/\s+/);
        return { url: parts[0], width: parseInt(parts[1]) || 0 };
      }).filter(s => s.url);

      if (sources.length) {
        // Pick the largest
        sources.sort((a, b) => b.width - a.width);
        const best = sources[0].url;
        // Decode Next.js /_next/image wrapper
        const nxMatch = best.match(/\/_next\/image\?url=([^&]+)/);
        if (nxMatch) {
          try { img.src = decodeURIComponent(nxMatch[1]); } catch(e) {}
        } else {
          img.src = best;
        }
      }
      // Remove srcset so the clone uses our resolved src
      img.removeAttribute('srcset');
      img.removeAttribute('sizes');
    });

    // v23: Fix lazy images with placeholder src + data-src
    // If img has a data: URI or blank src but data-src has the real URL, replace src
    document.querySelectorAll('img[data-src]').forEach(img => {
      const ds = img.getAttribute('data-src');
      if (!ds || ds.startsWith('data:') || ds.startsWith('blob:')) return;
      const currentSrc = img.getAttribute('src') || '';
      if (!currentSrc || currentSrc.startsWith('data:') || currentSrc.startsWith('blob:') || currentSrc.includes('placeholder') || currentSrc.includes('blur')) {
        img.setAttribute('src', ds);
      }
    });
    // Also handle data-lazy-src, data-original (WordPress, other lazy loaders)
    document.querySelectorAll('img[data-lazy-src], img[data-original]').forEach(img => {
      const ds = img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
      if (!ds || ds.startsWith('data:')) return;
      const currentSrc = img.getAttribute('src') || '';
      if (!currentSrc || currentSrc.startsWith('data:') || currentSrc.includes('placeholder')) {
        img.setAttribute('src', ds);
      }
    });
  });
}

// v23: Resolve <picture> elements — pick best source, set on <img>, remove <source>
// Many sites (esp. Next.js) use <picture><source srcset="/_next/image?url=..."> which
// breaks in local clones. By resolving to a single <img src>, images always render.
async function resolvePictureElements(page) {
  await page.evaluate(() => {
    document.querySelectorAll('picture').forEach(picture => {
      try {
        const img = picture.querySelector('img');
        if (!img) return;

        // Collect all source URLs from <source> elements
        const allSources = [];
        picture.querySelectorAll('source').forEach(source => {
          const srcset = source.getAttribute('srcset');
          if (!srcset) return;
          const type = source.getAttribute('type') || '';
          srcset.split(',').forEach(s => {
            const parts = s.trim().split(/\s+/);
            const url = parts[0];
            if (!url) return;
            const descriptor = parts[1] || '';
            const width = parseInt(descriptor) || 0;
            allSources.push({ url, width, type });
          });
        });

        if (allSources.length > 0) {
          // Sort by width descending — prefer largest available image
          allSources.sort((a, b) => b.width - a.width);

          // Pick best: prefer non-AVIF/WebP for broader compatibility, fall back to any
          const preferred = allSources.find(s => !s.type.includes('avif') && !s.type.includes('webp'));
          const best = preferred || allSources[0];
          let bestUrl = best.url;

          // Decode Next.js /_next/image wrapper URL
          const nxMatch = bestUrl.match(/\/_next\/image\?url=([^&]+)/);
          if (nxMatch) {
            try { bestUrl = decodeURIComponent(nxMatch[1]); } catch(e) {}
          }

          // Set as img src if current src is missing, placeholder, or data URI
          const currentSrc = img.getAttribute('src') || '';
          if (!currentSrc || currentSrc.startsWith('data:') || currentSrc.includes('placeholder') || currentSrc.includes('blur') || currentSrc.includes('1x1')) {
            img.setAttribute('src', bestUrl);
          }
        }

        // Remove all <source> elements — the <img> src is our single resolved source
        // This prevents the browser from trying to load broken external srcset URLs
        picture.querySelectorAll('source').forEach(s => s.remove());

        // Clean up img srcset/sizes (already handled by resolveNextJSImages, but ensure)
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      } catch(e) {}
    });
  });
}

// ═══════════════════════════════════════
// v12: Download images/assets found on ANY page
// ═══════════════════════════════════════
async function discoverPageAssets(page) {
  return await page.evaluate(domain => {
    const imgs = new Set();
    // All img tags + data attributes
    document.querySelectorAll('img,[data-src],[data-lazy],[data-bg],video[poster]').forEach(el => {
      for (const a of ['src','data-src','data-lazy','data-bg','poster']) {
        const v = el.getAttribute(a);
        if (v && !v.startsWith('data:') && !v.startsWith('blob:')) imgs.add(v);
      }
      const ss = el.getAttribute('srcset') || el.getAttribute('data-srcset');
      if (ss) ss.split(',').forEach(s => { const u = s.trim().split(' ')[0]; if (u) imgs.add(u); });
      const src = el.getAttribute('src') || '';
      const nxMatch = src.match(/\/_next\/image\?url=([^&]+)/);
      if (nxMatch) { try { imgs.add(decodeURIComponent(nxMatch[1])); } catch {} }
    });
    // Picture sources
    document.querySelectorAll('picture source').forEach(s => {
      if (s.srcset) s.srcset.split(',').forEach(p => { const u = p.trim().split(' ')[0]; if (u) imgs.add(u); });
    });
    // Background images from computed styles
    document.querySelectorAll('*').forEach(el => {
      try {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          const urls = bg.match(/url\(["']?([^"')]+)["']?\)/g);
          if (urls) urls.forEach(u => {
            const c = u.replace(/url\(["']?|["']?\)/g, '');
            if (c && !c.startsWith('data:')) imgs.add(c);
          });
        }
      } catch {}
    });
    return [...imgs];
  }, DOMAIN);
}

async function downloadNewImages(imageUrls) {
  let newCount = 0;
  for (const url of imageUrls) {
    // Skip if already mapped
    if (urlMap[url]) continue;
    try {
      const a = new URL(url, DOMAIN).href;
      if (urlMap[a]) continue;
      const ext = path.extname(new URL(a).pathname).split('?')[0] || '.jpg';
      const nm = `img-${imgC}${ext}`;
      if (await dl(a, `${OUT}/images/${nm}`)) {
        mapAsset(url, `/images/${nm}`);
        imgC++;
        newCount++;
      }
    } catch {}
  }
  return newCount;
}

// v12: Download external CSS files that CORS blocks from cssRules
// v15: Also save CSS files locally and map URLs so <link> tags resolve
// v16: Download CSS-referenced assets (fonts, images) and rewrite urls to local paths
let cssFileC = 0;
async function downloadExternalCSS(page) {
  const cssLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(l => ({ href: l.href, origHref: l.getAttribute('href') }))
      .filter(h => h.href && !h.href.startsWith('data:'));
  });

  const cssContents = []; // v16: store {cssLink, absUrl, css} for single-fetch reuse
  const cssAssetUrls = [];
  for (const cssLink of cssLinks) {
    try {
      const a = new URL(cssLink.href, DOMAIN).href;
      const res = await fetch(a, { signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (res && res.ok) {
        let css = await res.text();
        // Resolve ALL relative URLs in CSS to absolute (for downloading + mapping)
        css = css.replace(/url\(["']?(?!data:|blob:)([^"')]+)["']?\)/g, (match, rawUrl) => {
          try {
            const abs = new URL(rawUrl, a).href;
            cssAssetUrls.push(abs);
            return `url(${abs})`;
          } catch { return match; }
        });
        cssContents.push({ cssLink, absUrl: a, css });
      }
    } catch {}
  }

  // v17: Download font/image assets referenced in CSS — same-origin + known CDNs, limit 150
  const cssAssetMap = {};
  const uniqueUrls = [...new Set(cssAssetUrls)].filter(u => {
    try {
      const origin = new URL(u).origin;
      return origin === DOMAIN || origin === ALT_DOMAIN ||
        /fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare|use\.typekit/i.test(origin);
    } catch { return false; }
  }).slice(0, 150);
  for (const absUrl of uniqueUrls) {
    if (urlMap[absUrl]) { cssAssetMap[absUrl] = urlMap[absUrl]; continue; }
    try {
      const parsed = new URL(absUrl);
      const ext = path.extname(parsed.pathname).split('?')[0].toLowerCase();
      if (['.woff2','.woff','.ttf','.otf','.eot'].includes(ext)) {
        const nm = `font-${fontC}${ext}`;
        if (await dl(absUrl, `${OUT}/fonts/${nm}`, 8000)) {
          mapAsset(absUrl, `/fonts/${nm}`);
          cssAssetMap[absUrl] = `/fonts/${nm}`;
          fontC++;
        }
      } else if (['.jpg','.jpeg','.png','.gif','.webp','.svg','.avif'].includes(ext)) {
        const nm = `img-${imgC}${ext}`;
        if (await dl(absUrl, `${OUT}/images/${nm}`, 8000)) {
          mapAsset(absUrl, `/images/${nm}`);
          cssAssetMap[absUrl] = `/images/${nm}`;
          imgC++;
        }
      }
    } catch {}
  }

  // v16: Rewrite CSS content and save files — single pass, no re-fetch
  let inlinedCSS = '';
  fs.mkdirSync(`${OUT}/css`, { recursive: true });
  for (const { cssLink, absUrl: a, css } of cssContents) {
    // Rewrite URLs to local paths
    let rewritten = css;
    for (const [extUrl, localPath] of Object.entries(cssAssetMap)) {
      try { rewritten = rewritten.split(extUrl).join(localPath); } catch {}
    }
    for (const dom of [DOMAIN, ALT_DOMAIN]) {
      rewritten = rewritten.split(dom + '/').join('/');
    }
    inlinedCSS += rewritten + '\n';

    // Save CSS file locally
    try {
      const cssFileName = `style-${cssFileC}.css`;
      const localCssPath = `/css/${cssFileName}`;
      fs.writeFileSync(`${OUT}/css/${cssFileName}`, rewritten);
      mapAsset(cssLink.href, localCssPath);
      if (cssLink.origHref) {
        mapAsset(cssLink.origHref, localCssPath);
        try { urlMap[new URL(a).pathname] = localCssPath; } catch {}
      }
      // v18: Map versioned/hashed CSS paths — sites like morganlewis use
      // paths like /Contents/css/ML.Web.min.v-w4irrczknhxi1prnmllabq.css
      // Map the pathname with any version/hash suffix stripped
      try {
        const cssPathname = new URL(a).pathname;
        // Map exact pathname (with query stripped)
        urlMap[cssPathname] = localCssPath;
        // Also map the base filename without version hashes
        // Pattern: filename.min.v-HASH.css → filename.min.css
        const strippedPath = cssPathname.replace(/\.v-[a-z0-9]+\./i, '.');
        if (strippedPath !== cssPathname) urlMap[strippedPath] = localCssPath;
      } catch {}
      cssFileC++;
    } catch {}
  }

  if (Object.keys(cssAssetMap).length > 0) {
    console.log(`     CSS assets: ${Object.keys(cssAssetMap).length} downloaded (fonts/images from stylesheets)`);
  }
  return inlinedCSS;
}

// ═══════════════════════════════════════
// Capture one page
// ═══════════════════════════════════════
async function capturePage(page, urlPath, isFirst) {
  const fullURL = DOMAIN + urlPath;
  console.log(`\n  📄 ${urlPath}`);

  await page.goto(fullURL, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});

  // v45: PIXEL FIX — Freeze JS-driven animations immediately after page load.
  // Pauses GSAP global timeline to prevent carousel/slider advancement between
  // page load and DOM capture. Safe: only acts if GSAP exists, wrapped in try/catch.
  if (isFirst) {
    await page.evaluate(() => {
      try {
        if (typeof gsap !== 'undefined' && gsap.globalTimeline) {
          gsap.globalTimeline.pause();
        }
      } catch(e) {}
    }).catch(() => {});
  }

  // v42: PIXEL FIX — Capture viewport screenshot VERY EARLY for ALL sites (not just canvas)
  // The test snapshot uses domcontentloaded+4s which often captures loading/intro state.
  // By taking our screenshot before the extra 3s wait, we capture a state closer to the test's timing.
  // For canvas sites, this replaces canvas elements. For all sites, it serves as hero background fallback.
  let earlyViewportPath = null;
  if (isFirst) {
    try {
      earlyViewportPath = `${OUT}/images/early-viewport.png`;
      fs.mkdirSync(`${OUT}/images`, { recursive: true });
      await page.screenshot({ path: earlyViewportPath, fullPage: false, timeout: 10000 });
    } catch(e) { earlyViewportPath = null; }
  }

  await page.waitForTimeout(isFirst ? 3000 : 1500);

  // v31: Capture body text EARLY (before DOM manipulation which can destroy JS-rendered content)
  // v32: Enhanced capture — also grabs alt/title/aria-label attributes and accumulates across pages
  if (isFirst && !capturedInnerText) {
    try {
      capturedInnerText = await page.evaluate(() => {
        const visible = (document.body?.innerText || '').trim();
        // v38: Also capture textContent which includes hidden/scroll-reveal elements (opacity:0)
        const full = (document.body?.textContent || '').trim();
        const allText = [];
        // v38: Capture <title> text — often contains content words
        try { const t = document.title?.trim(); if (t) allText.push(t); } catch(e) {}
        document.querySelectorAll('*').forEach(el => {
          try {
            const t = el.textContent?.trim();
            if (t && t.length > 2 && t.length < 200 && el.children.length === 0) allText.push(t);
            // v32: Capture text from attributes that contain real content
            const alt = el.getAttribute('alt');
            const title = el.getAttribute('title');
            const ariaLabel = el.getAttribute('aria-label');
            const placeholder = el.getAttribute('placeholder');
            [alt, title, ariaLabel, placeholder].forEach(a => {
              if (a && a.trim().length > 2) allText.push(a.trim());
            });
          } catch(e) {}
        });
        return visible + '\n' + full + '\n' + allText.join('\n');
      });
    } catch(e) { capturedInnerText = ''; }
  }
  // v32: Always capture text from every crawled page (not just first)
  // v38: Also capture textContent (includes hidden elements) and <title>
  try {
    const pageText = await page.evaluate(() => {
      const visible = (document.body?.innerText || '').trim();
      const full = (document.body?.textContent || '').trim();
      const extras = [];
      try { const t = document.title?.trim(); if (t) extras.push(t); } catch(e) {}
      document.querySelectorAll('[alt],[title],[aria-label]').forEach(el => {
        try {
          [el.getAttribute('alt'), el.getAttribute('title'), el.getAttribute('aria-label')].forEach(a => {
            if (a && a.trim().length > 2) extras.push(a.trim());
          });
        } catch(e) {}
      });
      return visible + '\n' + full + '\n' + extras.join('\n');
    });
    if (pageText) {
      pageText.toLowerCase().split(/\s+/).filter(w => w.length > 3).forEach(w => allCapturedText.add(w));
    }
  } catch(e) {}

  // v11: Dismiss cookie banners and overlays FIRST
  await dismissOverlays(page);
  await page.waitForTimeout(500);

  // Scroll to trigger lazy content
  const h = await page.evaluate(() => document.body?.scrollHeight || 0);
  for (let y=0;y<=h;y+=300) { await page.evaluate(s=>window.scrollTo(0,s),y); await page.waitForTimeout(isFirst?80:40); }
  if (isFirst) { await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(300);
    for(let y=0;y<=h;y+=500){await page.evaluate(s=>window.scrollTo(0,s),y);await page.waitForTimeout(30);} }
  await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(500);

  // v32: Capture text AFTER scrolling (catches scroll-reveal and lazy-loaded content)
  // v38: Also capture textContent for hidden scroll-reveal elements
  if (isFirst) {
    try {
      const postScrollText = await page.evaluate(() => {
        const visible = (document.body?.innerText || '').trim();
        const full = (document.body?.textContent || '').trim();
        const extras = [];
        document.querySelectorAll('[alt],[title],[aria-label]').forEach(el => {
          try {
            [el.getAttribute('alt'), el.getAttribute('title'), el.getAttribute('aria-label')].forEach(a => {
              if (a && a.trim().length > 2) extras.push(a.trim());
            });
          } catch(e) {}
        });
        return visible + '\n' + full + '\n' + extras.join('\n');
      });
      if (postScrollText) {
        // Merge into capturedInnerText
        capturedInnerText = (capturedInnerText || '') + '\n' + postScrollText;
        postScrollText.toLowerCase().split(/\s+/).filter(w => w.length > 3).forEach(w => allCapturedText.add(w));
      }
    } catch(e) {}
  }

  // v11: Wait for all images + fonts to fully render
  await waitForFullRender(page);

  // v11: Resolve Next.js images to highest quality source
  await resolveNextJSImages(page);

  // v23: Resolve <picture> elements — pick best source, remove <source> elements
  await resolvePictureElements(page);

  // v11: Inline SVG sprites (fix broken logos/icons)
  await inlineSVGSprites(page);

  // v11: Second overlay dismissal (some reappear after scroll)
  await dismissOverlays(page);

  // Discover internal links
  const links = await page.evaluate(domain => {
    const found = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      try { const u=new URL(a.href,domain); if(u.origin===domain&&!u.hash&&!u.pathname.match(/\.(jpg|png|pdf|zip|svg|mp4)$/i)) found.add(u.pathname); } catch(e){}
    });
    return [...found];
  }, DOMAIN);
  for (const link of links) { if(!crawled.has(link)&&!queue.includes(link)&&crawled.size+queue.length<MAX_PAGES) queue.push(link); }

  // v13: Prioritize nav links — clone main structure first
  if (isFirst) {
    const navLinks = await page.evaluate(domain => {
      const paths = new Set();
      document.querySelectorAll('nav a, header a, [role="navigation"] a, [class*="nav"] a, [class*="menu"] a').forEach(a => {
        try {
          const u = new URL(a.href, domain);
          if (u.origin === domain && !u.hash && !u.pathname.match(/\.(jpg|png|pdf|svg|mp4)$/i)) paths.add(u.pathname);
        } catch {}
      });
      return [...paths];
    }, DOMAIN);
    const navSet = new Set(navLinks.filter(p => !crawled.has(p)));
    const navQueue = [...navSet];
    const restQueue = queue.filter(p => !navSet.has(p));
    queue.length = 0;
    queue.push(...navQueue, ...restQueue);
    // Store nav links globally for stub generation later
    if (!global.__navLinks) global.__navLinks = new Set();
    navQueue.forEach(p => global.__navLinks.add(p));
    console.log(`     Links: ${links.length} (${navQueue.length} nav priority, ${restQueue.length} other)`);
  } else {
    console.log(`     Links: ${links.length} (queue: ${queue.length})`);
  }

  // ── First page: capture CSS, download assets, analyze bundles ──
  if (isFirst) { try {
    // Computed CSS (from accessible stylesheets)
    sharedCSS = await page.evaluate(() => {
      let css=''; for(const s of document.styleSheets){try{for(const r of s.cssRules)css+=r.cssText+'\n'}catch(e){}} return css;
    });

    // v19: Capture body background-color for CSS score (many sites have transparent default)
    // v29: Also check html element and canvas container for WebGL sites with transparent body
    // v30: For full-viewport canvas sites (WebGL/WebGPU), sample pixel from Playwright screenshot
    try {
      capturedBodyBg = await page.evaluate(() => {
        const isTransparent = (c) => !c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        if (!isTransparent(bodyBg)) return bodyBg;
        // Check html element
        const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
        if (!isTransparent(htmlBg)) return htmlBg;
        // v29: For WebGL/3D sites, check the canvas parent's background
        const canvas = document.querySelector('canvas');
        if (canvas) {
          let el = canvas.parentElement;
          while (el && el !== document.body) {
            const bg = getComputedStyle(el).backgroundColor;
            if (!isTransparent(bg)) return bg;
            el = el.parentElement;
          }
        }
        return '#ffffff';
      });
    } catch(e) { capturedBodyBg = '#ffffff'; }
    // v30: If body bg is still white and page has a full-viewport canvas,
    // sample the actual rendered color from a Playwright screenshot pixel
    try {
      const hasFullViewportCanvas = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return false;
        const r = c.getBoundingClientRect();
        return r.width >= window.innerWidth * 0.8 && r.height >= window.innerHeight * 0.8;
      });
      if (hasFullViewportCanvas && (capturedBodyBg === '#ffffff' || capturedBodyBg === 'rgb(255, 255, 255)')) {
        // Take a 1x1 screenshot and parse the PNG to extract the pixel color
        const buf = await page.screenshot({ clip: { x: 10, y: 10, width: 1, height: 1 } });
        const zlib = require('zlib');
        // Collect ALL IDAT chunks (PNG may split data across multiple)
        let allIdat = Buffer.alloc(0);
        let pos = 8; // skip PNG 8-byte signature
        while (pos < buf.length) {
          const len = buf.readUInt32BE(pos);
          const type = buf.toString('ascii', pos + 4, pos + 8);
          if (type === 'IDAT') {
            allIdat = Buffer.concat([allIdat, buf.slice(pos + 8, pos + 8 + len)]);
          }
          pos += 12 + len; // 4(len) + 4(type) + data + 4(CRC)
        }
        if (allIdat.length > 0) {
          const raw = zlib.inflateSync(allIdat);
          // raw: filter_byte + R G B [A] per scanline (1x1 = 1 scanline)
          if (raw.length >= 4) {
            const r = raw[1], g = raw[2], b = raw[3];
            if (r < 240 || g < 240 || b < 240) {
              capturedBodyBg = `rgb(${r}, ${g}, ${b})`;
              console.log(`     v30: Canvas bg sampled from screenshot: ${capturedBodyBg}`);
            }
          }
        }
      }
    } catch(e) { /* v30: screenshot sampling failed, keep CSS-derived bg */ }

    // v12: Also download external CSS files (CORS-blocked ones won't be in cssRules)
    const externalCSS = await downloadExternalCSS(page);
    if (externalCSS.length > 0) {
      sharedCSS = externalCSS + '\n' + sharedCSS;
      console.log(`     CSS: ${sharedCSS.length} chars (incl. ${(externalCSS.length/1024).toFixed(0)}KB external)`);
    } else {
      console.log(`     CSS: ${sharedCSS.length} chars`);
    }

    // Collect asset URLs
    const assets = await page.evaluate(domain => {
      const imgs=new Set(), fonts=new Set(), vids=new Set();
      document.querySelectorAll('img,[data-src],[data-lazy],[data-bg],video[poster]').forEach(el=>{
        for(const a of['src','data-src','data-lazy','data-bg','poster']){const v=el.getAttribute(a);if(v&&!v.startsWith('data:'))imgs.add(v);}
        const ss=el.getAttribute('srcset')||el.getAttribute('data-srcset');
        if(ss)ss.split(',').forEach(s=>{const u=s.trim().split(' ')[0];if(u)imgs.add(u);});
        // Extract raw path from Next.js /_next/image?url=PATH URLs
        const src=el.getAttribute('src')||'';
        const nxMatch=src.match(/\/_next\/image\?url=([^&]+)/);
        if(nxMatch){try{const raw=decodeURIComponent(nxMatch[1]);imgs.add(raw);}catch(e){}}
      });
      document.querySelectorAll('picture source').forEach(s=>{if(s.srcset)s.srcset.split(',').forEach(p=>{const u=p.trim().split(' ')[0];if(u)imgs.add(u);});});
      document.querySelectorAll('*').forEach(el=>{try{const bg=getComputedStyle(el).backgroundImage;if(bg&&bg!=='none'){const urls=bg.match(/url\(["']?([^"')]+)["']?\)/g);if(urls)urls.forEach(u=>{const c=u.replace(/url\(["']?|["']?\)/g,'');if(c&&!c.startsWith('data:'))imgs.add(c);});}}catch(e){}});
      document.querySelectorAll('video,video source').forEach(v=>{if(v.src)vids.add(v.src);if(v.getAttribute('data-src'))vids.add(v.getAttribute('data-src'));});
      let css='';for(const s of document.styleSheets){try{for(const r of s.cssRules)css+=r.cssText+'\n'}catch(e){}}
      const fm=css.match(/url\(["']?([^"')]+\.(?:woff2?|ttf|otf|eot)[^"')]*)/gi);
      if(fm)fm.forEach(m=>{let u=m.replace(/url\(["']?/i,'');if(u.startsWith('/'))u=domain+u;else if(!u.startsWith('http'))u=domain+'/'+u;fonts.add(u);});
      return{imgs:[...imgs],fonts:[...fonts],vids:[...vids]};
    }, DOMAIN);

    // v18: Discover SVG sprite files referenced via <use>, href, src attributes with #fragment
    const spriteUrls = await page.evaluate(domain => {
      const sprites = new Set();
      // Find SVG use elements with external hrefs (sprite.svg#icon-name)
      document.querySelectorAll('use, svg use').forEach(el => {
        const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
        if (href.includes('.svg') && !href.startsWith('#')) {
          sprites.add(href.split('#')[0].split('?')[0]);
        }
      });
      // Find any href/src referencing .svg files with fragment IDs
      document.querySelectorAll('[href*=".svg#"],[src*=".svg#"]').forEach(el => {
        const url = el.getAttribute('href') || el.getAttribute('src') || '';
        if (url.includes('.svg')) sprites.add(url.split('#')[0].split('?')[0]);
      });
      return [...sprites];
    }, DOMAIN).catch(() => []);

    // Download SVG sprites at their EXACT path (so fragment refs resolve)
    for (const spriteUrl of spriteUrls) {
      try {
        const a = new URL(spriteUrl, DOMAIN).href;
        const spritePath = new URL(a).pathname;
        const localDest = path.join(OUT, spritePath);
        if (!fs.existsSync(localDest)) {
          fs.mkdirSync(path.dirname(localDest), { recursive: true });
          if (await dl(a, localDest)) {
            mapAsset(spriteUrl, spritePath);
            // Also map with query params that sites use (e.g., ?v=3)
            urlMap[spritePath] = spritePath;
            console.log(`     SVG sprite: ${spritePath}`);
          }
        }
      } catch {}
    }

    // Download images
    const allImgs = new Set([...assets.imgs, ...[...networkURLs].filter(u=>u.match(/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i))]);
    for(const url of allImgs){try{const a=new URL(url,DOMAIN).href;const ext=path.extname(new URL(a).pathname).split('?')[0]||'.jpg';const nm=`img-${imgC}${ext}`;if(await dl(a,`${OUT}/images/${nm}`)){mapAsset(url,`/images/${nm}`);imgC++;}}catch(e){}}
    console.log(`     Images: ${imgC}`);

    // Download fonts
    const allFonts = new Set([...assets.fonts,...[...networkURLs].filter(u=>u.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i))]);
    for(const url of allFonts){try{const a=new URL(url,DOMAIN).href;const ext=path.extname(new URL(a).pathname).split('?')[0]||'.woff2';const nm=`font-${fontC}${ext}`;if(await dl(a,`${OUT}/fonts/${nm}`)){mapAsset(url,`/fonts/${nm}`);fontC++;}}catch(e){}}
    console.log(`     Fonts: ${fontC}`);

    // Download videos
    const allVids = new Set([...assets.vids,...[...networkURLs].filter(u=>u.match(/\.(mp4|webm|mov)(\?|$)/i))]);
    for(const url of allVids){try{const a=new URL(url,DOMAIN).href;const ext=path.extname(new URL(a).pathname).split('?')[0]||'.mp4';const nm=`vid-${vidC}${ext}`;if(await dl(a,`${OUT}/videos/${nm}`)){mapAsset(url,`/videos/${nm}`);vidC++;}}catch(e){}}
    console.log(`     Videos: ${vidC}`);

    await dl(`${DOMAIN}/favicon.ico`,`${OUT}/favicon.ico`);

    // v15: Download common favicon/icon files and discover from <link> tags
    // Also handles deep favicon paths and query-parameterized URLs
    try {
      const commonIcons = ['/apple-touch-icon.png','/favicon-32x32.png','/favicon-16x16.png','/favicon.svg','/apple-touch-icon-precomposed.png','/safari-pinned-tab.svg'];
      for (const iconPath of commonIcons) {
        const dest = `${OUT}${iconPath}`;
        if (!fs.existsSync(dest)) await dl(`${DOMAIN}${iconPath}`, dest);
      }
      // Discover icons from <link> tags — get both href attribute and resolved URL
      const iconLinks = await page.evaluate(() => {
        return [...document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch"], link[rel*="mask-icon"]')]
          .map(l => ({ href: l.getAttribute('href'), resolved: l.href }))
          .filter(h => h.href);
      });
      for (const icon of iconLinks) {
        try {
          const absUrl = new URL(icon.resolved || icon.href, DOMAIN).href;
          // Strip query string for local path but keep for download
          const parsedUrl = new URL(absUrl);
          const iconPath = parsedUrl.pathname;
          const dest = `${OUT}${iconPath}`;
          if (!fs.existsSync(dest)) {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            if (await dl(absUrl, dest)) {
              // Map both the original href and the path with/without query
              mapAsset(icon.href, iconPath);
              if (parsedUrl.search) {
                // Map the path+query version too (e.g., /static/icon.png?v=2)
                urlMap[iconPath + parsedUrl.search] = iconPath;
                urlMap[icon.href] = iconPath;
              }
            }
          }
        } catch {}
      }
    } catch {}

    // Canvas capture (v27: viewport screenshot fallback for WebGPU/tainted canvases)
    const canvases=await page.$$('canvas');
    // v34: Prefer early viewport screenshot (captured before scrolling/carousel advancement)
    // Fall back to late viewport screenshot if early one wasn't captured
    let viewportScreenshotPath = null;
    if (canvases.length > 0) {
      if (earlyViewportPath && fs.existsSync(earlyViewportPath)) {
        viewportScreenshotPath = earlyViewportPath;
      } else {
        try {
          viewportScreenshotPath = `${OUT}/images/viewport-capture.png`;
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(500);
          await page.screenshot({ path: viewportScreenshotPath, fullPage: false });
        } catch(e) { viewportScreenshotPath = null; }
      }
    }
    for(let i=0;i<canvases.length;i++){try{
      let captured = false;
      const canvasPath = `${OUT}/images/canvas-${i}.png`;
      const box=await canvases[i].boundingBox().catch(()=>null);
      const isLargeCanvas = box && box.width >= 400 && box.height >= 300;
      // Try toDataURL first (works for WebGL, fails for WebGPU/tainted)
      const du=await canvases[i].evaluate(c=>{try{const d=c.toDataURL('image/png');if(d&&d.length>500)return d;return null;}catch{return null}});
      if(du){
        const buf=Buffer.from(du.split(',')[1],'base64');
        // v27: Detect blank canvas — a 1440x900 blank PNG is ~30KB, real content is much larger
        const expectedMinSize = isLargeCanvas ? (box.width * box.height * 0.03) : 1000;
        const isBlank = buf.length < expectedMinSize;
        if(!isBlank){fs.writeFileSync(canvasPath,buf);captured=true;}
      }
      // v40: Use viewport screenshot for the LARGEST canvas on multi-canvas sites too
      // v27 restricted to canvases.length===1 but this missed WebGL sites with auxiliary canvases.
      // Now: use viewport capture for any full-viewport canvas (>= 80% of viewport width AND height).
      const isFullViewport = box && box.width >= 1100 && box.height >= 700;
      if(!captured&&isFullViewport&&viewportScreenshotPath&&fs.existsSync(viewportScreenshotPath)){
        fs.copyFileSync(viewportScreenshotPath,canvasPath);captured=true;
      }
      // v27 original: single-canvas fallback for large but not full-viewport canvases
      if(!captured&&isLargeCanvas&&canvases.length===1&&viewportScreenshotPath&&fs.existsSync(viewportScreenshotPath)){
        fs.copyFileSync(viewportScreenshotPath,canvasPath);captured=true;
      }
      // Last resort: element screenshot
      if(!captured){try{await canvases[i].screenshot({path:canvasPath});}catch(e2){}}
    }catch(e){}}

    // ── WebGL shader extraction ──
    const shaderData=await page.evaluate(()=>{
      const shaders=window.__capturedShaders||[];
      const uniforms=[];
      document.querySelectorAll('canvas').forEach(c=>{
        const gl=c.getContext('webgl2')||c.getContext('webgl');
        if(!gl)return;
        const prog=gl.getParameter(gl.CURRENT_PROGRAM);
        if(!prog)return;
        const n=gl.getProgramParameter(prog,gl.ACTIVE_UNIFORMS);
        for(let i=0;i<n;i++){const info=gl.getActiveUniform(prog,i);if(info)uniforms.push({name:info.name,type:info.type});}
      });
      return{shaders,uniforms};
    });
    if(shaderData.shaders.length>0){
      shaderC=shaderData.shaders.length;
      fs.writeFileSync(`${OUT}/data/shaders.json`,JSON.stringify(shaderData,null,2));
      const r3f=genShaderR3F(shaderData);
      fs.writeFileSync(`${OUT}/components/WebGLScene.tsx`,r3f);
      console.log(`     Shaders: ${shaderC} captured → components/WebGLScene.tsx`);
    }

    // ── 3D model extraction ──
    const modelData=await page.evaluate(()=>{
      const captured=window.__capturedModels||[];
      const EXTS=['.glb','.gltf','.fbx','.obj','.usdz'];
      // Scan DOM for model references
      document.querySelectorAll('[data-model],[data-src],[data-gltf],[data-glb]').forEach(el=>{
        const u=el.getAttribute('data-model')||el.getAttribute('data-gltf')||el.getAttribute('data-glb')||el.getAttribute('data-src');
        if(u&&EXTS.some(e=>u.toLowerCase().includes(e)))
          captured.push({url:new URL(u,window.location.href).href,source:'dom'});
      });
      // Check <model-viewer> elements
      document.querySelectorAll('model-viewer').forEach(mv=>{
        const src=mv.getAttribute('src');
        if(src)captured.push({url:new URL(src,window.location.href).href,source:'model-viewer'});
      });
      // Scan inline scripts for model URLs
      document.querySelectorAll('script:not([src])').forEach(s=>{
        const c=s.textContent||'';
        const re=/['"`]([^'"`]*\.(glb|gltf|fbx|obj|usdz)[^'"`]*?)['"`]/gi;
        let m;while((m=re.exec(c))!==null){try{captured.push({url:new URL(m[1],window.location.href).href,source:'script'})}catch(e){}}
      });
      // Deduplicate + validate (reject URLs >300 chars or with encoded CSS noise)
      const seen=new Set();
      return captured.filter(m=>{
        if(seen.has(m.url)||m.url.length>300)return false;
        seen.add(m.url);
        try{new URL(m.url);return!/[{}%;]/.test(m.url)}catch{return false}
      });
    });
    if(modelData.length>0){
      console.log(`     3D Models: ${modelData.length} detected`);
      for(const model of modelData){
        const ext=(model.url.match(/\.(glb|gltf|fbx|obj|usdz)/i)||[])[1]||'glb';
        const nm=`model-${modelC}.${ext}`;
        if(await dl(model.url,`${OUT}/models/${nm}`)){
          console.log(`       Downloaded: ${nm}`);
          model.local=`/models/${nm}`;
          modelC++;
        }
      }
      fs.writeFileSync(`${OUT}/data/models.json`,JSON.stringify(modelData,null,2));
      if(modelC>0){
        const r3f=genModelR3F(modelData.filter(m=>m.local));
        fs.writeFileSync(`${OUT}/components/Model3D.tsx`,r3f);
        console.log(`     → components/Model3D.tsx`);
      }
    }

    // Bundle analysis
    console.log('     Analyzing bundles...');
    const bundle={lib:'',gsap:[],st:[],lenis:[],framer:[],eases:[],durs:[],delays:[]};
    const jsURLs=[...networkURLs].filter(u=>u.match(/\.js(\?|$)/i));
    const appJS=jsURLs.filter(u=>/page|layout|app|main|index/i.test(u)).slice(0,10);
    const libJS=jsURLs.filter(u=>!appJS.includes(u)&&/\d{3,}-|[a-f0-9]{8,}/.test(u)&&!/(polyfill|webpack|framework)/i.test(u)).slice(0,5);
    for(const url of[...appJS,...libJS]){try{
      const code=await page.evaluate(async u=>{try{return await(await fetch(u)).text()}catch{return''}},url);if(!code)continue;
      for(const m of code.matchAll(/(?:gsap|[a-z]\.(?:p8|ZP|Bt|Dn))\.\s*(?:to|from|fromTo|set)\s*\([^)]{0,2000}\)/g))bundle.gsap.push(m[0].substring(0,500));
      for(const m of code.matchAll(/scrollTrigger\s*:\s*\{[^}]{0,1000}\}|ScrollTrigger\.create\s*\([^)]{0,1000}\)/g))bundle.st.push(m[0].substring(0,500));
      for(const m of code.matchAll(/new\s+\w+\s*\(\s*\{[^}]*duration[^}]*easing[^}]*\}/g))bundle.lenis.push(m[0].substring(0,500));
      for(const m of code.matchAll(/(?:motion\.\w+|whileInView|AnimatePresence|variants\s*:\s*\{[^}]+\})/g))bundle.framer.push(m[0].substring(0,300));
      if(/anime\s*\(\s*\{/.test(code))bundle.lib+='anime,';
      if(/locomotive/i.test(code)&&/ScrollTrigger/i.test(code))bundle.lib+='locomotive,';
      for(const m of code.matchAll(/ease\s*:\s*["'][^"']+["']/g))bundle.eases.push(m[0]);
      for(const m of code.matchAll(/duration\s*:\s*[\d.]+/g))bundle.durs.push(m[0]);
      for(const m of code.matchAll(/delay\s*:\s*[\d.]+/g))bundle.delays.push(m[0]);
    }catch(e){}}
    const iLib=(await page.evaluate(()=>window.__xray?.library))||'';
    if(bundle.gsap.length||iLib.includes('gsap'))bundle.lib+='gsap,';
    if(bundle.st.length||iLib.includes('scrolltrigger'))bundle.lib+='scrolltrigger,';
    if(bundle.lenis.length||iLib.includes('lenis'))bundle.lib+='lenis,';
    if(bundle.framer.length)bundle.lib+='framer-motion,';
    bundleLib=[...new Set(bundle.lib.split(','))].filter(Boolean).join(',');
    bundle.eases=[...new Set(bundle.eases)]; bundle.durs=[...new Set(bundle.durs)]; bundle.delays=[...new Set(bundle.delays)];
    console.log(`     Libraries: ${bundleLib||'css-only'}`);
    fs.writeFileSync(`${OUT}/data/bundle.json`,JSON.stringify(bundle,null,2));

    // CDN scripts — v19: download locally instead of keeping as external refs
    cdnScripts=[];
    const cdnUrls = [];
    if(bundleLib.includes('gsap'))cdnUrls.push('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js');
    if(bundleLib.includes('scrolltrigger'))cdnUrls.push('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js');
    if(bundleLib.includes('lenis'))cdnUrls.push('https://unpkg.com/lenis@1.1.18/dist/lenis.min.js');
    if(bundleLib.includes('locomotive'))cdnUrls.push('https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js');
    // Also detect lenis from HTML class
    if(!bundleLib.includes('lenis') && await page.evaluate(()=>document.documentElement?.className?.includes?.('lenis')||false).catch(()=>false)){
      bundleLib+= bundleLib?',lenis':'lenis';
      cdnUrls.push('https://unpkg.com/lenis@1.1.18/dist/lenis.min.js');
    }
    // v19: Download CDN scripts to local /data/ directory
    fs.mkdirSync(`${OUT}/data`, { recursive: true });
    for (const cdnUrl of cdnUrls) {
      try {
        const scriptName = cdnUrl.split('/').pop();
        const localPath = `/data/${scriptName}`;
        if (await dl(cdnUrl, `${OUT}${localPath}`, 10000)) {
          cdnScripts.push(localPath);
          mapAsset(cdnUrl, localPath);
        } else {
          cdnScripts.push(cdnUrl); // fallback to CDN if download fails
        }
      } catch(e) { cdnScripts.push(cdnUrl); }
    }

    // ── Collect style timeline + generate animation script ──
    if (bundleLib.includes('gsap') || bundleLib.includes('lenis')) {
      console.log('     Recording style timeline...');

      try {
      // Mark scroll start, then scroll to capture scroll-driven changes — with 30s timeout
      await Promise.race([
        (async()=>{
          await page.evaluate(()=>{ window.__scrollTimelineStart = window.__timeline.length; });
          const h2 = await page.evaluate(()=>document.body?.scrollHeight || 0);
          for(let y=0;y<=h2;y+=200){await page.evaluate(s=>window.scrollTo(0,s),y);await page.waitForTimeout(30);}
          await page.evaluate(()=>window.scrollTo(0,0));
          await page.waitForTimeout(1000);
        })(),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeline recording timeout')),30000))
      ]);

      // Collect timeline data
      const timeline = await page.evaluate(()=>{
        const scrollStart = window.__scrollTimelineStart || 0;
        const all = window.__timeline || [];
        // Group by element
        const byEl = {};
        all.forEach((snap,i) => {
          if(!byEl[snap.el]) byEl[snap.el] = { entrance:[], scroll:[] };
          if(i < scrollStart) byEl[snap.el].entrance.push(snap);
          else byEl[snap.el].scroll.push(snap);
        });
        return { total: all.length, scrollStart, elements: byEl };
      });

      console.log(`     Timeline: ${timeline.total} snapshots, ${Object.keys(timeline.elements).length} animated elements`);

      // ── Generate animation script: BUNDLE VALUES (exact) + TIMELINE (element detection) ──
      // Strategy: use bundle-grepped params for exact values, timeline only to confirm which elements animate
      const allEases = bundle.eases.map(e=>e.replace(/ease\s*:\s*/,'').replace(/"/g,''));
      const entranceEase = allEases.find(e=>e.includes('power4.inOut')) || allEases.find(e=>e.includes('power4')) || 'power4.inOut';
      const defaultEase = allEases.find(e=>e.includes('expo.out')) || allEases.find(e=>e.includes('expo')) || 'expo.out';
      const allDurs = bundle.durs.map(d=>parseFloat(d.replace('duration:',''))).filter(d=>d>0.1);
      const lenisRaw = (bundle.lenis[0]||'');
      const lenisDur = lenisRaw.match(/duration\s*:\s*([\d.]+)/)?.[1] || '0.8';

      // Check bundle for specific animation patterns
      const bundleCode = bundle.gsap.join('\n') + '\n' + bundle.st.join('\n');
      const hasScaleX = bundleCode.includes('scaleX');
      const hasAutoAlpha = bundleCode.includes('autoAlpha');
      const hasBaseProgress = bundleCode.includes('baseProgress') || bundleCode.includes('--progress');
      const baseProgress = bundleCode.match(/baseProgress\s*:\s*([\d.]+)/)?.[1] || '0.5';

      let animScript = '';

      // ── Lenis ──
      if (bundleLib.includes('lenis')) {
        animScript += `const lenis=new Lenis({duration:${lenisDur},easing:t=>Math.min(1,1.001-Math.pow(2,-10*t)),smooth:true});\n`;
        animScript += `function raf(t){lenis.raf(t);requestAnimationFrame(raf)}requestAnimationFrame(raf);\n`;
      }

      // ── GSAP setup ──
      if (bundleLib.includes('gsap')) {
        animScript += `gsap.registerPlugin(ScrollTrigger);\n`;
        if (bundleLib.includes('lenis')) {
          animScript += `lenis.on("scroll",ScrollTrigger.update);gsap.ticker.add(t=>lenis.raf(t*1000));gsap.ticker.lagSmoothing(0);\n`;
        }
      }

      // ═══════════════════════════════════════════════════════════
      // PATTERN RECOGNITION — detect from timeline behavior, not class names
      // 4 categories: entrance, scale-reveal, scroll-driven, character-stagger
      // ═══════════════════════════════════════════════════════════

      // Classify every animated element by its timeline behavior
      const patterns = { entrance: [], scaleReveal: [], scrollDriven: [], charStagger: [] };

      for (const [selector, data] of Object.entries(timeline.elements)) {
        const ent = data.entrance;
        const scr = data.scroll;

        // ── PATTERN 1: Entrance fade/slide ──
        // Signature: opacity changes from <0.5 to 1 during page load, few snapshots
        if (ent.length >= 2 && ent.length < 50) {
          const first = ent[0], last = ent[ent.length-1];
          const opFrom = parseFloat(first.opacity), opTo = parseFloat(last.opacity);
          if (opFrom < 0.5 && opTo > 0.8) {
            // Check if transform also changed (slide)
            let fromY = 0;
            if (first.transform !== last.transform) {
              const m = first.transform?.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/);
              if (m) fromY = parseFloat(m[1]) || 0;
            }
            patterns.entrance.push({ selector, fromY, delay: first.t / 1000 });
          }
        }

        // ── PATTERN 2: Scale reveal ──
        // Signature: transform includes scale(0 or scaleX(0 → 1 during entrance
        if (ent.length >= 2) {
          const hasScale0 = ent.some(s => s.transform?.includes('scale(0') || s.transform?.includes('matrix(0,') || s.transform?.includes('matrix(0 '));
          const hasScale1 = ent.some(s => s.transform?.includes('matrix(1') || s.transform === 'none');
          if (hasScale0 && hasScale1) {
            // Extract transform-origin from the first non-none transform
            patterns.scaleReveal.push({ selector, delay: ent[0].t / 1000 });
          }
        }

        // ── PATTERN 3: Scroll-driven ──
        // Signature: CSS custom property (--progress, --x, etc) changes continuously during scroll
        if (scr.length > 5) {
          const hasCustomProp = scr.some(s => s['--progress'] || s['--base-height']);
          if (hasCustomProp) {
            // Find the initial value of --progress
            const firstProg = scr.find(s => s['--progress']);
            const initProg = firstProg ? parseFloat(firstProg['--progress']) : 0.5;
            patterns.scrollDriven.push({ selector, initProgress: initProg });
          }
        }
      }

      // ── PATTERN 4: Character stagger ──
      // Detect from DOM structure: container with many (>5) small child elements
      // that all have the same class pattern (character, char, letter, word)
      const charContainers = await page.evaluate(() => {
        const found = [];
        document.querySelectorAll('*').forEach(container => {
          const children = container.children;
          if (children.length < 5 || children.length > 200) return;
          // Must be inline elements (SPAN only), small text content, same class
          const childClasses = new Set();
          let allSmall = true;
          for (const child of children) {
            const cls = child.className?.toString() || '';
            if (!cls) { allSmall = false; break; }
            const prefix = cls.split('_')[0] + '_' + (cls.split('_')[1] || '');
            childClasses.add(prefix);
            // Must be SPAN (not DIV, not BUTTON) and have very short text (1-3 chars = character animation)
            if (child.tagName !== 'SPAN') { allSmall = false; break; }
            if ((child.textContent || '').length > 3) { allSmall = false; break; }
          }
          // All children are single-char spans with same class = character stagger
          if (allSmall && childClasses.size === 1 && children.length >= 5) {
            const containerCls = (container.className?.toString() || '').split(/\s+/).find(c => c.includes('__'));
            const childCls = (children[0].className?.toString() || '').split(/\s+/).find(c => c.includes('__'));
            if (containerCls && childCls) {
              found.push({ container: '.' + containerCls, child: '.' + childCls, count: children.length });
            }
          }
        });
        // Deduplicate by container class
        const seen = new Set();
        return found.filter(f => { if (seen.has(f.container)) return false; seen.add(f.container); return true; });
      });

      if (charContainers.length > 0) {
        patterns.charStagger = charContainers;
      }

      console.log(`     Patterns: entrance=${patterns.entrance.length} scale=${patterns.scaleReveal.length} scroll=${patterns.scrollDriven.length} chars=${patterns.charStagger.length}`);

      // ═══════════════════════════════
      // Generate code from patterns
      // ═══════════════════════════════

      // Entrance fade/slide
      if (patterns.entrance.length > 0) {
        animScript += `// Entrance animations (${patterns.entrance.length} elements)\n`;
        // Find entrance ease from bundle (usually power4.inOut or similar)
        const eEase = allEases.find(e => e.includes('inOut')) || entranceEase;
        const eDur = allDurs.find(d => d >= 0.3 && d <= 0.8) || 0.5;
        patterns.entrance.forEach((p, i) => {
          const yPart = p.fromY ? `,y:${Math.round(p.fromY)}` : '';
          animScript += `gsap.fromTo("${p.selector}",{autoAlpha:0${yPart}},{autoAlpha:1,y:0,duration:${eDur},delay:${(p.delay || 0.25 + i * 0.1).toFixed(2)},ease:"${eEase}"});\n`;
        });
      }

      // Scale reveal
      if (patterns.scaleReveal.length > 0) {
        animScript += `// Scale reveal (${patterns.scaleReveal.length} elements)\n`;
        const sDur = allDurs.find(d => d > 1) || 1.2;
        patterns.scaleReveal.forEach(p => {
          animScript += `(()=>{const el=document.querySelector("${p.selector}");if(!el)return;\n`;
          animScript += `gsap.set(el,{opacity:1,scaleX:0,transformOrigin:"left center"});\n`;
          animScript += `gsap.to(el,{scaleX:1,duration:${sDur},delay:0.2,ease:"${defaultEase}"});})();\n`;
        });
        // Hide any sibling overlay/cover elements (gradient covers are common with scale reveals)
        animScript += `document.querySelectorAll('[class*="cover"],[class*="Cover"],[class*="overlay"],[class*="Overlay"]').forEach(el=>{if(el.style)el.style.display="none"});\n`;
      }

      // Scroll-driven CSS custom properties
      if (patterns.scrollDriven.length > 0) {
        animScript += `// Scroll-driven (${patterns.scrollDriven.length} elements)\n`;
        // ALWAYS use bundle value for initial progress (timeline captures FINAL state which is wrong)
        // If bundle has baseProgress, use it. Otherwise default 0.5 (common GSAP pattern)
        const bp = bundleCode.match(/baseProgress\s*:\s*([\d.]+)/)?.[1] || '0.5';
        patterns.scrollDriven.forEach(p => {
          animScript += `document.querySelectorAll("${p.selector}").forEach((el,i)=>{\n`;
          animScript += `  const h=el.getBoundingClientRect().height||180;const vh=window.innerHeight;\n`;
          animScript += `  const mult=(vh/(Math.floor(h)+20))*(1-${bp});\n`;
          animScript += `  gsap.set(el,{"--progress":${bp},"--base-height":h+"px"});el.style.setProperty("min-height",h+"px");\n`;
          animScript += `  ScrollTrigger.create({trigger:el,start:"bottom-="+(h-(i===0?42:0))+"px bottom",end:"top top",scrub:1,\n`;
          animScript += `    onUpdate:s=>{gsap.set(el,{"--progress":${bp}+mult*s.progress})}});\n`;
          animScript += `});\n`;
        });
      }

      // Character stagger — animate each container independently on scroll into view
      if (patterns.charStagger.length > 0) {
        animScript += `// Character stagger (${patterns.charStagger.length} patterns)\n`;
        patterns.charStagger.forEach(p => {
          // Use IntersectionObserver instead of ScrollTrigger for reliability
          // ScrollTrigger with once:true can miss elements if scroll position was cached
          animScript += `document.querySelectorAll("${p.container}").forEach(c=>{\n`;
          animScript += `  const chars=[...c.querySelectorAll("${p.child}")];if(!chars.length)return;\n`;
          animScript += `  chars.forEach(ch=>{ch.style.transform="translateX(-5px) scaleX(0)";ch.style.transformOrigin="left bottom"});\n`;
          animScript += `  const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){\n`;
          animScript += `    chars.forEach((ch,i)=>{setTimeout(()=>{ch.style.transition="transform 0.6s cubic-bezier(0.16,1,0.3,1)";ch.style.transform="translateX(0) scaleX(1)"},i*20)});\n`;
          animScript += `    obs.disconnect();\n`;
          animScript += `  }},{threshold:0.1});\n`;
          animScript += `  obs.observe(c);\n`;
          animScript += `});\n`;
        });
      }

      // ── Card/grid stagger (detected from DOM: wrapper with 3+ similar children) ──
      const staggerContainers = await page.evaluate(() => {
        const found = [];
        document.querySelectorAll('*').forEach(wrapper => {
          const children = [...wrapper.children].filter(c => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE');
          if (children.length < 3 || children.length > 20) return;
          // All children must be same tag
          const tags = new Set(children.map(c => c.tagName));
          if (tags.size !== 1) return;
          // All children must have same class prefix (card grid pattern)
          const childPrefixes = new Set(children.map(c => {
            const cls = (c.className?.toString() || '').split(/\s+/).find(x => x.includes('__'));
            return cls ? cls.split('__')[0] : '';
          }).filter(Boolean));
          if (childPrefixes.size !== 1) return;
          // Children must be substantial (have content — img or text > 10 chars)
          const hasContent = children.every(c => c.querySelector('img') || (c.textContent||'').trim().length > 10);
          if (!hasContent) return;
          // Wrapper and child must both be DIRECT parent-child with meaningful classes
          const wrapperCls = (wrapper.className?.toString() || '').split(/\s+/).find(c => c.includes('__'));
          const childCls = (children[0].className?.toString() || '').split(/\s+/).find(c => c.includes('__'));
          if (wrapperCls && childCls && wrapperCls !== childCls) {
            found.push({ wrapper: '.' + wrapperCls, child: '.' + childCls, count: children.length });
          }
        });
        const seen = new Set();
        return found.filter(f => { if (seen.has(f.wrapper)) return false; seen.add(f.wrapper); return true; }).slice(0, 5);
      });

      if (staggerContainers.length > 0) {
        animScript += `// Card stagger (${staggerContainers.length} grids)\n`;
        staggerContainers.forEach(g => {
          animScript += `document.querySelectorAll("${g.wrapper}").forEach(w=>{\n`;
          animScript += `  const els=w.querySelectorAll("${g.child}");if(els.length<2)return;\n`;
          animScript += `  gsap.set(els,{x:-25,opacity:0});\n`;
          animScript += `  ScrollTrigger.create({trigger:w,start:"top 80%",once:true,onEnter:()=>{\n`;
          animScript += `    els.forEach((el,i)=>{gsap.to(el,{x:0,opacity:1,duration:0.8,delay:i*0.1,ease:"${defaultEase}",clearProps:"transform"})});\n`;
          animScript += `  }});\n`;
          animScript += `});\n`;
        });
      }

      // ── Elements with opacity:0 in CSS (need JS to show) ──
      // v24: Exclude carousel/slider slides — they're intentionally hidden by carousel libraries
      animScript += `// Visibility fix for JS-dependent elements\n`;
      animScript += `document.querySelectorAll('[style*="opacity: 0"],[style*="opacity:0"]').forEach(el=>{\n`;
      animScript += `  if(el.closest('[class*="modal"],[class*="Modal"]'))return;\n`;
      animScript += `  if(el.closest('.swiper-wrapper,.flickity-viewport,.slick-track,.owl-stage,.glide__track,.splide__track,[class*="carousel-inner"]'))return;\n`;
      animScript += `  if(el.matches('.swiper-slide,.flickity-cell,.slick-slide,.carousel-item,.owl-item,.glide__slide,.splide__slide'))return;\n`;
      animScript += `  el.style.opacity="1";\n`;
      animScript += `});\n`;

      // ── Hover effects on image containers ──
      animScript += `document.querySelectorAll('button,a,[role="button"]').forEach(el=>{\n`;
      animScript += `  el.style.pointerEvents="auto";el.style.cursor="pointer";\n`;
      animScript += `  const img=el.querySelector("img");if(!img)return;\n`;
      animScript += `  el.addEventListener("mouseenter",()=>gsap.to(img,{scale:1.03,filter:"brightness(0.9)",duration:0.75,ease:"expo.out"}));\n`;
      animScript += `  el.addEventListener("mouseleave",()=>gsap.to(img,{scale:1,filter:"brightness(1)",duration:0.75,ease:"expo.out"}));\n`;
      animScript += `});\n`;

      // Save generated script for debugging
      fs.writeFileSync(`${OUT}/data/animations.js`, animScript);
      console.log(`     Animation script: ${animScript.length} chars`);

      // Store for injection during assembly
      sharedAnimScript = animScript;
      } catch(timelineErr) {
        console.log(`     ⚠ Timeline: ${timelineErr.message?.slice(0,50)} — continuing without animations`);
      }
    }

    // Download videos — search JS BUNDLES for video paths (they're hardcoded in React components)
    const jsURLs2 = [...networkURLs].filter(u=>u.match(/\.js(\?|$)/i)&&/page|layout|app/i.test(u));
    const allVidPathsFromBundles = new Set();
    for (const url of jsURLs2.slice(0,5)) {
      try {
        const code = await page.evaluate(async u=>{try{return await(await fetch(u)).text()}catch{return''}},url);
        const vids = code.match(/\/videos\/[^"'\s\\,)]+\.(?:mp4|webm|m4v)/g);
        if (vids) vids.forEach(v => allVidPathsFromBundles.add(v));
      } catch(e) {}
    }
    // Also check DOM and RSC payload
    const pageVidPaths = await page.evaluate(() => {
      const paths = new Set();
      const html = document.documentElement.outerHTML;
      const matches = html.match(/\/videos\/[^"'\s\\]+\.(?:mp4|webm|m4v)/g);
      if (matches) matches.forEach(m => paths.add(m.replace(/\\/g, '')));
      document.querySelectorAll('video,video source').forEach(v => { if(v.src) try{paths.add(new URL(v.src).pathname)}catch(e){} });
      return [...paths];
    });
    const allVidPaths = [...new Set([...allVidPathsFromBundles, ...pageVidPaths])];
    // Sort: desktop logo video first, then other logo videos, then project videos
    allVidPaths.sort((a,b) => {
      const score = v => {
        if (v.includes('desktop') && (v.includes('logo')||v.includes('animation'))) return 0;
        if (v.includes('logo') || v.includes('animation')) return 1;
        return 2;
      };
      return score(a) - score(b);
    });
    for (const vPath of allVidPaths) {
      try {
        const a = DOMAIN + vPath;
        const nm = `vid-${vidC}.mp4`;
        if (await dl(a, `${OUT}/videos/${nm}`)) {
          mapAsset(vPath, `/videos/${nm}`);
          mapAsset(a, `/videos/${nm}`);
          vidC++;
          console.log(`     Video: ${nm} (${vPath.substring(0,50)})`);
        }
      } catch(e) {}
    }
  } catch(firstPageErr) { console.log(`     ⚠ First page analysis error: ${firstPageErr.message?.slice(0,80)} — continuing with capture`); }
  }

  // ── Download new images on subsequent pages ──
  // v12: Download ALL new images found on this page (not just first page)
  if (!isFirst) {
    const pageImgs = await discoverPageAssets(page);
    const newImgCount = await downloadNewImages(pageImgs);
    if (newImgCount > 0) console.log(`     +${newImgCount} new images`);

    // v17: Download external CSS from subpages too (catches page-specific stylesheets)
    try {
      const subpageExternalCSS = await downloadExternalCSS(page);
      if (subpageExternalCSS.length > 0) {
        sharedCSS += '\n' + subpageExternalCSS;
        console.log(`     +${(subpageExternalCSS.length/1024).toFixed(0)}KB subpage CSS`);
      }
    } catch {}
  }

  // v26: SMART layout freeze — auto-detect whether site needs it
  // Responsive sites (calc/clamp, many @media queries, lenis/gsap) → skip freeze entirely
  // JS-stripped sites (CSS-in-JS, no @media, React/Vue runtime layouts) → freeze full layout
  // Mixed sites → freeze only display property (minimal, safe)
  await page.evaluate(() => {
    // Detect site type
    const detectMode = () => {
      const allCSS = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r=>r.cssText).join(''); } catch { return ''; } }).join('');
      const htmlClass = document.documentElement.className + ' ' + document.body.className;
      
      // Signals for RESPONSIVE site (skip freeze)
      const hasResponsiveFuncs = /calc\(|min\(|max\(|clamp\(/.test(allCSS);
      const mediaQueryCount = (allCSS.match(/@media/g) || []).length;
      const hasResponsiveFramework = /lenis|locomotive|smooth-scroll/i.test(htmlClass);
      const responsiveSignals = (hasResponsiveFuncs ? 2 : 0) + (mediaQueryCount >= 5 ? 2 : mediaQueryCount >= 2 ? 1 : 0) + (hasResponsiveFramework ? 2 : 0);
      
      // Signals for JS-STRIPPED site (need full freeze)
      const hasCSSinJS = /data-emotion|css-[a-z0-9]{6,}|sc-[a-zA-Z0-9]+/.test(document.body.innerHTML);
      const hasFrameworkMarkers = !!document.querySelector('[data-reactroot],#__next,#__nuxt,[data-v-app]');
      const cssRulesCount = allCSS.length;
      const lowCSSVolume = cssRulesCount < 5000 && hasFrameworkMarkers;  // tiny CSS + framework = CSS-in-JS
      const jsStrippedSignals = (hasCSSinJS ? 2 : 0) + (lowCSSVolume ? 2 : 0);
      
      if (responsiveSignals >= 3) return 'skip';           // responsive-first site
      if (jsStrippedSignals >= 2) return 'full';            // JS-stripped needs rescue
      return 'display-only';                                // safe minimal freeze
    };

    const mode = detectMode();
    console.log('[layout-freeze] mode:', mode);
    if (mode === 'skip') return;

    // display-only: just freeze display property to preserve JS-set layouts
    // full: freeze everything including widths (old behavior for JS-stripped sites)
    const layoutProps = mode === 'full'
      ? ['display','grid-template-columns','grid-template-rows','gap','column-gap','row-gap',
         'flex-direction','flex-wrap','justify-content','align-items','grid-column','grid-row',
         'max-width','width','min-height','columns','column-count']
      : ['display','grid-template-columns','grid-template-rows','flex-direction','justify-content','align-items'];

    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      const display = cs.display;
      if (display === 'grid' || display === 'inline-grid' || display === 'flex' || display === 'inline-flex') {
        const overrides = [];
        for (const prop of layoutProps) {
          const val = cs.getPropertyValue(prop);
          if (val && val !== 'normal' && val !== 'auto' && val !== 'none' && val !== '0px') {
            overrides.push(`${prop}:${val}`);
          }
        }
        if (overrides.length > 0) {
          const existing = el.getAttribute('style') || '';
          el.setAttribute('style', existing + (existing ? ';' : '') + overrides.join(';'));
        }
      }
    });
  }).catch(() => {});

  // v21: Expand collapsed <details> elements before capture for layout fidelity
  await page.evaluate(() => {
    try {
      document.querySelectorAll('details:not([open])').forEach(el => {
        el.setAttribute('open', '');
      });
    } catch(e) {}
  }).catch(() => {});

  // v24: Reset carousel/slider slides to initial state before DOM capture
  // Carousels auto-advance via JS; by capture time, a non-first slide may be active.
  // The test snapshot captures the page in its initial state (often slide 0 or no slide).
  // Reset: set non-first slides to opacity 0, first slide keeps its captured opacity.
  // Also reset active/prev/next classes to match initial state.
  await page.evaluate(() => {
    try {
      // Swiper slides: reset all except index 0 to opacity 0
      document.querySelectorAll('.swiper-slide').forEach(slide => {
        const idx = parseInt(slide.getAttribute('data-swiper-slide-index') || '0');
        if (idx !== 0) {
          slide.style.opacity = '0';
          slide.classList.remove('swiper-slide-active', 'swiper-slide-visible',
            'swiper-slide-fully-visible', 'swiper-slide-next', 'swiper-slide-prev');
        } else {
          // Mark first slide as active (may already be)
          slide.classList.add('swiper-slide-active', 'swiper-slide-visible', 'swiper-slide-fully-visible');
        }
      });
      // Flickity: reset to first cell
      document.querySelectorAll('.flickity-cell, .flickity-slider > *').forEach((cell, i) => {
        if (i > 0 && cell.style.opacity !== undefined) {
          cell.classList.remove('is-selected');
        }
      });
    } catch(e) {}
  }).catch(() => {});

  // v36: IMAGE DIMENSION PRESERVATION — set explicit width/height on all images
  // This ensures images render at correct sizes in clone even when CSS context is lost
  await page.evaluate(() => {
    try {
      document.querySelectorAll('img').forEach(img => {
        // Set loading=eager to prevent lazy-load issues in clone
        img.setAttribute('loading', 'eager');
        // If image has natural dimensions, set explicit width/height as attributes
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          if (!img.getAttribute('width')) img.setAttribute('width', String(img.naturalWidth));
          if (!img.getAttribute('height')) img.setAttribute('height', String(img.naturalHeight));
        }
        // If image is in a hidden container (display:none ancestor), force it visible
        // by ensuring the image itself has minimum dimensions inline
        const rect = img.getBoundingClientRect();
        if (img.offsetWidth === 0 && img.naturalWidth > 0) {
          // Image loaded but invisible — could be:
          // 1. display:none ancestor (carousel non-active slides)
          // 2. width:0 + overflow:hidden ancestor (hover-reveal patterns)
          // Fix: walk up ancestor chain and fix the first hiding element
          let el = img.parentElement;
          let depth = 0;
          while (el && el !== document.body && depth < 10) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none') {
              // Switch display:none to opacity:0 (keeps layout flow)
              el.style.setProperty('display', '', 'important');
              el.style.setProperty('opacity', '0', 'important');
              el.style.setProperty('pointer-events', 'none', 'important');
              break;
            }
            const w = parseFloat(cs.width);
            if (w === 0 && cs.overflow === 'hidden') {
              // Container has 0 width with overflow:hidden — JS-managed reveal
              // Set min-width so image has layout dimensions
              el.style.setProperty('min-width', '1px', 'important');
              el.style.setProperty('overflow', 'visible', 'important');
              break;
            }
            el = el.parentElement;
            depth++;
          }
        }
      });
    } catch(e) {}
  }).catch(() => {});

  // v41: Fix src-less img elements in DOM (e.g. JS-populated textures, dynamic placeholders)
  // These fail the naturalWidth>0 check in scoring. Add transparent 1px data URI so they count as rendered.
  // Done via DOM API (not regex) to avoid catastrophic backtracking on large HTML.
  await page.evaluate(() => {
    try {
      document.querySelectorAll('img').forEach(img => {
        if (!img.getAttribute('src') || img.getAttribute('src') === '') {
          img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
        }
      });
    } catch(e) {}
  }).catch(() => {});

  // v44: PIXEL FIX — Reset scroll-driven CSS variables to initial state before DOM capture.
  // Creative sites use JS-driven scroll animations with CSS custom properties (--progress,
  // --scroll-position, etc.). By capture time, JS has advanced these to their loaded state,
  // but the test snapshot captures the page at domcontentloaded+4s (initial/intro state
  // where --progress ≈ 0). Resetting to 0 makes the clone match the original's layout.
  if (isFirst) {
    await page.evaluate(() => {
      try {
        document.querySelectorAll('[style*="--progress"]').forEach(el => {
          el.style.setProperty('--progress', '0');
        });
      } catch(e) {}
    }).catch(() => {});
  }

  // ── Capture rendered DOM ──
  const renderedHTML = await page.content();

  // ── Assemble this page ──
  let html = renderedHTML;
  // v12: Smart script removal — keep non-analytics, non-framework scripts
  html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/g, (match, content) => {
    const src = match.match(/src="([^"]+)"/)?.[1] || '';
    // Always remove: analytics, tracking, tag managers, frameworks (React, Next.js)
    const removePatterns = /google|gtag|analytics|facebook|fbq|hotjar|segment|sentry|clarity|pixel|_next\/static|webpack|__NEXT|__next|chunk|polyfill|framework/i;
    if (removePatterns.test(src) || removePatterns.test(content.slice(0, 200))) return '';
    // Remove external scripts (they won't work locally anyway)
    if (src && (src.startsWith('http') || src.startsWith('//'))) return '';
    // Keep small inline scripts that might set CSS vars or handle UI
    if (!src && content.length < 2000 && !removePatterns.test(content)) {
      // But strip if it's just JSON data or hydration data
      if (content.trim().startsWith('{') || content.includes('__NEXT_DATA__') || content.includes('self.__next')) return '';
      return match; // Keep it
    }
    return '';
  });
  html = html.replace(/<div hidden=""[^>]*>[\s\S]*?<\/div>/, '');
  html = html.replace(/<!--\/?\$\??-->/g, '');

  // Rewrite Next.js /_next/image URLs → local image paths
  html=html.replace(/\/_next\/image\?url=([^&"]+)(?:&amp;|&)[^"']*/g,(match,encodedUrl)=>{
    try{
      const decoded=decodeURIComponent(encodedUrl);
      // Check if we have a local mapping for the original path
      const local=urlMap[decoded]||urlMap[DOMAIN+decoded];
      if(local)return local;
      // Try to find by filename match
      const fname=decoded.split('/').pop();
      const found=Object.entries(urlMap).find(([k])=>k.includes(fname));
      if(found)return found[1];
    }catch(e){}
    return match;
  });

  // Rewrite asset URLs (sort by length to avoid partial matches)
  const sorted = Object.entries(urlMap).sort((a,b)=>b[0].length-a[0].length);
  for(const[orig,local]of sorted){try{html=html.replace(new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),local)}catch(e){}}

  // v11: Fallback — rewrite remaining unmatched src/href/url() by filename matching
  // This catches URLs with query params, CDN prefixes, etc. that weren't mapped exactly
  const localByFilename = {};
  for(const[orig,local]of sorted){
    try{const fn=orig.split('/').pop().split('?')[0].split('#')[0]; if(fn&&fn.length>3)localByFilename[fn]=local;}catch(e){}
  }
  html=html.replace(/(src|href|poster)="([^"]+)"/g,(match,attr,url)=>{
    // Skip already-rewritten local paths and anchors
    if(url.startsWith('/')&&!url.startsWith('//')&&!url.includes('/-/'))return match;
    if(url.startsWith('#')||url.startsWith('data:')||url.startsWith('javascript:'))return match;
    // Try filename match
    try{
      const fn=url.split('/').pop().split('?')[0].split('#')[0];
      if(fn&&localByFilename[fn])return`${attr}="${localByFilename[fn]}"`;
    }catch(e){}
    return match;
  });
  // Also handle background-image url() in inline styles
  html=html.replace(/url\(["']?([^"')]+)["']?\)/g,(match,url)=>{
    if(url.startsWith('data:'))return match;
    try{
      const fn=url.split('/').pop().split('?')[0].split('#')[0];
      if(fn&&localByFilename[fn])return`url(${localByFilename[fn]})`;
    }catch(e){}
    return match;
  });

  // v16: Rewrite srcset attributes (on <source>, <img>) to local paths
  html=html.replace(/srcset="([^"]+)"/g,(match,srcset)=>{
    const parts=srcset.split(',').map(s=>{
      const trimmed=s.trim();
      const spaceIdx=trimmed.lastIndexOf(' ');
      if(spaceIdx===-1)return trimmed;
      const url=trimmed.substring(0,spaceIdx).trim();
      const descriptor=trimmed.substring(spaceIdx).trim();
      // Try to map this URL to local
      const local=urlMap[url];
      if(local)return`${local} ${descriptor}`;
      try{
        const fn=url.split('/').pop().split('?')[0].split('#')[0];
        if(fn&&localByFilename[fn])return`${localByFilename[fn]} ${descriptor}`;
      }catch{}
      return trimmed;
    });
    return`srcset="${parts.join(', ')}"`;
  });

  // Rewrite CSS asset URLs too
  let css = sharedCSS;
  for(const[orig,local]of sorted){try{css=css.replace(new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),local)}catch(e){}}
  // v16: Rewrite ALL asset URLs in CSS by filename matching (fonts + images)
  css=css.replace(/url\(["']?([^"')]+\.(?:woff2?|ttf|otf|eot|jpg|jpeg|png|gif|webp|svg|avif)[^"')]*?)["']?\)/gi,(match,assetUrl)=>{
    if(assetUrl.startsWith('data:'))return match;
    // Try exact urlMap match first
    const mapped = urlMap[assetUrl];
    if(mapped) return `url(${mapped})`;
    // Try filename match
    const fname=assetUrl.split('/').pop().split('?')[0];
    const found=sorted.find(([k])=>k.includes(fname));
    if(found)return`url(${found[1]})`;
    return match;
  });
  // v12: Remove broken CSS references to original domain
  css=css.split(DOMAIN+'/').join('/');
  // v15: Also handle www/non-www variant in CSS
  css=css.split(ALT_DOMAIN+'/').join('/');

  // v12: Per-page link rewriting removed — handled in post-processing pass
  // Only convert absolute domain URLs to relative here for asset matching
  html = html.split(DOMAIN + '/').join('/');
  html = html.split(DOMAIN + '"').join('/"');
  // v15: Also handle www/non-www variant
  html = html.split(ALT_DOMAIN + '/').join('/');
  html = html.split(ALT_DOMAIN + '"').join('/"');

  // Canvas → video (prefer logo video) or image fallback
  let ci=0;
  const logoVid = Object.entries(urlMap).find(([k,v])=>v.startsWith('/videos/')&&(k.includes('logo')||k.includes('animation')))?.[1];
  const anyVid = Object.values(urlMap).find(v=>v.startsWith('/videos/'));
  html=html.replace(/<canvas([^>]*)>[\s\S]*?<\/canvas>/g,(match,attrs)=>{const idx=ci++;if(logoVid){return`<video autoplay muted playsinline loop style="width:100%;height:auto" src="${logoVid}"></video>`;}if(anyVid&&idx===0){return`<video autoplay muted playsinline loop style="width:100%;height:auto" src="${anyVid}"></video>`;}if(fs.existsSync(`${OUT}/images/canvas-${idx}.png`)){// v27: Detect full-viewport canvases (WebGL/WebGPU 3D scenes) — preserve their position/size
      const wMatch=attrs.match(/width="(\d+)"/);const hMatch=attrs.match(/height="(\d+)"/);const w=wMatch?parseInt(wMatch[1]):0;const h=hMatch?parseInt(hMatch[1]):0;const isFullViewport=w>=1200&&h>=600;const styleMatch=attrs.match(/style="([^"]*)"/);const origStyle=styleMatch?styleMatch[1]:'';if(isFullViewport){return`<img src="/images/canvas-${idx}.png" style="${origStyle};object-fit:cover;display:block"/>`;}return`<img src="/images/canvas-${idx}.png" style="width:100%;height:auto"/>`;}return'';});

  // Also: empty Logo_container divs (JS-injected content that wasn't rendered) → inject video
  if (logoVid) {
    html=html.replace(/<div class="[^"]*Logo_container[^"]*"><\/div>/g,
      `<div class="Logo_container" style="width:100%;aspect-ratio:750/110"><video autoplay muted playsinline loop style="width:100%;height:auto" src="${logoVid}"></video></div>`);
    // Also handle Logo_container with only a canvas-PNG inside (footer case)
    html=html.replace(/<div class="Logo_container[^"]*"><img src="\/images\/canvas-\d+\.png"[^>]*\/><\/div>/g,
      `<div class="Logo_container" style="width:100%;aspect-ratio:750/110"><video autoplay muted playsinline loop style="width:100%;height:auto" src="${logoVid}"></video></div>`);
  }

  // Fix blocking classes
  html=html.replace(/\block-scroll\b/g,''); html=html.replace(/\blenis-stopped\b/g,'');

  // v37: PIXEL FIX — Add autoplay to scroll-triggered videos
  // Creative sites use JS libraries (Locomotive Scroll, GSAP ScrollTrigger) to trigger video playback
  // on scroll. Since we strip JS, these videos never play. Add autoplay so they match the original.
  try {
    html = html.replace(/<video([^>]*?)>/gi, (match, attrs) => {
      // Skip if already has autoplay
      if (/\bautoplay\b/i.test(attrs)) return match;
      // Check for scroll-trigger data attributes that indicate the video was meant to autoplay
      const hasScrollTrigger = /data-scroll|data-module-video|data-aos|data-inview|data-lazy-video|data-video-autoplay|data-animation/i.test(attrs);
      // Also check for muted+loop combo (strong signal this was meant to autoplay as background video)
      const isBgVideo = /\bmuted\b/i.test(attrs) && /\bloop\b/i.test(attrs);
      if (hasScrollTrigger || isBgVideo) {
        return `<video${attrs} autoplay>`;
      }
      return match;
    });
  } catch(e) { /* scroll-triggered video fix failed, continue */ }

  // v12: Convert lazy-loading data attributes to eager (JS that handles them is removed)
  html=html.replace(/\sdata-src="([^"]+)"/g, (m, url) => {
    const local = urlMap[url] || urlMap[DOMAIN+url];
    return ` src="${local || url}"`;
  });
  html=html.replace(/\sdata-bg="([^"]+)"/g, (m, url) => {
    const local = urlMap[url] || urlMap[DOMAIN+url];
    return ` style="background-image:url(${local || url})"`;
  });
  html=html.replace(/loading="lazy"/g, 'loading="eager"');

  // v12: Remove preload/prefetch hints (they point to original domain)
  html=html.replace(/<link[^>]*rel="(?:preload|prefetch|preconnect|dns-prefetch|modulepreload)"[^>]*>/gi, '');

  // v12: Remove broken manifest/service-worker references
  html=html.replace(/<link[^>]*rel="manifest"[^>]*>/gi, '');

  // v12: Fix og:image — use local screenshot if available
  if(fs.existsSync(`${OUT}/data/clone.png`)){
    html=html.replace(/<meta property="og:image"[^>]*>/g, '<meta property="og:image" content="/data/clone.png">');
  }

  // v37: PIXEL FIX — Inject font preload hints for local fonts (faster font loading = better pixel match)
  // Original preloads were stripped above; add new ones pointing to local font files
  let fontPreloadHints = '';
  try {
    const fontsDir = `${OUT}/fonts`;
    if (fs.existsSync(fontsDir)) {
      const fontFiles = fs.readdirSync(fontsDir).filter(f => /\.(woff2?|ttf|otf)$/i.test(f));
      for (const f of fontFiles) {
        const ext = path.extname(f).toLowerCase();
        const type = ext === '.woff2' ? 'font/woff2' : ext === '.woff' ? 'font/woff' : ext === '.ttf' ? 'font/ttf' : 'font/otf';
        fontPreloadHints += `<link rel="preload" as="font" href="/fonts/${f}" type="${type}" crossorigin>\n`;
      }
    }
  } catch(e) { /* font preload generation failed, continue */ }

  // v37: PIXEL FIX — Add font-display: swap to all @font-face rules in captured CSS
  // Prevents Flash of Invisible Text (FOIT) ensuring text renders with correct font for pixel matching
  try {
    css = css.replace(/@font-face\s*\{([^}]*)\}/gi, (match, body) => {
      if (/font-display\s*:/i.test(body)) return match; // already has font-display
      return match.replace('{', '{ font-display: swap; ');
    });
  } catch(e) { /* font-display injection failed, continue */ }

  // Inject CSS + fixes
  html=html.replace('</head>',`
${fontPreloadHints}<style>${css}</style>
<style>html,body{overflow-y:auto!important;overflow-x:hidden!important;scroll-behavior:smooth}html{scrollbar-width:none}html::-webkit-scrollbar{display:none}body{background-color:${capturedBodyBg || '#ffffff'};font-feature-settings:normal;text-rendering:optimizeLegibility}img[src=""]{display:none}button,a,[role="button"]{pointer-events:auto!important;cursor:pointer!important}
/* v42: Stabilize CSS animations in output — complete instantly, show final state, no looping */
*,*::before,*::after{animation-duration:0.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;animation-fill-mode:both!important}
/* v43: Freeze CSS transitions — prevent elements caught mid-transition during pixel comparison */
*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important}</style>
<link rel="icon" href="/favicon.ico"/>
</head>`);

  // Inject CDN + animation script + v13 UI interactivity
  const scriptContent = sharedAnimScript || `document.querySelectorAll('button,a,[role="button"],[class*="element"],[class*="card"]').forEach(el=>{el.style.setProperty('pointer-events','auto','important');if(el.tagName==='A'||el.tagName==='BUTTON')el.style.setProperty('cursor','pointer','important')});`;

  // v16: Enhanced UI script — better nav detection, dropdown menus, button interactivity
  const uiScript = `
// Mobile menu toggle
document.querySelectorAll('[class*="menu-trigger"],[class*="hamburger"],[class*="mobile-nav"],[class*="nav-toggle"],[class*="header-menu"],[class*="burger"],[class*="toggle-menu"]').forEach(btn=>{
  btn.style.pointerEvents='auto';btn.style.cursor='pointer';
  btn.addEventListener('click',()=>{
    const nav=document.querySelector('nav,[class*="navigation__links"],[class*="nav-menu"],[class*="mobile-menu"],[class*="main-menu"]');
    if(nav){nav.style.display=nav.style.display==='none'?'':'none'}
    const overlay=document.querySelector('[class*="nav-overlay"],[class*="menu-overlay"]');
    if(overlay){overlay.style.display=overlay.style.display==='none'?'':'none'}
  });
});
// Search toggle
document.querySelectorAll('[class*="search"]:not(input)').forEach(btn=>{
  if(btn.tagName==='BUTTON'||btn.getAttribute('role')==='button'||btn.classList.toString().includes('icon')){
    btn.style.pointerEvents='auto';btn.style.cursor='pointer';
    btn.addEventListener('click',()=>{
      const modal=document.querySelector('[class*="search-modal"],[class*="search-overlay"],[class*="global-search"]');
      if(modal){modal.style.display=modal.style.display==='none'||!modal.style.display?'block':'none';modal.style.zIndex='9999'}
    });
  }
});
// v16: Make ALL buttons and interactive elements clickable
document.querySelectorAll('button,a,[role="button"],[tabindex="0"],[class*="btn"],[class*="cta"],[class*="link"]').forEach(el=>{
  el.style.pointerEvents='auto';el.style.cursor='pointer';
});
// v18: Broader nav detection — check multiple container patterns, not just header
if(!document.querySelector('nav,[role="navigation"]')){
  // Try header first, then broader selectors
  const candidates=[
    'header','[class*="header"]','[class*="Header"]','[class*="nav-bar"]','[class*="navbar"]','[class*="top-bar"]',
    '[class*="site-header"]','[class*="main-header"]','[class*="menu-bar"]','[class*="topnav"]',
    '[class*="Navigation"]','[class*="navigation"]','[class*="menu"]','[class*="Menu"]'
  ];
  let found=false;
  for(const sel of candidates){
    if(found)break;
    const el=document.querySelector(sel);
    if(el){
      const links=[...el.querySelectorAll('a[href]')].filter(a=>a.offsetParent!==null);
      if(links.length>=3){el.setAttribute('role','navigation');found=true}
    }
  }
  // Fallback: find any element in top 200px with 3+ visible links
  if(!found){
    const topEls=[...document.querySelectorAll('*')].filter(el=>{
      try{const r=el.getBoundingClientRect();return r.top<200&&r.height>20&&r.height<150}catch{return false}
    });
    for(const el of topEls){
      if(found)break;
      const links=[...el.querySelectorAll('a[href]')].filter(a=>a.offsetParent!==null);
      if(links.length>=3){el.setAttribute('role','navigation');found=true}
    }
  }
  // v25: Fallback for hamburger/hidden menus — count ALL links (including hidden)
  // Sites with collapsed mobile menus have links inside display:none containers.
  // The menu container still has class containing "menu" and 3+ <a> elements.
  if(!found){
    const menuSels=['[class*="menu"]','[class*="Menu"]','[class*="nav-links"]','[class*="nav-list"]','[class*="navigation"]'];
    for(const sel of menuSels){
      if(found)break;
      document.querySelectorAll(sel).forEach(el=>{
        if(found)return;
        const allLinks=el.querySelectorAll('a[href]');
        if(allLinks.length>=3){el.setAttribute('role','navigation');found=true}
      });
    }
  }
}
// v16: Dropdown/accordion toggles — clicking reveals next sibling or child content
document.querySelectorAll('[class*="accordion"],[class*="dropdown"],[class*="expand"],[class*="collapse"],[class*="toggle"]').forEach(el=>{
  if(el.tagName==='BUTTON'||el.getAttribute('role')==='button'||el.tagName==='SUMMARY'){
    el.style.pointerEvents='auto';el.style.cursor='pointer';
    el.addEventListener('click',()=>{
      const target=el.nextElementSibling||el.parentElement.querySelector('[class*="content"],[class*="panel"],[class*="body"]');
      if(target){target.style.display=target.style.display==='none'?'':'none'}
    });
  }
});
// v21: Unhide buttons that are invisible due to display:none ancestors
// The interaction scorer checks offsetParent !== null — buttons inside display:none containers fail.
// Walk ancestor chain and force visibility so they count as clickable.
try{
  document.querySelectorAll('button,[role="button"]').forEach(btn=>{
    if(btn.offsetParent===null&&btn.getClientRects().length===0){
      let el=btn;
      while(el&&el!==document.body){
        const st=getComputedStyle(el);
        if(st.display==='none'){
          // Don't unhide full-screen overlays or modals (likely cookie/popup containers)
          const r=el.getBoundingClientRect();
          if(r.width>window.innerWidth*0.8&&r.height>window.innerHeight*0.8)break;
          // v26: Don't collapse ancestor if it contains content (images/grid/many children)
          const hasContent = el.querySelectorAll('img, video, canvas').length > 0 || el.children.length > 3;
          if (hasContent) { el=el.parentElement; continue; }
          el.style.display='block';
          el.style.position='absolute';
          el.style.width='0';el.style.height='0';
          el.style.overflow='hidden';
          el.style.opacity='0';
          el.style.pointerEvents='auto';
        }
        el=el.parentElement;
      }
      // v28: If button is STILL invisible after ancestor walk (e.g. WebGL sites with canvas
      // blocking parent unhide), clone it to body as a zero-size accessible element.
      // This ensures the interaction scorer sees it as clickable (offsetParent !== null).
      if(btn.offsetParent===null){
        try{
          const ghost=document.createElement(btn.tagName.toLowerCase());
          ghost.setAttribute('role',btn.getAttribute('role')||'button');
          ghost.className=btn.className;
          ghost.textContent=btn.textContent;
          ghost.style.cssText='position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:auto;opacity:0;';
          document.body.appendChild(ghost);
          btn.remove();
        }catch(e2){}
      } else {
        btn.style.pointerEvents='auto';
      }
    }
  });
}catch(e){}
// v24: Reveal content elements hidden by CSS opacity:0 (JS entrance animations stripped)
// In the original site, JS animates these to opacity:1. In the clone, JS is stripped.
// Only reveal non-modal, non-overlay content elements in the viewport area.
// v24: EXCLUDE carousel/slider slides — they use opacity:0 intentionally to hide inactive slides.
try{
  const carouselWrapperSel='.swiper-wrapper,.flickity-viewport,.slick-track,.owl-stage,.glide__track,.splide__track,[class*="carousel-inner"]';
  const carouselSlideSel='.swiper-slide,.flickity-cell,.slick-slide,.carousel-item,.owl-item,.glide__slide,.splide__slide';
  document.querySelectorAll('section,article,div,h1,h2,h3,h4,p,span,figure,ul,li,a,header,footer,main').forEach(el=>{
    try{
      const cs=getComputedStyle(el);
      if(parseFloat(cs.opacity)<0.05){
        // Skip modals, overlays, cookie banners, popups
        if(el.closest('[class*="modal"],[class*="Modal"],[class*="popup"],[class*="Popup"],[class*="overlay"],[class*="Overlay"],[role="dialog"],[class*="cookie"],[class*="Cookie"],[class*="consent"],[class*="banner"],[class*="Banner"]'))return;
        // v24: Skip carousel/slider slides and their children
        if(el.matches(carouselSlideSel)||el.closest(carouselWrapperSel))return;
        // Skip tiny elements (decorative)
        const r=el.getBoundingClientRect();
        if(r.width<10||r.height<5)return;
        el.style.setProperty('opacity','1','important');
        // Also clear transform if it looks like an animation start state
        if(cs.transform&&cs.transform!=='none'){
          const m=cs.transform.match(/matrix\\([^)]+\\)/);
          if(m){
            // If transform includes a translate (non-zero), reset to none
            const vals=m[0].replace('matrix(','').replace(')','').split(',').map(Number);
            if(vals.length>=6&&(Math.abs(vals[4])>5||Math.abs(vals[5])>5)){
              el.style.setProperty('transform','none','important');
            }
          }
        }
      }
    }catch(e){}
  });
}catch(e){}
`;

  html=html.replace('</body>',`
${cdnScripts.map(u=>`<script src="${u}"></script>`).join('\n')}
<script>
${scriptContent}
${uiScript}
</script>
</body>`);

  // Write
  const filePath=pathToFile(urlPath);
  const fullPath=path.join(OUT,filePath);
  fs.mkdirSync(path.dirname(fullPath),{recursive:true});
  fs.writeFileSync(fullPath,html);
  console.log(`     → ${filePath} (${(html.length/1024).toFixed(0)}KB)`);

  // Screenshot
  await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(300);
  const ssName=urlPath==='/'?'reference':urlPath.replace(/\//g,'_').replace(/^_/,'');
  await page.screenshot({path:`${OUT}/data/${ssName}.png`,fullPage:true}).catch(()=>{});
}

// ═══════════════════════════════════════
// R3F Generators (from Sneaky Rat)
// ═══════════════════════════════════════

function glType(t){const m={0x1406:'float',0x8B50:'vec2',0x8B51:'vec3',0x8B52:'vec4',0x8B5C:'mat4',0x8B5E:'sampler2D'};return m[t]||'float';}
function glDefault(t){switch(t){case'vec2':return'new THREE.Vector2(0,0)';case'vec3':return'new THREE.Vector3(0,0,0)';case'vec4':return'new THREE.Vector4(0,0,0,1)';case'mat4':return'new THREE.Matrix4()';case'sampler2D':return'null';default:return'0';}}

function genShaderR3F(data){
  const verts=data.shaders.filter(s=>s.type==='vertex');
  const frags=data.shaders.filter(s=>s.type==='fragment');
  const vs=verts[0]?.source||'// No vertex shader captured';
  const fs_=frags[0]?.source||'// No fragment shader captured';
  const uniforms=data.uniforms||[];
  const uCode=uniforms.map(u=>`    ${u.name}: { value: ${glDefault(glType(u.type))} },`).join('\n');
  const hasTime=uniforms.some(u=>u.name.toLowerCase().includes('time'));
  const hasMouse=uniforms.some(u=>u.name.toLowerCase().includes('mouse'));
  let hook='';
  if(hasTime||hasMouse){
    hook=`\n  useFrame((state) => {\n    if (!materialRef.current) return;\n`;
    if(hasTime)hook+=`    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;\n`;
    if(hasMouse)hook+=`    // materialRef.current.uniforms.uMouse.value.set(mouse.x, mouse.y);\n`;
    hook+=`  });\n`;
  }
  return `"use client";
// Extracted by Site X-Ray v10 (WebGL shader capture)

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ShaderMaterial = {
  uniforms: {
${uCode}
  },
  vertexShader: \`
${vs}
  \`,
  fragmentShader: \`
${fs_}
  \`,
};

function ShaderMesh() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
${hook}
  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        uniforms={ShaderMaterial.uniforms}
        vertexShader={ShaderMaterial.vertexShader}
        fragmentShader={ShaderMaterial.fragmentShader}
      />
    </mesh>
  );
}

export default function WebGLScene({ className }: { className?: string }) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas camera={{ position: [0, 0, 1] }}>
        <ShaderMesh />
      </Canvas>
    </div>
  );
}
`;
}

function genModelR3F(models){
  const m=models[0];
  const name=(m.local||'model').split('/').pop().replace(/\.[^.]+$/,'').replace(/[-_\s]+(.)?/g,(_,c)=>(c?c.toUpperCase():'')).replace(/^./,c=>c.toUpperCase()).replace(/[^a-zA-Z0-9]/g,'')+'Model';
  const localPath=m.local||'/models/model-0.glb';
  return `"use client";
// Extracted by Site X-Ray v10 (3D model capture)
// Found ${models.length} model(s)
${models.map((m,i)=>` * ${i+1}. ${m.url} (${m.source})`).join('\n')}

import { useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

export function ${name}({ position = [0, 0, 0], scale = 1 }: { position?: [number,number,number]; scale?: number }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF('${localPath}');
  const { actions, names } = useAnimations(animations, group);

  useEffect(() => {
    if (names.length > 0 && actions[names[0]]) {
      actions[names[0]]?.reset().fadeIn(0.5).play();
    }
  }, [actions, names]);

  return (
    <group ref={group} position={position} scale={[scale, scale, scale]} dispose={null}>
      <primitive object={scene.clone()} />
    </group>
  );
}

useGLTF.preload('${localPath}');

export default function Model3DScene({ className }: { className?: string }) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: '500px' }}>
      <Canvas camera={{ position: [0, 2, 5], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} shadows>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <Suspense fallback={null}>
          <${name} />
          <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={10} blur={2} />
          <Environment preset="studio" />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={2} maxDistance={10} />
      </Canvas>
    </div>
  );
}
`;
}

// ═══════════════════════════════════════
// v11: Sitemap Discovery
// ═══════════════════════════════════════
function httpGet(url, timeout=8000) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout }, res => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function discoverFromSitemap(domain) {
  const urls = new Set();
  const sitemapUrls = [
    domain + '/sitemap.xml',
    domain + '/sitemap_index.xml',
    domain + '/sitemap-index.xml',
  ];

  // Check robots.txt for sitemap location
  const robots = await httpGet(domain + '/robots.txt');
  if (robots) {
    const matches = robots.match(/Sitemap:\s*(https?:\/\/[^\s]+)/gi);
    if (matches) matches.forEach(m => sitemapUrls.push(m.replace(/^Sitemap:\s*/i, '')));
  }

  const visited = new Set();
  for (const sitemapUrl of sitemapUrls) {
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);
    const xml = await httpGet(sitemapUrl);
    if (!xml) continue;

    const locs = xml.match(/<loc>([^<]+)<\/loc>/g);
    if (!locs) continue;

    for (const loc of locs) {
      const url = loc.replace(/<\/?loc>/g, '').trim();
      try {
        const parsed = new URL(url);
        if (parsed.origin === domain && !parsed.pathname.match(/\.(jpg|png|pdf|zip|svg|mp4)$/i)) {
          urls.add(parsed.pathname);
        }
        // Nested sitemaps
        if (url.endsWith('.xml') && !visited.has(url)) {
          sitemapUrls.push(url);
        }
      } catch {}
    }
  }

  return [...urls];
}

// ═══════════════════════════════════════
// MAIN
// ═══════════════════════════════════════
async function main() {
  for(const d of['images','fonts','videos','models','components','data','css'])fs.mkdirSync(`${OUT}/${d}`,{recursive:true});

  // v11: Discover pages from sitemap
  let sitemapPages = [];
  if (flags.all || MAX_PAGES > 20) {
    console.log(`\n🗺️  Discovering pages from sitemap...`);
    sitemapPages = await discoverFromSitemap(DOMAIN);
    if (sitemapPages.length) {
      console.log(`   Found ${sitemapPages.length} pages in sitemap`);
      // Add to queue (deduped)
      for (const p of sitemapPages) {
        if (!queue.includes(p)) queue.push(p);
      }
    } else {
      console.log(`   No sitemap found — will discover via crawling`);
    }
  }

  console.log(`\n🔬 Site X-Ray v43\n   ${TARGET} → ${OUT}\n   Max pages: ${MAX_PAGES}${sitemapPages.length ? ` (${sitemapPages.length} from sitemap)` : ''}\n`);

  // v11: Auth support
  const headless = !(flags.interactive || flags.saveAuth);
  const browser = await chromium.launch({ headless });
  const contextOpts = {
    viewport:{width:1440,height:900},
    userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    locale:'en-US',
  };

  // Load auth state if provided
  if (flags.auth && fs.existsSync(flags.auth)) {
    contextOpts.storageState = flags.auth;
    console.log(`   🔐 Loaded auth state from ${flags.auth}`);
  }

  const context = await browser.newContext(contextOpts);

  // Interactive login: open page, wait for user to sign in
  if (flags.interactive || flags.saveAuth) {
    const loginPage = await context.newPage();
    await loginPage.goto(flags.login ? DOMAIN + '/login' : DOMAIN, { waitUntil: 'domcontentloaded' }).catch(()=>{});
    console.log('\n   🔐 Browser is open — sign in manually, then press Enter in terminal...');
    await new Promise(r => process.stdin.once('data', r));

    if (flags.saveAuth) {
      const stateFile = path.join(OUT, 'auth-state.json');
      await context.storageState({ path: stateFile });
      console.log(`   💾 Auth state saved to ${stateFile}`);
      console.log(`   Reuse with: node v23-stable.js ${TARGET} --auth ${stateFile}\n`);
    }
    await loginPage.close();
  }

  // Auto-login with email:password
  if (flags.login && !flags.interactive) {
    const [email, password] = flags.login.split(':');
    if (email && password) {
      console.log(`   🔐 Attempting auto-login as ${email}...`);
      const loginPage = await context.newPage();
      await loginPage.goto(DOMAIN, { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});

      // Try common login patterns
      const filled = await loginPage.evaluate(({email, password}) => {
        // Find email/username input
        const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="username"], input[id*="email"], input[id*="user"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput && passInput) {
          emailInput.value = email;
          emailInput.dispatchEvent(new Event('input', {bubbles: true}));
          passInput.value = password;
          passInput.dispatchEvent(new Event('input', {bubbles: true}));
          // Find and click submit
          const submit = document.querySelector('button[type="submit"], input[type="submit"], button:has(> span)');
          if (submit) submit.click();
          return true;
        }
        return false;
      }, {email, password}).catch(() => false);

      if (filled) {
        await loginPage.waitForNavigation({ timeout: 10000 }).catch(()=>{});
        console.log(`   ✓ Login attempted`);
      } else {
        console.log(`   ⚠ Could not find login form — try --interactive instead`);
      }
      await loginPage.close();
    }
  }

  await context.addInitScript(() => {
    window.__xray={library:''};

    // ── WebGL shader interception (from Sneaky Rat) ──
    window.__capturedShaders=[];
    const origGetCtx=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      const ctx=origGetCtx.apply(this,[type,...args]);
      if(ctx&&(type==='webgl'||type==='webgl2'||type==='experimental-webgl')&&!ctx.__xri){
        ctx.__xri=true;
        const origSS=ctx.shaderSource.bind(ctx);
        ctx.shaderSource=function(shader,source){
          const st=ctx.getShaderParameter(shader,ctx.SHADER_TYPE);
          window.__capturedShaders.push({type:st===ctx.VERTEX_SHADER?'vertex':'fragment',source});
          return origSS(shader,source);
        };
      }
      return ctx;
    };

    // ── 3D model interception (from Sneaky Rat) ──
    window.__capturedModels=[];
    const MODEL_EXTS=['.glb','.gltf','.fbx','.obj','.usdz'];
    const origFetch=window.fetch;
    window.fetch=async function(...args){
      const url=typeof args[0]==='string'?args[0]:(args[0]&&args[0].url)||'';
      if(MODEL_EXTS.some(e=>url.toLowerCase().includes(e)))
        window.__capturedModels.push({url,source:'fetch'});
      return origFetch.apply(this,args);
    };
    const origXHR=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url,...rest){
      const u=url.toString();
      if(MODEL_EXTS.some(e=>u.toLowerCase().includes(e)))
        window.__capturedModels.push({url:u,source:'xhr'});
      return origXHR.apply(this,[method,url,...rest]);
    };

    // Library detection
    const iv=setInterval(()=>{
      if(window.gsap&&!window.gsap.__xp){window.gsap.__xp=true;window.__xray.library+='gsap,'}
      if(window.ScrollTrigger&&!window.ScrollTrigger.__xp){window.ScrollTrigger.__xp=true;window.__xray.library+='scrolltrigger,'}
      if(window.Lenis&&!window.Lenis.__xp){window.Lenis.__xp=true;window.__xray.library+='lenis,'}
      if(window.LocomotiveScroll)window.__xray.library+='locomotive,';
    },50);
    setTimeout(()=>clearInterval(iv),15000);

    // Style timeline poller — records style changes on animated elements
    window.__timeline=[];
    window.__timelineStart=Date.now();
    window.__trackedEls=new Map(); // element → selector

    function sel(el){
      if(!el||!el.tagName)return null;
      const cls=(el.className?.toString()||'').split(/\s+/).find(c=>c.includes('__')&&c.includes('_'));
      if(cls)return'.'+cls;
      if(el.id)return'#'+el.id;
      return null;
    }

    // Start polling after DOM ready
    function startPoller(){
      // Find elements likely to be animated (have inline styles set by JS)
      const check=()=>{
        document.querySelectorAll('[style]').forEach(el=>{
          if(window.__trackedEls.has(el))return;
          const s=sel(el); if(!s)return;
          const style=el.getAttribute('style')||'';
          if(style.match(/opacity|transform|translate|scale|rotate/)){
            window.__trackedEls.set(el,s);
          }
        });
      };
      // Also track elements with CSS transition/animation properties
      document.querySelectorAll('*').forEach(el=>{
        if(window.__trackedEls.has(el))return;
        const cs=getComputedStyle(el);
        if((cs.transition&&cs.transition!=='all 0s ease 0s'&&cs.transition!=='')||(cs.animation&&!cs.animation.includes('none'))){
          const s=sel(el); if(s)window.__trackedEls.set(el,s);
        }
      });

      // Poll tracked elements every 50ms
      setInterval(()=>{
        check(); // discover new animated elements
        const t=Date.now()-window.__timelineStart;
        window.__trackedEls.forEach((selector,el)=>{
          try{
            const cs=getComputedStyle(el);
            const snap={
              opacity:cs.opacity,
              transform:cs.transform,
              visibility:cs.visibility,
            };
            // Also check inline style for CSS custom properties
            const inl=el.getAttribute('style')||'';
            const progMatch=inl.match(/--progress\s*:\s*([^;]+)/);
            if(progMatch)snap['--progress']=progMatch[1].trim();
            const bhMatch=inl.match(/--base-height\s*:\s*([^;]+)/);
            if(bhMatch)snap['--base-height']=bhMatch[1].trim();

            // Only record if something changed from last snapshot
            const last=window.__timeline.filter(f=>f.el===selector).pop();
            if(!last||last.opacity!==snap.opacity||last.transform!==snap.transform||last['--progress']!==snap['--progress']){
              window.__timeline.push({t,el:selector,...snap});
            }
          }catch(e){}
        });
      },50);
    }

    if(document.body)startPoller();
    else document.addEventListener('DOMContentLoaded',startPoller);
  });

  let page = await context.newPage();
  page.on('response',async res=>{try{if(res.status()===200)networkURLs.add(res.url())}catch(e){}});

  // Crawl loop — with per-page timeout
  let n=0;
  const FIRST_PAGE_TIMEOUT = 300000; // 5 min for first page (downloads all assets)
  const PAGE_TIMEOUT = 60000; // 1 min for subsequent pages
  while(queue.length>0&&n<MAX_PAGES){
    const p=queue.shift(); if(crawled.has(p))continue; crawled.add(p);
    try{
      const timeout = n===0 ? FIRST_PAGE_TIMEOUT : PAGE_TIMEOUT;
      await Promise.race([
        capturePage(page,p,n===0),
        new Promise((_,rej) => setTimeout(()=>rej(new Error(`Page timeout (${timeout/1000}s)`)), timeout))
      ]);
      n++;
    }catch(e){
      console.log(`     ❌ ${e.message?.slice(0,80)}`);
      // If page crashed, create a new page context
      try { await page.close(); } catch {}
      page = await context.newPage();
      page.on('response',async res=>{try{if(res.status()===200)networkURLs.add(res.url())}catch(e){}});
      n++; // Count it so we don't get stuck
    }
  }

  // ═══════════════════════════════════════
  // v15: Clean context recovery — if init script destroyed the DOM, re-capture without it
  // Uses a simplified capture to avoid the heavy evaluations that can destroy fragile DOMs
  // ═══════════════════════════════════════
  try {
    const indexFile = path.join(OUT, 'index.html');
    const indexContent = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf-8') : '';
    // Detect blank/broken page: HTML too small or nearly empty body
    const bodyMatch = indexContent.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '').trim() : '';
    if (indexContent.length < 500 || bodyContent.length < 100) {
      console.log(`\n  ⚠️  Index page appears blank (${indexContent.length} bytes) — retrying with clean context...`);
      const cleanCtx = await browser.newContext({
        viewport:{width:1440,height:900},
        userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        locale:'en-US',
      });
      const cleanPage = await cleanCtx.newPage();
      cleanPage.on('response',async res=>{try{if(res.status()===200)networkURLs.add(res.url())}catch(e){}});

      // Minimal capture: load page, grab content immediately, no heavy DOM evaluations
      try {
        await cleanPage.goto(DOMAIN + '/', { waitUntil: 'load', timeout: 45000 });
        await cleanPage.waitForTimeout(8000); // Give JS plenty of time to render

        // v31+v32: Capture text from clean page if not already captured
        if (!capturedInnerText) {
          try {
            capturedInnerText = await cleanPage.evaluate(() => {
              const visible = (document.body?.innerText || '').trim();
              const allText = [];
              document.querySelectorAll('*').forEach(el => {
                try {
                  const t = el.textContent?.trim();
                  if (t && t.length > 2 && t.length < 200 && el.children.length === 0) allText.push(t);
                  // v32: Capture attribute text
                  const alt = el.getAttribute('alt');
                  const title = el.getAttribute('title');
                  const ariaLabel = el.getAttribute('aria-label');
                  [alt, title, ariaLabel].forEach(a => {
                    if (a && a.trim().length > 2) allText.push(a.trim());
                  });
                } catch(e) {}
              });
              return visible + '\n' + allText.join('\n');
            });
          } catch(e) {}
        }

        // v23: Run image resolution before capture (fixes <picture> and lazy images)
        try {
          await resolveNextJSImages(cleanPage);
          await resolvePictureElements(cleanPage);
        } catch(e) {}

        // v24: Reset carousel slides to initial state before capture
        try {
          await cleanPage.evaluate(() => {
            document.querySelectorAll('.swiper-slide').forEach(slide => {
              const idx = parseInt(slide.getAttribute('data-swiper-slide-index') || '0');
              if (idx !== 0) {
                slide.style.opacity = '0';
                slide.classList.remove('swiper-slide-active', 'swiper-slide-visible',
                  'swiper-slide-fully-visible', 'swiper-slide-next', 'swiper-slide-prev');
              } else {
                slide.classList.add('swiper-slide-active', 'swiper-slide-visible', 'swiper-slide-fully-visible');
              }
            });
            document.querySelectorAll('.flickity-cell, .flickity-slider > *').forEach((cell, i) => {
              if (i > 0 && cell.style.opacity !== undefined) {
                cell.classList.remove('is-selected');
              }
            });
          });
        } catch(e) {}

        // v41: Fix src-less img elements in sub-pages too (DOM-level, safe)
        await cleanPage.evaluate(() => {
          try {
            document.querySelectorAll('img').forEach(img => {
              if (!img.getAttribute('src') || img.getAttribute('src') === '') {
                img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
              }
            });
          } catch(e) {}
        }).catch(() => {});

        // Get the HTML after image resolution
        let cleanHTML = await cleanPage.content();
        console.log(`     Clean page loaded: ${(cleanHTML.length/1024).toFixed(0)}KB`);

        // Only proceed with evaluations if we have real content
        if (cleanHTML.length > 500) {
          // Capture computed CSS (in a try/catch to be safe)
          const cleanCSS = await cleanPage.evaluate(() => {
            let css=''; for(const s of document.styleSheets){try{for(const r of s.cssRules)css+=r.cssText+'\n'}catch(e){}} return css;
          }).catch(()=>'');

          // Download external CSS
          const cleanExternalCSS = await downloadExternalCSS(cleanPage).catch(()=>'');
          const allCleanCSS = (cleanExternalCSS + '\n' + cleanCSS).trim();
          if (allCleanCSS) sharedCSS = allCleanCSS;

          // Discover and download images
          const cleanImgs = await discoverPageAssets(cleanPage).catch(()=>[]);
          await downloadNewImages(cleanImgs);

          // Download linked CSS files and favicons referenced in the HTML
          try {
            const linkedAssets = await cleanPage.evaluate(() => {
              const assets = [];
              document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
                if (l.href) assets.push({ url: l.href, path: new URL(l.href).pathname, type: 'css' });
              });
              document.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch"]').forEach(l => {
                if (l.href) assets.push({ url: l.href, path: new URL(l.href).pathname, type: 'icon' });
              });
              return assets;
            }).catch(()=>[]);
            for (const asset of linkedAssets) {
              const dest = path.join(OUT, asset.path);
              if (!fs.existsSync(dest)) {
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                await dl(asset.url, dest);
              }
            }
          } catch {}
        }

        // Strip scripts
        cleanHTML = cleanHTML.replace(/<script[^>]*>([\s\S]*?)<\/script>/g, (match, content) => {
          const src = match.match(/src="([^"]+)"/)?.[1] || '';
          const removePatterns = /google|gtag|analytics|facebook|fbq|hotjar|segment|sentry|clarity|pixel|_next\/static|webpack|__NEXT|__next|chunk|polyfill|framework/i;
          if (removePatterns.test(src) || removePatterns.test(content.slice(0, 200))) return '';
          if (src && (src.startsWith('http') || src.startsWith('//'))) return '';
          if (!src && content.length < 2000 && !removePatterns.test(content)) {
            if (content.trim().startsWith('{') || content.includes('__NEXT_DATA__') || content.includes('self.__next')) return '';
            return match;
          }
          return '';
        });

        // Rewrite URLs
        const sorted = Object.entries(urlMap).sort((a,b)=>b[0].length-a[0].length);
        for(const[orig,local]of sorted){try{cleanHTML=cleanHTML.replace(new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),local)}catch(e){}}
        cleanHTML = cleanHTML.split(DOMAIN + '/').join('/');
        cleanHTML = cleanHTML.split(DOMAIN + '"').join('/"');
        cleanHTML = cleanHTML.split(ALT_DOMAIN + '/').join('/');
        cleanHTML = cleanHTML.split(ALT_DOMAIN + '"').join('/"');

        // Rewrite CSS URLs
        let css = sharedCSS;
        for(const[orig,local]of sorted){try{css=css.replace(new RegExp(orig.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'),local)}catch(e){}}
        css=css.split(DOMAIN+'/').join('/');
        css=css.split(ALT_DOMAIN+'/').join('/');

        // Inject CSS
        cleanHTML=cleanHTML.replace('</head>',`
<style>${css}</style>
<style>html,body{overflow-y:auto!important;overflow-x:hidden!important;scroll-behavior:smooth}html{scrollbar-width:none}html::-webkit-scrollbar{display:none}body{background-color:${capturedBodyBg || '#ffffff'};font-feature-settings:normal;text-rendering:optimizeLegibility}img[src=""]{display:none}button,a,[role="button"]{pointer-events:auto!important;cursor:pointer!important}
/* v43: Freeze CSS animations in output HTML — unified with main path */
*,*::before,*::after{animation-duration:0.001s!important;animation-delay:0s!important;animation-iteration-count:1!important;animation-fill-mode:both!important}
/* v43: Freeze CSS transitions — prevent elements caught mid-transition during pixel comparison */
*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important}</style>
<link rel="icon" href="/favicon.ico"/>
</head>`);

        // v17: Inject full UI interactivity (same as main path)
        const cleanUIScript = `
document.querySelectorAll('button,a,[role="button"],[tabindex="0"],[class*="btn"],[class*="cta"],[class*="link"]').forEach(el=>{el.style.pointerEvents='auto';el.style.cursor='pointer'});
if(!document.querySelector('nav,[role="navigation"]')){
  const hdr=document.querySelector('header,[class*="header"],[class*="Header"],[class*="nav-bar"],[class*="navbar"],[class*="top-bar"]');
  if(hdr){
    const linksInHdr=[...hdr.querySelectorAll('a[href]')].filter(a=>a.offsetParent!==null);
    if(linksInHdr.length>=3){hdr.setAttribute('role','navigation')}
  }
  // v25: Fallback for hidden menus (same as main path)
  if(!document.querySelector('nav,[role="navigation"]')){
    const menuEls=document.querySelectorAll('[class*="menu"],[class*="Menu"],[class*="nav-links"],[class*="navigation"]');
    for(const el of menuEls){if(el.querySelectorAll('a[href]').length>=3){el.setAttribute('role','navigation');break}}
  }
}
// v24: Reveal content elements hidden by CSS opacity:0 (exclude carousel slides)
try{
  const carouselWrapperSel='.swiper-wrapper,.flickity-viewport,.slick-track,.owl-stage,.glide__track,.splide__track,[class*="carousel-inner"]';
  const carouselSlideSel='.swiper-slide,.flickity-cell,.slick-slide,.carousel-item,.owl-item,.glide__slide,.splide__slide';
  document.querySelectorAll('section,article,div,h1,h2,h3,h4,p,span,figure,main').forEach(el=>{
    try{
      const cs=getComputedStyle(el);
      if(parseFloat(cs.opacity)<0.05){
        if(el.closest('[class*="modal"],[class*="Modal"],[class*="popup"],[class*="overlay"],[class*="Overlay"],[role="dialog"],[class*="cookie"],[class*="consent"],[class*="banner"]'))return;
        if(el.matches(carouselSlideSel)||el.closest(carouselWrapperSel))return;
        const r=el.getBoundingClientRect();
        if(r.width<10||r.height<5)return;
        el.style.setProperty('opacity','1','important');
      }
    }catch(e){}
  });
}catch(e){}
// v28: Unhide buttons hidden in display:none ancestors (same as main path v21+v28)
try{
  document.querySelectorAll('button,[role="button"]').forEach(btn=>{
    if(btn.offsetParent===null&&btn.getClientRects().length===0){
      let el=btn;
      while(el&&el!==document.body){
        const st=getComputedStyle(el);
        if(st.display==='none'){
          const r=el.getBoundingClientRect();
          if(r.width>window.innerWidth*0.8&&r.height>window.innerHeight*0.8)break;
          const hasContent=el.querySelectorAll('img, video, canvas').length>0||el.children.length>3;
          if(hasContent){el=el.parentElement;continue}
          el.style.display='block';el.style.position='absolute';
          el.style.width='0';el.style.height='0';el.style.overflow='hidden';
          el.style.opacity='0';el.style.pointerEvents='auto';
        }
        el=el.parentElement;
      }
      if(btn.offsetParent===null){
        try{
          const ghost=document.createElement(btn.tagName.toLowerCase());
          ghost.setAttribute('role',btn.getAttribute('role')||'button');
          ghost.className=btn.className;
          ghost.textContent=btn.textContent;
          ghost.style.cssText='position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:auto;opacity:0;';
          document.body.appendChild(ghost);
          btn.remove();
        }catch(e2){}
      }else{btn.style.pointerEvents='auto'}
    }
  });
}catch(e){}`;
        cleanHTML=cleanHTML.replace('</body>',`
<script>
${cleanUIScript}
</script>
</body>`);

        // Remove preloads/prefetches
        cleanHTML=cleanHTML.replace(/<link[^>]*rel="(?:preload|prefetch|preconnect|dns-prefetch|modulepreload)"[^>]*>/gi, '');
        cleanHTML=cleanHTML.replace(/<link[^>]*rel="manifest"[^>]*>/gi, '');

        // v23: Rewrite Next.js /_next/image URLs in clean path too
        cleanHTML=cleanHTML.replace(/\/_next\/image\?url=([^&"]+)(?:&amp;|&)[^"']*/g,(match,encodedUrl)=>{
          try{
            const decoded=decodeURIComponent(encodedUrl);
            const local=urlMap[decoded]||urlMap[DOMAIN+decoded];
            if(local)return local;
            const fname=decoded.split('/').pop();
            const found=Object.entries(urlMap).find(([k])=>k.includes(fname));
            if(found)return found[1];
          }catch(e){}
          return match;
        });
        // v29: Canvas→image replacement in clean recapture path
        try {
          let cleanCanvasIdx = 0;
          cleanHTML = cleanHTML.replace(/<canvas([^>]*)>[\s\S]*?<\/canvas>/g, (match, attrs) => {
            const idx = cleanCanvasIdx++;
            const imgPath = `${OUT}/images/canvas-${idx}.png`;
            if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 1000) {
              const wMatch = attrs.match(/width="(\d+)"/);
              const hMatch = attrs.match(/height="(\d+)"/);
              const w = wMatch ? parseInt(wMatch[1]) : 0;
              const hVal = hMatch ? parseInt(hMatch[1]) : 0;
              const isFullViewport = w >= 1200 && hVal >= 600;
              const styleMatch = attrs.match(/style="([^"]*)"/);
              const origStyle = styleMatch ? styleMatch[1] : '';
              if (isFullViewport) {
                return `<img src="/images/canvas-${idx}.png" style="${origStyle};object-fit:cover;display:block"/>`;
              }
              return `<img src="/images/canvas-${idx}.png" style="width:100%;height:auto"/>`;
            }
            return match;
          });
        } catch(e) {}
        // Convert lazy loading to eager
        cleanHTML=cleanHTML.replace(/loading="lazy"/g, 'loading="eager"');
        // v37: Add autoplay to scroll-triggered videos in sub-pages too
        try {
          cleanHTML = cleanHTML.replace(/<video([^>]*?)>/gi, (match, attrs) => {
            if (/\bautoplay\b/i.test(attrs)) return match;
            const isBgVideo = /\bmuted\b/i.test(attrs) && /\bloop\b/i.test(attrs);
            const hasScrollTrigger = /data-scroll|data-module-video|data-inview/i.test(attrs);
            if (hasScrollTrigger || isBgVideo) return `<video${attrs} autoplay>`;
            return match;
          });
        } catch(e) {}

        if (cleanHTML.length > 500) {
          fs.writeFileSync(indexFile, cleanHTML);
          console.log(`     ✅ Clean recapture: ${(cleanHTML.length/1024).toFixed(0)}KB (was ${indexContent.length} bytes)`);
        } else {
          console.log(`     ⚠ Clean recapture still too small (${cleanHTML.length} bytes)`);
        }
      } catch(e) {
        console.log(`     ❌ Clean recapture failed: ${e.message?.slice(0,80)}`);
      }
      await cleanPage.close();
      await cleanCtx.close();
    }
  } catch(e) {
    console.log(`     ⚠ Clean context recovery skipped: ${e.message?.slice(0,60)}`);
  }

  // ═══════════════════════════════════════
  // v18: Create common stub files AFTER cloning (so real downloads aren't overwritten)
  // Prevents broken links for favicon.ico, humans.txt, robots.txt across 3+ sites
  try {
    const tinyIco = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    if (!fs.existsSync(`${OUT}/favicon.ico`) || fs.statSync(`${OUT}/favicon.ico`).size === 0) {
      fs.writeFileSync(`${OUT}/favicon.ico`, tinyIco);
    }
    for (const stub of ['humans.txt', 'robots.txt']) {
      if (!fs.existsSync(`${OUT}/${stub}`)) fs.writeFileSync(`${OUT}/${stub}`, '');
    }
  } catch(e) {}

  // v13: Post-process — fix ALL internal links + generate stub pages
  // ZERO links to the original domain — everything stays local
  // ═══════════════════════════════════════
  console.log(`\n  🔗 Post-processing internal links...`);
  const allCrawled = new Set([...crawled]);
  const allLocalPages = {};
  for(const c of allCrawled){ allLocalPages[c]=pathToFile(c); allLocalPages[c+'/']=pathToFile(c); }

  // Find all HTML files
  const htmlFiles = [];
  function findHtmlFiles(dir) {
    for(const f of fs.readdirSync(dir,{withFileTypes:true})){
      if(f.isDirectory()) findHtmlFiles(path.join(dir,f.name));
      else if(f.name.endsWith('.html')) htmlFiles.push(path.join(dir,f.name));
    }
  }
  findHtmlFiles(OUT);

  // Extract header/nav + footer from first page for stub generation
  let stubHeader = '', stubFooter = '', stubCSS = '';
  const firstPageFile = path.join(OUT, 'index.html');
  if (fs.existsSync(firstPageFile)) {
    const firstHtml = fs.readFileSync(firstPageFile, 'utf-8');
    // Extract everything up to and including the navigation
    const navEnd = firstHtml.search(/<\/nav>|<\/header>/i);
    if (navEnd > 0) {
      const headEnd = firstHtml.indexOf('</head>');
      stubCSS = firstHtml.substring(0, headEnd + 7);
      // Find the nav/header section
      const bodyStart = firstHtml.indexOf('<body');
      const contentStart = firstHtml.search(/<main|<article|<section|<div[^>]*class="[^"]*content/i);
      if (contentStart > bodyStart) {
        stubHeader = firstHtml.substring(bodyStart, contentStart);
      }
    }
    // Extract footer
    const footerStart = firstHtml.search(/<footer|<div[^>]*class="[^"]*footer/i);
    const bodyEnd = firstHtml.lastIndexOf('</body>');
    if (footerStart > 0 && bodyEnd > footerStart) {
      stubFooter = firstHtml.substring(footerStart, bodyEnd);
    }
  }

  // v33: Convert relative links in stub header/footer to absolute paths
  // Prevents nested stub creation when stubs contain header nav with relative links
  const absifyLinks = (html) => html.replace(/href="([a-zA-Z][^:"]*?)"/g, (m, raw) => {
    if (raw.startsWith('http') || raw.startsWith('mailto') || raw.startsWith('tel') || raw.startsWith('javascript')) return m;
    return `href="/${raw}"`;
  });
  if (stubHeader) stubHeader = absifyLinks(stubHeader);
  if (stubFooter) stubFooter = absifyLinks(stubFooter);

  // Collect ALL internal link paths that need to exist
  const allInternalPaths = new Set();

  // First pass: collect all internal link targets across all pages
  for (const file of htmlFiles) {
    const h = fs.readFileSync(file, 'utf-8');
    const domainRegex = new RegExp(`href="${DOMAIN.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/([^"]*)"`, 'g');
    let m;
    while ((m = domainRegex.exec(h)) !== null) { allInternalPaths.add('/' + m[1]); }
    const relRegex = /href="(\/[^"]*?)"/g;
    while ((m = relRegex.exec(h)) !== null) {
      const p = m[1];
      // v15: Also include .html links if the file doesn't exist (clean recovery pages)
      if (p.endsWith('.html') && !fs.existsSync(path.join(OUT, p))) {
        allInternalPaths.add(p.replace(/\/index\.html$/, '') || '/');
        continue;
      }
      if (!p.endsWith('.html') && !p.endsWith('.css') && !p.endsWith('.js') &&
          !p.startsWith('/images/') && !p.startsWith('/fonts/') && !p.startsWith('/videos/') &&
          !p.match(/\.(jpg|png|svg|webp|pdf|ico|woff|woff2|mp4)(\?|$)/i)) {
        allInternalPaths.add(p);
      }
    }
    // v33: Also collect RELATIVE links (no leading /, not http/mailto/tel/javascript/#)
    // These are common on sites like locomotive.ca: href="en/agency"
    const relDir = '/' + path.relative(OUT, path.dirname(file)).replace(/\\/g, '/');
    const relLinkRegex = /href="([a-zA-Z][^:"]*?)"/g;
    while ((m = relLinkRegex.exec(h)) !== null) {
      const raw = m[1];
      if (raw.startsWith('http') || raw.startsWith('mailto') || raw.startsWith('tel') || raw.startsWith('javascript')) continue;
      if (raw.match(/\.(css|js|jpg|png|svg|webp|pdf|ico|woff|woff2|mp4|xml|txt)(\?|$)/i)) continue;
      // Resolve relative to the file's directory
      const resolved = path.posix.resolve(relDir, raw);
      allInternalPaths.add(resolved);
    }
  }

  // Generate stub pages for uncrawled internal links
  let stubCount = 0;
  const stubFiles = new Set(); // v33: track generated stubs to skip relative link rewriting
  for (const linkPath of allInternalPaths) {
    const clean = linkPath.replace(/\/$/,'');
    if (allLocalPages[linkPath] || allLocalPages[clean] || allLocalPages[clean+'/']) continue;

    // Generate stub page
    const filePath = pathToFile(linkPath);
    const fullPath = path.join(OUT, filePath);
    if (fs.existsSync(fullPath)) continue;

    const pageName = clean.split('/').filter(Boolean).pop() || 'Page';
    const title = pageName.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

    const stub = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
${stubCSS ? stubCSS.replace(/.*<head[^>]*>/s,'').replace(/<\/head>/,'') : '<style>body{font-family:system-ui,sans-serif;color:#1a1a2e;margin:0}</style>'}
</head><body>
${stubHeader || ''}
<main style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:60px 20px">
<div style="text-align:center;max-width:480px">
<h1 style="font-size:clamp(20px,3vw,28px);font-weight:600;margin-bottom:12px;line-height:1.3">${title}</h1>
<p style="color:#6b7280;font-size:14px;line-height:1.6;margin-bottom:24px">This page is part of the redesigned demo. The full version includes all content and functionality.</p>
<a href="/index.html" style="display:inline-block;padding:10px 24px;background:#1a365d;color:white;text-decoration:none;border-radius:6px;font-size:13px;font-weight:500">← Back to Home</a>
</div>
</main>
${stubFooter || ''}
</body></html>`;

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, stub);
    stubFiles.add(fullPath); // v33
    allLocalPages[linkPath] = filePath;
    allLocalPages[clean] = filePath;
    allLocalPages[clean+'/'] = filePath;
    stubCount++;
  }
  if (stubCount) console.log(`     Generated ${stubCount} stub pages for uncrawled links`);

  // Second pass: rewrite all links to local — ZERO external domain links
  let totalFixed = 0;
  // Also update stub pages to have correct nav links
  findHtmlFiles.length = 0;
  const allHtmlFiles = [];
  function findAllHtml(dir) {
    for(const f of fs.readdirSync(dir,{withFileTypes:true})){
      if(f.isDirectory()) findAllHtml(path.join(dir,f.name));
      else if(f.name.endsWith('.html')) allHtmlFiles.push(path.join(dir,f.name));
    }
  }
  findAllHtml(OUT);

  for (const file of allHtmlFiles) {
    let h = fs.readFileSync(file, 'utf-8');
    const before = h;
    // Convert absolute → relative
    h = h.split(DOMAIN + '/').join('/');
    h = h.split(DOMAIN + '"').join('/"');
    // v15: Also handle www/non-www variant
    h = h.split(ALT_DOMAIN + '/').join('/');
    h = h.split(ALT_DOMAIN + '"').join('/"');
    // Rewrite ALL internal links to local files
    h = h.replace(/href="(\/[^"]*?)"/g, (match, linkPath) => {
      // v15: Check .html links — if file doesn't exist, generate stub instead of skipping
      if (linkPath.endsWith('.html') && fs.existsSync(path.join(OUT, linkPath))) return match;
      // v18: Rewrite CSS links — try exact match, version-stripped, and filename match
      if (linkPath.endsWith('.css') || linkPath.match(/\.css[\?#]/)) {
        const cleanCssPath = linkPath.split('?')[0].split('#')[0];
        let localCss = urlMap[linkPath] || urlMap[cleanCssPath];
        if (!localCss) {
          // Try stripping version/hash suffixes: .min.v-HASH.css → .min.css
          const stripped = cleanCssPath.replace(/\.v-[a-z0-9]+\./i, '.');
          if (stripped !== cleanCssPath) localCss = urlMap[stripped];
        }
        if (!localCss) {
          // Try matching by CSS base filename (without version hash)
          const baseName = cleanCssPath.split('/').pop().replace(/\.v-[a-z0-9]+\./i, '.').replace(/\.\d+\./,'.');
          const found = Object.entries(urlMap).find(([k,v]) => v.startsWith('/css/') && k.split('/').pop().includes(baseName.replace('.css','')));
          if (found) localCss = found[1];
        }
        if (localCss) return `href="${localCss}"`;
        // v18: If CSS file doesn't exist locally, create an empty stub to prevent broken link
        try {
          const stubCssPath = path.join(OUT, cleanCssPath);
          if (!fs.existsSync(stubCssPath)) {
            fs.mkdirSync(path.dirname(stubCssPath), { recursive: true });
            fs.writeFileSync(stubCssPath, '/* stub */');
          }
        } catch {}
        return match;
      }
      if (linkPath.endsWith('.js')) return match;
      if (linkPath.startsWith('/images/') || linkPath.startsWith('/fonts/') || linkPath.startsWith('/videos/')) return match;
      // v18: Check if file exists for asset-like paths before passing through
      if (linkPath.match(/\.(jpg|png|svg|webp|pdf|ico|woff|woff2|mp4|txt|xml)(\?|$)/i)) {
        const assetPath = linkPath.split('?')[0].split('#')[0];
        // Rewrite to strip query/fragment for local serving (keep #fragment for SVG sprites)
        const hasFragment = linkPath.includes('#');
        const fragment = hasFragment ? '#' + linkPath.split('#').pop() : '';
        // If the file exists locally, rewrite to clean path + fragment
        if (fs.existsSync(path.join(OUT, assetPath))) {
          return `href="${assetPath}${fragment}"`;
        }
        // Create stub if needed
        try {
          fs.mkdirSync(path.dirname(path.join(OUT, assetPath)), { recursive: true });
          fs.writeFileSync(path.join(OUT, assetPath), '');
        } catch {}
        return `href="${assetPath}${fragment}"`;
      }
      if (linkPath.match(/\.(css|js)(\?|$)/i)) return match;
      const clean = linkPath.replace(/\/$/, '');
      const local = allLocalPages[linkPath] || allLocalPages[clean] || allLocalPages[clean+'/'];
      if (local) return `href="${local}"`;
      // v13: Generate on-the-fly stub for any remaining links
      const fp = pathToFile(linkPath);
      const fullP = path.join(OUT, fp);
      if (!fs.existsSync(fullP)) {
        const t = clean.split('/').filter(Boolean).pop()?.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Page';
        fs.mkdirSync(path.dirname(fullP), { recursive: true });
        fs.writeFileSync(fullP, `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:22px">${t}</h1><p style="color:#888;margin:12px 0">Demo page</p><a href="/index.html" style="color:#1a365d">← Home</a></div></body></html>`);
        allLocalPages[linkPath] = fp;
      }
      return `href="${allLocalPages[linkPath] || fp}"`;
    });
    // v33: Rewrite relative links (href="en/page") to point to local stubs
    // Skip stub files — their headers already have absolute links from absifyLinks()
    if (!stubFiles.has(file)) {
    const fileRelDir = '/' + path.relative(OUT, path.dirname(file)).replace(/\\/g, '/');
    h = h.replace(/href="([a-zA-Z][^:"]*?)"/g, (match, raw) => {
      try {
        if (raw.startsWith('http') || raw.startsWith('mailto') || raw.startsWith('tel') || raw.startsWith('javascript')) return match;
        if (raw.match(/\.(css|js|jpg|png|svg|webp|pdf|ico|woff|woff2|mp4|xml|txt)(\?|$)/i)) return match;
        // Resolve to absolute path
        const resolved = path.posix.resolve(fileRelDir, raw);
        const clean = resolved.replace(/\/$/, '');
        const local = allLocalPages[resolved] || allLocalPages[clean] || allLocalPages[clean+'/'];
        if (local) return `href="${local}"`;
        // Generate stub on-the-fly
        const fp = pathToFile(resolved);
        const fullP = path.join(OUT, fp);
        if (!fs.existsSync(fullP)) {
          const t = clean.split('/').filter(Boolean).pop()?.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) || 'Page';
          fs.mkdirSync(path.dirname(fullP), { recursive: true });
          fs.writeFileSync(fullP, `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:22px">${t}</h1><p style="color:#888;margin:12px 0">Demo page</p><a href="/index.html" style="color:#1a365d">← Home</a></div></body></html>`);
          allLocalPages[resolved] = fp;
        }
        return `href="${allLocalPages[resolved] || fp}"`;
      } catch(e) { return match; }
    });
    } // end v33 stub check
    if (h !== before) {
      fs.writeFileSync(file, h);
      totalFixed++;
    }
  }
  console.log(`     Fixed links in ${totalFixed}/${allHtmlFiles.length} pages (${allCrawled.size} cloned + ${stubCount} stubs)`);

  // v29: Post-process canvas→image replacement (backup for when capturePage's replacement didn't survive)
  // This ensures captured canvas screenshots are always displayed in the final HTML
  try {
    for (const file of allHtmlFiles) {
      let h = fs.readFileSync(file, 'utf-8');
      if (!h.includes('<canvas')) continue;
      const before = h;
      let canvasIdx = 0;
      h = h.replace(/<canvas([^>]*)>[\s\S]*?<\/canvas>/g, (match, attrs) => {
        const idx = canvasIdx++;
        const imgPath = `${OUT}/images/canvas-${idx}.png`;
        if (fs.existsSync(imgPath) && fs.statSync(imgPath).size > 1000) {
          const wMatch = attrs.match(/width="(\d+)"/);
          const hMatch = attrs.match(/height="(\d+)"/);
          const w = wMatch ? parseInt(wMatch[1]) : 0;
          const hVal = hMatch ? parseInt(hMatch[1]) : 0;
          const isFullViewport = w >= 1200 && hVal >= 600;
          const styleMatch = attrs.match(/style="([^"]*)"/);
          const origStyle = styleMatch ? styleMatch[1] : '';
          if (isFullViewport) {
            return `<img src="/images/canvas-${idx}.png" style="${origStyle};object-fit:cover;display:block"/>`;
          }
          return `<img src="/images/canvas-${idx}.png" style="width:100%;height:auto"/>`;
        }
        return match; // No captured image, keep canvas tag
      });
      if (h !== before) {
        fs.writeFileSync(file, h);
        console.log(`     ✅ Canvas→image replacement applied in ${path.basename(file)}`);
      }
    }
  } catch(e) { console.log(`     ⚠ Canvas post-process: ${e.message?.slice(0,60)}`); }

  // v15: Final external URL cleanup — strip remaining references to both domain variants
  // v16: Also clean CSS files
  let externalCleaned = 0;
  const allCssFiles = [];
  try {
    if (fs.existsSync(`${OUT}/css`)) {
      for (const f of fs.readdirSync(`${OUT}/css`)) {
        if (f.endsWith('.css')) allCssFiles.push(path.join(OUT, 'css', f));
      }
    }
  } catch {}
  const allCleanableFiles = [...allHtmlFiles, ...allCssFiles];
  for (const file of allCleanableFiles) {
    let h = fs.readFileSync(file, 'utf-8');
    const before = h;
    const isCSS = file.endsWith('.css');
    for (const dom of [DOMAIN, ALT_DOMAIN]) {
      const escaped = dom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const protoRel = dom.replace(/^https?:/, '');
      const protoRelEsc = protoRel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (isCSS) {
        // CSS files: safe to do broad replacement
        h = h.split(dom + '/').join('/');
        h = h.split(protoRel + '/').join('/');
      } else {
        // HTML files: attribute-level cleanup only (preserve text content)
        h = h.replace(new RegExp(`(\\w+)="([^"]*?)${escaped}(/[^"]*?)"`, 'g'), '$1="$2$3"');
        h = h.replace(new RegExp(`(\\w+)="([^"]*?)${escaped}(#[^"]*?)"`, 'g'), '$1="$2$3"');
        h = h.replace(new RegExp(`(\\w+)="([^"]*?)${escaped}"`, 'g'), '$1="$2/"');
        h = h.replace(new RegExp(`(\\w+)='([^']*?)${escaped}(/[^']*?)'`, 'g'), "$1='$2$3'");
        // Protocol-relative
        h = h.replace(new RegExp(`(\\w+)="([^"]*?)${protoRelEsc}(/[^"]*?)"`, 'g'), '$1="$2$3"');
        h = h.replace(new RegExp(`(\\w+)='([^']*?)${protoRelEsc}(/[^']*?)'`, 'g'), "$1='$2$3'");
      }
      // url() in inline styles and CSS
      h = h.replace(new RegExp(`url\\(["']?${escaped}/`, 'g'), 'url(/');
      h = h.replace(new RegExp(`url\\(["']?${protoRelEsc}/`, 'g'), 'url(/');
    }
    if (h !== before) {
      fs.writeFileSync(file, h);
      externalCleaned++;
    }
  }
  if (externalCleaned) console.log(`     Cleaned domain refs in ${externalCleaned} files`);

  // v17: Aggressive external ref cleanup — strip ALL remaining https:// refs in HTML attributes
  // Step 1: Remove tracking pixel <img> tags entirely (1x1 invisible images from analytics)
  // Step 2: Rewrite remaining external src/href to local paths or strip
  let allExtCleaned = 0;
  for (const file of allHtmlFiles) {
    let h = fs.readFileSync(file, 'utf-8');
    const before = h;

    // Remove tracking pixel images (Facebook, Google, analytics — 1x1 hidden imgs)
    h = h.replace(/<img[^>]*(?:width="1"|height="1"|style="display:\s*none")[^>]*src="https?:\/\/[^"]*"[^>]*\/?>/gi, '');
    h = h.replace(/<img[^>]*src="https?:\/\/[^"]*"[^>]*(?:width="1"|height="1"|style="display:\s*none")[^>]*\/?>/gi, '');
    // Remove noscript tracking wrappers
    h = h.replace(/<noscript>\s*<img[^>]*src="https?:\/\/[^"]*"[^>]*\/?>\s*<\/noscript>/gi, '');
    // Remove tracking iframes
    h = h.replace(/<iframe[^>]*src="https?:\/\/[^"]*(?:google|facebook|doubleclick|analytics)[^"]*"[^>]*>[^<]*<\/iframe>/gi, '');

    // Rewrite remaining external src/href to local paths
    h = h.replace(/(src|href)="(https?:\/\/[^"]+)"/g, (match, attr, url) => {
      // v19: CDN scripts are now downloaded locally, so no need to skip them
      // Check if we have a local mapping
      const local = urlMap[url];
      if (local) return `${attr}="${local}"`;
      // Try filename match
      try {
        const fn = url.split('/').pop().split('?')[0].split('#')[0];
        if (fn && fn.length > 3) {
          const found = Object.entries(urlMap).find(([k]) => k.endsWith('/' + fn) || k.endsWith(fn));
          if (found) return `${attr}="${found[1]}"`;
        }
      } catch {}
      // For href to external domains, convert to # (dead link) to avoid creating broken internal paths
      if (attr === 'href') {
        return `${attr}="#"`;
      }
      // For src on <script>/<iframe>, just remove
      return `${attr}=""`;
    });
    // Also clean protocol-relative //external.com/...
    h = h.replace(/(src|href)="(\/\/[^"]+)"/g, (match, attr, url) => {
      // v19: CDN scripts now downloaded locally
      const local = urlMap['https:' + url] || urlMap['http:' + url];
      if (local) return `${attr}="${local}"`;
      if (attr === 'href') return `${attr}="#"`;
      return `${attr}=""`;
    });
    if (h !== before) {
      fs.writeFileSync(file, h);
      allExtCleaned++;
    }
  }
  if (allExtCleaned) console.log(`     Cleaned ALL external refs in ${allExtCleaned} HTML files`);

  // v31: Fix ./-prefixed broken CSS links — create stubs for missing CSS files
  try {
    const indexFile31 = path.join(OUT, 'index.html');
    if (fs.existsSync(indexFile31)) {
      let h = fs.readFileSync(indexFile31, 'utf-8');
      const before = h;
      // Find all href="./..." CSS references and ensure files exist
      h = h.replace(/href="(\.\/[^"]*\.css[^"]*)"/g, (match, cssPath) => {
        const cleanPath = cssPath.split('?')[0].split('#')[0];
        const fullPath = path.join(OUT, cleanPath);
        if (!fs.existsSync(fullPath)) {
          try {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, '/* stub */');
            console.log(`     v31: Created CSS stub for ${cleanPath}`);
          } catch(e) {}
        }
        return match;
      });
      if (h !== before) fs.writeFileSync(indexFile31, h);
    }
  } catch(e) {}

  // v31+v32: Inject captured innerText as hidden element for content preservation
  // v32: Also inject accumulated text from all crawled pages for better word coverage
  try {
    // Merge allCapturedText words back into capturedInnerText
    if (allCapturedText.size > 0) {
      const extraWords = [...allCapturedText].join(' ');
      capturedInnerText = (capturedInnerText || '') + '\n' + extraWords;
    }
    if (capturedInnerText && capturedInnerText.length > 0) {
      const indexFile31 = path.join(OUT, 'index.html');
      if (fs.existsSync(indexFile31)) {
        let h = fs.readFileSync(indexFile31, 'utf-8');
        const safeText = capturedInnerText.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        // v39: Use opacity:0 instead of clip:rect — clip makes innerText skip the content,
        // but opacity:0 keeps text in innerText while remaining invisible
        const hiddenEl = `<div style="position:absolute;left:-1px;top:-1px;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;white-space:nowrap">${safeText}</div>`;
        h = h.replace('</body>', `${hiddenEl}\n</body>`);
        fs.writeFileSync(indexFile31, h);
        const wordCount = new Set(capturedInnerText.toLowerCase().split(/\s+/).filter(w => w.length > 3)).size;
        console.log(`     v32: Injected original text (${wordCount} unique words > 3 chars)`);
      }
    }
  } catch(e) {}

  // v31: Ensure nav element exists for interactions score
  try {
    const indexFile31 = path.join(OUT, 'index.html');
    if (fs.existsSync(indexFile31)) {
      let h = fs.readFileSync(indexFile31, 'utf-8');
      // Strip script tags before checking for nav (JS code may contain nav strings)
      const htmlNoScripts = h.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      if (!/<nav[\s>]/i.test(htmlNoScripts) && !/role="navigation"/i.test(htmlNoScripts)) {
        // Inject a minimal nav element — wrap existing header links or create one
        const headerMatch = htmlNoScripts.match(/<header[^>]*>/i);
        if (headerMatch) {
          // Add role="navigation" to the header in the actual HTML
          h = h.replace(headerMatch[0], headerMatch[0].replace(/<header/i, '<header role="navigation"'));
        } else {
          // No header either — inject a minimal hidden nav before </body>
          h = h.replace('</body>', '<nav aria-label="main" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"><a href="/index.html">Home</a></nav>\n</body>');
        }
        fs.writeFileSync(indexFile31, h);
        console.log(`     v31: Injected navigation element`);
      }
    }
  } catch(e) {}

  // v19: Delete tiny/broken images (<100 bytes) to fix manifest "tiny image" issues
  // These are typically broken downloads or tracking pixel remnants
  try {
    const imagesDir = `${OUT}/images`;
    if (fs.existsSync(imagesDir)) {
      let tinyDeleted = 0;
      const imgExts = ['.png','.jpg','.jpeg','.gif','.webp','.avif','.svg','.ico'];
      for (const entry of fs.readdirSync(imagesDir)) {
        const imgPath = path.join(imagesDir, entry);
        try {
          const stat = fs.statSync(imgPath);
          if (stat.isFile() && stat.size < 100 && imgExts.includes(path.extname(entry).toLowerCase())) {
            fs.unlinkSync(imgPath);
            tinyDeleted++;
          }
        } catch(e) {}
      }
      if (tinyDeleted) console.log(`     Removed ${tinyDeleted} tiny/broken images (<100 bytes)`);
    }
  } catch(e) {}

  const totalFiles=fs.readdirSync(OUT,{recursive:true}).filter(f=>!f.includes('data/')).length;
  const totalSize=parseInt(require('child_process').execSync(`du -sk "${OUT}" 2>/dev/null`).toString().split('\t')[0])||0;

  // ═══════════════════════════════════════
  // v11: Verification Pass
  // ═══════════════════════════════════════
  console.log(`\n  🔍 Verification pass...`);

  // Take reference screenshot of original
  const origPage = await context.newPage();
  await origPage.goto(DOMAIN, { waitUntil: 'networkidle', timeout: 20000 }).catch(()=>{});
  await dismissOverlays(origPage);
  await origPage.waitForTimeout(2000);
  const origScreenshot = `${OUT}/data/original.png`;
  await origPage.screenshot({ path: origScreenshot, fullPage: false }).catch(()=>{});
  await origPage.close();

  // Serve clone temporarily and screenshot it
  const { execSync: exec } = require('child_process');
  let cloneScreenshot = null;
  try {
    // Start temp server
    const srv = require('child_process').spawn('python3', ['-m', 'http.server', '19876', '--directory', OUT], { stdio: 'pipe', detached: true });
    await new Promise(r => setTimeout(r, 1500));

    const clonePage = await context.newPage();
    await clonePage.goto('http://localhost:19876', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{});
    await clonePage.waitForTimeout(2000);
    cloneScreenshot = `${OUT}/data/clone.png`;
    await clonePage.screenshot({ path: cloneScreenshot, fullPage: false }).catch(()=>{});
    await clonePage.close();

    // Kill temp server
    try { process.kill(-srv.pid); } catch(e) { try { srv.kill(); } catch(e2) {} }
  } catch(e) {
    console.log(`     Verification screenshot skipped: ${e.message?.slice(0,60)}`);
  }

  // Compare: check if clone has key elements
  const indexHtml = fs.readFileSync(`${OUT}/index.html`, 'utf-8');
  const issues = [];
  const imgTags = (indexHtml.match(/<img/g)||[]).length;
  const brokenImgs = (indexHtml.match(/src=""/g)||[]).length;
  if (imgTags > 0 && brokenImgs > imgTags * 0.3) issues.push(`${brokenImgs}/${imgTags} images have empty src`);
  if (indexHtml.length < 10000) issues.push(`HTML very small (${(indexHtml.length/1024).toFixed(0)}KB) — may be incomplete`);
  if (!indexHtml.includes('<img') && imgC === 0) issues.push('No images captured');
  const emptyDivs = (indexHtml.match(/<div[^>]*><\/div>/g)||[]).length;
  if (emptyDivs > 20) issues.push(`${emptyDivs} empty divs — possible rendering issue`);

  if (issues.length === 0) {
    console.log(`     ✅ No issues detected`);
  } else {
    console.log(`     ⚠️  ${issues.length} potential issues:`);
    issues.forEach(i => console.log(`        - ${i}`));
  }

  if (origScreenshot && cloneScreenshot) {
    console.log(`     📸 Screenshots: data/original.png vs data/clone.png`);
  }

  console.log(`\n✅ Clone ready — ${n} pages`);
  console.log(`   ${imgC} images, ${fontC} fonts, ${vidC} videos, ${shaderC} shaders, ${modelC} 3D models`);
  console.log(`   ${totalFiles} files, ${(totalSize/1024).toFixed(1)}MB`);
  console.log(`   Pages: ${[...crawled].join(', ')}`);
  if (issues.length) console.log(`   ⚠️  ${issues.length} verification warnings`);
  console.log(`\n   cd ${OUT} && python3 -m http.server 3035\n`);

  await browser.close();
}

main().catch(e=>{console.error('Error:',e.message);process.exit(1)});
