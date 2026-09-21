/**
 * Site-breakage bisect in Chrome for Testing. Loads VARIANTS of the unpacked extension
 * (each a temp copy of ext/ with one subsystem removed) and runs the same page check
 * under each, so a break can be attributed to blocking, the shim, GPC, the UA rewrite,
 * or "not us" — the triage tree in docs/BREAKAGE-TESTING.md, automated.
 *
 *   node harness/site-bisect.mjs youtube --puppeteer /Users/jasonluker/bodybuilding
 *   node harness/site-bisect.mjs maps    --puppeteer /Users/jasonluker/bodybuilding
 *   node harness/site-bisect.mjs youtube --variants off,full --headful
 *
 * Variants
 *   off       no extension at all (the protocol's mandatory OFF pass)
 *   full      ext/ as committed
 *   no-block  ads/analytics/social/fingerprinting rules emptied (gpc + ua rules kept)
 *   no-ua     ua-win/ua-mac/ua-linux rules emptied (UA header never rewritten)
 *   no-gpc    gpc.js content script removed + gpc.json emptied
 *   no-shim   shim.js + shim-loader.js content scripts removed
 *
 * Same traps as unpacked-chrome.mjs: Chrome for Testing (branded Chrome ignores
 * --load-extension), puppeteer's --disable-extensions stripped, `_metadata/` never
 * committed (variants live in a temp dir, deleted at exit). `navigator.webdriver` is
 * true here, so a site that walls automation may fail for THAT reason — the OFF pass
 * exists to catch exactly that: a check that fails under `off` is not ours.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EXT = path.join(REPO, 'ext');

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const site = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true && !['--puppeteer', '--variants'].includes(argv[argv.indexOf(a) - 1]));
const HEADFUL = flag('--headful');
const VARIANTS = (opt('--variants', 'off,full,no-block,no-ua,no-gpc,no-shim')).split(',');
const SETTLE_MS = Number(opt('--settle', '9000'));

function loadPuppeteer() {
  const tried = [];
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  for (const dir of [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); } catch (e) { tried.push(`${dir} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; '));
  process.exit(2);
}
const puppeteer = loadPuppeteer();

// ── variants: temp copies of ext/ with one subsystem removed ───────────────
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-bisect-'));
process.on('exit', () => fs.rmSync(WORK, { recursive: true, force: true }));

function buildVariant(name) {
  if (name === 'off') return null;
  const dir = path.join(WORK, name);
  fs.cpSync(EXT, dir, { recursive: true, filter: (src) => !/[\\/](_metadata|node_modules)([\\/]|$)/.test(src) && !/\.test\.js$/.test(src) });
  const mPath = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
  const emptyRules = (ids) => {
    for (const r of m.declarative_net_request?.rule_resources ?? []) {
      if (ids.includes(r.id)) fs.writeFileSync(path.join(dir, r.path), '[]\n');
    }
  };
  const dropScripts = (names) => {
    m.content_scripts = (m.content_scripts ?? [])
      .map((cs) => ({ ...cs, js: (cs.js ?? []).filter((f) => !names.some((n) => f.endsWith(n))) }))
      .filter((cs) => cs.js.length > 0);
  };
  const allRules = () => (m.declarative_net_request?.rule_resources ?? []).map((r) => r.id);
  switch (name) {
    case 'full': break;
    case 'no-block': emptyRules(['ads', 'analytics', 'social', 'fingerprinting']); break;
    case 'no-ua': emptyRules(['ua-win', 'ua-mac', 'ua-linux']); break;
    case 'no-gpc': emptyRules(['gpc']); dropScripts(['gpc.js']); break;
    case 'no-shim': dropScripts(['shim.js', 'shim-loader.js']); break;
    case 'no-pricing': dropScripts(['pricing.js', 'pricing-scan.js']); break;
    case 'no-content': m.content_scripts = []; break;                       // rules + background only
    case 'no-bg': delete m.background; break;                               // content scripts + static rules only
    case 'no-rules': emptyRules(allRules()); break;                         // every static ruleset emptied
    case 'no-webrequest': m.permissions = (m.permissions ?? []).filter((p) => p !== 'webRequest'); break;
    case 'bare': m.content_scripts = []; delete m.background; emptyRules(allRules()); break;   // permissions only
    case 'bg-empty': fs.writeFileSync(path.join(dir, m.background.service_worker), '// empty worker: is it the worker\'s CODE or its mere presence?\n'); break;
    case 'no-feedback': m.permissions = (m.permissions ?? []).filter((p) => p !== 'declarativeNetRequestFeedback'); break;
    case 'bg-no-options': {                                                 // first-run options tab suppressed
      const bg = path.join(dir, m.background.service_worker);
      const src = fs.readFileSync(bg, 'utf8');
      if (!/openOptionsPage/.test(src)) throw new Error('bg-no-options: openOptionsPage call not found');
      fs.writeFileSync(bg, src.replace(/api\.runtime\.openOptionsPage\?\.\(\);/, '/* openOptionsPage suppressed by site-bisect */'));
      break;
    }
    default: throw new Error('unknown variant ' + name);
  }
  fs.writeFileSync(mPath, JSON.stringify(m, null, 2));
  return dir;
}

