#!/usr/bin/env node
/**
 * The blocking proof, checked against the browser. Runs harness/blocking-proof.html in Chrome for
 * Testing and fails unless every row the page reports agrees with Chrome's own network log.
 *
 *   node harness/blocking-proof-check.mjs                  # OFF (no extension), then ON (the store package)
 *   node harness/blocking-proof-check.mjs --off            # OFF only: no package build, no extension
 *   node harness/blocking-proof-check.mjs --ext <dir>      # ON with that unpacked dir instead of the store package
 *   node harness/blocking-proof-check.mjs --page <file>    # a different copy of the page (NEGATIVE CONTROL below)
 *   node harness/blocking-proof-check.mjs --json <file>    # also write every row and every logged request
 *   ... --puppeteer <dir> (also $NULLECHO_PUPPETEER_DIR)   --headful
 *
 * PASS needs, in each run:
 *   1. every row agrees with Chrome's log. harness/blocking-proof-netlog.mjs defines "agrees". In short:
 *      a control the page calls loaded must be a 2xx response Chrome finished loading, and a tracker
 *      the page calls blocked must have failed with no response;
 *   2. the expected result:
 *        OFF  0/6 trackers blocked, 3/3 controls loaded, no net::ERR_BLOCKED_BY_CLIENT on any probe;
 *        ON   the extension's service worker running, 6/6 trackers blocked, every one with
 *             net::ERR_BLOCKED_BY_CLIENT, 3/3 controls loaded.
 * Exit: 0 pass, 1 any disagreement or unexpected result, 2 setup (no puppeteer, package build failed).
 *
 * WHY. On 2026-10-07 the cdn.jsdelivr.net control read "loaded" in every run while Chrome logged the
 * request as net::ERR_ABORTED (Opaque Response Blocking on a no-cors JSON fetch). The page could not
 * see that, and nothing checked. ON runs test THE STORE PACKAGE (`node ext/tools/package.mjs`, unzipped to a
 * temp dir), as harness/site-smoke.mjs and harness/social/make-social-assets.mjs do. `ext/` is never loaded.
 *
 * NEGATIVE CONTROL. The check has to be able to fail. Run it on the page from before the fix (commit
 * 1c009eb, controls fetched no-cors). It must exit 1 with ✗ on cdn.jsdelivr.net, in both runs:
 *   git show 1c009eb:harness/blocking-proof.html > "$TMPDIR/proof-1c009eb.html"
 *   node harness/blocking-proof-check.mjs --page "$TMPDIR/proof-1c009eb.html"
 * A page from before window.__proofDone is read from its text report and its own TRACKERS / CONTROLS lists.
 *
 * The page is served by this script from 127.0.0.1. That avoids the :4886 trap: that port serves the
 * main checkout, not a worktree. The run needs a network connection: OFF really fetches the six tracker
 * library files (see the page's disclosure). Trap carried over from the other harness scripts: a fresh
 * profile is a first install, and the extension opens its options page over the test tab. A hidden tab
 * gives false results, so those pages are closed and visibility is asserted before the click.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordNetwork, compare, formatComparison } from './blocking-proof-netlog.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EXT = path.join(REPO, 'ext');
const BLOCKED_BY_CLIENT = 'net::ERR_BLOCKED_BY_CLIENT';

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const OFF_ONLY = flag('--off');
const EXT_DIR = opt('--ext', null);
const PAGE_FILE = path.resolve(opt('--page', path.join(HERE, 'blocking-proof.html')));
const JSON_OUT = opt('--json', null);
const HEADFUL = flag('--headful');

function loadPuppeteer() {
  const tried = [];
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  for (const dir of [opt('--puppeteer', null), process.env.NULLECHO_PUPPETEER_DIR, '/Users/jasonluker/bodybuilding'].filter(Boolean)) {
    try { return createRequire(path.join(path.resolve(dir), 'package.json'))('puppeteer'); }
    catch (e) { tried.push(`${dir} (${e.code})`); }
  }
  console.error('puppeteer not found: ' + tried.join('; ') + '\n' +
    'Install it, pass --puppeteer <dir whose node_modules has it>, or set NULLECHO_PUPPETEER_DIR.');
  process.exit(2);
}
const puppeteer = loadPuppeteer();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── setup ────────────────────────────────────────────────────────────────────
function buildAndUnpack(work) {
  console.error('building the store package (node ext/tools/package.mjs)…');
  execFileSync('node', ['tools/package.mjs'], { cwd: EXT, stdio: ['ignore', 'ignore', 'inherit'] });
  const version = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
  const zipPath = path.join(REPO, 'dist', `nullecho-${version}-chrome.zip`);
  if (!fs.existsSync(zipPath)) { console.error('package build did not produce ' + zipPath); process.exit(2); }
  const dir = path.join(work, 'ext-unpacked');
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-q', zipPath, '-d', dir]);
  return { version, zip: path.relative(REPO, zipPath), dir };
}

function servePage(file) {
  const html = fs.readFileSync(file);
  const srv = http.createServer((req, res) => {
    if (new URL(req.url, 'http://x').pathname === '/blocking-proof.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(html);
    } else { res.writeHead(404); res.end(); }
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve({ srv, origin: `http://127.0.0.1:${srv.address().port}` })));
}

const isExtWorker = (t) => t.type() === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/src\/background\.js$/.test(t.url());

/** The page's rows: window.__proofDone, or, for a page from before it existed, its text report + its own URL lists. */
const readRows = (page) => page.evaluate(() => {
  if (window.__proofDone) return { verdict: window.__proofDone.verdict, rows: window.__proofDone.rows };
  const report = document.getElementById('report').textContent;
  const states = [...report.matchAll(/^\s+(?:tracker|control)\s+(\S+)/gm)].map((m) => m[1]);
  /* global TRACKERS, CONTROLS */
  const rows = [
    ...TRACKERS.map(([category, url]) => ({ kind: 'tracker', category, url })),
    ...CONTROLS.map(([category, url]) => ({ kind: 'control', category, url })),
  ].map((r, i) => ({ ...r, state: states[i] }));
  return { verdict: (/verdict:\s+(.+)/.exec(report) || [])[1], rows };
});

