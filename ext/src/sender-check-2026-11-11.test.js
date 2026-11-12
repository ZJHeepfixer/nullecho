/**
 * D61 (2026-11-11) — the worker answers the UI's messages for the extension's own pages only.
 *
 * Before this, `chrome.runtime.onMessage` in background.js answered every message type for every
 * sender. A content script lives in the page's renderer, and background.js's own header counts a
 * compromised renderer as in scope ("Salt containment", point 2). Such a renderer could send what
 * the popup sends: switch Nullecho off for a site (the allowlist writes an `allowAllRequests`
 * rule), turn off GPC and whole blocking categories, rotate the salt, wipe the stored history,
 * read the cross-site overview — every site visited, with its tracker list — and ask for the
 * persona of a site it is not (`GET_SITE_REPORT` takes the site from the message body).
 *
 * The stub below is a Chrome install as Chrome describes one: `runtime.getURL('')` answers
 * `chrome-extension://<id>/`, a content script's sender carries the page's URL and origin plus a
 * tab, the popup's sender carries the extension's URL and origin and NO tab, the options page's
 * carries them and a tab. Every side-effecting API call is logged in `writes`, so "refused" here
 * means three things at once: the reply is the refusal, the reply carries no data, and nothing
 * was written.
 *
 * Run against background.js before D61 (the two `senderMayAsk` lines removed): the "refused"
 * tests fail — the allowlist rule is written, the salt rotates, the overview comes back. With
 * `isOwnPageSender` reduced to "has no tab", the options-page test fails and so does the
 * popup-loaded-in-a-tab row; with the origin comparison dropped, the sandboxed, mixed and no-origin
 * rows fail.
 *
 * Firefox runs the same background.js; the pure-function table at the end covers its
 * `moz-extension://<uuid>/` shape, where the host is NOT the add-on id.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MSG, GPC_MSG, PRICING_MSG, PRICING_STORAGE_KEY } from './protocol.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');

// ── a Chrome install ───────────────────────────────────────────────────────

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const BASE = `chrome-extension://${ID}/`;
const ORIGIN = `chrome-extension://${ID}`;

const store = {};
const session = {};
const onMessage = [];
/** Every call that changes something outside the worker's memory, in order. */
const writes = [];
let dynamicRules = [];
const noopEvent = () => ({ addListener() {} });

globalThis.chrome = {
  runtime: {
    id: ID,
    getURL: (p) => `${BASE}${p}`,
    onMessage: { addListener: (fn) => onMessage.push(fn) },
    onInstalled: noopEvent(),
    onStartup: noopEvent(),
  },
  storage: {
    local: {
      async get(keys) { const out = {}; for (const k of [].concat(keys)) if (k in store) out[k] = structuredClone(store[k]); return out; },
      async set(obj) { writes.push(`storage.local.set ${Object.keys(obj).join(',')}`); Object.assign(store, structuredClone(obj)); },
    },
    session: {
      async get(keys) { const out = {}; for (const k of [].concat(keys)) if (k in session) out[k] = structuredClone(session[k]); return out; },
      async set(obj) { writes.push(`storage.session.set ${Object.keys(obj).join(',')}`); Object.assign(session, structuredClone(obj)); },
    },
  },
  alarms: { onAlarm: noopEvent(), async create() {}, async clear() {} },
  tabs: { onRemoved: noopEvent(), async reload(id) { writes.push(`tabs.reload ${id}`); } },
  webRequest: {
    onBeforeSendHeaders: noopEvent(),
    onHeadersReceived: noopEvent(),
    onErrorOccurred: noopEvent(),
    onSendHeaders: noopEvent(),
  },
  declarativeNetRequest: {
    async getDynamicRules() { return structuredClone(dynamicRules); },
    async updateDynamicRules(arg) {
      writes.push(`dnr.updateDynamicRules +${(arg.addRules ?? []).length} -${(arg.removeRuleIds ?? []).length}`);
      const gone = new Set(arg.removeRuleIds ?? []);
      dynamicRules = dynamicRules.filter((r) => !gone.has(r.id)).concat(structuredClone(arg.addRules ?? []));
    },
    async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'personalization', 'gpc']; },
    async updateEnabledRulesets(arg) { writes.push(`dnr.updateEnabledRulesets ${JSON.stringify(arg)}`); },
    async updateStaticRules() { writes.push('dnr.updateStaticRules'); },
    async getDisabledRuleIds() { return []; },
    async getMatchedRules() { return { rulesMatchedInfo: [] }; },
  },
};
// The worker reads its bundled rule files through runtime.getURL; map that back to the tree.
globalThis.fetch = async (url) => {
  const u = String(url);
  assert.ok(u.startsWith(BASE), `the worker fetched something that is not a bundled file: ${u}`);
  return { async json() { return JSON.parse(fs.readFileSync(path.join(EXT, u.slice(BASE.length)), 'utf8')); } };
};

