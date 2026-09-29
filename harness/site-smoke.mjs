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
 *   node harness/site-smoke.mjs --seeded                  # SEEDED LEARNED STATE — the D50 release gate (below)
 *   npm run smoke:seeded   (from ext/)
 *   node harness/site-smoke.mjs --seeded --learner-from 'b42beb4^'   # NEGATIVE CONTROL: same zip, learner files
 *                                                          # swapped for that commit's (pre-D50) — reCAPTCHA must FAIL
 *   node harness/site-smoke.mjs --third-party              # the third-party embed rows, fresh profile (no seed)
 *
 * SEEDED MODE (`--seeded`, DECISIONS.md D50, BREAKAGE-TESTING 2026-09-28). Every other run starts from a
 * fresh profile, and the heuristic LEARNER is the one layer whose behaviour changes with use: on 2026-09-28 a
 * learned `google.com` block took reCAPTCHA and Google sign-in off every third-party page in the owner's
 * Chrome while every automated check was green. So in every ON browser of a seeded run, BEFORE any site:
 *   1. the extension's service worker writes the learner's storage record (`nullecho:heuristics:v1`, key
 *      read out of the packaged heuristics.js) exactly as the learner writes it — status `blocked`, three
 *      distinct first-party sites of live signal bits, `source: 'learned'`, rule ids from the heuristic
 *      block range (protocol.js) — for google.com, youtube.com, facebook.com, microsoft.com, live.com,
 *      microsoftonline.com, apple.com, cloudflare.com, amazon.com, twitter.com, x.com, linkedin.com;
 *   2. the extension is RELOADED the way chrome://extensions' reload arrow and an update do (CDP
 *      `Extensions.loadUnpacked` on the same path: same id, new worker, `onInstalled` fires — shown by the
 *      pre-D50 control reproducing the install()/onInstalled reconcile race, which needs both callers), so the
 *      SHIPPED `install()` + `onInstalled` run the shipped `reconcile()`. The harness never writes a DNR rule;
 *   3. POSITIVE CONTROL: `getDynamicRules()` is read back from the new worker and printed. Every seeded
 *      domain must have a live rule in the learned ranges, none of them may have existed before the reload,
 *      the extension id must be unchanged and its static blocking rulesets still on, and a third-party fetch
 *      to www.linkedin.com from the fixture page must be stopped by the seeded linkedin.com rule AND seen by
 *      the recorder (4) — otherwise the run ABORTS (exit 3). A seed that silently did nothing would turn
 *      every row into a pass. (Attacked 2026-09-28: seeding under a wrong storage key → exit 3, 24 ✗.)
 *   4. an `onRuleMatchedDebug` recorder in the worker attributes every learned-rule match to the row it
 *      happened in, and the rules are dumped again at the end of the pass (a promotion or removal mid-run
 *      is reported). Every learned BLOCK in any row is checked against the current NEVER_BLOCK +
 *      COOKIE_BLOCK_ONLY lists — the D50 invariant over ALL traffic, so a protected host blocked behind a
 *      row whose own check still passes is a FAIL too.
 * The worker console during the reload is captured: a `[nullecho]` warning/error there (the pre-D50
 * concurrent-reconcile race: "Rule with id … does not have a unique ID") is a finding, not noise.
 * `--seeded` adds the THIRD-PARTY rows (reCAPTCHA v2 on two unrelated sites, reCAPTCHA Enterprise, Turnstile,
 * hCaptcha, Google Sign-In on two sites, YouTube / Maps / Calendar embeds, and two POLICY rows — the Facebook
 * SDK Page plugin and an embedded X post — whose providers no policy list protects today; a learned block
 * there is reported as POLICY-BLOCKED, not hidden and not counted as a regression). Exit code: 3 seeding
 * failed, 1 any FAIL/VOID/seeding finding, 0 clean.
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
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The learned-rule id ranges come from the extension's own protocol table, never a copy (seeded mode).
import { DYNAMIC_RULE_RANGES } from '../ext/src/protocol.js';
// …and the protected lists are the CURRENT policy, read from the source tree (also in a control run: the
// yardstick is what policy says must never be blocked today, whatever build is under test).
import { NEVER_BLOCK, COOKIE_BLOCK_ONLY } from '../ext/src/allowlist.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const EXT = path.join(REPO, 'ext');

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const flag = (name) => argv.includes(name);
const HEADFUL = flag('--headful');
const OFF_ONLY = flag('--off');
const SEEDED = flag('--seeded');
const THIRD_PARTY = SEEDED || flag('--third-party');
const LEARNER_FROM = opt('--learner-from', null);
const ONLY = (opt('--only', null) || '').split(',').filter(Boolean);
const MAX_RUNTIME_MS = Number(opt('--max-runtime', String((SEEDED || THIRD_PARTY ? 35 : 23) * 60 * 1000)));
if (OFF_ONLY && (SEEDED || LEARNER_FROM)) {
  console.error('--off cannot be combined with --seeded / --learner-from: seeding needs the extension.');
  process.exit(2);
}
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

const sha256Of = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * The commit the run tested, and whether ext/ or harness/ had uncommitted edits. It goes into the report NAME:
 * two runs on one day used to write the same `<date>-site-smoke.md`, and on 2026-09-28 two branches committed
 * different runs under that one path (D51's and the seeded-smoke branch's) — the later one silently replaced
 * the evidence of the earlier. `-dirty` means the tested code is not any commit.
 */
function codeProvenance() {
  const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    const head = git('rev-parse', '--short=7', 'HEAD');
    const dirty = git('status', '--porcelain', '--', 'ext', 'harness').length > 0;
    return { head, dirty, tag: head + (dirty ? '-dirty' : '') };
  } catch { return { head: null, dirty: null, tag: 'nogit' }; }
}

/**
 * NEGATIVE CONTROL ONLY (`--learner-from <rev>`): overwrite the learner's two files in the UNPACKED STORE ZIP
 * with that revision's copies — for `b42beb4^` that is exactly the pre-D50 runtime (D50 changed no other shipped
 * file). The temp dir is thrown away with the run; nothing is committed. A swap that changes nothing is not a
 * control, so identical bytes abort the run.
 */
