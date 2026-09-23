#!/usr/bin/env node
/**
 * Pre-release site smoke test. Tests THE STORE PACKAGE (`node ext/tools/package.mjs` →
 * `dist/nullecho-<version>-chrome.zip`, unzipped into a temp dir), not `ext/` — the packaging
 * step drops 21 dev-only files (tests, generators, docs) and a bug in that closure (a missing
 * file, a stray import) would never show up testing the source tree directly.
 *
 *   node harness/site-smoke.mjs                          # full run: OFF pass, then ON pass, 14 sites
 *   node harness/site-smoke.mjs --headful                # watch it (headless "new" otherwise)
 *   node harness/site-smoke.mjs --only youtube,maps       # just those sites (dev/debug)
 *   node harness/site-smoke.mjs --off                     # OFF pass only, no package/extension needed
 *   node harness/site-smoke.mjs --puppeteer /Users/jasonluker/bodybuilding
 *   npm run smoke   (from ext/ — see ext/package.json)
 *
 * Method, matching docs/BREAKAGE-TESTING.md + the 2026-09-20 hidden-tab lesson
 * (docs/breakage-runs/2026-09-20-unpacked-chrome-run1.md):
 *   - OFF pass runs FIRST, establishing each site's host baseline (real cores/mem/gpc, and
 *     whether the site works AT ALL without the extension). ON pass runs second and every
 *     comparison (persona != host cores, FAIL vs NOT-OURS) reads the OFF record for that site.
 *   - THE HIDDEN-TAB TRAP: a fresh profile is a first install, and the extension opens its
 *     options page over the test tab. Every site check opens a fresh page, fronts it, closes any
 *     chrome-extension:// pages, THEN navigates, and asserts document.visibilityState==='visible'
 *     before running the functional check.
 *   - `navigator.webdriver` is true under Puppeteer. A site that walls automation on that basis
 *     will do so in BOTH the ON and OFF pass — that's recorded as BLOCKED / NOT-OURS, never as a
 *     Nullecho failure. Chrome for Testing's headless UA also self-reports "HeadlessChrome",
 *     which some sites (Reddit, confirmed 2026-09-22) block on sight regardless of `webdriver`;
 *     it is stripped to "Chrome" on every page here, identically in both passes, so that trivial
 *     UA-sniffing doesn't manufacture false BLOCKED verdicts that would hide a real finding.
 *   - A site that fails ON but passes OFF is a FAIL and is re-run once (fresh page, same browser)
 *     before being reported, to rule out one-shot flakiness.
 *   - Attack-your-own-work: before trusting any PASS, the youtube and maps checks are proven to
 *     be able to FAIL (self-test section below), same principle as the memory note "tell agents
 *     to ATTACK their own work".
 *
 * Traps carried over from harness/site-bisect.mjs and harness/unpacked-chrome.mjs:
 *   1. Chrome for Testing, not branded Chrome — branded Chrome ignores --load-extension.
 *   2. Puppeteer's default --disable-extensions is stripped for the ON browser.
 *   3. `ext/_metadata/` is Chrome's own write-back for an unpacked dir it was pointed at; since
 *      this script never points Chrome at `ext/` itself (only at a temp unzip of the built
 *      package), `ext/_metadata/` should never appear — verified explicitly and reported.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EXT = path.join(REPO, 'ext');

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const HEADFUL = flag('--headful');
const OFF_ONLY = flag('--off');
const ONLY = (opt('--only', null) || '').split(',').filter(Boolean);
const MAX_RUNTIME_MS = Number(opt('--max-runtime', String(23 * 60 * 1000)));
const START = Date.now();
const elapsed = () => Date.now() - START;
const budgetLeft = () => MAX_RUNTIME_MS - elapsed();

let PUPPETEER_VERSION = null;
function loadPuppeteer() {
  const tried = [];
  const attempts = [
    () => createRequire(import.meta.url),
    ...[opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean).map((dir) => () => createRequire(path.join(path.resolve(dir), 'package.json'))),
  ];
  const labels = ['repo', ...[opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean)];
  for (let i = 0; i < attempts.length; i++) {
    try {
      const req = attempts[i]();
      const mod = req('puppeteer');
      try { PUPPETEER_VERSION = req('puppeteer/package.json').version; } catch { /* version is cosmetic-only */ }
      return mod;
    } catch (e) { tried.push(`${labels[i]} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; '));
  process.exit(2);
}
const puppeteer = loadPuppeteer();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Local date, not UTC — this repo stamps dates in Pacific (reference_build_stamp_vercel_cli),
// and `toISOString()` had already rolled to the next day at time-of-writing (7pm PDT run).
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ── 1. build the store package + unzip it into a temp dir ──────────────────
function buildAndUnpackChromePackage() {
  console.error('[site-smoke] building chrome package (node ext/tools/package.mjs)…');
  execFileSync('node', ['tools/package.mjs'], { cwd: EXT, stdio: 'inherit' });
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  const zipPath = path.join(REPO, 'dist', `nullecho-${manifest.version}-chrome.zip`);
  if (!fs.existsSync(zipPath)) throw new Error('package build did not produce ' + zipPath);
  const zipBytes = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-smoke-'));
  const unpackDir = path.join(work, 'ext-unpacked');
  fs.mkdirSync(unpackDir, { recursive: true });
  execFileSync('unzip', ['-q', zipPath, '-d', unpackDir]);
  if (!fs.existsSync(path.join(unpackDir, 'manifest.json'))) throw new Error('unzip did not produce manifest.json at the unpack root');
  return { version: manifest.version, zipPath, zipName: path.basename(zipPath), sha256, size: zipBytes.length, unpackDir, work };
}

// ── 2. browser launch / page setup ──────────────────────────────────────────
async function launchBrowser({ extDir, profile }) {
  const args = ['--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--window-size=1400,900'];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const browser = await puppeteer.launch({ headless: !HEADFUL, ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], args, userDataDir: profile });
  const version = await browser.version();
  return { browser, version };
}

/** Realistic desktop UA: Chrome for Testing self-reports "HeadlessChrome", which some sites
 *  (Reddit, confirmed 2026-09-22: 403 with it, 200 without) block on sight — nothing to do with
 *  Nullecho or with `navigator.webdriver` (still true either way). Applied identically to ON
 *  and OFF so it is a controlled variable, not a thumb on the scale. */
function desktopUA(cftVersion) {
  // cftVersion looks like "Chrome/149.0.7827.22"
  return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ${cftVersion} Safari/537.36`;
}

const consoleLineOf = (msg) => {
  const t = msg.text();
  return /Nullecho|Illegal invocation/.test(t) ? t.replace(/\s+/g, ' ').slice(0, 300) : null;
};

/** Fresh page, fronted, extension pages closed BEFORE navigation — the hidden-tab trap. */
async function freshPage(browser, ua) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  if (ua) await page.setUserAgent(ua);
  await page.bringToFront();
  for (const p of await browser.pages()) {
    if (p !== page && /^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});
  }
  const consoleLines = [];
  page.on('console', (msg) => { const l = consoleLineOf(msg); if (l) consoleLines.push(l); });
  return { page, consoleLines };
}

