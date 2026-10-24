/**
 * Shared plumbing for workstream J (cookie pricing). METHOD.md is the authority; this file implements §2 of it:
 * the browser configuration, the four device profiles, the stage-1 live-load guard, wall detection, the cookie
 * role labels, the battery gate, and the recorder that keeps cookie VALUES, IP addresses and personal paths out of
 * everything written to the repo.
 *
 * No extension is loaded anywhere in workstream J.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── arguments ───────────────────────────────────────────────────────────────────────────────────────────
export function cli(argv = process.argv.slice(2)) {
  const opt = (n, d = null) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  const num = (n, d) => { const v = opt(n, null); return v === null ? d : Number(v); };
  const flag = (n) => argv.includes(n);
  const list = (n, d = '') => (opt(n, d) || '').split(',').map((s) => s.trim()).filter(Boolean);
  const firstOpt = argv.findIndex((a) => a.startsWith('--'));
  return { argv, opt, num, flag, list, positional: firstOpt < 0 ? argv.slice() : argv.slice(0, firstOpt) };
}

// ── puppeteer, without a dependency in the repo (and without a personal path in it) ─────────────────────
export function loadPuppeteer(dir = null) {
  const tried = [];
  for (const d of [dir, process.env.NULLECHO_PUPPETEER_DIR].filter(Boolean)) {
    try {
      const req = createRequire(path.join(path.resolve(d), 'package.json'));
      const pup = req('puppeteer');
      try { pup.__jVersion = req('puppeteer/package.json').version; } catch { /* no version */ }
      return pup;
    } catch (e) { tried.push(`${path.basename(d)} (${e.code || e.message})`); }
  }
  try { return createRequire(import.meta.url)('puppeteer'); } catch (e) { tried.push(`repo (${e.code})`); }
  console.error(`puppeteer not found (tried: ${tried.join('; ')}). Pass --puppeteer <dir> or set NULLECHO_PUPPETEER_DIR.`);
  process.exit(2);
}

// ── device profiles ─────────────────────────────────────────────────────────────────────────────────────
/**
 * The four profiles of research/device-pricing/METHOD.md §1.1, copied from harness/device-price-probe.mjs
 * buildProfiles() (keep in sync). One addition, recorded in METHOD.md §2.2: `platform` sets navigator.platform to
 * match the claimed OS; the device-pricing probe left it at the host's value ("MacIntel" on every profile).
 */
