/**
 * Drives the REAL extension: loads `ext/` UNPACKED into Chrome for Testing and points it
 * at the harness pages. This is the "rigorous version" CLAIM-VERIFICATION §5 asks for, and
 * the instrument behind D47's "measured, not assumed" — that Chrome's own per-frame
 * injection (`all_frames` + `match_origin_as_fallback`) covers the parser and navigation
 * child-realm paths a page-script shim cannot.
 *
 *   node harness/unpacked-chrome.mjs smoke  http://localhost:4886   # the extension is in: versions, SW, first-script timing
 *   node harness/unpacked-chrome.mjs timing http://localhost:4886   # realm-timing.html?shim=off — every child-realm reading
 *   node harness/unpacked-chrome.mjs claim  http://localhost:4886   # claim-verification.html?shim=off on BOTH hostnames, CreepJS included
 *   node harness/unpacked-chrome.mjs retain http://localhost:4886   # page-script shim + --expose-gc: dead realms after 20 navigations
 *
 * Options
 *   --ext <dir>        the unpacked extension (default: <repo>/ext)
 *   --profile <dir>    a user-data dir to reuse (default: a fresh temp dir, deleted at exit)
 *   --puppeteer <dir>  a directory whose node_modules holds puppeteer; also read from
 *                      $NULLECHO_PUPPETEER_DIR. The repo carries no dependencies on purpose.
 *   --headful          watch it (headless "new" mode otherwise — real Chrome, extensions work)
 *
 * The server must serve the PROJECT ROOT (launch config `nullecho-root`, port 4886):
 * the pages load /ext/src/shim.js in page-script mode and /harness/* always. To measure a
 * git worktree, serve that worktree on another port — :4886 is the main checkout.
 *
 * WHY CHROME FOR TESTING. Branded Chrome no longer honours --load-extension. Chrome for
 * Testing is Google's own build of the same binary (UA `Chrome/<major>`, no Electron) and
 * its new headless mode loads extensions. Puppeteer keeps one in ~/.cache/puppeteer.
 *
 * TRAPS, each of which cost a round on 2026-09-19:
 *   1. Chrome writes `ext/_metadata/` into the unpacked directory when it loads it. It is
 *      removed at exit here and must never be committed.
 *   2. Puppeteer passes --disable-extensions by default; it is stripped here.
 *   3. In an automated browser `navigator.webdriver` is genuinely true, so CreepJS's
 *      `headless.webDriverIsOn` is the automation's, not the shim's. Read the bot verdict
 *      from a user's Chrome; read everything else here.
 *   4. A headless tab reports `document.hidden === true`, but its timers are not throttled.
 *   5. CDP `Runtime.queryObjects` is realm-blind (it matches one realm's prototype), so
 *      retention is counted with WeakRefs taken from the page, after a task boundary —
 *      a WeakRef target lives to the end of the job that touched it.
 *   6. A file with no extension (`/LICENSE`) is served as octet-stream and DOWNLOADS
 *      instead of committing a navigation; the pages navigate frames to /README.md.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ── arguments ──────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--headful') continue;
  if (argv[i].startsWith('--')) { i++; continue; }        // an option and its value
  positional.push(argv[i]);
}
const MODE = positional[0];
const ORIGIN = (positional[1] || '').replace(/\/$/, '');
const EXT = path.resolve(opt('--ext', path.join(REPO, 'ext')));
const HEADFUL = flag('--headful');
const PROFILE_GIVEN = opt('--profile', null);

if (!['smoke', 'timing', 'claim', 'retain'].includes(MODE) || !ORIGIN) {
  console.error('usage: node harness/unpacked-chrome.mjs <smoke|timing|claim|retain> <origin> [--ext dir] [--profile dir] [--puppeteer dir] [--headful]');
  process.exit(2);
}
if (!fs.existsSync(path.join(EXT, 'manifest.json'))) {
  console.error(`no manifest.json under --ext ${EXT}`);
  process.exit(2);
}

// ── puppeteer, without a dependency in the repo ────────────────────────────
function loadPuppeteer() {
  const tried = [];
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  for (const dir of [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); }
    catch (e) { tried.push(`${dir} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; ') + '\n' +
    'Install it, pass --puppeteer <dir whose node_modules has it>, or set NULLECHO_PUPPETEER_DIR.');
  process.exit(2);
}
const puppeteer = loadPuppeteer();

// ── launch / teardown ───────────────────────────────────────────────────────
const profile = PROFILE_GIVEN ? path.resolve(PROFILE_GIVEN) : fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-cft-'));
const watchdog = setTimeout(() => { console.error('TIMEOUT after 300 s'); process.exit(3); }, 300000);
watchdog.unref();

async function launch({ withExtension, exposeGc }) {
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (withExtension) args.push(`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`);
  if (exposeGc) args.push('--js-flags=--expose-gc');
  const browser = await puppeteer.launch({
    headless: !HEADFUL,
    ignoreDefaultArgs: withExtension ? ['--disable-extensions'] : [],
    args,
    userDataDir: profile,
  });
  const version = await browser.version();
  const probe = await browser.newPage();
  const ua = await probe.evaluate(() => navigator.userAgent);
  await probe.close();
  const env = { version, ua, realChrome: /Chrome\//.test(ua) && !/Electron/i.test(ua), headless: !HEADFUL, extension: !!withExtension, profile };
  console.log('env ' + JSON.stringify(env));
  if (!env.realChrome) console.error('⚠ not real Chrome by UA — numbers are not authoritative');
  return browser;
}
/**
 * Put a fresh test page IN FRONT and close the extension's own pages first. A fresh profile is a
 * first install, and the extension opens its options page on install — over the test tab. A
 * hidden tab gets no rAF and YouTube fetches no media for it, so every extension variant "failed"
 * on 2026-09-20 while OFF passed. Measure only a visible page (BREAKAGE-TESTING.md, hygiene).
 */
