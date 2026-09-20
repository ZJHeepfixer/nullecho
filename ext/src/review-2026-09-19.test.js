/**
 * Nullecho — GPC / DROP review, 2026-09-19: REPRODUCTIONS AND GUARDS
 * ═══════════════════════════════════════════════════════════════════
 * Companion to `docs/review-2026-09-19/gpc.md` (G1, G2, G3, G4, G10) and the
 * `isCalifornian` finding in `docs/review-2026-09-19/drop.md` §S1 /
 * `pricing.md`. Unlike `review-2026-09-16.test.js`, these tests are written
 * GREEN-AFTER-FIX: each one starts red against the tree the review read
 * (`1b5f316`) and is a regression guard afterwards. The red state is recorded in
 * `docs/DECISIONS.md` D36–D40 with the browser measurements that produced it.
 *
 * Fidelity notes:
 *   · G1 is a rule-SHAPE test. It models DNR's documented condition semantics —
 *     fields within one condition are ANDed, list members are ORed — and asserts
 *     the five request shapes the reviewer put through Chrome's own
 *     `chrome.declarativeNetRequest.testMatchOutcome`. The browser run is the
 *     authority; this is the cheap guard that keeps the shape from drifting back.
 *   · G2/G3 run the REAL page half of `gpc.js` against a `Navigator` whose
 *     accessors are as native-looking as a Node realm can make them. `[native
 *     code]` cannot exist here, so the calibration model is installed by hand in
 *     both engines' spellings and the un-calibratable case is tested too.
 *   · G4 drives the real service-worker message the popup sends, and then checks
 *     the popup actually sends it. Neither half alone is the feature.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.resolve(EXT, p), 'utf8');

// ═══════════════════════════════════════════════════════════════════════════
// Extension-API stubs for the worker half of gpc.js.
// ═══════════════════════════════════════════════════════════════════════════

const store = {};
const dynamicRules = new Map();
let enabledRulesets = ['ads', 'analytics', 'social', 'fingerprinting', 'gpc'];

globalThis.chrome = {
  runtime: { getURL: (p) => `stub:${p}` },
  storage: {
    local: {
      async get(key) { return key in store ? { [key]: store[key] } : {}; },
      async set(obj) { Object.assign(store, structuredClone(obj)); },
    },
  },
  declarativeNetRequest: {
    async getDynamicRules() { return [...dynamicRules.values()]; },
    async updateDynamicRules({ addRules = [], removeRuleIds = [] }) {
      for (const id of removeRuleIds) dynamicRules.delete(id);
      for (const r of addRules) dynamicRules.set(r.id, r);
    },
    async getEnabledRulesets() { return [...enabledRulesets]; },
    async updateEnabledRulesets({ enableRulesetIds = [], disableRulesetIds = [] }) {
      enabledRulesets = enabledRulesets.filter((id) => !disableRulesetIds.includes(id));
      for (const id of enableRulesetIds) if (!enabledRulesets.includes(id)) enabledRulesets.push(id);
    },
  },
};

globalThis.fetch = async () => ({
  async json() { return JSON.parse(read('rules/gpc.json')); },
});

await import('./gpc.js');
const GPC = globalThis.NullechoGPC;

// ═══════════════════════════════════════════════════════════════════════════
// G1 — the per-site exception must suppress the header on the ENTRY navigation
//
// `syncExceptionRules()` put `requestDomains` AND `initiatorDomains` in one
// condition. DNR ANDs condition fields, so the rule only matched a request that
// was BOTH to the host and from it — which a top-level navigation typed,
// bookmarked or followed from another site is not. The bank's server got
// `Sec-GPC: 1` on the document request while `linkage.js` told the user the
// signal had not been sent.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Chrome's documented matching semantics for the fields these rules use:
 * fields within one `condition` are ANDed; the members of one domain list are
 * ORed, and a domain matches its own subdomains.
 * <https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest>
 */
