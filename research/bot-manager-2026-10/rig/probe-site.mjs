#!/usr/bin/env node
// One page load per labelled run, in the rig that passes Akamai's automation check as a plain browser
// (D59): headful Chrome for Testing, `--disable-blink-features=AutomationControlled`, no
// `--enable-automation`, so `navigator.webdriver` is false. Fresh profile per run unless --profile.
//
//   NULLECHO_PUPPETEER_DIR=<dir> node probe-site.mjs <outDir> <url> label=<extDir>[+<extDir2>]|none ...
//
// Options (before the runs):
//   --profile <dir>   reuse one user-data dir across the runs (second-visit measurements)
//   --cold            stop the extension service workers right before the navigation (cold-start case)
//   --visits <n>      navigate n times in the same browser (default 1); each visit is recorded
//   --pause <ms>      pause between runs (default 4000) — politeness
//   --settle <ms>     wait after networkidle2 (default 5000)
//   --chrome-arg <arg>    an extra Chrome switch (e.g. --host-resolver-rules=… for the local attack pages); repeatable
//   --message <n>:<json>  before visit n, send <json> as a runtime message from the FIRST extension's
//                     options page (e.g. a Nullecho settings change between two visits); repeatable
//
// Records per visit: every document response (status, Server, Set-Cookie NAMES only), loading failures,
// requests blocked by an extension, the cookie jar's names, the page title/text head, a few
// device values (WebGL renderer, cores, memory, GPC), and — for each loaded extension that exposes it —
// the service worker's own record of the visit: Nullecho's `stats[site].lastShimStatus` and its
// `botManagerSites` entry, or the timing probe's LOG. Cookie VALUES are never written.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUPPETEER_DIR = process.env.NULLECHO_PUPPETEER_DIR;
if (!PUPPETEER_DIR) { console.error('set NULLECHO_PUPPETEER_DIR to a directory whose node_modules holds puppeteer'); process.exit(2); }
const puppeteer = createRequire(path.join(PUPPETEER_DIR, 'package.json'))('puppeteer');

