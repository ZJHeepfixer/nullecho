/**
 * Nullecho for Safari — generated rulesets.
 *
 * The Safari rulesets are derived from ext/rules at build time (safari/tools/safari-rules.mjs).
 * These tests read the ASSEMBLED files and hold them to three things: tier B is off by default,
 * every rule is valid and uniquely numbered, and the coverage is EXACTLY the Chrome lists' — every
 * domain Chrome blocks is blocked here with the same action, priority, domainType and
 * resourceTypes, and nothing more. `NULLECHO_SAFARI_DIST=<dir>` points the suite at another tree.
 *
 * Run: `node --test safari/test/*.test.mjs` from the repo root (Node 22; `node --test safari/test/` needs a newer Node).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { distDir, readJson, EXT } from './helpers.mjs';
import { SAFARI_RULESETS, ID_BLOCKS, TIER_B, inTierB, GPC_HEADER_RULE_ID, convertRules } from '../tools/safari-rules.mjs';

const DIST = await distDir();
const manifest = readJson(path.join(DIST, 'manifest.json'));
const extRules = (f) => readJson(path.join(EXT, 'rules', f));
const safariRules = (p) => readJson(path.join(DIST, p));
const declared = manifest.declarative_net_request.rule_resources;
const SAFARI = declared.map((r) => ({ ...r, rules: safariRules(r.path) }));

const RESOURCE_TYPES = new Set(['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object',
  'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webtransport', 'webbundle', 'other']);
const CONDITION_KEYS = new Set(['urlFilter', 'regexFilter', 'isUrlFilterCaseSensitive', 'initiatorDomains',
  'excludedInitiatorDomains', 'requestDomains', 'excludedRequestDomains', 'domainType', 'resourceTypes',
  'excludedResourceTypes', 'requestMethods', 'excludedRequestMethods', 'responseHeaders', 'excludedResponseHeaders', 'tabIds', 'excludedTabIds']);
const ACTION_TYPES = new Set(['block', 'allow', 'allowAllRequests', 'upgradeScheme', 'redirect', 'modifyHeaders']);
const HOST = /^[a-z0-9.-]+$/;

/** The domain a `||domain^` filter names, or null for any other filter. */
const domainOf = (f) => /^\|\|([a-z0-9.-]+)\^$/.exec(f)?.[1] ?? null;

// ── tier B ships disabled, in its own ruleset, and nowhere else ──────────────

test('fingerprinting-strict is registered disabled and holds exactly the tier B rules', () => {
  const strict = declared.find((r) => r.id === 'fingerprinting-strict');
  assert.ok(strict, 'no fingerprinting-strict ruleset');
  assert.equal(strict.enabled, false, 'tier B must ship OFF: Safari has no updateStaticRules to switch it off at install');
  const ids = safariRules(strict.path).map((r) => r.id);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.ok(inTierB(id), `rule ${id} in fingerprinting-strict is outside ${TIER_B}`);
  const sourceTierB = extRules('fingerprinting.json').filter((r) => inTierB(r.id)).map((r) => r.id);
  for (const id of sourceTierB) assert.ok(ids.includes(id), `tier B rule ${id} missing from fingerprinting-strict`);
});

test('no ENABLED ruleset blocks a tier B (anti-fraud) domain', () => {
  const tierBDomains = extRules('fingerprinting.json').filter((r) => inTierB(r.id)).flatMap((r) => r.condition.requestDomains);
  assert.ok(tierBDomains.includes('online-metrix.net'), 'ThreatMetrix is the canary');
  for (const rs of SAFARI.filter((r) => r.enabled)) {
    for (const rule of rs.rules) {
      if (rule.action.type !== 'block') continue;
      const d = domainOf(rule.condition.urlFilter ?? '');
      const named = [...(rule.condition.requestDomains ?? []), ...(d ? [d] : [])];
      for (const h of named) {
        assert.ok(!tierBDomains.some((t) => h === t || h.endsWith('.' + t)), `enabled ruleset "${rs.id}" rule ${rule.id} blocks tier B domain ${h} — bank sign-in breaks by default`);
      }
    }
  }
});

