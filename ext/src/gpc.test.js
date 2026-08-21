/**
 * Nullecho — Global Privacy Control tests
 * ────────────────────────────────────
 * `gpc.js` is one file that runs in two very different contexts, so both are
 * exercised here:
 *
 *   worker half — owns the `gpc` ruleset and the per-site exception rules.
 *                 The exception rules must be `modifyHeaders` removes, NOT
 *                 `allow` rules: DNR priorities are global, so an allow rule
 *                 would switch off ad/analytics/social blocking on that site
 *                 too. That is the single most important assertion in here.
 *
 *   page half   — sets `navigator.globalPrivacyControl`, then corrects itself
 *                 from the persona handshake. The correction path is what keeps
 *                 the JS property and the Sec-GPC header telling the same story.
 *
 * The two halves are loaded as separate module instances (a `?query` busts the
 * ESM cache), because the context check runs once at module evaluation.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GPC_RULESET = path.resolve(HERE, '../rules/gpc.json');

// ═══════════════════════════════════════════════════════════════════════════
// worker half
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
      for (const id of enableRulesetIds) {
        if (!enabledRulesets.includes(id)) enabledRulesets.push(id);
      }
    },
  },
};

// Serve the real shipped ruleset, so these tests fail if gpc.json changes shape.
globalThis.fetch = async (url) => {
  assert.equal(url, 'stub:rules/gpc.json');
  const text = fs.readFileSync(GPC_RULESET, 'utf8');
  return { async json() { return JSON.parse(text); } };
};

await import('./gpc.js');
const GPC = globalThis.NullechoGPC;

test('the worker half exposes a control surface', () => {
  assert.equal(typeof GPC.setEnabled, 'function');
  assert.equal(typeof GPC.setSiteException, 'function');
  assert.equal(typeof GPC.isExceptedSync, 'function');
  assert.equal(GPC.HEADER_RULE_ID, 5000);
});

test('the shipped breakage list is read back out of the ruleset we actually ship', async () => {
  const shipped = await GPC.shippedExceptions();
  assert.ok(shipped.length >= 40, `only ${shipped.length} shipped exceptions`);
  // USAA is the documented canary: it answers a GPC signal with
  // "Enable Cookies. Please enable cookies in your browser to access USAA."
  assert.ok(shipped.includes('usaa.com'));
});

test('a site exception emits a header REMOVE, never an allow rule', async () => {
  await GPC.setSiteException('www.Example-Bank.com', true);

  const rules = [...dynamicRules.values()];
  assert.equal(rules.length, 1);
  const [rule] = rules;

  assert.equal(rule.action.type, 'modifyHeaders',
    'an allow rule here would also unblock every tracker on the site');
  assert.equal(rule.action.requestHeaders[0].header, 'Sec-GPC');
  assert.equal(rule.action.requestHeaders[0].operation, 'remove');
  assert.ok(rule.priority > 1, 'must outrank rule 5000 to suppress it');
  assert.ok(rule.id >= 1_100_000 && rule.id < 1_101_000,
    `id ${rule.id} outside the reserved GPC exception range`);
});

test('exception hosts are normalised', async () => {
  const list = await GPC.userExceptions();
  assert.deepEqual(list, ['example-bank.com'], 'www. and case should be stripped');
});

test('the exception covers the site as both request and initiator', async () => {
  const [rule] = [...dynamicRules.values()];
  // main_frame navigation matches on requestDomains; subresources on the page
  // match on initiatorDomains. Missing either leaks the header.
  assert.deepEqual(rule.condition.requestDomains, ['example-bank.com']);
  assert.deepEqual(rule.condition.initiatorDomains, ['example-bank.com']);
  assert.ok(rule.condition.resourceTypes.includes('main_frame'),
    'the top-level navigation is where sites look for the signal');
});

test('isExceptedSync answers for the host and its subdomains', () => {
  assert.equal(GPC.isExceptedSync('example-bank.com'), true);
  assert.equal(GPC.isExceptedSync('secure.example-bank.com'), true);
  assert.equal(GPC.isExceptedSync('www.example-bank.com'), true);
  assert.equal(GPC.isExceptedSync('example-bank.com.evil.test'), false);
  assert.equal(GPC.isExceptedSync('unrelated.test'), false);
});

test('removing an exception drops its rule', async () => {
  await GPC.setSiteException('example-bank.com', false);
  assert.equal(dynamicRules.size, 0);
  assert.equal(GPC.isExceptedSync('example-bank.com'), false);
});

test('exceptions persist under the namespaced storage key', async () => {
  await GPC.setSiteException('persisted.test', true);
  assert.deepEqual(store['nullecho:gpc:v1'], { exceptions: ['persisted.test'] });
  await GPC.setSiteException('persisted.test', false);
});

test('setEnabled toggles only the gpc ruleset', async () => {
  await GPC.setEnabled(false);
  assert.equal(await GPC.isEnabled(), false);
  assert.deepEqual(enabledRulesets, ['ads', 'analytics', 'social', 'fingerprinting'],
    'toggling GPC must not disturb the blocking categories');

  await GPC.setEnabled(true);
  assert.equal(await GPC.isEnabled(), true);
});

test('isEnabledForSite is false while GPC is globally off', async () => {
  await GPC.setEnabled(false);
  assert.equal(await GPC.isEnabledForSite('anything.test'), false);
  await GPC.setEnabled(true);
  assert.equal(await GPC.isEnabledForSite('anything.test'), true);
});

test('isEnabledForSite honours the shipped breakage list', async () => {
  assert.equal(await GPC.isEnabledForSite('usaa.com'), false);
  assert.equal(await GPC.isEnabledForSite('www.usaa.com'), false);
});

// ═══════════════════════════════════════════════════════════════════════════
// page half
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The page half applies its config exactly once, authenticated by the nonce it
 * publishes at document_start (src/protocol.js, "THE NONCE HANDSHAKE"). So each
 * scenario needs a fresh module instance rather than a fresh event — which is
 * also a fair model of the real thing, where the loader delivers once per
 * document.
 *
 * `?page=<tag>` busts the ESM cache. The status listener must be registered
 * BEFORE the import, because gpc.js publishes its nonce synchronously during
 * module evaluation — exactly as shim-loader.js has its listeners in place
 * before the MAIN-world scripts run.
 */
