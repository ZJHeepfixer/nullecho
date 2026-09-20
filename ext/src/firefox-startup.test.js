/**
 * Nullecho — Firefox startup guard (docs/DECISIONS.md D42)
 * ─────────────────────────────────────────────────────
 * On Firefox the background module used to die on the first line of §1.
 * `heuristics.install()` passed `'extraHeaders'` to
 * `webRequest.onBeforeSendHeaders.addListener`; Firefox's schema check threw
 * synchronously (`Invalid enumeration value "extraHeaders"`), and the top-level
 * evaluation of background.js stopped before `chrome.runtime.onMessage` was
 * registered. Every GET_PERSONA then went unanswered: every page ran on the
 * fallback persona, the per-site allowlist never reached the page, and the GPC
 * toggle could not take `navigator.globalPrivacyControl` down. Blocking kept
 * working, because DNR is declarative — which is why it looked fine.
 *
 * `chrome` here is shaped like Firefox 156's: `extraInfoSpec` rejects
 * `extraHeaders` the way the real engine does, message verbatim. Everything
 * else is the stub background.test.js uses. Its own file because background.js
 * is imported once per process and the failure was at import time.
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

// ── a Firefox-shaped `chrome`, installed before the module under test loads ─

const store = {};
const onMessage = [];
const observers = {};   // event name → extraInfoSpec the engine accepted

const noopEvent = () => ({ addListener() {} });

/** Firefox 156: the enum has no `extraHeaders`; the check throws out of `addListener`. */
const firefoxEvent = (name) => ({
  addListener(_fn, _filter, spec) {
    const i = (spec ?? []).indexOf('extraHeaders');
    if (i >= 0) {
      throw new Error(
        `Type error for parameter extraInfoSpec (Error processing ${i}: ` +
        `Invalid enumeration value "extraHeaders") for webRequest.${name}.`,
      );
    }
    observers[name] = spec;
  },
});

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
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const k of list) if (k in store) out[k] = store[k];
        return out;
      },
      async set(obj) { Object.assign(store, structuredClone(obj)); },
    },
  },
  alarms: { onAlarm: noopEvent(), async create() {}, async clear() {} },
  webRequest: {
    onBeforeRequest: firefoxEvent('onBeforeRequest'),
    onBeforeSendHeaders: firefoxEvent('onBeforeSendHeaders'),
    onHeadersReceived: firefoxEvent('onHeadersReceived'),
  },
  declarativeNetRequest: {
    async getDynamicRules() { return []; },
    async updateDynamicRules() {},
    async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'gpc']; },
    async updateEnabledRulesets() {},
    async updateStaticRules() {},
    async getMatchedRules() { return { rulesMatchedInfo: [] }; },
    onRuleMatchedDebug: noopEvent(),
  },
};

globalThis.fetch = async (url) => {
  const file = String(url).replace(/^file:\/\//, '');
  return { async json() { return JSON.parse(fs.readFileSync(file, 'utf8')); } };
};

let importError = null;
try {
  await import('./background.js');
} catch (e) {
  importError = e;
}

/** Send a message the way a content script does, and await the reply. */
function send(message, sender) {
  return new Promise((resolve, reject) => {
    for (const fn of onMessage) {
      if (fn(message, sender, resolve) === true) return;
    }
    reject(new Error(`nothing handled ${message?.type}`));
  });
}

// ── the guards ─────────────────────────────────────────────────────────────

test('background.js finishes evaluating on an engine that rejects extraHeaders', () => {
  assert.equal(importError, null, `background.js threw at import: ${importError?.message}`);
});

test('the message surface comes up, and GET_PERSONA answers ok:true with a persona for the page', async () => {
  assert.equal(onMessage.length, 1, 'exactly one runtime.onMessage listener, registered synchronously');
  const res = await send({ type: MSG.GET_PERSONA }, { url: 'https://news.example/', origin: 'https://news.example' });
  assert.equal(res.ok, true);
  assert.equal(res.site, 'news.example');
  assert.equal(res.enabled, true);
  assert.equal(res.gpc, true);
  assert.equal(typeof res.persona, 'object');
  assert.notEqual(res.persona, null);
});

test('both cookie observers are registered, without extraHeaders, on that engine', () => {
  assert.deepEqual(observers.onBeforeSendHeaders, ['requestHeaders']);
  assert.deepEqual(observers.onHeadersReceived, ['responseHeaders']);
  assert.equal(observers.onBeforeRequest, undefined, 'a URL-only observer is the A5 hole');
});
