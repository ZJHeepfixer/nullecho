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
 * sees" persona card sits far enough below the stats (~1150px of real document, even at the
 * enlarged 1440×900 screen) that no single viewport-sized crop contains both without also
 * containing the report panel between them. Chrome also caps a real action-popup window's own
 * height at 600px regardless of screen size (measured directly at three different screen
 * heights, incl. 3200px tall — still 600) — so unlike an ordinary tab,
 * `page.screenshot({fullPage:true})` on a popup target cannot actually grow the window to fit;
 * it comes back tiling the same capped-height view two or three times top to bottom instead
 * (verified directly). An earlier version of screenshot 1 reconstructed the WHOLE popup by
 * stitching real, zero-gap scroll slices (`window.scrollTo(0,0)`, `(0,600)`, …) into one tall
 * image — genuinely seamless, but the ~1300px result had to shrink so much to fit 1280×800 that
 * the body text went illegible at store size (director review, 2026-09-24, third pass).
 * Screenshot 1 is now built by captureTwoPopupViews(): exactly two real, ONE-VIEWPORT
 * screenshots — the popup as it opens, and the same popup scrolled so the persona card sits at
 * the bottom of the viewport — shown SIDE BY SIDE, scaled UP (not down) so store-size text stays
 * readable. Neither panel is itself a composite; compose.py places each real screenshot once,
 * scaled, with a real gap between the two panels because they are two separate moments, not one
 * continuous view. See that file's header for compose.py's exact contract, and see
 * composePopupShot() (screenshot 2, unchanged, approved — two crops with a real white-on-white
 * gap, invisible because its canvas IS the popup's own white, #ffffff) vs.
 * composeTwoPopupViewsSideBySide() (screenshot 1, below).
 *
 * SCREEN. Chrome for Testing's headless "new" mode gives every target (ordinary tabs AND the
 * extension popup surface) a virtual screen fixed at 800×600 @1x, independent of
 * `--window-size` or `page.setViewport()` — verified directly, and it made both the popup's
 * honest Display row and the prove-it page's honest Screen row read "800×600", which looks
 * broken in a store screenshot even though it's a true reading. `page.setViewport()`/CDP
 * `Emulation.setDeviceMetricsOverride` can restyle an ORDINARY page's screen (used for
 * screenshot 5), but the popup target refuses that CDP call outright ("Target does not support
 * metrics override" — verified directly), so screenshot 1 needs the fix at the BROWSER level
 * instead: the launch flag `SCREEN_INFO_FLAG` below (`--screen-info=...`), which every target
 * inherits at creation, including the popup. Chrome's `--screen-info` syntax takes PHYSICAL
 * pixels plus a devicePixelRatio, and JS's `screen.width/height` reports the LOGICAL (physical
 * ÷ dpr) size — verified empirically (asking for logical 1440×900 directly under-reports as
 * 720×450 @2x; doubling to 2880×1800 physical @2x correctly reads back as 1440×900 @2x). The
 * popup, opened with this flag active, is verified (openRealPopup()) to report exactly
 * screen.width=1440, screen.height=900, devicePixelRatio=2 before any capture proceeds.
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

