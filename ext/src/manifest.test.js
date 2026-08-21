/**
 * Nullecho — manifest claims, checked against the code that has to back them
 * ═════════════════════════════════════════════════════════════════════════
 * Two manifests ship, and each one makes assertions about the extension that a
 * reviewer — and a user reading the install prompt — will take at face value.
 * `PERMISSIONS.md` is the prose version; this file is the part a CI run can fail.
 *
 * The one that matters most is Firefox's `data_collection_permissions`, mandatory
 * for new AMO submissions since 2025-11-03. We declare `["none"]`, which is the
 * strongest possible claim: *nothing is collected or transmitted.* Declaring that
 * falsely would be far worse than declaring a category honestly — it is exactly the
 * kind of overclaim docs/THREAT-MODEL.md exists to make impossible, except aimed at
 * a regulator instead of a user.
 *
 * So `["none"]` is not asserted here. It is *tested*: no egress API may appear
 * anywhere in the shipped source, and the only `fetch` calls allowed are reads of
 * the extension's own bundled files via `chrome.runtime.getURL`.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(EXT, rel), 'utf8');
const manifest = (name) => JSON.parse(read(name));

/** Every shipped source file. Tests and the Node-only rule validator are not shipped. */
function shippedSources() {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|html)$/.test(entry.name) && !entry.name.endsWith('.test.js')) out.push(full);
    }
  }(EXT));
  return out;
}

// ── both manifests parse and agree where they must ─────────────────────────

test('both manifests are valid JSON and declare MV3', () => {
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    const m = manifest(name);
    assert.equal(m.manifest_version, 3, name);
    assert.equal(typeof m.version, 'string', name);
  }
});

test('the two manifests request identical permissions', () => {
  // PERMISSIONS.md: "no user gets a capability the other platform's users are not
  // also giving up." A permission that appears on one side only is either an
  // over-request or an undeclared capability difference; both need a decision, not
  // a drift.
  const chrome = manifest('manifest.json');
  const firefox = manifest('manifest.firefox.json');
  assert.deepEqual([...firefox.permissions].sort(), [...chrome.permissions].sort());
  assert.deepEqual([...firefox.host_permissions].sort(), [...chrome.host_permissions].sort());
});

test('the gpc.js breakage exclusions are identical in both manifests', () => {
  // There is no build step deriving one from the other (PERMISSIONS.md flags this),
  // so a host added to one and forgotten in the other means the site breaks for
  // exactly one browser's users.
  const gpcEntry = (m) => m.content_scripts.find((s) => s.js[0] === 'src/gpc.js');
  assert.deepEqual(
    gpcEntry(manifest('manifest.firefox.json')).exclude_matches,
    gpcEntry(manifest('manifest.json')).exclude_matches,
  );
});

// ── Firefox: the data-collection declaration ───────────────────────────────

test('Firefox declares data_collection_permissions — mandatory for AMO since 2025-11-03', () => {
  const gecko = manifest('manifest.firefox.json').browser_specific_settings.gecko;
  const dcp = gecko.data_collection_permissions;
  assert.ok(dcp, 'without this key AMO will refuse the submission for signing');
  assert.deepEqual(dcp.required, ['none']);
});

test('Firefox `none` cannot be combined with a collected category', () => {
  const dcp = manifest('manifest.firefox.json').browser_specific_settings.gecko.data_collection_permissions;
  assert.equal(dcp.required.length, 1, '"none" is exclusive — it means nothing is collected');
  assert.ok(!dcp.optional || dcp.optional.length === 0);
});

test('strict_min_version is 140+, which is what data_collection_permissions needs', () => {
  // Below 140 the manifest key is not honoured and AMO policy requires shipping a
  // separate, "unmissable" consent experience instead. Raising the floor collapses
  // that whole build into one manifest key; the cost is Firefox 128–139, which for
  // an unlaunched extension is nobody. The key was originally 128 because that is
  // where `world: "MAIN"` landed in static content scripts — 140 keeps that safe.
  const min = manifest('manifest.firefox.json').browser_specific_settings.gecko.strict_min_version;
  assert.match(min, /^\d+\.\d+$/);
  assert.ok(parseInt(min, 10) >= 140, `strict_min_version ${min} is below the 140 floor`);
});

