/**
 * Nullecho — the service worker must BOOT on Firefox
 * ═══════════════════════════════════════════════════
 * `heuristics.install()` passed Chrome's `extraHeaders` in the `extraInfoSpec` of
 * `webRequest.onBeforeSendHeaders`. Firefox rejects the value outright —
 *
 *   Type error for parameter extraInfoSpec (Error processing 1: Invalid
 *   enumeration value "extraHeaders") for webRequest.onBeforeSendHeaders.
 *
 * — the throw propagates through `background.js`'s top level, so
 * `runtime.onMessage.addListener` further down is NEVER REACHED: every
 * `GET_PERSONA` answers "Could not establish connection. Receiving end does not
 * exist.", the loader falls back, and the extension has been in permanent
 * fallback on every Firefox page for as long as there has been a Firefox
 * manifest. Measured before and after in Firefox 156 — DECISIONS.md D42.
 *
 * The rule these tests pin: **nothing on the service worker's top-level path may
 * throw.** A listener we cannot register costs one feature; a throw costs the
 * whole extension, message surface first.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MSG } from './protocol.js';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every listener any stub registered, so a test can prove registration happened. */
const registered = { message: [], beforeSendHeaders: [], headersReceived: [], ruleMatched: [] };
const store = {};

/**
 * Firefox 156's own behaviour, reproduced: no `OnBeforeSendHeadersOptions`
 * enum at all, and `addListener` THROWS when the spec carries `extraHeaders`.
 * Firefox does not need the option — unlike Chrome it shows Cookie /
 * Set-Cookie in the ordinary `requestHeaders` view — so dropping it costs the
 * heuristics layer nothing there.
 */
function firefoxWebRequest() {
  const reject = (bucket) => ({
    addListener(fn, filter, spec) {
      for (const opt of spec ?? []) {
        if (opt === 'extraHeaders') {
          throw new Error('Type error for parameter extraInfoSpec (Error processing 1: '
            + 'Invalid enumeration value "extraHeaders") for webRequest.onBeforeSendHeaders.');
        }
      }
      bucket.push({ fn, filter, spec });
    },
  });
  return {
    // NOTE: no OnBeforeSendHeadersOptions / OnHeadersReceivedOptions.
    onBeforeSendHeaders: reject(registered.beforeSendHeaders),
    onHeadersReceived: reject(registered.headersReceived),
  };
}

/** Chrome 147: the enum exists and carries EXTRA_HEADERS. */
function chromeWebRequest() {
  const accept = (bucket) => ({
    addListener(fn, filter, spec) { bucket.push({ fn, filter, spec }); },
  });
  return {
    OnBeforeSendHeadersOptions: { REQUEST_HEADERS: 'requestHeaders', EXTRA_HEADERS: 'extraHeaders' },
    OnHeadersReceivedOptions: { RESPONSE_HEADERS: 'responseHeaders', EXTRA_HEADERS: 'extraHeaders' },
    onBeforeSendHeaders: accept(registered.beforeSendHeaders),
    onHeadersReceived: accept(registered.headersReceived),
  };
}

const noopEvent = () => ({ addListener() {} });

function extensionApis(webRequest) {
  return {
    runtime: {
      id: 'firefox-parity-test',
      getURL: (p) => `file://${path.join(EXT, p)}`,
      onMessage: { addListener: (fn) => registered.message.push(fn) },
      onInstalled: noopEvent(),
      onStartup: noopEvent(),
      openOptionsPage() {},
    },
    storage: {
      local: {
        async get(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          const out = {};
          for (const k of list) if (k in store) out[k] = store[k];
          return out;
        },
        async set(obj) { Object.assign(store, structuredClone(obj)); },
      },
    },
    alarms: { onAlarm: noopEvent(), async create() {}, async clear() {} },
    webRequest,
    declarativeNetRequest: {
      async getDynamicRules() { return []; },
      async updateDynamicRules() {},
      async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'gpc']; },
      async updateEnabledRulesets() {},
      async updateStaticRules() {},
      async getDisabledRuleIds() { return []; },
      async getMatchedRules() { return { rulesMatchedInfo: [] }; },
      // Firefox does not implement onRuleMatchedDebug; background.js already
      // guards it with `?.`, and its absence here keeps that guard honest.
    },
  };
}

