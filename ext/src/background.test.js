/**
 * Nullecho — blocked-request accounting tests
 * ────────────────────────────────────────
 * The popup's "requests blocked" is one of the two numbers docs/THREAT-MODEL.md
 * lets the UI put on screen, on the grounds that Nullecho literally counted it. That
 * only holds if the counter counts blocks and nothing else — and the DNR match
 * APIs make that easy to get wrong, because they report EVERY rule that acted on
 * a request and never say what the action was:
 *
 *   - `gpc.json` rule 5000 sets Sec-GPC on nearly every request. Counted, it
 *     turns "requests blocked" into "requests made" and fills "Blocked domains"
 *     with every domain the page contacted — the first party included, since the
 *     rule matches main_frame.
 *   - The allowlist's `allowAllRequests` rules fire precisely on the sites the
 *     user switched Nullecho OFF for.
 *   - The heuristic yellowlist strips cookies and lets the request through.
 *
 * `chrome` is stubbed, so this drives the real listeners in background.js —
 * including the message surface the popup talks to.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MSG, ALLOW_RULE_ID_BASE, DYNAMIC_RULE_RANGES, CATEGORY_LABELS } from './protocol.js';
import { hostFamily, FAMILIES } from './personas.js';
import { UA_RULESETS as GENERATED_UA_RULESETS } from '../rules/gen-ua.mjs';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── stub the extension APIs before importing the module under test ─────────

/**
 * Seeded before `background.js` reads storage: a site record in the shape an
 * earlier build persisted, with no cookie-strip fields. `init()` runs once at
 * import, so this is the only moment it can be planted.
 */
const store = {
  stats: {
    'legacy.example': {
      blocked: 12, fp: 3, fpByApi: { canvas: 3 }, trackers: { 'doubleclick.net': 12 },
      byCategory: { ads: 12 }, lastSeen: 1, personaId: null, lastShimStatus: null,
    },
  },
};
const onMessage = [];
const onRuleMatched = [];
const enabledRulesetCalls = [];
let matchedRulesInfo = [];

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
    onBeforeRequest: noopEvent(),
    onBeforeSendHeaders: noopEvent(),
    onHeadersReceived: noopEvent(),
  },
  declarativeNetRequest: {
    async getDynamicRules() { return []; },
    async updateDynamicRules() {},
    async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'gpc']; },
    async updateEnabledRulesets(arg) { enabledRulesetCalls.push(arg); },
    async updateStaticRules() {},
    async getMatchedRules() { return { rulesMatchedInfo: matchedRulesInfo }; },
    onRuleMatchedDebug: { addListener: (fn) => onRuleMatched.push(fn) },
  },
};

globalThis.fetch = async (url) => {
  const file = String(url).replace(/^file:\/\//, '');
  return { async json() { return JSON.parse(fs.readFileSync(file, 'utf8')); } };
};

const BG = await import('./background.js');

// ── driving the stubs ──────────────────────────────────────────────────────

/** Send a message the way the popup does, and await the reply. */
function send(message, sender = {}) {
  return new Promise((resolve, reject) => {
    for (const fn of onMessage) {
      if (fn(message, sender, resolve) === true) return;
    }
    reject(new Error(`nothing handled ${message?.type}`));
  });
}

/** Fire `onRuleMatchedDebug` for one rule/request pair. */
async function matched(ruleId, rulesetId, { url, initiator }) {
  for (const fn of onRuleMatched) {
    await fn({ rule: { ruleId, rulesetId }, request: { url, initiator } });
  }
}

const DYNAMIC = '_dynamic';
const PAGE = 'https://news.example/politics';
const report = (site) => send({ type: MSG.GET_SITE_REPORT, url: `https://${site}/` });
const reset = () => send({ type: MSG.CLEAR_STATS });

const ADS_RULE = JSON.parse(fs.readFileSync(path.join(EXT, 'rules/ads.json'), 'utf8'))[0].id;
const HEURISTIC_BLOCK = DYNAMIC_RULE_RANGES.heuristicBlock[0];
const HEURISTIC_COOKIE = DYNAMIC_RULE_RANGES.heuristicCookie[0];
const GPC_EXCEPTION = DYNAMIC_RULE_RANGES.gpcException[0];

// ── stats written by an earlier build ──────────────────────────────────────
//
// Declared first, and deliberately does NOT reset: it is the only test that can
// see the seeded record, since `CLEAR_STATS` drops it for good.

test('a site record written before the cookie fields existed still counts', async () => {
  const before = await report('legacy.example');
  assert.equal(before.stats.blocked, 12);
  assert.equal(before.stats.cookieStripped, 0);
  assert.deepEqual(before.stats.cookieTrackers, []);

  // And it keeps accumulating, in both directions.
  await matched(ADS_RULE, 'ads', {
    url: 'https://adnxs.com/px', initiator: 'https://legacy.example/x',
  });
  await matched(HEURISTIC_COOKIE, DYNAMIC, {
    url: 'https://youtube.com/embed', initiator: 'https://legacy.example/x',
  });

  const after = await report('legacy.example');
  assert.equal(after.stats.blocked, 13);
  assert.equal(after.stats.cookieStripped, 1);
  assert.deepEqual(after.stats.cookieTrackers, [{ domain: 'youtube.com', count: 1 }]);
});

// ── what counts ────────────────────────────────────────────────────────────

test('a static block rule counts, under its own category', async () => {
  await reset();
  await matched(ADS_RULE, 'ads', { url: 'https://doubleclick.net/px', initiator: PAGE });

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 1);
  assert.deepEqual(stats.byCategory, { ads: 1 });
  assert.deepEqual(stats.trackers, [{ domain: 'doubleclick.net', count: 1 }]);
});