test('fingerprinting keeps tier A and the tier C allow rule 4700, and no tier B id', () => {
  const fp = SAFARI.find((r) => r.id === 'fingerprinting');
  assert.equal(fp.enabled, true);
  const ids = fp.rules.map((r) => r.id);
  for (const id of ids) assert.ok(!inTierB(id), `tier B id ${id} in the enabled fingerprinting ruleset`);
  assert.ok(ids.includes(4000) && ids.includes(4700));
  const allow = fp.rules.filter((r) => r.action.type === 'allow');
  assert.ok(allow.length >= 1 && allow.every((r) => r.priority === 100 && r.condition.initiatorDomains), 'the tier C carve-out must stay scoped to its initiators');
});

// ── validity ──────────────────────────────────────────────────────────────────

test('the manifest registers exactly the generated rulesets, in order', () => {
  assert.deepEqual(declared.map((r) => [r.id, r.path, r.enabled]), SAFARI_RULESETS.map((r) => [r.id, r.path, r.enabled]));
  for (const r of declared) assert.ok(fs.existsSync(path.join(DIST, r.path)), `${r.path} missing`);
});

test('ids are unique across every Safari ruleset and inside the owning block', () => {
  const seen = new Map();
  for (const rs of SAFARI) {
    const src = SAFARI_RULESETS.find((x) => x.id === rs.id).source;
    const blocks = ID_BLOCKS[src];
    for (const rule of rs.rules) {
      assert.ok(Number.isInteger(rule.id) && rule.id >= 1, `${rs.id}: bad id ${rule.id}`);
      assert.ok(!seen.has(rule.id), `duplicate id ${rule.id} in ${rs.id} (also in ${seen.get(rule.id)})`);
      seen.set(rule.id, rs.id);
      assert.ok(blocks.some(([lo, hi]) => rule.id >= lo && rule.id <= hi), `${rs.id}: id ${rule.id} outside ${JSON.stringify(blocks)}`);
      if (rs.id === 'fingerprinting-strict') assert.ok(inTierB(rule.id));
      if (rs.id === 'fingerprinting') assert.ok(!inTierB(rule.id));
      assert.ok(rule.id < 900_000, `${rule.id} collides with a reserved dynamic range (ext/rules/validate.mjs)`);
    }
  }
});

test('every rule is well-formed MV3 DNR and uses no key Safari would mis-translate', () => {
  for (const rs of SAFARI) {
    rs.rules.forEach((rule, i) => {
      const at = `${rs.path}[${i}] (id ${rule.id})`;
      assert.deepEqual(Object.keys(rule).filter((k) => !['id', 'priority', 'action', 'condition'].includes(k)), [], `${at}: unknown top-level key`);
      assert.ok(Number.isInteger(rule.priority) && rule.priority >= 1, `${at}: bad priority`);
      assert.ok(ACTION_TYPES.has(rule.action?.type), `${at}: bad action`);
      const c = rule.condition;
      assert.ok(c && typeof c === 'object', `${at}: no condition`);
      for (const k of Object.keys(c)) assert.ok(CONDITION_KEYS.has(k), `${at}: unknown condition key ${k}`);
      assert.ok(!(c.urlFilter && c.regexFilter), `${at}: urlFilter and regexFilter together`);
      assert.ok(c.urlFilter || c.regexFilter || c.requestDomains || c.excludedRequestDomains || c.initiatorDomains, `${at}: matches every URL`);
      if (c.urlFilter) {
        assert.equal(typeof c.urlFilter, 'string');
        assert.ok(/^[\x20-\x7e]+$/.test(c.urlFilter), `${at}: urlFilter must be ASCII (WebKit rejects the rule otherwise)`);
      }
      for (const k of ['resourceTypes', 'excludedResourceTypes']) {
        if (!c[k]) continue;
        assert.ok(Array.isArray(c[k]) && c[k].length > 0, `${at}: ${k} empty`);
        for (const t of c[k]) assert.ok(RESOURCE_TYPES.has(t), `${at}: bad resource type ${t}`);
      }
      for (const k of ['requestDomains', 'excludedRequestDomains', 'initiatorDomains', 'excludedInitiatorDomains']) {
        if (!c[k]) continue;
        assert.ok(Array.isArray(c[k]) && c[k].length > 0, `${at}: ${k} empty`);
        for (const d of c[k]) assert.ok(typeof d === 'string' && HOST.test(d) && d === d.toLowerCase(), `${at}: ${k} entry ${d}`);
      }
      if (c.domainType) assert.ok(['firstParty', 'thirdParty'].includes(c.domainType), `${at}: bad domainType`);
      if (rule.action.type === 'block') {
        assert.ok(!(c.resourceTypes ?? []).includes('main_frame'), `${at}: block rule opts into main_frame`);
      }
      // WebKit combines requestDomains with a urlFilter heuristically; the generator never emits the pair.
      assert.ok(!(c.requestDomains && (c.urlFilter || c.regexFilter)), `${at}: requestDomains together with a filter`);
    });
  }
});

