/**
 * Nullecho — Chrome Web Store screenshot generator.
 *
 * Produces the five 1280×800 screenshots named in docs/store/SCREENSHOT-PLAN.md, plus the
 * optional 440×280 small promotional tile, from a REAL unpacked install driven by Puppeteer
 * against Chrome for Testing — the same pattern harness/unpacked-chrome.mjs and
 * harness/site-bisect.mjs already use. Nothing here fabricates a number: every count in the
 * output images is what the extension's own popup or options page rendered from a real page
 * load in this run.
 *
 *   node harness/store-screenshots.mjs                 # all five + the promo tile
 *   node harness/store-screenshots.mjs 1 2              # just the popup shots (fast iteration)
 *   node harness/store-screenshots.mjs --headful         # watch it happen
 *
 * Options
 *   --puppeteer <dir>  a directory whose node_modules holds puppeteer (default: repo root's
 *                      sibling ~/bodybuilding, also read from $NULLECHO_PUPPETEER_DIR)
 *   --headful          non-headless Chrome for Testing (headless "new" otherwise)
 *
 * WHY chrome.action.openPopup() INSTEAD OF NAVIGATING TO THE POPUP URL. SCREENSHOT-PLAN.md's
 * own "popup's per-tab data problem" section explains why Puppeteer cannot just `page.goto()`
 * the popup's chrome-extension:// URL as an ordinary tab: `chrome.tabs.query({active:true,
 * currentWindow:true})` would then return the popup tab itself, not the site behind it, and
 * the plan calls for a human clicking the real toolbar icon instead. Automating that click is
 * possible without a human: MV3's `chrome.action.openPopup()` (called from the background
 * service worker, which is a real extension context, not a page) opens the actual native
 * browser-action popup surface — which Chrome does not count as a tab — so `tabs.query` inside
 * it resolves the SAME way a real click would. This was verified directly against Chrome for
 * Testing 149 before writing this script: the popup target's own `chrome.tabs.query` correctly
 * reports the site tab, with real blocked/fingerprint counts. The plan's caution is honored,
 * not routed around: this is the automatable equivalent of the exact click it asks for, not a
 * shortcut that reintroduces the bug it warns about.
 *
 * COMPOSITING. The real popup surface is a fixed 360px-wide column, and its "What this site
 * sees" persona card sits far enough below the stats that no single 1280×800-safe crop
 * contains both without also containing several hundred pixels of the report panel between
 * them. Chrome also caps a real action-popup window's own height (well under the ~1800px this
 * page's full content needs), so unlike an ordinary tab, `page.screenshot({fullPage:true})` on
 * a popup target cannot actually grow the window to fit — verified directly: it comes back
 * tiling the same capped-height view two or three times top to bottom instead. So each popup
 * shot is built from TWO ordinary (viewport-only) screenshots taken at two real scroll
 * positions of the one popup surface — exactly what a person scrolling and taking two
 * screenshots would produce — and harness/tools/compose.py pastes verbatim crops of both onto
 * a flat-color canvas. It crops and repositions real pixels; it never draws over or alters any
 * of them. See that file's header for the exact contract.
 *
 * TRAPS carried over from unpacked-chrome.mjs / site-bisect.mjs:
 *   - Chrome writes `ext/_metadata/` into an unpacked directory when it loads it. This script
 *     never loads the repo's own `ext/` — it loads a temp copy — and still removes
 *     `ext/_metadata/` defensively at both start and end in case a prior run left one.
 *   - Puppeteer passes --disable-extensions by default; stripped via ignoreDefaultArgs.
 *   - A fresh profile is a first install, and the extension opens its options page on install,
 *     in front of whatever tab is active. Closed before any measurement, every run.
 *   - A hidden tab gets no rAF/timers throttled normally and some sites won't fire the
 *     requests Nullecho would block. Every measured page is bringToFront()'d and its
 *     visibilityState asserted 'visible' before capture.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EXT_SRC = path.join(REPO, 'ext');
const OUT_DIR = path.join(REPO, 'docs/store/screenshots');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-store-shots-'));

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── arguments ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const HEADFUL = flag('--headful');
const requested = argv.filter((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--puppeteer');
const ALL = ['1', '2', '3', '4', '5', 'promo'];
const SHOTS = requested.length ? requested : ALL;

const log = (...a) => console.log('[store-shots]', ...a);

// ── puppeteer, without a dependency in this repo ────────────────────────────
function loadPuppeteer() {
  const tried = [];
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  for (const dir of [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR, '/Users/jasonluker/bodybuilding'].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); }
    catch (e) { tried.push(`${dir} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; '));
  process.exit(2);
}
const puppeteer = loadPuppeteer();

// ── a temp copy of ext/, so Chrome's own _metadata/ never lands in the repo ──
function makeTempExtCopy() {
  const dest = path.join(SCRATCH, 'ext');
  fs.cpSync(EXT_SRC, dest, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|_metadata)(?:[\\/]|$)/.test(src),
  });
  return dest;
}

// ── a tiny static server, for the local price-disclosure fixture (must be
// http/https — the pricing content scripts' `matches` list excludes file://) ──
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const filePath = path.join(rootDir, reqPath);
    if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// ── PNG dimension check, exactly the way the deliverable spec asks for ─────
function checkDims(pngPath, wantW, wantH) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', pngPath], { encoding: 'utf8' });
  const w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]);
  const h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]);
  if (w !== wantW || h !== wantH) {
    throw new Error(`${pngPath}: got ${w}x${h}, want ${wantW}x${wantH}`);
  }
  log(`  sips confirms ${path.basename(pngPath)} is ${w}x${h}`);
}

function compose(spec) {
  const specPath = path.join(SCRATCH, `spec-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2));
  execFileSync('python3', [path.join(HERE, 'tools', 'compose.py'), specPath], { stdio: 'inherit' });
}

// ── browser plumbing ─────────────────────────────────────────────────────
async function launch(extDir) {
  const profile = path.join(SCRATCH, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-first-run', '--no-default-browser-check',
      `--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`,
      '--window-size=1280,900',
    ],
    userDataDir: profile,
  });
  const version = await browser.version();
  log('chrome', version);
  const sw = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15000 });
  const extId = new URL(sw.url()).host;
  log('extension id', extId);
  // trap: first-run install opens options.html over whatever tab is active
  for (const p of await browser.pages()) {
    if (p.url() === 'about:blank' || /^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});
  }
  return { browser, sw, extId };
}

async function openRealPopup(browser, sw) {
  const worker = await sw.worker();
  const res = await worker.evaluate(async () => {
    try { await chrome.action.openPopup(); return { ok: true }; }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  if (!res.ok) throw new Error('chrome.action.openPopup() failed: ' + res.error);
  const target = await browser.waitForTarget((t) => t.url().includes('/popup/popup.html'), { timeout: 8000 });
  const popupPage = await target.asPage();
  await popupPage.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await popupPage.waitForFunction(() => document.getElementById('wrap') && !document.getElementById('wrap').hidden, { timeout: 8000 });
  await popupPage.waitForFunction(() => document.getElementById('site')?.textContent && document.getElementById('site').textContent !== '—', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  return popupPage;
}

/** Real-page settle recipe shared by screenshots 1 and 2: scroll to trigger lazy trackers. */
async function settlePage(page, { scrolls = 6, scrollWaitMs = 1000, finalWaitMs = 3000 } = {}) {
  for (let i = 0; i < scrolls; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * 700).catch(() => {});
    await new Promise((r) => setTimeout(r, scrollWaitMs));
  }
  await new Promise((r) => setTimeout(r, finalWaitMs));
}