// ── the evidence for "none" ────────────────────────────────────────────────

test('no shipped source can transmit anything off the machine', () => {
  // This is the test that earns the `["none"]` declaration. If someone adds
  // telemetry, a crash reporter, or a "check for blocklist updates" call, the
  // declaration silently becomes false — and false here is a regulatory claim, not
  // a bug. Fail instead.
  const forbidden = [
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
    [/\bsendBeacon\s*\(/, 'navigator.sendBeacon'],
    [/\bnew\s+WebSocket\b/, 'WebSocket'],
    [/\bnew\s+EventSource\b/, 'EventSource'],
    [/\bimportScripts\s*\(/, 'importScripts'],
    [/chrome\.storage\.sync/, 'chrome.storage.sync (would push data through a Google account)'],
    [/navigator\.sendBeacon/, 'navigator.sendBeacon'],
  ];
  for (const file of shippedSources()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const [re, label] of forbidden) {
      assert.ok(!re.test(src), `${path.relative(EXT, file)} uses ${label}`);
    }
  }
});

test('every fetch() reads a bundled extension file, never a remote URL', () => {
  // Two calls exist (background.js and gpc.js), both `chrome.runtime.getURL(...)`
  // of a ruleset we ship. A moz-extension:/chrome-extension: read is not a network
  // request and cannot leak anything.
  const calls = [];
  for (const file of shippedSources()) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bfetch\s*\(([^)]*)\)/g)) {
      calls.push({ file: path.relative(EXT, file), arg: m[1].trim() });
    }
  }
  assert.ok(calls.length > 0, 'expected the bundled-ruleset reads to still be there');
  for (const c of calls) {
    assert.match(c.arg, /^chrome\.runtime\.getURL\(/, `${c.file}: fetch(${c.arg}) is not a bundled read`);
  }
});

test('remote URLs in shipped code are link targets, not request targets', () => {
  // drop.js/drop.html cite CalPrivacy and CPPA. They are hrefs the user clicks and
  // a build-time CSV snapshot's provenance — deliberately embedded so that browsing
  // the broker list makes no network request. Nothing loads them programmatically.
  const loaders = /(?:fetch|open|import|src\s*=|href\s*=\s*(?!["']https?:\/\/(?:privacy\.ca\.gov|consumer\.drop\.privacy\.ca\.gov|cppa\.ca\.gov|globalprivacycontrol\.org|privacyrights\.org|iapp\.org|leginfo\.legislature\.ca\.gov|www\.theguardian\.com)))\s*\(?\s*["']https?:\/\//;
  for (const file of shippedSources()) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!loaders.test(src), `${path.relative(EXT, file)} appears to LOAD a remote URL`);
  }
});

// ── the permission we deliberately do not request ──────────────────────────

test('webRequestBlocking is requested on neither platform, matching PERMISSIONS.md', () => {
  // Firefox retained blocking webRequest and Chrome did not, which is a real
  // capability difference — but Nullecho v0.1 does not use it on either platform.
  // Every block is a DNR rule the browser evaluates, so a bug in the heuristics
  // observer cannot hang a request, and blocking behaviour is identical across the
  // two builds.
  //
  // This test exists because the docs USED to claim the Firefox build was more
  // capable "because Firefox retained blocking webRequest". That was true of
  // Firefox and false of this artifact. The docs were corrected on 2026-08-21
  // (docs/ARCHITECTURE.md, ext/README.md, docs/LAUNCH.md §1.4). If the capability
  // is ever actually taken up, this test is the thing that has to change first —
  // and changing it should force the claim in the UI that PERMISSIONS.md requires.
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    assert.ok(
      !manifest(name).permissions.includes('webRequestBlocking'),
      `${name} requests webRequestBlocking — either use it and update the docs, or drop it`,
    );
  }

  // …and the observer must stay non-blocking. A `['blocking']` extraInfoSpec is
  // what would make the permission necessary.
  const heuristics = read('src/heuristics.js');
  assert.ok(
    !/\[\s*(['"])blocking\1/.test(heuristics),
    'heuristics.js registers a blocking listener but no manifest requests the permission',
  );
});