function swapLearner(unpackDir, rev) {
  const revSha = execFileSync('git', ['rev-parse', '--verify', `${rev}^{commit}`], { cwd: REPO, encoding: 'utf8' }).trim();
  const files = {};
  let changed = 0;
  for (const f of ['heuristics.js', 'allowlist.js']) {
    const dest = path.join(unpackDir, 'src', f);
    const before = fs.readFileSync(dest, 'utf8');
    const src = execFileSync('git', ['show', `${revSha}:ext/src/${f}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 16 << 20 });
    fs.writeFileSync(dest, src);
    if (src !== before) changed++;
    files[f] = { packagedSha256: sha256Of(before), swappedSha256: sha256Of(src), identical: src === before };
  }
  if (!changed) throw new Error(`--learner-from ${rev}: both files are identical to the package — that is not a control`);
  console.error(`[site-smoke] ⚠ CONTROL BUILD: src/heuristics.js + src/allowlist.js swapped for ${rev} (${revSha.slice(0, 7)}) in ${unpackDir}`);
  return { rev, revSha, files };
}

// ── 2. browser launch / page setup ──────────────────────────────────────────
/**
 * `seeded` adds `pipe` + `enableExtensions` (puppeteer then passes --enable-unsafe-extension-debugging instead of
 * --disable-extensions), which is what CDP `Extensions.loadUnpacked` — the reload in seedLearnedState — needs.
 * The extension itself is still loaded the same way as in every other run: --load-extension on the unpacked zip.
 */
async function launchBrowser({ extDir, profile, seeded = false }) {
  const args = ['--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required', '--window-size=1400,900'];
  if (extDir) args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  const launchOpts = { headless: !HEADFUL, ignoreDefaultArgs: extDir ? ['--disable-extensions'] : [], args, userDataDir: profile };
  if (seeded) Object.assign(launchOpts, { pipe: true, enableExtensions: true });
  const browser = await puppeteer.launch(launchOpts);
  const version = await browser.version();
  return { browser, version };
}

const isExtensionWorker = (t) => t.type() === 'service_worker' && /^chrome-extension:\/\/[a-p]{32}\/src\/background\.js$/.test(t.url());

/** Is an extension actually in this browser? The OFF pass must have none; the ON pass must have its worker. */
async function extensionPresence(browser, { waitMs }) {
  const t = waitMs ? await browser.waitForTarget(isExtensionWorker, { timeout: waitMs }).catch(() => null) : null;
  const all = browser.targets().filter((x) => /^chrome-extension:\/\//.test(x.url())).map((x) => `${x.type()} ${x.url()}`);
  return { worker: t ? t.url() : (browser.targets().find(isExtensionWorker)?.url() ?? null), extensionTargets: all };
}

// ── 2b. seeded learned state (D50) ──────────────────────────────────────────
/** The big multi-service registrable domains — the ones whose learned rule can reach a protected service. */
const SEED_DOMAINS = ['google.com', 'youtube.com', 'facebook.com', 'microsoft.com', 'live.com', 'microsoftonline.com',
  'apple.com', 'cloudflare.com', 'amazon.com', 'twitter.com', 'x.com', 'linkedin.com'];
const [BLOCK_BASE, BLOCK_MAX] = DYNAMIC_RULE_RANGES.heuristicBlock;
const [COOKIE_BASE, COOKIE_MAX] = DYNAMIC_RULE_RANGES.heuristicCookie;
const isLearnedBlockId = (id) => id >= BLOCK_BASE && id <= BLOCK_MAX;
const isLearnedCookieId = (id) => id >= COOKIE_BASE && id <= COOKIE_MAX;
const isLearnedId = (id) => isLearnedBlockId(id) || isLearnedCookieId(id);

/** The learner's storage key, read from the heuristics.js actually being loaded (store zip, or the control swap). */
function learnerStorageKey(unpackDir) {
  const src = fs.readFileSync(path.join(unpackDir, 'src', 'heuristics.js'), 'utf8');
  const m = src.match(/const STORAGE_KEY = '([^']+)'/);
  if (!m) throw new Error('SEEDING: could not find `const STORAGE_KEY = \'…\'` in the loaded src/heuristics.js — the seed format has drifted; update the harness');
  return m[1];
}

/**
 * One learner record per domain, in the shape `recordSignal` + `applyAction` leave behind after a promotion:
 * three distinct first-party sites carrying live signal bits (COOKIE=1, SET_COOKIE=2 — `normaliseStored` keeps
 * them), status 'blocked', a rule id from the heuristic block range, `source: 'learned'` (never 'user').
 */
function seedRecords() {
  const now = Date.now();
  const domains = {};
  SEED_DOMAINS.forEach((d, i) => {
    domains[d] = {
      sites: { 'site-a.example': 1, 'site-b.example': 2, 'site-c.example': 3 },
      status: 'blocked', ruleId: BLOCK_BASE + i, firstSeen: now - 7 * 86400000, lastSeen: now, source: 'learned',
    };
  });
  return { version: 1, domains };
}

class SeedingError extends Error {}

const learnedOnly = (rules) => rules.filter((r) => isLearnedId(r.id)).sort((a, b) => a.id - b.id);
const ruleLine = (r) => `${r.id} ${r.action.type}${r.action.type === 'modifyHeaders' ? '(strip Cookie/Set-Cookie)' : ''} requestDomains=[${(r.condition.requestDomains || []).join(',')}] excluded=[${(r.condition.excludedRequestDomains || []).join(',')}] ${r.condition.domainType || ''}`;

/**
 * Seed → reload → prove. Returns a handle the row runner uses to attribute learned-rule matches to rows.
 * Throws SeedingError (the run aborts, exit 3) if the learned rules are not live afterwards.
 */
async function seedLearnedState(browser, unpackDir) {
  const report = { domains: SEED_DOMAINS.slice(), storageKey: null, extensionId: null, rulesBeforeReload: null, rulesAfterReload: null, stateAfterReload: null, reloadWorkerConsole: [], positiveControl: [], ok: false, findings: [] };
  report.storageKey = learnerStorageKey(unpackDir);
  const sw1 = await browser.waitForTarget(isExtensionWorker, { timeout: 20000 }).catch(() => null);
  if (!sw1) throw new SeedingError('SEEDING: the extension service worker never appeared — nothing to seed');
  const swUrl = sw1.url();
  report.extensionId = new URL(swUrl).host;
  const w1 = await sw1.worker();
  // chrome.storage is bound a beat after the worker target appears (unpacked-chrome.mjs serviceWorker()).
  let before = null;
  for (let i = 0; i < 10 && !before; i++) {
    before = await w1.evaluate(() => chrome.declarativeNetRequest.getDynamicRules()).catch(() => null);
    if (!before) await sleep(400);
  }
  if (!before) throw new SeedingError('SEEDING: could not read getDynamicRules() from the first worker');
  report.rulesBeforeReload = learnedOnly(before);

  const seed = seedRecords();
  await w1.evaluate(async (key, value) => { await chrome.storage.local.set({ [key]: value }); }, report.storageKey, seed);
  const readBack = await w1.evaluate(async (key) => (await chrome.storage.local.get(key))[key], report.storageKey);
  if (!readBack || Object.keys(readBack.domains || {}).length !== SEED_DOMAINS.length) throw new SeedingError('SEEDING: the storage write did not read back');

  // Reload exactly as the reload arrow / an update does. Attach to the NEW worker the moment it is created so
  // its console (reconcile races, boot-step failures) is captured from the first line.
  const newWorker = new Promise((resolve) => {
    const onCreated = async (t) => {
      if (t === sw1 || !isExtensionWorker(t) || t.url() !== swUrl) return;
      browser.off('targetcreated', onCreated);
      try {
        const w = await t.worker();
        w.on('console', (m) => report.reloadWorkerConsole.push(`${m.type()}: ${m.text().replace(/\s+/g, ' ').slice(0, 300)}`));
        resolve({ target: t, worker: w });
      } catch (e) { resolve({ error: e }); }
    };
    browser.on('targetcreated', onCreated);
  });
  const reloadedId = await browser.installExtension(unpackDir);
  if (reloadedId !== report.extensionId) throw new SeedingError(`SEEDING: the reload installed a different extension (${reloadedId} ≠ ${report.extensionId})`);
  const nw = await withTimeout(newWorker, 20000, 'new service worker after the reload').catch((e) => ({ error: e }));
  if (nw.error) throw new SeedingError('SEEDING: no new service worker after the reload — ' + (nw.error.message || nw.error));
  const w2 = nw.worker;

  // reconcile() runs asynchronously from install() and onInstalled; wait until every seeded domain is covered
  // and the rule set has stopped changing, or give up after 15 s and let the positive control fail loudly.
  let after = [];
  let lastSig = null;
  let stableFor = 0;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await sleep(500);
    const live = await w2.evaluate(() => chrome.declarativeNetRequest.getDynamicRules()).catch(() => null);
    if (!live) continue;
    after = learnedOnly(live);
    const sig = JSON.stringify(after);
    const covered = SEED_DOMAINS.every((d) => after.some((r) => (r.condition.requestDomains || []).includes(d)));
    stableFor = sig === lastSig ? stableFor + 1 : 0;
    lastSig = sig;
    if (covered && stableFor >= 2) break;
  }
  report.rulesAfterReload = after;
  const state = await w2.evaluate(async (key) => (await chrome.storage.local.get(key))[key], report.storageKey).catch(() => null);
  report.stateAfterReload = state && state.domains
    ? Object.fromEntries(Object.entries(state.domains).map(([d, r]) => [d, { status: r.status, ruleId: r.ruleId, source: r.source ?? null }]))
    : null;

  report.enabledRulesetsAfterReload = await w2.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets()).catch(() => null);

  // ── POSITIVE CONTROL ──
  const pc = report.positiveControl;
  const check = (ok, what) => { pc.push({ ok: !!ok, what }); return ok; };
  check(report.rulesBeforeReload.length === 0, `no learned-range rule existed before the reload (found ${report.rulesBeforeReload.length}) — so every rule below was written by the extension's reconcile(), not left over`);
  const blockingSets = ['ads', 'analytics', 'social', 'fingerprinting'];
  check(Array.isArray(report.enabledRulesetsAfterReload) && blockingSets.every((id) => report.enabledRulesetsAfterReload.includes(id)),
    `the reloaded extension still has its static blocking rulesets on (${JSON.stringify(report.enabledRulesetsAfterReload)}) — the seeded ON pass is the whole extension plus the learned rules, not a lesser one`);
  for (const d of SEED_DOMAINS) {
    const r = after.find((x) => (x.condition.requestDomains || []).includes(d));
    const rec = report.stateAfterReload && report.stateAfterReload[d];
    check(!!r, `${d}: a live learned rule covers it${r ? ` (id ${r.id}, ${r.action.type})` : ' — NONE'}`);
    check(rec && (rec.status === 'blocked' || rec.status === 'cookieblocked') && r && rec.ruleId === r.id,
      `${d}: stored record is promoted and points at that live rule (status ${rec ? rec.status : 'missing'}, ruleId ${rec ? rec.ruleId : '-'})`);
  }
  report.ok = pc.every((c) => c.ok);
  const noisy = report.reloadWorkerConsole.filter((l) => /^(error|warn(ing)?):/.test(l) && /nullecho/i.test(l));
  if (noisy.length) report.findings.push(...noisy.map((l) => `worker console during the reload: ${l}`));

  console.error(`[site-smoke] SEEDED ${SEED_DOMAINS.length} learned domains into ${report.extensionId}; live learned rules after reload (${after.length}):`);
  for (const r of after) console.error('    ' + ruleLine(r));
  for (const f of report.findings) console.error('  ⚠ ' + f);
  if (!report.ok) {
    for (const c of pc.filter((x) => !x.ok)) console.error('  ✗ ' + c.what);
    const err = new SeedingError('SEEDING POSITIVE CONTROL FAILED — the learned rules are not live, so every row of this run would be meaningless');
    err.report = report;
    throw err;
  }

  // Attribution: every match of a DYNAMIC rule, recorded inside the worker (unpacked + declarativeNetRequestFeedback
  // → onRuleMatchedDebug exists). The runner drains it before and after each row.
  const recorder = async (w) => w.evaluate(() => {
    if (globalThis.__smokeHits) return 'present';
    globalThis.__smokeHits = [];
    if (!chrome.declarativeNetRequest.onRuleMatchedDebug) return 'unavailable';
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((i) => {
      if (i.rule.rulesetId !== '_dynamic') return;
      globalThis.__smokeHits.push({ t: Date.now(), ruleId: i.rule.ruleId, type: i.request.type, url: String(i.request.url).slice(0, 220), initiator: i.request.initiator || null });
    });
    return 'installed';
  });
  report.recorder = await recorder(w2);

  // POSITIVE CONTROL, part 2 — the rules are ENFORCED on page traffic and the recorder SEES it. Without this, a
  // clean row (and "0 protected-host blocks") could just mean a dead recorder. A third-party fetch from the
  // fixture page to www.linkedin.com must match the seeded linkedin.com rule and show up in the recorder.
  {
    const lr = after.find((r) => (r.condition.requestDomains || []).includes('linkedin.com'));
    const page = await browser.newPage();
    let probe = { fetched: null, hits: [] };
    try {
      await page.goto(`${FIXTURE.origin}/third-party-embeds.html?e=none`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await w2.evaluate(() => { globalThis.__smokeHits && globalThis.__smokeHits.splice(0); });
      probe.fetched = await page.evaluate(() => fetch('https://www.linkedin.com/robots.txt', { mode: 'no-cors', cache: 'no-store' }).then(() => 'loaded', (e) => 'failed: ' + e.message));
      await sleep(1000);
      probe.hits = await w2.evaluate(() => (globalThis.__smokeHits || []).splice(0));
    } catch (e) { probe.error = String(e.message || e); } finally { await page.close().catch(() => {}); }
    report.enforcementProbe = probe;
    const seen = !!lr && probe.hits.some((h) => h.ruleId === lr.id);
    const blockedAsExpected = !lr || !isLearnedBlockId(lr.id) || /^failed/.test(String(probe.fetched));
    check(seen && blockedAsExpected, `enforcement + recorder: a fetch from ${FIXTURE.origin} to www.linkedin.com matched learned rule ${lr ? lr.id : '(none)'} and the recorder saw it (fetch ${probe.fetched}; ${probe.hits.length} hit(s))`);
    report.ok = pc.every((c) => c.ok);
    if (!report.ok) {
      const err = new SeedingError('SEEDING POSITIVE CONTROL FAILED — learned rules are present but not enforced on page traffic, or the match recorder is blind');
      err.report = report;
      throw err;
    }
  }
  let worker = w2;
  const handle = {
    report,
    ruleById: new Map(after.map((r) => [r.id, r])),
    /** Take and clear the hits. Re-attaches (and says so) if the worker was restarted underneath us. */
    async drain() {
      try {
        const out = await worker.evaluate(() => (globalThis.__smokeHits ? globalThis.__smokeHits.splice(0) : null));
        if (out) return { hits: out, recorderRestarted: false };
      } catch { /* worker gone */ }
      const t = browser.targets().find(isExtensionWorker);
      if (!t) return { hits: [], recorderRestarted: true, note: 'no extension worker to read hits from' };
      worker = await t.worker();
      await recorder(worker).catch(() => {});
      return { hits: [], recorderRestarted: true, note: 'worker restarted — hits before this point lost' };
    },
    async dumpRules() {
      try { return learnedOnly(await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules())); }
      catch {
        const t = browser.targets().find(isExtensionWorker);
        if (!t) return null;
        worker = await t.worker();
        return learnedOnly(await worker.evaluate(() => chrome.declarativeNetRequest.getDynamicRules()));
      }
    },
  };
  return handle;
}