test('a heuristic block rule counts, and its domain reaches the blocked list', async () => {
  await reset();
  // The bug that started this: dynamic rules arrive under a synthetic ruleset id,
  // so nothing about `rulesetId` says which layer wrote them.
  await matched(HEURISTIC_BLOCK, DYNAMIC, { url: 'https://learned.example/t.gif', initiator: PAGE });

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 1);
  assert.deepEqual(stats.byCategory, { heuristic: 1 });
  assert.deepEqual(stats.trackers, [{ domain: 'learned.example', count: 1 }]);
});

test('the "heuristic" category has a label, so the popup never renders "_dynamic"', async () => {
  await reset();
  await matched(HEURISTIC_BLOCK, DYNAMIC, { url: 'https://learned.example/t.gif', initiator: PAGE });

  const { stats } = await report('news.example');
  for (const category of Object.keys(stats.byCategory)) {
    assert.ok(CATEGORY_LABELS[category], `"${category}" would show as a raw string`);
    assert.ok(!category.startsWith('_'), `"${category}" is Chrome's id, not ours`);
  }
});

// ── what must not count ────────────────────────────────────────────────────

test('the GPC header rule never counts as a blocked request', async () => {
  await reset();
  // Rule 5000 matches nearly every request on nearly every site.
  for (let i = 0; i < 25; i++) {
    await matched(5000, 'gpc', { url: `https://news.example/asset-${i}.js`, initiator: PAGE });
  }

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 0);
  assert.deepEqual(stats.trackers, []);
});

test('an allowlisted site reports zero, not one block per request', async () => {
  await reset();
  for (let i = 0; i < 10; i++) {
    await matched(ALLOW_RULE_ID_BASE, DYNAMIC, { url: `https://news.example/a-${i}`, initiator: PAGE });
  }

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 0);
});

test('a GPC per-site exception never counts', async () => {
  await reset();
  await matched(GPC_EXCEPTION, DYNAMIC, { url: 'https://news.example/x', initiator: PAGE });

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 0);
});

test('an unrecognised rule is ignored rather than guessed at', async () => {
  await reset();
  await matched(7_000_000, DYNAMIC, { url: 'https://news.example/x', initiator: PAGE });
  await matched(1234, 'not-a-ruleset', { url: 'https://news.example/y', initiator: PAGE });

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 0);
});

// ── cookie-stripping is a different outcome, counted separately ────────────

test('a cookie-strip is not counted as a blocked request', async () => {
  await reset();
  await matched(HEURISTIC_COOKIE, DYNAMIC, { url: 'https://youtube.com/embed', initiator: PAGE });

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 0, 'the request was answered, so it was not blocked');
  assert.equal(stats.cookieStripped, 1);
  assert.deepEqual(stats.cookieTrackers, [{ domain: 'youtube.com', count: 1 }]);
  assert.deepEqual(stats.trackers, [], 'must not appear under "Blocked domains"');
});

// ── the whole picture ──────────────────────────────────────────────────────