async function getRect(page, sel) {
  return page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
  }, sel);
}

/**
 * Two real, viewport-only screenshots of the SAME real popup: one at scroll 0 (header + stats),
 * one scrolled so the element `elExpr` (a JS expression string, e.g.
 * `"document.getElementById('persona').closest('.panel')"`, so a panel can be targeted by an
 * inner id) evaluates to sits at the top of the popup's own internal scroll port. Both are
 * genuine renders of the live popup, just like a person scrolling it by hand and taking two
 * screenshots — see the file header for why `fullPage` cannot be used here.
 */
async function capturePopupCrops(popupPage, elExpr, tag) {
  const statsRect = await getRect(popupPage, '.stats');
  if (!statsRect) throw new Error(`${tag}: could not locate .stats`);
  const pathA = path.join(SCRATCH, `${tag}-popup-A.png`);
  await popupPage.screenshot({ path: pathA });

  await popupPage.evaluate(`(${elExpr})?.scrollIntoView({ block: 'start' })`);
  await new Promise((r) => setTimeout(r, 350));
  const lowerRect = await popupPage.evaluate(`(() => {
    const e = ${elExpr};
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) };
  })()`);
  if (!lowerRect) throw new Error(`${tag}: could not locate element for ${elExpr}`);
  const pathB = path.join(SCRATCH, `${tag}-popup-B.png`);
  await popupPage.screenshot({ path: pathB });

  return {
    pathA,
    cropABottom: statsRect.bottom + 10,
    pathB,
    cropBTop: Math.max(0, lowerRect.top),
    cropBBottom: Math.max(Math.max(0, lowerRect.top) + 10, lowerRect.bottom),
  };
}

