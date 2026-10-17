/**
 * D59 (2026-10-17) — on a site fronted by a bot manager measured to reject the persona shim, the
 * device layer stands down for that site; tracker blocking and GPC stay on.
 *
 * Measured first (research/bot-manager-2026-10/): tesla.com under Akamai Bot Manager answers the
 * request after its sensor page with 403 "Access Denied" when the shim is in the page and 200 when it
 * is not; the next load after a denial is 403 on its FIRST document. So the decision must be in place
 * before the sensor runs, from the first document's own Set-Cookie — which reaches the worker ahead of
 * the loader's GET_PERSONA (measured: 12-14 ms ahead warm; first, in the same millisecond, cold).
 *
 * Four layers, each tested here against its real implementation:
 *   1. bot-manager.js — which responses count (first-party, top frame only) and which cookies;
 *   2. background.js  — the flag, its persistence, GET_PERSONA's `fpStandDown`, the override, the
 *                       race fallback's single reload, and what does NOT change (blocking, GPC);
 *   3. shim.js        — the stand-down restores the realm exactly as the allowlist does;
 *   4. shim + gpc.js  — the GPC signal survives the shim handing its getter back.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { MSG, FP_STAND_DOWN, BOT_MANAGER_STORAGE_KEY, ALLOW_RULE_ID_BASE } from './protocol.js';
import {
  BOT_MANAGERS, topLevelHit, setCookieNames, vendorFor, lateFlagReload, prune, LATE_RELOAD_WINDOW_MS,
} from './bot-manager.js';
import { bootRealm, RIG_TOKENS } from './test-realm-rig.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');

/** tesla.com's first document, as webRequest reported it on 2026-10-17 (names; values invented). */
const TESLA_FIRST_DOC = [
  { name: 'Content-Type', value: 'text/html' },
  { name: 'Cache-Control', value: 'no-store' },
  { name: 'Set-Cookie', value: '_abck=0000~-1~YAAQ~-1~-1; Domain=.tesla.com; Path=/; Secure' },
  { name: 'Set-Cookie', value: 'bm_s=YAAQ; Domain=.tesla.com; Path=/; Secure' },
  { name: 'Set-Cookie', value: 'bm_sc=4~1~0; Domain=.tesla.com; Path=/; Secure' },
  { name: 'Set-Cookie', value: 'bm_so=AAAA; Domain=.tesla.com; Path=/; Secure' },
  { name: 'Set-Cookie', value: 'bm_sz=AAAA~1~2; Domain=.tesla.com; Path=/; Max-Age=14400' },
];
const doc = (over = {}) => ({ tabId: 7, frameId: 0, type: 'main_frame', url: 'https://www.tesla.com/', responseHeaders: TESLA_FIRST_DOC, timeStamp: Date.now(), ...over });

// ═══════════════════════════════════════════════════════════════════════════
// 1. bot-manager.js — which responses count
// ═══════════════════════════════════════════════════════════════════════════

test('D59: tesla.com\'s first document is a hit — Akamai, on the sensor\'s own cookie', () => {
  const hit = topLevelHit(doc());
  assert.deepEqual(hit, { site: 'tesla.com', vendor: 'akamai', label: 'Akamai Bot Manager', cookie: '_abck' });
  assert.deepEqual(setCookieNames(TESLA_FIRST_DOC), ['_abck', 'bm_s', 'bm_sc', 'bm_so', 'bm_sz']);
});

test('D59 ATTACK: a CNAME-cloaked tracker on the site\'s own domain cannot flag it — only a top-level document counts', () => {
  // metrics.news.example → a tracking vendor: first-party by registrable domain, requested by the top
  // document. If its Set-Cookie counted, one header from the vendor would take the device profile off
  // every site it serves. The site's own sensor POST is the same shape and is not needed (every Akamai
  // site measured set the cookies on a top-level document).
  for (const type of ['xmlhttprequest', 'script', 'image', 'ping', 'other']) {
    assert.equal(topLevelHit({ tabId: 7, frameId: 0, type, url: 'https://metrics.news.example/b/ss', initiator: 'https://www.news.example',
      responseHeaders: [{ name: 'Set-Cookie', value: '_abck=x~0~y; Path=/; Domain=.news.example' }] }), null, type);
  }
  assert.equal(topLevelHit(doc({ type: 'xmlhttprequest', url: 'https://www.tesla.com/0COgbP/eoH__/x', initiator: 'https://www.tesla.com',
    responseHeaders: [{ name: 'Set-Cookie', value: '_abck=1~0~2; Path=/' }] })), null);
  // Firefox may fold Set-Cookie lines into one header; a top-level document is read either way.
  const ff = topLevelHit({ tabId: 3, frameId: 0, type: 'main_frame', url: 'https://www.tesla.com/',
    responseHeaders: [{ name: 'set-cookie', value: 'other=1; Path=/\nbm_sz=2; Path=/' }] });
  assert.equal(ff?.cookie, 'bm_sz');
});