test('a realistic page load reports what was blocked, not what was requested', async () => {
  await reset();
  // 40 ordinary requests, each picking up the Sec-GPC header rule; 3 blocked ad
  // requests; 1 cookie-stripped embed; 1 anti-fraud `allow` exception.
  for (let i = 0; i < 40; i++) {
    await matched(5000, 'gpc', { url: `https://news.example/a-${i}.js`, initiator: PAGE });
  }
  for (const host of ['doubleclick.net', 'adnxs.com', 'criteo.com']) {
    await matched(5000, 'gpc', { url: `https://${host}/px`, initiator: PAGE });
    await matched(ADS_RULE, 'ads', { url: `https://${host}/px`, initiator: PAGE });
  }
  await matched(HEURISTIC_COOKIE, DYNAMIC, { url: 'https://youtube.com/embed', initiator: PAGE });
  await matched(4700, 'fingerprinting', { url: 'https://sift.com/f.js', initiator: PAGE });

  const { stats } = await report('news.example');
  assert.equal(stats.blocked, 3);
  assert.equal(stats.cookieStripped, 1);
  assert.deepEqual(stats.byCategory, { ads: 3, 'heuristic-cookie': 1 });
  assert.deepEqual(
    stats.trackers.map((t) => t.domain).sort(),
    ['adnxs.com', 'criteo.com', 'doubleclick.net'],
  );
});

test('attribution is to the page, not to the tracker', async () => {
  await reset();
  await matched(ADS_RULE, 'ads', {
    url: 'https://doubleclick.net/px',
    initiator: 'https://shop.example/cart',
  });

  assert.equal((await report('shop.example')).stats.blocked, 1);
  assert.equal((await report('doubleclick.net')).stats.blocked, 0);
});

// ── the packed-build fallback reads the same way ───────────────────────────

test('getMatchedRules() is filtered to blocks too', async () => {
  await reset();
  matchedRulesInfo = [
    { rule: { ruleId: 5000, rulesetId: 'gpc' } },
    { rule: { ruleId: 5000, rulesetId: 'gpc' } },
    { rule: { ruleId: ADS_RULE, rulesetId: 'ads' } },
    { rule: { ruleId: HEURISTIC_BLOCK, rulesetId: DYNAMIC } },
    { rule: { ruleId: HEURISTIC_COOKIE, rulesetId: DYNAMIC } },
    { rule: { ruleId: ALLOW_RULE_ID_BASE, rulesetId: DYNAMIC } },
  ];

  const { live } = await send({ type: MSG.GET_SITE_REPORT, url: `https://news.example/`, tabId: 7 });
  assert.equal(live.total, 2, 'one ads block + one heuristic block');
  assert.deepEqual(live.byCategory, { ads: 1, heuristic: 1 });
  assert.equal(live.stripped, 1);
  for (const category of Object.keys(live.byCategory)) {
    assert.ok(CATEGORY_LABELS[category], `"${category}" would show as a raw string`);
  }
});

// ── shim status: a warning must not be erased by the report that follows it ─

test('a nonce-exposed report is sticky and survives the shim\'s own status', async () => {
  // `shim-loader.js` reports `nonce-exposed` the instant a MAIN-world script's boot
  // event arrives late — milliseconds BEFORE that script reports its own, usually
  // healthy, outcome. `lastShimStatus` is a single last-writer-wins slot, so
  // storing it there would record the warning and then throw it away one message
  // later. The user would see a clean panel on exactly the page where the shim
  // could not be sure it patched anything in time.
  await reset();
  const sender = { url: PAGE };

  await send({ type: MSG.SHIM_STATUS, upgraded: false, lockedToFallback: false, reason: 'nonce-exposed' }, sender);
  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null }, sender);

  const { stats } = await report('news.example');
  assert.ok(stats.nonceExposedAt > 0, 'the late-boot warning was overwritten and lost');
  assert.equal(stats.lastShimStatus.upgraded, true, 'the real outcome must still be recorded');
  assert.equal(stats.lastShimStatus.reason, null,
    'nonce-exposed must not masquerade as the shim\'s own status');
});

test('a page that never boots late reports no exposure', async () => {
  await reset();
  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null }, { url: PAGE });
  const { stats } = await report('news.example');
  assert.ok(!stats.nonceExposedAt, 'a healthy page must not show the late-boot warning');
});

