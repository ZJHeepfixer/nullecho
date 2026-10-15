#!/usr/bin/env node
/**
 * D55 — what Chrome reports about the requests Nullecho blocks, and whether Nullecho's own count agrees.
 *
 *   node ext/tools/package.mjs && unzip -q dist/nullecho-<v>-chrome.zip -d /tmp/cz
 *   node harness/blocked-count-probe.mjs /tmp/cz                    # fixture: badge, getMatchedRules, quota
 *   node harness/blocked-count-probe.mjs /tmp/cz --sites https://www.wired.com/,https://edition.cnn.com/
 *       --puppeteer <dir> | NULLECHO_PUPPETEER_DIR=<dir>   a directory whose node_modules has puppeteer
 *
 * Loads a COPY of the package into Chrome for Testing with `onRuleMatchedDebug` left unused — the one line
 * `const HAS_DEBUG_MATCHES = …` is pinned to `false` in the copy — so the background behaves as a store
 * install does (Chrome gives that event to unpacked builds only). Measurement only; never shipped.
 *
 * Fixture mode (no `--sites`), all traffic resolved to loopback (`--host-resolver-rules`), so nothing leaves
 * the machine: a page with four tracker scripts and five images. Prints Chrome's action-count badge with
 * `displayActionCountAsBadgeText` on, `getMatchedRules` sorted by `classifyMatchedRule`, the worker's
 * webRequest tally, the same for an allowlisted copy of the page, and 25 `getMatchedRules` calls from the
 * worker (the quota). `--sites` mode loads real pages and compares the tally with `getMatchedRules`.
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const SRC = argv.find((a, i) => !a.startsWith('--') && !['--sites', '--puppeteer'].includes(argv[i - 1]));
if (!SRC) { console.error('usage: node harness/blocked-count-probe.mjs <unzipped chrome package> [--sites a,b]'); process.exit(2); }
const SITES = opt('--sites') ? opt('--sites').split(',') : null;
const { classifyMatchedRule } = await import(path.join(path.resolve(SRC), 'src', 'protocol.js'));

function loadPuppeteer() {
  const dirs = [opt('--puppeteer'), process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean);
  for (const t of [() => createRequire(import.meta.url), ...dirs.map((d) => () => createRequire(path.join(path.resolve(d), 'package.json')))]) {
    try { return t()('puppeteer'); } catch (_) { /* next */ }
  }
  console.error('puppeteer not found: pass --puppeteer <dir> or set NULLECHO_PUPPETEER_DIR'); process.exit(2);
}
const puppeteer = loadPuppeteer();

const EXT = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-count-'));
fs.cpSync(path.resolve(SRC), EXT, { recursive: true });
const bgPath = path.join(EXT, 'src', 'background.js');
const anchor = 'const HAS_DEBUG_MATCHES = !!api.declarativeNetRequest?.onRuleMatchedDebug;';
const bg = fs.readFileSync(bgPath, 'utf8');
if (!bg.includes(anchor)) { console.error('pre-D55 package: no HAS_DEBUG_MATCHES line to pin'); process.exit(2); }
fs.writeFileSync(bgPath, bg.replace(anchor, 'const HAS_DEBUG_MATCHES = false; // MEASUREMENT COPY: behave as a store install'));

const TRACKERS = ['https://www.google-analytics.com/analytics.js', 'https://connect.facebook.net/en_US/fbevents.js',
  'https://securepubads.g.doubleclick.net/tag/js/gpt.js', 'https://cdn.amplitude.com/libs/amplitude-8.21.9-min.gz.js'];