const BG = await import('./background.js');
const { CONTENT_SCRIPT_TYPES, NOT_OWN_PAGE, isOwnPageSender, senderMayAsk } = BG;

// ── senders, as the browser reports them ───────────────────────────────────

/** shim-loader.js / pricing-scan.js in the top frame of a tab on shop.example. */
const TAB = { id: ID, url: 'https://shop.example/cart', origin: 'https://shop.example', tab: { id: 7, url: 'https://shop.example/cart' }, frameId: 0, documentId: 'D7' };
/** The toolbar popup: no tab. */
const POPUP = { id: ID, url: `${BASE}popup/popup.html`, origin: ORIGIN };
/** The options page: `open_in_tab`, so it HAS a tab. */
const OPTIONS = { id: ID, url: `${BASE}options/options.html#pricing`, origin: ORIGIN, tab: { id: 9, url: `${BASE}options/options.html#pricing` }, frameId: 0, documentId: 'D9' };

const REFUSED = { ok: false, error: NOT_OWN_PAGE };

/** One message through every registered listener, the way the browser delivers it. `undefined` = nobody answered. */
function send(message, sender) {
  return new Promise((resolve) => {
    let handled = false;
    for (const fn of onMessage) if (fn(message, sender, resolve) === true) handled = true;
    if (!handled) queueMicrotask(() => resolve(undefined));
  });
}
const settle = () => new Promise((r) => setTimeout(r, 25));

/** Send from `sender`, and report the reply together with what was written because of it. */
async function attempt(message, sender) {
  await settle();
  const before = writes.length;
  const reply = await send(message, sender);
  await settle();
  return { reply, wrote: writes.slice(before) };
}

const overview = () => send({ type: MSG.GET_OVERVIEW }, OPTIONS);
const report = (site) => send({ type: MSG.GET_SITE_REPORT, url: `https://${site}/` }, POPUP);

// Let init() finish before anything is measured.
assert.equal((await overview()).ok, true, 'the worker booted and answers its own options page');
await settle();

// ── the surface ────────────────────────────────────────────────────────────

const SRC = fs.readFileSync(path.join(HERE, 'background.js'), 'utf8');
/** §1 answers four types spelled as literals; everything else comes from protocol.js. */
const LITERAL_TYPES = [...SRC.matchAll(/case\s+'(nullecho:[^']+)'/g)].map((m) => m[1]);
const SURFACE = [...new Set([...Object.values(MSG), ...Object.values(GPC_MSG), ...Object.values(PRICING_MSG), ...LITERAL_TYPES])];
const UI_TYPES = SURFACE.filter((t) => !CONTENT_SCRIPT_TYPES.has(t));

test('D61: a content script has exactly four message types; the other sixteen are the UI\'s', () => {
  assert.deepEqual([...CONTENT_SCRIPT_TYPES].sort(), [MSG.GET_PERSONA, MSG.FP_DETECTED, MSG.SHIM_STATUS, PRICING_MSG.OBSERVED].sort());
  assert.deepEqual(LITERAL_TYPES.sort(), ['nullecho:heuristics:reset', 'nullecho:heuristics:setStatus', 'nullecho:heuristics:state', 'nullecho:heuristics:stats']);
  assert.equal(SURFACE.length, 20, 'a message type was added or removed: decide whose it is, then update this number');
  assert.equal(UI_TYPES.length, 16);

  // What the content scripts actually send is what the list says: their literals, and nothing else.
  const sentBy = (file) => [...fs.readFileSync(path.join(HERE, file), 'utf8').matchAll(/=\s*'(nullecho:[a-z:-]+)'/g)].map((m) => m[1]).filter((t) => SURFACE.includes(t));
  assert.deepEqual(sentBy('shim-loader.js').sort(), [MSG.FP_DETECTED, MSG.GET_PERSONA, MSG.SHIM_STATUS].sort());
  assert.deepEqual(sentBy('pricing-scan.js'), [PRICING_MSG.OBSERVED]);

  // Every `case` in the listeners is a type this file knows about, so none can be added unseen.
  for (const [, ns, key] of SRC.matchAll(/case\s+(MSG|GPC_MSG|PRICING_MSG)\.(\w+)\s*:/g)) {
    const type = { MSG, GPC_MSG, PRICING_MSG }[ns][key];
    assert.ok(SURFACE.includes(type), `${ns}.${key} is handled but is not a protocol constant`);
  }
  // Both listeners ask before they switch.
  const listeners = SRC.split('chrome.runtime.onMessage.addListener(').slice(1);
  assert.equal(listeners.length, 2, 'background.js registers two message listeners');
  for (const body of listeners) {
    const gate = body.indexOf('senderMayAsk(message?.type, sender)');
    assert.ok(gate >= 0 && gate < body.indexOf('switch (message?.type)'), 'a listener switches on the type before asking who sent it');
  }
});

