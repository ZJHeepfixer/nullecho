/**
 * D55 — `block-counter.js`, the attribution half of the store-build block counter.
 *
 * The matcher never creates a count on its own: a request is counted only after the browser has
 * reported that an extension cancelled it. What the matcher decides is whether that cancellation was
 * Nullecho's — i.e. whether one of Nullecho's block rules covers the request — and under which
 * category. These tests hold it to DNR's semantics for every condition the shipped rules use.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMatcher, compileUrlFilter, requestFacts, ruleCovers, EXTENSION_BLOCK_ERRORS } from './block-counter.js';
import { classifyMatchedRule, OUTCOME, BLOCKING_RULESET_IDS } from './protocol.js';

const RULES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'rules');
const rulesets = BLOCKING_RULESET_IDS.map((id) => ({ id, rules: JSON.parse(fs.readFileSync(path.join(RULES, `${id}.json`), 'utf8')) }));
const M = buildMatcher({ rulesets });
const req = (url, initiator = 'https://news.example', type = 'script') => requestFacts({ url, initiator, type, tabId: 1 });
const cat = (r) => { const m = M.match(r); return m ? classifyMatchedRule(m) : null; };

test('the two measured block errors are the only ones counted', () => {
  assert.deepEqual([...EXTENSION_BLOCK_ERRORS].sort(), ['NS_ERROR_ABORT', 'net::ERR_BLOCKED_BY_CLIENT']);
});

test('every shipped block rule covers a request built from its own condition, under its own ruleset', () => {
  let checked = 0;
  for (const { id, rules } of rulesets) {
    for (const r of rules) {
      if (r.action.type !== 'block') continue;
      const c = r.condition;
      let url;
      if (c.requestDomains) url = `https://${c.requestDomains[0]}/x.js`;
      else url = 'https://' + c.urlFilter.replace(/^\|\|/, '').replace(/\*/g, 'a').replace(/\^$/, '?q=1').replace(/\^/g, '/');
      const m = M.match(req(url));
      assert.ok(m, `rule ${id}#${r.id} does not cover ${url}`);
      assert.equal(classifyMatchedRule(m).outcome, OUTCOME.BLOCKED, `${url}`);
      assert.equal(classifyMatchedRule(m).category, id, `${url} credited to ${m.rulesetId}#${m.ruleId}`);
      checked++;
    }
  }
  assert.ok(checked > 150, `only ${checked} rules checked`);
});

test('requestDomains is the domain or a subdomain — never a lookalike', () => {
  assert.equal(cat(req('https://www.google-analytics.com/analytics.js'))?.category, 'analytics');
  assert.equal(cat(req('https://evilgoogle-analytics.com/a.js')), null);
  assert.equal(cat(req('https://google-analytics.com.evil.example/a.js')), null);
});

test('urlFilter: || anchors to a domain boundary, ^ is a separator, * is any run', () => {
  const tr = compileUrlFilter('||facebook.com/tr^');
  assert.ok(tr.test('https://www.facebook.com/tr?id=1&ev=PageView'));
  assert.ok(tr.test('https://facebook.com/tr/'));
  assert.ok(tr.test('https://www.facebook.com/tr'));
  assert.ok(!tr.test('https://www.facebook.com/trending'));
  assert.ok(!tr.test('https://notfacebook.com/tr?id=1'));
  const star = compileUrlFilter('||connect.facebook.net/*fbevents.js');
  assert.ok(star.test('https://connect.facebook.net/en_US/fbevents.js'));
  assert.ok(!star.test('https://connect.facebook.net/en_US/sdk.js'));
});

test('domainType thirdParty: a site\'s own tracker endpoint loaded by the site itself is not covered', () => {
  assert.equal(cat(req('https://www.facebook.com/tr?id=1', 'https://news.example'))?.category, 'social');
  assert.equal(cat(req('https://www.facebook.com/tr?id=1', 'https://www.facebook.com')), null);
});

test('learned rules: excludedInitiatorDomains is honoured, and the dynamic range classifies as "heuristic"', () => {
  const learned = buildMatcher({ dynamic: [{ id: 1_000_001, action: { type: 'block' },
    condition: { requestDomains: ['tracker.example'], domainType: 'thirdParty', excludedInitiatorDomains: ['tracker-cdn.example'] } }] });
  const hit = learned.match(req('https://px.tracker.example/p.gif', 'https://blog.example', 'image'));
  assert.deepEqual(classifyMatchedRule(hit), { outcome: OUTCOME.BLOCKED, category: 'heuristic' });
  assert.equal(learned.match(req('https://px.tracker.example/p.gif', 'https://www.tracker-cdn.example', 'image')), null);
});

test('only block actions are kept; allow, modifyHeaders and an unknown condition key never cover anything', () => {
  const m = buildMatcher({ dynamic: [
    { id: 1, action: { type: 'allow' }, condition: { requestDomains: ['a.example'] } },
    { id: 2, action: { type: 'modifyHeaders' }, condition: { requestDomains: ['b.example'] } },
    { id: 3, action: { type: 'block' }, condition: { requestDomains: ['c.example'], regexFilter: '.*' } },
  ] });
  for (const h of ['a.example', 'b.example', 'c.example']) assert.equal(m.match(req(`https://${h}/x`)), null, h);
  assert.equal(ruleCovers({ action: { type: 'block' }, condition: { requestDomains: ['x.example'] } }, req('notaurl')), false);
});

test('Firefox\'s request shape (documentUrl / originUrl, no initiator) is read the same way', () => {
  const ff = requestFacts({ url: 'https://www.facebook.com/tr?id=1', documentUrl: 'https://news.example/a', originUrl: 'https://news.example/a', type: 'beacon', tabId: 3 });
  assert.equal(ff.initiatorHost, 'news.example');
  assert.equal(ff.type, 'ping', 'Firefox "beacon" is DNR "ping"');
  assert.equal(classifyMatchedRule(M.match(ff)).category, 'social');
});