/**
 * The D50 invariant, checked on ALL of a row's traffic rather than only what its functional check looks at:
 * a learned BLOCK rule must never match a request to a NEVER_BLOCK host (path-scoped entries such as
 * `www.google.com/recaptcha/` by host+path) or a COOKIE_BLOCK_ONLY host (the yellowlist is strip-never-block).
 * Returns the list entry the URL falls under, or null.
 */
function protectedEntryFor(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const hostPath = host + u.pathname;
  for (const [list, entries] of [['NEVER_BLOCK', NEVER_BLOCK], ['COOKIE_BLOCK_ONLY', COOKIE_BLOCK_ONLY]]) {
    for (const raw of entries) {
      const e = raw.toLowerCase();
      if (e.includes('/') ? hostPath.startsWith(e) : (host === e || host.endsWith('.' + e))) return `${list}: ${raw}`;
    }
  }
  return null;
}

/** Name a hit for a report line: which learned rule, what it did, to what. */
function describeHit(h, ruleById) {
  const r = ruleById && ruleById.get(h.ruleId);
  const dom = r ? (r.condition.requestDomains || []).join(',') : '?';
  const act = isLearnedBlockId(h.ruleId) ? 'BLOCKED' : isLearnedCookieId(h.ruleId) ? 'cookie-stripped' : 'matched';
  return `learned rule ${h.ruleId} (${dom}) ${act} ${h.type} ${h.url}`;
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

const NETWORK_DOWN = /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_NAME_NOT_RESOLVED|ERR_ADDRESS_UNREACHABLE|ERR_NETWORK_ACCESS_DENIED|ERR_PROXY_CONNECTION_FAILED/;

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
  // A request an extension blocked has NO HTTP status — it fails with net::ERR_BLOCKED_BY_CLIENT. That error
  // text is the evidence; a "status" from any tool that reports failed requests is not (2026-09-28: a tool
  // printed 503 for every blocked request and sent a whole triage after response headers).
  const blockedByClient = [];
  page.on('requestfailed', (req) => {
    const err = req.failure() && req.failure().errorText;
    if (err && /ERR_BLOCKED_BY_CLIENT/.test(err)) blockedByClient.push(`${req.resourceType()} ${req.url().slice(0, 200)}`);
  });
  return { page, consoleLines, blockedByClient };
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
  return await page.evaluate(async () => {
    // D51: what the page is told about the BROWSER must be the same with the
    // extension on and off — the real UA, brands and full version. Until 2026-09-28
    // the ON pass said Chrome/151 while this Chrome for Testing was 146/149.
    const u = navigator.userAgentData;
    let full = null;
    try { if (u) full = JSON.stringify((await u.getHighEntropyValues(['fullVersionList', 'uaFullVersion']))); } catch (_) { full = 'error'; }
    return {
      gpc: navigator.globalPrivacyControl,
      cores: navigator.hardwareConcurrency ?? null,
      mem: navigator.deviceMemory ?? null,
      ua: navigator.userAgent,
      brands: u ? JSON.stringify(u.brands) : null,
      full,
    };
  }).catch(() => ({ gpc: undefined, cores: null, mem: null, ua: null, brands: null, full: null }));
}