// ── refused: nothing written, nothing told ─────────────────────────────────
//
// These run before any test changes state, so `wrote` cannot pick up an earlier test's debounced flush.

test('D61 REFUSED: every one of the UI\'s message types, sent from a tab, gets the refusal — no data, no write', async () => {
  const bodies = {
    [MSG.GET_SITE_REPORT]: { url: 'https://bank.example/', tabId: 7 },
    [MSG.SET_SITE_ENABLED]: { url: 'https://shop.example/', enabled: false },
    [MSG.SET_SETTINGS]: { patch: { gpc: false, categories: { ads: false, analytics: false, personalization: false } } },
    [MSG.CLEAR_STATS]: {},
    [MSG.SET_BOT_MANAGER_OVERRIDE]: { site: 'shop.example', override: true },
    [GPC_MSG.SET_ENABLED]: { enabled: false },
    [GPC_MSG.SET_SITE_EXCEPTION]: { host: 'shop.example', excepted: true },
    [PRICING_MSG.GET_FOR_SITE]: { site: 'bank.example' },
    [PRICING_MSG.FORGET]: {},
    'nullecho:heuristics:setStatus': { domain: 'cdn.shop.example', status: 'allowed' },
  };
  for (const type of UI_TYPES) {
    const { reply, wrote } = await attempt({ type, ...(bodies[type] ?? {}) }, TAB);
    assert.deepEqual(reply, REFUSED, `${type} from a tab was answered`);
    assert.deepEqual(wrote, [], `${type} from a tab changed something`);
  }
});

test('D61 REFUSED: the things a hostile page would want are each still as they were', async () => {
  const before = await overview();
  const tag = before.identity.tag;

  await send({ type: MSG.SET_SITE_ENABLED, url: 'https://shop.example/', enabled: false }, TAB);
  await send({ type: MSG.SET_SITE_ENABLED, site: 'shop.example', enabled: false }, TAB);
  await send({ type: MSG.SET_SETTINGS, patch: { gpc: false, categories: { ads: false } } }, TAB);
  await send({ type: MSG.ROTATE_SALT }, TAB);
  await send({ type: GPC_MSG.SET_SITE_EXCEPTION, host: 'shop.example', excepted: true }, TAB);
  await settle();

  const after = await overview();
  assert.deepEqual(after.allowlist, [], 'the tab switched Nullecho off for itself');
  assert.equal(dynamicRules.filter((r) => r.action?.type === 'allowAllRequests').length, 0, 'an allow-all rule was written for the tab\'s site');
  assert.equal(after.settings.gpc, true, 'the tab turned GPC off');
  assert.equal(after.settings.categories.ads, true, 'the tab turned a blocking category off');
  assert.equal(after.identity.tag, tag, 'the tab rotated the salt');
  assert.equal(await globalThis.NullechoGPC.isUserExcepted('shop.example'), false, 'the tab excepted itself from GPC');

  // …and the tab still gets a protected page: its own persona, GPC on.
  const mine = await send({ type: MSG.GET_PERSONA }, TAB);
  assert.equal(mine.enabled, true);
  assert.equal(mine.gpc, true);
  assert.ok(mine.persona?.id);
});