/**
 * Stack two real crops (header+stats, then a lower panel — from two different real popup
 * screenshots, see capturePopupCrops) into the right-hand panel of a 1280x800 canvas, next to a
 * real screenshot of the site tab on the left. Every pixel is untouched; only crop bounds, a
 * uniform scale-to-fit, and paste position are computed.
 */
function composePopupShot({ sitePng, popupPngA, cropABottom, popupPngB, cropBTop, cropBBottom, outPng, label }) {
  const PANEL_X = 820, PANEL_W = 460, GAP = 16, MARGIN = 32;
  const aH = cropABottom; // crop A is always [0, cropABottom]
  const bH = cropBBottom - cropBTop;
  const naturalTotalH = aH + GAP + bH;
  const availH = 800 - 2 * MARGIN;
  const scale = Math.min(1, availH / naturalTotalH, (PANEL_W - 2 * MARGIN) / 360);
  const contentW = 360 * scale;
  const x = Math.round(PANEL_X + (PANEL_W - contentW) / 2);
  const totalHScaled = naturalTotalH * scale;
  const startY = Math.round((800 - totalHScaled) / 2);

  compose({
    canvas: [1280, 800],
    bg: '#ffffff',
    out: outPng,
    paste: [
      { src: sitePng, x: 0, y: 0 }, // left context panel: real site-tab screenshot, cropped to 820 wide
      { src: popupPngA, cropTop: 0, cropBottom: cropABottom, x, y: startY, scale },
      { src: popupPngB, cropTop: cropBTop, cropBottom: cropBBottom, x, y: Math.round(startY + aH * scale + GAP * scale), scale },
    ],
  });
  log(`composed ${label} -> ${outPng} (scale ${scale.toFixed(3)})`);
  // Returned so a caller (the promo tile) can crop exactly where content landed in the
  // FINISHED image, rather than guessing. `stack*` is the whole header+lower-panel block
  // (they sit directly adjacent in the finished image, just like in the real popup); `header*`
  // is header+stats alone, in case a caller wants just that.
  return {
    headerX: x, headerY: startY, headerW: Math.round(contentW), headerH: Math.round(aH * scale),
    stackX: x, stackY: startY, stackW: Math.round(contentW), stackH: Math.round(totalHScaled),
  };
}