// ── the Safari-specific shape decisions ──────────────────────────────────────

test('no Safari block/allow rule uses a bare requestDomains (WebKit compiles it without a host boundary)', () => {
  for (const rs of SAFARI) {
    for (const rule of rs.rules) {
      if (rule.id === GPC_HEADER_RULE_ID) continue;
      assert.equal(rule.condition.requestDomains, undefined,
        `${rs.id} rule ${rule.id} still uses requestDomains — in Safari that matches t.com for t.co (measured 2026-10-02)`);
      if (rule.condition.urlFilter && domainOf(rule.condition.urlFilter)) {
        assert.match(rule.condition.urlFilter, /^\|\|[a-z0-9.-]+\^$/, 'a domain filter is ||domain^ — anchor and separator');
      }
    }
  }
});

test('only rule 5000 carries excludedRequestDomains (WebKit bleeds an exclusion into every later rule)', () => {
  for (const rs of SAFARI) {
    for (const rule of rs.rules) {
      if (rule.condition.excludedRequestDomains) {
        assert.equal(rule.id, GPC_HEADER_RULE_ID, `${rs.id} rule ${rule.id} has excludedRequestDomains — that exempts those hosts from the GPC header too`);
        assert.equal(rs.id, 'gpc');
      }
    }
  }
  assert.ok(safariRules('rules/gpc.json').find((r) => r.id === 5000).condition.excludedRequestDomains.length >= 40, 'rule 5000 lost its exclusions');
});

test('gpc.json is byte-identical to ext/rules/gpc.json', () => {
  assert.equal(fs.readFileSync(path.join(DIST, 'rules/gpc.json'), 'utf8'), fs.readFileSync(path.join(EXT, 'rules/gpc.json'), 'utf8'));
});

test('the generator refuses an exclusion on a block rule and a requestDomains+urlFilter pair', () => {
  assert.throws(() => convertRules('ads.json', [{ id: 1000, priority: 1, action: { type: 'block' }, condition: { requestDomains: ['a.example'], excludedRequestDomains: ['keep.a.example'] } }]), /excludedRequestDomains/);
  assert.throws(() => convertRules('ads.json', [{ id: 1000, priority: 1, action: { type: 'block' }, condition: { requestDomains: ['a.example'], urlFilter: '/x' } }]), /combines requestDomains/);
  assert.throws(() => convertRules('ads.json', [{ id: 1000, priority: 1, action: { type: 'block' }, condition: { requestDomains: ['A.Example'] } }]), /lowercase hostname/);
});

// ── coverage: exactly the Chrome lists, nothing more, nothing less ───────────

/**
 * One line per (domain or filter) with every attribute that changes what the rule does. The
 * source side expands requestDomains; the Safari side reads the domain back out of `||d^`.
 */