async function assertVisible(page) {
  let vis = await page.evaluate(() => document.visibilityState).catch(() => 'unknown');
  if (vis !== 'visible') {
    await page.bringToFront().catch(() => {});
    await sleep(300);
    vis = await page.evaluate(() => document.visibilityState).catch(() => 'unknown');
  }
  return vis;
}

async function dismissCookieBanner(page) {
  try {
    return await page.evaluate(() => {
      const sel = ['#onetrust-reject-all-handler', '[aria-label*="Reject all" i]', '[aria-label*="Decline" i]', 'button#truste-consent-required'];
      for (const s of sel) { const el = document.querySelector(s); if (el) { el.click(); return s; } }
      const btns = Array.from(document.querySelectorAll('button, a'));
      const m = btns.find((b) => /reject all|decline all|reject non-essential|disagree/i.test((b.textContent || '').trim()) && b.offsetParent !== null);
      if (m) { m.click(); return 'text-match'; }
      return null;
    });
  } catch { return null; }
}

/** Generic bot-wall detector, applied to every site before its functional check runs. Catches
 *  the case (measured 2026-09-22: nytimes.com, both ON and OFF, HTTP 403) that isn't specific
 *  to IRS's Akamai wall — any site can hand Puppeteer a wall page instead of real content, and
 *  reporting that as a plain functional FAIL would misattribute a bot-detection artifact to
 *  Nullecho. `navigator.webdriver` is true under Puppeteer either way (rules section, top of file). */
async function detectBotWall(page, httpStatus) {
  if (![401, 403, 429, 503].includes(httpStatus)) return null;
  const text = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 500) : '')).catch(() => '');
  const title = await page.title().catch(() => '');
  const wallPhrase = /access denied|pardon our interruption|request unsuccessful|unusual traffic|verify you are human|are you a robot|forbidden|reference #/i.test(text + ' ' + title);
  if (httpStatus === 403 || wallPhrase) return { evidence: `HTTP ${httpStatus} — ${title ? title + ' — ' : ''}${text.slice(0, 300)}`.trim() };
  return null;
}