test('D61 REFUSED: a tab cannot learn another site\'s persona, the sites you visited, or a stored price notice', async () => {
  // What the popup is told about bank.example — the thing the tab must not get.
  const bank = await report('bank.example');
  assert.ok(bank.persona?.id, 'the popup is told the persona');

  const asked = await send({ type: MSG.GET_SITE_REPORT, url: 'https://bank.example/' }, TAB);
  assert.deepEqual(asked, REFUSED);
  assert.deepEqual(await send({ type: MSG.GET_SITE_REPORT, site: 'bank.example' }, TAB), REFUSED);
  assert.deepEqual(await send({ type: MSG.GET_OVERVIEW }, TAB), REFUSED, 'the overview lists every site with its trackers and persona');
  assert.deepEqual(await send({ type: 'nullecho:heuristics:state' }, TAB), REFUSED, 'the learner\'s state is a list of domains seen across sites');
  assert.deepEqual(await send({ type: 'nullecho:heuristics:stats' }, TAB), REFUSED);

  store[PRICING_STORAGE_KEY] = [{ siteKey: 'bank.example', url: 'https://bank.example/loan', timestamp: 1, level: 'ny-disclosure', price: '9.99', currency: 'USD', context: 'x' }];
  assert.deepEqual(await send({ type: PRICING_MSG.GET_FOR_SITE, site: 'bank.example' }, TAB), REFUSED);
  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }, TAB), REFUSED);
  assert.deepEqual(await send({ type: PRICING_MSG.FORGET }, TAB), REFUSED);
  assert.equal(store[PRICING_STORAGE_KEY].length, 1, 'the tab deleted the stored notices');
  store[PRICING_STORAGE_KEY] = [];
});

test('D61 REFUSED: nothing in the message body makes a tab one of our pages', async () => {
  const claims = [
    { url: `${BASE}popup/popup.html` },
    { sender: POPUP },
    { origin: ORIGIN, id: ID, from: 'popup' },
    { tab: null, frameId: undefined },
  ];
  for (const claim of claims) {
    const { reply, wrote } = await attempt({ type: MSG.ROTATE_SALT, ...claim }, TAB);
    assert.deepEqual(reply, REFUSED, `a body claiming ${JSON.stringify(Object.keys(claim))} was believed`);
    assert.deepEqual(wrote, []);
  }
});

test('D61 REFUSED: senders that look like ours and are not', async () => {
  const rows = {
    'no sender at all': undefined,
    'null': null,
    'an empty sender': {},
    'our id and nothing else': { id: ID },
    'our URL and no origin': { id: ID, url: `${BASE}popup/popup.html` },
    'our origin and no URL': { id: ID, origin: ORIGIN },
    'a tab in an about:blank frame of a web page': { id: ID, url: 'about:blank', origin: 'https://shop.example', tab: { id: 7 }, frameId: 3 },
    'a web URL that contains ours': { id: ID, url: `https://evil.example/${BASE}popup/popup.html`, origin: 'https://evil.example' },
    'a web host that starts like ours': { id: ID, url: `https://${ID}/popup/popup.html`, origin: `https://${ID}` },
    'our scheme, a longer host': { id: ID, url: `chrome-extension://${ID}.evil.example/popup/popup.html`, origin: `chrome-extension://${ID}.evil.example` },
    'another extension\'s page under our id': { id: ID, url: 'chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba/popup/popup.html', origin: 'chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba' },
    'our page URL under another extension\'s id': { id: 'ponmlkjihgfedcbaponmlkjihgfedcba', url: `${BASE}popup/popup.html`, origin: ORIGIN },
    'our origin, a web URL that names our host (the two disagree)': { id: ID, url: `https://evil.example/?next=${ID}`, origin: ORIGIN },
    'our origin, our scheme, a longer host': { id: ID, url: `chrome-extension://${ID}.evil.example/popup/popup.html`, origin: ORIGIN },
    'our URL with a web origin (the two disagree)': { id: ID, url: `${BASE}popup/popup.html`, origin: 'https://shop.example' },
    'our URL in a sandboxed frame (opaque origin)': { id: ID, url: `${BASE}popup/popup.html`, origin: 'null' },
    'an about:blank frame inside our own page': { id: ID, url: 'about:blank', origin: ORIGIN },
    'a url that is not a string': { id: ID, url: { toString: () => `${BASE}popup/popup.html` }, origin: ORIGIN },
    'a url that does not parse': { id: ID, url: 'chrome-extension:', origin: ORIGIN },
  };
  for (const [what, sender] of Object.entries(rows)) {
    assert.equal(isOwnPageSender(sender), false, `${what}: taken for one of our pages`);
    const { reply, wrote } = await attempt({ type: MSG.CLEAR_STATS }, sender);
    assert.deepEqual(reply, REFUSED, what);
    assert.deepEqual(wrote, [], what);
  }
});