// ── the per-site checks ─────────────────────────────────────────────────────
const CHECKS = {
  youtube: {
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    async run(page) {
      await page.waitForSelector('video', { timeout: 20000 }).catch(() => null);
      // Play once. (Calling play() AND clicking the play button toggles it straight back
      // to paused — that spoiled the first run's control.) Click only if still paused.
      await page.evaluate(() => { const v = document.querySelector('video'); if (v && v.paused) v.play().catch(() => {}); });
      await new Promise((r) => setTimeout(r, 1500));
      const stillPaused = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.paused : true; });
      if (stillPaused) await page.click('.ytp-play-button').catch(() => {});
      const a = await page.evaluate(() => { const v = document.querySelector('video'); return v ? v.currentTime : null; });
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      const b = await page.evaluate(() => {
        const v = document.querySelector('video');
        const err = document.querySelector('.ytp-error-content-wrap, .ytp-error');
        let buffered = 0; try { for (let i = 0; i < v.buffered.length; i++) buffered += v.buffered.end(i) - v.buffered.start(i); } catch (_) {}
        return {
          currentTime: v ? v.currentTime : null,
          readyState: v ? v.readyState : null,
          buffered: Math.round(buffered * 10) / 10,
          paused: v ? v.paused : null,
          hasFocus: document.hasFocus(),
          playerError: err ? err.innerText.trim().slice(0, 160) : null,
          playability: window.ytInitialPlayerResponse?.playabilityStatus?.status ?? null,
          reason: window.ytInitialPlayerResponse?.playabilityStatus?.reason ?? null,
          cores: navigator.hardwareConcurrency, gpc: navigator.globalPrivacyControl,
        };
      });
      const advanced = b.currentTime != null && a != null && b.currentTime - a > 1.5 && b.readyState >= 2;
      return { pass: advanced, from: a, ...b };
    },
  },
  maps: {
    url: 'https://www.google.com/maps/@35.6225,-117.6709,12z',
    async run(page) {
      await page.waitForSelector('canvas', { timeout: 25000 }).catch(() => null);
      await new Promise((r) => setTimeout(r, 4000));
      const before = page.url();
      const box = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      await page.mouse.move(box.w / 2, box.h / 2);
      await page.mouse.wheel({ deltaY: -600 });           // zoom in
      await new Promise((r) => setTimeout(r, 1500));
      await page.mouse.wheel({ deltaY: -600 });
      await new Promise((r) => setTimeout(r, 3000));
      const zoomBtn = await page.$('button[aria-label="Zoom in"]');
      if (zoomBtn) { await zoomBtn.click().catch(() => {}); await new Promise((r) => setTimeout(r, 3000)); }
      const after = page.url();
      const zoomOf = (u) => { const m = u.match(/@[-\d.]+,[-\d.]+,([\d.]+)z/); return m ? Number(m[1]) : null; };
      const tiles = await page.evaluate(() => document.querySelectorAll('canvas').length);
      const errText = await page.evaluate(() => (document.body.innerText.match(/(can't load Google Maps|WebGL|something went wrong)[^\n]{0,80}/i) || [null])[0]);
      return { pass: zoomOf(after) != null && zoomOf(before) != null && zoomOf(after) > zoomOf(before), zoomBefore: zoomOf(before), zoomAfter: zoomOf(after), canvases: tiles, errText };
    },
  },
};

// ── run ─────────────────────────────────────────────────────────────────────
const check = CHECKS[site];
if (!check) { console.error('usage: node harness/site-bisect.mjs <youtube|maps> [--variants a,b] [--puppeteer dir] [--headful] [--settle ms]'); process.exit(1); }

const results = [];
for (const name of VARIANTS) {
  const extDir = buildVariant(name);
  const profile = fs.mkdtempSync(path.join(WORK, 'profile-'));
  const args = ['--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--window-size=1400,900'];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const browser = await puppeteer.launch({ headless: !HEADFUL, ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], args, userDataDir: profile });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  const consoleLines = [];
  page.on('console', (msg) => { const t = msg.text(); if (/Nullecho|Illegal invocation/.test(t)) consoleLines.push(t.replace(/\s+/g, ' ').slice(0, 220)); });
  // --trace: every failed request and every 4xx/5xx, so variants can be diffed at the network layer.
  const failed = [], bad = [];
  if (flag('--trace')) {
    page.on('requestfailed', (r) => failed.push({ type: r.resourceType(), err: r.failure()?.errorText, url: r.url().replace(/\?.*$/, '?…').slice(0, 110) }));
    page.on('response', (r) => { if (r.status() >= 400) bad.push({ type: r.request().resourceType(), status: r.status(), url: r.url().replace(/\?.*$/, '?…').slice(0, 110) }); });
  }
  let out;
  try {
    await page.goto(check.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // THE HIDDEN-TAB TRAP (found 2026-09-20). A fresh profile means a first INSTALL, and
    // the extension opens its options page on install — in front of the test page. A
    // hidden tab gets no requestAnimationFrame and YouTube will not even fetch media
    // for it, so every extension variant "failed" while `off` passed: an artifact, not a
    // break. Close any extension page and put the test page in front before measuring.
    for (const p of await browser.pages()) {
      if (p !== page && /^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});
    }
    await page.bringToFront();
    await new Promise((r) => setTimeout(r, 500));
    out = await check.run(page);
    out.visibility = await page.evaluate(() => document.visibilityState).catch(() => 'unknown');
  } catch (e) {
    out = { pass: false, error: String(e.message || e).slice(0, 200) };
  }
  const ua = await page.evaluate(() => navigator.userAgent).catch(() => '');
  out.variant = name;
  out.chrome = (ua.match(/Chrome\/[\d.]+/) || [''])[0];
  out.console = consoleLines.slice(0, 6);
  if (flag('--trace')) { out.failedRequests = failed.slice(0, 25); out.badResponses = bad.slice(0, 25); }
  results.push(out);
  console.log(JSON.stringify(out));
  await browser.close().catch(() => {});
}

console.log('\nSUMMARY ' + site);
for (const r of results) console.log(`  ${r.variant.padEnd(9)} ${r.pass ? 'PASS' : 'FAIL'}${r.error ? '  (' + r.error + ')' : ''}`);