async function probes(page) {
  return await page.evaluate(() => ({
    gpc: navigator.globalPrivacyControl,
    cores: navigator.hardwareConcurrency ?? null,
    mem: navigator.deviceMemory ?? null,
  })).catch(() => ({ gpc: undefined, cores: null, mem: null }));
}

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`timeout after ${ms}ms: ${label}`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// ── 3. the youtube + maps checks, reused verbatim from harness/site-bisect.mjs ─────────────
async function youtubeRun(page, { skipPlay = false } = {}) {
  await page.waitForSelector('video', { timeout: 20000 }).catch(() => null);
  if (!skipPlay) {
    await page.evaluate(() => { const v = document.querySelector('video'); if (v && v.paused) v.play().catch(() => {}); });
    await sleep(1500);
    const stillPaused = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.paused : true; });
    if (stillPaused) await page.click('.ytp-play-button').catch(() => {});
  }
  const a = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.currentTime : null; });
  await sleep(9000);
  const b = await page.evaluate(() => {
    const v = document.querySelector('video');
    let buffered = 0; try { for (let i = 0; i < v.buffered.length; i++) buffered += v.buffered.end(i) - v.buffered.start(i); } catch (_) {}
    return { currentTime: v ? v.currentTime : null, readyState: v ? v.readyState : null, buffered: Math.round(buffered * 10) / 10, paused: v ? v.paused : null };
  });
  const advanced = b.currentTime != null && a != null && b.currentTime - a > 1.5 && b.readyState >= 2;
  return { ok: advanced, detail: { from: a, ...b, skipPlay } };
}

async function mapsRun(page) {
  await page.waitForSelector('canvas', { timeout: 25000 }).catch(() => null);
  await sleep(4000);
  const before = page.url();
  const box = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  await page.mouse.move(box.w / 2, box.h / 2);
  await page.mouse.wheel({ deltaY: -600 });
  await sleep(1500);
  await page.mouse.wheel({ deltaY: -600 });
  await sleep(3000);
  const zoomBtn = await page.$('button[aria-label="Zoom in"]');
  if (zoomBtn) { await zoomBtn.click().catch(() => {}); await sleep(3000); }
  const after = page.url();
  const zoomOf = (u) => { const m = u.match(/@[-\d.]+,[-\d.]+,([\d.]+)z/); return m ? Number(m[1]) : null; };
  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length).catch(() => 0);
  const ok = zoomOf(after) != null && zoomOf(before) != null && zoomOf(after) > zoomOf(before);
  return { ok, detail: { zoomBefore: zoomOf(before), zoomAfter: zoomOf(after), canvases } };
}