test('D61: a type nobody handles is still nobody\'s — no reply from either listener, for a tab or for the popup', async () => {
  assert.equal(await send({ type: 'some-other-extension:hello' }, TAB), undefined);
  assert.equal(await send({ type: 'some-other-extension:hello' }, POPUP), undefined);
  assert.equal(await send({}, TAB), undefined);
  assert.equal(await send(undefined, TAB), undefined);
  // An unknown `nullecho:` type from a tab is refused like the rest; from the popup it falls through as before.
  assert.deepEqual(await send({ type: 'nullecho:not-a-real-type' }, TAB), REFUSED);
  assert.equal(await send({ type: 'nullecho:not-a-real-type' }, POPUP), undefined);
});

// ── honoured: the extension's own pages ────────────────────────────────────

test('D61 HONOURED: the popup (no tab) switches a site off and the options page (in a tab) switches it back', async () => {
  const off = await attempt({ type: MSG.SET_SITE_ENABLED, url: 'https://shop.example/', enabled: false }, POPUP);
  assert.deepEqual(off.reply, { ok: true, site: 'shop.example', enabled: false });
  assert.ok(off.wrote.some((w) => w.startsWith('storage.local.set allowlist')), 'the allowlist was saved');
  assert.equal(dynamicRules.filter((r) => r.action?.type === 'allowAllRequests').length, 1, 'the allow-all rule for the site exists');
  assert.equal((await send({ type: MSG.GET_PERSONA }, TAB)).enabled, false, 'the page is told Nullecho is off here');

  // The options page has a tab. A check that read "has a tab → not ours" would refuse it.
  const on = await attempt({ type: MSG.SET_SITE_ENABLED, site: 'shop.example', enabled: true }, OPTIONS);
  assert.deepEqual(on.reply, { ok: true, site: 'shop.example', enabled: true });
  assert.equal(dynamicRules.filter((r) => r.action?.type === 'allowAllRequests').length, 0);
  assert.equal((await send({ type: MSG.GET_PERSONA }, TAB)).enabled, true);
});

test('D61 HONOURED: the popup loaded by URL in a tab (the harness does this) is still the popup', async () => {
  // harness/blocked-count-probe.mjs: page.goto(chrome-extension://<id>/popup/popup.html), then sendMessage.
  const popupInTab = { ...POPUP, tab: { id: 11, url: POPUP.url }, frameId: 0 };
  assert.equal(isOwnPageSender(popupInTab), true);
  const r = await send({ type: MSG.SET_SITE_ENABLED, url: 'https://fixture.example/', enabled: false }, popupInTab);
  assert.equal(r.ok, true);
  await send({ type: MSG.SET_SITE_ENABLED, url: 'https://fixture.example/', enabled: true }, popupInTab);
});