function ruleMatches(rule, req) {
  const c = rule.condition;
  const hit = (list, host) =>
    host !== null && list.some((d) => host === d || host.endsWith(`.${d}`));
  if (c.resourceTypes && !c.resourceTypes.includes(req.type)) return false;
  if (c.requestDomains && !hit(c.requestDomains, req.host)) return false;
  if (c.initiatorDomains && !hit(c.initiatorDomains, req.initiator)) return false;
  return true;
}

const suppressed = (req) =>
  [...dynamicRules.values()].some((r) => ruleMatches(r, req));

test('G1: a per-site exception suppresses Sec-GPC on the TOP-LEVEL navigation, which has no initiator', async () => {
  await GPC.setSiteException('a.test', true);
  assert.equal(
    suppressed({ host: 'a.test', initiator: null, type: 'main_frame' }), true,
    'the entry navigation is the request the site actually breaks on, and it carries no initiator',
  );
});

test('G1: the exception still covers the five request shapes the reviewer measured', async () => {
  const cases = [
    ['top-level nav to a.test (NO initiator)', { host: 'a.test', initiator: null, type: 'main_frame' }, true],
    ['top-level nav to a.test (initiator a.test)', { host: 'a.test', initiator: 'a.test', type: 'main_frame' }, true],
    ['a.test subresource -> a.test', { host: 'a.test', initiator: 'a.test', type: 'xmlhttprequest' }, true],
    ['a.test page -> third.test (3P)', { host: 'third.test', initiator: 'a.test', type: 'xmlhttprequest' }, true],
    ['b.test page -> a.test subresource', { host: 'a.test', initiator: 'b.test', type: 'xmlhttprequest' }, true],
    ['unrelated page -> unrelated host', { host: 'c.test', initiator: 'b.test', type: 'xmlhttprequest' }, false],
  ];
  for (const [label, req, want] of cases) {
    assert.equal(suppressed(req), want, label);
  }
});

test('G1: subdomains of an excepted host are covered, and look-alikes are not', () => {
  assert.equal(suppressed({ host: 'secure.a.test', initiator: null, type: 'main_frame' }), true);
  assert.equal(suppressed({ host: 'a.test.evil.test', initiator: null, type: 'main_frame' }), false);
});

test('G1: every exception rule stays a header REMOVE inside the reserved id range', () => {
  const rules = [...dynamicRules.values()];
  assert.ok(rules.length >= 2, 'one host needs more than one rule — DNR ANDs a single condition');
  for (const r of rules) {
    assert.equal(r.action.type, 'modifyHeaders',
      'an allow rule here would also unblock every tracker on the site');
    assert.equal(r.action.requestHeaders[0].header, 'Sec-GPC');
    assert.equal(r.action.requestHeaders[0].operation, 'remove');
    assert.ok(r.priority > 1, 'must outrank rule 5000');
    assert.ok(r.id >= 1_100_000 && r.id < 1_101_000, `id ${r.id} outside the reserved GPC range`);
  }
  assert.equal(new Set(rules.map((r) => r.id)).size, rules.length, 'rule ids collided');
});

test('G1: removing the exception removes every rule it added', async () => {
  await GPC.setSiteException('a.test', false);
  assert.equal(dynamicRules.size, 0);
});

test('G1: two excepted hosts do not collide, and each keeps its own entry navigation covered', async () => {
  await GPC.setSiteException('one.test', true);
  await GPC.setSiteException('two.test', true);
  assert.equal(suppressed({ host: 'one.test', initiator: null, type: 'main_frame' }), true);
  assert.equal(suppressed({ host: 'two.test', initiator: null, type: 'main_frame' }), true);
  const ids = [...dynamicRules.values()].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'the second host overwrote the first host\'s rule ids');
  await GPC.setSiteException('one.test', false);
  await GPC.setSiteException('two.test', false);
});