// ── one run ──────────────────────────────────────────────────────────────────
async function run({ label, extDir, origin }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `nullecho-proofcheck-${label}-`));
  const args = ['--no-first-run', '--no-default-browser-check'];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const browser = await puppeteer.launch({ headless: !HEADFUL, ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], args, userDataDir: profile });
  const out = { label, extension: !!extDir, problems: [] };
  try {
    out.browser = await browser.version();
    if (extDir) {
      const w = await browser.waitForTarget(isExtWorker, { timeout: 15000 }).catch(() => null);
      out.extensionWorker = w ? w.url() : null;
      if (!w) out.problems.push("the extension's service worker never started");
      await browser.waitForTarget((t) => t.type() === 'page' && /^chrome-extension:\/\//.test(t.url()), { timeout: 5000 }).catch(() => null);
    }
    for (const p of await browser.pages()) if (/^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});
    const page = await browser.newPage();
    await page.bringToFront();
    for (const p of await browser.pages()) if (p !== page && /^chrome-extension:\/\//.test(p.url())) await p.close().catch(() => {});

    const net = await recordNetwork(page);
    await page.goto(`${origin}/blocking-proof.html`, { waitUntil: 'load' });
    out.pageUA = await page.evaluate(() => navigator.userAgent);
    const vis = await page.evaluate(() => document.visibilityState);
    if (vis !== 'visible') out.problems.push(`page is ${vis} — a hidden tab gives false results`);
    await page.click('#run');
    await page.waitForFunction(() => document.getElementById('run').textContent === 'Run it again' &&
      !document.getElementById('verdict').hidden, { timeout: 60000 });
    await sleep(1500);                                   // let the last CDP events for the run land
    const { verdict, rows } = await readRows(page);
    out.verdict = verdict;
    out.network = net.entries();
    out.comparison = compare(rows, out.network, { blockedBy: extDir ? BLOCKED_BY_CLIENT : null });
    await net.detach();

    const t = rows.filter((r) => r.kind === 'tracker');
    const c = rows.filter((r) => r.kind === 'control');
    const blocked = t.filter((r) => r.state !== 'loaded').length;
    const loaded = c.filter((r) => r.state === 'loaded').length;
    out.trackersBlocked = `${blocked}/${t.length}`;
    out.controlsLoaded = `${loaded}/${c.length}`;
    const disagree = out.comparison.filter((r) => !r.agree);
    if (disagree.length) out.problems.push(`${disagree.length} row(s) disagree with Chrome's network log: ${disagree.map((r) => `${r.kind} ${r.host}`).join(', ')}`);
    if (loaded !== c.length) out.problems.push(`only ${loaded}/${c.length} controls loaded — network trouble, a CDN change, or an over-broad rule`);
    if (!extDir) {
      if (blocked !== 0) out.problems.push(`${blocked} tracker(s) did not load with no extension installed — the baseline is void (network/DNS filtering?)`);
      const byClient = out.network.filter((e) => e.failed && e.failed.errorText === BLOCKED_BY_CLIENT);
      if (byClient.length) out.problems.push(`${BLOCKED_BY_CLIENT} with no extension installed: ${byClient.map((e) => new URL(e.url).host).join(', ')}`);
    } else if (blocked !== t.length) {
      out.problems.push(`only ${blocked}/${t.length} trackers blocked with the extension in`);
    }
    return out;
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-proofcheck-'));
  const { srv, origin } = await servePage(PAGE_FILE);
  const runs = [];
  let pkg = null;
  try {
    console.log(`page ${PAGE_FILE.startsWith(REPO + path.sep) ? path.relative(REPO, PAGE_FILE) : PAGE_FILE}, served at ${origin}/blocking-proof.html`);
    const plan = [{ label: 'off', extDir: null }];
    if (!OFF_ONLY) {
      if (EXT_DIR) plan.push({ label: 'on', extDir: path.resolve(EXT_DIR) });
      else { pkg = buildAndUnpack(work); plan.push({ label: 'on', extDir: pkg.dir }); }
    }
    for (const p of plan) {
      const r = await run({ ...p, origin });
      runs.push(r);
      console.log(`\n${r.label.toUpperCase()}  ${r.browser}  ${r.extension ? (pkg ? `store package ${pkg.zip}` : `unpacked ${EXT_DIR}`) : 'no extension'}`);
      console.log(`  verdict: ${r.verdict}   trackers blocked ${r.trackersBlocked}   controls loaded ${r.controlsLoaded}`);
      for (const line of formatComparison(r.comparison)) console.log(line);
      for (const pr of r.problems) console.log(`  ✗ ${pr}`);
    }
  } finally {
    srv.close();
    fs.rmSync(work, { recursive: true, force: true });
  }
  const failed = runs.filter((r) => r.problems.length);
  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ made: new Date().toISOString(), page: PAGE_FILE, package: pkg && { version: pkg.version, zip: pkg.zip }, runs }, null, 2) + '\n');
    console.log(`\nwrote ${JSON_OUT}`);
  }
  console.log(failed.length
    ? `\nRESULT: FAIL — ${failed.map((r) => `${r.label}: ${r.problems.length} problem(s)`).join('; ')}`
    : `\nRESULT: PASS — every row agrees with Chrome's network log in ${runs.map((r) => r.label.toUpperCase()).join(' and ')}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