export function buildProfiles(puppeteer, chromeMajor, chromeFull) {
  const brands = [
    { brand: 'Chromium', version: String(chromeMajor) },
    { brand: 'Google Chrome', version: String(chromeMajor) },
    { brand: 'Not;A=Brand', version: '99' },
  ];
  const fullVersionList = [
    { brand: 'Chromium', version: chromeFull },
    { brand: 'Google Chrome', version: chromeFull },
    { brand: 'Not;A=Brand', version: '99.0.0.0' },
  ];
  const iphone = puppeteer.KnownDevices['iPhone 15 Pro'];
  return {
    'mac-chrome': {
      id: 'mac-chrome', label: 'Chrome on macOS (desktop)', platform: 'MacIntel',
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`,
      metadata: { brands, fullVersionList, platform: 'macOS', platformVersion: '15.6.0', architecture: 'arm64', model: '', mobile: false, bitness: '64', wow64: false },
      viewport: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
    },
    'win-chrome': {
      id: 'win-chrome', label: 'Chrome on Windows (desktop)', platform: 'Win32',
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`,
      metadata: { brands, fullVersionList, platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', model: '', mobile: false, bitness: '64', wow64: false },
      viewport: { width: 1536, height: 864, deviceScaleFactor: 1.25, isMobile: false, hasTouch: false },
    },
    'iphone-safari': {
      id: 'iphone-safari', label: 'Safari on iPhone (puppeteer KnownDevices "iPhone 15 Pro", UA verbatim)', platform: 'iPhone',
      userAgent: iphone.userAgent,
      metadata: null, // Safari sends no client hints; none are invented
      viewport: { ...iphone.viewport },
    },
    'android-chrome': {
      id: 'android-chrome', label: 'Chrome on a low-end Android phone (device-pricing id "android-budget")', platform: 'Linux armv81',
      userAgent: `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Mobile Safari/537.36`,
      metadata: { brands, fullVersionList, platform: 'Android', platformVersion: '13.0.0', architecture: '', model: 'SM-A135F', mobile: true, bitness: '', wow64: false },
      viewport: { width: 360, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  };
}
export const DEVICE_IDS = ['mac-chrome', 'win-chrome', 'iphone-safari', 'android-chrome'];

// ── the live-load guard (stage 1 = fixtures only) ───────────────────────────────────────────────────────
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
export function isLoopback(u) {
  try { const h = new URL(u).hostname; return LOOPBACK.has(h) || h.endsWith('.localhost'); } catch { return false; }
}
/** Without --live, any non-loopback target is refused before a browser starts. */
export function assertTarget(u, live) {
  if (!live && !isLoopback(u)) {
    console.error(`REFUSED: ${new URL(u).hostname} is a live site and --live was not given (stage 1 runs fixtures only).`);
    process.exit(3);
  }
}

// ── browsers ────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The launch configuration documented by research/bot-manager-2026-10/tesla (rig/run-tesla.mjs): automation flags
 * off (navigator.webdriver false), nothing else hidden or spoofed beyond the device profile. Headful for live
 * runs (METHOD.md §2.1); the fixture self-test runs headless.
 */
export const LAUNCH_FLAGS = ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled', '--lang=en-US'];
export const IGNORE_DEFAULT_ARGS = ['--enable-automation', '--disable-extensions'];

export function makeCtx(c, { label }) {
  const puppeteer = loadPuppeteer(c.opt('--puppeteer'));
  const live = c.flag('--live');
  const headless = c.flag('--headless') || (!live && !c.flag('--headful'));
  return { puppeteer, live, headless, label, blocked: [], profiles: null, chrome: null, tmpRoot: null };
}

export async function launch(ctx, { userDataDir = null, keep = false } = {}) {
  ctx.tmpRoot ??= fs.mkdtempSync(path.join(os.tmpdir(), 'jcp-'));
  const dir = userDataDir || fs.mkdtempSync(path.join(ctx.tmpRoot, 'p-'));
  const browser = await ctx.puppeteer.launch({ headless: ctx.headless, userDataDir: dir, args: [...LAUNCH_FLAGS, '--window-size=1440,960'], ignoreDefaultArgs: IGNORE_DEFAULT_ARGS, defaultViewport: null });
  if (!ctx.profiles) {
    const v = await browser.version(); // e.g. "Chrome/149.0.7827.22" (or HeadlessChrome/…)
    const full = v.split('/')[1];
    ctx.chrome = full;
    ctx.profiles = buildProfiles(ctx.puppeteer, full.split('.')[0], full);
  }
  return {
    browser, dir,
    close: async () => { await browser.close().catch(() => {}); if (!keep && !userDataDir) fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

/** A new tab dressed as `deviceId`. In fixture mode every non-loopback request is aborted and counted. */
export async function devicePage(ctx, browser, deviceId) {
  const prof = ctx.profiles[deviceId];
  if (!prof) throw new Error(`unknown device ${deviceId}`);
  const page = await browser.newPage();
  await page.setViewport(prof.viewport);
  await page.setUserAgent({ userAgent: prof.userAgent, ...(prof.metadata ? { userAgentMetadata: prof.metadata } : {}), platform: prof.platform });
  if (!ctx.live) {
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (isLoopback(u) || /^(data|blob|about):/.test(u)) r.continue().catch(() => {});
      else { ctx.blocked.push(new URL(u).hostname); r.abort('blockedbyclient').catch(() => {}); }
    });
  }
  page.setDefaultTimeout(45000);
  return page;
}

export async function closeAll(ctx) { if (ctx.tmpRoot) fs.rmSync(ctx.tmpRoot, { recursive: true, force: true }); }

// ── walls ───────────────────────────────────────────────────────────────────────────────────────────────
/** Copied from harness/device-price-probe.mjs WALL_PHRASES (plus HUMAN's "Robot or human?"). */
export const WALL_PHRASES = [
  'access denied', 'robot or human', 'are you a human', 'are you a robot', 'press & hold', 'press and hold',
  'verify you are human', 'verifying you are human', 'just a moment', 'pardon our interruption',
  'unusual traffic', 'captcha', 'attention required', 'request blocked', 'request unsuccessful',
  'checking your browser', 'enable javascript and cookies to continue', 'access to this page has been denied',
  'please verify you are a human', 'you have been blocked', 'reference #', 'bot detection',
  'something about your browser', 'automated access', 'we need to verify', 'security check', 'human verification',
  'incident id', 'your request has been blocked', 'not a robot', 'confirm you are not a robot',
  'unable to give you access', 'security issue was automatically', 'reference error:', 'performing security verification',
  'hang tight', 'sit tight', 'you are in a queue', 'waiting room',
];
export const WALL_STATUS = new Set([401, 403, 429, 503]);
/** A wall is a walling status, or a wall phrase near the top of a page that yielded no price data. */
export function wallVerdict({ status, title = '', head = '', hasData }) {
  if (WALL_STATUS.has(status)) return { wall: true, why: `http ${status}` };
  if (hasData) return { wall: false };
  const t = `${title}\n${head}`.toLowerCase();
  const hit = WALL_PHRASES.find((p) => t.includes(p));
  return hit ? { wall: true, why: hit } : { wall: false };
}

/**
 * Pre-registered politeness rules (METHOD.md §2.4): 3 walls running → cool off; a second run → stop. 429 → stop.
 * More than half of the first 10 loads walled → the site is BLOCKED for this study.
 */
export class WallRules {
  constructor({ coolOffMs = 15 * 60000, maxStreaks = 2, log = console.error } = {}) { Object.assign(this, { coolOffMs, maxStreaks, log, streak: 0, streaks: 0, walls: 0, loads: 0, stopped: null }); }
  async note({ wall, status }) {
    this.loads++;
    if (status === 429) { this.stopped = 'http 429 (rate limited): stop for the day'; return; }
    if (wall) this.walls++;
    if (this.loads === 10 && this.walls > 5) { this.stopped = `${this.walls} of the first 10 loads walled: site BLOCKED`; return; }
    if (!wall) { this.streak = 0; return; }
    this.streak++;
    if (this.streak >= 3) {
      this.streaks++; this.streak = 0;
      if (this.streaks >= this.maxStreaks) { this.stopped = `${this.maxStreaks} runs of 3 consecutive walls: stop`; return; }
      this.log(`  3 walls in a row: cooling off ${Math.round(this.coolOffMs / 1000)} s`);
      await sleep(this.coolOffMs);
    }
  }
}

// ── cookies: names and roles only ───────────────────────────────────────────────────────────────────────
/**
 * Role labels are OURS, from the cookie's name (vendor documentation for the bot-manager names, the prior Walmart
 * isolation for walmart.com's). They are descriptive; nothing in the measurement depends on them except that the
 * `bot-manager` class is never transferred between browsers (METHOD.md §2.5).
 */
const NAMED_ROLES = {
  experiment: ['xpa', 'xpm', 'xptc', 'xpth', 'xptwg', 'xptwj', 'exp-ck'],
  'visitor-id': ['vtc', 'svtc', 'ACID', 'hasACID', 'AID', 'bstc', 'sbstc', '_m', 'if_id', 'io_id'],
  location: ['assortmentStoreId', 'isoLoc', 'hasLocData', 'locGuestData', 'locDataV3', '_shcc', '_intlbu'],
  'session-app': ['userAppVersion', 'com.wm.reflector', 'abqme', '_astc', '_xrps', 'doorwayId', 'adblocked', 'auth'],
  'traffic-class': ['ipSessionTrafficType'],
};
const PATTERN_ROLES = [
  ['bot-manager', /^(_px|px[a-z0-9]|pxcts|_abck|bm_|ak_bmsc|akavpau|TS[0-9a-f]{6,}|__cf_bm|cf_clearance|__cflb|datadome|incap_ses|visid_incap|nlbi_|reese84|___utmvc|kpsdk|KP_UIDz|x-kpsdk|_dd_s)/i],
  ['experiment', /^(xp[a-z]*$|exp[-_]|ab[-_]|abtest|_vwo|optimizely|mbox|_gaexp|variant|bucket|experiment)/i],
  ['consent', /^(OptanonConsent|OptanonAlertBoxClosed|euconsent|_sp_|consent|cookieconsent|usprivacy|gpp|CookieConsent)/i],
  ['analytics-ads', /^(_ga|_gid|_gcl|_fbp|_fbc|_uet|_scid|_tt|_pin|__qca|_cs_|QuantumMetric|s_[a-z]|AMCV_|AMCVS_|_clck|_clsk|_hj|mp_|ajs_|amplitude|_rdt|_tq|IDE$|test_cookie|_dc_gtm|_gat)/i],
  ['location', /^(loc|geo|zip|country|currency|lang|locale|region)/i],
  ['session-app', /^(sess|sid$|JSESSIONID|csrf|xsrf|XSRF)/i],
  ['visitor-id', /^(vid$|visitor|uuid|guid|deviceid|device_id)/i],
];
export function cookieRole(name) {
  for (const [role, names] of Object.entries(NAMED_ROLES)) if (names.includes(name)) return role;
  for (const [role, re] of PATTERN_ROLES) if (re.test(name)) return role;
  return 'other';
}
export const isBotManager = (name) => cookieRole(name) === 'bot-manager';
export const ROLE_ORDER = ['experiment', 'visitor-id', 'location', 'session-app', 'traffic-class', 'consent', 'analytics-ads', 'other', 'bot-manager'];

const expiryBucket = (c) => {
  if (c.session || !(c.expires > 0)) return 'session';
  const d = (c.expires * 1000 - Date.now()) / 864e5;
  return d < 1 ? '<1d' : d < 7 ? '1-7d' : d < 31 ? '7-31d' : d < 366 ? '31-366d' : '>1y';
};
/** What may be written about a cookie: no value, no hash of a value. */
export function describeCookies(jar) {
  return jar.map((c) => ({ name: c.name, role: cookieRole(c.name), domain: c.domain, httpOnly: !!c.httpOnly, secure: !!c.secure, sameSite: c.sameSite || null, expiry: expiryBucket(c) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
/** Cookies of the browser's default context whose domain is `host` or a parent domain of it. */
export async function siteJar(browser, host) {
  const all = await browser.cookies();
  const h = host.replace(/^www\./, '');
  return all.filter((c) => { const d = c.domain.replace(/^\./, ''); return d === host || d === h || host.endsWith(`.${d}`) || d.endsWith(`.${h}`); });
}
export function pickJar(jar, names) { const s = new Set(names); return jar.filter((c) => s.has(c.name)); }
export async function setJar(browser, jar) {
  if (!jar.length) return;
  await browser.setCookie(...jar.map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path || '/', httpOnly: !!c.httpOnly, secure: !!c.secure, ...(c.sameSite ? { sameSite: c.sameSite } : {}), ...(c.session || !(c.expires > 0) ? {} : { expires: c.expires }) })));
}
/** localStorage for the swap condition: read from a live page; restored before the page's own scripts run. */
export async function dumpLocalStorage(page) {
  return page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o.push([k, localStorage.getItem(k)]); } return o; }).catch(() => []);
}
export async function restoreLocalStorageOnLoad(page, origin, items) {
  const keep = items.filter(([k]) => !isBotManager(k));
  await page.evaluateOnNewDocument((o, kv) => { if (location.origin === o) for (const [k, v] of kv) { try { localStorage.setItem(k, v); } catch { /* quota */ } } }, origin, keep);
  return keep.map(([k]) => k);
}

// ── the battery gate ────────────────────────────────────────────────────────────────────────────────────
/**
 * `pmset -g batt` before every load batch: on battery below 40 % the run pauses (polling) until on AC or ≥ 40 %.
 * J_PMSET_FAKE="Battery Power;35|AC Power;35" replays fake readings in order (self-test of the gate).
 */
let fakeIdx = 0;
export function readPower() {
  const fake = process.env.J_PMSET_FAKE;
  if (fake) {
    const seq = fake.split('|');
    const [source, pct] = seq[Math.min(fakeIdx++, seq.length - 1)].split(';');
    return { source, pct: Number(pct), fake: true };
  }
  try {
    const out = execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' });
    return { source: (/drawing from '([^']+)'/.exec(out) || [])[1] || 'unknown', pct: Number((/(\d+)%/.exec(out) || [])[1] ?? NaN) };
  } catch { return { source: 'unknown', pct: NaN }; }
}
export async function powerGate({ minPct = 40, pollMs = Number(process.env.J_POWER_POLL_MS || 300000), log = console.error, onPause = () => {} } = {}) {
  let paused = 0;
  for (;;) {
    const p = readPower();
    if (!/battery/i.test(p.source) || !(p.pct < minPct)) return { ...p, pausedMs: paused };
    log(`  on battery at ${p.pct}% (< ${minPct}%): pausing`);
    onPause(p);
    await sleep(pollMs); paused += pollMs;
  }
}

// ── the recorder: what reaches the repo ─────────────────────────────────────────────────────────────────
// "Chrome/149.0.0.0" (a letter, then "/") is a version, not an address; "//203.0.113.7" and "IP: 203.0.113.7" are.
const IPV4 = /(?<![\w.-])(?<![A-Za-z]\/)(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w.])/g;
const IPV6 = /(?<![\w:])(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}(?![\w:])|(?<![\w:])(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?(?![\w:])/gi;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const PATHS = () => [os.homedir(), os.tmpdir(), fs.realpathSync(os.tmpdir()), '/private/var/folders', '/var/folders', '/Users/', '/home/'].filter(Boolean);
export function scrubText(s, counts = {}) {
  const bump = (k) => (counts[k] = (counts[k] || 0) + 1);
  let out = String(s);
  out = out.replace(IPV4, () => (bump('ip'), '[ip]'));
  out = out.replace(IPV6, (m) => (/[a-f]/i.test(m) || m.includes('::') ? (bump('ip'), '[ip]') : m));
  out = out.replace(EMAIL, () => (bump('email'), '[email]'));
  // wall reference ids (Akamai "Reference #18.<hex>.<time>.<hex>", HUMAN "Reference ID: …") can encode an address
  out = out.replace(/(Reference\s*(?:#|ID:?)\s*)[\w.-]{6,}/gi, (_, p) => (bump('referenceId'), `${p}[ref]`));
  for (const p of PATHS()) { if (p.length > 4) { const parts = out.split(p); if (parts.length > 1) { counts.path = (counts.path || 0) + parts.length - 1; out = parts.join('[path]/'); } } }
  return out;
}
export class Recorder {
  constructor(outPath, meta) {
    this.outPath = outPath;
    this.data = { meta: { ...meta, writtenBy: path.basename(process.argv[1] || ''), redactions: null }, events: [], records: [] };
    this.secrets = new Set();
  }
  /** Continue a raw file written by an earlier process (J1.3 runs as a series of ticks over three days). */
  static resume(outPath, meta) {
    const r = new Recorder(outPath, meta);
    if (fs.existsSync(outPath)) { const d = JSON.parse(fs.readFileSync(outPath, 'utf8')); r.data = { ...d, meta: { ...d.meta, ...meta, redactions: d.meta.redactions } }; }
    return r;
  }
  /** Register cookie values (and storage values) seen in memory: none of them may appear in the output. */
  secretJar(jar) { for (const c of jar || []) this.secret(c.value); }
  secret(v) {
    if (typeof v !== 'string' || v.length < 8) return;
    this.secrets.add(v);
    try { const d = decodeURIComponent(v); if (d !== v && d.length >= 8) this.secrets.add(d); } catch { /* not encoded */ }
  }
  event(e) { this.data.events.push({ at: new Date().toISOString(), ...e }); this.save(); }
  add(r) { this.data.records.push(r); this.save(); return r; }
  serialize() {
    const counts = {};
    let s = JSON.stringify(this.data, null, 1);
    for (const v of [...this.secrets].sort((a, b) => b.length - a.length)) {
      for (const form of new Set([v, JSON.stringify(v).slice(1, -1)])) {
        const parts = s.split(form);
        if (parts.length > 1) { counts.cookieValue = (counts.cookieValue || 0) + parts.length - 1; s = parts.join('[cookie-value]'); }
      }
    }
    s = scrubText(s, counts);
    const obj = JSON.parse(s);
    const prev = this.data.meta.redactions || {};
    obj.meta.redactions = Object.fromEntries([...new Set([...Object.keys(prev), ...Object.keys(counts)])].map((k) => [k, Math.max(prev[k] || 0, counts[k] || 0)]));
    s = JSON.stringify(obj, null, 1);
    for (const v of this.secrets) if (s.includes(v)) throw new Error('recorder: a cookie value survived redaction');
    for (const p of PATHS()) if (p.length > 4 && s.includes(p)) throw new Error('recorder: a local path survived redaction');
    return s;
  }
  save() {
    fs.mkdirSync(path.dirname(this.outPath), { recursive: true });
    const tmp = `${this.outPath}.tmp`;
    fs.writeFileSync(tmp, this.serialize());
    fs.renameSync(tmp, this.outPath);
  }
}

// ── a lock so two J probes never load live sites at once (METHOD.md §2.4) ───────────────────────────────
export const PRIVATE_DIR = path.join(os.homedir(), '.cache', 'nullecho-cookie-pricing');
export async function liveLock(ctx, label, { maxWaitMs = 3 * 3600e3 } = {}) {
  if (!ctx.live) return () => {};
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  const f = path.join(PRIVATE_DIR, 'live.lock');
  const t0 = Date.now();
  for (;;) {
    try {
      fs.writeFileSync(f, JSON.stringify({ pid: process.pid, label, at: new Date().toISOString() }), { flag: 'wx' });
      break;
    } catch {
      let stale = false;
      try { const { pid } = JSON.parse(fs.readFileSync(f, 'utf8')); process.kill(pid, 0); } catch { stale = true; }
      if (stale) { fs.rmSync(f, { force: true }); continue; }
      if (Date.now() - t0 > maxWaitMs) throw new Error('live lock: waited too long');
      await sleep(30000);
    }
  }
  const release = () => { try { if (JSON.parse(fs.readFileSync(f, 'utf8')).pid === process.pid) fs.rmSync(f, { force: true }); } catch { /* gone */ } };
  process.on('exit', release);
  return release;
}

/** The facts about a run that let a reader reproduce it — nothing about the machine or the person. */
export function runMeta(ctx, extra = {}) {
  let head = null;
  try { head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
  let pv = null;
  try { pv = ctx.puppeteer.__jVersion ?? null; } catch { /* unknown */ }
  return {
    gitHead: head, method: 'research/cookie-pricing-2026-10/METHOD.md', startedAt: new Date().toISOString(), node: process.version, puppeteer: pv,
    chrome: ctx.chrome, headless: ctx.headless, live: ctx.live, launchFlags: LAUNCH_FLAGS, ignoreDefaultArgs: IGNORE_DEFAULT_ARGS, extensionLoaded: false,
    ...extra,
  };
}

/** Uniform pause in [min, max] ms from a seeded generator, so a run's spacing is reproducible. */
export const gapMs = (rand, min, max) => Math.round(min + rand() * Math.max(0, max - min));
export const shortId = (s, n = 12) => (typeof s === 'string' ? s.slice(0, n) : s ?? null);
export const today = () => new Date().toISOString().slice(0, 10);