/** D51: the browser the ON pass describes is the one the OFF pass describes. */
function browserIdentityReasons(ctx) {
  const off = ctx.offProbes, on = ctx.probes;
  if (!off || !on) return [];
  const out = [];
  for (const k of ['ua', 'brands', 'full']) {
    if (off[k] !== on[k]) out.push(`browser identity ${k} differs ON vs OFF (D51): ${String(on[k]).slice(0, 80)} vs ${String(off[k]).slice(0, 80)}`);
  }
  return out;
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
      reasons.push(...browserIdentityReasons(ctx));
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
      // The bot wall can land on the ARTICLE fetch instead of the homepage (2026-09-28: OFF got the homepage,
      // then a 403 on the article, while ON got the 403 on the homepage). Both are the same wall; calling the
      // OFF one a functional failure turned it into a false "blocked ON only" FAIL.
      const articleStatus = resp && typeof resp.status === 'function' ? resp.status() : null;
      if (articleStatus === 403 || articleStatus === 429) {
        return { ok: false, blocked: true, blockedEvidence: `article fetch HTTP ${articleStatus} (bot wall) — ${articleHref}`, detail: { home, articleHref, httpStatus: articleStatus } };
      }
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

// ── 4b. third-party rows — what a LEARNED rule can break (D50) ───────────────
// Every row is an embed on a site that is NOT the provider's own domain: a learned rule is
// `domainType: thirdParty`, so the provider's own demo page (row 3, google.com/recaptcha/api2/demo) can never
// show the break — that is exactly why the 2026-09-28 reCAPTCHA break passed the smoke. Each check needs
// positive evidence of a RENDER: the provider's frame exists, is navigated to the provider (a blocked frame
// becomes chrome-error://chromewebdata/ and matches no provider pattern), has a non-zero box, and — where the
// frame is readable — contains the widget. Never a network status.
//
// `fixture` rows load harness/fixtures/third-party-embeds.html from a 127.0.0.1 server the smoke starts.
// `policy: true` rows are providers no policy list protects today (facebook.com, twitter.com): if a learned
// BLOCK rule is what removed them, the verdict is POLICY-BLOCKED — reported loudly, not counted as a
// regression, because no decision has said they must survive a learned block. Any other failure is a FAIL.

let FIXTURE = { origin: null };
const urlOf = (site) => (site.fixture ? `${FIXTURE.origin}/${site.fixture}` : site.url);
let FRAME_WAIT_MS = 15000;   // the self-test lowers it: it runs every check on a page with nothing to wait for

/**
 * Wait up to `timeoutMs` for a frame whose URL matches `urlRe`, then require a non-zero box (via the frame's
 * owner element — works through closed shadow roots, e.g. Turnstile) and, if given, `probe` true inside it.
 */
async function providerFrame(page, urlRe, { timeoutMs = FRAME_WAIT_MS, minW = 1, minH = 1, probe = null } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = { found: false };
  for (;;) {
    for (const f of page.frames()) {
      if (f === page.mainFrame() || !urlRe.test(f.url())) continue;
      let box = null;
      try { const el = await f.frameElement(); box = el ? await el.boundingBox() : null; } catch { /* detached */ }
      let content = null;
      if (probe) content = await f.evaluate(probe).catch((e) => ({ ok: false, evalError: String(e.message || e).slice(0, 120) }));
      const rendered = !!box && box.width >= minW && box.height >= minH;
      last = { found: true, url: f.url().slice(0, 160), box: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null, content };
      if (rendered && (!probe || (content && content.ok))) return { ok: true, ...last };
    }
    if (Date.now() >= deadline) break;
    await sleep(500);
  }
  const errorFrames = page.frames().filter((f) => /^chrome-error:/.test(f.url())).length;
  return { ok: false, ...last, errorFrames };
}

const RECAPTCHA_ANCHOR = /^https:\/\/www\.(google\.com|recaptcha\.net)\/recaptcha\/(api2|enterprise)\/anchor/;

// Each check waits for the provider's FRAME first and reads the page-side API after: the API script loads
// async, so reading it at settle time reported an SDK "missing" that rendered a second later (2026-09-28).
async function recaptchaCheck(page, { enterprise = false } = {}) {
  const anchor = await providerFrame(page, RECAPTCHA_ANCHOR, {
    minW: enterprise ? 50 : 250, minH: enterprise ? 30 : 60,
    probe: () => ({ ok: !!document.querySelector('.rc-anchor'), checkbox: !!document.querySelector('#recaptcha-anchor'), text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 60) }),
  });
  const api = await page.evaluate((ent) => {
    const g = window.grecaptcha;
    const a = ent ? g && g.enterprise : g;
    return { grecaptcha: typeof g, ready: !!(a && (typeof a.render === 'function' || typeof a.execute === 'function')) };
  }, enterprise).catch(() => ({ grecaptcha: 'error', ready: false }));
  return { ok: api.ready && anchor.ok, detail: { api, anchor } };
}

const THIRD_PARTY_SITES = [
  {
    key: 'tp-recaptcha-patrickhlauke', n: 15, label: 'reCAPTCHA v2 on patrickhlauke.github.io', url: 'https://patrickhlauke.github.io/recaptcha/', settleMs: 2500,
    protects: 'www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com',
    async check(page) { return recaptchaCheck(page); },
  },
  {
    key: 'tp-recaptcha-ascendpartner', n: 16, label: 'reCAPTCHA v2 on ascendpartner.com signup', url: 'https://www.ascendpartner.com/affiliate/registration?usertype=2', settleMs: 3000,
    protects: 'www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com',
    async check(page) { return recaptchaCheck(page); },
  },
  {
    key: 'tp-recaptcha-enterprise-reddit', n: 17, label: 'reCAPTCHA Enterprise (invisible) on reddit.com/login', url: 'https://www.reddit.com/login/', settleMs: 4000,
    protects: 'www.google.com/recaptcha/enterprise (NEVER_BLOCK) under a learned google.com',
    async check(page) { return recaptchaCheck(page, { enterprise: true }); },
  },
  {
    key: 'tp-turnstile-peet', n: 18, label: 'Cloudflare Turnstile on peet.ws', url: 'https://peet.ws/turnstile-test/non-interactive.html', settleMs: 3000,
    protects: 'challenges.cloudflare.com (NEVER_BLOCK) under a learned cloudflare.com',
    async check(page) {
      // The widget lives in a CLOSED shadow root: querySelector('iframe') sees nothing and the frame's own body
      // is empty to us, so the evidence is the frame on challenges.cloudflare.com and its owner element's box.
      const widget = await providerFrame(page, /^https:\/\/challenges\.cloudflare\.com\/.*turnstile/, { minW: 100, minH: 40 });
      const api = await page.evaluate(() => ({ turnstile: typeof window.turnstile, ready: !!(window.turnstile && typeof window.turnstile.render === 'function') })).catch(() => ({ ready: false }));
      return { ok: api.ready && widget.ok, detail: { api, widget } };
    },
  },
  {
    key: 'tp-hcaptcha-democaptcha', n: 19, label: 'hCaptcha on democaptcha.com', url: 'https://democaptcha.com/demo-form-eng/hcaptcha.html', settleMs: 3000,
    protects: 'hcaptcha.com (NEVER_BLOCK; no seeded domain covers it — a CONTROL row: it must pass in every mode)',
    async check(page) {
      const checkbox = await providerFrame(page, /^https:\/\/(newassets\.)?hcaptcha\.com\/captcha\//, {
        minW: 200, minH: 50,
        probe: () => ({ ok: !!document.querySelector('#checkbox'), text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 60) }),
      });
      const api = await page.evaluate(() => ({ hcaptcha: typeof window.hcaptcha, ready: !!(window.hcaptcha && typeof window.hcaptcha.render === 'function') })).catch(() => ({ ready: false }));
      return { ok: api.ready && checkbox.ok, detail: { api, checkbox } };
    },
  },
  {
    key: 'tp-gsi-reddit', n: 20, label: 'Google Sign-In button on reddit.com/login', url: 'https://www.reddit.com/login/', settleMs: 4000,
    protects: 'accounts.google.com (NEVER_BLOCK) under a learned google.com',
    async check(page) { return gsiCheck(page); },
  },
  {
    key: 'tp-gsi-pinterest', n: 21, label: 'Google Sign-In button on pinterest.com/login', url: 'https://www.pinterest.com/login/', settleMs: 4000,
    protects: 'accounts.google.com (NEVER_BLOCK) under a learned google.com',
    async check(page) { return gsiCheck(page); },
  },
  {
    key: 'tp-youtube-embed', n: 22, label: 'YouTube iframe embed (fixture)', fixture: 'third-party-embeds.html?e=youtube', settleMs: 2500,
    protects: 'youtube.com (COOKIE_BLOCK_ONLY — cookie-strip, never block)',
    async check(page) {
      const player = await providerFrame(page, /^https:\/\/www\.youtube(-nocookie)?\.com\/embed\//, {
        minW: 200, minH: 100,
        probe: () => ({ ok: !!document.querySelector('#movie_player, .html5-video-player') && !!document.querySelector('video'), text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 60) }),
      });
      return { ok: player.ok, detail: { player } };
    },
  },
  {
    key: 'tp-maps-embed', n: 23, label: 'Google Maps embed, www.google.com/maps/embed (fixture)', fixture: 'third-party-embeds.html?e=maps', settleMs: 3000,
    protects: 'www.google.com (carved out of a learned google.com, D50)',
    async check(page) { return mapsEmbedCheck(page); },
  },
  {
    key: 'tp-maps-embed-legacy', n: 24, label: 'Google Maps embed via maps.google.com (fixture)', fixture: 'third-party-embeds.html?e=maps-legacy', settleMs: 3000,
    protects: 'maps.google.com (COOKIE_BLOCK_ONLY) → www.google.com/maps/embed',
    async check(page) { return mapsEmbedCheck(page); },
  },
  {
    key: 'tp-calendar-embed', n: 25, label: 'Google Calendar public embed (fixture)', fixture: 'third-party-embeds.html?e=calendar', settleMs: 3000,
    protects: 'calendar.google.com — google.com is COOKIE_BLOCK_ONLY since D50',
    async check(page) {
      const cal = await providerFrame(page, /^https:\/\/calendar\.google\.com\/calendar\/embed/, {
        minW: 200, minH: 200,
        // innerText needs layout; one OFF run read 0 from a frame that was there (804x604, right URL). The
        // calendar's own title is the layout-free fallback — a blocked frame never matches the URL anyway.
        probe: () => { const t = document.body ? document.body.innerText : ''; return { ok: t.length > 200 || /Holidays/i.test(document.title), textLen: t.length, title: document.title.slice(0, 60), text: t.replace(/\s+/g, ' ').slice(0, 60) }; },
      });
      return { ok: cal.ok, detail: { cal } };
    },
  },
  {
    key: 'tp-facebook-sdk-plugin', n: 26, label: 'Facebook JS SDK + Page plugin (fixture)', fixture: 'third-party-embeds.html?e=facebook', settleMs: 3500, policy: true,
    protects: 'NOTHING under facebook.com except graph.facebook.com — POLICY row',
    async check(page) {
      const plugin = await providerFrame(page, /^https:\/\/www\.facebook\.com\/v[\d.]+\/plugins\/page\.php/, {
        minW: 100, minH: 100,
        probe: () => { const t = document.body ? document.body.innerText : ''; return { ok: t.length > 20, text: t.replace(/\s+/g, ' ').slice(0, 60) }; },
      });
      const sdk = await page.evaluate(() => ({ FB: typeof window.FB, xfbml: !!(window.FB && window.FB.XFBML && typeof window.FB.XFBML.parse === 'function') })).catch(() => ({ xfbml: false }));
      return { ok: sdk.xfbml && plugin.ok, detail: { sdk, plugin } };
    },
  },
  {
    key: 'tp-x-embedded-post', n: 27, label: 'X / Twitter embedded post (fixture)', fixture: 'third-party-embeds.html?e=tweet', settleMs: 3500, policy: true,
    protects: 'NOTHING under twitter.com — POLICY row',
    async check(page) {
      const post = await providerFrame(page, /^https:\/\/platform\.twitter\.com\/embed\/Tweet\.html/, {
        minW: 100, minH: 50,
        probe: () => { const t = document.body ? document.body.innerText : ''; return { ok: t.length > 20, text: t.replace(/\s+/g, ' ').slice(0, 60) }; },
      });
      return { ok: post.ok, detail: { post } };
    },
  },
];