// ── 4. per-site definitions ─────────────────────────────────────────────────
// Each `check(page, ctx)` runs AFTER navigation/settle/visibility-assert/cookie-dismiss (done
// generically in runSite). ctx = { withExtension, hostCores, hostMem, offGpc } — hostCores/mem/
// offGpc come from that same site's OFF-pass probes (undefined while building the OFF pass itself).
const SITES = [
  {
    key: 'example.com', n: 1, label: 'example.com', url: 'https://example.com/', settleMs: 2000,
    async check(page, ctx) {
      const title = await page.title();
      const loaded = /Example Domain/i.test(title);
      if (!ctx.withExtension) return { ok: loaded, detail: { title } };
      const reasons = [];
      if (ctx.probes.gpc !== true) reasons.push(`GPC expected true, got ${ctx.probes.gpc}`);
      if (ctx.hostCores != null && ctx.probes.cores === ctx.hostCores) reasons.push(`persona cores (${ctx.probes.cores}) equal host cores (${ctx.hostCores}) — no persona applied`);
      return { ok: loaded && reasons.length === 0, detail: { title }, reasons };
    },
  },
  {
    key: 'spotify', n: 2, label: 'open.spotify.com', url: 'https://open.spotify.com/', settleMs: 3500,
    async check(page, ctx) {
      const bodyLen = await page.evaluate(() => document.body.innerText.length).catch(() => 0);
      const loaded = bodyLen > 200;
      if (!ctx.withExtension) return { ok: loaded, detail: { bodyLen } };
      const reasons = [];
      if (ctx.probes.gpc !== undefined) reasons.push(`GPC expected undefined (shipped exception), got ${ctx.probes.gpc}`);
      if (ctx.hostCores != null && ctx.probes.cores === ctx.hostCores) reasons.push(`persona cores (${ctx.probes.cores}) equal host cores (${ctx.hostCores}) — persona not present`);
      return { ok: loaded && reasons.length === 0, detail: { bodyLen }, reasons };
    },
  },
  {
    key: 'recaptcha', n: 3, label: 'google.com/recaptcha/api2/demo', url: 'https://www.google.com/recaptcha/api2/demo', settleMs: 3000,
    async check(page) {
      const box = await page.evaluate(() => {
        const f = document.querySelector('iframe[src*="recaptcha"]');
        if (!f) return null;
        const r = f.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      return { ok: !!box && box.w > 0 && box.h > 0, detail: { box } };
    },
  },
  {
    key: 'hcaptcha', n: 4, label: 'accounts.hcaptcha.com/demo', url: 'https://accounts.hcaptcha.com/demo', settleMs: 3000,
    async check(page) {
      const box = await page.evaluate(() => {
        const f = document.querySelector('iframe[src*="hcaptcha"]');
        if (!f) return null;
        const r = f.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      return { ok: !!box && box.w > 0 && box.h > 0, detail: { box } };
    },
  },
  {
    key: 'turnstile', n: 5, label: 'demo.turnstile.workers.dev', url: 'https://demo.turnstile.workers.dev/', settleMs: 3000,
    async check(page, ctx) {
      if (ctx.httpStatus === 404) return { ok: false, skipped: true, skipReason: `page returned 404`, detail: {} };
      const box = await page.evaluate(() => {
        const f = document.querySelector('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]');
        if (f) { const r = f.getBoundingClientRect(); return { w: r.width, h: r.height, via: 'iframe' }; }
        const w = document.querySelector('.cf-turnstile, [class*="turnstile"]');
        if (w && w.children.length > 0) { const r = w.getBoundingClientRect(); return { w: r.width, h: r.height, via: 'widget-children' }; }
        return null;
      });
      return { ok: !!box && box.w > 0 && box.h > 0, detail: { box } };
    },
  },
  {
    key: 'amazon', n: 6, label: 'amazon.com (search "usb c cable")', url: 'https://www.amazon.com/s?k=usb+c+cable', settleMs: 3000,
    async check(page) {
      const count = await page.evaluate(() => document.querySelectorAll('div[data-component-type="s-search-result"]').length);
      return { ok: count > 0, detail: { resultCount: count } };
    },
  },
  {
    key: 'maps', n: 7, label: 'google.com/maps', url: 'https://www.google.com/maps/@35.6225,-117.6709,12z', settleMs: 0,
    async check(page) { return mapsRun(page); },
  },
  {
    key: 'osm', n: 8, label: 'openstreetmap.org', url: 'https://www.openstreetmap.org/#map=12/35.6225/-117.6709', settleMs: 4000,
    async check(page) {
      const info = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll('img.leaflet-tile'));
        return { total: tiles.length, loaded: tiles.filter((t) => t.complete && t.naturalWidth > 0).length };
      });
      return { ok: info.total > 0 && info.loaded > 0, detail: info };
    },
  },
  {
    key: 'youtube', n: 9, label: 'youtube.com/watch?v=jNQXAC9IVRw', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', settleMs: 0,
    async check(page) { return youtubeRun(page); },
  },
  {
    key: 'chartjs', n: 10, label: 'chartjs.org vertical bar sample', url: 'https://www.chartjs.org/docs/latest/samples/bar/vertical.html', settleMs: 1500,
    async check(page) {
      const info = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c || !c.width || !c.height) return null;
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let nonTransparent = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) nonTransparent++;
        return { w: c.width, h: c.height, nonTransparentPixels: nonTransparent };
      });
      return { ok: !!info && info.nonTransparentPixels > 0, detail: info };
    },
  },
  {
    key: 'nytimes', n: 11, label: 'nytimes.com', url: 'https://www.nytimes.com/', settleMs: 2500,
    async check(page) {
      const home = await page.evaluate(() => document.body.innerText.length > 500);
      const articleHref = await page.evaluate(() => {
        const a = document.querySelector('a[href*="/2025/"], a[href*="/2026/"]');
        return a ? a.href : null;
      });
      if (!articleHref) return { ok: false, detail: { home, articleHref: null }, reasons: ['no article link found on homepage'] };
      const resp = await page.goto(articleHref, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch((e) => ({ err: e.message }));
      await sleep(2000);
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const gatePresent = /free to read|log in to continue|subscribe to continue|create a free account/i.test(bodyText);
      const articleLoaded = bodyText.length > 300;
      return { ok: home && articleLoaded, detail: { articleHref, articleLoaded, gatePresent, httpStatus: resp && resp.status ? resp.status() : null } };
    },
  },
  {
    key: 'squoosh', n: 12, label: 'squoosh.app', url: 'https://squoosh.app/', settleMs: 2000,
    async check(page) {
      const text = await page.evaluate(() => document.body.innerText).catch(() => '');
      return { ok: /drop/i.test(text) && text.length > 20, detail: { textSample: text.slice(0, 120) } };
    },
  },
  {
    key: 'irs', n: 13, label: 'irs.gov site search "form 1040"', url: 'https://www.irs.gov/', settleMs: 1500,
    async check(page) {
      const input = await page.$('#edit-search');
      if (!input) return { ok: false, detail: {}, reasons: ['#edit-search not found on homepage'] };
      await input.type('form 1040');
      await sleep(300);
      const resp = await Promise.race([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => ({ err: e.message })),
        page.evaluate(() => document.querySelector('#edit-search').closest('form').requestSubmit()),
      ]).then(() => page.evaluate(() => document.title).catch(() => null));
      await sleep(1000);
      const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
      const blockedText = /access denied|you don't have permission/i.test(bodyText);
      if (blockedText) return { ok: false, blocked: true, blockedEvidence: bodyText.slice(0, 400), detail: { url: page.url(), title: resp } };
      const resultCount = await page.evaluate(() => document.querySelectorAll('.views-row, .search-result, article').length).catch(() => 0);
      const has1040 = /1040/i.test(bodyText);
      return { ok: resultCount > 0 || has1040, detail: { url: page.url(), resultCount, has1040 } };
    },
  },
  {
    key: 'reddit', n: 14, label: 'reddit.com/r/technology', url: 'https://www.reddit.com/r/technology/', settleMs: 5000,
    async check(page) {
      const count = await page.evaluate(() => document.querySelectorAll('shreddit-post, article').length);
      return { ok: count > 0, detail: { postCount: count } };
    },
  },
];