const argv = process.argv.slice(2);
const opts = {};
while (argv[0]?.startsWith('--')) {
  const k = argv.shift().slice(2);
  if (k === 'cold') opts.cold = true;
  else if (k === 'message') (opts.messages ??= []).push(argv.shift());
  else if (k === 'chrome-arg') (opts.chromeArgs ??= []).push(argv.shift());
  else opts[k] = argv.shift();
}
const [OUT, URL_, ...runs] = argv;
if (!OUT || !URL_ || !runs.length) { console.error('usage: probe-site.mjs [--profile d] [--cold] [--visits n] <outDir> <url> label=ext|none ...'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const VISITS = Number(opts.visits || 1);
const PAUSE = Number(opts.pause ?? 4000);
const SETTLE = Number(opts.settle ?? 5000);
const cookieName = (line) => line.split(';')[0].split('=')[0].trim();
const host = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
// The extension's own eTLD+1, so the rig looks a site up under the key the service worker used.
const { registrableDomain } = await import(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../ext/src/suffixes.js'));
const site = (h) => registrableDomain(h);

/** Bot-wall fingerprints, from the page a denial renders. Recorded, never evaded. */
function wallOf(info, docs) {
  const t = `${info.title} ${info.text}`;
  const last = docs[docs.length - 1];
  if (/Access Denied/i.test(info.title) && /errors\.edgesuite\.net|Reference #/i.test(t)) return 'akamai-access-denied';
  if (/Pardon Our Interruption/i.test(t)) return 'imperva-distil-interruption';
  if (/Press & Hold|px-captcha|Access to this page has been denied/i.test(t)) return 'perimeterx-press-hold';
  if (/captcha-delivery\.com|geo\.captcha-delivery|DataDome/i.test(t) || info.ddFrame) return 'datadome-captcha';
  if (/Just a moment|Checking your browser|cf-chl|Attention Required/i.test(t)) return 'cloudflare-challenge';
  if (/Request unsuccessful\. Incapsula|Incapsula incident/i.test(t)) return 'imperva-incapsula';
  if (last && last.status >= 400) return `http-${last.status}${last.server ? ' ' + last.server : ''}`;
  return null;
}

async function swState(browser) {
  const out = [];
  for (const t of browser.targets()) {
    if (t.type() !== 'service_worker' || !t.url().startsWith('chrome-extension://')) continue;
    try {
      const w = await t.worker();
      const v = await w.evaluate(async () => {
        if (globalThis.LOG) return { probe: globalThis.LOG };
        const all = await chrome.storage.local.get(['stats', 'botManagerSites', 'allowlist']);
        return { stats: all.stats || {}, botManagerSites: all.botManagerSites ?? null, allowlist: all.allowlist ?? [] };
      });
      out.push({ url: t.url(), ...v });
    } catch (e) { out.push({ url: t.url(), error: String(e.message).slice(0, 120) }); }
  }
  return out;
}

const extWorkers = (browser) => browser.targets().filter((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'));

/**
 * The cold-start case: the extension's service worker is NOT running when the navigation starts, so
 * the main_frame webRequest event is what wakes it. Closing the worker's target terminates it; MV3's
 * own 30 s idle timeout is the fallback. Either way the rig checks the worker target is gone and
 * says so in the record (`coldConfirmed`), rather than assuming it.
 */
async function stopWorkers(browser) {
  const cdp = await browser.target().createCDPSession();
  for (const t of extWorkers(browser)) {
    const id = t._targetId ?? t._getTargetInfo?.().targetId;
    if (id) await cdp.send('Target.closeTarget', { targetId: id }).catch(() => {});
  }
  for (let i = 0; i < 50 && extWorkers(browser).length; i++) await new Promise((r) => setTimeout(r, 1000));
  await cdp.detach().catch(() => {});
  return extWorkers(browser).length === 0;
}

async function visit(browser, page, label, n) {
  await page.bringToFront();
  const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable');
  const reqs = new Map(); const docs = new Map(); const extra = new Map(); const failed = [];
  cdp.on('Network.requestWillBeSent', (e) => { reqs.set(e.requestId, { url: e.request.url, type: e.type, frameId: e.frameId }); });
  cdp.on('Network.responseReceived', (e) => {
    if (e.type !== 'Document') return;
    docs.set(e.requestId + ':' + docs.size, { requestId: e.requestId, url: e.response.url, status: e.response.status, frameId: e.frameId,
      server: e.response.headers.server || e.response.headers.Server || '' });
  });
  cdp.on('Network.responseReceivedExtraInfo', (e) => {
    const sc = e.headers['set-cookie'] || e.headers['Set-Cookie'];
    if (sc) extra.set(e.requestId, String(sc).split('\n').map(cookieName));
  });
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId) || {}; failed.push({ url: r.url, type: r.type, error: e.errorText }); });
  const coldConfirmed = opts.cold ? await stopWorkers(browser) : null;
  let navError = null;
  const t0 = Date.now();
  try { await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 }); } catch (e) { navError = e.message.split('\n')[0]; }
  await new Promise((r) => setTimeout(r, SETTLE));
  let info = {};
  try {
    info = await page.evaluate(() => {
      let renderer = null;
      try {
        const gl = document.createElement('canvas').getContext('webgl');
        const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
        renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
      } catch { /* */ }
      return { title: document.title, href: location.href, visibility: document.visibilityState, text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
        webdriver: navigator.webdriver, gpc: navigator.globalPrivacyControl ?? null, cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory ?? null, renderer, ddFrame: !!document.querySelector('iframe[src*="captcha-delivery"]') };
    });
  } catch (e) { info = { title: '', text: '', evalError: String(e.message).slice(0, 120) }; }
  const jar = (await cdp.send('Network.getCookies', { urls: [URL_] })).cookies;
  const cookies = jar.map((c) => c.name).sort();
  // Akamai's `_abck` carries the sensor's verdict in its second `~` field (0 = validated, -1 = not).
  // Only that one field is recorded — never the value itself.
  const abck = jar.find((c) => c.name === '_abck');
  const abckStatus = abck ? (abck.value.split('~')[1] ?? null) : null;
  const docList = [...docs.values()].map(({ requestId, ...d }) => ({ ...d, setCookieNames: extra.get(requestId) || [] }));
  await page.screenshot({ path: path.join(OUT, `${label}-v${n}.png`) }).catch(() => {});
  const blocked = failed.filter((f) => /BLOCKED_BY_CLIENT/.test(f.error)).map((f) => f.url);
  const wall = wallOf(info, docList);
  const ext = await swState(browser);
  const s = site(host(info.href || URL_));
  const extSummary = ext.map((x) => x.probe ? { probe: x.probe } : {
    shimStatus: x.stats?.[s]?.lastShimStatus ?? null, personaId: x.stats?.[s]?.personaId ?? null,
    botManager: x.botManagerSites?.[s] ?? null, botManagerSites: x.botManagerSites ? Object.keys(x.botManagerSites) : null, error: x.error,
  });
  await cdp.detach().catch(() => {});
  return { visit: n, verdict: wall ? 'WALL' : 'OK', wall, coldConfirmed, navError, ms: Date.now() - t0, documents: docList, blockedByClient: blocked.length,
    otherFailures: failed.filter((f) => !/BLOCKED_BY_CLIENT/.test(f.error)).slice(0, 8), cookiesAfterLoad: cookies, abckStatus, page: { ...info, text: info.text?.slice(0, 200) }, extensions: extSummary };
}

/** Send one runtime message from an extension page of the first loaded extension, as the options page would. */
async function sendFromExtensionPage(browser, message) {
  const sw = extWorkers(browser)[0] ?? await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 10000 });
  const id = new URL(sw.url()).host;
  const p = await browser.newPage();
  try {
    await p.goto(`chrome-extension://${id}/options/options.html`, { waitUntil: 'load' });
    return await p.evaluate((msg) => new Promise((res) => chrome.runtime.sendMessage(msg, (r) => res(r ?? { lastError: chrome.runtime.lastError?.message }))), message);
  } finally { await p.close(); }
}