let pageInstance = 0;
async function freshPage() {
  delete globalThis.chrome;
  delete globalThis.NullechoGPC;

  class Navigator {}
  const doc = new EventTarget();

  for (const [name, value] of [['Navigator', Navigator], ['document', doc]]) {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: Object.create(Navigator.prototype), configurable: true, writable: true,
  });

  let boot = null;
  doc.addEventListener('nullecho:status', (e) => {
    const d = JSON.parse(e.detail);
    if (d.phase === 'boot' && d.channel === 'gpc') boot = d;
  }, true);

  await import(`./gpc.js?page=${++pageInstance}`);

  const send = (payload) => doc.dispatchEvent(new CustomEvent('nullecho:persona', {
    detail: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }));

  return { doc, Navigator, boot, send, nav: globalThis.navigator };
}

test('page half: the signal is up before any handshake', async () => {
  const { Navigator, nav } = await freshPage();
  // A site that fingerprints in an inline <script> in <head> must already see it.
  assert.equal(nav.globalPrivacyControl, true);

  const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl');
  assert.ok(desc, 'not defined on Navigator.prototype');
  assert.equal(typeof desc.get, 'function');
  assert.equal(desc.configurable, true, 'must stay configurable or we cannot walk it back');
  assert.equal(desc.enumerable, true);
});

test('page half: it publishes a boot nonce, once, on the gpc channel', async () => {
  const { boot } = await freshPage();
  assert.ok(boot, 'gpc.js published no boot event, so the loader can never authenticate to it');
  assert.equal(boot.channel, 'gpc');
  assert.equal(typeof boot.nonce, 'string');
  assert.match(boot.nonce, /^[0-9a-f]{32}$/, '128 bits of hex from crypto.getRandomValues');
});

test('page half: an authenticated gpc:false takes the signal back down', async () => {
  const { boot, send, nav } = await freshPage();
  send({ ok: true, enabled: true, gpc: false, site: 'usaa.com', persona: {}, gpcNonce: boot.nonce });
  assert.equal(nav.globalPrivacyControl, undefined);
});

test('page half: an authenticated allowlist stand-down drops the signal too', async () => {
  // The per-site allowlist emits allowAllRequests at priority 100000, which
  // suppresses the Sec-GPC header. The property has to agree.
  const { boot, send, nav } = await freshPage();
  send({ ok: true, enabled: false, gpc: true, site: 'a.test', persona: null, gpcNonce: boot.nonce });
  assert.equal(nav.globalPrivacyControl, undefined);
});

test('page half: an authenticated gpc:true leaves the signal up', async () => {
  const { boot, send, nav } = await freshPage();
  send({ ok: true, enabled: true, gpc: true, site: 'a.test', persona: {}, gpcNonce: boot.nonce });
  assert.equal(nav.globalPrivacyControl, true);
});

test('page half: a hostile page cannot switch GPC off without the nonce', async () => {
  // GPC is the piece of Nullecho with statutory teeth (DECISIONS.md D6). The party
  // the signal is aimed at is precisely the party running script on the page, so
  // "the site can delete its own do-not-sell signal" is not an acceptable gap.
  const { boot, send, nav } = await freshPage();

  for (const forged of [
    { ok: true, enabled: true, gpc: false },                      // no nonce at all
    { ok: true, enabled: false, gpc: true },                      // stand-down, no nonce
    { ok: true, gpc: false, gpcNonce: 'f'.repeat(32) },           // wrong nonce, right shape
    { ok: true, gpc: false, gpcNonce: boot.nonce.slice(0, 16) },  // prefix of the real one
    { ok: true, gpc: false, gpcNonce: null },
    { ok: true, gpc: false, gpcNonce: { toString: () => boot.nonce } }, // not a string
  ]) {
    send(forged);
    assert.equal(nav.globalPrivacyControl, true, `forgery got through: ${JSON.stringify(forged)}`);
  }

  // …and the real handshake still works afterwards: a rejected forgery must not
  // consume the one-shot, or shouting first becomes a denial-of-service.
  send({ ok: true, enabled: true, gpc: false, site: 'a.test', gpcNonce: boot.nonce });
  assert.equal(nav.globalPrivacyControl, undefined);
});

test('page half: the config is applied once; a replay of the real payload is ignored', async () => {
  const { boot, send, nav } = await freshPage();
  const real = { ok: true, enabled: true, gpc: false, site: 'a.test', gpcNonce: boot.nonce };
  send(real);
  assert.equal(nav.globalPrivacyControl, undefined);
  send({ ...real, gpc: true });   // same nonce, opposite instruction
  assert.equal(nav.globalPrivacyControl, undefined, 'a replay moved the signal');
});

test('page half: malformed payloads are ignored, not obeyed', async () => {
  const { send, nav } = await freshPage();
  for (const bad of ['not json{', 'null', '"a string"', '42']) {
    send(bad);
    assert.equal(nav.globalPrivacyControl, true, `payload ${bad} changed the signal`);
  }
});

test('page half: the page half leaks no global', async () => {
  await freshPage();
  assert.equal(globalThis.NullechoGPC, undefined,
    'a Nullecho global on window is itself a fingerprinting surface');
});