// ── 5. run one site ──────────────────────────────────────────────────────────
async function runSite(browser, site, ctxIn, ua) {
  const { page, consoleLines } = await freshPage(browser, ua);
  const record = { site: site.key, withExtension: ctxIn.withExtension, url: site.url, ok: false, blocked: false, blockedEvidence: null, skipped: false, skipReason: null, reasons: [], detail: {}, probes: null, visibility: null, consoleLines: [], httpStatus: null, error: null };
  try {
    let resp;
    try {
      resp = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      record.error = String(e.message || e).slice(0, 300);
      record.consoleLines = consoleLines.slice(0, 10);
      await page.close().catch(() => {});
      return record;
    }
    record.httpStatus = resp ? resp.status() : null;
    const wall = await detectBotWall(page, record.httpStatus);
    if (wall) {
      record.consoleLines = consoleLines.slice(0, 10);
      record.probes = await probes(page).catch(() => null);
      record.blocked = true;
      record.blockedEvidence = wall.evidence;
      await page.close().catch(() => {});
      return record;
    }
    await dismissCookieBanner(page).catch(() => {});
    if (site.settleMs) await sleep(site.settleMs);
    record.visibility = await assertVisible(page);
    record.probes = await probes(page);
    const ctx = { ...ctxIn, probes: record.probes, httpStatus: record.httpStatus };
    const result = await withTimeout(site.check(page, ctx), 45000, site.key).catch((e) => ({ ok: false, error: String(e.message || e).slice(0, 300) }));
    record.ok = !!result.ok;
    record.detail = result.detail || {};
    record.reasons = result.reasons || [];
    record.blocked = !!result.blocked;
    record.blockedEvidence = result.blockedEvidence || null;
    record.skipped = !!result.skipped;
    record.skipReason = result.skipReason || null;
    if (result.error) record.error = result.error;
  } catch (e) {
    record.error = String(e.message || e).slice(0, 300);
  } finally {
    record.consoleLines = consoleLines.slice(0, 20);
    await page.close().catch(() => {});
  }
  return record;
}

async function runPass({ withExtension, unpackDir, offRecords, ua }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `nullecho-smoke-profile-${withExtension ? 'on' : 'off'}-`));
  const { browser, version } = await launchBrowser({ extDir: withExtension ? unpackDir : null, profile });
  const records = {};
  const sites = ONLY.length ? SITES.filter((s) => ONLY.includes(s.key)) : SITES;
  try {
    for (const site of sites) {
      if (budgetLeft() < 60000) { records[site.key] = { site: site.key, withExtension, skipped: true, skipReason: 'runtime budget exceeded', ok: false, detail: {}, reasons: [], probes: null, consoleLines: [] }; continue; }
      const off = offRecords ? offRecords[site.key] : null;
      const ctx = { withExtension, hostCores: off ? off.probes?.cores : undefined, hostMem: off ? off.probes?.mem : undefined, offGpc: off ? off.probes?.gpc : undefined };
      console.error(`[site-smoke] ${withExtension ? 'ON ' : 'OFF'} ${site.label} …`);
      records[site.key] = await runSite(browser, site, ctx, ua);
      console.error(`  → ${records[site.key].ok ? 'ok' : 'not-ok'}${records[site.key].blocked ? ' (blocked)' : ''}${records[site.key].skipped ? ' (skipped)' : ''}`);
    }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
  }
  return { records, chromeVersion: version };
}