async function frontPage(browser) {
  for (const p of await browser.pages()) {
    if (/^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});
  }
  const page = await browser.newPage();
  await page.bringToFront();
  return page;
}
async function teardown(browser, withExtension) {
  try { await browser.close(); } catch (_) { /* already gone */ }
  if (withExtension) fs.rmSync(path.join(EXT, '_metadata'), { recursive: true, force: true });   // trap 1
  if (!PROFILE_GIVEN) fs.rmSync(profile, { recursive: true, force: true });
}
const cb = () => 'cb=unpacked' + Date.now();
const otherHost = (origin) => (/\/\/localhost/.test(origin) ? origin.replace('//localhost', '//127.0.0.1') : origin.replace('//127.0.0.1', '//localhost'));

/** The extension's service worker: proof it is in, and what it stored (keys only, never values). */
async function serviceWorker(browser) {
  const t = await browser.waitForTarget((x) => x.type() === 'service_worker', { timeout: 15000 }).catch(() => null);
  if (!t) return { present: false };
  // `chrome.storage` is bound a beat after the worker target appears; ask a few times.
  let last = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const w = await t.worker();
      const keys = await w.evaluate(async () => Object.keys(await chrome.storage.local.get(null)));
      return { present: true, url: t.url(), storageKeys: keys };
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 400)); }
  }
  return { present: true, url: t.url(), storageKeys: 'unreadable: ' + (last && last.message) };
}