// Gives EVERY target in the browser (ordinary tabs and the extension popup surface alike) a
// realistic screen instead of headless Chrome for Testing's fixed 800x600 default — see the
// file header's "SCREEN" section for the physical-vs-logical-pixel reasoning and how this was
// verified. Logical (JS-visible) result: screen.width=1440, screen.height=900,
// devicePixelRatio=2 — a real MacBook-class Retina panel. openRealPopup() asserts this exactly
// on the popup target before any shot-1 capture proceeds.
const SCREEN_INFO_FLAG = '--screen-info={0,0 2880x1800 devicePixelRatio=2}';
const EXPECTED_SCREEN = { w: 1440, h: 900, dpr: 2 };

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
      SCREEN_INFO_FLAG,
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

  // Director review (2026-09-24): verify the SCREEN_INFO_FLAG launch flag actually reached this
  // popup target — required before any capture, not just hoped for, since the popup target
  // rejects a later per-target CDP override outright, so this is the only point the value can
  // still be caught wrong.
  const screen = await popupPage.evaluate(() => ({ w: screen.width, h: screen.height, dpr: devicePixelRatio }));
  if (screen.w !== EXPECTED_SCREEN.w || screen.h !== EXPECTED_SCREEN.h || screen.dpr !== EXPECTED_SCREEN.dpr) {
    throw new Error(`popup screen is ${screen.w}x${screen.h} @${screen.dpr}x, expected ${EXPECTED_SCREEN.w}x${EXPECTED_SCREEN.h} @${EXPECTED_SCREEN.dpr}x — SCREEN_INFO_FLAG did not take effect on the popup target`);
  }
  log(`  popup screen verified: ${screen.w}×${screen.h} @${screen.dpr}x`);

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
  // The popup's own devicePixelRatio (2, since SCREEN_INFO_FLAG — see the file header's
  // "SCREEN" section) means popupPage.screenshot() captures at PHYSICAL pixel resolution
  // (e.g. 720px wide, not the 360 CSS/logical px getBoundingClientRect() reports). Every crop
  // bound below is measured in logical px and returned in logical px (unchanged contract); the
  // caller (composePopupShot) is responsible for multiplying by `dpr` before handing bounds to
  // compose.py, which crops the real (physical-resolution) source file.
  const dpr = await popupPage.evaluate(() => devicePixelRatio);
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
    dpr,
  };
}

/**
 * Stack two real crops (header+stats, then a lower panel — from two different real popup
 * screenshots, see capturePopupCrops) into the right-hand panel of a 1280x800 canvas, next to a
 * real screenshot of the site tab on the left. Every pixel is untouched; only crop bounds, a
 * uniform scale-to-fit, and paste position are computed.
 *
 * `dpr` (default 1): the popup's devicePixelRatio at capture time. Crop bounds passed in here
 * (cropABottom etc.) are logical px, matching getBoundingClientRect(); compose.py crops the
 * REAL screenshot file, which is `dpr`x that size, so bounds are scaled up by `dpr` and the
 * paste scale is divided by it before reaching compose.py. At dpr=1 this is a no-op.
 */