const PAGE = `<!doctype html><title>count</title><body>${TRACKERS.map((u) => `<script src="${u}"></script>`).join('')}${[1, 2, 3, 4, 5].map((i) => `<img src="/img${i}.png">`).join('')}</body>`;
const srv = http.createServer((q, r) => {
  if (q.url.startsWith('/img')) { r.writeHead(200, { 'content-type': 'image/png' }); r.end(); return; }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE);
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const fixture = `http://127.0.0.1:${srv.address().port}/`;

const args = [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--window-size=1400,900'];
if (!SITES) args.push('--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE 127.0.0.1');
const browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: true, protocolTimeout: 120000,
  ignoreDefaultArgs: ['--disable-extensions'], args });
const sw = await browser.waitForTarget((t) => t.type() === 'service_worker' && /\/src\/background\.js$/.test(t.url()), { timeout: 20000 });
const worker = await sw.worker();
const extId = new URL(sw.url()).host;
await new Promise((r) => setTimeout(r, 1500));

/** Load `url` in a fresh tab; return the badge, getMatchedRules (sorted) and the worker's tally for that tab. */
async function measure(url, settleMs) {
  const p = await browser.newPage();
  let loadError = null;
  try { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); } catch (e) { loadError = String(e.message).slice(0, 80); }
  await new Promise((r) => setTimeout(r, settleMs));
  const at = p.url();
  const raw = await worker.evaluate(async (u) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === u);
    if (!tab) return { error: 'tab not found' };
    await new Promise((res) => setTimeout(res, 800));
    const tally = (await chrome.storage.session.get('nullecho:tab-blocked'))['nullecho:tab-blocked']?.[tab.id] ?? { total: 0, byCategory: {} };
    let matched = null, matchError = null;
    try { matched = (await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id })).rulesMatchedInfo.map((m) => m.rule); }
    catch (e) { matchError = String(e.message || e); }
    return { badge: await chrome.action.getBadgeText({ tabId: tab.id }), tally, matched, matchError };
  }, at);
  await p.close();
  const sorted = { blocked: 0, byCategory: {}, ignored: 0, stripped: 0 };
  for (const m of raw.matched ?? []) {
    const c = classifyMatchedRule(m);
    if (c.outcome === 'blocked') { sorted.blocked++; sorted.byCategory[c.category] = (sorted.byCategory[c.category] || 0) + 1; }
    else sorted[c.outcome]++;
  }
  return { url, loadError, badge: raw.badge, getMatchedRules: raw.matched ? sorted : raw.matchError, rawMatches: raw.matched?.length ?? null,
    tally: raw.tally, agree: raw.matched ? sorted.blocked === raw.tally.total : null };
}

const out = { chrome: await browser.version(), mode: SITES ? 'sites' : 'fixture' };
try {
  if (SITES) {
    out.rows = [];
    for (const u of SITES) { const row = await measure(u, 6000); out.rows.push(row); console.error(JSON.stringify(row)); }
    out.allAgree = out.rows.every((r) => r.agree !== false);
  } else {
    await worker.evaluate(() => chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true }));
    out.page = await measure(fixture, 1500);
    const ext = await browser.newPage();
    await ext.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'load' });
    await ext.evaluate((u) => new Promise((res) => chrome.runtime.sendMessage({ type: 'nullecho:set-site-enabled', url: u, enabled: false }, res)), fixture);
    await new Promise((r) => setTimeout(r, 800));
    out.allowlistedPage = await measure(fixture, 1500);
    await ext.evaluate((u) => new Promise((res) => chrome.runtime.sendMessage({ type: 'nullecho:set-site-enabled', url: u, enabled: true }, res)), fixture);
    out.quotaFromWorker = await worker.evaluate(async () => {
      const res = [];
      for (let i = 0; i < 25; i++) {
        try { await chrome.declarativeNetRequest.getMatchedRules({}); res.push('ok'); } catch (e) { res.push(String(e.message || e)); }
      }
      return res;
    });
    out.quotaFirstFailure = out.quotaFromWorker.findIndex((x) => x !== 'ok');
  }
  console.log(JSON.stringify(out, null, 1));
} finally {
  await browser.close(); srv.close();
  fs.rmSync(EXT, { recursive: true, force: true });
}