// ── modes ──────────────────────────────────────────────────────────────────
const modes = {
  /** Is the extension in, and did its MAIN-world shim run before the page's first script? */
  async smoke() {
    const browser = await launch({ withExtension: true });
    try {
      console.log('serviceWorker ' + JSON.stringify(await serviceWorker(browser)));
      const page = await frontPage(browser);
      await page.goto(`${ORIGIN}/harness/claim-verification.html?shim=off&creep=off&${cb()}`, { waitUntil: 'load' });
      const r = await page.evaluate(() => ({
        coresAtFirstPageScript: window.__ENV.realCores,          // stage 0 runs before any other page script
        coresNow: navigator.hardwareConcurrency,
        uaAtFirstPageScript: window.__ENV.realUA,
        looksLikeChrome: window.__ENV.looksLikeChrome,
      }));
      r.shimRanBeforeFirstPageScript = r.coresAtFirstPageScript === r.coresNow;
      console.log('page ' + JSON.stringify(r));
      console.log('NOTE the page cannot know the host: with the extension in, its first script already sees the persona. ' +
        'Run the same page with no extension to learn the host, then compare.');
    } finally { await teardown(browser, true); }
  },

  /** Every child-realm reading on realm-timing.html, with the extension supplying the shim. */
  async timing() {
    const browser = await launch({ withExtension: true });
    try {
      console.log('serviceWorker ' + JSON.stringify(await serviceWorker(browser)));
      const page = await frontPage(browser);
      await page.goto(`${ORIGIN}/harness/realm-timing.html?shim=off&${cb()}`, { waitUntil: 'load' });
      const T = await page.evaluate(() => window.__timingDone);
      console.log(`top window: ${T.topAtStage0} at stage 0, ${T.topAfterBoot} after boot (the persona)`);
      let pristine = 0;
      for (const k of T.order) {
        const v = T.readings[k];
        const verdict = typeof v !== 'number' ? v : (v === T.topAfterBoot ? 'covered' : 'PRISTINE');
        if (verdict === 'PRISTINE') pristine++;
        console.log(`  ${k.padEnd(44)} ${String(v).padEnd(20)} ${verdict}`);
      }
      const timings = Object.keys(T.readings).filter((k) => /Ms$/.test(k)).map((k) => `${k}=${T.readings[k]}`).join(' ');
      console.log('  timings: ' + timings);
      console.log(pristine ? `RESULT: ${pristine} PRISTINE reading(s) under the installed extension` : 'RESULT: every reading is the persona under the installed extension');
    } finally { await teardown(browser, true); }
  },

  /** claim-verification.html on both loopback hostnames — the two site keys — with the extension supplying the persona. */
  async claim() {
    const browser = await launch({ withExtension: true });
    try {
      console.log('serviceWorker ' + JSON.stringify(await serviceWorker(browser)));
      const ids = [];
      for (const origin of [ORIGIN, otherHost(ORIGIN)]) {
        const page = await frontPage(browser);
        const t0 = Date.now();
        await page.goto(`${origin}/harness/claim-verification.html?shim=off&label=unpacked&${cb()}`, { waitUntil: 'load' });
        const r = await page.evaluate(() => window.__claimDone);
        const c = r.creepjs || {};
        const row = {
          origin, seconds: Math.round((Date.now() - t0) / 1000),
          coresSeenByPage: r.env && r.env.realCores,
          fingerprintjs: r.fingerprintjs && r.fingerprintjs.visitorId,
          clientjs: r.clientjs && (r.clientjs.fingerprint || r.clientjs.value),
          creepId: c.creepId, lieCount: c.lieCount, trashCount: c.trashCount, errorCount: c.errorCount,
          hasToStringProxy: c.stealth && c.stealth.hasToStringProxy,
          webDriverIsOn: c.headlessFlags && c.headlessFlags.webDriverIsOn,   // trap 3: the automation's, not the shim's
          extensionHashPattern: c.resistance ? Object.keys(c.resistance.extensionHashPattern || {}).length : null,
          sameTickChildRealm: r.invariants && r.invariants.pristineRealm && r.invariants.pristineRealm.value,
        };
        ids.push(row.fingerprintjs);
        console.log('claim ' + JSON.stringify(row));
        await page.close();
      }
      console.log(ids[0] && ids[1] && ids[0] !== ids[1]
        ? 'RESULT: the two site keys got two FingerprintJS visitorIds under the real service worker'
        : 'RESULT: ⚠ the two site keys did NOT split');
    } finally { await teardown(browser, true); }
  },

  /** Page-script shim, --expose-gc: how many navigated-away child realms are still reachable after 20 navigations. */
  async retain() {
    const browser = await launch({ withExtension: false, exposeGc: true });
    try {
      const page = await frontPage(browser);
      await page.goto(`${ORIGIN}/harness/claim-verification.html?creep=off&${cb()}`, { waitUntil: 'load' });
      await page.evaluate(() => window.__claimDone);
      await page.evaluate(() => { gc(); gc(); });
      const heap0 = (await page.metrics()).JSHeapUsedSize;
      const N = 20;
      const info = await page.evaluate(async (N) => {
        const f = document.createElement('iframe'); f.style.display = 'none'; document.body.appendChild(f);
        const p = frames[window.length - 1];
        window.__refs = [];
        const seen = [];
        for (let i = 0; i < N; i++) {
          window.__refs.push(new WeakRef(p.Navigator.prototype), new WeakRef(p.document));
          await new Promise((r) => { f.addEventListener('load', r, { once: true }); f.src = location.origin + '/README.md?i=' + i + '&cb=' + Date.now(); });
          seen.push(p.navigator.hardwareConcurrency);
        }
        f.remove();
        return { persona: window.__expectedPersona.cores, host: window.__ENV.realCores, navigatedRealmsRead: seen.join(',') };
      }, N);
      await new Promise((r) => setTimeout(r, 800));                 // trap 5: a new job
      await page.evaluate(() => { gc(); gc(); gc(); });
      const client = await page.createCDPSession();
      await client.send('HeapProfiler.enable');
      await client.send('HeapProfiler.collectGarbage');
      await new Promise((r) => setTimeout(r, 300));
      const alive = await page.evaluate(() => {
        const a = window.__refs.map((r) => (r.deref() ? 1 : 0));
        return { deadRealms: window.__refs.length / 2, prototypesAlive: a.filter((_, i) => i % 2 === 0).reduce((s, v) => s + v, 0), documentsAlive: a.filter((_, i) => i % 2 === 1).reduce((s, v) => s + v, 0) };
      });
      const heap1 = (await page.metrics()).JSHeapUsedSize;
      console.log('retain ' + JSON.stringify({ navigations: N, ...info, ...alive, heapGrowthMB: +((heap1 - heap0) / 1048576).toFixed(2) }));
      console.log(alive.prototypesAlive === 0 && alive.documentsAlive === 0
        ? 'RESULT: no navigated-away realm is retained'
        : `RESULT: ⚠ ${alive.prototypesAlive} prototype(s) and ${alive.documentsAlive} document(s) from dead realms are still reachable`);
    } finally { await teardown(browser, false); }
  },
};

modes[MODE]().then(() => process.exit(0), (e) => { console.error(e && e.stack || e); process.exit(1); });