// ── the host family's User-Agent / Client-Hint ruleset (REVIEW-2026-09-16 B2, D19) ─
//
// The three `ua-*` rulesets ship disabled; the worker must enable exactly the
// host family's one, or the request headers keep contradicting the JS persona.

const uaCalls = () => enabledRulesetCalls.filter((c) =>
  [...(c.enableRulesetIds ?? []), ...(c.disableRulesetIds ?? [])].some((id) => id.startsWith('ua-')));

test('init enables the host family\'s ua-* ruleset and disables the other two', async () => {
  await reset(); // awaits ready(), so init() has run
  const want = BG.UA_RULESETS[hostFamily()];
  assert.ok(want, `hostFamily() = ${hostFamily()} has no ruleset`);

  const calls = uaCalls();
  assert.ok(calls.length >= 1, 'init never touched the ua-* rulesets');
  const last = calls[calls.length - 1];
  assert.deepEqual(last.enableRulesetIds, [want]);
  assert.deepEqual(
    [...last.disableRulesetIds].sort(),
    Object.values(BG.UA_RULESETS).filter((id) => id !== want).sort(),
  );
  // Never both enabled and disabled, and never a blocking ruleset in the same call.
  for (const c of calls) {
    for (const id of c.enableRulesetIds ?? []) assert.ok(!(c.disableRulesetIds ?? []).includes(id));
    for (const id of [...(c.enableRulesetIds ?? []), ...(c.disableRulesetIds ?? [])]) {
      assert.ok(id.startsWith('ua-'), `${id} toggled in the same call as a ua-* ruleset`);
    }
  }
});

test('applyUaRuleset() is idempotent — re-running after an extension update re-arms the same choice', async () => {
  const before = uaCalls().length;
  await BG.applyUaRuleset();
  await BG.applyUaRuleset();
  const calls = uaCalls();
  assert.equal(calls.length, before + 2);
  assert.deepEqual(calls[calls.length - 1], calls[calls.length - 2]);
});

test('background.js and rules/gen-ua.mjs agree on the ruleset ids, per family, with no family left out', () => {
  assert.deepEqual(Object.keys(BG.UA_RULESETS).sort(), [...FAMILIES].sort());
  for (const family of FAMILIES) {
    assert.equal(BG.UA_RULESETS[family], GENERATED_UA_RULESETS[family].id, family);
  }
  // …and both manifests register those ids, pointing at the generated files, disabled.
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    const m = JSON.parse(fs.readFileSync(path.join(EXT, name), 'utf8'));
    for (const family of FAMILIES) {
      const entry = m.declarative_net_request.rule_resources.find((r) => r.id === BG.UA_RULESETS[family]);
      assert.ok(entry, `${name}: ${BG.UA_RULESETS[family]} not registered`);
      assert.equal(entry.path, `rules/${GENERATED_UA_RULESETS[family].file}`);
      assert.equal(entry.enabled, false, `${name}: ${entry.id} must ship disabled`);
    }
  }
});

test('D33: patch failures the loader forwards are recorded per site — sticky, de-duplicated, capped — and reported', async () => {
  // The shim's genuine failures arrive on the SAME message as its healthy status
  // (they ride the upgrade status), so a last-writer slot would lose them the way
  // it would have lost `nonce-exposed`. They get their own sticky list.
  await reset();
  const sender = { url: PAGE };
  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null, failures: ['canvas.toDataURL', 'AudioBuffer.getChannelData'] }, sender);
  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null }, sender);
  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null, failures: ['canvas.toDataURL', 42, '', 'x'.repeat(500)] }, sender);

  const { stats } = await report('news.example');
  assert.deepEqual(stats.patchFailures, ['canvas.toDataURL', 'AudioBuffer.getChannelData', 'x'.repeat(80)],
    'labels are kept once each, non-strings dropped, long ones clipped, and a later healthy status does not erase them');
  assert.equal(stats.lastShimStatus.upgraded, true, 'the health slot is unaffected');

  await send({ type: MSG.SHIM_STATUS, upgraded: true, lockedToFallback: false, reason: null, failures: Array.from({ length: 20 }, (_, i) => 'api.' + i) }, sender);
  assert.equal((await report('news.example')).stats.patchFailures.length, 8, 'the list is capped');

  const clean = await report('other.example');
  assert.deepEqual(clean.stats.patchFailures, [], 'a site that reported nothing shows an empty list, not undefined');
});
