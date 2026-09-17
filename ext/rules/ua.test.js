/**
 * Nullecho — the per-family User-Agent / Client-Hint rulesets
 * ───────────────────────────────────────────────────────────
 * `ua-win.json`, `ua-mac.json`, `ua-linux.json` are the only rulesets that are
 * generated rather than written (see gen-ua.mjs). These tests pin:
 *
 *   1. the shipped bytes equal the generator's output (drift = a header that no
 *      longer matches the JS persona, which is REVIEW-2026-09-16 B2 come back);
 *   2. the residual contradictions are exactly the ones DECISIONS.md D19
 *      documents — one persona, one header — so a pool change that adds a
 *      second one fails here instead of shipping;
 *   3. the wire format is Chrome's (RFC 8941 structured fields), byte for byte;
 *   4. the rule shape: the navigation itself is covered, hints go only over
 *      secure transports, the store origins are excluded on both sides.
 *
 * The JS-side half of the comparison — the real shim booted per persona, its
 * `navigator` read back and compared to these bytes — lives in
 * `src/review-2026-09-16.test.js` (B2), because that file owns the page realm.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  UA_RULESETS, UA_EXCLUDED_DOMAINS, UA_RESOURCE_TYPES, SECURE_ONLY, ALWAYS_SENT,
  shimGrease, brandsFor, sfString, sfBoolean, sfBrandList,
  headersForPersona, familyHeaderPlan, rulesForFamily, buildUaRulesets, serialise,
} from './gen-ua.mjs';
import { PERSONAS, FAMILIES, familyOf } from '../src/personas.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');

const HEADERS = [
  'User-Agent', 'Sec-CH-UA', 'Sec-CH-UA-Mobile', 'Sec-CH-UA-Platform',
  'Sec-CH-UA-Full-Version-List', 'Sec-CH-UA-Full-Version', 'Sec-CH-UA-Platform-Version',
  'Sec-CH-UA-Arch', 'Sec-CH-UA-Bitness', 'Sec-CH-UA-Model', 'Sec-CH-UA-WoW64',
];

// ── 1. shipped == generated ───────────────────────────────────────────────

test('the shipped ua-*.json files are exactly what gen-ua.mjs derives from personas.js + shim.js', () => {
  const expected = buildUaRulesets();
  assert.deepEqual(Object.keys(expected).sort(), FAMILIES.map((f) => UA_RULESETS[f].file).sort());
  for (const [file, rules] of Object.entries(expected)) {
    assert.equal(read(file), serialise(rules), `${file} drifted — run \`node rules/gen-ua.mjs\``);
  }
});

test('the generator is deterministic', () => {
  assert.deepEqual(buildUaRulesets(), buildUaRulesets());
});

test('the GREASE brand is read from the real shim, not assumed', () => {
  const g = shimGrease();
  assert.ok(g.brand.length > 0 && g.version.length > 0);
  assert.ok(g.brand.includes('Brand'), `GREASE brand "${g.brand}" does not look like a Chrome grease entry`);
  assert.throws(() => shimGrease('// no grease here'), /could not find/);
});

// ── 2. residuals are exactly the documented ones ──────────────────────────

test('every persona in the pool is covered by exactly one family ruleset', () => {
  const seen = new Map();
  for (const family of FAMILIES) {
    for (const p of PERSONAS.filter((p) => familyOf(p) === family)) {
      assert.ok(!seen.has(p.id), `${p.id} in two families`);
      seen.set(p.id, family);
    }
  }
  assert.equal(seen.size, PERSONAS.length);
});

test('the only header/JS disagreement in the whole pool is the Intel-Mac persona\'s architecture (D19)', () => {
  const residuals = FAMILIES.flatMap((f) => familyHeaderPlan(f).residuals.map((r) => ({ family: f, ...r })));
  assert.deepEqual(residuals, [{
    family: 'mac',
    persona: 'macos-chrome-intel-iris',
    header: 'Sec-CH-UA-Arch',
    persona_value: '"x86"',
    header_value: '"arm"',
  }], 'a pool change added or removed a residual — update DECISIONS.md D19 and this list together');
});

test('the majority value wins by persona WEIGHT, so the residual is the rare persona, not the common one', () => {
  const mac = PERSONAS.filter((p) => familyOf(p) === 'mac');
  const armWeight = mac.filter((p) => p.uaData.architecture === 'arm').reduce((a, p) => a + p.weight, 0);
  const x86Weight = mac.filter((p) => p.uaData.architecture === 'x86').reduce((a, p) => a + p.weight, 0);
  assert.ok(armWeight > x86Weight, `arm ${armWeight} vs x86 ${x86Weight}`);
  assert.equal(familyHeaderPlan('mac').headers['Sec-CH-UA-Arch'], '"arm"');
});

// ── 3. wire format ────────────────────────────────────────────────────────

test('structured-field serialisation matches what Chrome puts on the wire', () => {
  assert.equal(sfString('macOS'), '"macOS"');
  assert.equal(sfString(''), '""', 'Sec-CH-UA-Model on desktop is an empty sf-string, not an absent header');
  assert.equal(sfString('a"b\\c'), '"a\\"b\\\\c"');
  assert.equal(sfBoolean(false), '?0');
  assert.equal(sfBoolean(true), '?1');
  const g = { brand: 'Not;A=Brand', version: '99' };
  const b = brandsFor('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', g);
  assert.equal(sfBrandList(b.brands), '"Not;A=Brand";v="99", "Chromium";v="151", "Google Chrome";v="151"');
  assert.equal(sfBrandList(b.fullVersionList), '"Not;A=Brand";v="99.0.0.0", "Chromium";v="151.0.0.0", "Google Chrome";v="151.0.0.0"');
  assert.equal(b.full, '151.0.0.0');
});

test('per-persona headers are the persona\'s own ua / uaData fields, field by field', () => {
  const g = shimGrease();
  for (const p of PERSONAS) {
    const h = headersForPersona(p, g);
    assert.deepEqual(Object.keys(h), HEADERS, p.id);
    assert.equal(h['User-Agent'], p.ua);
    assert.equal(h['Sec-CH-UA-Platform'], sfString(p.uaData.platform));
    assert.equal(h['Sec-CH-UA-Platform-Version'], sfString(p.uaData.platformVersion));
    assert.equal(h['Sec-CH-UA-Arch'], sfString(p.uaData.architecture));
    assert.equal(h['Sec-CH-UA-Bitness'], sfString(p.uaData.bitness));
    assert.equal(h['Sec-CH-UA-Model'], sfString(p.uaData.model));
    assert.equal(h['Sec-CH-UA-WoW64'], sfBoolean(p.uaData.wow64));
    assert.equal(h['Sec-CH-UA-Mobile'], '?0', 'every persona is a desktop');
    const major = /Chrome\/(\d+)/.exec(p.ua)[1];
    assert.ok(h['Sec-CH-UA'].includes(`"Google Chrome";v="${major}"`));
    assert.ok(h['Sec-CH-UA-Full-Version-List'].includes(`"Google Chrome";v="${major}.0.0.0"`));
    assert.equal(h['Sec-CH-UA-Full-Version'], sfString(`${major}.0.0.0`));
  }
});

// ── 4. rule shape ─────────────────────────────────────────────────────────

test('each family ships two rules: User-Agent everywhere, the hints on secure transports only', () => {
  for (const family of FAMILIES) {
    const [ua, ch] = rulesForFamily(family);
    const [lo, hi] = UA_RULESETS[family].range;
    for (const r of [ua, ch]) {
      assert.ok(r.id >= lo && r.id <= hi, `${family}: id ${r.id} outside ${lo}-${hi}`);
      assert.equal(r.priority, 1, 'below the allowlist\'s allowAllRequests (100000), so an allowlisted site keeps its REAL headers next to its real navigator');
      assert.equal(r.action.type, 'modifyHeaders');
      assert.ok(r.condition.resourceTypes.includes('main_frame'), 'the navigation is the first request the server sees');
      assert.deepEqual(r.condition.resourceTypes, UA_RESOURCE_TYPES);
      assert.deepEqual(r.condition.excludedRequestDomains, UA_EXCLUDED_DOMAINS);
      assert.deepEqual(r.condition.excludedInitiatorDomains, UA_EXCLUDED_DOMAINS);
      for (const h of r.action.requestHeaders) assert.equal(h.operation, 'set');
    }
    assert.deepEqual(ua.action.requestHeaders.map((h) => h.header), ['User-Agent']);
    assert.equal(ua.condition.regexFilter, undefined, 'User-Agent goes on every request, http included');
    assert.equal(ch.condition.regexFilter, SECURE_ONLY, 'Chrome never sends Client Hints over plain http');
    assert.deepEqual(ch.action.requestHeaders.map((h) => h.header), HEADERS.filter((h) => h !== 'User-Agent'));
    // The ones Chrome sends unconditionally are all covered; the rest are the
    // Accept-CH hints, which `set` sends regardless — the documented D19 tell.
    for (const name of ALWAYS_SENT) assert.ok(HEADERS.includes(name));
  }
});

test('the secure-only filter is a valid RE2 pattern that matches https/wss and nothing else', () => {
  const re = new RegExp(SECURE_ONLY);
  assert.ok(re.test('https://a.example/x'));
  assert.ok(re.test('wss://a.example/socket'));
  assert.ok(!re.test('http://a.example/x'));
  assert.ok(!re.test('ws://a.example/socket'));
  assert.ok(!SECURE_ONLY.includes('(?'), 'RE2 has no lookaround / backreferences');
});

test('the excluded origins are the ones where content scripts cannot run (so the JS there is real)', () => {
  assert.deepEqual(UA_EXCLUDED_DOMAINS, ['chromewebstore.google.com', 'addons.mozilla.org']);
  for (const d of UA_EXCLUDED_DOMAINS) assert.match(d, /^[a-z0-9.-]+$/);
});