function targets(rules, side) {
  const out = [];
  for (const r of rules) {
    const c = r.condition;
    const attrs = JSON.stringify({ action: r.action, priority: r.priority, domainType: c.domainType ?? null,
      resourceTypes: c.resourceTypes ?? null, excludedResourceTypes: c.excludedResourceTypes ?? null,
      initiatorDomains: c.initiatorDomains ?? null, excludedInitiatorDomains: c.excludedInitiatorDomains ?? null });
    if (side === 'ext' && c.requestDomains && !c.urlFilter) {
      for (const d of c.requestDomains) out.push(`domain ${d} ${attrs}`);
    } else if (side === 'safari' && c.urlFilter && domainOf(c.urlFilter)) {
      out.push(`domain ${domainOf(c.urlFilter)} ${attrs}`);
    } else {
      out.push(`filter ${c.urlFilter ?? c.regexFilter ?? JSON.stringify(c.requestDomains)} ${attrs}`);
    }
  }
  return out.sort();
}

for (const [source, safariIds] of [['ads.json', ['ads']], ['analytics.json', ['analytics']], ['social.json', ['social']], ['fingerprinting.json', ['fingerprinting', 'fingerprinting-strict']]]) {
  test(`${source}: Safari covers every domain and filter, with identical semantics, and nothing extra`, () => {
    const ext = targets(extRules(source), 'ext');
    const saf = targets(SAFARI.filter((r) => safariIds.includes(r.id)).flatMap((r) => r.rules), 'safari');
    const missing = ext.filter((t) => !saf.includes(t));
    const extra = saf.filter((t) => !ext.includes(t));
    assert.deepEqual(missing, [], `${source}: blocked in Chrome but not in Safari`);
    assert.deepEqual(extra, [], `${source}: blocked in Safari but not in Chrome`);
    assert.equal(saf.length, ext.length);
  });
}

test('the first domain of every Chrome rule keeps its Chrome id; extra domains get ids from the block top', () => {
  for (const [source, safariIds] of [['ads.json', ['ads']], ['analytics.json', ['analytics']], ['social.json', ['social']], ['fingerprinting.json', ['fingerprinting', 'fingerprinting-strict']]]) {
    const saf = SAFARI.filter((r) => safariIds.includes(r.id)).flatMap((r) => r.rules);
    for (const r of extRules(source)) {
      const first = r.condition.requestDomains?.[0];
      const same = saf.find((s) => s.id === r.id);
      assert.ok(same, `${source}: Chrome rule ${r.id} has no Safari rule with that id`);
      if (first) assert.equal(domainOf(same.condition.urlFilter), first, `${source}: rule ${r.id} should keep ${first}`);
      else assert.deepEqual(same.condition, r.condition, `${source}: filter rule ${r.id} changed`);
    }
  }
  // the extras: ads has 10 multi-domain rules → 11 extra ids from 1999 down
  const ads = SAFARI.find((r) => r.id === 'ads').rules.map((r) => r.id).filter((id) => id > 1900).sort((a, b) => b - a);
  assert.equal(ads[0], 1999);
});

test('rule counts: one Safari rule per Chrome domain or filter', () => {
  const count = (f) => extRules(f).reduce((n, r) => n + (r.condition.requestDomains && !r.condition.urlFilter ? r.condition.requestDomains.length : 1), 0);
  assert.equal(SAFARI.find((r) => r.id === 'ads').rules.length, count('ads.json'));
  assert.equal(SAFARI.find((r) => r.id === 'analytics').rules.length, count('analytics.json'));
  assert.equal(SAFARI.find((r) => r.id === 'social').rules.length, count('social.json'));
  const fp = SAFARI.find((r) => r.id === 'fingerprinting').rules.length + SAFARI.find((r) => r.id === 'fingerprinting-strict').rules.length;
  assert.equal(fp, count('fingerprinting.json'));
});
