/**
 * 0.9.2 — the public privacy page (site/privacy/index.html, nullecho.org/privacy) and its source
 * of truth (docs/PRIVACY-POLICY.md) list every key the extension writes, with the numbers the code
 * actually enforces, and name all three browsers the package ships to.
 *
 * Found 2026-10-14: the page said its table was "the exact list" from grepping every
 * `storage.local.set` call, but it omitted `pricingObservations` (background.js §3) — the one key
 * that holds page text — named only Chrome and Firefox, and said no key holds browsing history while
 * `stats` is a list of up to 500 visited sites with last-seen times. This pins the parts a test can.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICING_STORAGE_KEY, MAX_SITES, MAX_TRACKERS_PER_SITE } from './protocol.js';
import './pricing.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.join(HERE, '..');
const REPO = path.join(EXT, '..');
const PAGE = fs.readFileSync(path.join(REPO, 'site', 'privacy', 'index.html'), 'utf8');
const POLICY = fs.readFileSync(path.join(REPO, 'docs', 'PRIVACY-POLICY.md'), 'utf8');
const P = globalThis.NullechoPricing;

/** Every key the shipped extension writes to storage.local, from the source (see the call-site test). */
const KEYS = ['identity', 'settings', 'allowlist', 'stats', 'nullecho:heuristics:v1', 'nullecho:gpc:v1',
  'nullecho.drop.residency', 'nullecho.drop.submittedAt', PRICING_STORAGE_KEY];

function shipped() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'tools') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.js$/.test(e.name) && !/\.test\.js$|test-realm-rig\.js$/.test(e.name)) out.push(full);
    }
  }(EXT));
  return out;
}

test('every storage.local write site is one the policy accounts for — a new one fails here first', () => {
  const sites = [];
  for (const f of shipped()) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/storage\.local\.set\(\s*([^)]*)\)/g)) sites.push(`${path.relative(EXT, f)}: ${m[1].replace(/\s+/g, ' ')}`);
  }
  assert.deepEqual(sites.sort(), [
    'options/drop.js: obj',                                        // DROP_KEYS only (store.set wrapper)
    'src/background.js: { [PRICING_STORAGE_KEY]: list }',
    'src/background.js: { allowlist: [...allowlist] }',
    'src/background.js: { identity }',
    'src/background.js: { identity }',
    'src/background.js: { settings }',
    'src/background.js: { stats }',
    'src/background.js: { stats }',
    'src/gpc.js: { [STORAGE_KEY]: { exceptions: userExceptions } }',
    'src/heuristics.js: { [STORAGE_KEY]: state }',
  ].sort(), 'a storage write was added or changed: update docs/PRIVACY-POLICY.md, site/privacy/index.html and this list');
});

test('both privacy documents list every key, including pricingObservations', () => {
  for (const [name, doc] of [['site/privacy/index.html', PAGE], ['docs/PRIVACY-POLICY.md', POLICY]]) {
    for (const k of KEYS) assert.ok(doc.includes(k), `${name} omits the storage key ${k}`);
  }
});

test('the numbers the documents state are the numbers the code enforces', () => {
  assert.equal(MAX_SITES, 500);
  assert.equal(MAX_TRACKERS_PER_SITE, 60);
  assert.equal(P.RECEIPT_CAP, 200);
  assert.equal(P.MAX_CONTEXT, 200);
  for (const [name, doc] of [['site', PAGE], ['policy', POLICY]]) {
    assert.match(doc, /At most 500 sites/, `${name}: stats cap`);
    assert.match(doc, /60 tracker domains per site/, `${name}: tracker cap`);
    assert.match(doc, /up to 200 characters of the page's own text/, `${name}: context length`);
    assert.match(doc, /more than\s+200/, `${name}: receipt cap`);
    assert.match(doc, /query string removed/, `${name}: query stripping`);
  }
  // The stored URL really has no query string — or fragment — and the context really is capped.
  const e = P.observation({ siteKey: 'shop.example', url: 'https://shop.example/p/1?cart=abc#x', level: 'ny-disclosure', context: 'y'.repeat(500) });
  assert.equal(e.url, 'https://shop.example/p/1');
  assert.equal(e.context.length, 200);
});

test('both documents cover Chrome, Microsoft Edge and Firefox, and no longer say no key holds browsing history', () => {
  for (const [name, doc] of [['site', PAGE], ['policy', POLICY]]) {
    for (const b of ['Chrome', 'Microsoft Edge', 'Firefox']) assert.ok(doc.includes(b), `${name} does not name ${b}`);
    assert.doesNotMatch(doc, /None of these keys contain your browsing history/, `${name} still claims no browsing history is kept`);
    assert.doesNotMatch(doc, /both store listings/, `${name} still says "both" store listings`);
  }
});

test('storage.session holds exactly one key, the per-tab blocked tally, and both documents describe it (D55)', () => {
  const sites = [];
  for (const f of shipped()) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/storage\.session\??\.set\(\s*([^)]*)\)/g)) sites.push(`${path.relative(EXT, f)}: ${m[1].replace(/\s+/g, ' ')}`);
  }
  assert.deepEqual(sites, ['src/background.js: { [TAB_TALLY_KEY]: tabTallies }']);
  assert.match(fs.readFileSync(path.join(EXT, 'src', 'background.js'), 'utf8'), /const TAB_TALLY_KEY = 'nullecho:tab-blocked';/);
  for (const [name, doc] of [['site', PAGE], ['policy', POLICY]]) {
    assert.ok(doc.includes('storage.session') && doc.includes('nullecho:tab-blocked'), `${name} omits the session tally`);
  }
});

test('both documents point at the "Clear saved price notices" button, and no longer say there is none', () => {
  const html = fs.readFileSync(path.join(EXT, 'options', 'options.html'), 'utf8');
  assert.match(html, />Clear saved price notices</);
  for (const [name, doc] of [['site', PAGE], ['policy', POLICY]]) {
    assert.match(doc, /Clear saved\s+price notices/, `${name} does not mention the button`);
    assert.doesNotMatch(doc, /no button to\s+clear/, `${name} still says there is no button`);
  }
});
