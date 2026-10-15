/**
 * D55 (2026-10-14) — "requests blocked" in a STORE-INSTALLED Chrome / Edge build.
 *
 * Until 0.9.2 every blocked request reached the counters through `onRuleMatchedDebug`, which Chrome
 * and Edge give to UNPACKED builds only. In a store install that event does not exist, so the popup's
 * headline (`stat-blocked` = `stats.blocked`) said "0 requests blocked" for every user, and the
 * per-site report, the cross-site map and the options totals were empty.
 *
 * This file is the packed case: the stub below has NO `onRuleMatchedDebug`. What it has is what a
 * packed Chrome 149 was measured to have on 2026-10-14 (chrome-count probe, D55):
 *   · `getMatchedRules({tabId})` on a page with four tracker scripts and five images: 11 matches —
 *     analytics#2000, social#3000, ads#1000, analytics#2004, and gpc#5000 ×7 (the Sec-GPC header);
 *     call 21 in ten minutes rejects "This request exceeds the MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL quota."
 *   · `webRequest.onErrorOccurred` for each of the four scripts, `error: "net::ERR_BLOCKED_BY_CLIENT"`.
 * Run against the 0.9.2-before-D55 background/popup: the headline and lifetime tests fail.
 *
 * Also here, because it needs the same stubbed worker: the options page's "Clear saved price
 * notices" (PRICING_MSG.COUNT / FORGET).
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MSG, PRICING_MSG, PRICING_STORAGE_KEY } from './protocol.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');

// ── a PACKED Chrome: no onRuleMatchedDebug ─────────────────────────────────

const store = {
  [PRICING_STORAGE_KEY]: [
    { siteKey: 'shop.example', url: 'https://shop.example/p/1', timestamp: 1, level: 'ny-disclosure', price: '9.99', currency: 'USD', context: 'x' },
    { siteKey: 'shop.example', url: 'https://shop.example/p/2', timestamp: 2, level: 'ny-disclosure', price: '19.99', currency: 'USD', context: 'y' },
    { siteKey: 'other.example', url: 'https://other.example/p', timestamp: 3, level: 'ct-style-language', price: '5', currency: 'USD', context: 'z' },
  ],
};
const session = {};
const onMessage = [];
const errorListeners = [];
const sendHeadersListeners = [];
let enabledRulesets = ['ads', 'analytics', 'social', 'fingerprinting', 'gpc'];
let dynamicRules = [];
let matched = [];          // what getMatchedRules answers
let quotaSpent = false;
const noopEvent = () => ({ addListener() {} });

globalThis.chrome = {
  runtime: {
    id: 'test',
    getURL: (p) => `file://${path.join(EXT, p)}`,
    onMessage: { addListener: (fn) => onMessage.push(fn) },
    onInstalled: noopEvent(),
    onStartup: noopEvent(),
  },
  storage: {
    local: {
      async get(keys) { const out = {}; for (const k of [].concat(keys)) if (k in store) out[k] = structuredClone(store[k]); return out; },
      async set(obj) { Object.assign(store, structuredClone(obj)); },
    },
    session: {
      async get(keys) { const out = {}; for (const k of [].concat(keys)) if (k in session) out[k] = structuredClone(session[k]); return out; },
      async set(obj) { Object.assign(session, structuredClone(obj)); },
    },
  },
  alarms: { onAlarm: noopEvent(), async create() {}, async clear() {} },
  tabs: { onRemoved: noopEvent() },
  webRequest: {
    onBeforeSendHeaders: noopEvent(),
    onHeadersReceived: noopEvent(),
    onErrorOccurred: { addListener: (fn) => errorListeners.push(fn) },
    onSendHeaders: { addListener: (fn) => sendHeadersListeners.push(fn) },
  },
  declarativeNetRequest: {
    async getDynamicRules() { return structuredClone(dynamicRules); },
    async updateDynamicRules() {},
    async getEnabledRulesets() { return [...enabledRulesets]; },
    async updateEnabledRulesets() {},
    async updateStaticRules() {},
    async getDisabledRuleIds() { return []; },
    async getMatchedRules() {
      if (quotaSpent) throw new Error('This request exceeds the MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL quota.');
      return { rulesMatchedInfo: matched.map((rule) => ({ rule, tabId: 7, timeStamp: Date.now() })) };
    },
    // NO onRuleMatchedDebug — that is what "packed" means.
  },
};
globalThis.fetch = async (url) => {
  const file = String(url).replace(/^file:\/\//, '');
  return { async json() { return JSON.parse(fs.readFileSync(file, 'utf8')); } };
};

await import('./background.js');

function send(message, sender = {}) {
  return new Promise((resolve, reject) => {
    for (const fn of onMessage) if (fn(message, sender, resolve) === true) return;
    reject(new Error(`nothing handled ${message?.type}`));
  });
}
const settle = () => new Promise((r) => setTimeout(r, 30));
async function browserBlocked(url, { initiator = 'https://news.example', tabId = 7, error = 'net::ERR_BLOCKED_BY_CLIENT', type = 'script' } = {}) {
  for (const fn of errorListeners) fn({ url, initiator, tabId, error, type, requestId: String(Math.random()) });
  await settle();
}

// The four tracker scripts of the measured page, and the 11 matches getMatchedRules reported for it.
const TRACKERS = [
  'https://www.google-analytics.com/analytics.js',
  'https://connect.facebook.net/en_US/fbevents.js',
  'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
  'https://cdn.amplitude.com/libs/amplitude-8.21.9-min.gz.js',
];
const MEASURED_MATCHES = [
  ...Array.from({ length: 7 }, () => ({ ruleId: 5000, rulesetId: 'gpc' })),
  { ruleId: 2000, rulesetId: 'analytics' }, { ruleId: 3000, rulesetId: 'social' },
  { ruleId: 1000, rulesetId: 'ads' }, { ruleId: 2004, rulesetId: 'analytics' },
];

// The popup's headline, lifted from popup.js (no DOM rig for the popup).
const POPUP = fs.readFileSync(path.join(EXT, 'popup', 'popup.js'), 'utf8');
function lift(name) {
  const start = POPUP.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `popup.js has no ${name}() — the headline is not built from the page count`);
  const next = POPUP.indexOf('\nfunction ', start + 10);
  return POPUP.slice(start, next < 0 ? undefined : next);
}

const report = (tabId = 7) => send({ type: MSG.GET_SITE_REPORT, url: 'https://news.example/a', tabId });

test('PACKED: the popup headline is the page count the browser reports — 4, not 0, and not 11', async () => {
  matched = MEASURED_MATCHES;
  const r = await report();
  assert.equal(r.live.source, 'getMatchedRules');
  assert.equal(r.live.total, 4, 'the seven Sec-GPC header matches are not blocks');
  assert.deepEqual(r.live.byCategory, { analytics: 2, social: 1, ads: 1 });
  const blockedHeadline = new Function(`${lift('blockedHeadline')}\nreturn blockedHeadline;`)();
  const head = blockedHeadline(r);
  assert.equal(head.value, 4);
  assert.equal(head.label, 'blocked on this page');
  assert.equal(blockedHeadline({ stats: { blocked: 99 } }).value, null, 'no page count → a dash, never the lifetime number under a page label');
});

test('PACKED: the lifetime per-site counter fills from the browser\'s own block reports, attributed to Nullecho\'s rules', async () => {
  for (const u of TRACKERS) await browserBlocked(u);
  // Not ours, not blocks, or not on a site Nullecho is on: none of these may count.
  await browserBlocked('https://cdn.example-widgets.com/w.js');                       // another extension's block
  await browserBlocked('https://www.google-analytics.com/collect', { error: 'net::ERR_CONNECTION_REFUSED' });
  await browserBlocked('https://www.google-analytics.com/collect', { error: 'NS_BINDING_ABORTED' });
  await browserBlocked('https://www.google-analytics.com/collect', { tabId: -1 });     // not from a tab
  const r = await report();
  assert.equal(r.stats.blocked, 4);
  assert.deepEqual(r.stats.byCategory, { analytics: 2, social: 1, ads: 1 });
  assert.deepEqual(r.stats.trackers.map((t) => t.domain).sort(), ['amplitude.com', 'doubleclick.net', 'facebook.net', 'google-analytics.com']);
  assert.equal(r.lifetimeSource, 'webRequest');
  const o = await send({ type: MSG.GET_OVERVIEW });
  assert.equal(o.totals.blocked, 4);
  assert.equal(o.lifetimeSource, 'webRequest');
});

test('PACKED: when the getMatchedRules quota is spent (measured: call 21 in 10 min), the page count is Nullecho\'s own tally', async () => {
  quotaSpent = true;
  const r = await report();
  assert.equal(r.live.source, 'webRequest');
  assert.equal(r.live.error, 'quota');
  assert.equal(r.live.total, 4);
  quotaSpent = false;
});

test('PACKED: a new top-level document in the tab starts the tally again; other tabs keep theirs', async () => {
  await browserBlocked(TRACKERS[0], { tabId: 9 });
  for (const fn of sendHeadersListeners) fn({ tabId: 7, type: 'main_frame', url: 'https://news.example/b' });
  await settle();
  quotaSpent = true;
  assert.equal((await report(7)).live.total, 0);
  assert.equal((await report(9)).live.total, 1);
  quotaSpent = false;
});

test('PACKED: a site the user switched Nullecho off for gets no count, even if another blocker cancelled a request there', async () => {
  await send({ type: MSG.SET_SITE_ENABLED, url: 'https://off.example/', enabled: false });
  await browserBlocked(TRACKERS[0], { initiator: 'https://off.example', tabId: 11 });
  quotaSpent = true;
  assert.equal((await report(11)).live.total, 0);
  quotaSpent = false;
  const o = await send({ type: MSG.GET_OVERVIEW });
  assert.equal(o.sites.find((s) => s.site === 'off.example')?.blocked ?? 0, 0);
});

test('PACKED: a learned block counts as "heuristic", and not from the company\'s own sites it spares (D52)', async () => {
  dynamicRules = [{ id: 1_000_001, priority: 1, action: { type: 'block' },
    condition: { requestDomains: ['tracker.example'], domainType: 'thirdParty', excludedInitiatorDomains: ['tracker-cdn.example'] } }];
  // The worker re-reads dynamic rules on a miss at most once a second.
  await new Promise((r) => setTimeout(r, 1100));
  await browserBlocked('https://px.tracker.example/p.gif', { initiator: 'https://blog.example', tabId: 12, type: 'image' });
  await browserBlocked('https://px.tracker.example/p.gif', { initiator: 'https://tracker-cdn.example', tabId: 12, type: 'image' });
  quotaSpent = true;
  const r = await send({ type: MSG.GET_SITE_REPORT, url: 'https://blog.example/', tabId: 12 });
  quotaSpent = false;
  assert.equal(r.live.total, 1);
  assert.deepEqual(r.live.byCategory, { heuristic: 1 });
});

test('PACKED: a category the user turned off is not credited for a block (the matcher follows the enabled rulesets)', async () => {
  enabledRulesets = ['analytics', 'social', 'fingerprinting', 'gpc'];
  await send({ type: MSG.SET_SETTINGS, patch: { categories: { ads: false } } });
  await browserBlocked('https://securepubads.g.doubleclick.net/tag/js/gpt.js', { initiator: 'https://cats.example', tabId: 13 });
  quotaSpent = true;
  assert.equal((await send({ type: MSG.GET_SITE_REPORT, url: 'https://cats.example/', tabId: 13 })).live.total, 0);
  quotaSpent = false;
  enabledRulesets = ['ads', 'analytics', 'social', 'fingerprinting', 'gpc'];
  await send({ type: MSG.SET_SETTINGS, patch: { categories: { ads: true } } });
});

test('PACKED: the tally lives in storage.session (memory only), so a suspended worker does not restart it at zero', async () => {
  await new Promise((r) => setTimeout(r, 700));
  assert.ok(session['nullecho:tab-blocked'], 'tab tally was written to storage.session');
  assert.equal(session['nullecho:tab-blocked']['9'].total, 1);
  assert.equal(Object.keys(store).includes('nullecho:tab-blocked'), false, 'never written to storage.local');
});

// ── Clear saved price notices (options page) ───────────────────────────────

test('price notices: COUNT reports what is stored; FORGET deletes it; COUNT reads 0 after', async () => {
  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }), { ok: true, count: 3 });
  await send({ type: PRICING_MSG.FORGET, site: 'other.example' });
  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }), { ok: true, count: 2 }, 'one site only');
  await send({ type: PRICING_MSG.FORGET });
  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }), { ok: true, count: 0 });
  assert.deepEqual(store[PRICING_STORAGE_KEY], []);
});

test('price notices: the options button reads the count before and after through the worker, and shows both', async () => {
  const OPTIONS = fs.readFileSync(path.join(EXT, 'options', 'options.js'), 'utf8');
  const HTML = fs.readFileSync(path.join(EXT, 'options', 'options.html'), 'utf8');
  assert.match(HTML, /<button class="btn" id="clear-pricing" type="button">Clear saved price notices<\/button>/);
  assert.match(HTML, /id="pricing-count"/);
  const start = OPTIONS.indexOf('async function clearPricingNotices(');
  assert.ok(start >= 0, 'options.js has no clearPricingNotices()');
  const src = OPTIONS.slice(start, OPTIONS.indexOf('\n}\n', start) + 2);
  const clear = new Function('PRICING_MSG', `${src}\nreturn clearPricingNotices;`)(PRICING_MSG);

  // Against the real (stubbed) worker: seed two, clear, read back.
  store[PRICING_STORAGE_KEY] = [{ siteKey: 'a.example', url: 'https://a.example/', timestamp: 1, level: 'ny-disclosure', price: '1', currency: 'USD', context: '' },
    { siteKey: 'b.example', url: 'https://b.example/', timestamp: 2, level: 'ny-disclosure', price: '2', currency: 'USD', context: '' }];
  const sent = [];
  const res = await clear((m) => { sent.push(m.type); return send(m); });
  assert.deepEqual(res, { before: 2, after: 0 });
  assert.deepEqual(sent, [PRICING_MSG.COUNT, PRICING_MSG.FORGET, PRICING_MSG.COUNT]);
  // Outside the extension the worker does not answer: nothing is claimed.
  assert.deepEqual(await clear(async () => ({ ok: false })), { before: null, after: null });
  assert.match(OPTIONS, /\$\('clear-pricing'\)\.addEventListener\('click'/);
});

// ── D54: the popup and the options page say the RFP sentence when the shim reported it ──

test('D54: after a page reports resist-fingerprinting, the overview says so; a later healthy page clears it', async () => {
  const { RFP_ON, RFP_REASON } = await import('./browser-kind.js');
  assert.equal(RFP_ON, "Firefox's resistFingerprinting is on, so Nullecho leaves your device profile to Firefox.");
  await send({ type: MSG.SHIM_STATUS, upgraded: false, lockedToFallback: false, reason: RFP_REASON }, { url: 'https://rfp.example/', frameId: 0 });
  assert.equal((await send({ type: MSG.GET_OVERVIEW })).resistFingerprinting, true);
  const site = await send({ type: MSG.GET_SITE_REPORT, url: 'https://rfp.example/' });
  assert.equal(site.stats.lastShimStatus.reason, RFP_REASON, 'the popup reads the same status');
  await new Promise((r) => setTimeout(r, 5));
  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null }, { url: 'https://later.example/', frameId: 0 });
  assert.equal((await send({ type: MSG.GET_OVERVIEW })).resistFingerprinting, false);
});

test('D54: the popup shows the sentence as an alert and in place of the profile rows; options shows it as a banner', () => {
  assert.match(POPUP, /function rfpOn\(s\) \{\n  return s\?\.stats\?\.lastShimStatus\?\.reason === RFP_REASON;/);
  assert.match(POPUP, /if \(enabled && rfpOn\(s\)\) add\(\[b\(RFP_ON\)/);
  assert.match(POPUP, /if \(p && rfpOn\(s\)\) \{[\s\S]*?note\.textContent = RFP_ON;/);
  const opt = fs.readFileSync(path.join(EXT, 'options', 'options.js'), 'utf8');
  assert.match(opt, /\$\('rfp-banner'\)\.hidden = !s\.resistFingerprinting;/);
  assert.match(opt, /\$\{RFP_ON\}/);
  assert.match(fs.readFileSync(path.join(EXT, 'options', 'options.html'), 'utf8'), /<section class="card accent" id="rfp-banner" hidden>/);
});