// The module graph is imported ONCE per test file, and this is the import that
// used to die. Boot it the way Firefox does.
globalThis.chrome = extensionApis(firefoxWebRequest());
globalThis.fetch = async (url) => {
  const file = String(url).replace(/^file:\/\//, '');
  return { async json() { return JSON.parse(fs.readFileSync(file, 'utf8')); } };
};

const heuristics = await import('./heuristics.js');
await import('./background.js');

function send(message, sender = {}) {
  return new Promise((resolve, reject) => {
    for (const fn of registered.message) {
      if (fn(message, sender, resolve) === true) return;
    }
    reject(new Error(`nothing handled ${message?.type}`));
  });
}

test('a browser that rejects `extraHeaders` still gets a booted background — onMessage IS registered', () => {
  assert.ok(
    registered.message.length > 0,
    'REGRESSION: importing background.js under a Firefox-shaped webRequest registered NO runtime.onMessage '
    + 'listener. That is the whole defect: the throw in heuristics.install() happens above the listener, so '
    + 'every GET_PERSONA answers "Receiving end does not exist" and the extension is in permanent fallback.',
  );
});

test('both webRequest listeners are registered, without the Chrome-only option', () => {
  assert.equal(registered.beforeSendHeaders.length, 1, 'onBeforeSendHeaders listener missing');
  assert.equal(registered.headersReceived.length, 1, 'onHeadersReceived listener missing');
  assert.deepEqual(registered.beforeSendHeaders[0].spec, ['requestHeaders']);
  assert.deepEqual(registered.headersReceived[0].spec, ['responseHeaders']);
});

test('GET_PERSONA answers ok:true on that browser (it answered ok:false — no receiver — before)', async () => {
  const res = await send({ type: MSG.GET_PERSONA }, { url: 'https://example.test/page' });
  assert.equal(res.ok, true, `GET_PERSONA → ${JSON.stringify(res)}`);
  assert.equal(res.site, 'example.test');
  assert.ok(res.persona && typeof res.persona.id === 'string', 'no persona in the answer');
});

test('CONTROL: on Chrome the option is still passed — the fix is a feature detect, not a removal', () => {
  registered.beforeSendHeaders.length = 0;
  registered.headersReceived.length = 0;
  const saved = globalThis.chrome;
  globalThis.chrome = extensionApis(chromeWebRequest());
  try {
    heuristics.install();
  } finally {
    globalThis.chrome = saved;
  }
  assert.deepEqual(registered.beforeSendHeaders[0].spec, ['requestHeaders', 'extraHeaders'],
    'Chrome needs extraHeaders to see Cookie/Set-Cookie at all — dropping it everywhere would gut the heuristics');
  assert.deepEqual(registered.headersReceived[0].spec, ['responseHeaders', 'extraHeaders']);
});

test('install() never throws, even when the browser refuses BOTH specs', () => {
  registered.beforeSendHeaders.length = 0;
  const hostile = {
    onBeforeSendHeaders: { addListener() { throw new Error('no webRequest for you'); } },
    onHeadersReceived: { addListener() { throw new Error('no webRequest for you'); } },
  };
  const saved = globalThis.chrome;
  globalThis.chrome = extensionApis(hostile);
  try {
    assert.doesNotThrow(() => heuristics.install(),
      'a webRequest failure must never reach background.js top level — the message surface is registered below it');
  } finally {
    globalThis.chrome = saved;
  }
});

test('install() survives a browser with no webRequest at all', () => {
  const saved = globalThis.chrome;
  globalThis.chrome = extensionApis(undefined);
  try {
    assert.doesNotThrow(() => heuristics.install());
  } finally {
    globalThis.chrome = saved;
  }
});

test('LINT: `extraHeaders` is named once, as a constant behind the feature detect — never in a spec literal', () => {
  const src = fs.readFileSync(path.join(EXT, 'src/heuristics.js'), 'utf8');
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const hits = bare.match(/'extraHeaders'/g) ?? [];
  assert.equal(hits.length, 1,
    `'extraHeaders' should appear exactly once in code (the EXTRA_HEADERS constant); found ${hits.length}`);
  assert.match(bare, /const EXTRA_HEADERS = 'extraHeaders';/);
  assert.match(bare, /\['requestHeaders'\]/, 'the base spec must be portable');
  assert.match(bare, /\['responseHeaders'\]/);
  assert.equal(/\['requestHeaders', *'extraHeaders'\]/.test(bare), false,
    'REGRESSION: the Chrome-only option is back in a spec literal — that is the Firefox kill switch');
});
