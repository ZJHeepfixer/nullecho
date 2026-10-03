/**
 * Nullecho for Safari — manifest and package invariants.
 *
 * Everything here is asserted on the ASSEMBLED folder (what the container app ships), not on the
 * template: the build fills the version and the exclusion lists, so the template alone proves
 * nothing. `NULLECHO_SAFARI_DIST=<dir>` points the suite at another tree to show a test failing.
 *
 * Run: `node --test safari/test/*.test.mjs` from the repo root (Node 22; `node --test safari/test/` needs a newer Node).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { distDir, readJson, walk, EXT, SAFARI_SRC, REPO } from './helpers.mjs';
import { build, FORBIDDEN } from '../tools/build-extension.mjs';

const DIST = await distDir();
const manifest = readJson(path.join(DIST, 'manifest.json'));
const extManifest = readJson(path.join(EXT, 'manifest.json'));
const files = walk(DIST);

// ── permissions: what the audit allows and what it rules out ─────────────────

test('permissions are exactly declarativeNetRequest + declarativeNetRequestWithHostAccess', () => {
  assert.deepEqual([...manifest.permissions].sort(), ['declarativeNetRequest', 'declarativeNetRequestWithHostAccess'],
    'modifyHeaders (the Sec-GPC header) needs WithHostAccess in Safari; nothing else in phase 1 needs a permission');
});

test('no webRequest, no declarativeNetRequestFeedback, no scripting', () => {
  for (const p of ['webRequest', 'webRequestBlocking', 'declarativeNetRequestFeedback', 'scripting', 'userScripts', 'storage', 'alarms']) {
    assert.ok(!manifest.permissions.includes(p), `permission "${p}" must not ship — the learner cannot work in Safari (audit 01 §0) and phase 1 has no worker`);
  }
  assert.ok(!(manifest.optional_permissions ?? []).length, 'no optional permissions either');
});

test('host_permissions is <all_urls> (GPC needs every site) and nothing else', () => {
  assert.deepEqual(manifest.host_permissions, ['<all_urls>']);
});

test('no background worker', () => {
  assert.equal(manifest.background, undefined, 'phase 1 needs no worker: no updateStaticRules call, no settings, no counters');
});

// ── identity ────────────────────────────────────────────────────────────────

test('version equals ext/manifest.json (single source of truth)', () => {
  assert.equal(manifest.version, extManifest.version);
  assert.notEqual(manifest.version, '0.0.0', 'the template placeholder leaked into the build');
});

test('name is Nullecho and the description does not over-claim', () => {
  assert.equal(manifest.name, 'Nullecho');
  assert.equal(manifest.manifest_version, 3);
  const d = manifest.description;
  assert.match(d, /Global Privacy Control/);
  assert.match(d, /tracker/i);
  for (const bad of [/\bstops?\b/i, /protects? you from fingerprinting/i, /\bevery request\b/i, /\banonym/i, /\bprevents?\b/i]) {
    assert.doesNotMatch(d, bad, `description over-claims: ${d}`);
  }
});

// ── the file set: exactly what the manifest reaches, none of the Chrome lanes ──

test('every file the manifest references exists in the folder', () => {
  const refs = new Set(['manifest.json']);
  for (const cs of manifest.content_scripts) for (const f of cs.js) refs.add(f);
  for (const r of manifest.declarative_net_request.rule_resources) refs.add(r.path);
  for (const v of Object.values(manifest.icons)) refs.add(v);
  for (const v of Object.values(manifest.action.default_icon)) refs.add(v);
  refs.add(manifest.action.default_popup);
  for (const r of refs) assert.ok(fs.existsSync(path.join(DIST, r)), `referenced but missing: ${r}`);
  // and nothing unreferenced rides along (the popup is self-contained)
  const extra = files.filter((f) => !refs.has(f));
  assert.deepEqual(extra, [], 'files in the folder that nothing references');
});

test('no shim, persona, UA, pricing, learner, worker, test or tool file ships', () => {
  const bad = files.filter((f) => FORBIDDEN.some((re) => re.test(f)));
  assert.deepEqual(bad, []);
  for (const name of ['shim.js', 'shim-loader.js', 'personas.js', 'persona-validator.js', 'pricing.js', 'pricing-scan.js',
    'heuristics.js', 'background.js', 'linkage.js', 'allowlist.js', 'ua-win.json', 'ua-mac.json', 'ua-linux.json', 'options.html', 'popup.js']) {
    assert.ok(!files.some((f) => f.endsWith('/' + name) || f === name), `${name} must not ship in the Safari build`);
  }
  // Every Safari-authored or generated file (gpc.js is ext's verbatim and its comments discuss the shim by name).
  for (const f of files.filter((x) => /\.(js|json|html)$/.test(x) && x !== 'src/gpc.js')) {
    assert.doesNotMatch(fs.readFileSync(path.join(DIST, f), 'utf8'), /personas?\.js|shim\.js|heuristics\.js|pricing/, `${f} still refers to a Chrome lane`);
  }
});

test('src/gpc.js and the icons are byte-identical to ext/', () => {
  assert.equal(fs.readFileSync(path.join(DIST, 'src/gpc.js'), 'utf8'), fs.readFileSync(path.join(EXT, 'src/gpc.js'), 'utf8'));
  for (const f of files.filter((x) => x.startsWith('icons/'))) {
    assert.ok(fs.readFileSync(path.join(DIST, f)).equals(fs.readFileSync(path.join(EXT, f))), `${f} differs from ext/`);
  }
});

test('no fixture or test host leaks into a shipped rule, manifest, loader or popup', () => {
  // gpc.js is ext's verbatim (asserted below) and its comments cite `a.test`-style rig hosts; everything else is ours.
  for (const f of files.filter((x) => /\.(js|json|html)$/.test(x) && x !== 'src/gpc.js')) {
    const text = fs.readFileSync(path.join(DIST, f), 'utf8');
    assert.doesNotMatch(text, /lvh\.me|localhost|127\.0\.0\.1|example\.com|\.invalid\b/, `${f} contains a test host`);
  }
  for (const f of files.filter((x) => x.startsWith('rules/'))) {
    const text = fs.readFileSync(path.join(DIST, f), 'utf8');
    assert.doesNotMatch(text, /lvh\.me|localhost|\.test"|\.invalid"/, `${f} ships a fixture host`);
  }
});

// ── content scripts: the GPC pair ───────────────────────────────────────────

test('content scripts are the ISOLATED loader then the MAIN gpc.js, both at document_start in every frame', () => {
  const cs = manifest.content_scripts;
  assert.equal(cs.length, 2);
  assert.deepEqual(cs[0].js, ['src/gpc-loader.js']);
  assert.equal(cs[0].world, 'ISOLATED');
  assert.deepEqual(cs[1].js, ['src/gpc.js']);
  assert.equal(cs[1].world, 'MAIN');
  for (const e of cs) {
    assert.deepEqual(e.matches, ['<all_urls>']);
    assert.equal(e.run_at, 'document_start', 'later and the page reads GPC before it is set');
    assert.equal(e.all_frames, true);
    assert.equal(e.match_about_blank, true);
    assert.equal(e.match_origin_as_fallback, true);
  }
});

test('both content scripts carry exactly the exclude_matches of ext/manifest.json\'s gpc.js entry', () => {
  const ext = extManifest.content_scripts.find((e) => e.js.includes('src/gpc.js')).exclude_matches;
  assert.ok(ext.length >= 40, 'the shipped breakage list is ~50 hosts');
  for (const e of manifest.content_scripts) assert.deepEqual(e.exclude_matches, ext);
  // …and that list is the header rule's exclusion list, as validate.mjs enforces for Chrome
  const rule5000 = readJson(path.join(DIST, 'rules/gpc.json')).find((r) => r.id === 5000);
  const fromMatches = ext.map((p) => /^\*:\/\/\*\.([a-z0-9.-]+)\/\*$/.exec(p)?.[1]).filter(Boolean).sort();
  assert.deepEqual(fromMatches, [...rule5000.condition.excludedRequestDomains].sort(), 'header and property exclusions drifted');
});

// ── popup: static, honest ────────────────────────────────────────────────────

test('the popup is static HTML with no script and honest copy', () => {
  const html = fs.readFileSync(path.join(DIST, manifest.action.default_popup), 'utf8');
  assert.doesNotMatch(html, /<script/i, 'the popup must not run code: it cannot know live state without permissions');
  assert.match(html, /prefers-color-scheme:\s*dark/);
  assert.match(html, /Global Privacy Control/);
  for (const bad of [/\bstops?\b/i, /protects? you from fingerprinting/i, /\banonym/i, /every request/i]) assert.doesNotMatch(html, bad);
  assert.match(html, /image and script requests only/, 'the Safari header limit must be disclosed (audit §3.2)');
});

// ── the build refuses what it must refuse ───────────────────────────────────

async function buildWithTemplate(mutate) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-safari-mut-'));
  const t = readJson(path.join(SAFARI_SRC, 'manifest.json'));
  mutate(t);
  const templatePath = path.join(tmp, 'manifest.json');
  fs.writeFileSync(templatePath, JSON.stringify(t));
  return build({ outDir: path.join(tmp, 'out'), templatePath, quiet: true });
}

test('the build hard-fails on a referenced file that does not exist', async () => {
  await assert.rejects(buildWithTemplate((t) => { t.icons['256'] = 'icons/icon-256.png'; }), /MISSING[\s\S]*icons\/icon-256\.png/);
});

test('the build refuses to pull a Chrome lane file out of ext/', async () => {
  // shim.js exists in ext/src, but it is not in EXT_SHARED, so it is MISSING from the Safari point of view —
  // referenced through a slot the manifest checks do not police, to reach the file resolver.
  await assert.rejects(buildWithTemplate((t) => { t.web_accessible_resources = [{ resources: ['src/shim.js'], matches: ['<all_urls>'] }]; }), /MISSING[\s\S]*src\/shim\.js/);
  await assert.rejects(buildWithTemplate((t) => { t.web_accessible_resources = [{ resources: ['src/personas.js'], matches: ['<all_urls>'] }]; }), /src\/personas\.js/);
});

test('the build refuses webRequest and a background worker', async () => {
  await assert.rejects(buildWithTemplate((t) => { t.permissions.push('webRequest'); }), /forbidden permission "webRequest"/);
  await assert.rejects(buildWithTemplate((t) => { t.background = { service_worker: 'src/gpc.js' }; }), /background worker/);
});

test('the build refuses a template that drops the placeholders', async () => {
  await assert.rejects(buildWithTemplate((t) => { t.version = '9.9.9'; }), /placeholder version/);
  await assert.rejects(buildWithTemplate((t) => { t.content_scripts[1].exclude_matches = ['*://*.example.com/*']; }), /placeholder "exclude_matches"/);
});

test('--zip writes the manifest at the zip root with the same file set', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nullecho-safari-zip-'));
  const r = await build({ outDir: path.join(tmp, 'safari', 'extension'), zip: true, quiet: true });
  assert.ok(r.zipPath && fs.existsSync(r.zipPath), 'zip not written');
  assert.equal(path.basename(r.zipPath), `nullecho-${extManifest.version}-safari.zip`);
  const { execFileSync } = await import('node:child_process');
  const listing = execFileSync('unzip', ['-Z1', r.zipPath], { encoding: 'utf8' }).trim().split('\n').filter((f) => !f.endsWith('/')).sort();
  assert.deepEqual(listing, files);
});

test('the contract path: a no-argument build lands at dist/safari/extension/manifest.json', () => {
  // Not run here (tests must not write into the repo); pinned by reading the default.
  const src = fs.readFileSync(path.join(REPO, 'safari/tools/build-extension.mjs'), 'utf8');
  assert.match(src, /path\.join\(REPO, 'dist', 'safari', 'extension'\)/);
});
