/**
 * Nullecho — a learned rule never covers a protected service (DECISIONS.md D50)
 * ─────────────────────────────────────────────────────────────────────────────
 * 2026-09-28, the owner's real Chrome: reCAPTCHA vanished from every third-party
 * page. The cause was not a header (D49 was a wrong diagnosis). The heuristic
 * learner had promoted `google.com` — Google's cookies ride along on every
 * embed, so it clears three strikes in a normal week of browsing — and wrote
 *
 *   { action: block, condition: { requestDomains: ['google.com'], domainType: 'thirdParty' } }
 *
 * `requestDomains` matches every subdomain, so that one rule also blocked
 * `www.google.com/recaptcha/` (reCAPTCHA's primary host, which NEVER_BLOCK did
 * not list), `accounts.google.com` and `apis.google.com` (which it DID list —
 * the never-block check looked at the promoted domain, not at what the rule
 * would cover). Nullecho-off-for-the-site restored the box because the
 * allowlist's allowAllRequests outranks every dynamic rule.
 *
 * These tests pin the class, not the instance: for EVERY protected host on the
 * list, whatever its parent domain gets promoted to, the rule must not reach it.
 * They also pin the repair of a rule an earlier build already wrote, because the
 * owner's profile holds exactly that rule.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── stub the extension APIs before importing the module under test ─────────

const store = {};
const dynamicRules = new Map();
const evt = () => ({ addListener() {} });

/**
 * Chrome answers DNR calls over IPC: a read reflects the rules when it was
 * ISSUED, and the answer arrives later. Zero latency hides every interleaving,
 * so the concurrency test turns this up.
 */
let latencyMs = 0;
const later = (value) => (latencyMs ? new Promise((r) => setTimeout(() => r(value), latencyMs)) : value);

globalThis.chrome = {
  storage: {
    local: {
      async get(key) { return key in store ? { [key]: structuredClone(store[key]) } : {}; },
      async set(obj) { Object.assign(store, structuredClone(obj)); },
    },
  },
  declarativeNetRequest: {
    async getDynamicRules() { return later([...dynamicRules.values()].map((r) => structuredClone(r))); },
    async updateDynamicRules({ addRules = [], removeRuleIds = [] }) {
      await later();
      for (const id of removeRuleIds) dynamicRules.delete(id);
      for (const r of addRules) {
        if (dynamicRules.has(r.id)) throw new Error(`Rule with id ${r.id} does not have a unique ID.`);
        dynamicRules.set(r.id, structuredClone(r));
      }
    },
  },
  webRequest: {
    onBeforeSendHeaders: evt(),
    onHeadersReceived: evt(),
  },
};

const H = await import('./heuristics.js');
const { NEVER_BLOCK, COOKIE_BLOCK_ONLY, isCookieBlockOnly, isNeverBlock } = await import('./allowlist.js');

const BLOCK_BASE = 1_000_000;
const COOKIE_BASE = 1_050_000;
const STORAGE_KEY = 'nullecho:heuristics:v1';

/** DNR's domain matching: the host is the entry or a subdomain of it. */
const under = (host, entry) => host === entry || host.endsWith(`.${entry}`);

/** Would this dynamic rule act on a third-party request to `host`? */
function covers(rule, host) {
  const c = rule.condition;
  if (!(c.requestDomains ?? []).some((d) => under(host, d))) return false;
  if ((c.excludedRequestDomains ?? []).some((d) => under(host, d))) return false;
  return true;
}

const hostOfEntry = (entry) => entry.split('/')[0];
const promote = async (host) => {
  for (const site of ['a.test', 'b.test', 'c.test']) await H.recordSignal(host, site, H.SIGNAL.COOKIE);
};
const rules = () => [...dynamicRules.values()];

/**
 * A service-worker restart: a fresh module instance hydrates from storage and
 * runs `reconcile()`, exactly as `install()` does after an extension update.
 */
let restarts = 0;
const restart = () => import(`./heuristics.js?sw=${++restarts}`);

test.beforeEach(async () => {
  await H.reset();
  dynamicRules.clear();
});

// ── the instance: the owner's Chrome ──────────────────────────────────────