test('D61 HONOURED: settings, the salt, GPC, the learner and the overview all answer the UI as before', async () => {
  const set = await send({ type: MSG.SET_SETTINGS, patch: { categories: { social: false } } }, OPTIONS);
  assert.equal(set.ok, true);
  assert.equal(set.settings.categories.social, false);
  assert.equal((await send({ type: MSG.SET_SETTINGS, patch: { categories: { social: true } } }, OPTIONS)).settings.categories.social, true);

  const tag = (await overview()).identity.tag;
  const rotated = await send({ type: MSG.ROTATE_SALT }, POPUP);
  assert.equal(rotated.ok, true);
  assert.notEqual(rotated.identity.tag, tag, 'the salt really rotated');

  assert.deepEqual(await send({ type: GPC_MSG.SET_SITE_EXCEPTION, host: 'breaks.example', excepted: true }, POPUP), { ok: true });
  assert.equal(await globalThis.NullechoGPC.isUserExcepted('breaks.example'), true);
  assert.deepEqual(await send({ type: GPC_MSG.SET_SITE_EXCEPTION, host: 'breaks.example', excepted: false }, POPUP), { ok: true });
  const gpcOff = await attempt({ type: GPC_MSG.SET_ENABLED, enabled: false }, OPTIONS);
  assert.deepEqual(gpcOff.reply, { ok: true });
  assert.ok(gpcOff.wrote.some((w) => w.includes('"disableRulesetIds":["gpc"]')), 'the GPC ruleset was switched off');
  await send({ type: GPC_MSG.SET_ENABLED, enabled: true }, OPTIONS);

  assert.deepEqual(await send({ type: 'nullecho:heuristics:setStatus', domain: 'tracker.example', status: 'allowed' }, OPTIONS), { ok: true });
  const learned = await send({ type: 'nullecho:heuristics:state' }, OPTIONS);
  assert.equal(learned.find((d) => d.domain === 'tracker.example')?.status, 'allowed');
  assert.equal(typeof (await send({ type: 'nullecho:heuristics:stats' }, OPTIONS)).observed, 'number');
  // A tab cannot wipe what the user just decided.
  assert.deepEqual(await send({ type: 'nullecho:heuristics:reset' }, TAB), REFUSED);
  assert.ok((await send({ type: 'nullecho:heuristics:state' }, OPTIONS)).some((d) => d.domain === 'tracker.example'));
  assert.deepEqual(await send({ type: 'nullecho:heuristics:reset' }, OPTIONS), { ok: true });
  assert.deepEqual(await send({ type: 'nullecho:heuristics:state' }, OPTIONS), []);

  const all = await overview();
  assert.equal(all.ok, true);
  assert.ok(Array.isArray(all.sites) && Array.isArray(all.pool));
});

// ── unaffected: what a content script sends from a tab ─────────────────────

test('D61 UNAFFECTED: the handshake, the detection count and the shim status still work from a tab — for the tab\'s own site only', async () => {
  const persona = await send({ type: MSG.GET_PERSONA, url: 'https://bank.example/', site: 'bank.example' }, TAB);
  assert.equal(persona.ok, true);
  assert.equal(persona.site, 'shop.example', 'the site is the sender\'s, whatever the body says');
  assert.equal(persona.persona.id, (await report('shop.example')).persona.id);
  assert.notEqual(Object.hasOwn(persona, 'salt'), true);

  assert.deepEqual(await send({ type: MSG.FP_DETECTED, api: 'canvas', count: 2, site: 'bank.example' }, TAB), { ok: true });
  assert.deepEqual(await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null }, TAB), { ok: true });
  const shop = await report('shop.example');
  assert.equal(shop.stats.fp, 2);
  assert.equal(shop.stats.lastShimStatus.upgraded, true);
  assert.equal((await report('bank.example')).stats.fp, 0, 'a tab reported a detection onto another site');

  // A sub-frame and an inherited-origin frame: still answered, still keyed on the browser's account.
  const frame = await send({ type: MSG.GET_PERSONA }, { id: ID, url: 'about:blank', origin: 'https://shop.example', tab: { id: 7 }, frameId: 4 });
  assert.equal(frame.site, 'shop.example');

  // The history the tab added is the user's to clear, not the tab's.
  assert.deepEqual(await send({ type: MSG.CLEAR_STATS }, TAB), REFUSED);
  assert.equal((await report('shop.example')).stats.fp, 2);
  assert.deepEqual(await send({ type: MSG.CLEAR_STATS }, OPTIONS), { ok: true });
  assert.equal((await report('shop.example')).stats.fp, 0);
});

test('D61 UNAFFECTED: a price notice is stored from a tab under the tab\'s own site; only the UI reads, counts or deletes it', async () => {
  const level = Object.keys(globalThis.NullechoPricing.SENTENCES)[0];
  assert.deepEqual(await send({ type: PRICING_MSG.OBSERVED, level, context: 'c', price: '12.00', currency: 'USD', site: 'bank.example', url: 'https://bank.example/' }, TAB), { ok: true });
  assert.equal(store[PRICING_STORAGE_KEY].length, 1);
  assert.equal(store[PRICING_STORAGE_KEY][0].siteKey, 'shop.example');

  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }, TAB), REFUSED);
  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }, OPTIONS), { ok: true, count: 1 });
  assert.equal((await send({ type: PRICING_MSG.GET_FOR_SITE, site: 'shop.example' }, POPUP)).observation.siteKey, 'shop.example');
  assert.deepEqual(await send({ type: PRICING_MSG.FORGET }, OPTIONS), { ok: true });
  assert.deepEqual(await send({ type: PRICING_MSG.COUNT }, OPTIONS), { ok: true, count: 0 });
});