test('D59 ATTACK: nothing from a sub-frame or a third-party host can flag a site', () => {
  const abck = [{ name: 'Set-Cookie', value: '_abck=evil~0~x; Path=/; SameSite=None; Secure' }];
  // A cross-site frame's own document, on a page at news.example.
  assert.equal(topLevelHit({ tabId: 7, frameId: 5, parentFrameId: 0, type: 'sub_frame', url: 'https://evil.example/frame', initiator: 'https://news.example', responseHeaders: abck }), null);
  // That frame's requests — to its own host, and to the TOP site's host.
  assert.equal(topLevelHit({ tabId: 7, frameId: 5, type: 'xmlhttprequest', url: 'https://evil.example/x', initiator: 'https://evil.example', responseHeaders: abck }), null);
  assert.equal(topLevelHit({ tabId: 7, frameId: 5, type: 'xmlhttprequest', url: 'https://news.example/x', initiator: 'https://evil.example', responseHeaders: abck }), null);
  // A third-party script the top document loads, answering with the cookie.
  assert.equal(topLevelHit({ tabId: 7, frameId: 0, type: 'script', url: 'https://cdn.evil.example/s.js', initiator: 'https://news.example', responseHeaders: abck }), null);
  // Not a tab: the extension, a service worker.
  assert.equal(topLevelHit({ ...doc(), tabId: -1 }), null);
  // Non-http schemes have no site.
  assert.equal(topLevelHit({ ...doc(), url: 'chrome-extension://abc/x' }), null);
});

test('D59: only cookies of a vendor MEASURED to break are triggers — Cloudflare, DataDome, PerimeterX and ak_bmsc are not', () => {
  for (const name of ['__cf_bm', 'cf_clearance', 'datadome', '_px3', '_pxhd', '_pxvid', 'incap_ses_123_456', 'visid_incap_1', 'reese84', 'KP_UIDz', 'ak_bmsc', 'bm_mi', 'bm_sv', 'bm_s']) {
    assert.equal(vendorFor([name]), null, `${name} must not stand the device layer down`);
  }
  assert.deepEqual(BOT_MANAGERS.map((b) => b.vendor), ['akamai'], 'a vendor was added: it needs a measurement in research/bot-manager-2026-10/ and a line in D59');
  // Chrome's view WITHOUT extraHeaders: no Set-Cookie at all, so no hit — which is why the spec carries it.
  assert.equal(topLevelHit(doc({ responseHeaders: TESLA_FIRST_DOC.filter((h) => h.name !== 'Set-Cookie') })), null);
});

test('D59: the late-flag reload fires only for a document that already took a profile, once', () => {
  const now = 1_000_000;
  const entry = { vendor: 'akamai', cookie: '_abck', at: now, override: false };
  const base = { entry, isNew: true, site: 'tesla.com', responseAt: now - 20, now };
  // The race lost: this document's handshake came AFTER its response and got the persona.
  assert.equal(lateFlagReload({ ...base, topDoc: { site: 'tesla.com', at: now - 5, active: true } }), true);
  // The handshake on record is the PREVIOUS page's: the new document's own handshake will see the flag.
  assert.equal(lateFlagReload({ ...base, topDoc: { site: 'tesla.com', at: now - 900, active: true } }), false);
  // Never: already stood down, another site, too old, overridden, already reloaded, not a new record.
  assert.equal(lateFlagReload({ ...base, topDoc: { site: 'tesla.com', at: now - 5, active: false } }), false);
  assert.equal(lateFlagReload({ ...base, topDoc: { site: 'other.example', at: now - 5, active: true } }), false);
  assert.equal(lateFlagReload({ ...base, responseAt: now - LATE_RELOAD_WINDOW_MS - 50, now, topDoc: { site: 'tesla.com', at: now - LATE_RELOAD_WINDOW_MS - 1, active: true } }), false);
  assert.equal(lateFlagReload({ ...base, entry: { ...entry, override: true }, topDoc: { site: 'tesla.com', at: now - 5, active: true } }), false);
  assert.equal(lateFlagReload({ ...base, entry: { ...entry, reloadedAt: now - 1 }, topDoc: { site: 'tesla.com', at: now - 5, active: true } }), false);
  assert.equal(lateFlagReload({ ...base, isNew: false, topDoc: { site: 'tesla.com', at: now - 5, active: true } }), false);
  assert.equal(lateFlagReload({ ...base, topDoc: undefined }), false);
});