async function gsiCheck(page) {
  const button = await providerFrame(page, /^https:\/\/accounts\.google\.com\/gsi\/button/, {
    minW: 100, minH: 20,
    probe: () => { const t = document.body ? document.body.innerText.trim() : ''; return { ok: t.length > 0 || !!document.querySelector('[role="button"]'), text: t.replace(/\s+/g, ' ').slice(0, 60) }; },
  });
  const api = await page.evaluate(() => ({ ready: !!(window.google && window.google.accounts && window.google.accounts.id && typeof window.google.accounts.id.renderButton === 'function') })).catch(() => ({ ready: false }));
  return { ok: api.ready && button.ok, detail: { api, button } };
}

async function mapsEmbedCheck(page) {
  const map = await providerFrame(page, /^https:\/\/www\.google\.com\/maps\/embed/, {
    minW: 200, minH: 200,
    probe: () => ({ ok: document.images.length >= 5, images: document.images.length, text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 60) }),
  });
  return { ok: map.ok, detail: { map } };
}

const ALL_SITES = [...SITES, ...THIRD_PARTY_SITES];
const selectedSites = () => {
  const pool = THIRD_PARTY ? ALL_SITES : SITES;
  return ONLY.length ? ALL_SITES.filter((s) => ONLY.includes(s.key)) : pool;
};

/** Serves harness/fixtures/ on 127.0.0.1:<ephemeral> — the third-party embedding site for the fixture rows. */
function startFixtureServer() {
  const root = path.join(HERE, 'fixtures');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const p = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!p.startsWith(root + path.sep) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

// ── 5. run one site ──────────────────────────────────────────────────────────
async function runSite(browser, site, ctxIn, ua) {
  const { page, consoleLines, blockedByClient } = await freshPage(browser, ua);
  const url = urlOf(site);
  const record = { site: site.key, withExtension: ctxIn.withExtension, url, ok: false, blocked: false, blockedEvidence: null, skipped: false, skipReason: null, void: false, reasons: [], detail: {}, probes: null, visibility: null, consoleLines: [], httpStatus: null, error: null, blockedByClient: [], learnedHits: null };
  if (ctxIn.seed) await ctxIn.seed.drain().catch(() => {});   // hits from before this row belong to no row
  try {
    let resp;
    try {
      resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      record.error = String(e.message || e).slice(0, 300);
      // The machine's network, not the site and not the extension (2026-09-28: the connection dropped for a
      // minute during a control run's retries). Nothing was measured, so it is VOID — never evidence either
      // way. ERR_BLOCKED_BY_CLIENT is deliberately NOT in this list: a blocked main frame is a finding.
      if (NETWORK_DOWN.test(record.error)) { record.void = true; record.error = 'network unavailable — ' + record.error; }
      return record;   // `finally` closes the page and collects console lines, blocked requests and learned hits
    }
    record.httpStatus = resp ? resp.status() : null;
    const wall = await detectBotWall(page, record.httpStatus);
    if (wall) {
      record.probes = await probes(page).catch(() => null);
      record.blocked = true;
      record.blockedEvidence = wall.evidence;
      return record;   // `finally` does the rest — and drains the learned hits exactly once
    }
    await dismissCookieBanner(page).catch(() => {});
    if (site.settleMs) await sleep(site.settleMs);
    record.visibility = await assertVisible(page);
    if (record.visibility !== 'visible') {
      // A hidden tab gets no rAF and YouTube fetches no media for it (2026-09-20): whatever the check said
      // would be about the tab, not the extension. Neither a PASS nor a FAIL — VOID.
      record.void = true;
      record.error = `tab not visible (visibilityState=${record.visibility}) — measurement void`;
      return record;
    }
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
    record.blockedByClient = blockedByClient.slice(0, 30);
    await page.close().catch(() => {});
    if (ctxIn.seed) record.learnedHits = await ctxIn.seed.drain().catch((e) => ({ hits: [], note: 'drain failed: ' + e.message }));
  }
  return record;
}

/**
 * Launch the browser for a pass and PROVE which kind of pass it is: the OFF browser must contain no extension
 * target at all, the ON browser must have Nullecho's worker. In seeded mode the ON browser is then seeded
 * (seedLearnedState) before a single site is visited. Throws on a wrong environment — a measurement taken
 * in the wrong browser is worse than none.
 */
async function openPassBrowser({ withExtension, unpackDir, label }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `nullecho-smoke-profile-${label}-`));
  const { browser, version } = await launchBrowser({ extDir: withExtension ? unpackDir : null, profile, seeded: withExtension && SEEDED });
  const close = async () => { await browser.close().catch(() => {}); fs.rmSync(profile, { recursive: true, force: true }); };
  try {
    const presence = await extensionPresence(browser, { waitMs: withExtension ? 20000 : 1500 });
    if (!withExtension && presence.extensionTargets.length) throw new Error(`OFF pass is not OFF: extension targets present — ${presence.extensionTargets.join('; ')}`);
    if (withExtension && !presence.worker) throw new Error('ON pass is not ON: no Nullecho service worker target within 20 s');
    const seed = withExtension && SEEDED ? await seedLearnedState(browser, unpackDir) : null;
    return { browser, version, presence, seed, close };
  } catch (e) { await close(); throw e; }
}