test('G1: the reserved id range bounds how many hosts can be excepted', async () => {
  const hosts = Array.from({ length: 600 }, (_, i) => `h${i}.test`);
  for (const h of hosts) await GPC.setSiteException(h, true);
  for (const r of dynamicRules.values()) {
    assert.ok(r.id >= 1_100_000 && r.id < 1_101_000, `id ${r.id} escaped the reserved range`);
  }
  for (const h of hosts) await GPC.setSiteException(h, false);
  assert.equal(dynamicRules.size, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// G2 / G3 — the page half: the property's VALUE when off, and its SHAPE
//
// ⚠ READ WITH D46. Since 2026-09-20 the SHIPPED path is `shim.js` installing
// this property — one `Function.prototype.toString` mask per realm, and the
// shim owns it. Everything below runs `gpc.js` with no shim in the realm, which
// is still a real configuration (the shim failed to inject, or its persona
// derivation failed) and is where `gpc.js` remains the whole feature, its own
// masking layer included. The shim-owned path is pinned by
// `gpc-one-mask-2026-09-20.test.js`, which asserts the same G2/G3 properties of
// the shim's getter and that `gpc.js` adds no second layer over it.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A page realm with a `Navigator` whose accessors are installed the way WebIDL
 * installs them. `model` is the source a native accessor reports; Node cannot
 * produce `[native code]`, so the rig fakes it through `Function.prototype
 * .toString` exactly as `shim.js` does in a real page — which is also the layer
 * `gpc.js` has to cooperate with.
 */
const PRISTINE_TO_STRING = Object.getOwnPropertyDescriptor(Function.prototype, 'toString');

let pageInstance = 0;
async function freshPage({ nativeGpc, model = 'function get onLine() { [native code] }' } = {}) {
  // Undo the toString layer the previous instance installed, so each page is a
  // fresh realm as far as this file is concerned.
  Object.defineProperty(Function.prototype, 'toString', PRISTINE_TO_STRING);
  delete globalThis.chrome;
  delete globalThis.NullechoGPC;

  class Navigator {}
  const nav = Object.create(Navigator.prototype);
  const doc = new EventTarget();

  // A native-looking `onLine`, the accessor gpc.js calibrates its masked source
  // from. The masking layer below is shim.js's job in a real page.
  const onLineHolder = { get onLine() { return true; } };
  const onLineGet = Object.getOwnPropertyDescriptor(onLineHolder, 'onLine').get;
  Object.defineProperty(Navigator.prototype, 'onLine', {
    get: onLineGet, configurable: true, enumerable: true,
  });

  /** Firefox ships GPC natively. `nativeGpc` installs that starting state. */
  let nativeGet = null;
  if (nativeGpc !== undefined) {
    const h = { get globalPrivacyControl() { return nativeGpc; } };
    nativeGet = Object.getOwnPropertyDescriptor(h, 'globalPrivacyControl').get;
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
      get: nativeGet, configurable: true, enumerable: true,
    });
  }

  if (model) {
    // Stands in for `shim.js`, which owns `Function.prototype.toString` in a
    // real page and — the detail that matters for the composition — masks its
    // own replacement as well as the functions it installs.
    const prev = Function.prototype.toString;
    const holder = {
      toString() {
        if (this === onLineGet) return model;
        if (this === shimLayer) return 'function toString() { [native code] }';
        if (nativeGet && this === nativeGet) {
          return model.replace(/\bonLine\b/, 'globalPrivacyControl');
        }
        return prev.call(this);
      },
    };
    const shimLayer = Object.getOwnPropertyDescriptor(holder, 'toString').value;
    Object.defineProperty(Function.prototype, 'toString', {
      value: shimLayer, writable: true, enumerable: false, configurable: true,
    });
  }

  for (const [name, value] of [['Navigator', Navigator], ['document', doc], ['navigator', nav]]) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }

  let boot = null;
  doc.addEventListener('nullecho:status', (e) => {
    const d = JSON.parse(e.detail);
    if (d.phase === 'boot' && d.channel === 'gpc') boot = d;
  }, true);

  await import(`./gpc.js?r19=${++pageInstance}`);

  const send = (payload) => doc.dispatchEvent(new CustomEvent('nullecho:persona', {
    detail: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }));

  const descriptor = () => Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl');
  return { doc, Navigator, nav, boot, send, descriptor, nativeGet, onLineGet };
}