test('google.com clearing three strikes leaves reCAPTCHA, Google sign-in and Google embeds working', async () => {
  await promote('www.google.com');

  const [rule] = rules();
  assert.ok(rule, 'google.com was still promoted — the learner must keep working, just not overreach');
  for (const host of ['www.google.com', 'accounts.google.com', 'apis.google.com']) {
    assert.equal(covers(rule, host), false, `the google.com rule reaches ${host}`);
  }
  assert.equal(rule.action.type, 'modifyHeaders',
    'google.com carries visible features (Maps, Forms, Calendar embeds): strip its cookies, never block it');
  assert.equal((await H.getState()).find((d) => d.domain === 'google.com').status, 'cookieblocked');
});

test('reCAPTCHA\'s primary host is on the protected list — recaptcha.net alone was never enough', () => {
  assert.ok(NEVER_BLOCK.some((e) => e.startsWith('www.google.com/recaptcha')),
    'www.google.com/recaptcha/ is where api.js is served for nearly every site');
});

// ── the class: every protected host, whatever gets promoted above it ──────

test('no promotion of any parent domain can reach a NEVER_BLOCK host — block or cookie-strip', async () => {
  const checked = [];
  for (const entry of NEVER_BLOCK) {
    const host = hostOfEntry(entry.toLowerCase());
    const parent = H.registrableDomain(host);
    if (!parent || parent === host) continue;               // the entry IS the registrable domain
    if (NEVER_BLOCK.map((e) => hostOfEntry(e)).includes(parent)) continue; // parent is itself protected
    for (const status of ['blocked', 'cookieblocked']) {
      await H.reset();
      dynamicRules.clear();
      await H.setDomainStatus(parent, status);
      const [rule] = rules();
      assert.ok(rule, `${parent} (${status}) wrote no rule`);
      assert.equal(covers(rule, host), false, `a ${status} rule on ${parent} reaches protected ${host}`);
      checked.push(`${status}:${parent}>${host}`);
    }
  }
  // The list is only a real guard if it has entries this test exercises.
  for (const must of ['challenges.cloudflare.com', 'accounts.google.com', 'login.live.com',
    'login.microsoftonline.com', 'appleid.apple.com', 'www.google.com']) {
    assert.ok(checked.some((c) => c.endsWith(`>${must}`)), `${must} was never exercised`);
  }
});

test('a block never reaches a cookie-strip-only host beneath it either — that feature is visible', async () => {
  for (const entry of COOKIE_BLOCK_ONLY) {
    const host = hostOfEntry(entry.toLowerCase());
    const parent = H.registrableDomain(host);
    // A parent that is itself protected can never be blocked in the first place.
    if (!parent || parent === host || isCookieBlockOnly(parent) || isNeverBlock(parent)) continue;
    await H.reset();
    dynamicRules.clear();
    await H.setDomainStatus(parent, 'blocked');
    const [rule] = rules();
    assert.equal(covers(rule, host), false, `a block on ${parent} reaches ${host}`);
  }
});

test('a domain with nothing protected beneath it gets exactly the old rule — no empty exclusion list', async () => {
  await promote('t.tracker.example');
  const [rule] = rules();
  assert.deepEqual(rule.condition, { requestDomains: ['tracker.example'], domainType: 'thirdParty' });
});

// ── repair: the rule an earlier build already wrote ───────────────────────

test('reconcile repairs the owner\'s exact rule: google.com blocked with no carve-outs', async () => {
  await H.reset();
  dynamicRules.clear();
  // State + live rule exactly as found in the owner's profile on 2026-09-28
  // (DNR Extension Rules/<id>/rules.json).
  store[STORAGE_KEY] = {
    version: 1,
    domains: {
      'google.com': {
        sites: { 'a.test': 1, 'b.test': 2, 'c.test': 1 },
        status: 'blocked',
        ruleId: BLOCK_BASE,
        firstSeen: 1, lastSeen: 2,
      },
    },
  };
  dynamicRules.set(BLOCK_BASE, {
    action: { type: 'block' },
    condition: { domainType: 'thirdParty', requestDomains: ['google.com'] },
    id: BLOCK_BASE,
    priority: 1,
  });
  const sw = await restart();
  const result = await sw.reconcile();

  assert.ok(!dynamicRules.has(BLOCK_BASE), 'the old google.com block survived the update');
  const live = rules();
  assert.equal(live.length, 1);
  assert.equal(live[0].action.type, 'modifyHeaders');
  assert.ok(live[0].id >= COOKIE_BASE);
  for (const host of ['www.google.com', 'accounts.google.com', 'apis.google.com']) {
    assert.equal(covers(live[0], host), false, `repaired rule still reaches ${host}`);
  }
  assert.equal(store[STORAGE_KEY].domains['google.com'].status, 'cookieblocked', 'the migration was not persisted');
  assert.equal(result.migrated, 1);
});