// ── the rule itself, for each browser's shape ──────────────────────────────

test('D61: isOwnPageSender — Chrome / Edge', () => {
  const own = { id: ID, base: BASE };
  assert.equal(isOwnPageSender(POPUP, own), true);
  assert.equal(isOwnPageSender(OPTIONS, own), true, 'a tab does not make a page someone else\'s');
  assert.equal(isOwnPageSender({ id: ID, url: `${BASE}options/drop.html?from=popup`, origin: ORIGIN }, own), true);
  assert.equal(isOwnPageSender(TAB, own), false);
  assert.equal(senderMayAsk(MSG.GET_PERSONA, TAB), true);
  assert.equal(senderMayAsk(MSG.GET_OVERVIEW, TAB), false);
  assert.equal(senderMayAsk(MSG.GET_OVERVIEW, POPUP), true);
  assert.equal(senderMayAsk(undefined, TAB), false);
});

test('D61: isOwnPageSender — Firefox, where the page host is a per-install UUID and not the add-on id', () => {
  const own = { id: '{5d2f6a3e-1c4b-4e8a-9f70-2b6c8d1e0a94}', base: 'moz-extension://0b7c1f52-93aa-4d6e-8c1d-6f2e4a9b3c10/' };
  const origin = 'moz-extension://0b7c1f52-93aa-4d6e-8c1d-6f2e4a9b3c10';
  // Firefox reports the same three fields; `origin` since 126 (this build needs 140).
  assert.equal(isOwnPageSender({ id: own.id, url: `${own.base}popup/popup.html`, origin }, own), true);
  assert.equal(isOwnPageSender({ id: own.id, url: `${own.base}options/options.html`, origin, tab: { id: 3 }, frameId: 0 }, own), true);
  // Firefox 126+ reports an origin for every page; a sender with our URL and none was not described as one of ours.
  assert.equal(isOwnPageSender({ id: own.id, url: `${own.base}popup/popup.html` }, own), false, 'our URL alone is not enough');
  assert.equal(isOwnPageSender({ id: own.id, url: 'https://shop.example/', origin: 'https://shop.example', tab: { id: 3 }, frameId: 0 }, own), false);
  assert.equal(isOwnPageSender({ id: own.id, url: 'moz-extension://ffffffff-93aa-4d6e-8c1d-6f2e4a9b3c10/popup/popup.html', origin }, own), false, 'another add-on\'s UUID');
  assert.equal(isOwnPageSender({ id: own.id, url: `moz-extension://${own.id}/popup/popup.html`, origin }, own), false, 'the add-on id is not the host');
  assert.equal(isOwnPageSender({ id: own.id, url: `chrome-extension://0b7c1f52-93aa-4d6e-8c1d-6f2e4a9b3c10/popup/popup.html`, origin }, own), false, 'right host, wrong scheme');
});

test('D61: isOwnPageSender fails closed when the browser\'s own answers are missing or absurd', () => {
  const page = (base) => ({ id: ID, url: `${base}popup/popup.html`, origin: base.replace(/\/$/, '') });
  assert.equal(isOwnPageSender(page(BASE), { id: undefined, base: BASE }), false, 'no runtime.id');
  assert.equal(isOwnPageSender({ url: `${BASE}popup/popup.html`, origin: ORIGIN }, { id: undefined, base: BASE }), false, 'undefined === undefined is not a match');
  assert.equal(isOwnPageSender(page(BASE), { id: ID, base: '' }), false, 'no base URL');
  assert.equal(isOwnPageSender(page(BASE), { id: ID, base: 'not a url' }), false);
  // If getURL ever answered a web URL, nothing is privileged — never "every page on that site is".
  assert.equal(isOwnPageSender(page('https://nullecho.example/'), { id: ID, base: 'https://nullecho.example/' }), false);
  // A base with a path (no browser answers one): only what lies under it.
  const own = { id: ID, base: 'file:///work/ext' };
  assert.equal(isOwnPageSender({ id: ID, url: 'file:///work/ext/popup/popup.html', origin: 'file://' }, own), true);
  assert.equal(isOwnPageSender({ id: ID, url: 'file:///work/ext-evil/popup.html', origin: 'file://' }, own), false);
  assert.equal(isOwnPageSender({ id: ID, url: 'file:///etc/passwd', origin: 'file://' }, own), false);
});
