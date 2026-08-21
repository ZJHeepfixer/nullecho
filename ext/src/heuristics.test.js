/**
 * Nullecho — heuristic tracker detection tests
 * ─────────────────────────────────────────
 * The heuristic layer is the part of Nullecho that can invent a block rule the
 * user never approved. That makes two properties load-bearing, and both are
 * asserted here rather than assumed:
 *
 *   1. It promotes on the EFF three-strike rule and not before — two sites is
 *      a widget, three unrelated sites is cross-site identity.
 *   2. It can never promote anything on the never-block allowlist. A learner
 *      that teaches itself to block Stripe or a CAPTCHA has done more damage
 *      than the trackers it caught.
 *
 * `chrome` is stubbed, so this exercises the real promotion path — including
 * the shape of the dynamic DNR rules that get written — without a browser.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── stub the extension APIs before importing the module under test ─────────

const store = {};
const dynamicRules = new Map();

globalThis.chrome = {
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
  },
  webRequest: {
    onBeforeRequest: { addListener() {} },
    onBeforeSendHeaders: { addListener() {} },
    onHeadersReceived: { addListener() {} },
  },
};

const H = await import('./heuristics.js');

const BLOCK_BASE = 1_000_000;
const COOKIE_BASE = 1_050_000;

const statusOf = async (domain) =>
  (await H.getState()).find((d) => d.domain === domain)?.status;

test.beforeEach(async () => {
  await H.reset();
});

// ── eTLD+1 ────────────────────────────────────────────────────────────────

test('registrableDomain collapses subdomains to the registrable domain', () => {
  assert.equal(H.registrableDomain('www.example.com'), 'example.com');
  assert.equal(H.registrableDomain('a.b.c.example.com'), 'example.com');
  assert.equal(H.registrableDomain('example.com'), 'example.com');
});

test('registrableDomain handles multi-label public suffixes', () => {
  assert.equal(H.registrableDomain('foo.bar.example.co.uk'), 'example.co.uk');
  assert.equal(H.registrableDomain('x.example.com.au'), 'example.com.au');
});

test('registrableDomain treats app-hosting suffixes as public', () => {
  // Every *.vercel.app is a different publisher. Merging them would let one
  // tenant's tracking behaviour get every other tenant blocked.
  assert.equal(H.registrableDomain('myapp.vercel.app'), 'myapp.vercel.app');
  assert.equal(H.registrableDomain('d123.cloudfront.net'), 'd123.cloudfront.net');
  assert.equal(H.registrableDomain('user.github.io'), 'user.github.io');
});

test('registrableDomain passes IP literals through', () => {
  assert.equal(H.registrableDomain('192.168.1.1'), '192.168.1.1');
});

// ── entropy ───────────────────────────────────────────────────────────────

test('settings are not mistaken for identifiers', () => {
  for (const v of ['true', 'false', '1', '0', 'en_US', 'dark']) {
    assert.ok(H.estimateEntropyBits(v) < 33, `${v} scored as an identifier`);
  }
});

test('identifiers clear the entropy bar', () => {
  for (const v of ['550e8400-e29b-41d4-a716-446655440000', 'a1b2c3d4e5f60718', 'GA1.2.1234567890.1234567890']) {
    assert.ok(H.estimateEntropyBits(v) >= 33, `${v} scored as a setting`);
  }
});

// ── three strikes ─────────────────────────────────────────────────────────

test('two sites is not enough to promote', async () => {
  assert.equal(await H.recordSignal('t.tracker.example', 'news.test', H.SIGNAL.COOKIE), null);
  assert.equal(await H.recordSignal('t.tracker.example', 'shop.test', H.SIGNAL.COOKIE), null);
  assert.equal(dynamicRules.size, 0);
  assert.equal(await statusOf('tracker.example'), 'observing');
});

test('the third distinct site promotes to blocked', async () => {
  await H.recordSignal('t.tracker.example', 'news.test', H.SIGNAL.COOKIE);
  await H.recordSignal('t.tracker.example', 'shop.test', H.SIGNAL.SET_COOKIE);
  const result = await H.recordSignal('t.tracker.example', 'blog.test', H.SIGNAL.CANVAS);

  assert.equal(result, 'blocked');
  assert.equal(dynamicRules.size, 1);
});

test('repeat sightings on a known site do not add strikes', async () => {
  for (let i = 0; i < 20; i++) {
    await H.recordSignal('t.tracker.example', 'news.test', H.SIGNAL.COOKIE);
  }
  assert.equal(dynamicRules.size, 0, 'one site produced a block');
});

test('the promoted rule is a well-formed, third-party-only block', async () => {
  for (const site of ['a.test', 'b.test', 'c.test']) {
    await H.recordSignal('cdn.tracker.example', site, H.SIGNAL.COOKIE);
  }
  const rule = [...dynamicRules.values()][0];

  assert.equal(rule.action.type, 'block');
  assert.equal(rule.condition.domainType, 'thirdParty');
  assert.deepEqual(rule.condition.requestDomains, ['tracker.example'],
    'rule must target the registrable domain, not the observed host');
  assert.ok(rule.id >= BLOCK_BASE && rule.id < COOKIE_BASE,
    `id ${rule.id} outside the reserved dynamic block range`);
  assert.ok(!rule.condition.resourceTypes,
    'omitting resourceTypes is what keeps main_frame navigation working');
});

// ── the allowlist is absolute ─────────────────────────────────────────────

test('never-block domains are never promoted, however they behave', async () => {
  const untouchable = [
    'fonts.googleapis.com',   // web fonts
    'js.stripe.com',          // payments
    'challenges.cloudflare.com', // CAPTCHA
    'cdn.jsdelivr.net',       // script CDN
    'accounts.google.com',    // SSO
    'api.datadome.co',        // bot gate — blocking it locks the user out
  ];
  for (const host of untouchable) {
    for (const site of ['a.test', 'b.test', 'c.test', 'd.test', 'e.test']) {
      await H.recordSignal(host, site, H.SIGNAL.COOKIE);
      await H.recordSignal(host, site, H.SIGNAL.CANVAS);
    }
  }
  assert.equal(dynamicRules.size, 0, 'a never-block domain was promoted');
  assert.equal((await H.getState()).length, 0, 'a never-block domain was even recorded');
});

test('setDomainStatus refuses to block an allowlisted domain', async () => {
  await assert.rejects(
    () => H.setDomainStatus('stripe.com', 'blocked'),
    /never-block/,
  );
});

// ── yellowlist ────────────────────────────────────────────────────────────

test('domains carrying a visible feature are cookie-blocked, not blocked', async () => {
  for (const site of ['p.test', 'q.test', 'r.test']) {
    await H.recordSignal('www.youtube.com', site, H.SIGNAL.COOKIE);
  }
  assert.equal(await statusOf('youtube.com'), 'cookieblocked');

  const rule = [...dynamicRules.values()][0];
  assert.equal(rule.action.type, 'modifyHeaders');
  assert.equal(rule.action.requestHeaders[0].header, 'Cookie');
  assert.equal(rule.action.requestHeaders[0].operation, 'remove');
  assert.equal(rule.action.responseHeaders[0].header, 'Set-Cookie');
  assert.ok(rule.id >= COOKIE_BASE, `id ${rule.id} outside the cookie-block range`);
});

// ── first parties in disguise ─────────────────────────────────────────────

test('a site loading its own entity is not a third party', async () => {
  for (let i = 0; i < 5; i++) {
    await H.recordSignal('gstatic.com', 'google.com', H.SIGNAL.COOKIE);
    await H.recordSignal('twimg.com', 'twitter.com', H.SIGNAL.COOKIE);
  }
  assert.equal((await H.getState()).length, 0);
});

test('a domain is never a third party to itself', async () => {
  await H.recordSignal('cdn.example.test', 'www.example.test', H.SIGNAL.COOKIE);
  assert.equal((await H.getState()).length, 0);
});

// ── user override ─────────────────────────────────────────────────────────

test('allowing a blocked domain drops its rule and is sticky', async () => {
  for (const site of ['a.test', 'b.test', 'c.test']) {
    await H.recordSignal('t.tracker.example', site, H.SIGNAL.COOKIE);
  }
  assert.equal(dynamicRules.size, 1);

  await H.setDomainStatus('tracker.example', 'allowed');
  assert.equal(dynamicRules.size, 0);

  // Further evidence must not re-promote it — the user already decided.
  await H.recordSignal('t.tracker.example', 'd.test', H.SIGNAL.CANVAS);
  await H.recordSignal('t.tracker.example', 'e.test', H.SIGNAL.CANVAS);
  assert.equal(await statusOf('tracker.example'), 'allowed');
  assert.equal(dynamicRules.size, 0);
});

// ── reconciliation ────────────────────────────────────────────────────────

test('reconcile removes rules that no longer have state behind them', async () => {
  // Dynamic rules outlive our storage across updates; a stale rule blocking
  // something the UI reports as allowed is exactly the silent divergence that
  // makes a privacy tool untrustworthy.
  dynamicRules.set(BLOCK_BASE + 42, {
    id: BLOCK_BASE + 42,
    priority: 1,
    action: { type: 'block' },
    condition: { requestDomains: ['ghost.test'] },
  });
  const result = await H.reconcile();
  assert.equal(result.removed, 1);
  assert.ok(!dynamicRules.has(BLOCK_BASE + 42));
});

test('reconcile re-adds a rule that state says should exist', async () => {
  for (const site of ['a.test', 'b.test', 'c.test']) {
    await H.recordSignal('t.tracker.example', site, H.SIGNAL.COOKIE);
  }
  const id = [...dynamicRules.keys()][0];
  dynamicRules.clear();

  const result = await H.reconcile();
  assert.equal(result.added, 1);
  assert.ok(dynamicRules.has(id));
});

// ── persistence ───────────────────────────────────────────────────────────

test('promotion is flushed to storage immediately, not debounced', async () => {
  // The service worker can be torn down at any moment. A lost promotion means
  // the tracker starts its three strikes over.
  for (const site of ['a.test', 'b.test', 'c.test']) {
    await H.recordSignal('t.tracker.example', site, H.SIGNAL.COOKIE);
  }
  assert.equal(store['nullecho:heuristics:v1'].domains['tracker.example'].status, 'blocked');
});

// ── reporting ─────────────────────────────────────────────────────────────

test('getState reports strikes, sites and signal names', async () => {
  await H.recordSignal('t.tracker.example', 'a.test', H.SIGNAL.COOKIE);
  await H.recordSignal('t.tracker.example', 'b.test', H.SIGNAL.CANVAS);

  const [entry] = await H.getState();
  assert.equal(entry.domain, 'tracker.example');
  assert.equal(entry.strikes, 2);
  assert.deepEqual(entry.sites.sort(), ['a.test', 'b.test']);
  assert.deepEqual(entry.signals.sort(), ['CANVAS', 'COOKIE']);
});

test('stats counts each outcome', async () => {
  for (const site of ['a.test', 'b.test', 'c.test']) {
    await H.recordSignal('t.tracker.example', site, H.SIGNAL.COOKIE);
    await H.recordSignal('www.youtube.com', site, H.SIGNAL.COOKIE);
  }
  const s = await H.stats();
  assert.equal(s.blocked, 1);
  assert.equal(s.cookieblocked, 1);
  assert.equal(s.observed, 2);
});

// ── shim reports ──────────────────────────────────────────────────────────

test('a canvas report without a script URL is dropped, not blamed on the page', async () => {
  // Attribution matters more than coverage here: guessing would let any page
  // get an arbitrary third party blocked.
  assert.equal(
    H.handleContentReport({ type: 'nullecho:signal', signal: 'canvas' }, { origin: 'https://a.test' }),
    false,
  );
  assert.equal((await H.getState()).length, 0);
});

test('an attributed canvas report counts as a strike', async () => {
  for (const site of ['https://a.test', 'https://b.test', 'https://c.test']) {
    H.handleContentReport(
      { type: 'nullecho:signal', signal: 'canvas', scriptUrl: 'https://fp.tracker.example/fp.js' },
      { origin: site },
    );
  }
  await H.flush();
  assert.equal(await statusOf('tracker.example'), 'blocked');
});

test('unrelated messages are ignored', () => {
  assert.equal(H.handleContentReport({ type: 'nullecho:get-persona' }, {}), false);
  assert.equal(H.handleContentReport(null, {}), false);
});

// ── reset ─────────────────────────────────────────────────────────────────

test('reset clears state and every rule it created', async () => {
  for (const site of ['a.test', 'b.test', 'c.test']) {
    await H.recordSignal('t.tracker.example', site, H.SIGNAL.COOKIE);
  }
  await H.reset();
  assert.equal(dynamicRules.size, 0);
  assert.equal((await H.getState()).length, 0);
});