test('reconcile rewrites a live rule whose content is stale, and leaves a current one alone', async () => {
  await promote('t.tracker.example');
  const [current] = rules();
  let result = await H.reconcile();
  assert.deepEqual(result, { added: 0, removed: 0, updated: 0, migrated: 0 }, 'a current rule was touched');

  // Same id, older shape (e.g. written before carve-outs existed): must be replaced.
  await H.setDomainStatus('cloudflare.com', 'blocked');
  const cf = rules().find((r) => r.condition.requestDomains[0] === 'cloudflare.com');
  dynamicRules.set(cf.id, { ...cf, condition: { requestDomains: ['cloudflare.com'], domainType: 'thirdParty' } });
  result = await H.reconcile();
  assert.equal(result.updated, 1);
  assert.equal(covers(dynamicRules.get(cf.id), 'challenges.cloudflare.com'), false);
  assert.deepEqual(dynamicRules.get(current.id), current);
});

test('a block the USER chose on a cookie-strip-only domain is not demoted by the migration', async () => {
  await H.setDomainStatus('google.com', 'blocked');
  const sw = await restart();
  await sw.reconcile();
  assert.equal((await sw.getState()).find((d) => d.domain === 'google.com').status, 'blocked',
    'the migration overrode an explicit user decision');
  const [rule] = rules();
  assert.equal(covers(rule, 'www.google.com'), false, 'even a user block keeps reCAPTCHA reachable');
});

test('a promoted record whose domain is now NEVER_BLOCK is retired and its rule dropped', async () => {
  await H.reset();
  dynamicRules.clear();
  store[STORAGE_KEY] = {
    version: 1,
    domains: {
      'recaptcha.net': { sites: { 'a.test': 1 }, status: 'blocked', ruleId: BLOCK_BASE + 7, firstSeen: 1, lastSeen: 2 },
    },
  };
  dynamicRules.set(BLOCK_BASE + 7, {
    id: BLOCK_BASE + 7, priority: 1, action: { type: 'block' },
    condition: { requestDomains: ['recaptcha.net'], domainType: 'thirdParty' },
  });
  const sw = await restart();
  await sw.reconcile();
  assert.equal(dynamicRules.size, 0);
  assert.equal(store[STORAGE_KEY].domains['recaptcha.net'].status, 'observing');
});

// ── two callers at once ───────────────────────────────────────────────────

test('two reconciles at the same instant — install() and onInstalled on an update — both succeed', async () => {
  // Found in the owner's Chrome on the first reload of this fix: both callers
  // read the live rules before either wrote, both added id 1050000, and Chrome
  // refused the second ("Rule with id 1050000 does not have a unique ID").
  await H.reset();
  dynamicRules.clear();
  store[STORAGE_KEY] = {
    version: 1,
    domains: {
      'google.com': { sites: { 'a.test': 1, 'b.test': 2, 'c.test': 1 }, status: 'blocked', ruleId: BLOCK_BASE, firstSeen: 1, lastSeen: 2 },
    },
  };
  dynamicRules.set(BLOCK_BASE, {
    action: { type: 'block' },
    condition: { domainType: 'thirdParty', requestDomains: ['google.com'] },
    id: BLOCK_BASE,
    priority: 1,
  });
  const sw = await restart();
  latencyMs = 5;
  let results;
  try {
    results = await Promise.allSettled([sw.reconcile(), sw.reconcile()]);
  } finally {
    latencyMs = 0;
  }
  for (const r of results) assert.equal(r.status, 'fulfilled', String(r.reason));
  assert.equal(dynamicRules.size, 1);
  assert.equal(covers(rules()[0], 'www.google.com'), false);
});