test.after(() => { Object.defineProperty(Function.prototype, 'toString', PRISTINE_TO_STRING); });

// ── G2 — "off" is `false`, never `undefined`, and never a delete on Firefox ──

test('G2: an authenticated gpc:false leaves the property reading FALSE, not undefined', async () => {
  const p = await freshPage();
  p.send({ ok: true, enabled: true, gpc: false, site: 'a.test', gpcNonce: p.boot.nonce });
  assert.equal(p.nav.globalPrivacyControl, false,
    'the spec: "The value is false if no Sec-GPC header field would be sent"');
  assert.equal(typeof p.nav.globalPrivacyControl, 'boolean', 'readonly attribute boolean');
  assert.ok(p.descriptor(), 'the property must still exist');
});

test('G2: on a browser that ships GPC natively, standing the signal down restores the NATIVE descriptor', async () => {
  const p = await freshPage({ nativeGpc: false });
  assert.equal(p.nav.globalPrivacyControl, true, 'precondition: we raised the signal over the native false');
  p.send({ ok: true, enabled: true, gpc: false, site: 'a.test', gpcNonce: p.boot.nonce });
  assert.equal(p.descriptor().get, p.nativeGet,
    'Firefox 155 was left with no globalPrivacyControl at all — a state no stock Firefox can produce');
  assert.equal(p.nav.globalPrivacyControl, false);
});

test('G2: a native GPC that is already ON is left completely alone', async () => {
  const p = await freshPage({ nativeGpc: true });
  assert.equal(p.descriptor().get, p.nativeGet, 'redefining a native true buys nothing and costs a double-shim tell');
  p.send({ ok: true, enabled: true, gpc: false, site: 'a.test', gpcNonce: p.boot.nonce });
  assert.equal(p.descriptor().get, p.nativeGet, 'and standing down must not delete it either');
});

test('G2: a whole-extension stand-down restores the ORIGINAL state — absent on Chrome, native on Firefox', async () => {
  const chrome = await freshPage();
  chrome.send({ ok: true, enabled: false, gpc: true, site: 'a.test', gpcNonce: chrome.boot.nonce });
  assert.equal(chrome.nav.globalPrivacyControl, undefined,
    'allowlisted means Nullecho is not here; a stock Chrome has no such property');
  assert.equal(chrome.descriptor(), undefined);

  const firefox = await freshPage({ nativeGpc: false });
  firefox.send({ ok: true, enabled: false, gpc: true, site: 'a.test', gpcNonce: firefox.boot.nonce });
  assert.equal(firefox.descriptor().get, firefox.nativeGet,
    'standing down on Firefox hands the property back to Firefox');
});

// ── G3 — the getter is shaped and sourced like a native accessor ────────────

/** The CreepJS / review probes, on a function from this realm. */
const shapeOf = (f) => {
  const r = {
    names: Object.getOwnPropertyNames(f).sort().join(','),
    protoIn: 'prototype' in f,
  };
  try { class X extends f {} r.extends = 'no-throw'; } catch (e) { r.extends = e.constructor.name; }
  try { new f(); r.construct = 'no-throw'; } catch (e) { r.construct = e.constructor.name; }
  return r;
};
const NATIVE_SHAPE = { names: 'length,name', protoIn: false, extends: 'TypeError', construct: 'TypeError' };

test('G3: the getter is named "get globalPrivacyControl", like every other Navigator accessor', async () => {
  const p = await freshPage();
  assert.equal(p.descriptor().get.name, 'get globalPrivacyControl',
    'an object-literal getter is named "get"; a WebIDL accessor is named "get <attr>"');
});

test('G3: the getter has a native function SHAPE (D32) — no own prototype, not a constructor', async () => {
  const p = await freshPage();
  assert.deepEqual(shapeOf(p.descriptor().get), NATIVE_SHAPE);
});

