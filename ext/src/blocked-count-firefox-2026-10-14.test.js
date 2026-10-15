/**
 * D55 (2026-10-14) — "blocked on this page" in Firefox, where neither `getMatchedRules` nor
 * `onRuleMatchedDebug` exists (Firefox 156's declarative_net_request schema has neither; its
 * `testMatchOutcome` needs the `extensions.dnr.feedback` pref, which no user sets).
 *
 * Measured in real Firefox 156 (instrumented copy, D55): DNR runs after the webRequest listeners, and a
 * request Nullecho's rule cancels reaches `webRequest.onErrorOccurred` with `error: "NS_ERROR_ABORT"`
 * (ExtensionDNR `applyBlock()`), `documentUrl` / `originUrl` naming the page and `thirdParty: true`.
 * A page aborting its own fetch reports `NS_BINDING_ABORTED`. Firefox's speculative preloader asks
 * for each script twice, and both requests are cancelled — seven aborts for four <script> tags — so
 * Firefox's count is of REQUESTS, as the label says.
 *
 * Run against the 0.9.2-before-D55 background: every test here fails (0 everywhere).
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MSG } from './protocol.js';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = {};
const session = {};
const onMessage = [];
const errorListeners = [];
const noopEvent = () => ({ addListener() {} });

globalThis.chrome = {
  runtime: { id: 'test', getURL: (p) => `file://${path.join(EXT, p)}`, onMessage: { addListener: (fn) => onMessage.push(fn) }, onInstalled: noopEvent(), onStartup: noopEvent() },
  storage: {
    local: { async get(keys) { const o = {}; for (const k of [].concat(keys)) if (k in store) o[k] = structuredClone(store[k]); return o; }, async set(obj) { Object.assign(store, structuredClone(obj)); } },
    session: { async get(keys) { const o = {}; for (const k of [].concat(keys)) if (k in session) o[k] = structuredClone(session[k]); return o; }, async set(obj) { Object.assign(session, structuredClone(obj)); } },
  },
  alarms: { onAlarm: noopEvent(), async create() {}, async clear() {} },
  tabs: { onRemoved: noopEvent() },
  webRequest: {
    onBeforeSendHeaders: noopEvent(), onHeadersReceived: noopEvent(), onSendHeaders: noopEvent(),
    onErrorOccurred: { addListener: (fn) => errorListeners.push(fn) },
  },
  declarativeNetRequest: {
    async getDynamicRules() { return []; },
    async updateDynamicRules() {},
    async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'gpc', 'ua-mac']; },
    async updateEnabledRulesets() {},
    async updateStaticRules() {},
    async getDisabledRuleIds() { return []; },
    // Firefox 156: no getMatchedRules, no onRuleMatchedDebug.
  },
};
globalThis.fetch = async (url) => {
  const file = String(url).replace(/^file:\/\//, '');
  return { async json() { return JSON.parse(fs.readFileSync(file, 'utf8')); } };
};

await import('./background.js');

const send = (message) => new Promise((resolve, reject) => {
  for (const fn of onMessage) if (fn(message, {}, resolve) === true) return;
  reject(new Error(`nothing handled ${message?.type}`));
});
const page = 'http://127.0.0.1:55524/';
async function aborted(url, error = 'NS_ERROR_ABORT') {
  for (const fn of errorListeners) fn({ url, error, type: 'script', tabId: 2, frameId: 0, documentUrl: page, originUrl: page, thirdParty: true });
  await new Promise((r) => setTimeout(r, 30));
}

test('FIREFOX: the measured run — seven NS_ERROR_ABORTs for four tracker scripts — is "7 blocked on this page", from Nullecho\'s tally', async () => {
  const sequence = [
    'https://www.google-analytics.com/analytics.js', 'https://connect.facebook.net/en_US/fbevents.js',
    'https://securepubads.g.doubleclick.net/tag/js/gpt.js', 'https://cdn.amplitude.com/libs/amplitude-8.21.9-min.gz.js',
    'https://connect.facebook.net/en_US/fbevents.js', 'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
    'https://cdn.amplitude.com/libs/amplitude-8.21.9-min.gz.js',
  ];
  for (const u of sequence) await aborted(u);
  await aborted('http://127.0.0.1:55524/slow', 'NS_BINDING_ABORTED');   // the page's own AbortController
  await aborted('https://static.example-cdn.net/lib.js');                // cancelled, but by no rule of ours
  const r = await send({ type: MSG.GET_SITE_REPORT, url: page, tabId: 2 });
  assert.equal(r.live.source, 'webRequest');
  assert.equal(r.live.error, null, 'Firefox has no getMatchedRules to fail; the tally IS the source');
  assert.equal(r.live.total, 7);
  // analytics.js once and the amplitude script twice (rules 2000, 2004), fbevents twice, gpt twice.
  assert.deepEqual(r.live.byCategory, { analytics: 3, social: 2, ads: 2 });
});

test('FIREFOX: the lifetime per-site counters are real too — blocked count, categories, tracker domains', async () => {
  const r = await send({ type: MSG.GET_SITE_REPORT, url: page, tabId: 2 });
  assert.equal(r.lifetimeSource, 'webRequest');
  assert.equal(r.stats.blocked, 7);
  assert.deepEqual(r.stats.trackers.map((t) => t.domain).sort(), ['amplitude.com', 'doubleclick.net', 'facebook.net', 'google-analytics.com']);
});