function composePopupShot({ sitePng, popupPngA, cropABottom, popupPngB, cropBTop, cropBBottom, outPng, label, dpr = 1 }) {
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
  const pasteScale = scale / dpr;

  compose({
    canvas: [1280, 800],
    bg: '#ffffff',
    out: outPng,
    paste: [
      { src: sitePng, x: 0, y: 0 }, // left context panel: real site-tab screenshot, cropped to 820 wide
      { src: popupPngA, cropTop: 0, cropBottom: cropABottom * dpr, x, y: startY, scale: pasteScale },
      { src: popupPngB, cropTop: cropBTop * dpr, cropBottom: cropBBottom * dpr, x, y: Math.round(startY + aH * scale + GAP * scale), scale: pasteScale },
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

/**
 * Director review (2026-09-24), second pass: the first version of this composited TWO separate
 * crops (header+stats, then the persona panel) with a gap between them filled in the canvas's
 * own #f6f3ec — a color that does not match the popup's own white, so the gap read as a visible
 * band of foreign background, "cut and pasted." The fix (a version since replaced by the third
 * pass below) walked the popup's own scrollbar in exact, zero-gap steps and stitched every
 * slice into one tall reconstruction — genuinely seamless, but shrinking a ~1300px-tall
 * reconstruction down to fit 800px made the body text illegible at store size.
 *
 * Director review (2026-09-24), third pass: rather than reconstructing (and therefore shrinking)
 * the WHOLE popup, show it the way a user actually experiences it — one glance at a time.
 * captureTwoPopupViews() takes exactly two real, ONE-VIEWPORT screenshots of the live popup: the
 * page as it opens (scrollTop 0), and the same page scrolled so the target card sits at the
 * bottom of the viewport (`scrollIntoView({block:'end'})`, so the card is the last full thing
 * the user's eye lands on, not clipped). Neither image is itself a composite — each is a single
 * `popupPage.screenshot()` call, nothing stitched or cropped out of it beyond the viewport
 * Chrome itself already drew. composeTwoPopupViewsSideBySide() places both, scaled up to ~760px
 * tall (the whole point: bigger, not smaller, so store-size text stays readable), side by side
 * with a real gap — honest here, since these are two separate moments, not one continuous view.
 */
async function captureTwoPopupViews(popupPage, endSelExpr, tag) {
  // See capturePopupCrops's comment: the popup's devicePixelRatio is 2 (SCREEN_INFO_FLAG), so
  // popupPage.screenshot() captures at PHYSICAL resolution, not the CSS/logical px innerHeight
  // reports. Returned `dpr` and `viewportH` (logical) let the compose step convert correctly.
  const dpr = await popupPage.evaluate(() => devicePixelRatio);
  const viewportH = await popupPage.evaluate(() => innerHeight);
  const viewportW = await popupPage.evaluate(() => innerWidth);

  // Measured now (scroll is still 0), so a caller (the promo tile) can crop just the header+
  // stats lead-in of the LEFT panel without re-deriving it.
  const statsBottom = await popupPage.evaluate(() => {
    const r = document.querySelector('.stats')?.getBoundingClientRect();
    return r ? Math.ceil(r.bottom) : null;
  });
  const leftPath = path.join(SCRATCH, `${tag}-left.png`);
  await popupPage.screenshot({ path: leftPath });

  const scrolled = await popupPage.evaluate(`(() => {
    const e = ${endSelExpr};
    if (!e) return false;
    e.scrollIntoView({ block: 'end' });
    return true;
  })()`);
  if (!scrolled) throw new Error(`${tag}: could not locate element for ${endSelExpr}`);
  await new Promise((r) => setTimeout(r, 300));
  const rightPath = path.join(SCRATCH, `${tag}-right.png`);
  await popupPage.screenshot({ path: rightPath });

  log(`  ${tag}: two real single-viewport captures, ${viewportW}x${viewportH} logical, dpr ${dpr}`);
  return { leftPath, rightPath, viewportW, viewportH, dpr, statsBottom };
}

/**
 * Places captureTwoPopupViews()'s two REAL, single-viewport screenshots side by side on a plain
 * neutral canvas, each scaled up (uniformly, by the same factor) to ~`targetH` px tall. Neither
 * image is cropped — the whole real viewport Chrome drew is shown, at a size a store visitor can
 * actually read, with a genuine gap between them because they are two separate moments of the
 * same popup, not one continuous view.
 */
function composeTwoPopupViewsSideBySide({ leftPath, rightPath, viewportW, viewportH, dpr, outPng, label, bg = '#f6f3ec', targetH = 760, gap = 64 }) {
  const scale = targetH / viewportH;
  const panelW = Math.round(viewportW * scale);
  const panelH = Math.round(viewportH * scale);
  const totalW = panelW * 2 + gap;
  const startX = Math.round((1280 - totalW) / 2);
  const startY = Math.round((800 - panelH) / 2);
  const pasteScale = scale / dpr; // source files are `dpr`x viewportW/viewportH (physical px)

  compose({
    canvas: [1280, 800],
    bg,
    out: outPng,
    paste: [
      { src: leftPath, x: startX, y: startY, scale: pasteScale },
      { src: rightPath, x: startX + panelW + gap, y: startY, scale: pasteScale },
    ],
  });
  log(`composed ${label} side by side -> ${outPng} (panel ${panelW}x${panelH}, scale ${scale.toFixed(3)})`);
  return {
    leftX: startX, leftY: startY, panelW, panelH, bg,
    // for a caller (the promo tile) that wants just the header+stats lead-in of the LEFT panel
    scale,
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
      log('shot 1: popup on a real news site (blocking + persona), composed on a plain background');
      // si.com/nba gives strong, honest blocked/fingerprint counts with no anti-adblock
      // interstitial (tried against usatoday.com, billboard.com, apnews.com, weather.com first —
      // see git history). Which real site loads no longer affects what appears IN THE FRAME
      // (director review, 2026-09-23: the host page itself — its branding, article photos of
      // real people — must never be in a store screenshot, so it's captured for real data only
      // and then dropped; see captureTwoPopupViews's header comment). It's still a real
      // load with real trackers firing, not a fixture, because the counts must be real.
      const url = process.env.NULLECHO_SHOT1_URL || 'https://www.si.com/nba';
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
      await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      await page.bringToFront();
      const vis1 = await page.evaluate(() => document.visibilityState);
      if (vis1 !== 'visible') throw new Error('site tab not visible before capture: ' + vis1);
      await settlePage(page);
      // No screenshot of the site tab is taken — its content (SI branding, article photos of
      // real people) must never appear in a store screenshot. Only the popup, which describes
      // that page in numbers and a persona, is captured below.

      const popupPage = await openRealPopup(browser, sw);
      const stats = await popupPage.evaluate(() => ({
        site: document.getElementById('site').textContent,
        blocked: document.getElementById('stat-blocked').textContent,
        fp: document.getElementById('stat-fp').textContent,
      }));
      log('  real popup stats', stats);
      // persona's own panel (heading + kv + note) is the enclosing <section class="panel">
      const views = await captureTwoPopupViews(popupPage, "document.getElementById('persona')?.closest('.panel')", 'shot1');
      await popupPage.close();
      await page.close();

      const out1 = path.join(OUT_DIR, '01-popup-blocking-persona.png');
      shot1HeaderLayout = composeTwoPopupViewsSideBySide({
        leftPath: views.leftPath,
        rightPath: views.rightPath,
        viewportW: views.viewportW,
        viewportH: views.viewportH,
        dpr: views.dpr,
        outPng: out1,
        label: 'shot 1',
      });
      shot1HeaderLayout.statsBottomDocY = views.statsBottom; // for the promo tile's crop
      checkDims(out1, 1280, 800);
      readme.push({
        file: '01-popup-blocking-persona.png',
        what: `Two real, single-viewport captures of the toolbar popup side by side — LEFT: the popup as it opens (header, ${stats.blocked} requests blocked / ${stats.fp} fingerprint reads seen, the first report cards). RIGHT: the same load, scrolled so the "What this site sees" device persona (system, graphics, CPU/RAM, display, now reading the REAL screen — see below) sits at the bottom of the view. On a plain ${shot1HeaderLayout.bg} background, no third-party page content in frame; the popup's own small label still names the real site measured, ${stats.site}. Each panel is ONE unedited screenshot, scaled up (not down) to ~${shot1HeaderLayout.panelH}px tall so store-size text stays readable; the gap between them is real, since they are two separate moments of the same popup, not one continuous view.`,
        state: `Real load of ${url} in Chrome for Testing with the unpacked extension, settled/scrolled for several seconds so trackers actually fired; popup opened via chrome.action.openPopup(). The host page's own screenshot was discarded — only the popup (two real, unedited single-viewport captures of it — scrollTop 0, then \`scrollIntoView({block:'end'})\` on the persona card) was composited onto the plain background. Browser launched with \`${SCREEN_INFO_FLAG}\` so every target — including the popup, which refuses a later per-target CDP metrics override — reports a real screen (verified before capture: screen.width=${EXPECTED_SCREEN.w}, screen.height=${EXPECTED_SCREEN.h}, devicePixelRatio=${EXPECTED_SCREEN.dpr}), which is why the Display row no longer reads the headless default of 800×600.`,
        cmd: 'node harness/store-screenshots.mjs 1',
      });
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
        dpr: crops.dpr,
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
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      // Headless Chrome for Testing's virtual "screen" defaults to 800x600 regardless of
      // --window-size or setViewport — that's a property of the TEST BROWSER, not of Nullecho,
      // but the prove-it page reads and displays window.screen honestly, so the store screenshot
      // showed "Screen 800×600 @1x", which looks broken to a visitor. Director review
      // (2026-09-23): give this one capture a realistic screen. A raw CDP
      // Emulation.setDeviceMetricsOverride call sets `screenWidth`/`screenHeight` — which
      // Puppeteer's own setViewport() does not expose — to a real 1440x900 MacBook-class panel
      // at 2x (Retina), while width/height/scale stay 1280x800 @1x so the CAPTURED PNG is still
      // exactly 1280x800 (verified: page.screenshot() keeps using the dimensions from the
      // preceding setViewport() call, not the raw override, so the two combine safely).
      const cdp = await page.createCDPSession();
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1280, height: 800, deviceScaleFactor: 2, mobile: false,
        screenWidth: 1440, screenHeight: 900,
      });
      const screenCheck = await page.evaluate(() => ({ w: screen.width, h: screen.height, dpr: devicePixelRatio, colorDepth: screen.colorDepth }));
      log('  screen override in effect:', screenCheck);
      if (screenCheck.w !== 1440 || screenCheck.h !== 900) throw new Error('shot 5: screen override did not take effect: ' + JSON.stringify(screenCheck));
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
        state: `https://nullecho.org/prove-it/ (the live site named in this listing's "Notes to reviewer"), #run clicked, waited for #out/#rows/#verdict to populate. Screen row reads ${screenCheck.w}×${screenCheck.h} · ${screenCheck.dpr}x, ${screenCheck.colorDepth}-bit: this test browser's window was given a realistic screen via a raw CDP \`Emulation.setDeviceMetricsOverride\` call (screenWidth/screenHeight 1440×900, deviceScaleFactor 2 — a real MacBook-class Retina panel) instead of Chrome for Testing's headless default of 800×600 @1x, which looked broken. This is the TEST BROWSER's configuration; Nullecho itself reports the screen honestly either way (ext/options/options.html#limits: "Screen dimensions... are reported honestly"). The capture stayed at 1280×800 @1x for the output PNG.`,
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
        log('promo: 440x280 tile cropped from screenshot 1\'s LEFT panel header+stats');
        // The LEFT panel is the popup as it opens — header, stat tiles, first report cards —
        // exactly what SCREENSHOT-PLAN.md recommends for this tile (the two numbers, legible
        // even shrunk). Crops just header+stats (document rows 0..statsBottomDocY, converted
        // into the finished image's own pixel coordinates via leftX/leftY/scale) rather than
        // the whole panel, which also has the report-panel cards below and would shrink the
        // numbers more than needed. Uses the exact rectangle that run actually drew, not a
        // fixed guess.
        const { leftX, leftY, panelW, bg, scale, statsBottomDocY } = shot1HeaderLayout;
        const cropW = panelW;
        const cropH = Math.round(statsBottomDocY * scale) + Math.round(10 * scale); // + the same small pad capturePopupCrops used elsewhere
        const out = path.join(OUT_DIR, 'promo-440x280.png');
        const fitScale = Math.min(1, 440 / cropW, 280 / cropH);
        const finalW = Math.round(cropW * fitScale);
        const finalH = Math.round(cropH * fitScale);
        compose({
          canvas: [440, 280], bg, out,
          paste: [{
            src: src1,
            cropLeft: leftX, cropTop: leftY, cropRight: leftX + cropW, cropBottom: leftY + cropH,
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