// ── main ─────────────────────────────────────────────────────────────────
async function main() {
  fs.rmSync(path.join(EXT_SRC, '_metadata'), { recursive: true, force: true }); // defensive, before

  const extDir = makeTempExtCopy();
  const { server, port } = await startStaticServer(REPO);
  const fixtureUrl = `http://127.0.0.1:${port}/harness/fixtures/pricing-disclosure.html`;

  const { browser, sw, extId } = await launch(extDir);
  const readme = [];
  let shot1HeaderLayout = null; // filled in by shot 1, consumed by the promo tile

  try {
    // ── Screenshots 1 & 2: real popup, real per-tab data ──────────────────
    if (SHOTS.includes('1')) {
      log('shot 1: popup on a real news site (blocking + persona)');
      // si.com/nba: real trials against several US outlets (usatoday.com, billboard.com,
      // apnews.com, weather.com — see harness/store-screenshots.mjs git history / dev notes)
      // found this one gives strong, honest blocked/fingerprint counts with no anti-adblock
      // interstitial covering the page and no IP-geolocated content (weather.com's local
      // forecast page resolves to the crawling machine's real-world location, which has no
      // business in a public store screenshot).
      const url = process.env.NULLECHO_SHOT1_URL || 'https://www.si.com/nba';
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await page.bringToFront();
      const vis1 = await page.evaluate(() => document.visibilityState);
      if (vis1 !== 'visible') throw new Error('site tab not visible before capture: ' + vis1);
      await settlePage(page);

      const sitePngRaw = path.join(SCRATCH, 'shot1-site-raw.png');
      await page.screenshot({ path: sitePngRaw });

      const popupPage = await openRealPopup(browser, sw);
      const stats = await popupPage.evaluate(() => ({
        site: document.getElementById('site').textContent,
        blocked: document.getElementById('stat-blocked').textContent,
        fp: document.getElementById('stat-fp').textContent,
      }));
      log('  real popup stats', stats);
      // persona's own panel (heading + kv + note) is the enclosing <section class="panel">
      const crops = await capturePopupCrops(popupPage, "document.getElementById('persona')?.closest('.panel')", 'shot1');
      await popupPage.close();

      // left context panel: the real site screenshot, windowed to 820x800
      const siteCroppedSpec = path.join(SCRATCH, 'shot1-site-cropped.png');
      compose({ canvas: [820, 800], bg: '#ffffff', out: siteCroppedSpec, paste: [{ src: sitePngRaw, x: 0, y: 0 }] });

      const out1 = path.join(OUT_DIR, '01-popup-blocking-persona.png');
      shot1HeaderLayout = composePopupShot({
        sitePng: siteCroppedSpec,
        popupPngA: crops.pathA,
        cropABottom: crops.cropABottom,
        popupPngB: crops.pathB,
        cropBTop: crops.cropBTop,
        cropBBottom: crops.cropBBottom,
        outPng: out1,
        label: 'shot 1',
      });
      checkDims(out1, 1280, 800);
      readme.push({
        file: '01-popup-blocking-persona.png',
        what: `Toolbar popup on ${stats.site} — ${stats.blocked} requests blocked, ${stats.fp} fingerprint reads seen, and the "What this site sees" device persona (system, graphics, CPU/RAM, display).`,
        state: `Real load of ${url} in Chrome for Testing with the unpacked extension; popup opened via chrome.action.openPopup() after settling/scrolling the page for several seconds so trackers actually fired.`,
        cmd: 'node harness/store-screenshots.mjs 1',
      });
      await page.close();
    }

    if (SHOTS.includes('2')) {
      log('shot 2: popup with the price-disclosure panel (local fixture)');
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto(fixtureUrl, { waitUntil: 'load', timeout: 30000 });
      await page.bringToFront();
      const vis2 = await page.evaluate(() => document.visibilityState);
      if (vis2 !== 'visible') throw new Error('fixture tab not visible before capture: ' + vis2);
      // pricing-scan.js runs at document_idle, then again 3s later; give it margin.
      await new Promise((r) => setTimeout(r, 5000));

      const sitePngRaw = path.join(SCRATCH, 'shot2-site-raw.png');
      await page.screenshot({ path: sitePngRaw });

      const popupPage = await openRealPopup(browser, sw);
      await popupPage.waitForFunction(() => document.getElementById('pricing-panel') && !document.getElementById('pricing-panel').hidden, { timeout: 8000 });
      const card = await popupPage.evaluate(() => ({
        headline: document.getElementById('pricing-headline').textContent,
        price: document.getElementById('pricing-price').textContent,
        quote: document.getElementById('pricing-quote').textContent,
      }));
      log('  real pricing card', card);
      const crops = await capturePopupCrops(popupPage, "document.getElementById('pricing-panel')", 'shot2');
      await popupPage.close();

      const siteCroppedSpec = path.join(SCRATCH, 'shot2-site-cropped.png');
      compose({ canvas: [820, 800], bg: '#ffffff', out: siteCroppedSpec, paste: [{ src: sitePngRaw, x: 0, y: 0 }] });

      const out2 = path.join(OUT_DIR, '02-popup-price-disclosure.png');
      composePopupShot({
        sitePng: siteCroppedSpec,
        popupPngA: crops.pathA,
        cropABottom: crops.cropABottom,
        popupPngB: crops.pathB,
        cropBTop: crops.cropBTop,
        cropBBottom: crops.cropBBottom,
        outPng: out2,
        label: 'shot 2',
      });
      checkDims(out2, 1280, 800);
      readme.push({
        file: '02-popup-price-disclosure.png',
        what: `Toolbar popup showing the price-disclosure panel: "${card.headline}" and the published price (${card.price}).`,
        state: `Local fixture page (harness/fixtures/pricing-disclosure.html, served over http:// — file:// is excluded by the content script's matches list) carrying the exact N.Y. Gen. Bus. Law § 349-a sentence and a schema.org Offer with a machine-readable price. No live retailer page reliably carries both without a login (research/NY-349A-COMPLIANCE-SWEEP.md); this stands in rather than misrepresenting a real business.`,
        cmd: 'node harness/store-screenshots.mjs 2',
      });
      await page.close();
    }

    // ── Screenshots 3 & 4: options page, fully automated, no per-tab data ──
    if (SHOTS.includes('3') || SHOTS.includes('4')) {
      for (const [num, hash, sectionId, file, whatText] of [
        ['3', '#blocking', 'blocking', '03-options-blocking-gpc.png', 'Options page — blocking-category toggles (ads, analytics, social, fingerprinting) and the Global Privacy Control section, light mode.'],
        ['4', '#limits', 'limits', '04-options-limits.png', 'Options page — "What Nullecho can’t do": the honesty/limits section (detectability, Firefox/Brave being stronger, IP/TLS out of reach, WASM fingerprinting, etc.), light mode.'],
      ]) {
        if (!SHOTS.includes(num)) continue;
        log(`shot ${num}: options page ${hash}`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
        await page.goto(`chrome-extension://${extId}/options/options.html${hash}`, { waitUntil: 'load', timeout: 15000 });
        await page.bringToFront();
        await page.waitForFunction(() => document.getElementById('category-toggles')?.children.length > 0, { timeout: 8000 });
        await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'start' }), sectionId);
        await new Promise((r) => setTimeout(r, 400));
        const vis = await page.evaluate(() => document.visibilityState);
        if (vis !== 'visible') throw new Error(`options ${hash} tab not visible: ${vis}`);
        const out = path.join(OUT_DIR, file);
        await page.screenshot({ path: out });
        checkDims(out, 1280, 800);
        readme.push({
          file,
          what: whatText,
          state: `chrome-extension://<id>/options/options.html${hash} in the same running install, light mode forced via emulateMediaFeatures.`,
          cmd: `node harness/store-screenshots.mjs ${num}`,
        });
        await page.close();
      }
    }

    // ── Screenshot 5: nullecho.org/prove-it, post-check ────────────────────
    if (SHOTS.includes('5')) {
      log('shot 5: nullecho.org/prove-it, fingerprint check run');
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto('https://nullecho.org/prove-it/', { waitUntil: 'load', timeout: 30000 });
      await page.bringToFront();
      await page.waitForSelector('#run', { timeout: 15000 });
      await page.click('#run');
      await page.waitForFunction(() => {
        const out = document.getElementById('out');
        return out && !out.hidden && document.getElementById('rows')?.children.length > 0 && document.getElementById('verdict')?.textContent?.trim();
      }, { timeout: 15000 });
      // The hero number, table and verdict all live below the fold at scroll 0 — bring the
      // populated #out block into frame so the post-click state is what's actually captured.
      await page.evaluate(() => document.getElementById('out').scrollIntoView({ block: 'start' }));
      await new Promise((r) => setTimeout(r, 200));
      const vis = await page.evaluate(() => document.visibilityState);
      if (vis !== 'visible') throw new Error('prove-it tab not visible: ' + vis);
      await new Promise((r) => setTimeout(r, 500));
      const out = path.join(OUT_DIR, '05-prove-it-fingerprint-check.png');
      await page.screenshot({ path: out });
      checkDims(out, 1280, 800);
      readme.push({
        file: '05-prove-it-fingerprint-check.png',
        what: 'nullecho.org/prove-it after clicking "Show me my fingerprint" — the hero fingerprint value and the per-API results table, measured live with the extension installed and on.',
        state: 'https://nullecho.org/prove-it/ (the live site named in this listing’s "Notes to reviewer"), #run clicked, waited for #out/#rows/#verdict to populate.',
        cmd: 'node harness/store-screenshots.mjs 5',
      });
      await page.close();
    }

    // ── Optional: 440x280 small promotional tile ───────────────────────────
    if (SHOTS.includes('promo')) {
      const src1 = path.join(OUT_DIR, '01-popup-blocking-persona.png');
      if (!fs.existsSync(src1) || !shot1HeaderLayout) {
        log('promo: skipped — needs a fresh shot 1 in the SAME run (its header position must be known exactly); run: node harness/store-screenshots.mjs 1 promo');
      } else {
        log('promo: 440x280 tile cropped from screenshot 1\'s popup stack');
        // Crop the WHOLE header+stats+persona stack composePopupShot placed in the finished
        // image (returned as shot1HeaderLayout.stack*) — header and lower panel sit directly
        // adjacent there, same as in the real popup, so this is one contiguous rectangle, not a
        // stitch. Scaled down further only if it doesn't already fit 440x280; the two numbers
        // stay legible even shrunk, matching SCREENSHOT-PLAN.md's own recommendation for this
        // tile. A fixed guess at the crop rectangle would miss whenever the stack's height (and
        // so its vertical centering) shifts with real content, so this uses the exact rectangle
        // that run actually drew.
        const { stackX, stackY, stackW, stackH } = shot1HeaderLayout;
        const out = path.join(OUT_DIR, 'promo-440x280.png');
        const fitScale = Math.min(1, 440 / stackW, 280 / stackH);
        const finalW = Math.round(stackW * fitScale);
        const finalH = Math.round(stackH * fitScale);
        compose({
          canvas: [440, 280], bg: '#ffffff', out,
          paste: [{
            src: src1,
            cropLeft: stackX, cropTop: stackY, cropRight: stackX + stackW, cropBottom: stackY + stackH,
            scale: fitScale,
            x: Math.round((440 - finalW) / 2), y: Math.round((280 - finalH) / 2),
          }],
        });
        checkDims(out, 440, 280);
        readme.push({
          file: 'promo-440x280.png',
          what: 'Small promotional tile — cropped from Screenshot 1’s popup header + blocked/fingerprint counts at reduced size.',
          state: 'Crop of docs/store/screenshots/01-popup-blocking-persona.png (same run), no new capture.',
          cmd: 'node harness/store-screenshots.mjs 1 promo',
        });
      }
    }
  } finally {
    await browser.close().catch(() => {});
    server.close();
    fs.rmSync(path.join(EXT_SRC, '_metadata'), { recursive: true, force: true }); // defensive, after
    if (!process.env.NULLECHO_KEEP_SCRATCH) fs.rmSync(SCRATCH, { recursive: true, force: true });
    else log('kept scratch dir at', SCRATCH);
  }

  if (readme.length) {
    const readmePath = path.join(OUT_DIR, 'README.md');
    const today = new Date().toISOString().slice(0, 10);

    // Merge onto any existing README so a partial run (e.g. `... 1 promo`) doesn't wipe out
    // the bullets for images it didn't touch, as long as those images still exist on disk.
    const existing = new Map(); // file -> full bullet line
    if (fs.existsSync(readmePath)) {
      for (const line of fs.readFileSync(readmePath, 'utf8').split('\n')) {
        const m = /^- `([^`]+)` — /.exec(line);
        if (m && fs.existsSync(path.join(OUT_DIR, m[1]))) existing.set(m[1], line);
      }
    }
    for (const r of readme) {
      existing.set(r.file, `- \`${r.file}\` — ${r.what} Captured ${today} from: ${r.state} Reproduce: \`${r.cmd}\``);
    }
    const order = ['01-popup-blocking-persona.png', '02-popup-price-disclosure.png', '03-options-blocking-gpc.png', '04-options-limits.png', '05-prove-it-fingerprint-check.png', 'promo-440x280.png'];
    const bulletFiles = [...existing.keys()].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    const lines = [
      '# Nullecho — Chrome Web Store screenshots',
      '',
      'One line per image: what it shows, the URL/state it was captured from, the capture date, and the command that reproduces it. See `docs/store/SCREENSHOT-PLAN.md` for the full plan and `harness/store-screenshots.mjs` for the capture script.',
      '',
      ...bulletFiles.map((f) => existing.get(f)),
      '',
    ];
    fs.writeFileSync(readmePath, lines.join('\n'));
    log('wrote', readmePath);
  }

  log('done:', readme.map((r) => r.file).join(', '));
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