test('G3: the getter STRINGIFIES like its neighbours, in whichever spelling the engine uses', async () => {
  const chromeSpelling = await freshPage({ model: 'function get onLine() { [native code] }' });
  assert.equal(
    Function.prototype.toString.call(chromeSpelling.descriptor().get),
    'function get globalPrivacyControl() { [native code] }',
  );

  const firefoxSpelling = await freshPage({ model: 'function onLine() {\n    [native code]\n}' });
  assert.equal(
    Function.prototype.toString.call(firefoxSpelling.descriptor().get),
    'function globalPrivacyControl() {\n    [native code]\n}',
    'Firefox prints a native accessor without the "get " prefix — copy the neighbour, do not assume Chrome',
  );
});

test('G3: with no native accessor to copy, the masked source still reads [native code]', async () => {
  const p = await freshPage({ model: null });
  const src = Function.prototype.toString.call(p.descriptor().get);
  assert.ok(src.includes('[native code]'), `un-calibrated source leaked: ${src}`);
  assert.ok(!src.includes('return'), 'the implementation must not be readable');
});

test('G3: the OFF getter is masked too — an excepted site must not get a louder tell than an on one', async () => {
  const p = await freshPage();
  p.send({ ok: true, enabled: true, gpc: false, site: 'a.test', gpcNonce: p.boot.nonce });
  const get = p.descriptor().get;
  assert.equal(get.name, 'get globalPrivacyControl');
  assert.deepEqual(shapeOf(get), NATIVE_SHAPE);
  assert.ok(Function.prototype.toString.call(get).includes('[native code]'));
});

test('G3: the masking layer masks ITSELF, or it is a louder tell than the getter it hides', async () => {
  const p = await freshPage();
  const ts = Function.prototype.toString;
  const src = ts.call(ts);
  assert.ok(src.includes('[native code]'), `Function.prototype.toString reported its own source: ${src}`);
  assert.equal(ts.name, 'toString');
  assert.deepEqual(shapeOf(ts), NATIVE_SHAPE);
  // and everything else still stringifies normally
  assert.equal(ts.call(function named() { return 1; }).includes('[native code]'), false);
  assert.ok(ts.call(p.onLineGet).includes('[native code]'), 'the layer below must still be consulted');

  // With no shim underneath, the layer below is the engine's own toString, and
  // ours must be indistinguishable from it.
  await freshPage({ model: null });
  const bare = Function.prototype.toString;
  assert.equal(bare.call(bare), 'function toString() { [native code] }');
});

test('G3 HONEST LIMIT: the property is still the LAST own key of Navigator.prototype', async () => {
  const p = await freshPage();
  const keys = Object.getOwnPropertyNames(p.Navigator.prototype);
  assert.equal(keys[keys.length - 1], 'globalPrivacyControl',
    'a WebIDL member sits in declaration order; a property appended at document_start cannot. '
    + 'This is documented in gpc.js and DECISIONS.md D38 as an unfixed limit, not claimed closed.');
});