async function run(label, spec) {
  const exts = spec === 'none' ? [] : spec.split('+');
  const userDataDir = opts.profile || fs.mkdtempSync(path.join(os.tmpdir(), 'ne-bm59-'));
  const args = ['--no-first-run', '--window-size=1280,900', '--disable-blink-features=AutomationControlled', ...(opts.chromeArgs ?? [])];
  if (exts.length) args.push(`--disable-extensions-except=${exts.join(',')}`, `--load-extension=${exts.join(',')}`);
  const browser = await puppeteer.launch({ headless: false, userDataDir, args, ignoreDefaultArgs: ['--enable-automation', '--disable-extensions'] });
  if (exts.length) await new Promise((r) => setTimeout(r, 1500));   // let the workers start and run init()
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.bringToFront();
  const visits = [];
  for (let n = 1; n <= VISITS; n++) {
    for (const m of opts.messages ?? []) {
      const i = m.indexOf(':');
      if (Number(m.slice(0, i)) !== n || !exts.length) continue;
      const reply = await sendFromExtensionPage(browser, JSON.parse(m.slice(i + 1)));
      console.log(`   message before v${n}: ${m.slice(i + 1)} → ${JSON.stringify(reply).slice(0, 160)}`);
    }
    visits.push(await visit(browser, page, label, n));
    if (n < VISITS) await new Promise((r) => setTimeout(r, 2500));
  }
  const record = { label, url: URL_, extensions: exts.map((e) => path.basename(e)), cold: !!opts.cold, visits, capturedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT, `${label}.json`), JSON.stringify(record, null, 2));
  for (const v of visits) {
    const e = v.extensions.map((x) => x.probe ? `probe:${x.probe.length}` : `shim=${x.shimStatus?.reason ?? (x.shimStatus?.upgraded ? 'upgraded' : x.shimStatus ? 'other' : '-')} bm=${x.botManager ? x.botManager.vendor + '/' + x.botManager.cookie : '-'}`).join(' ');
    console.log(`== ${label.padEnd(16)} v${v.visit}${v.coldConfirmed === null ? "" : v.coldConfirmed ? " cold" : " COLD?"} ${v.verdict.padEnd(4)} ${String(v.wall ?? '').padEnd(26)} docs ${v.documents.map((d) => `${d.status}${d.server ? ' ' + d.server.slice(0, 14) : ''}[${d.setCookieNames.join(',')}]`).join(' → ')} | gpc ${v.page.gpc} | cores ${v.page.cores} | abck ${v.abckStatus ?? '-'} | ${v.page.visibility ?? '?'} | ${e}`);
  }
  await browser.close();
  if (!opts.profile) fs.rmSync(userDataDir, { recursive: true, force: true });
}

for (let i = 0; i < runs.length; i++) {
  const r = runs[i];
  const eq = r.indexOf('=');
  await run(r.slice(0, eq), r.slice(eq + 1));
  if (i < runs.length - 1) await new Promise((res) => setTimeout(res, PAUSE));
}
console.log('RECORD-DONE');