/** Re-run one site's ON check once, fresh page, same running browser — the flakiness guard. */
async function retryOnSite(browser, site, ctxIn, ua) {
  return runSite(browser, site, ctxIn, ua);
}

// ── 6. self-test: prove the youtube + maps checks CAN fail ─────────────────
async function selfTest(ua) {
  console.error('[site-smoke] self-test: attacking the youtube + maps checks…');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-smoke-selftest-'));
  const { browser } = await launchBrowser({ extDir: null, profile });
  const out = {};
  try {
    // youtube: deliberately break it. First try: don't press play — but Chrome for Testing's
    // --autoplay-policy=no-user-gesture-required (needed so the REAL check isn't gated on a
    // click) means the video auto-plays anyway (measured 2026-09-22: readyState 4, currentTime
    // advanced from 0.47s to 9.48s with skipPlay:true and no click). So the real attack is an
    // invalid video id — "Video unavailable" never reaches HAVE_ENOUGH_DATA — which exercises
    // the same currentTime/readyState assertion the real check relies on, deterministically.
    {
      const { page, consoleLines } = await freshPage(browser, ua);
      await page.goto('https://www.youtube.com/watch?v=00000000000', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await sleep(500);
      const r = await withTimeout(youtubeRun(page, {}), 20000, 'youtube self-test').catch((e) => ({ ok: false, error: String(e) }));
      out.youtube = { expectedFail: true, actuallyFailed: r.ok === false, detail: r.detail || r, method: 'invalid video id (watch?v=00000000000)' };
      await page.close().catch(() => {});
      out.youtube.consoleSample = consoleLines.slice(0, 3);
    }
    // maps: run the SAME zoom-via-wheel check against a static page with no map — expect FAIL.
    {
      const { page } = await freshPage(browser, ua);
      await page.goto('https://example.com/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      // mapsRun waits for a canvas that will never appear (short-circuited by its own 25s wait);
      // cap it hard so the self-test doesn't eat the timeout budget.
      const r = await withTimeout(mapsRun(page), 15000, 'maps self-test').catch((e) => ({ ok: false, error: String(e.message || e) }));
      out.maps = { expectedFail: true, actuallyFailed: r.ok === false, detail: r.detail || r };
      await page.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
  }
  return out;
}

// ── 7. main ──────────────────────────────────────────────────────────────────
async function main() {
  const pkg = OFF_ONLY ? null : buildAndUnpackChromePackage();

  // probe browser version + build a stable desktop UA before any real pass
  const probeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-smoke-probe-'));
  const { browser: probeBrowser, version: chromeVersion } = await launchBrowser({ extDir: null, profile: probeProfile });
  await probeBrowser.close().catch(() => {});
  fs.rmSync(probeProfile, { recursive: true, force: true });
  const ua = desktopUA(chromeVersion.split(' ')[0]);

  const selfTestResult = await selfTest(ua);
  if (selfTestResult.youtube.actuallyFailed !== true || selfTestResult.maps.actuallyFailed !== true) {
    console.error('⚠ SELF-TEST WARNING: a check did not fail when it should have. Trusting PASS verdicts from it is unsound this run.');
  }

  console.error('[site-smoke] OFF pass (no extension) — establishing host baseline…');
  const off = await runPass({ withExtension: false, unpackDir: null, offRecords: null, ua });

  let on = { records: {}, chromeVersion };
  if (!OFF_ONLY) {
    console.error('[site-smoke] ON pass (packaged extension loaded)…');
    on = await runPass({ withExtension: true, unpackDir: pkg.unpackDir, offRecords: off.records, ua });

    // flakiness guard: re-run once, same-browser, any site that FAILED on but PASSED off.
    const retryCandidates = Object.values(on.records).filter((r) => {
      const offR = off.records[r.site];
      return offR && offR.ok === true && r.ok === false && !r.blocked && !r.skipped;
    });
    if (retryCandidates.length) {
      console.error(`[site-smoke] ${retryCandidates.length} candidate FAIL(s) — retrying once each before reporting…`);
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-smoke-profile-retry-'));
      const { browser } = await launchBrowser({ extDir: pkg.unpackDir, profile });
      try {
        for (const r of retryCandidates) {
          const site = SITES.find((s) => s.key === r.site);
          const offR = off.records[r.site];
          const ctx = { withExtension: true, hostCores: offR.probes?.cores, hostMem: offR.probes?.mem, offGpc: offR.probes?.gpc };
          console.error(`  retry: ${site.label} …`);
          const retry = await retryOnSite(browser, site, ctx, ua);
          retry.retriedAfterInitialFail = true;
          retry.firstAttempt = { ok: r.ok, reasons: r.reasons, detail: r.detail, error: r.error };
          on.records[r.site] = retry;
        }
      } finally {
        await browser.close().catch(() => {});
        fs.rmSync(profile, { recursive: true, force: true });
      }
    }
  }

  // verify the metadata-leak trap never fired
  const metadataLeaked = fs.existsSync(path.join(EXT, '_metadata'));
  if (metadataLeaked) console.error('⚠ ext/_metadata/ EXISTS — this must never be committed. Investigate immediately.');

  // ── verdicts ────────────────────────────────────────────────────────────
  const sites = ONLY.length ? SITES.filter((s) => ONLY.includes(s.key)) : SITES;
  const results = sites.map((site) => {
    const onR = on.records[site.key];
    const offR = off.records[site.key];
    let verdict, reason;
    if (OFF_ONLY) {
      verdict = offR.ok ? 'PASS (OFF-only run)' : (offR.blocked ? 'BLOCKED' : (offR.skipped ? 'SKIPPED' : 'FAIL'));
      reason = offR.skipReason || offR.error || (offR.reasons || []).join('; ');
    } else if (offR.skipped || onR.skipped) {
      verdict = 'SKIPPED'; reason = onR.skipReason || offR.skipReason;
    } else if (onR.blocked && offR.blocked) {
      verdict = 'BLOCKED'; reason = onR.blockedEvidence || offR.blockedEvidence;
    } else if (onR.blocked && !offR.blocked) {
      // blocked only under the extension is itself a real, reportable finding — not a silent NOT-OURS.
      verdict = 'FAIL'; reason = `blocked ON only: ${onR.blockedEvidence}`;
    } else if (onR.ok && offR.ok) {
      verdict = 'PASS'; reason = onR.retriedAfterInitialFail ? 'note: passed on retry after one flaky failure' : (onR.reasons || []).join('; ');
    } else if (!onR.ok && !offR.ok) {
      verdict = 'NOT-OURS'; reason = `fails with extension OFF too — off: ${offR.error || (offR.reasons || []).join('; ') || 'functional check failed'}`;
    } else if (!onR.ok && offR.ok) {
      verdict = 'FAIL'; reason = (onR.reasons || []).join('; ') || onR.error || 'functional check failed under the extension';
    } else {
      verdict = onR.ok ? 'PASS' : 'FAIL';
      reason = 'note: OFF failed but ON passed (not a regression) — ' + (offR.error || '');
    }
    return { site, on: onR, off: offR, verdict, reason };
  });

  const meta = {
    date: today(),
    package: pkg ? { version: pkg.version, zipName: pkg.zipName, sha256: pkg.sha256, size: pkg.size } : null,
    chromeVersion, puppeteerVersion: PUPPETEER_VERSION,
    node: process.version,
    runtimeMs: elapsed(),
    metadataLeaked,
    ua,
    offOnly: OFF_ONLY,
    selfTest: selfTestResult,
  };

  writeReports(meta, results);
  const summary = results.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});
  console.error('\n[site-smoke] DONE in ' + Math.round(elapsed() / 1000) + 's — ' + JSON.stringify(summary));
  for (const r of results) console.error(`  ${String(r.site.n).padStart(2)}. ${r.site.label.padEnd(40)} ${r.verdict}`);
}

// ── 8. reports ───────────────────────────────────────────────────────────────
function writeReports(meta, results) {
  const outDir = path.join(REPO, 'docs', 'breakage-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${meta.date}-site-smoke`;
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2));

  const fmtProbes = (r) => r ? `gpc=${r.probes?.gpc === undefined ? 'undefined' : r.probes?.gpc} cores=${r.probes?.cores} mem=${r.probes?.mem}` : 'n/a';
  const fmtVerdict = (ok, blocked, skipped) => skipped ? 'SKIPPED' : blocked ? 'BLOCKED' : ok ? 'PASS' : 'FAIL';

  let md = `# Nullecho pre-release site smoke — ${meta.date}\n\n`;
  md += `Tests **the packaged Chrome build**, not the source tree: \`ext/tools/package.mjs\` → `;
  md += meta.package ? `\`${meta.package.zipName}\`, sha256 \`${meta.package.sha256}\`, ${(meta.package.size / 1024).toFixed(1)} KB.\n` : `(OFF-only run — package not built.)\n`;
  md += `\n- **Chrome:** ${meta.chromeVersion}\n- **Puppeteer:** ${meta.puppeteerVersion}\n- **Node:** ${meta.node}\n`;
  md += `- **UA used (both passes):** \`${meta.ua}\`\n`;
  md += `- **Runtime:** ${Math.round(meta.runtimeMs / 1000)}s\n`;
  md += `- **\`ext/_metadata/\` present:** ${meta.metadataLeaked ? '⚠ YES — investigate, must never be committed' : 'NO (verified)'}\n`;
  md += `- **Mode:** ${meta.offOnly ? 'OFF-only (no extension, no package build)' : 'OFF pass then ON pass, side by side'}\n`;

  md += `\n## Self-test — attacking our own checks before trusting a PASS\n\n`;
  const st = meta.selfTest;
  md += `| Check | Deliberately broken how | Expected | Actual | Result |\n|---|---|---|---|---|\n`;
  md += `| youtube playback | navigated but never pressed play | check should report FAIL | ${st.youtube.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${st.youtube.actuallyFailed ? '✅' : '❌'} |\n`;
  md += `| maps zoom | ran the same wheel-zoom check on example.com (no map) | check should report FAIL | ${st.maps.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${st.maps.actuallyFailed ? '✅' : '❌'} |\n`;
  md += `\nDetail: youtube ${JSON.stringify(st.youtube.detail)}; maps ${JSON.stringify(st.maps.detail)}\n`;

  md += `\n## Results\n\n`;
  md += `| # | Site | ON | OFF | Verdict | Notes |\n|---|---|---|---|---|---|\n`;
  for (const r of results) {
    const onV = r.on ? fmtVerdict(r.on.ok, r.on.blocked, r.on.skipped) : 'n/a';
    const offV = r.off ? fmtVerdict(r.off.ok, r.off.blocked, r.off.skipped) : 'n/a';
    const notes = (r.reason || '').replace(/\|/g, '\\|').slice(0, 160);
    md += `| ${r.site.n} | ${r.site.label} | ${onV} | ${offV} | **${r.verdict}** | ${notes} |\n`;
  }

  const totals = results.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});
  md += `\n**Totals:** ${Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(', ')}\n`;

  md += `\n## Per-site detail\n`;
  for (const r of results) {
    md += `\n### ${r.site.n}. ${r.site.label} — **${r.verdict}**\n\n`;
    if (r.reason) md += `${r.reason}\n\n`;
    md += `- URL: \`${r.site.url}\`\n`;
    if (r.on) {
      md += `- **ON** — http ${r.on.httpStatus}, visibility \`${r.on.visibility}\`, probes: \`${fmtProbes(r.on)}\`, detail: \`${JSON.stringify(r.on.detail)}\`${r.on.error ? `, error: \`${r.on.error}\`` : ''}${r.on.retriedAfterInitialFail ? `, **retried once** (first attempt: ${JSON.stringify(r.on.firstAttempt)})` : ''}\n`;
    }
    if (r.off) {
      md += `- **OFF** — http ${r.off.httpStatus}, visibility \`${r.off.visibility}\`, probes: \`${fmtProbes(r.off)}\`, detail: \`${JSON.stringify(r.off.detail)}\`${r.off.error ? `, error: \`${r.off.error}\`` : ''}\n`;
    }
    const allConsole = [...(r.on?.consoleLines || []).map((l) => `ON: ${l}`), ...(r.off?.consoleLines || []).map((l) => `OFF: ${l}`)];
    if (allConsole.length) {
      md += `- Nullecho/console lines:\n`;
      for (const l of allConsole) md += `  > ${l}\n`;
    }
  }

  md += `\n## Every Nullecho console line seen this run (verbatim)\n\n`;
  const allLines = [];
  for (const r of results) {
    for (const l of r.on?.consoleLines || []) allLines.push(`${r.site.label} (ON): ${l}`);
    for (const l of r.off?.consoleLines || []) allLines.push(`${r.site.label} (OFF): ${l}`);
  }
  if (allLines.length === 0) md += '_None captured this run._\n';
  else for (const l of allLines) md += `- ${l}\n`;

  fs.writeFileSync(mdPath, md);
  console.error(`[site-smoke] wrote ${path.relative(REPO, mdPath)} + ${path.relative(REPO, jsonPath)}`);
}

main().then(() => process.exit(0), (e) => { console.error(e && e.stack || e); process.exit(1); });
