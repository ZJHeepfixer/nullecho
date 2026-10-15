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
 * hCaptcha, Google Sign-In on two sites, YouTube / Maps / Calendar / Facebook-plugin / X-post embeds, and
 * microsoft.com's own silent sign-in hand-off from login.live.com). A row marked `policy: true` — a provider no
 * policy list protects — reports a learned block as POLICY-BLOCKED instead of FAIL; since D52 moved facebook.com
 * and x.com/twitter.com to COOKIE_BLOCK_ONLY no row uses it. Exit code: 3 seeding
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
import { fileURLToPath, pathToFileURL } from 'node:url';
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
// SHOPPING LAB (0.9.3, rules/personalization.json). `--shopping` runs only the shopping rows, `--rounds` times each,
// OFF and ON loading the same page at the same moment. The seeded gate runs them too, once each (retried once on FAIL).
const SHOPPING = flag('--shopping');
const ROUNDS = Math.max(1, Number(opt('--rounds', SHOPPING ? '3' : '1')) || 1);
// NEGATIVE CONTROLS for the shopping lab, applied to the unpacked store zip in the temp dir only (never to ext/):
//   --plant-block a.com,b.com   add a block rule (id 6999) for those hosts to personalization.json — a lab that cannot
//                               see a price or search grid disappear when a rendering host is blocked proves nothing;
//   --drop-rules 6300,6301      remove those ids — the per-tab count must fall by what they matched;
//   --drop-rules all            remove the whole personalization ruleset — the 0.9.2 blocking on the 0.9.3 code: a
//                               difference that persists without a single personalization rule is not theirs.
const PLANT_BLOCK = (opt('--plant-block', null) || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const DROP_ALL = opt('--drop-rules', null) === 'all';
// `--label shard1` is appended to the report name, so several shards of one lab run in parallel without overwriting.
const LABEL = (opt('--label', '') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
const DROP_RULES = DROP_ALL ? [] : (opt('--drop-rules', null) || '').split(',').map((x) => x.trim()).filter(Boolean).map(Number).filter((x) => Number.isInteger(x));
const ONLY = (opt('--only', null) || '').split(',').filter(Boolean);
const MAX_RUNTIME_MS = Number(opt('--max-runtime', String((SHOPPING ? 40 + 25 * ROUNDS : SEEDED ? 75 : THIRD_PARTY ? 35 : 23) * 60 * 1000)));
if (OFF_ONLY && (SEEDED || LEARNER_FROM || PLANT_BLOCK.length || DROP_RULES.length || DROP_ALL)) {
  console.error('--off cannot be combined with --seeded / --learner-from / --plant-block / --drop-rules: they need the extension.');
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

/**
 * NEGATIVE CONTROLS for the shopping lab (`--plant-block`, `--drop-rules`): rewrite the UNPACKED store zip's
 * rules/personalization.json in the temp dir. Nothing is committed; the report says CONTROL in its name and title.
 * A drop that removes nothing, or a plant onto an empty host list, is not a control and aborts.
 */
function applyRuleControls(unpackDir) {
  if (!PLANT_BLOCK.length && !DROP_RULES.length && !DROP_ALL) return null;
  const file = path.join(unpackDir, 'rules', 'personalization.json');
  const before = fs.readFileSync(file, 'utf8');
  let rules = JSON.parse(before);
  const out = { plantBlock: PLANT_BLOCK.slice(), dropRules: [], dropAll: DROP_ALL, packagedSha256: sha256Of(before) };
  if (DROP_ALL) DROP_RULES.push(...rules.map((r) => r.id));
  if (DROP_RULES.length) {
    const missing = DROP_RULES.filter((id) => !rules.some((r) => r.id === id));
    if (missing.length) throw new Error(`--drop-rules: ${missing.join(',')} not in the packaged personalization.json — that is not a control`);
    rules = rules.filter((r) => !DROP_RULES.includes(r.id));
    out.dropRules = DROP_RULES.slice();
  }
  if (PLANT_BLOCK.length) {
    if (rules.some((r) => r.id === 6999)) throw new Error('--plant-block: id 6999 is taken in the packaged ruleset');
    rules.push({ id: 6999, priority: 1, action: { type: 'block' }, condition: { requestDomains: PLANT_BLOCK } });
  }
  const after = JSON.stringify(rules, null, 2) + '\n';
  fs.writeFileSync(file, after);
  out.controlSha256 = sha256Of(after);
  console.error(`[site-smoke] ⚠ CONTROL BUILD: personalization.json in ${unpackDir}${PLANT_BLOCK.length ? ` + planted block on ${PLANT_BLOCK.join(',')}` : ''}${DROP_ALL ? ' − ALL personalization rules' : DROP_RULES.length ? ` − rules ${DROP_RULES.join(',')}` : ''}`);
  return out;
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
const ruleLine = (r) => `${r.id} ${r.action.type}${r.action.type === 'modifyHeaders' ? '(strip Cookie/Set-Cookie)' : ''} requestDomains=[${(r.condition.requestDomains || []).join(',')}] excluded=[${(r.condition.excludedRequestDomains || []).join(',')}]${r.condition.excludedInitiatorDomains ? ` excludedInitiators=[${r.condition.excludedInitiatorDomains.join(',')}]` : ''} ${r.condition.domainType || ''}`;

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
  const blockingSets = ['ads', 'analytics', 'social', 'fingerprinting', 'personalization'];
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
  // An open alert/confirm/beforeunload dialog freezes every page.evaluate until it is closed. Close it (the
  // dismiss button: cancel, never confirm) and note it, identically in both passes.
  page.on('dialog', (d) => { pageErrors.push(`dialog ${d.type()}: ${d.message().slice(0, 120)}`); d.dismiss().catch(() => {}); });
  // Every uncaught exception and console error, for the shopping rows' "no NEW errors under the extension" check.
  // A resource the extension blocked logs `net::ERR_BLOCKED_BY_CLIENT` as a console error in Chrome: that is the
  // block itself, kept but sorted apart (`blockedResourceErrors`) from errors the page's own code threw.
  const pageErrors = [];
  // Klaviyo's form definitions are fetched during navigation, before any check runs (shopping rows' form check).
  const klaviyoForms = [];
  page.on('response', (res) => { if (klaviyoForms.length < 8 && /static-forms\.klaviyo\.com\/forms\/api\/|fast\.a\.klaviyo\.com\/forms\//.test(res.url())) klaviyoForms.push(`${res.status()} ${res.url().replace(/\?.*$/, '').slice(0, 100)}`); });
  page.on('pageerror', (e) => { if (pageErrors.length < 80) pageErrors.push('uncaught: ' + String(e && e.message || e).replace(/\s+/g, ' ').slice(0, 200)); });
  page.on('console', (msg) => { if (msg.type() === 'error' && pageErrors.length < 80) pageErrors.push('console: ' + msg.text().replace(/\s+/g, ' ').slice(0, 200)); });
  // A request an extension blocked has NO HTTP status — it fails with net::ERR_BLOCKED_BY_CLIENT. That error
  // text is the evidence; a "status" from any tool that reports failed requests is not (2026-09-28: a tool
  // printed 503 for every blocked request and sent a whole triage after response headers).
  const blockedByClient = [];
  page.on('requestfailed', (req) => {
    const err = req.failure() && req.failure().errorText;
    if (err && /ERR_BLOCKED_BY_CLIENT/.test(err)) blockedByClient.push(`${req.resourceType()} ${req.url().slice(0, 200)}`);
  });
  // Every DOCUMENT request (main frame, iframes, their redirects) with what became of it — for checks whose
  // evidence is a hand-off between frames rather than something drawn (row 28). Status only from a real
  // response; a request the extension blocked has `failed` and never a status.
  const documents = [];
  const docOf = new WeakMap();
  page.on('request', (req) => {
    if (req.resourceType() !== 'document') return;
    const d = { url: req.url().slice(0, 300), method: req.method(), status: null, failed: null };
    docOf.set(req, d); documents.push(d);
  });
  page.on('response', (res) => { const d = docOf.get(res.request()); if (d) d.status = res.status(); });
  page.on('requestfailed', (req) => { const d = docOf.get(req); if (d) d.failed = (req.failure() && req.failure().errorText) || 'failed'; });
  return { page, consoleLines, blockedByClient, documents, pageErrors, klaviyoForms };
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

/**
 * A challenge served with HTTP 200 (walmart.com "Robot or human?" — PerimeterX's press-and-hold, 2026-10-15): the
 * page is a wall whatever the status says. Recorded as BLOCKED, never solved or evaded. Shopping rows only — the
 * standard rows keep the status-gated check the earlier runs were made with.
 */
async function detectChallengePage(page) {
  await sleep(1500);
  const title = await page.title().catch(() => '');
  const text = await page.evaluate(() => (document.body ? document.body.innerText.slice(0, 600) : '')).catch(() => '');
  const m = /robot or human|press (&|and) hold|verify you are (a )?human|are you a robot|pardon our interruption|access denied|unusual (traffic|activity)|checking your browser|request unsuccessful/i.exec(`${title}\n${text}`);
  return m ? { evidence: `challenge page (HTTP 200): "${m[0]}" — ${title} — ${text.replace(/\s+/g, ' ').slice(0, 200)}` } : null;
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
// `policy: true` marks a provider no policy list protects: if a learned BLOCK rule is what removed it, the
// verdict is POLICY-BLOCKED — reported loudly, not counted as a
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
    key: 'tp-facebook-sdk-plugin', n: 26, label: 'Facebook JS SDK + Page plugin (fixture)', fixture: 'third-party-embeds.html?e=facebook', settleMs: 3500,
    protects: 'facebook.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)',
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
    key: 'tp-x-embedded-post', n: 27, label: 'X / Twitter embedded post (fixture)', fixture: 'third-party-embeds.html?e=tweet', settleMs: 3500,
    protects: 'twitter.com / x.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)',
    async check(page) {
      const post = await providerFrame(page, /^https:\/\/platform\.twitter\.com\/embed\/Tweet\.html/, {
        minW: 100, minH: 50,
        probe: () => { const t = document.body ? document.body.innerText : ''; return { ok: t.length > 20, text: t.replace(/\s+/g, ' ').slice(0, 60) }; },
      });
      return { ok: post.ok, detail: { post } };
    },
  },
  {
    // Not an embed: microsoft.com's OWN page, whose silent sign-in round-trips through Microsoft's identity
    // hosts and comes back as a form POST from login.live.com into a hidden www.microsoft.com frame. DNR judges
    // that POST third-party (initiator live.com), so a learned microsoft.com block killed it — the learner
    // itself calls the two one company (D52). Deterministic signed out: 4/4 fresh profiles on 2026-09-28 ran
    // microsoftonline → live → POST signin-oidc → 302 → cascadeauth/store/account/silentauth?auth=No.
    key: 'tp-msft-signin-handoff', n: 28, label: 'microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com)', url: 'https://www.microsoft.com/en-us', settleMs: 0,
    protects: 'www.microsoft.com receiving its own login hand-off — excludedInitiatorDomains (same company, D52)',
    async check(page, ctx) {
      const docs = ctx.documents || [];
      const HANDOFF = /^https:\/\/www\.microsoft\.com\/cascadeauth\/account\/signin-oidc/;
      const LANDED = /^https:\/\/www\.microsoft\.com\/cascadeauth\/store\/account\/silentauth/;
      const deadline = Date.now() + FRAME_WAIT_MS + 5000;   // 20 s; the self-test's short FRAME_WAIT_MS shortens it
      let handoff = null;
      let landed = false;
      for (;;) {
        handoff = docs.find((d) => HANDOFF.test(d.url)) || null;
        landed = page.frames().some((f) => LANDED.test(f.url()));
        if ((handoff && handoff.failed) || landed || Date.now() >= deadline) break;
        await sleep(500);
      }
      const chain = docs.filter((d) => /login\.(live|microsoftonline)\.com|\/cascadeauth\//.test(d.url))
        .map((d) => `${d.method} ${d.url.slice(0, 90)} → ${d.failed || d.status}`);
      // PASS = the server answered the hand-off (a real response — a blocked request never gets one) AND the
      // frame finished the round-trip on www.microsoft.com (a blocked frame lands on chrome-error://).
      const answered = !!handoff && handoff.status !== null && !handoff.failed;
      return {
        ok: answered && landed,
        detail: { handoff: handoff && { method: handoff.method, status: handoff.status, failed: handoff.failed }, landed, errorFrames: page.frames().filter((f) => /^chrome-error:/.test(f.url())).length, chain },
      };
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

// ── 4c. shopping rows — the breakage lab for rules/personalization.json (0.9.3) ─────────────────────────────
// What the "Pricing & personalization" category must never do: change the price a shopper is shown, stop the
// cart, empty the search results or the product grid. Each row loads a real product page and checks, OFF and ON:
//   · the declared price, read the way research/device-pricing/ reads it (ext/src/pricing.js's JSON-LD →
//     microdata → meta, zeros fall through, a page declaring several offers compared as the SET of prices), AND
//     the rendered price under the row's `priceSelector` — client-side price tests (Intelligems) rewrite the DOM,
//     never the server's JSON-LD, so a lab that read only markup would be blind to the one way a block could
//     raise a price;
//   · add-to-cart: the row's button is clicked (after a size/variant pick where the row says so) and the cart has
//     to say so — Shopify's own /cart.js count, a same-site cart request answered 2xx, an "added to bag" message,
//     or a cart badge that went up. Nothing is bought; no account, no form, no address;
//   · search: the row's search page must list product links;
//   · errors: every uncaught exception and console error, so the report can name the ones seen ON and never OFF;
//   · ON only: which personalization rules matched (`onRuleMatchedDebug`) and the D55 per-tab tally — the count
//     the popup shows — so "the new rules fire" is a measurement, not an inference.
// `vendors` is what the 2026-10-14 vendor map and exploration saw on the page; it is a label for the report, the
// rules that actually matched are measured. `klaviyo: true` adds the sign-up-form render check (Klaviyo's form
// hosts are protected by NEVER_BLOCK; its tracking hosts are blocked — the form has to keep rendering).
const SHOPIFY_PRICE = '.price-item--sale, .price-item--regular, .price__current, [data-product-price], .product__price, .product-price, .price';
const PICK_SIZE = [
  '[data-testid*="size" i] button:not([disabled]):not([aria-disabled="true"])',
  'button[data-testid*="size" i]:not([disabled]):not([aria-disabled="true"])',
  'button[aria-label*="size" i]:not([disabled]):not([aria-disabled="true"])',
  '[role="radiogroup"] [role="radio"]:not([aria-disabled="true"]):not([disabled])',
  'fieldset input[type="radio"]:not(:disabled) + label',
].join(', ');
const shop = (n, key, label, url, o = {}) => ({
  n, key, label, url, settleMs: 3000, shopping: true, checkTimeoutMs: 150000, ...o,
  async check(page, ctx) { return shoppingCheck(page, ctx, this); },
});
const SHOPPING_SITES = [
  // Pages where the vendor map (curl, 2026-10-14) or the in-browser exploration saw a vendor this ruleset blocks.
  shop(29, 'shop-gymshark', 'gymshark.com product', 'https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22',
    { vendors: 'Dynamic Yield (consent-gated), mParticle', priceSelector: '[data-testid="pdp-totalValue-read"]', atc: { pick: PICK_SIZE, button: '[data-testid="pdp-addToBag-submit"]' }, search: { url: 'https://www.gymshark.com/search?q=shorts', link: '/products/' } }),
  shop(30, 'shop-jetblue', 'jetblue.com home (Dynamic Yield content)', 'https://www.jetblue.com/',
    { vendors: 'Dynamic Yield (render hosts: cookie-strip only)', expectPrice: false, render: 'img[src*="dynamicyield.com"]' }),
  shop(31, 'shop-llbean', 'llbean.com product', 'https://www.llbean.com/llb/shop/129613',
    { vendors: 'Dynamic Yield', priceSelector: '.ProductPage_price, .ProductPrice_price', atc: { pick: PICK_SIZE, button: 'button.AddToBag_add-to-bag-button' }, search: { url: 'https://www.llbean.com/llb/search/?freeText=fleece', link: '/llb/shop/' } }),
  shop(32, 'shop-harborfreight', 'harborfreight.com product', 'https://www.harborfreight.com/20v-cordless-12-in-drilldriver-kit-with-2-ah-battery-and-charger-73216.html',
    { vendors: 'Dynamic Yield (collection + render)', priceSelector: '[data-testid="priceWrap"]', atc: { button: '[data-testid="atcButtonWrap"]' }, search: { url: 'https://www.harborfreight.com/search?q=drill', link: /-\d{5}\.html/ } }),
  shop(33, 'shop-gap', 'gap.com product', 'https://www.gap.com/browse/product.do?pid=403540002&vid=REGULAR',
    { vendors: 'Rokt/mParticle, Granify, Attentive, Bluecore', priceSelector: '[data-testid="pdp-title-price-wrapper"]', atc: { pick: PICK_SIZE, button: '#pdp-atb-btn' }, search: { url: 'https://www.gap.com/browse/search.do?searchText=jeans', link: 'product.do?pid=' } }),
  shop(34, 'shop-staples', 'staples.com product', 'https://www.staples.com/hammermill-copy-plus-8-5-x-11-copy-paper-20-lbs-92-brightness-5000-sheets-carton-105007/product_122374',
    { vendors: 'Bloomreach, Rokt, Attentive', priceSelector: '.price-info__final_price_sku', atc: { button: '#ctaButton' }, search: { url: 'https://www.staples.com/paper/directory_paper', link: '/product_' } }),
  shop(35, 'shop-sephora', 'sephora.com product', 'https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799?skuId=2837425',
    { vendors: 'Rokt/mParticle, Bluecore, Constructor beacon', atc: { button: 'button[data-at="add_to_basket_btn"]' }, search: { url: 'https://www.sephora.com/search?keyword=lipstick', link: '/product/' } }),
  shop(36, 'shop-officedepot', 'officedepot.com product', 'https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/',
    { vendors: 'Bloomreach', priceSelector: '.od-graphql-price-big-price', atc: { button: 'button.common-add-to-cart' }, search: { url: 'https://www.officedepot.com/catalog/search.do?Ntt=copy%20paper', link: '/a/products/' } }),
  shop(37, 'shop-allbirds', 'allbirds.com product', 'https://www.allbirds.com/products/mens-tree-runners',
    { vendors: 'Attentive', shopify: true, atc: { pick: PICK_SIZE, button: '[data-testid="pdp-atc-button"]' }, search: { url: 'https://www.allbirds.com/search?q=runner', link: '/products/' } }),
  shop(38, 'shop-target', 'target.com product', 'https://www.target.com/p/delilah-home-100-organic-cotton-bath-towel-collection/-/A-93159262?preselect=93048164',
    { vendors: 'Attentive', priceSelector: '[data-test="product-price"], [data-test="price-cdui"]', atc: { button: '[data-test="shippingButton"]' }, search: { url: 'https://www.target.com/s?searchTerm=towel', link: '/p/' } }),
  shop(39, 'shop-petsmart', 'petsmart.com product', 'https://www.petsmart.com/dog/food/dry-food/pedigree-grilled-steak-and-vegetable-flavor-dry-dog-food-70826.html',
    { vendors: 'Granify', priceSelector: '.pdp__price', atc: { button: '[data-testid="add-to-cart-button"]' }, search: { url: 'https://www.petsmart.com/search/?q=dog%20food', link: '/dog/' } }),
  shop(40, 'shop-jcpenney', 'jcpenney.com product', 'https://www.jcpenney.com/p/worthington-womens-modern-perfect-trouser/ppr5008151662',
    { vendors: 'Attentive, Constructor', atc: { pick: PICK_SIZE }, search: { url: 'https://www.jcpenney.com/s?searchTerm=jeans', link: '/p/' } }),
  shop(41, 'shop-bathandbodyworks', 'bathandbodyworks.com product', 'https://www.bathandbodyworks.com/p/champagne-toast-3-wick-candle-028029548',
    { vendors: 'Attentive, Monetate (not blocked), Einstein recs (not blocked)', atc: {}, search: { url: 'https://www.bathandbodyworks.com/search?q=candle', link: '/p/' } }),
  shop(42, 'shop-instacart', 'instacart.com home', 'https://www.instacart.com/',
    { vendors: 'Rokt', expectPrice: false }),
  // Shopify stores carrying Klaviyo sign-up forms and/or Intelligems price tests (in-browser exploration, 2026-10-14).
  shop(43, 'shop-drsquatch', 'drsquatch.com product (Klaviyo)', 'https://www.drsquatch.com/products/mountain-meadow',
    { vendors: 'Klaviyo, Constructor beacon', shopify: true, klaviyo: true, priceSelector: '[data-testid="price-current"]', atc: { button: '[data-testid="add-to-cart-button"]' }, search: { url: 'https://www.drsquatch.com/search?q=soap', link: '/products/' } }),
  shop(44, 'shop-beardbrand', 'beardbrand.com product (Klaviyo)', 'https://www.beardbrand.com/products/tree-ranger-beard-oil',
    { vendors: 'Klaviyo', shopify: true, klaviyo: true, priceSelector: SHOPIFY_PRICE, atc: {}, search: { url: 'https://beardbrand.com/search?q=oil', link: '/products/' } }),
  shop(45, 'shop-puravida', 'puravidabracelets.com product (Klaviyo, Intelligems)', 'https://www.puravidabracelets.com/products/solid-original?variant=40140395479126',
    { vendors: 'Klaviyo, Intelligems', shopify: true, klaviyo: true, priceSelector: SHOPIFY_PRICE, atc: {}, search: { url: 'https://www.puravidabracelets.com/search?q=bracelet', link: '/products/' } }),
  shop(46, 'shop-colourpop', 'colourpop.com product (Klaviyo, Intelligems)', 'https://colourpop.com/products/eeveelution-shadow-palette',
    { vendors: 'Klaviyo, Intelligems, Attentive, Nosto', shopify: true, klaviyo: true, priceSelector: SHOPIFY_PRICE, atc: {}, search: { url: 'https://colourpop.com/search?q=lipstick', link: '/products/' } }),
  shop(47, 'shop-rothys', "rothys.com product (Intelligems)", 'https://rothys.com/products/womens-pointed-toe-flat-black',
    { vendors: 'Intelligems, Attentive, Constructor', shopify: true, priceSelector: '.price-item--sale, .js-price-item--sale', atc: { pick: PICK_SIZE }, search: { url: 'https://rothys.com/search?q=flat', link: '/products/' } }),
  shop(48, 'shop-brooklinen', 'brooklinen.com product', 'https://www.brooklinen.com/products/classic-core-sheet-set?variant=41405018112090',
    { vendors: 'Dynamic Yield, Attentive', shopify: true, priceSelector: '.Price__Discounted, .Price__Default, ' + SHOPIFY_PRICE, atc: {}, search: { url: 'https://www.brooklinen.com/search?q=sheets', link: '/products/' } }),
  // Major retailers with none of these vendors seen (the "at least 10 other" product pages). A walled page is BLOCKED.
  shop(49, 'shop-walmart', 'walmart.com product', 'https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121',
    { priceSelector: '[data-testid="price-wrap"]', atc: {}, search: { url: 'https://www.walmart.com/search?q=towel', link: '/ip/' } }),
  shop(50, 'shop-bestbuy', 'bestbuy.com product', 'https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-earbuds-with-hearing-aid-feature-white/JJGCQ88C8X',
    { atc: {}, search: { url: 'https://www.bestbuy.com/site/searchpage.jsp?st=usb+c+cable', link: '/product/' } }),
  shop(51, 'shop-ikea', 'ikea.com product', 'https://www.ikea.com/us/en/p/lack-side-table-white-30449908/',
    { atc: {}, search: { url: 'https://www.ikea.com/us/en/search/?q=lamp', link: '/us/en/p/' } }),
  shop(52, 'shop-nike', 'nike.com product', 'https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111',
    { priceSelector: '[data-testid="currentPrice-container"]', atc: { pick: PICK_SIZE, button: '[data-testid="atb-button"]' }, search: { url: 'https://www.nike.com/w?q=socks', link: '/t/' } }),
  shop(53, 'shop-zappos', 'zappos.com product', 'https://www.zappos.com/p/converse-chuck-taylor-all-star-high-top-sneaker-black/product/107999/color/3',
    { atc: { pick: PICK_SIZE }, search: { url: 'https://www.zappos.com/socks', link: '/p/' } }),
  shop(54, 'shop-ulta', 'ulta.com product', 'https://www.ulta.com/p/lash-sensational-sky-high-mascara-pimprod2020260?sku=2574523',
    { priceSelector: '.pal-c-Price--PDP', atc: {}, search: { url: 'https://www.ulta.com/search?search=mascara', link: '/p/' } }),
  shop(55, 'shop-apple', 'apple.com Buy iPad (many offers)', 'https://www.apple.com/shop/buy-ipad/ipad', {}),
  shop(56, 'shop-dell', 'dell.com product', 'https://www.dell.com/en-us/shop/laptop-computers/spd/xps13dx13260', {}),
  shop(57, 'shop-away', 'awaytravel.com product', 'https://www.awaytravel.com/suitcases/bigger-carry-on', { atc: {} }),
  shop(58, 'shop-costco', 'costco.com bath towels', 'https://www.costco.com/bath-towels.html',
    { priceSelector: '[data-testid^="Text_Price_"]', search: { url: 'https://www.costco.com/s?keyword=towel', link: '.product.' } }),
  shop(59, 'shop-lowes', 'lowes.com search', 'https://www.lowes.com/search?searchTerm=hammer', {}),
  shop(60, 'shop-homedepot', 'homedepot.com search', 'https://www.homedepot.com/s/hammer', {}),
  shop(61, 'shop-kohls', 'kohls.com search', 'https://www.kohls.com/search.jsp?search=towel', {}),
  shop(62, 'shop-macys', 'macys.com search', 'https://www.macys.com/shop/featured/towel', {}),
];

// The extractor is the extension's own (`ext/src/pricing.js`), loaded once, exactly as harness/device-price-probe.mjs does.
let PRICING = null;
async function loadPricing() {
  if (PRICING) return PRICING;
  await import(pathToFileURL(path.join(EXT, 'src', 'pricing.js')).href);
  PRICING = globalThis.NullechoPricing;
  if (!PRICING || typeof PRICING.jsonLdPrices !== 'function') throw new Error('ext/src/pricing.js did not install NullechoPricing');
  return PRICING;
}

const isZeroPrice = (p) => p !== null && /^0+(?:[.,]0+)?$/.test(p);
const money = (p) => { const n = Number(String(p).replace(/,/g, '')); return Number.isFinite(n) ? n.toFixed(2) : String(p); };

/** research/device-pricing METHOD §1.4: JSON-LD → microdata → meta, zeros fall through; several offers → the sorted set. */
function declaredPrice(c) {
  const P = PRICING;
  const first = (cands, source) => {
    for (const x of cands) {
      const price = P.cleanPrice(x?.price);
      if (price === null || isZeroPrice(price)) continue;
      return { price: money(price), currency: P.cleanCurrency(x?.currency, x?.price), source };
    }
    return null;
  };
  const ld = P.jsonLdPrices(c.jsonLd || []);
  const ctx = first(ld, 'json-ld')
    ?? first((c.microdata || []).map((m) => ({ price: m?.value, currency: m?.currency })), 'microdata')
    ?? first([{ price: c.meta?.amount, currency: c.meta?.currency }], 'meta');
  if (!ctx) return null;
  if (ctx.source === 'json-ld') {
    const distinct = [...new Set(ld.map((x) => P.cleanPrice(x.price)).filter((p) => p !== null && !isZeroPrice(p)).map(money))];
    if (distinct.length > 1) return { ...ctx, price: distinct.map(Number).sort((a, b) => a - b).map((n) => n.toFixed(2)).join('/'), source: `json-ld-set(${distinct.length})` };
  }
  return ctx;
}

/** "$59 . 99", "Now $169.99", "Regular price $125 Sale price $109" (the selector names the sale element) → "59.99". */
function visibleAmount(text) {
  const m = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\s?\.\s?(\d{2}))?/.exec(text || '');
  return m ? `${m[1].replace(/,/g, '')}.${m[2] ?? '00'}` : null;
}

async function collectPriceSources(page, selector) {
  return page.evaluate((sel) => {
    const out = { jsonLd: [], microdata: [], meta: {}, visibleText: null };
    for (const n of Array.from(document.querySelectorAll('script[type="application/ld+json"]')).slice(0, 24)) {
      const t = n.textContent; if (t && t.length < 300000) out.jsonLd.push(t);
    }
    for (const el of Array.from(document.querySelectorAll('[itemprop="price"]')).slice(0, 8)) {
      const cur = el.parentElement?.querySelector('[itemprop="priceCurrency"]');
      out.microdata.push({ value: el.getAttribute('content') ?? el.textContent, currency: cur?.getAttribute('content') ?? cur?.textContent ?? null });
    }
    const amt = document.querySelector('meta[property="og:price:amount"], meta[property="product:price:amount"]');
    const cur = document.querySelector('meta[property="og:price:currency"], meta[property="product:price:currency"]');
    out.meta = { amount: amt?.getAttribute('content') ?? null, currency: cur?.getAttribute('content') ?? null };
    if (sel) {
      try {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
          if (r.width && r.height && /\$\s?\d/.test(t)) { out.visibleText = t.slice(0, 120); break; }
        }
      } catch (e) { out.visibleError = String(e.message || e).slice(0, 100); }
    }
    return out;
  }, selector || null);
}

/** Poll for the declared and rendered price (client-rendered pages need the wait), then read again after hydration. */
async function readPrices(page, site) {
  await loadPricing();
  const read = async () => {
    const c = await collectPriceSources(page, site.priceSelector).catch(() => ({ jsonLd: [] }));
    return { declared: declaredPrice(c), visible: c.visibleText ? { price: visibleAmount(c.visibleText), text: c.visibleText } : null };
  };
  let r = await read();
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && (!r.declared || (site.priceSelector && !r.visible))) { await sleep(700); r = await read(); }
  await sleep(1500);
  const again = await read();
  const changed = JSON.stringify(again) !== JSON.stringify(r);
  const final = (again.declared || again.visible) ? again : r;
  return { ...final, changedAfterHydration: changed ? { first: r } : false };
}

const ADDED_RE = /added to (your )?(cart|bag|basket)|item(s)? added|added!|view (cart|bag|basket)|added to cart|in your (cart|bag)/i;
const registrableOf = (host) => String(host || '').split('.').slice(-2).join('.');

async function cartSignals(page, shopify) {
  return withTimeout(page.evaluate(async (isShopify) => {
    const out = { added: false, badge: null, shopify: null };
    out.added = /added to (your )?(cart|bag|basket)|item(s)? added|added!|view (cart|bag|basket)|added to cart|in your (cart|bag)/i.test(document.body ? document.body.innerText : '');
    let max = null;
    for (const el of document.querySelectorAll('[aria-label*="cart" i], [aria-label*="bag" i], [aria-label*="basket" i], [data-test*="cart" i], [data-testid*="cart" i], [class*="cart-count" i], [class*="cartCount" i], [class*="bag-count" i], [class*="CartCount" i], [id*="cart-count" i]')) {
      // A badge is a bare 1–2 digit number, or "N item(s)" in an aria-label — never a price ("$55").
      const inner = (el.innerText || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      const m = /^\d{1,2}$/.test(inner) ? [null, inner] : aria.match(/\b(\d{1,2})\s*(items?|products?)\b/i);
      if (m) max = Math.max(max ?? 0, Number(m[1]));
    }
    out.badge = max;
    if (isShopify) {
      try {
        const ac = new AbortController(); setTimeout(() => ac.abort(), 5000);
        const c = await (await fetch('/cart.js', { credentials: 'same-origin', cache: 'no-store', signal: ac.signal })).json();
        out.shopify = { count: c.item_count, totalPrice: c.total_price, currency: c.currency };
      } catch (e) { out.shopify = { error: String(e.message || e).slice(0, 80) }; }
    }
    return out;
  }, !!shopify), 9000, 'cartSignals').catch((e) => ({ error: String(e.message || e).slice(0, 100) }));
}

/** Click add-to-cart and require the cart to say so. Never goes past the cart: no checkout, no account, no form. */
async function addToCart(page, site) {
  const a = site.atc;
  if (!a) return { attempted: false };
  const base = registrableOf(new URL(page.url()).hostname);
  const net = [];
  let armed = false;
  const onResp = (res) => {
    if (!armed) return;
    const req = res.request();
    if (req.method() === 'GET' || req.method() === 'OPTIONS') return;
    let u; try { u = new URL(res.url()); } catch { return; }
    if (registrableOf(u.hostname) !== base) return;
    // The cart by its PATH (`/cart/add.js`, `/api/cart`, `/baskets`, `cart_items`), or a GraphQL mutation that names
    // it. Never an analytics or logging beacon that merely REPORTS an add (measured 2026-10-15: Adobe `/b/ss/`,
    // nike `/g/collect`, zappos `/kratos/api/log/ingest` all fire on the add OFF, and are blocked or never loaded ON,
    // so counting them made the cart look broken ON when only the beacon was gone).
    if (/\/b\/ss\/|\/collect\b|\/log\b|ingest|\/events?\b|\/track|analytics|metrics|beacon|pixel|monorail|sst-ev/i.test(u.pathname)) return;
    const body = (() => { try { return String(req.postData() || '').slice(0, 4000); } catch { return ''; } })();
    const byPath = /\/cart|\/basket|\/bag(\/|$)|add-?to-?(cart|bag|basket)|addtocart|cart_items|\/atc\b/i.test(u.pathname);
    const byBody = /mutation[^{]{0,80}\{[^}]{0,200}(cart|basket|bag)|"operationName"\s*:\s*"[^"]*(cart|basket|bag)[^"]*"/i.test(body);
    if (!byPath && !byBody) return;
    net.push({ status: res.status(), method: req.method(), url: (u.origin + u.pathname).slice(0, 140), by: byPath ? 'path' : 'body' });
  };
  page.on('response', onResp);
  try {
    let picked = null;
    if (a.pick) {
      picked = await withTimeout(page.evaluate((sel) => {
        // A size/variant control has a short label ("M", "10.5", "28W") and is not a guide, a chart or a sold-out size.
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          const text = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
          const label = `${text} ${el.getAttribute('aria-label') || ''}`;
          if (!r.width || !r.height || el.disabled || /sold out|unavailable|notify|out of stock|guide|chart|find your|fit/i.test(label)) continue;
          if (text.length === 0 || text.length > 8) continue;
          el.scrollIntoView({ block: 'center' }); el.click();
          return text;
        }
        return null;
      }, a.pick), 8000, 'size pick').catch(() => null);
      if (picked) await sleep(1200);
    }
    const before = await cartSignals(page, site.shopify);
    // The button: the row's selector, else the first visible, enabled "add to cart/bag/basket" control.
    const handle = await withTimeout(page.evaluateHandle((sel) => {
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled && el.getAttribute('aria-disabled') !== 'true'; };
      const pool = sel ? Array.from(document.querySelectorAll(sel)) : [];
      const byText = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'))
        .filter((b) => /add to (cart|bag|basket)/i.test((b.innerText || b.value || b.getAttribute('aria-label') || '').trim()));
      return [...pool, ...byText].find(visible) || null;
    }, a.button || null), 8000, 'find add-to-cart');
    const el = handle.asElement();
    if (!el) return { attempted: true, ok: false, picked, reason: 'no visible, enabled add-to-cart control' };
    const label = await withTimeout(el.evaluate((b) => (b.innerText || b.value || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40)), 5000, 'label').catch(() => '');
    armed = true;
    await withTimeout(el.evaluate((b) => b.scrollIntoView({ block: 'center' })), 5000, 'scroll').catch(() => {});
    await withTimeout(el.click(), 8000, 'click').catch(async () => { await withTimeout(el.evaluate((b) => b.click()), 5000, 'click()').catch(() => {}); });
    let after = null;
    const evidence = [];
    // A Shopify store whose /cart.js answers is judged by that count alone — the cart's own record. Elsewhere any
    // one of: a same-site cart request answered 2xx, an "added" message that was not there before, a badge going up.
    const shopifyCart = !!(before.shopify && Number.isInteger(before.shopify.count));
    let decided = false;
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      await sleep(1000);
      after = await cartSignals(page, site.shopify);
      evidence.length = 0;
      const countUp = after.shopify && Number.isInteger(after.shopify.count) && after.shopify.count > before.shopify?.count;
      if (countUp) evidence.push(`Shopify /cart.js item_count ${before.shopify.count}→${after.shopify.count}`);
      const okNet = net.filter((n) => n.status >= 200 && n.status < 300);
      if (okNet.length) evidence.push(`same-site cart request ${okNet[0].status} ${okNet[0].method} ${okNet[0].url}`);
      if (after.added && !before.added) evidence.push('"added to cart/bag" message appeared');
      if (after.badge != null && after.badge > (before.badge ?? 0)) evidence.push(`cart badge ${before.badge ?? 0}→${after.badge}`);
      decided = shopifyCart ? !!countUp : evidence.length > 0;
      if (decided) break;
    }
    // The cart's price for ONE unit, and only from a cart that holds the item: an empty cart's 0.00 is not a price.
    const count = after && after.shopify && after.shopify.count;
    const unit = shopifyCart && decided && Number.isInteger(count) && count > 0 && Number.isInteger(after.shopify.totalPrice)
      ? (after.shopify.totalPrice / 100 / count).toFixed(2) : null;
    return { attempted: true, ok: decided, picked, clicked: label, evidence: evidence.slice(), cartRequests: net.slice(0, 6), before, after, cartTotal: unit };
  } catch (e) {
    return { attempted: true, ok: false, error: String(e.message || e).slice(0, 160) };
  } finally {
    page.off('response', onResp);
  }
}

/** The search page must list product links (unique hrefs containing the row's marker). */
async function searchCheck(page, site, ctx) {
  const s = site.search;
  if (!s) return null;
  const out = { url: s.url, httpStatus: null, count: 0, ok: false };
  try {
    const resp = await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    out.httpStatus = resp ? resp.status() : null;
    const wall = await detectBotWall(page, out.httpStatus) || await detectChallengePage(page);
    if (wall) { out.blocked = true; out.blockedEvidence = wall.evidence; return out; }
    const re = s.link instanceof RegExp ? s.link.source : null;
    const deadline = Date.now() + 15000;
    let last = -1;
    while (Date.now() < deadline) {
      await sleep(1000);
      out.count = await page.evaluate((marker, reSrc) => {
        const rx = reSrc ? new RegExp(reSrc) : null;
        const set = new Set();
        for (const a of document.querySelectorAll('a[href]')) {
          const h = a.href.split('#')[0];
          if (rx ? rx.test(h) : h.includes(marker)) set.add(h);
        }
        return set.size;
      }, typeof s.link === 'string' ? s.link : '', re).catch(() => 0);
      if (out.count >= 3 && out.count === last) break;
      last = out.count;
    }
    out.ok = out.count > 0;
    if (ctx.ext) { await sleep(1200); out.tally = await ctx.ext.tally(page.url()).catch(() => null); }
  } catch (e) { out.error = String(e.message || e).slice(0, 160); }
  return out;
}

/** Klaviyo's sign-up forms: klaviyo.js present, the form definitions fetched, a form or its email field rendered. */
async function klaviyoCheck(page, formResponses) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(() => {});
  await sleep(6000);
  const dom = await page.evaluate(() => {
    const forms = document.querySelectorAll('[class*="klaviyo-form"], [class*="kl-private-reset-css"], [data-testid="POPUP"], [data-testid="FLYOUT"], [data-testid="modal-form-container"]');
    const emails = Array.from(document.querySelectorAll('input[type="email"], input[name="email"]')).filter((i) => i.closest('[class*="klaviyo"], [class*="kl-private"]'));
    return { klaviyo: typeof window.klaviyo, formNodes: forms.length, klaviyoEmailInputs: emails.length, enabledEmailInputs: emails.filter((i) => !i.disabled).length };
  }).catch(() => ({}));
  return { ...dom, formDefinitions: formResponses.slice(0, 4) };
}

/** The shopping row's check. ctx.offRecord (standard passes) adds the ON-vs-OFF comparison to `reasons`. */
async function shoppingCheck(page, ctx, site) {
  // Written into ctx.partial as it fills, so a row that runs out of time still reports what it measured and
  // which step it was on (`trace`), instead of a bare timeout.
  const detail = ctx.partial || {};
  detail.vendors = site.vendors || null;
  const t0 = Date.now();
  detail.trace = [];
  const step = (name) => detail.trace.push(`${name}@${Math.round((Date.now() - t0) / 100) / 10}s`);
  const formResponses = ctx.klaviyoForms || [];
  {
    step('start');
    detail.title = (await page.title().catch(() => '')).slice(0, 90);
    detail.bodyLen = await page.evaluate(() => (document.body ? document.body.innerText.length : 0)).catch(() => 0);
    step('prices');
    const prices = await readPrices(page, site);
    detail.declared = prices.declared;
    detail.visible = prices.visible;
    if (prices.changedAfterHydration) detail.changedAfterHydration = prices.changedAfterHydration;
    if (site.render) detail.render = await page.evaluate((sel) => document.querySelectorAll(sel).length, site.render).catch(() => null);
    step('klaviyo');
    if (site.klaviyo) detail.klaviyo = await klaviyoCheck(page, formResponses);
    if (ctx.ext) { await sleep(1000); detail.productTally = await ctx.ext.tally(page.url()).catch(() => null); }
    step('atc');
    detail.atc = await addToCart(page, site);
    step('search');
    detail.search = await searchCheck(page, site, ctx);
    step('done');
  }
  const reasons = [];
  const priced = !!(detail.declared || detail.visible);
  if (site.expectPrice !== false && !priced) reasons.push('no declared or rendered price read');
  if (detail.atc && detail.atc.attempted && !detail.atc.ok) reasons.push(`add-to-cart not confirmed (${detail.atc.reason || detail.atc.error || 'no cart evidence'})`);
  if (detail.search && !detail.search.ok && !detail.search.blocked) reasons.push(`search listed ${detail.search.count} product links`);
  if (detail.klaviyo && detail.klaviyo.klaviyo !== 'object') reasons.push('klaviyo.js did not load');
  // `ok` is this load doing its job. ON-vs-OFF is judged across the paired loads (shoppingVerdict), not here.
  const ok = reasons.length === 0;
  return { ok, detail, reasons };
}

/** ON vs OFF for one pair of loads. Every price difference is reported, whatever its cause. */
function compareShopping(off, on) {
  const out = [];
  const p = (x) => (x ? x.price : null);
  if (p(off.declared) !== null && p(on.declared) !== null && p(off.declared) !== p(on.declared)) out.push(`DECLARED PRICE DIFFERS: OFF ${p(off.declared)} vs ON ${p(on.declared)}`);
  if (p(off.declared) !== null && p(on.declared) === null) out.push(`declared price ${p(off.declared)} OFF, none ON`);
  if (p(off.visible) && p(on.visible) && p(off.visible) !== p(on.visible)) out.push(`RENDERED PRICE DIFFERS: OFF ${p(off.visible)} vs ON ${p(on.visible)}`);
  if (p(off.visible) && !p(on.visible)) out.push(`rendered price ${p(off.visible)} OFF, none ON`);
  if (off.atc && off.atc.cartTotal && on.atc && on.atc.cartTotal && off.atc.cartTotal !== on.atc.cartTotal) out.push(`CART PRICE DIFFERS: OFF ${off.atc.cartTotal} vs ON ${on.atc.cartTotal}`);
  if (off.atc && off.atc.ok && on.atc && on.atc.attempted && !on.atc.ok) out.push('add-to-cart worked OFF, not ON');
  if (off.search && off.search.ok && on.search && !on.search.ok && !on.search.blocked) out.push(`search: ${off.search.count} product links OFF, ${on.search.count} ON`);
  if (typeof off.render === 'number' && off.render > 0 && on.render === 0) out.push(`render: ${off.render} vendor-rendered elements OFF, 0 ON`);
  if (off.klaviyo && on.klaviyo && off.klaviyo.formNodes > 0 && !on.klaviyo.formNodes) out.push(`Klaviyo form rendered OFF (${off.klaviyo.formNodes} nodes), not ON`);
  return out;
}

const ALL_SITES = [...SITES, ...THIRD_PARTY_SITES, ...SHOPPING_SITES];
/** The OFF-pass-then-ON-pass rows. `--shopping` runs none of them. */
const selectedSites = () => {
  if (SHOPPING) return [];
  const pool = THIRD_PARTY ? [...SITES, ...THIRD_PARTY_SITES] : SITES;
  return ONLY.length ? [...SITES, ...THIRD_PARTY_SITES].filter((s) => ONLY.includes(s.key)) : pool;
};
/** The shopping rows: always with `--shopping`, and in the seeded release gate (once each). */
const selectedShoppingSites = () => {
  if (!SHOPPING && !SEEDED) return [];
  return ONLY.length ? SHOPPING_SITES.filter((s) => ONLY.includes(s.key)) : SHOPPING_SITES;
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
  const { page, consoleLines, blockedByClient, documents, pageErrors, klaviyoForms } = await freshPage(browser, ua);
  const url = urlOf(site);
  const record = { site: site.key, withExtension: ctxIn.withExtension, url, ok: false, blocked: false, blockedEvidence: null, skipped: false, skipReason: null, void: false, reasons: [], detail: {}, probes: null, visibility: null, consoleLines: [], httpStatus: null, error: null, blockedByClient: [], learnedHits: null };
  if (ctxIn.seed) await ctxIn.seed.drain().catch(() => {});   // hits from before this row belong to no row
  if (ctxIn.ext) await ctxIn.ext.drain().catch(() => {});
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
    const wall = await detectBotWall(page, record.httpStatus) || (site.shopping ? await detectChallengePage(page) : null);
    if (wall) {
      record.probes = await probes(page).catch(() => null);
      record.blocked = true;
      record.blockedEvidence = wall.evidence;
      return record;   // `finally` does the rest — and drains the learned hits exactly once
    }
    // Shopping rows leave a consent banner exactly as it is — neither accepted nor declined. Declining would switch
    // off the very vendors under test on consent-managed sites (measured: gap.com loaded no Rokt, Granify or
    // Attentive after "Reject all"), and accepting is not ours to do. ON and OFF see the same banner.
    if (!site.shopping) await dismissCookieBanner(page).catch(() => {});
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
    const ctx = { ...ctxIn, probes: record.probes, httpStatus: record.httpStatus, documents, klaviyoForms, partial: {} };
    const result = await withTimeout(site.check(page, ctx), site.checkTimeoutMs || 45000, site.key).catch((e) => ({ ok: false, error: String(e.message || e).slice(0, 300), detail: ctx.partial }));
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
    record.pageErrors = pageErrors.slice(0, 60);
    await page.close().catch(() => {});
    if (ctxIn.seed) record.learnedHits = await ctxIn.seed.drain().catch((e) => ({ hits: [], note: 'drain failed: ' + e.message }));
    if (ctxIn.ext) record.personalizationHits = await ctxIn.ext.drain().catch((e) => ({ hits: [], note: 'drain failed: ' + e.message }));
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
    // After seeding (which reloads the extension): attach to the worker that is actually running.
    const ext = withExtension ? await extHandle(browser, unpackDir) : null;
    return { browser, version, presence, seed, ext, close };
  } catch (e) { await close(); throw e; }
}

/**
 * The ON browser's view of what Nullecho did on a page (shopping rows): every match of a personalization rule
 * (`onRuleMatchedDebug`, unpacked builds) and the D55 per-tab tally — the webRequest count the popup falls back to,
 * read from `storage.session` under the key the loaded background.js uses. The tab is found by URL (Nullecho has
 * <all_urls>, so `tabs.query` sees URLs). Re-attaches if the service worker restarted.
 */
async function extHandle(browser, unpackDir) {
  const bg = fs.readFileSync(path.join(unpackDir, 'src', 'background.js'), 'utf8');
  const keyMatch = bg.match(/const TAB_TALLY_KEY = '([^']+)'/);
  if (!keyMatch) throw new Error('could not find `const TAB_TALLY_KEY = \'…\'` in the loaded src/background.js — the tally format drifted; update the harness');
  const KEY = keyMatch[1];
  const install = () => {
    if (globalThis.__pzHits) return 'present';
    // chrome.* is bound a beat after the worker target appears: return null (retry) until it is, and mark the
    // recorder installed only once its listener is on — a half-installed recorder would report 0 matches forever.
    if (!globalThis.chrome || !chrome.declarativeNetRequest) return null;
    if (!chrome.declarativeNetRequest.onRuleMatchedDebug) return 'unavailable';
    const hits = [];
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((i) => {
      if (i.rule.rulesetId !== 'personalization' || hits.length >= 5000) return;
      hits.push({ ruleId: i.rule.ruleId, type: i.request.type, url: String(i.request.url).slice(0, 200), tabId: i.request.tabId });
    });
    globalThis.__pzHits = hits;
    return 'installed';
  };
  let worker = null;
  const attach = async () => {
    const t = browser.targets().find(isExtensionWorker) || await browser.waitForTarget(isExtensionWorker, { timeout: 15000 });
    worker = await t.worker();
    for (let i = 0; i < 10; i++) {
      const st = await worker.evaluate(install).catch(() => null);
      if (st) return st;
      await sleep(300);
    }
    return 'failed';
  };
  const status = await attach();
  const readTally = (w, url) => w.evaluate(async (u, key) => {
    const tabs = await chrome.tabs.query({});
    const byUrl = tabs.find((t) => t.url === u);
    const t = byUrl || tabs.find((x) => x.active);
    if (!t) return null;
    const all = (await chrome.storage.session.get(key))[key] || {};
    return { tabId: t.id, matchedBy: byUrl ? 'url' : 'active-tab', total: all[t.id]?.total ?? 0, byCategory: all[t.id]?.byCategory ?? {} };
  }, url, KEY);
  return {
    status,
    async drain() {
      try {
        const h = await worker.evaluate(() => (globalThis.__pzHits ? globalThis.__pzHits.splice(0) : null));
        if (h) return { hits: h };
      } catch { /* worker gone */ }
      const st = await attach().catch(() => 'failed');
      return { hits: [], restarted: true, note: `worker restarted (${st}) — hits before this point lost` };
    },
    async tally(url) {
      try { return await readTally(worker, url); } catch { await attach().catch(() => {}); return readTally(worker, url); }
    },
  };
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
      const ctx = { withExtension, seed: env.seed, ext: env.ext, hostCores: off ? off.probes?.cores : undefined, hostMem: off ? off.probes?.mem : undefined, offGpc: off ? off.probes?.gpc : undefined, offProbes: off ? off.probes : undefined };
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

// ── 5b. the shopping lab: OFF and ON load the same page at the same moment, `rounds` times ────────────────────
/**
 * Two browsers stay open for the whole lab — OFF (no extension, proven) and ON (the store zip, seeded in a seeded
 * run). For each round, for each row, both load the row's page CONCURRENTLY: a price that drifts over minutes then
 * moves both sides at once instead of masquerading as an extension effect, which is the same time control as
 * research/device-pricing's interleaving, made tighter. Rounds are the same-device repeat control: a page whose OFF
 * price disagrees with itself across rounds is noise, and is reported as such rather than hidden.
 */
async function runShoppingLab({ unpackDir, ua, rounds, sites }) {
  const offEnv = await openPassBrowser({ withExtension: false, unpackDir: null, label: 'shop-off' });
  let onEnv;
  try { onEnv = await openPassBrowser({ withExtension: true, unpackDir, label: 'shop-on' }); } catch (e) { await offEnv.close(); throw e; }
  const loads = Object.fromEntries(sites.map((s) => [s.key, []]));
  const pair = async (site, round) => {
    console.error(`[site-smoke] shopping r${round} ${site.label} …`);
    const [off, on] = await Promise.all([
      runSite(offEnv.browser, site, { withExtension: false }, ua),
      runSite(onEnv.browser, site, { withExtension: true, seed: onEnv.seed, ext: onEnv.ext }, ua),
    ]);
    loads[site.key].push({ round, off, on });
    const diffs = off.blocked || on.blocked ? [] : compareShopping(off.detail || {}, on.detail || {});
    console.error(`  → OFF ${off.blocked ? 'BLOCKED' : off.ok ? 'ok' : 'not-ok'} ${off.detail?.declared?.price ?? off.detail?.visible?.price ?? '-'} | ON ${on.blocked ? 'BLOCKED' : on.ok ? 'ok' : 'not-ok'} ${on.detail?.declared?.price ?? on.detail?.visible?.price ?? '-'}${diffs.length ? ' | ' + diffs.join('; ') : ''} | pz hits ${(on.personalizationHits?.hits || []).length}`);
  };
  let rulesAtEnd = null;
  try {
    for (let round = 1; round <= rounds; round++) {
      for (const site of sites) {
        if (budgetLeft() < 150000) { loads[site.key].push({ round, skipped: 'runtime budget exceeded' }); continue; }
        await pair(site, round);
      }
    }
    // The gate runs each row once; a row that FAILs there gets one more pair before it is reported (the retry the
    // OFF-then-ON passes give a FAIL). With --rounds ≥ 2 the rounds are the control and nothing is retried.
    if (rounds === 1) {
      for (const site of sites) {
        if (shoppingVerdict(site, loads[site.key]).verdict !== 'FAIL' || budgetLeft() < 150000) continue;
        console.error(`[site-smoke] shopping retry: ${site.label}`);
        await pair(site, 2);
      }
    }
    if (onEnv.seed) rulesAtEnd = await onEnv.seed.dumpRules().catch(() => null);
  } finally {
    await offEnv.close();
    await onEnv.close();
  }
  const rows = sites.map((site) => ({ site, loads: loads[site.key], ...shoppingVerdict(site, loads[site.key]) }));
  return { rows, presence: { off: offEnv.presence, on: onEnv.presence }, seedReport: onEnv.seed ? onEnv.seed.report : null, rulesAtEnd, extStatus: onEnv.ext ? onEnv.ext.status : null };
}

const uniq = (xs) => [...new Set(xs)];
const priceOf = (rec, k) => rec && rec.detail && rec.detail[k] ? rec.detail[k].price : null;
const normErr = (e) => e.replace(/https?:\/\/\S+/g, (u) => u.replace(/[?#].*$/, '')).replace(/\d{3,}/g, '#').slice(0, 160);

/**
 * One verdict per shopping row from all its OFF/ON pairs.
 *   BLOCKED       walled in every pair, both sides (recorded, never evaded)
 *   FAIL          a wall ON only; or, in most pairs, ON lost add-to-cart / search / a vendor-rendered element / a
 *                 Klaviyo form that OFF had; or ON read a price OFF never read (declared, rendered, or cart)
 *   INCONCLUSIVE  ON's prices are all prices OFF also read, but OFF disagreed with itself (A/B or time noise)
 *   NOT-OURS      the page's own checks fail with the extension OFF too, and ON is no worse
 *   PASS          otherwise
 * Every price difference in every pair is listed in `priceNotes`, whatever the verdict.
 */
function shoppingVerdict(site, loads) {
  const done = loads.filter((l) => l.off && l.on);
  const voided = done.filter((l) => l.off.void || l.on.void);
  const usable = done.filter((l) => !l.off.void && !l.on.void);
  const base = { pairs: done.length, summary: null, priceNotes: [], functionalNotes: [] };
  if (!usable.length) return { ...base, verdict: voided.length ? 'VOID' : 'SKIPPED', reason: voided.length ? 'every pair void (network or hidden tab)' : 'not run (runtime budget)' };
  const offWall = usable.filter((l) => l.off.blocked).length;
  const onWall = usable.filter((l) => l.on.blocked).length;
  // A load that errored (navigation failed, or the check ran out of time) measured only part of the page: it is
  // never compared. An ON-only error counts against the extension; an OFF-only or two-sided one is reported.
  const unwalled = usable.filter((l) => !l.off.blocked && !l.on.blocked);
  const both = unwalled.filter((l) => !l.off.error && !l.on.error);
  const onOnlyErr = unwalled.filter((l) => !l.off.error && l.on.error);
  const otherErr = unwalled.filter((l) => l.off.error);
  const s = {
    declaredOff: uniq(both.map((l) => priceOf(l.off, 'declared') ?? '—')), declaredOn: uniq(both.map((l) => priceOf(l.on, 'declared') ?? '—')),
    visibleOff: uniq(both.map((l) => priceOf(l.off, 'visible') ?? '—')), visibleOn: uniq(both.map((l) => priceOf(l.on, 'visible') ?? '—')),
    cartOff: uniq(both.map((l) => l.off.detail?.atc?.cartTotal ?? '—')), cartOn: uniq(both.map((l) => l.on.detail?.atc?.cartTotal ?? '—')),
    atcOff: both.map((l) => (l.off.detail?.atc?.attempted ? (l.off.detail.atc.ok ? '✓' : '✗') : '·')).join(''),
    atcOn: both.map((l) => (l.on.detail?.atc?.attempted ? (l.on.detail.atc.ok ? '✓' : '✗') : '·')).join(''),
    searchOff: both.map((l) => (l.off.detail?.search ? (l.off.detail.search.blocked ? 'W' : l.off.detail.search.count) : '·')).join('/'),
    searchOn: both.map((l) => (l.on.detail?.search ? (l.on.detail.search.blocked ? 'W' : l.on.detail.search.count) : '·')).join('/'),
    rulesFired: {}, tallyPersonalization: [], tallyTotal: [],
    newOnErrors: [], walls: { off: offWall, on: onWall },
  };
  for (const l of usable) {
    for (const h of l.on.personalizationHits?.hits || []) s.rulesFired[h.ruleId] = (s.rulesFired[h.ruleId] || 0) + 1;
    const t = l.on.detail?.productTally;
    if (t) { s.tallyPersonalization.push(t.byCategory?.personalization ?? 0); s.tallyTotal.push(t.total ?? 0); }
  }
  const offErrs = new Set(usable.flatMap((l) => (l.off.pageErrors || []).map(normErr)));
  s.newOnErrors = uniq(usable.flatMap((l) => (l.on.pageErrors || []).map(normErr)).filter((e) => !offErrs.has(e)));
  s.newOnPageErrors = s.newOnErrors.filter((e) => !/ERR_BLOCKED_BY_CLIENT/.test(e));
  const out = { ...base, summary: s };
  for (const l of onOnlyErr) out.functionalNotes.push(`r${l.round}: ON did not finish (${String(l.on.error).slice(0, 80)}; reached ${(l.on.detail?.trace || []).slice(-1)[0] || 'nothing'}), OFF did`);
  for (const l of otherErr) out.functionalNotes.push(`r${l.round}: not compared — OFF ${String(l.off.error).slice(0, 60)}${l.on.error ? `, ON ${String(l.on.error).slice(0, 60)}` : ''}`);
  if (!both.length && unwalled.length) {
    if (onOnlyErr.length) return { ...out, verdict: 'FAIL', reason: out.functionalNotes.slice(0, 2).join(' | ') };
    return { ...out, verdict: 'ERROR', reason: `no pair finished on both sides — ${out.functionalNotes.slice(0, 2).join(' | ')}` };
  }
  if (!both.length) {
    if (onWall && !offWall) return { ...out, verdict: 'FAIL', reason: `bot wall ON only, ${onWall}/${usable.length} pair(s): ${(usable.find((l) => l.on.blocked).on.blockedEvidence || '').slice(0, 120)}` };
    return { ...out, verdict: 'BLOCKED', reason: (usable.find((l) => l.off.blocked) || usable[0]).off.blockedEvidence || (usable[0].on.blockedEvidence || 'walled') };
  }
  for (const l of both) {
    for (const d of compareShopping(l.off.detail || {}, l.on.detail || {})) {
      (/PRICE DIFFERS|price .* none ON/.test(d) ? out.priceNotes : out.functionalNotes).push(`r${l.round}: ${d}`);
    }
  }
  const lostPairs = both.filter((l) => compareShopping(l.off.detail || {}, l.on.detail || {}).some((d) => !/PRICE DIFFERS/.test(d))).length + onOnlyErr.length;
  const offVaries = s.declaredOff.length > 1 || s.visibleOff.length > 1 || s.cartOff.length > 1;
  const onOnly = (on, off) => on.filter((p) => p !== '—' && !off.includes(p));
  const novelPrice = [...onOnly(s.declaredOn, s.declaredOff), ...onOnly(s.visibleOn, s.visibleOff), ...onOnly(s.cartOn, s.cartOff)];
  const allOffFail = both.every((l) => !l.off.ok);
  if (onWall && !offWall) return { ...out, verdict: 'FAIL', reason: `bot wall ON only in ${onWall}/${usable.length} pair(s)` };
  if (novelPrice.length) return { ...out, verdict: 'FAIL', reason: `ON read a price OFF never read: ${novelPrice.join(', ')} — ${out.priceNotes.slice(0, 2).join(' | ')}` };
  if (lostPairs * 2 > both.length + onOnlyErr.length) return { ...out, verdict: allOffFail ? 'NOT-OURS' : 'FAIL', reason: out.functionalNotes.slice(0, 3).join(' | ') };
  if (out.priceNotes.length && offVaries) return { ...out, verdict: 'INCONCLUSIVE', reason: `price varies with the extension OFF too (OFF ${s.declaredOff.join('/')}${s.visibleOff.length > 1 ? `, rendered ${s.visibleOff.join('/')}` : ''}) — ${out.priceNotes.slice(0, 2).join(' | ')}` };
  if (allOffFail && both.every((l) => !l.on.ok)) return { ...out, verdict: 'NOT-OURS', reason: `fails with the extension OFF too — off: ${(both[0].off.reasons || []).join('; ') || both[0].off.error || 'check failed'}` };
  const notes = [...out.priceNotes, ...out.functionalNotes];
  return { ...out, verdict: 'PASS', reason: notes.length ? `minority differences: ${notes.slice(0, 3).join(' | ')}` : '' };
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
  const ruleControl = pkg ? applyRuleControls(pkg.unpackDir) : null;
  const stdSites = selectedSites();
  const shopSites = OFF_ONLY ? [] : selectedShoppingSites();
  const fixture = THIRD_PARTY && stdSites.length ? await startFixtureServer() : null;
  if (fixture) FIXTURE = { origin: fixture.origin };

  // probe browser version + build a stable desktop UA before any real pass
  const probeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-smoke-probe-'));
  const { browser: probeBrowser, version: chromeVersion } = await launchBrowser({ extDir: null, profile: probeProfile });
  await probeBrowser.close().catch(() => {});
  fs.rmSync(probeProfile, { recursive: true, force: true });
  const ua = desktopUA(chromeVersion.split(' ')[0]);

  // The youtube/maps/embed self-test guards the standard rows; a --shopping run has none (its negative control is
  // --plant-block: a planted block on a rendering host must turn rows red).
  const selfTestResult = stdSites.length ? await selfTest(ua) : null;
  const tpSelfTestBroken = Object.entries(selfTestResult?.thirdParty || {}).filter(([, v]) => v.actuallyFailed !== true).map(([k]) => k);
  if (selfTestResult && (selfTestResult.youtube.actuallyFailed !== true || selfTestResult.maps.actuallyFailed !== true || tpSelfTestBroken.length)) {
    console.error('⚠ SELF-TEST WARNING: a check did not fail when it should have' + (tpSelfTestBroken.length ? ` (${tpSelfTestBroken.join(', ')})` : '') + '. Trusting PASS verdicts from it is unsound this run.');
  }

  let off = { records: {}, presence: null };
  if (stdSites.length) {
  console.error('[site-smoke] OFF pass (no extension) — establishing host baseline…');
  off = await runPass({ withExtension: false, unpackDir: null, offRecords: null, ua });
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

  }
  let on = { records: {}, chromeVersion };
  const retrySeedReports = [];
  if (!OFF_ONLY && stdSites.length) {
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
          const ctx = { withExtension: true, seed: env.seed, ext: env.ext, hostCores: offR.probes?.cores, hostMem: offR.probes?.mem, offGpc: offR.probes?.gpc, offProbes: offR.probes };
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

  // ── the shopping lab (0.9.3): its own OFF + ON browsers, the ON one seeded in a seeded run ──
  let shopping = null;
  if (shopSites.length) {
    console.error(`[site-smoke] SHOPPING LAB — ${shopSites.length} rows × ${ROUNDS} round(s), OFF and ON concurrently${SEEDED ? ', ON seeded' : ''}${ruleControl ? ', ⚠ CONTROL rules' : ''}…`);
    try {
      shopping = await runShoppingLab({ unpackDir: pkg.unpackDir, ua, rounds: ROUNDS, sites: shopSites });
    } catch (e) {
      if (!(e instanceof SeedingError)) throw e;
      console.error('\n✗✗✗ ' + e.message);
      writeSeedingFailure({ pkg, control, chromeVersion, error: e.message, report: e.report || null });
      process.exit(3);
    }
  }

  // verify the metadata-leak trap never fired
  const metadataLeaked = fs.existsSync(path.join(EXT, '_metadata'));
  if (metadataLeaked) console.error('⚠ ext/_metadata/ EXISTS — this must never be committed. Investigate immediately.');

  // ── verdicts ────────────────────────────────────────────────────────────
  const ruleById = on.seedReport ? new Map((on.seedReport.rulesAfterReload || []).map((r) => [r.id, r])) : null;
  const learnedBlocks = (rec) => (rec && rec.learnedHits && rec.learnedHits.hits ? rec.learnedHits.hits.filter((h) => isLearnedBlockId(h.ruleId)) : []);
  const sites = stdSites;
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
  // Shopping rows join the same table: the first pair's records stand for the row, the verdict is the lab's.
  for (const row of shopping ? shopping.rows : []) {
    const first = row.loads.find((l) => l.off && l.on) || {};
    results.push({ site: row.site, on: first.on || null, off: first.off || null, verdict: row.verdict, reason: row.reason, shop: row,
      onLoads: row.loads.filter((l) => l.on).map((l) => l.on) });
  }

  // D50 invariant over every row's traffic: a learned BLOCK on a protected host is a FAIL even when the row's
  // functional check did not notice (2026-09-28 control: the pre-D50 learner blocked reCAPTCHA Enterprise on
  // open.spotify.com and Google's sign-in frame on youtube.com while both rows' checks still passed).
  for (const res of results) {
    const hits = res.onLoads ? res.onLoads.flatMap((r) => learnedBlocks(r)) : learnedBlocks(res.on);
    const bad = hits.map((h) => ({ h, entry: protectedEntryFor(h.url) })).filter((x) => x.entry);
    res.protectedHostBlocks = bad.map(({ h, entry }) => `${describeHit(h, ruleById)} — protected by ${entry}`);
    if (bad.length && (res.verdict === 'PASS' || res.verdict === 'POLICY-BLOCKED' || res.verdict === 'NOT-OURS' || res.verdict === 'BLOCKED' || res.verdict === 'INCONCLUSIVE')) {
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

  const seedFindings = [...(on.seedReport ? on.seedReport.findings : []), ...retrySeedReports.flatMap((r) => r.findings.map((f) => `retry browser: ${f}`)),
    ...(shopping && shopping.seedReport ? shopping.seedReport.findings.map((f) => `shopping-lab browser: ${f}`) : [])];
  const meta = {
    date: today(),
    code,
    package: pkg ? { version: pkg.version, zipName: pkg.zipName, sha256: pkg.sha256, size: pkg.size } : null,
    control,
    ruleControl,
    shoppingMode: SHOPPING, rounds: ROUNDS,
    shoppingEnv: shopping ? { presence: shopping.presence, extStatus: shopping.extStatus, seed: shopping.seedReport, rulesAtEnd: shopping.rulesAtEnd } : null,
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
  if (ruleControl) console.error(`  ⚠ CONTROL RUN (personalization rules ${ruleControl.plantBlock.length ? 'planted: ' + ruleControl.plantBlock.join(',') : ''}${ruleControl.dropAll ? ' dropped: ALL' : ruleControl.dropRules.length ? ' dropped: ' + ruleControl.dropRules.join(',') : ''}) — NOT the store package.`);
  // Seeded mode is a release GATE: a FAIL, a VOID measurement, a finding from the reload, or a seeded rule
  // disappearing mid-run all make it red. The default smoke keeps its report-only exit code.
  if (SEEDED || SHOPPING) {
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
  const suffix = (meta.shoppingMode ? '-shopping' : '') + (meta.seeded ? '-seeded' : meta.thirdParty ? '-thirdparty' : '') + (meta.control ? `-control-${meta.control.revSha.slice(0, 7)}` : '')
    + (meta.ruleControl ? `-control-${meta.ruleControl.plantBlock.length ? 'plant' : ''}${meta.ruleControl.dropAll ? 'dropall' : meta.ruleControl.dropRules.length ? 'drop' + meta.ruleControl.dropRules.join('_') : ''}` : '');
  const base = `${meta.date}-site-smoke${suffix}-${meta.code.tag}${LABEL ? '-' + LABEL : ''}`;
  const jsonPath = path.join(outDir, `${base}.json`);
  const mdPath = path.join(outDir, `${base}.md`);

  fs.writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2));

  const fmtProbes = (r) => r ? `gpc=${r.probes?.gpc === undefined ? 'undefined' : r.probes?.gpc} cores=${r.probes?.cores} mem=${r.probes?.mem}` : 'n/a';
  const fmtVerdict = (ok, blocked, skipped, isVoid) => isVoid ? 'VOID' : skipped ? 'SKIPPED' : blocked ? 'BLOCKED' : ok ? 'PASS' : 'FAIL';
  const ruleById = meta.seed ? new Map((meta.seed.rulesAfterReload || []).map((x) => [x.id, x])) : null;

  let md = `# Nullecho pre-release site smoke${meta.shoppingMode ? ` — SHOPPING LAB (${meta.rounds} rounds)` : ''}${meta.seeded ? ' — SEEDED learned state' : ''}${meta.control || meta.ruleControl ? ' — ⚠ NEGATIVE CONTROL' : ''} — ${meta.date}\n\n`;
  if (meta.ruleControl) {
    md += `> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The unpacked store zip's \`rules/personalization.json\` was rewritten in the temp dir`;
    md += `${meta.ruleControl.plantBlock.length ? ` with a planted block rule (id 6999) on \`${meta.ruleControl.plantBlock.join(', ')}\`` : ''}${meta.ruleControl.dropAll ? ' with EVERY personalization rule removed (0.9.2 blocking)' : meta.ruleControl.dropRules.length ? ` with rules ${meta.ruleControl.dropRules.join(', ')} removed` : ''} `;
    md += `(sha256 packaged \`${meta.ruleControl.packagedSha256.slice(0, 16)}…\` → control \`${meta.ruleControl.controlSha256.slice(0, 16)}…\`). Its FAILs, or its lower counts, are the point.\n\n`;
  }
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

  if (meta.selfTest) {
  md += `\n## Self-test — attacking our own checks before trusting a PASS\n\n`;
  const st = meta.selfTest;
  md += `| Check | Deliberately broken how | Expected | Actual | Result |\n|---|---|---|---|---|\n`;
  md += `| youtube playback | navigated but never pressed play | check should report FAIL | ${st.youtube.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${st.youtube.actuallyFailed ? '✅' : '❌'} |\n`;
  md += `| maps zoom | ran the same wheel-zoom check on example.com (no map) | check should report FAIL | ${st.maps.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${st.maps.actuallyFailed ? '✅' : '❌'} |\n`;
  for (const [k, v] of Object.entries(st.thirdParty || {})) {
    md += `| ${k} | ran on the fixture page with NO embed (\`?e=none\`) | check should report FAIL | ${v.actuallyFailed ? 'FAILED (correct)' : 'PASSED (⚠ check is broken)'} | ${v.actuallyFailed ? '✅' : '❌'} |\n`;
  }
  md += `\nDetail: youtube ${JSON.stringify(st.youtube.detail)}; maps ${JSON.stringify(st.maps.detail)}\n`;
  }
  if (meta.shoppingEnv) md += shoppingReportSection(meta, results);

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
    if (r.shop) continue;   // shopping rows: "Every pair" in the shopping section
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

/** The shopping lab's own section: the price table first, then every difference, then every pair. */
function shoppingReportSection(meta, results) {
  const rows = results.filter((r) => r.shop);
  const env = meta.shoppingEnv || {};
  const esc = (x) => String(x ?? '').replace(/\|/g, '\\|');
  const arrow = (a, b) => (a.join('/') === b.join('/') ? `${a.join('/')} = ${b.join('/')}` : `**${a.join('/')} → ${b.join('/')}**`);
  let md = `\n## Shopping lab — the breakage lab for \`rules/personalization.json\`\n\n`;
  md += `${rows.length} pages × ${meta.rounds} round(s). Each round loads each page in an OFF browser (no extension) and an ON browser `;
  md += `(the store zip${meta.seeded ? ', seeded with the learned state above' : ''}) **at the same moment**, then: the declared price `;
  md += `(ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) `;
  md += `and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, `;
  md += `an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught `;
  md += `exception and console error; and, ON only, each personalization-rule match (\`onRuleMatchedDebug\`) and the D55 per-tab tally.\n\n`;
  md += `- OFF browser really OFF: ${env.presence && env.presence.off && env.presence.off.extensionTargets.length === 0 ? 'yes' : '⚠ ' + JSON.stringify(env.presence && env.presence.off)}; `;
  md += `ON worker: ${env.presence && env.presence.on && env.presence.on.worker ? env.presence.on.worker : '⚠ none'}; personalization match recorder: \`${env.extStatus}\`\n`;
  if (env.seed) md += `- ON browser seeded: positive control ${env.seed.ok ? '✅' : '❌'} (${env.seed.positiveControl.filter((c) => c.ok).length}/${env.seed.positiveControl.length}), ${env.seed.rulesAfterReload.length} learned rules live\n`;
  md += `\n| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |\n`;
  md += `|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    const s = r.shop.summary;
    if (!s) { md += `| ${r.site.n} | ${esc(r.site.label)} | ${esc(r.site.vendors || '—')} | **${r.verdict}** | ${esc(r.reason)} |  |  |  |  |  |  |  |\n`; continue; }
    const fired = Object.entries(s.rulesFired).sort((a, b) => a[0] - b[0]).map(([id, n]) => `${id}×${n}`).join(' ') || '—';
    md += `| ${r.site.n} | ${esc(r.site.label)} | ${esc(r.site.vendors || '—')} | **${r.verdict}** | ${arrow(s.declaredOff, s.declaredOn)} | ${arrow(s.visibleOff, s.visibleOn)} | ${arrow(s.cartOff, s.cartOn)} | ${s.atcOff || '·'} / ${s.atcOn || '·'} | ${s.searchOff} / ${s.searchOn} | ${fired} | ${s.tallyPersonalization.join(', ') || '—'} | ${s.newOnPageErrors.length} |\n`;
  }
  md += `\n✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.\n`;
  const totals = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
  md += `\n**Shopping totals:** ${Object.entries(totals).map(([k, v]) => `${v} ${k}`).join(', ')}\n`;
  const notes = rows.flatMap((r) => (r.shop.priceNotes || []).map((n) => `${r.site.n}. ${r.site.label}: ${n}`));
  md += `\n### Every price difference in every pair — including noise\n\n${notes.length ? notes.map((n) => `- ${n}`).join('\n') : '_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._'}\n`;
  const fn = rows.flatMap((r) => (r.shop.functionalNotes || []).map((n) => `${r.site.n}. ${r.site.label}: ${n}`));
  md += `\n### Every functional difference (cart, search, rendered vendor content, Klaviyo form)\n\n${fn.length ? fn.map((n) => `- ${n}`).join('\n') : '_None._'}\n`;
  md += `\n### Errors seen ON and never OFF\n\nUncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `;
  md += `\`net::ERR_BLOCKED_BY_CLIENT\` lines are the blocks themselves and are counted, not listed.\n\n`;
  let anyErr = false;
  for (const r of rows) {
    const s = r.shop.summary;
    if (!s) continue;
    const blockedLines = s.newOnErrors.length - s.newOnPageErrors.length;
    if (!s.newOnPageErrors.length && !blockedLines) continue;
    anyErr = true;
    md += `- **${r.site.n}. ${esc(r.site.label)}** (${blockedLines} blocked-resource line(s))${s.newOnPageErrors.length ? ':' : ''}\n`;
    for (const e of s.newOnPageErrors.slice(0, 8)) md += `  - \`${e.replace(/`/g, "'")}\`\n`;
  }
  if (!anyErr) md += '_None._\n';
  md += `\n### Every pair\n`;
  for (const r of rows) {
    md += `\n#### ${r.site.n}. ${esc(r.site.label)} — **${r.verdict}**${r.reason ? ` — ${esc(r.reason).slice(0, 300)}` : ''}\n\n\`${r.site.url}\`\n\n`;
    for (const l of r.shop.loads) {
      if (!l.off || !l.on) { md += `- r${l.round}: ${l.skipped || 'not run'}\n`; continue; }
      for (const [side, rec] of [['OFF', l.off], ['ON', l.on]]) {
        const d = rec.detail || {};
        const parts = [`http ${rec.httpStatus}`];
        if (rec.blocked) parts.push(`BLOCKED: ${String(rec.blockedEvidence || '').slice(0, 120)}`);
        if (rec.void) parts.push(`VOID: ${rec.error}`);
        if (rec.error && !rec.void) parts.push(`error: ${String(rec.error).slice(0, 120)}`);
        if (d.declared) parts.push(`declared ${d.declared.price} ${d.declared.currency || ''} (${d.declared.source})`);
        if (d.visible) parts.push(`rendered ${d.visible.price} ("${String(d.visible.text).slice(0, 50)}")`);
        if (d.atc && d.atc.attempted) parts.push(`cart ${d.atc.ok ? '✓ ' + (d.atc.evidence || []).join('; ') : '✗ ' + (d.atc.reason || d.atc.error || 'no evidence')}${d.atc.cartTotal ? ` total ${d.atc.cartTotal}` : ''}${d.atc.picked ? ` (picked ${d.atc.picked})` : ''}`);
        if (d.search) parts.push(`search ${d.search.blocked ? 'WALLED' : d.search.count + ' links'}`);
        if (typeof d.render === 'number') parts.push(`vendor-rendered elements ${d.render}`);
        if (d.klaviyo) parts.push(`klaviyo ${d.klaviyo.klaviyo}, form nodes ${d.klaviyo.formNodes}, form email inputs ${d.klaviyo.klaviyoEmailInputs}, definitions [${(d.klaviyo.formDefinitions || []).join(', ')}]`);
        if (side === 'ON') {
          const hits = rec.personalizationHits?.hits || [];
          const hostOfHit = (h) => { try { return new URL(h.url).host; } catch { return '?'; } };
          parts.push(`personalization matches ${hits.length}${hits.length ? ` [${uniq(hits.map((h) => `${h.ruleId} ${hostOfHit(h)}`)).slice(0, 10).join(', ')}]` : ''}${rec.personalizationHits?.restarted ? ' ⚠ ' + rec.personalizationHits.note : ''}`);
          if (d.productTally) parts.push(`tab tally (${d.productTally.matchedBy}) total ${d.productTally.total}, personalization ${d.productTally.byCategory?.personalization ?? 0}`);
        }
        md += `- r${l.round} **${side}** — ${esc(parts.join(' · '))}\n`;
      }
    }
  }
  return md;
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e && e.stack || e); process.exit(1); });