test('G5 HONEST LIMIT: worker scope is not implemented, and gpc.js says so with the spec cite', () => {
  const GPC_SRC = read('src/gpc.js');
  assert.ok(/WorkerNavigator includes GlobalPrivacyControl/.test(GPC_SRC),
    'the normative line the extension does not satisfy must be quoted, not paraphrased away');
  // `[\s*]+` so a comment line break between the two words does not pass the guard.
  assert.ok(/A8[\s*]+stays open/.test(GPC_SRC), 'an unclosed gap must be named as unclosed');
  assert.equal(/defineProperty\(\s*WorkerNavigator/.test(GPC_SRC), false,
    'if worker scope is ever installed into, this comment block is the thing to update first');
});

// ═══════════════════════════════════════════════════════════════════════════
// G4 — the per-site exception has a user interface
// ═══════════════════════════════════════════════════════════════════════════

const POPUP_JS = read('popup/popup.js');
const POPUP_HTML = read('popup/popup.html');

test('G4: the popup sends nullecho:gpc:setSiteException, with the host and the flag', async () => {
  const { GPC_MSG } = await import('./protocol.js');
  assert.equal(GPC_MSG.SET_SITE_EXCEPTION, 'nullecho:gpc:setSiteException');
  assert.ok(
    POPUP_JS.includes('GPC_MSG.SET_SITE_EXCEPTION'),
    'nothing in popup/ or options/ ever sent this message; the recovery path existed only in the worker',
  );
  assert.ok(/excepted:/.test(POPUP_JS), 'the message needs an `excepted` flag');
});

test('G4: the popup has a control for it, and the control is wired to a handler', () => {
  const ids = [...POPUP_HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.includes('gpc-site'), 'popup.html has no per-site GPC control');
  assert.ok(ids.includes('gpc-panel'), 'the control needs a panel to live in');
  assert.ok(/\$\('gpc-site'\)[\s\S]{0,400}addEventListener\('change'/.test(POPUP_JS)
    || /addEventListener\('change'[\s\S]{0,200}gpc-site/.test(POPUP_JS)
    || /gpcSiteToggle/.test(POPUP_JS),
    'the control exists in the markup but nothing listens to it');
});

test('G4: the remedy under an excepted site points at the control, not at a global toggle already on', async () => {
  const { siteReport, FINDING } = await import('./linkage.js');
  const stats = { blocked: 2, trackers: { 'doubleclick.net': 2 } };
  const gpcOf = (site, ctx) =>
    siteReport(site, stats, ctx).findings.find((f) => f.kind === FINDING.GPC);

  const shipped = gpcOf('usaa.com', { gpcSent: false, gpcExcepted: true, gpcUserExcepted: false });
  assert.equal(shipped.remedy.action, null,
    'GPC is already on globally on a shipped-exception host — "Turn on Global Privacy Control" is a button that does nothing');
  assert.match(shipped.remedy.text, /everywhere else/i);

  const mine = gpcOf('bank.test', { gpcSent: false, gpcExcepted: true, gpcUserExcepted: true });
  assert.equal(mine.remedy.action, 'enable-gpc-site', 'the user\'s own exception is undoable, and the remedy should say so');

  const globallyOff = gpcOf('bank.test', { gpcSent: false, gpcExcepted: false });
  assert.equal(globallyOff.remedy.action, 'enable-gpc');

  assert.ok(/case 'enable-gpc-site'/.test(POPUP_JS), 'the popup must know what to do with the new action');
});

test('G4: the report says whether the exception is the USER\'s or one Nullecho ships', () => {
  const BG = read('src/background.js');
  assert.ok(/userExcepted/.test(BG),
    'the popup cannot offer to undo a shipped breakage exception it cannot distinguish');
});

// ═══════════════════════════════════════════════════════════════════════════
// G10 + residency framing — the copy
// ═══════════════════════════════════════════════════════════════════════════

const OPTIONS_HTML = read('options/options.html');
const LINKAGE = read('src/linkage.js');

test('G10: the settings page discloses that the opt-out covers this browser profile only (CO Rule 5.03(A)(3)(b))', () => {
  const gpcNote = OPTIONS_HTML.slice(OPTIONS_HTML.indexOf('id="gpc"'));
  const scope = gpcNote.slice(0, 2000);
  assert.ok(/this browser profile only/i.test(scope),
    'Colorado names "applies only to a single browser or device" as its own example of a limitation '
    + 'the PROVIDER must disclose; every "this device" line in the extension is about where data is STORED');
  assert.ok(/phone|other browsers/i.test(scope), 'say what else the user would have to do');
});

test('G10: the copy widens the signal past "do not sell" to the rights it actually exercises', () => {
  const scope = OPTIONS_HTML.slice(OPTIONS_HTML.indexOf('id="gpc"')).slice(0, 2000);
  assert.ok(/opt-out rights available to you under state laws/i.test(scope),
    'CO Rule 5.03(A)(4)(a) blesses this exact state-agnostic phrasing, which also sidesteps the count problem');
});

/**
 * Copy only. Comments in these files discuss the law at length and must not be
 * mistaken for what the user reads — scraping them is how a copy test passes or
 * fails for the wrong reason.
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
  .replace(/<!--[\s\S]*?-->/g, '');

test('residency: "legally binding" is framed as a fact about the USER, not about the site', () => {
  const claims = [...stripComments(LINKAGE).matchAll(/'([^']*legal[^']*)'/gi)].map((m) => m[1])
    .concat([...stripComments(OPTIONS_HTML).matchAll(/([^<>]*legally[^<>]*)/gi)].map((m) => m[1]))
    .concat([...stripComments(POPUP_JS).matchAll(/'([^']*legal[^']*)'/gi)].map((m) => m[1]))
    .filter((c) => /\S/.test(c));
  assert.ok(claims.length >= 3, `no GPC legal copy found — did the strings move? (${claims.length})`);
  for (const c of claims) {
    assert.ok(/you live|your state/i.test(c),
      `a duty that attaches to the consumer's residency is written as a property of the site: "${c.trim()}"`);
  }
});

test('residency: no count of states appears anywhere in the user-facing GPC copy', () => {
  // Eleven states are verified in gpc.md §2.1 and NINE were never reached (§2.7).
  // "12 states" circulates in vendor marketing and is not supported.
  const files = [
    ['linkage.js', LINKAGE], ['options.html', OPTIONS_HTML],
    ['popup.html', POPUP_HTML], ['popup.js', POPUP_JS],
  ];
  for (const [label, src] of files) {
    const hits = [...stripComments(src).matchAll(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:US\s+)?states\b/gi)];
    assert.deepEqual(hits.map((h) => h[0]), [], `${label} puts a number on the states`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// isCalifornian — read in three places, written in none
// ═══════════════════════════════════════════════════════════════════════════

test('isCalifornian: it is a real setting with a shipped default, not a demo-only key', async () => {
  const { DEFAULT_SETTINGS } = await import('./protocol.js');
  assert.ok('isCalifornian' in DEFAULT_SETTINGS,
    'every branch on it was dead in the shipped extension: only popup.js\'s DEMO fixture set it');
  assert.equal(DEFAULT_SETTINGS.isCalifornian, false,
    'a California-only step must not be shown to everyone');
});

test('isCalifornian: a shipped (non-demo) state can turn the DROP nudge on', async () => {
  const { remedyFor, siteReport, FINDING } = await import('./linkage.js');
  const { DEFAULT_SETTINGS } = await import('./protocol.js');

  const graph = { totalSites: 4, linkers: [{ owner: 'Google', reach: 3 }] };
  const base = {
    blockingEnabled: true,
    gpcEnabled: true,
    dropFiled: false,
    ...DEFAULT_SETTINGS,
  };
  assert.notEqual(remedyFor(graph, { ...base }).action, 'open-drop',
    'the default must not push a California-only step at everyone');

  const settings = { ...DEFAULT_SETTINGS, isCalifornian: true };
  assert.equal(
    remedyFor(graph, { ...base, isCalifornian: !!settings.isCalifornian }).action,
    'open-drop',
    'with the setting on, the nudge must be reachable without the demo fixture',
  );

  // …and the same flag reaches the per-site report's GPC finding.
  const report = siteReport('example.test', { blocked: 3, trackers: { 'doubleclick.net': 3 } }, {
    gpcSent: true,
    isCalifornian: true,
    dropFiled: false,
  });
  const gpc = report.findings.find((f) => f.kind === FINDING.GPC);
  assert.equal(gpc.remedy.action, 'open-drop');
});

test('isCalifornian: the options page owns the control that writes it', () => {
  const OPTIONS_JS = read('options/options.js');
  assert.ok(/id="is-californian"/.test(OPTIONS_HTML), 'no control writes the setting');
  assert.ok(/I live in California/i.test(OPTIONS_HTML), 'the control must say what it is for');
  assert.ok(/isCalifornian:\s*e\.target\.checked|patchSettings\(\{\s*isCalifornian/.test(OPTIONS_JS),
    'the control must persist through SET_SETTINGS, not just render');
});
