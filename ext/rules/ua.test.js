/**
 * Nullecho — the per-family Client-Hint rulesets
 * ───────────────────────────────────────────────
 * `ua-win.json`, `ua-mac.json`, `ua-linux.json` are the only rulesets that are
 * generated rather than written (see gen-ua.mjs). These tests pin:
 *
 *   1. the shipped bytes equal the generator's output;
 *   2. D51 (2026-09-28): nothing the browser writes about itself is rewritten —
 *      no `set`, no User-Agent, no Sec-CH-UA / -Mobile / -Platform — because the
 *      shim now reports the REAL browser to the page, and a rewritten header would
 *      contradict it; and no version string of any kind is in the files;
 *   3. D49: the seven Accept-CH hints are REMOVED, never added;
 *   4. the rule shape: the navigation itself is covered, every transport (Chrome
 *      sends hints to http://localhost — measured), the store origins excluded.
 *
 * The JS-side half — the real shim booted per persona in a realm whose browser is
 * NOT 151, its `navigator` read back and compared to what goes on the wire — lives
 * in `src/review-2026-09-16.test.js` (B2), because that file owns the page realm.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  UA_RULESETS, UA_EXCLUDED_DOMAINS, UA_RESOURCE_TYPES, REMOVED_HINTS, NEVER_REWRITTEN,
  rulesForFamily, buildUaRulesets, serialise,
} from './gen-ua.mjs';
import { FAMILIES } from '../src/personas.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');

// ── 1. shipped == generated ───────────────────────────────────────────────

test('the shipped ua-*.json files are exactly what gen-ua.mjs emits', () => {
  const expected = buildUaRulesets();
  assert.deepEqual(Object.keys(expected).sort(), FAMILIES.map((f) => UA_RULESETS[f].file).sort());
  for (const [file, rules] of Object.entries(expected)) {
    assert.equal(read(file), serialise(rules), `${file} drifted — run \`node rules/gen-ua.mjs\``);
  }
});

test('the generator is deterministic', () => {
  assert.deepEqual(buildUaRulesets(), buildUaRulesets());
});

// ── 2. D51: nothing the browser says about itself is rewritten ────────────

test('D51: no ruleset rewrites User-Agent, Sec-CH-UA, -Mobile or -Platform, and none SETS anything', () => {
  assert.deepEqual(NEVER_REWRITTEN, ['User-Agent', 'Sec-CH-UA', 'Sec-CH-UA-Mobile', 'Sec-CH-UA-Platform']);
  for (const family of FAMILIES) {
    const file = UA_RULESETS[family].file;
    const rules = JSON.parse(read(file));
    for (const r of rules) {
      assert.equal(r.action.responseHeaders, undefined, `${file}: rewrites a response header`);
      for (const h of r.action.requestHeaders) {
        assert.equal(h.operation, 'remove', `${file}: "${h.operation}" on ${h.header} — the page is shown the real browser; the wire must say the same`);
        assert.ok(!NEVER_REWRITTEN.map((n) => n.toLowerCase()).includes(h.header.toLowerCase()), `${file}: touches ${h.header}`);
      }
    }
  }
});

test('D51: the rulesets carry no browser name, version or GREASE entry at all — nothing that can go stale', () => {
  for (const family of FAMILIES) {
    const text = read(UA_RULESETS[family].file);
    assert.doesNotMatch(text, /Chrome\/|Mozilla|Brand|\b1[0-9]{2}\b/, `${family}: a version or brand string is back`);
    assert.doesNotMatch(text, /"value"/, `${family}: a header value is back`);
  }
});

test('D51: the three families emit the same rule — the family no longer changes anything but the id', () => {
  const strip = (rules) => rules.map(({ id, ...rest }) => rest);
  const [first, ...rest] = FAMILIES.map((f) => strip(rulesForFamily(f)));
  for (const r of rest) assert.deepEqual(r, first);
});

// ── 3. D49: the seven Accept-CH hints are removed ─────────────────────────

test('D49: each family removes exactly the seven Accept-CH hints, and adds none', () => {
  assert.deepEqual(REMOVED_HINTS, [
    'Sec-CH-UA-Full-Version-List', 'Sec-CH-UA-Full-Version', 'Sec-CH-UA-Platform-Version',
    'Sec-CH-UA-Arch', 'Sec-CH-UA-Bitness', 'Sec-CH-UA-Model', 'Sec-CH-UA-WoW64',
  ]);
  for (const family of FAMILIES) {
    const headers = rulesForFamily(family).flatMap((r) => r.action.requestHeaders);
    assert.deepEqual(headers.map((h) => h.header), REMOVED_HINTS, family);
    for (const h of headers) {
      assert.equal(h.operation, 'remove');
      assert.equal(h.value, undefined, 'a remove carries no value');
    }
  }
});

// ── 4. rule shape ─────────────────────────────────────────────────────────

test('each family ships one rule: the hint removal, on every transport, covering the navigation, below the allowlist', () => {
  for (const family of FAMILIES) {
    const rules = rulesForFamily(family);
    assert.equal(rules.length, 1, `${family}: the User-Agent rule is retired (D51)`);
    const [r] = rules;
    const [lo, hi] = UA_RULESETS[family].range;
    assert.equal(r.id, lo + 1, `${family}: the hint rule keeps its pre-D51 id`);
    assert.ok(r.id >= lo && r.id <= hi);
    assert.equal(r.priority, 1, 'below the allowlist\'s allowAllRequests (100000), so an allowlisted site keeps its real hints next to its real navigator');
    assert.equal(r.action.type, 'modifyHeaders');
    // Not https-only (D51): measured in CfT 149, Chrome sends every requested hint to
    // http://localhost (a secure context), and the old ^(https|wss):// filter let them through.
    assert.equal(r.condition.regexFilter, undefined, 'the removal covers http too');
    assert.equal(r.condition.urlFilter, undefined);
    assert.ok(r.condition.resourceTypes.includes('main_frame'), 'the navigation is the first request the server sees');
    assert.deepEqual(r.condition.resourceTypes, UA_RESOURCE_TYPES);
    assert.deepEqual(r.condition.excludedRequestDomains, UA_EXCLUDED_DOMAINS);
    assert.deepEqual(r.condition.excludedInitiatorDomains, UA_EXCLUDED_DOMAINS);
  }
});

test('the excluded origins are the ones where content scripts cannot run (so the JS there is real)', () => {
  assert.deepEqual(UA_EXCLUDED_DOMAINS, ['chromewebstore.google.com', 'addons.mozilla.org']);
  for (const d of UA_EXCLUDED_DOMAINS) assert.match(d, /^[a-z0-9.-]+$/);
});