async function runPass({ withExtension, unpackDir, offRecords, ua }) {
  const env = await openPassBrowser({ withExtension, unpackDir, label: withExtension ? 'on' : 'off' });
  const { browser, version } = env;
  const records = {};
  const sites = selectedSites();
  let rulesAtEnd = null;
  try {
    for (const site of sites) {
      if (budgetLeft() < 60000) { records[site.key] = { site: site.key, withExtension, skipped: true, skipReason: 'runtime budget exceeded', ok: false, detail: {}, reasons: [], probes: null, consoleLines: [] }; continue; }
      const off = offRecords ? offRecords[site.key] : null;
      const ctx = { withExtension, seed: env.seed, hostCores: off ? off.probes?.cores : undefined, hostMem: off ? off.probes?.mem : undefined, offGpc: off ? off.probes?.gpc : undefined, offProbes: off ? off.probes : undefined };
      console.error(`[site-smoke] ${withExtension ? 'ON ' : 'OFF'} ${site.label} …`);
      records[site.key] = await runSite(browser, site, ctx, ua);
      const r = records[site.key];
      const hits = r.learnedHits && r.learnedHits.hits ? r.learnedHits.hits.filter((h) => isLearnedBlockId(h.ruleId)) : [];
      console.error(`  → ${r.ok ? 'ok' : 'not-ok'}${r.blocked ? ' (blocked)' : ''}${r.skipped ? ' (skipped)' : ''}${r.void ? ' (VOID: tab not visible)' : ''}${hits.length ? ` (${hits.length} learned-rule BLOCK${hits.length > 1 ? 's' : ''})` : ''}`);
    }
    if (env.seed) rulesAtEnd = await env.seed.dumpRules().catch(() => null);
  } finally {
    await env.close();
  }
  return { records, chromeVersion: version, presence: env.presence, seedReport: env.seed ? env.seed.report : null, rulesAtEnd };
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
    // third-party rows: every check, run on the fixture page with NO embed, must FAIL — a check that can
    // pass on a page that does not contain the thing it checks proves nothing (and the negative control,
    // --learner-from, then proves the same checks fail when a learned rule removes the thing).
    if (THIRD_PARTY) {
      out.thirdParty = {};
      const saved = FRAME_WAIT_MS;
      FRAME_WAIT_MS = 1500;
      try {
        for (const site of THIRD_PARTY_SITES) {
          const { page } = await freshPage(browser, ua);
          await page.goto(`${FIXTURE.origin}/third-party-embeds.html?e=none`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
          const r = await withTimeout(site.check(page, { withExtension: false }), 20000, `${site.key} self-test`).catch((e) => ({ ok: false, error: String(e.message || e) }));
          out.thirdParty[site.key] = { expectedFail: true, actuallyFailed: r.ok === false };
          await page.close().catch(() => {});
        }
      } finally { FRAME_WAIT_MS = saved; }
    }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(profile, { recursive: true, force: true });
  }
  return out;
}

// ── 7. main ──────────────────────────────────────────────────────────────────
async function main() {
  const code = codeProvenance();   // at the START: the code that runs, not whatever the tree holds when it ends
  const pkg = OFF_ONLY ? null : buildAndUnpackChromePackage();
  const control = pkg && LEARNER_FROM ? swapLearner(pkg.unpackDir, LEARNER_FROM) : null;
  const fixture = THIRD_PARTY ? await startFixtureServer() : null;
  if (fixture) FIXTURE = { origin: fixture.origin };

  // probe browser version + build a stable desktop UA before any real pass
  const probeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-smoke-probe-'));
  const { browser: probeBrowser, version: chromeVersion } = await launchBrowser({ extDir: null, profile: probeProfile });
  await probeBrowser.close().catch(() => {});
  fs.rmSync(probeProfile, { recursive: true, force: true });
  const ua = desktopUA(chromeVersion.split(' ')[0]);

  const selfTestResult = await selfTest(ua);
  const tpSelfTestBroken = Object.entries(selfTestResult.thirdParty || {}).filter(([, v]) => v.actuallyFailed !== true).map(([k]) => k);
  if (selfTestResult.youtube.actuallyFailed !== true || selfTestResult.maps.actuallyFailed !== true || tpSelfTestBroken.length) {
    console.error('⚠ SELF-TEST WARNING: a check did not fail when it should have' + (tpSelfTestBroken.length ? ` (${tpSelfTestBroken.join(', ')})` : '') + '. Trusting PASS verdicts from it is unsound this run.');
  }

  console.error('[site-smoke] OFF pass (no extension) — establishing host baseline…');
  const off = await runPass({ withExtension: false, unpackDir: null, offRecords: null, ua });
  // OFF flakiness guard, the mirror of the ON one below: a row that failed OFF (not walled, not void) gets
  // one more OFF attempt in a fresh browser before it can turn into NOT-OURS — otherwise one slow third-party
  // embed on the OFF side hides whatever the ON side did (2026-09-28: Calendar, control run).
  const offRetry = Object.values(off.records).filter((r) => r.ok === false && !r.blocked && !r.skipped && !r.void);
  if (offRetry.length) {
    console.error(`[site-smoke] ${offRetry.length} OFF failure(s) — retrying once each before calling anything NOT-OURS…`);
    const env = await openPassBrowser({ withExtension: false, unpackDir: null, label: 'off-retry' });
    try {
      for (const r of offRetry) {
        const site = ALL_SITES.find((x) => x.key === r.site);
        console.error(`  OFF retry: ${site.label} …`);
        const again = await retryOnSite(env.browser, site, { withExtension: false }, ua);
        if (again.void) { r.retryVoid = again.error; continue; }
        again.retriedAfterInitialFail = true;
        again.firstAttempt = { ok: r.ok, reasons: r.reasons, detail: r.detail, error: r.error };
        off.records[r.site] = again;
      }
    } finally { await env.close(); }
  }

  let on = { records: {}, chromeVersion };
  const retrySeedReports = [];
  if (!OFF_ONLY) {
    console.error(`[site-smoke] ON pass (packaged extension loaded${SEEDED ? ', SEEDED learned state' : ''}${control ? `, ⚠ CONTROL learner from ${control.rev}` : ''})…`);
    try {
      on = await runPass({ withExtension: true, unpackDir: pkg.unpackDir, offRecords: off.records, ua });
    } catch (e) {
      if (!(e instanceof SeedingError)) throw e;
      console.error('\n✗✗✗ ' + e.message);
      writeSeedingFailure({ pkg, control, chromeVersion, error: e.message, report: e.report || null });
      if (fixture) fixture.server.close();
      process.exit(3);
    }

    // flakiness guard: re-run once, fresh browser (seeded the same way in seeded mode), any site that FAILED on but PASSED off.
    const retryCandidates = Object.values(on.records).filter((r) => {
      const offR = off.records[r.site];
      return offR && offR.ok === true && r.ok === false && !r.blocked && !r.skipped && !r.void;
    });
    if (retryCandidates.length) {
      console.error(`[site-smoke] ${retryCandidates.length} candidate FAIL(s) — retrying once each before reporting…`);
      const env = await openPassBrowser({ withExtension: true, unpackDir: pkg.unpackDir, label: 'retry' });
      if (env.seed) retrySeedReports.push(env.seed.report);
      try {
        for (const r of retryCandidates) {
          const site = ALL_SITES.find((s) => s.key === r.site);
          const offR = off.records[r.site];
          const ctx = { withExtension: true, seed: env.seed, hostCores: offR.probes?.cores, hostMem: offR.probes?.mem, offGpc: offR.probes?.gpc, offProbes: offR.probes };
          console.error(`  retry: ${site.label} …`);
          const retry = await retryOnSite(env.browser, site, ctx, ua);
          if (retry.void) {
            // The retry measured nothing (network down / hidden tab): the first attempt stands, and says so.
            r.retryVoid = retry.error;
            console.error(`    retry VOID (${retry.error}) — keeping the first attempt`);
            continue;
          }
          retry.retriedAfterInitialFail = true;
          retry.firstAttempt = { ok: r.ok, reasons: r.reasons, detail: r.detail, error: r.error, learnedHits: r.learnedHits, blockedByClient: r.blockedByClient };
          on.records[r.site] = retry;
        }
      } finally {
        await env.close();
      }
    }
  }
  if (fixture) fixture.server.close();

  // verify the metadata-leak trap never fired
  const metadataLeaked = fs.existsSync(path.join(EXT, '_metadata'));
  if (metadataLeaked) console.error('⚠ ext/_metadata/ EXISTS — this must never be committed. Investigate immediately.');

  // ── verdicts ────────────────────────────────────────────────────────────
  const ruleById = on.seedReport ? new Map((on.seedReport.rulesAfterReload || []).map((r) => [r.id, r])) : null;
  const learnedBlocks = (rec) => (rec && rec.learnedHits && rec.learnedHits.hits ? rec.learnedHits.hits.filter((h) => isLearnedBlockId(h.ruleId)) : []);
  const sites = selectedSites();
  const results = sites.map((site) => {
    const onR = on.records[site.key];
    const offR = off.records[site.key];
    let verdict, reason;
    if (OFF_ONLY) {
      verdict = offR.void ? 'VOID' : offR.ok ? 'PASS (OFF-only run)' : (offR.blocked ? 'BLOCKED' : (offR.skipped ? 'SKIPPED' : 'FAIL'));
      reason = offR.skipReason || offR.error || (offR.reasons || []).join('; ');
    } else if (offR.skipped || onR.skipped) {
      verdict = 'SKIPPED'; reason = onR.skipReason || offR.skipReason;
    } else if (onR.void || offR.void) {
      verdict = 'VOID'; reason = (onR.void ? 'ON: ' + onR.error : '') + (offR.void ? ' OFF: ' + offR.error : '');
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
      const lb = learnedBlocks(onR);
      if (lb.length) {
        reason = `${lb.length} learned-rule block(s): ${lb.slice(0, 3).map((h) => describeHit(h, ruleById)).join(' | ')}`;
        if (site.policy) verdict = 'POLICY-BLOCKED';
      }
    } else {
      verdict = onR.ok ? 'PASS' : 'FAIL';
      reason = 'note: OFF failed but ON passed (not a regression) — ' + (offR.error || '');
    }
    return { site, on: onR, off: offR, verdict, reason };
  });

  // D50 invariant over every row's traffic: a learned BLOCK on a protected host is a FAIL even when the row's
  // functional check did not notice (2026-09-28 control: the pre-D50 learner blocked reCAPTCHA Enterprise on
  // open.spotify.com and Google's sign-in frame on youtube.com while both rows' checks still passed).
  for (const res of results) {
    const hits = learnedBlocks(res.on);
    const bad = hits.map((h) => ({ h, entry: protectedEntryFor(h.url) })).filter((x) => x.entry);
    res.protectedHostBlocks = bad.map(({ h, entry }) => `${describeHit(h, ruleById)} — protected by ${entry}`);
    if (bad.length && (res.verdict === 'PASS' || res.verdict === 'POLICY-BLOCKED' || res.verdict === 'NOT-OURS' || res.verdict === 'BLOCKED')) {
      res.verdict = 'FAIL';
      res.reason = `PROTECTED HOST BLOCKED by a learned rule (${bad.length}): ${res.protectedHostBlocks.slice(0, 2).join(' | ')}`;
    }
  }

  // What changed in the learned rules while the ON pass ran (a promotion, or a seeded rule gone, mid-run)?
  let ruleDrift = null;
  if (on.seedReport && on.rulesAtEnd) {
    const a = new Map(on.seedReport.rulesAfterReload.map((r) => [r.id, JSON.stringify(r)]));
    const b = new Map(on.rulesAtEnd.map((r) => [r.id, JSON.stringify(r)]));
    ruleDrift = {
      added: on.rulesAtEnd.filter((r) => !a.has(r.id)),
      removed: on.seedReport.rulesAfterReload.filter((r) => !b.has(r.id)),
      changed: on.rulesAtEnd.filter((r) => a.has(r.id) && a.get(r.id) !== b.get(r.id)),
    };
    if (ruleDrift.removed.length || ruleDrift.changed.length) console.error(`⚠ seeded learned rules changed DURING the ON pass — rows after that point did not run under the seed: ${JSON.stringify(ruleDrift)}`);
  }

  const seedFindings = [...(on.seedReport ? on.seedReport.findings : []), ...retrySeedReports.flatMap((r) => r.findings.map((f) => `retry browser: ${f}`))];
  const meta = {
    date: today(),
    code,
    package: pkg ? { version: pkg.version, zipName: pkg.zipName, sha256: pkg.sha256, size: pkg.size } : null,
    control,
    seeded: SEEDED, thirdParty: THIRD_PARTY,
    chromeVersion, puppeteerVersion: PUPPETEER_VERSION,
    node: process.version,
    runtimeMs: elapsed(),
    metadataLeaked,
    ua,
    offOnly: OFF_ONLY,
    selfTest: selfTestResult,
    passEnv: { off: off.presence, on: on.presence || null },
    fixtureOrigin: fixture ? fixture.origin : null,
    seed: on.seedReport || null,
    retrySeeds: retrySeedReports,
    rulesAtEnd: on.rulesAtEnd || null,
    ruleDrift,
    seedFindings,
  };

  writeReports(meta, results);
  const summary = results.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});
  console.error('\n[site-smoke] DONE in ' + Math.round(elapsed() / 1000) + 's — ' + JSON.stringify(summary));
  for (const r of results) console.error(`  ${String(r.site.n).padStart(2)}. ${r.site.label.padEnd(56)} ${r.verdict}${r.verdict !== 'PASS' && r.reason ? ' — ' + r.reason.slice(0, 160) : ''}`);
  for (const f of seedFindings) console.error('  ⚠ seeding finding: ' + f);
  if (control) console.error(`  ⚠ CONTROL RUN (learner from ${control.rev}) — this is NOT the store package; its FAILs are the point.`);
  // Seeded mode is a release GATE: a FAIL, a VOID measurement, a finding from the reload, or a seeded rule
  // disappearing mid-run all make it red. The default smoke keeps its report-only exit code.
  if (SEEDED) {
    const red = results.some((r) => r.verdict === 'FAIL' || r.verdict === 'VOID') || seedFindings.length > 0
      || (ruleDrift && (ruleDrift.removed.length || ruleDrift.changed.length)) || tpSelfTestBroken.length > 0;
    process.exitCode = red ? 1 : 0;
  }
}