// ── D52: what the seeded-learned-state smoke found next ──────────────────
//
// The smoke (harness/site-smoke.mjs --seeded, 2026-09-28) promoted the big
// multi-service domains the way a week of browsing would, then rendered their
// embeds on third-party pages. Two more classes:
//   1. a learned facebook.com / twitter.com block removed Facebook plugins and
//      embedded X posts from every site — the static social rules deliberately
//      leave those alone and block only the pixel paths;
//   2. a learned microsoft.com block stopped microsoft.com's own silent sign-in:
//      login.live.com posts back to www.microsoft.com/cascadeauth/…, and to DNR
//      that request is third-party (initiator live.com) although the learner
//      itself counts the two as one company.

/** Would the rule act on a request to `host` made by a document on `initiator`? */
function coversFrom(rule, host, initiator) {
  if (!covers(rule, host)) return false;
  return !(rule.condition.excludedInitiatorDomains ?? []).some((d) => under(initiator, d));
}

test('a learned rule never breaks a same-company hand-off: login.live.com posting back to www.microsoft.com', async () => {
  for (const status of ['blocked', 'cookieblocked']) {
    await H.reset();
    dynamicRules.clear();
    await H.setDomainStatus('microsoft.com', status);
    const [rule] = rules();
    assert.equal(coversFrom(rule, 'www.microsoft.com', 'login.live.com'), false,
      `a ${status} microsoft.com rule acts on microsoft's own sign-in post-back`);
    assert.equal(coversFrom(rule, 'www.microsoft.com', 'news.example'), true,
      'the rule must still act when an unrelated site embeds microsoft.com');
  }
});

test('work/school sign-in (login.microsoftonline.com, Entra ID) posting back to any Microsoft domain is spared too', async () => {
  // Predicted by the seeded smoke's rule dump (2026-09-28): D52's group had live.com but not microsoftonline.com.
  for (const domain of ['microsoft.com', 'live.com', 'office.com']) {
    await H.reset();
    dynamicRules.clear();
    await H.setDomainStatus(domain, 'blocked');
    const [rule] = rules();
    assert.equal(coversFrom(rule, `www.${domain}`, 'login.microsoftonline.com'), false,
      `a learned ${domain} rule acts on the Entra ID sign-in post-back`);
  }
});

test('the learner\'s company groups and the rule\'s initiator exclusions are the same thing', async () => {
  await promote('www.google.com');
  const [rule] = rules();
  for (const peer of ['youtube.com', 'gstatic.com', 'googleapis.com']) {
    assert.ok((rule.condition.excludedInitiatorDomains ?? []).includes(peer), `${peer} missing`);
  }
  assert.ok(!(rule.condition.excludedInitiatorDomains ?? []).includes('google.com'), 'a domain need not exclude itself');
});

test('social platforms whose embeds are content are cookie-stripped when learned, never blocked', async () => {
  for (const host of ['www.facebook.com', 'www.instagram.com', 'platform.twitter.com', 'x.com',
    'www.linkedin.com', 'www.tiktok.com']) {
    await H.reset();
    dynamicRules.clear();
    await promote(host);
    const [rule] = rules();
    assert.ok(rule, `${host} was not promoted at all — the learner must still act`);
    assert.equal(rule.action.type, 'modifyHeaders', `${host}: a learned block removes its embeds from every site`);
  }
});

test('a learner block written by an earlier build on facebook.com is migrated to a cookie-strip', async () => {
  await H.reset();
  dynamicRules.clear();
  store[STORAGE_KEY] = {
    version: 1,
    domains: {
      'facebook.com': { sites: { 'a.test': 1, 'b.test': 1, 'c.test': 2 }, status: 'blocked', ruleId: BLOCK_BASE + 3, firstSeen: 1, lastSeen: 2 },
    },
  };
  dynamicRules.set(BLOCK_BASE + 3, {
    id: BLOCK_BASE + 3, priority: 1, action: { type: 'block' },
    condition: { requestDomains: ['facebook.com'], domainType: 'thirdParty' },
  });
  const sw = await restart();
  await sw.reconcile();
  const live = rules();
  assert.equal(live.length, 1);
  assert.equal(live[0].action.type, 'modifyHeaders');
  assert.equal(store[STORAGE_KEY].domains['facebook.com'].status, 'cookieblocked');
});