test('D59: the table is bounded, and the user\'s overrides are the last thing to go', () => {
  const t = {};
  for (let i = 0; i < 510; i++) t[`s${i}.example`] = { vendor: 'akamai', cookie: '_abck', at: i, override: i === 0 };
  prune(t, 500);
  assert.equal(Object.keys(t).length, 500);
  assert.ok(t['s0.example'], 'the oldest entry is an override and survives');
  assert.equal(t['s1.example'], undefined);
  assert.ok(t['s509.example']);
  // A table full of overrides still keeps the entry being added.
  const full = {};
  for (let i = 0; i < 500; i++) full[`o${i}.example`] = { vendor: 'akamai', cookie: '_abck', at: i, override: true };
  full['new.example'] = { vendor: 'akamai', cookie: '_abck', at: 0, override: false };
  prune(full, 500, 'new.example');
  assert.ok(full['new.example'], 'the new flag was pruned the moment it was set');
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. background.js — the real worker, against stubbed extension APIs
// ═══════════════════════════════════════════════════════════════════════════

const store = {};
const onMessage = [];
const headersListeners = [];
const dynamicRuleCalls = [];
const reloads = [];
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
      async get(keys) {
        const out = {};
        for (const k of (Array.isArray(keys) ? keys : [keys])) if (k in store) out[k] = structuredClone(store[k]);
        return out;
      },
      async set(obj) { Object.assign(store, structuredClone(obj)); },
    },
  },
  alarms: { onAlarm: noopEvent(), async create() {}, async clear() {} },
  tabs: { onRemoved: noopEvent(), async reload(tabId) { reloads.push(tabId); } },
  webRequest: {
    OnHeadersReceivedOptions: { RESPONSE_HEADERS: 'responseHeaders', EXTRA_HEADERS: 'extraHeaders' },
    OnBeforeSendHeadersOptions: { REQUEST_HEADERS: 'requestHeaders', EXTRA_HEADERS: 'extraHeaders' },
    onBeforeSendHeaders: noopEvent(),
    onHeadersReceived: { addListener: (fn, filter, spec) => headersListeners.push({ fn, filter, spec }) },
    onSendHeaders: noopEvent(),
    onErrorOccurred: noopEvent(),
  },
  declarativeNetRequest: {
    async getDynamicRules() { return []; },
    async updateDynamicRules(arg) { dynamicRuleCalls.push(arg); },
    async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'gpc']; },
    async updateEnabledRulesets() {},
    async updateStaticRules() {},
    async getDisabledRuleIds() { return []; },
    async getMatchedRules() { return { rulesMatchedInfo: [] }; },
  },
};
globalThis.fetch = async (url) => {
  const file = String(url).replace(/^file:\/\//, '');
  return { async json() { return JSON.parse(fs.readFileSync(file, 'utf8')); } };
};

const BG = await import('./background.js');

function send(message, sender = {}) {
  return new Promise((resolve, reject) => {
    for (const fn of onMessage) if (fn(message, sender, resolve) === true) return;
    reject(new Error(`nothing handled ${message?.type}`));
  });
}
/** The browser delivering one response-headers event to every registered listener. */
const headers = (details) => Promise.all(headersListeners.map((l) => l.fn(details)));
const top = (url, tabId = 7) => ({ url, frameId: 0, tab: { id: tabId } });
const settle = () => new Promise((r) => setTimeout(r, 5));

test('D59: ONE onHeadersReceived listener (shared with the heuristics layer), with extraHeaders on Chrome', () => {
  assert.equal(headersListeners.length, 1, 'a second response listener was registered — the observer rides on the heuristics one');
  assert.deepEqual(headersListeners[0].spec, ['responseHeaders', 'extraHeaders'], 'Chrome hides Set-Cookie without extraHeaders: the flag would never be set');
});

test('D59: before any bot-manager cookie, tesla.com gets its device profile (the control)', async () => {
  const r = await send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/', 6));
  assert.equal(r.ok, true);
  assert.equal(r.fpStandDown, null);
  assert.ok(r.persona?.id, 'a persona is delivered on an unflagged site');
});

test('D59: the first document\'s Set-Cookie flags tesla.com BEFORE the handshake queued behind it is answered', async () => {
  // Same tick, in the order the browser delivers them (measured: response first).
  const work = headers(doc());
  const persona = send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/'));
  const [r] = await Promise.all([persona, work]);
  assert.equal(r.fpStandDown, FP_STAND_DOWN.BOT_MANAGER, 'the handshake answered before the flag landed');
  assert.equal(r.persona, null, 'a stood-down site is sent no persona at all');
  assert.equal(r.enabled, true, 'the site is NOT allowlisted: blocking stays on');
  assert.equal(r.gpc, true, 'GPC stays on');
  assert.deepEqual(Object.keys(store[BOT_MANAGER_STORAGE_KEY]), ['tesla.com'], 'persisted per site, like the allowlist');
  const e = store[BOT_MANAGER_STORAGE_KEY]['tesla.com'];
  assert.equal(e.vendor, 'akamai');
  assert.equal(e.cookie, '_abck');
  assert.equal(e.override, false);
  assert.ok(!JSON.stringify(store[BOT_MANAGER_STORAGE_KEY]).includes('YAAQ'), 'a cookie VALUE was stored');
  assert.deepEqual(reloads, [], 'the flag was in time — nothing to reload');
  // Same-site subframes and about:blank children of the page get the same answer; other sites do not.
  assert.equal((await send({ type: MSG.GET_PERSONA }, { url: 'https://shop.tesla.com/x', frameId: 3 })).fpStandDown, 'bot-manager');
  assert.equal((await send({ type: MSG.GET_PERSONA }, { url: 'about:blank', origin: 'https://www.tesla.com', frameId: 4 })).fpStandDown, 'bot-manager');
  const yt = await send({ type: MSG.GET_PERSONA }, { url: 'https://www.youtube.com/embed/x', frameId: 5 });
  assert.equal(yt.fpStandDown, null);
  assert.ok(yt.persona?.id, 'a cross-site frame on a stood-down page keeps ITS device profile');
});

test('D59: blocking stays on — no allow rule is written for a stood-down site, and the report says why', async () => {
  const allowRules = dynamicRuleCalls.flatMap((c) => c.addRules ?? []).filter((r) => r.id >= ALLOW_RULE_ID_BASE && r.id < ALLOW_RULE_ID_BASE + 1000);
  assert.deepEqual(allowRules, []);
  const rep = await send({ type: MSG.GET_SITE_REPORT, url: 'https://www.tesla.com/' });
  assert.equal(rep.enabled, true);
  assert.deepEqual({ ...rep.botManager, at: 0 }, { vendor: 'akamai', label: 'Akamai Bot Manager', cookie: '_abck', at: 0, override: false, standingDown: true });
  const ov = await send({ type: MSG.GET_OVERVIEW });
  assert.deepEqual(ov.botManagerSites.map((s) => [s.site, s.standingDown]), [['tesla.com', true]]);
});

test('D59 ATTACK: a cross-site frame\'s _abck never flips the top-level flag (nor flags itself)', async () => {
  const abck = [{ name: 'Set-Cookie', value: '_abck=evil~0~x; Path=/; SameSite=None; Secure' }];
  await headers({ tabId: 8, frameId: 6, parentFrameId: 0, type: 'sub_frame', url: 'https://evil.example/f', initiator: 'https://news.example', responseHeaders: abck, timeStamp: Date.now() });
  await headers({ tabId: 8, frameId: 6, type: 'xmlhttprequest', url: 'https://news.example/api', initiator: 'https://evil.example', responseHeaders: abck, timeStamp: Date.now() });
  await headers({ tabId: 8, frameId: 0, type: 'script', url: 'https://evil.example/s.js', initiator: 'https://news.example', responseHeaders: abck, timeStamp: Date.now() });
  await settle();
  const flagged = Object.keys(store[BOT_MANAGER_STORAGE_KEY] ?? {});
  assert.ok(!flagged.includes('news.example') && !flagged.includes('evil.example'), `flagged: ${flagged}`);
  const r = await send({ type: MSG.GET_PERSONA }, top('https://news.example/', 8));
  assert.equal(r.fpStandDown, null);
  assert.ok(r.persona?.id, 'the top-level site keeps its device profile');
});

test('D59: "Use my device profile here anyway" really brings the profile back — and can be undone', async () => {
  const on = await send({ type: MSG.SET_BOT_MANAGER_OVERRIDE, site: 'tesla.com', override: true });
  assert.equal(on.ok, true);
  assert.equal(on.standingDown, false);
  const r = await send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/'));
  assert.equal(r.fpStandDown, null);
  assert.ok(r.persona?.id, 'the override did not re-enable the device profile');
  assert.equal(store[BOT_MANAGER_STORAGE_KEY]['tesla.com'].override, true, 'the override is persisted');
  // A new Set-Cookie from the site does not quietly undo the user's decision.
  await headers(doc());
  await settle();
  assert.equal((await send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/'))).fpStandDown, null);
  const off = await send({ type: MSG.SET_BOT_MANAGER_OVERRIDE, site: 'tesla.com', override: false });
  assert.equal(off.standingDown, true);
  assert.equal((await send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/'))).fpStandDown, 'bot-manager');
  assert.equal((await send({ type: MSG.SET_BOT_MANAGER_OVERRIDE, site: 'never-flagged.example', override: true })).ok, false);
});

test('D59: the user\'s allowlist still wins — Nullecho fully off, no device-layer instruction', async () => {
  await send({ type: MSG.SET_SITE_ENABLED, url: 'https://www.tesla.com/', enabled: false });
  const r = await send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/'));
  assert.equal(r.enabled, false);
  assert.equal(r.fpStandDown, null);
  await send({ type: MSG.SET_SITE_ENABLED, url: 'https://www.tesla.com/', enabled: true });
});

test('D59 ATTACK: the race fallback reloads ONCE and can never loop', async () => {
  // A site whose handshake beat its own response (the order the platform does not promise).
  const t0 = Date.now();
  const p1 = await send({ type: MSG.GET_PERSONA }, top('https://www.racy.example/', 11));
  assert.ok(p1.persona?.id, 'the document took a profile');
  const racy = { tabId: 11, frameId: 0, type: 'main_frame', url: 'https://www.racy.example/', timeStamp: t0 - 3,
    responseHeaders: [{ name: 'Set-Cookie', value: 'bm_sz=1; Path=/' }] };
  await headers(racy);
  assert.deepEqual(reloads, [11], 'the lost race was not repaired');
  assert.ok(store[BOT_MANAGER_STORAGE_KEY]['racy.example'].reloadedAt, 'the reload is recorded with the flag');
  // The reloaded document stands down; its response sets the cookie again; more pages, more cookies.
  for (let i = 0; i < 5; i++) {
    const r = await send({ type: MSG.GET_PERSONA }, top('https://www.racy.example/', 11));
    assert.equal(r.fpStandDown, 'bot-manager');
    await headers({ ...racy, timeStamp: Date.now() - 1 });
    await headers({ ...racy, type: 'xmlhttprequest', url: 'https://www.racy.example/api', initiator: 'https://www.racy.example' });
  }
  assert.deepEqual(reloads, [11], 'a second reload happened — a loop');
  // Even if the user overrides and the site is flagged again from scratch, the record is not new.
  await send({ type: MSG.SET_BOT_MANAGER_OVERRIDE, site: 'racy.example', override: true });
  await send({ type: MSG.GET_PERSONA }, top('https://www.racy.example/', 11));
  await headers({ ...racy, timeStamp: Date.now() - 1 });
  assert.deepEqual(reloads, [11]);
  reloads.length = 0;
});

test('D59 ATTACK: a first-party SUB-RESOURCE cookie (a CNAME-cloaked tracker, or a sensor POST) flags nothing and reloads nothing', async () => {
  await send({ type: MSG.GET_PERSONA }, top('https://late.example/', 12));
  await headers({ tabId: 12, frameId: 0, type: 'xmlhttprequest', url: 'https://metrics.late.example/b/ss', initiator: 'https://late.example',
    timeStamp: Date.now(), responseHeaders: [{ name: 'Set-Cookie', value: '_abck=1~-1~2; Domain=.late.example' }] });
  await settle();
  assert.equal(store[BOT_MANAGER_STORAGE_KEY]['late.example'], undefined);
  assert.deepEqual(reloads, []);
  const r = await send({ type: MSG.GET_PERSONA }, top('https://late.example/', 12));
  assert.ok(r.persona?.id, 'the site keeps its device profile');
});

test('D59: the flag survives the worker — a fresh boot reads it back from storage', () => {
  // `init()` reads exactly this key; nothing else holds the flag.
  assert.ok(store[BOT_MANAGER_STORAGE_KEY]['tesla.com']);
  const src = fs.readFileSync(path.join(HERE, 'background.js'), 'utf8');
  assert.match(src, /storage\.local\.get\(\[[^\]]*BOT_MANAGER_STORAGE_KEY\]/);
});

test('D59 GUARD: removing the detection puts tesla.com back on the persona (the regression this exists for)', async () => {
  // The same first document, with the trigger cookies stripped — what the worker sees when the
  // observer is gone or blind (no extraHeaders): no flag, and the persona goes to the sensor.
  const blind = { ...doc({ url: 'https://www.tesla-blind.example/' }), responseHeaders: TESLA_FIRST_DOC.filter((h) => !/_abck|bm_sz/.test(h.value)) };
  await headers(blind);
  const r = await send({ type: MSG.GET_PERSONA }, top('https://www.tesla-blind.example/'));
  assert.equal(r.fpStandDown, null);
  assert.ok(r.persona?.id);
  assert.equal(typeof BG.onBotManagerHeaders, 'function');
});

test('D59: "Clear site history" empties the bot-manager list too — and the next response flags the site again', async () => {
  assert.ok(Object.keys(store[BOT_MANAGER_STORAGE_KEY]).length > 0);
  await send({ type: MSG.CLEAR_STATS });
  assert.deepEqual(store[BOT_MANAGER_STORAGE_KEY], {}, 'site names survived "Clear site history"');
  assert.deepEqual((await send({ type: MSG.GET_OVERVIEW })).botManagerSites, []);
  const work = headers(doc());
  const r = await send({ type: MSG.GET_PERSONA }, top('https://www.tesla.com/', 21));
  await work;
  assert.equal(r.fpStandDown, 'bot-manager', 'clearing history must not cost the next visit its stand-down');
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. shim.js — the stand-down hands the realm back exactly as the allowlist does
// ═══════════════════════════════════════════════════════════════════════════

const SNAP = `(() => {
  globalThis.__snap = () => {
    const out = new Map();
    for (const name of Object.getOwnPropertyNames(globalThis)) {
      if (name.startsWith('__')) continue;
      let v; try { v = globalThis[name]; } catch (_) { continue; }
      if (typeof v !== 'function' || !v.prototype || typeof v.prototype !== 'object') continue;
      for (const k of Reflect.ownKeys(v.prototype)) {
        const d = Object.getOwnPropertyDescriptor(v.prototype, k);
        out.set(name + '.prototype.' + String(k), [d.value, d.get, d.set]);
      }
    }
    return out;
  };
  globalThis.__before = __snap();
  globalThis.__diff = () => {
    const after = __snap();
    const changed = [];
    for (const [k, v] of after) { const b = __before.get(k); if (!b || b[0] !== v[0] || b[1] !== v[1] || b[2] !== v[2]) changed.push(k); }
    for (const k of __before.keys()) if (!after.has(k)) changed.push(k + ' (removed)');
    return changed.sort();
  };
})();`;

test('D59: the shim stands down on fpStandDown — every descriptor restored, the reason reported', () => {
  const r = bootRealm({ engine: SNAP });
  assert.ok(JSON.parse(r.page('JSON.stringify(__diff())')).length > 10, 'CONTROL: the shim patched the realm at document_start');
  r.send({ ok: true, enabled: true, gpc: true, site: 'tesla.com', fpStandDown: 'bot-manager', persona: null, nonce: r.boot.nonce, reportTokens: RIG_TOKENS });
  assert.deepEqual(JSON.parse(r.page('JSON.stringify(__diff())')), [], 'the realm is not the engine\'s after the stand-down');
  assert.ok(r.statuses.some((s) => s.reason === 'bot-manager'), 'the shim did not say why');
  assert.ok(!r.statuses.some((s) => s.upgraded === true));
});

test('D59 GUARD: the allowlist\'s stand-down leaves the same realm — one mechanism, two reasons', () => {
  const r = bootRealm({ engine: SNAP });
  r.send({ ok: true, enabled: false, gpc: true, site: 'tesla.com', persona: null, nonce: r.boot.nonce, reportTokens: RIG_TOKENS });
  assert.deepEqual(JSON.parse(r.page('JSON.stringify(__diff())')), []);
});

test('D59 ATTACK: a page cannot stand the shim down — no nonce, no fpStandDown', () => {
  const r = bootRealm({ engine: SNAP });
  const patched = JSON.parse(r.page('JSON.stringify(__diff())')).length;
  r.page(`document.dispatchEvent(new CustomEvent('nullecho:persona', { detail: JSON.stringify({ ok: true, enabled: true, fpStandDown: 'bot-manager' }) }))`);
  r.page(`Object.prototype.fpStandDown = 'bot-manager'`);
  r.upgrade();   // a genuine payload that OMITS the field…
  r.page('delete Object.prototype.fpStandDown');
  assert.equal(JSON.parse(r.page('JSON.stringify(__diff())')).length, patched, '…must not read it off the page\'s Object.prototype (D29)');
  assert.ok(!r.statuses.some((s) => s.reason === 'bot-manager'));
  assert.ok(r.statuses.some((s) => s.upgraded === true), 'the genuine payload was applied as a normal upgrade');
});

test('D59: any other fpStandDown value is not an instruction', () => {
  const r = bootRealm({ engine: SNAP });
  r.upgrade({ fpStandDown: 'Bot-Manager' });
  assert.ok(r.statuses.some((s) => s.upgraded === true), 'only the exact value stands the shim down');
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. loader + shim + gpc.js — the GPC signal survives the stand-down
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The real three-file stack in two realms sharing one DOM (handshake-integration.test.js's shape,
 * reduced): `answer` is the service worker's GET_PERSONA reply.
 */
async function stack(answer) {
  const registry = new Map();
  const listenersOf = (t) => { if (!registry.has(t)) registry.set(t, []); return registry.get(t); };
  const windows = [];
  class Ev {
    constructor(type, init) { this.type = type; this._detail = init && init.detail; this._stopped = false; }
    stopPropagation() { this._stopped = true; }
    stopImmediatePropagation() { this._stopped = true; }
  }
  Object.defineProperty(Ev.prototype, 'detail', { get() { return this._detail; }, configurable: true });
  const document = {};
  const dom = {
    addEventListener(type, fn, capture) { listenersOf(this).push({ type, fn, capture: !!capture }); },
    removeEventListener(type, fn, capture) {
      const l = listenersOf(this); const i = l.findIndex((x) => x.type === type && x.fn === fn && x.capture === !!capture);
      if (i >= 0) l.splice(i, 1);
    },
    dispatchEvent(ev) {
      for (const w of windows) {
        for (const l of listenersOf(w).slice()) if (l.type === ev.type && l.capture) l.fn.call(w, ev);
        if (ev._stopped) return true;
      }
      for (const l of listenersOf(document).slice()) if (l.type === ev.type) l.fn.call(document, ev);
      return true;
    },
  };
  Object.assign(document, dom, { createElement: () => ({}), readyState: 'loading', scripts: { length: 0 },
    documentElement: { getAttribute: () => null, setAttribute() {}, removeAttribute() {} } });
  class FakeEventTarget {}
  Object.assign(FakeEventTarget.prototype, dom);
  class Navigator {}
  Object.defineProperty(Navigator.prototype, 'hardwareConcurrency', { get() { return 64; }, configurable: true, enumerable: true });
  Object.defineProperty(Navigator.prototype, 'onLine', { get() { return true; }, configurable: true, enumerable: true });
  const base = () => ({
    document, CustomEvent: Ev, EventTarget: FakeEventTarget,
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    location: { hostname: 'www.tesla.com', origin: 'https://www.tesla.com' },
    setTimeout, clearTimeout, queueMicrotask, Promise, console: { log() {}, info() {}, warn() {}, error() {} },
  });
  const mainCtx = vm.createContext({ ...base(), navigator: Object.create(Navigator.prototype), Navigator });
  windows.push(vm.runInContext('globalThis', mainCtx));
  const toWorker = [];
  const isoCtx = vm.createContext({ ...base(), chrome: { runtime: { id: 'd59', lastError: undefined, sendMessage(msg, cb) {
    toWorker.push(msg);
    if (typeof cb === 'function') setTimeout(() => cb(msg.type === 'nullecho:get-persona' ? answer : undefined), 1);
  } } } });
  const iso = vm.runInContext('globalThis', isoCtx);
  windows.push(iso);
  isoCtx.self = iso; isoCtx.top = iso;
  const src = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');
  vm.runInContext(src('shim-loader.js'), isoCtx, { filename: 'shim-loader.js' });
  vm.runInContext(src('shim.js'), mainCtx, { filename: 'shim.js' });
  vm.runInContext(src('gpc.js'), mainCtx, { filename: 'gpc.js' });
  const gpcAtBoot = mainCtx.navigator.globalPrivacyControl;
  await new Promise((r) => setTimeout(r, 60));
  const run = (code) => vm.runInContext(code, mainCtx);
  return {
    gpcAtBoot,
    cores: mainCtx.navigator.hardwareConcurrency,
    gpc: mainCtx.navigator.globalPrivacyControl,
    getterSource: run(`(() => { const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl'); return d ? Function.prototype.toString.call(d.get) : null; })()`),
    getterName: run(`(() => { const d = Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl'); return d ? d.get.name : null; })()`),
    reported: toWorker.filter((m) => m.type === 'nullecho:shim-status').map((m) => m.reason ?? (m.upgraded ? 'upgraded' : 'ok')),
  };
}

const SALTED = {
  id: 'win11-chrome-rtx3060', platform: 'Win32', uaData: { platform: 'Windows' },
  gpu: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  cores: 7, memory: 16, screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
  fontList: ['Arial'], noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 42,
};

test('D59: stood down for a bot manager — the real device, and the GPC signal still up (now gpc.js\'s)', async () => {
  const r = await stack({ ok: true, enabled: true, gpc: true, site: 'tesla.com', fpStandDown: 'bot-manager', persona: null, loudFailures: true });
  assert.equal(r.gpcAtBoot, true, 'GPC is up from document_start');
  assert.equal(r.cores, 64, 'the device layer did not stand down');
  assert.equal(r.gpc, true, 'the stand-down silently dropped the JS GPC signal');
  assert.equal(r.getterName, 'get globalPrivacyControl');
  assert.match(r.getterSource, /^function get globalPrivacyControl\(\) \{ \[native code\] \}$/, 'gpc.js\'s getter is masked, as in a realm the shim never patched');
  assert.deepEqual(r.reported, ['bot-manager']);
});

test('D59: with the user\'s GPC switched off the stand-down reports false, as the spec wants — not absent', async () => {
  const r = await stack({ ok: true, enabled: true, gpc: false, site: 'tesla.com', fpStandDown: 'bot-manager', persona: null, loudFailures: true });
  assert.equal(r.cores, 64);
  assert.equal(r.gpc, false);
});

test('D59 CONTROL: the same stack without the flag keeps the persona and the shim\'s own signal', async () => {
  const r = await stack({ ok: true, enabled: true, gpc: true, site: 'tesla.com', fpStandDown: null, persona: SALTED, loudFailures: true });
  assert.equal(r.cores, 7);
  assert.equal(r.gpc, true);
  assert.deepEqual(r.reported, ['upgraded']);
});

test('D59 CONTROL: the allowlist still hands GPC back (Nullecho fully off), unlike the bot-manager stand-down', async () => {
  const r = await stack({ ok: true, enabled: false, gpc: true, site: 'tesla.com', fpStandDown: null, persona: null, loudFailures: true });
  assert.equal(r.cores, 64);
  assert.equal(r.gpc, undefined);
});