/** Seeding failed before a single row ran — still leave a report behind, it is the evidence. */
function writeSeedingFailure({ pkg, control, chromeVersion, error, report }) {
  const outDir = path.join(REPO, 'docs', 'breakage-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${today()}-site-smoke-seeded${control ? '-control-' + control.revSha.slice(0, 7) : ''}-${codeProvenance().tag}-SEEDING-FAILED`;
  fs.writeFileSync(path.join(outDir, base + '.json'), JSON.stringify({ error, package: pkg && { zipName: pkg.zipName, sha256: pkg.sha256 }, control, chromeVersion, report }, null, 2));
  console.error(`[site-smoke] wrote ${path.relative(REPO, path.join(outDir, base + '.json'))}`);
}

// ── 8. reports ───────────────────────────────────────────────────────────────
function writeReports(meta, results) {
  const outDir = path.join(REPO, 'docs', 'breakage-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const suffix = (meta.seeded ? '-seeded' : meta.thirdParty ? '-thirdparty' : '') + (meta.control ? `-control-${meta.control.revSha.slice(0, 7)}` : '');
  const base = `${meta.date}-site-smoke${suffix}-${meta.code.tag}`;
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2));

  const fmtProbes = (r) => r ? `gpc=${r.probes?.gpc === undefined ? 'undefined' : r.probes?.gpc} cores=${r.probes?.cores} mem=${r.probes?.mem}` : 'n/a';
  const fmtVerdict = (ok, blocked, skipped, isVoid) => isVoid ? 'VOID' : skipped ? 'SKIPPED' : blocked ? 'BLOCKED' : ok ? 'PASS' : 'FAIL';
  const ruleById = meta.seed ? new Map((meta.seed.rulesAfterReload || []).map((x) => [x.id, x])) : null;

  let md = `# Nullecho pre-release site smoke${meta.seeded ? ' — SEEDED learned state' : ''}${meta.control ? ' — ⚠ NEGATIVE CONTROL' : ''} — ${meta.date}\n\n`;
  if (meta.control) {
    md += `> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The store zip below was unpacked and its \`src/heuristics.js\` + \`src/allowlist.js\` `;
    md += `were replaced with \`${meta.control.rev}\` (\`${meta.control.revSha.slice(0, 7)}\`)'s copies (sha256 heuristics \`${meta.control.files['heuristics.js'].swappedSha256.slice(0, 16)}…\`, `;
    md += `allowlist \`${meta.control.files['allowlist.js'].swappedSha256.slice(0, 16)}…\`). It exists to prove the seeded rows FAIL on the code that broke reCAPTCHA; its FAILs are the point.\n\n`;
  }
  md += `Tests **the packaged Chrome build**, not the source tree: \`ext/tools/package.mjs\` → `;
  md += meta.package ? `\`${meta.package.zipName}\`, sha256 \`${meta.package.sha256}\`, ${(meta.package.size / 1024).toFixed(1)} KB.\n` : `(OFF-only run — package not built.)\n`;
  md += `\n- **Chrome:** ${meta.chromeVersion}\n- **Puppeteer:** ${meta.puppeteerVersion}\n- **Node:** ${meta.node}\n`;
  md += `- **UA used (both passes):** \`${meta.ua}\`\n`;
  md += `- **Code tested:** ${meta.code.head ? `\`${meta.code.head}\`` : 'unknown (no git)'}${meta.code.dirty ? ' — **⚠ with uncommitted edits in ext/ or harness/: not reproducible from any commit**' : meta.code.head ? ' (ext/ and harness/ clean)' : ''}\n`;
  md += `- **Runtime:** ${Math.round(meta.runtimeMs / 1000)}s\n`;
  md += `- **\`ext/_metadata/\` present:** ${meta.metadataLeaked ? '⚠ YES — investigate, must never be committed' : 'NO (verified)'}\n`;
  md += `- **Mode:** ${meta.offOnly ? 'OFF-only (no extension, no package build)' : 'OFF pass then ON pass, side by side'}${meta.seeded ? ' — ON browsers SEEDED with learned state (below) before any site' : ''}${meta.thirdParty ? '; third-party rows included' : ''}\n`;
  if (meta.passEnv) {
    md += `- **OFF browser really OFF:** ${meta.passEnv.off && meta.passEnv.off.extensionTargets.length === 0 ? 'yes — no chrome-extension:// target' : '⚠ NO: ' + JSON.stringify(meta.passEnv.off)}\n`;
    if (meta.passEnv.on) md += `- **ON browser really ON:** ${meta.passEnv.on.worker ? 'yes — ' + meta.passEnv.on.worker : '⚠ NO worker'}\n`;
  }
  if (meta.fixtureOrigin) md += `- **Fixture origin (the third-party embedding site):** \`${meta.fixtureOrigin}\` serving \`harness/fixtures/third-party-embeds.html\`\n`;

  if (meta.seed) {
    const sd = meta.seed;
    md += `\n## Seeded learned state — and the positive control that proves it was live\n\n`;
    md += `Written from the extension's service worker into \`chrome.storage.local["${sd.storageKey}"]\` (key read from the loaded heuristics.js), `;
    md += `then the extension (\`${sd.extensionId}\`) was **reloaded** via CDP \`Extensions.loadUnpacked\` on the same path — `;
    md += `the reload arrow / an update — so the shipped \`install()\` + \`onInstalled\` ran the shipped \`reconcile()\`. The harness wrote no DNR rule.\n\n`;
    md += `Seeded, each as \`{status: 'blocked', ruleId: <heuristic block range>, sites: 3 distinct, source: 'learned'}\`: ${sd.domains.map((d) => `\`${d}\``).join(', ')}.\n\n`;
    md += `| Positive-control assertion | Result |\n|---|---|\n`;
    for (const c of sd.positiveControl) md += `| ${c.what.replace(/\|/g, '\\|')} | ${c.ok ? '✅' : '❌'} |\n`;
    md += `\n**Learned-range dynamic rules live after the reload** (\`getDynamicRules()\` from the new worker, ${sd.rulesAfterReload.length} rules):\n\n\`\`\`\n`;
    for (const r of sd.rulesAfterReload) md += ruleLine(r) + '\n';
    md += `\`\`\`\n\n<details><summary>Raw JSON</summary>\n\n\`\`\`json\n${JSON.stringify(sd.rulesAfterReload, null, 1)}\n\`\`\`\n</details>\n\n`;
    md += `Stored records after the reload: \`${JSON.stringify(sd.stateAfterReload)}\`\n\n`;
    md += `Worker console during the reload: ${sd.reloadWorkerConsole.length ? '\n' + sd.reloadWorkerConsole.map((l) => `  > ${l}`).join('\n') + '\n' : '_empty_\n'}`;
    md += `\nMatch recorder (\`onRuleMatchedDebug\` in the worker): \`${sd.recorder}\`.\n`;
    if (meta.seedFindings && meta.seedFindings.length) {
      md += `\n**⚠ Findings from the reload (these make a seeded run red):**\n`;
      for (const f of meta.seedFindings) md += `- ${f}\n`;
    }
    for (const rs of meta.retrySeeds || []) {
      md += `\nRetry browser seeded the same way: positive control ${rs.ok ? '✅ all' : '❌'} (${rs.positiveControl.filter((c) => c.ok).length}/${rs.positiveControl.length}), ${rs.rulesAfterReload.length} learned rules live.\n`;
    }
    if (meta.ruleDrift) {
      const d = meta.ruleDrift;
      md += `\n**Learned rules at the END of the ON pass vs after the reload:** ${d.added.length} added, ${d.removed.length} removed, ${d.changed.length} changed.`;
      if (d.added.length) md += ` Added during the run (the learner promoting from this run's own traffic): ${d.added.map(ruleLine).map((l) => `\`${l}\``).join('; ')}.`;
      if (d.removed.length || d.changed.length) md += ` **⚠ a seeded rule was removed or rewritten mid-run — rows after that point did not run under the seed.**`;
      md += `\n`;
    }
  }

  md += `\n## Self-test — attacking our own checks before trusting a PASS\n\n`;
  const st = meta.selfTest;
  md += `| Check | Deliberately broken how | Expected | Actual | Result |\n|---|---|---|---|---|\n`;
  md += `| youtube playback | navigated but never pressed play | check should report FAIL | ${st.youtube.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${st.youtube.actuallyFailed ? '✅' : '❌'} |\n`;
  md += `| maps zoom | ran the same wheel-zoom check on example.com (no map) | check should report FAIL | ${st.maps.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${st.maps.actuallyFailed ? '✅' : '❌'} |\n`;
  for (const [k, v] of Object.entries(st.thirdParty || {})) {
    md += `| ${k} | ran on the fixture page with NO embed (\`?e=none\`) | check should report FAIL | ${v.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${v.actuallyFailed ? '✅' : '❌'} |\n`;
  }
  md += `\nDetail: youtube ${JSON.stringify(st.youtube.detail)}; maps ${JSON.stringify(st.maps.detail)}\n`;

  md += `\n## Results\n\n`;
  md += `| # | Site | ON | OFF | Verdict | Notes |\n|---|---|---|---|---|---|\n`;
  for (const r of results) {
    const onV = r.on ? fmtVerdict(r.on.ok, r.on.blocked, r.on.skipped, r.on.void) : 'n/a';
    const offV = r.off ? fmtVerdict(r.off.ok, r.off.blocked, r.off.skipped, r.off.void) : 'n/a';
    const notes = (r.reason || '').replace(/\|/g, '\\|').slice(0, 160);
    md += `| ${r.site.n} | ${r.site.label} | ${onV} | ${offV} | **${r.verdict}** | ${notes} |\n`;
  }

  const totals = results.reduce((acc, r) => { acc[r.verdict] = (acc[r.verdict] || 0) + 1; return acc; }, {});
  md += `\n**Totals:** ${Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(', ')}\n`;

  if (meta.seed) {
    const all = results.flatMap((r) => (r.protectedHostBlocks || []).map((l) => `${r.site.n}. ${r.site.label}: ${l}`));
    md += `\n## D50 invariant over all traffic — learned BLOCKs on protected hosts: ${all.length}\n\n`;
    md += `Every learned-rule block recorded in any row, checked against the current NEVER_BLOCK + COOKIE_BLOCK_ONLY lists `;
    md += `(path-scoped entries by host+path). Any hit is a FAIL for its row even if the row's own check passed.\n\n`;
    md += all.length ? all.map((l) => `- ${l}`).join('\n') + '\n' : '_None._\n';
  }

  md += `\n## Per-site detail\n`;
  for (const r of results) {
    md += `\n### ${r.site.n}. ${r.site.label} — **${r.verdict}**\n\n`;
    if (r.reason) md += `${r.reason}\n\n`;
    md += `- URL: \`${(r.on && r.on.url) || (r.off && r.off.url) || r.site.url}\`\n`;
    if (r.site.protects) md += `- Protected service under test: ${r.site.protects}${r.site.policy ? ' — **POLICY row** (a learned block here is POLICY-BLOCKED, not FAIL)' : ''}\n`;
    if (r.on) {
      md += `- **ON** — http ${r.on.httpStatus}, visibility \`${r.on.visibility}\`, probes: \`${fmtProbes(r.on)}\`, detail: \`${JSON.stringify(r.on.detail)}\`${r.on.error ? `, error: \`${r.on.error}\`` : ''}${r.on.retriedAfterInitialFail ? `, **retried once** (first attempt: ${JSON.stringify(r.on.firstAttempt)})` : ''}${r.on.retryVoid ? `, retry was VOID (${r.on.retryVoid}) — this is the first attempt` : ''}\n`;
    }
    if (r.off) {
      md += `- **OFF** — http ${r.off.httpStatus}, visibility \`${r.off.visibility}\`, probes: \`${fmtProbes(r.off)}\`, detail: \`${JSON.stringify(r.off.detail)}\`${r.off.error ? `, error: \`${r.off.error}\`` : ''}${r.off.retriedAfterInitialFail ? `, **retried once** (first attempt: ${JSON.stringify(r.off.firstAttempt)})` : ''}\n`;
    }
    for (const [label, rec] of [['ON', r.on], ['OFF', r.off]]) {
      if (rec && rec.blockedByClient && rec.blockedByClient.length) md += `- **${label}** \`net::ERR_BLOCKED_BY_CLIENT\` (${rec.blockedByClient.length}): ${rec.blockedByClient.slice(0, 8).map((x) => `\`${x}\``).join(', ')}${rec.blockedByClient.length > 8 ? ' …' : ''}\n`;
    }
    if (r.on && r.on.learnedHits) {
      const hits = r.on.learnedHits.hits || [];
      const blocks = hits.filter((h) => isLearnedBlockId(h.ruleId));
      const strips = hits.filter((h) => isLearnedCookieId(h.ruleId));
      md += `- **ON learned-rule matches** (\`onRuleMatchedDebug\`): ${blocks.length} block, ${strips.length} cookie-strip${r.on.learnedHits.recorderRestarted ? ` — ⚠ ${r.on.learnedHits.note}` : ''}\n`;
      for (const h of blocks.slice(0, 8)) md += `  - ${describeHit(h, ruleById)}\n`;
      if (strips.length) md += `  - cookie-stripped hosts: ${[...new Set(strips.map((h) => { try { return new URL(h.url).host; } catch { return h.url; } }))].slice(0, 12).join(', ')}\n`;
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

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e && e.stack || e); process.exit(1); });
