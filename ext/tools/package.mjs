#!/usr/bin/env node
/**
 * Package the extension for a store: EXACTLY the files the manifest reaches, nothing else.
 *
 *   node ext/tools/package.mjs            # → dist/nullecho-<version>-chrome.zip
 *   node ext/tools/package.mjs --firefox  # → dist/nullecho-<version>-firefox.zip (manifest.firefox.json as manifest.json)
 *   node ext/tools/package.mjs --list     # print the file set and exit; no zip
 *   npm run package  /  npm run package:firefox   (from ext/)
 *
 * WHY DERIVE INSTEAD OF ALLOWLIST. `ext/` carries tests (`*.test.js`), a shared test rig, a persona
 * validator, three generators with shebangs, READMEs and package.json — none of which belong in a
 * shipped package, and `web-ext lint` on the raw tree fails on exactly those files (store-listing
 * pass, 2026-09-22). A hand-kept allowlist drifts the day someone adds a module. So the set is
 * computed: start from every path the manifest names (background worker, content scripts, popup,
 * options page, icons, rule resources, web-accessible resources), then close over ES-module
 * `import` statements in .js files and local `<script src>` / `<link href>` / `<img src>` in .html
 * files. A file the manifest cannot reach is not shipped, and a missing file is a hard error, not
 * a warning.
 *
 * Chrome's own `_metadata/` (written when the tree is loaded unpacked) is never picked up because
 * nothing references it. The zip root is the extension root (manifest.json at top level), which
 * is what both stores expect.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');
const REPO = path.resolve(EXT, '..');
const argv = process.argv.slice(2);
const FIREFOX = argv.includes('--firefox');
const LIST_ONLY = argv.includes('--list');

const manifestFile = FIREFOX ? 'manifest.firefox.json' : 'manifest.json';
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, manifestFile), 'utf8'));

// ── 1. roots: every path the manifest names ────────────────────────────────
const roots = new Set();
roots.add(manifestFile);                       // the manifest ships too (renamed to manifest.json for the Firefox build)
const add = (p) => { if (typeof p === 'string' && p && !/^(https?:|data:|chrome:|moz-extension:|chrome-extension:)/.test(p)) roots.add(p.replace(/^\.?\//, '')); };
add(manifest.background?.service_worker);
for (const s of manifest.background?.scripts ?? []) add(s);
for (const cs of manifest.content_scripts ?? []) { for (const f of cs.js ?? []) add(f); for (const f of cs.css ?? []) add(f); }
add(manifest.action?.default_popup);
for (const v of Object.values(manifest.action?.default_icon ?? {})) add(v);
for (const v of Object.values(manifest.icons ?? {})) add(v);
add(manifest.options_page); add(manifest.options_ui?.page);
for (const r of manifest.declarative_net_request?.rule_resources ?? []) add(r.path);
for (const w of manifest.web_accessible_resources ?? []) for (const r of w.resources ?? []) { if (!/[*?]/.test(r)) add(r); else for (const m of glob(r)) add(m); }
if (manifest.default_locale) for (const m of glob('_locales/**/*.json')) add(m);

function glob(pattern) {
  // minimal glob: ** and * only, relative to EXT
  const re = new RegExp('^' + pattern.split('**').map((seg) => seg.split('*').map(escapeRe).join('[^/]*')).join('.*') + '$');
  const out = [];
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name); const rel = path.relative(EXT, full);
      if (ent.isDirectory()) { if (ent.name !== 'node_modules' && ent.name !== '_metadata') walk(full); }
      else if (re.test(rel)) out.push(rel);
    }
  })(EXT);
  return out;
}
function escapeRe(s) { return s.replace(/[.+^${}()|[\]\\]/g, '\\$&'); }

// ── 2. closure over imports and HTML asset references ──────────────────────
const files = new Set();
const missing = [];
const queue = [...roots];
while (queue.length) {
  const rel = queue.shift();
  if (files.has(rel)) continue;
  const full = path.join(EXT, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) { missing.push(rel); continue; }
  files.add(rel);
  const ext = path.extname(rel).toLowerCase();
  const dir = path.dirname(rel);
  if (ext === '.js' || ext === '.mjs') {
    const src = fs.readFileSync(full, 'utf8');
    // static imports / re-exports / dynamic import() of relative specifiers
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'";]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const spec = m[1] ?? m[2] ?? m[3];
      queue.push(path.posix.normalize(path.posix.join(dir, spec)));
    }
    // extension-relative URLs used at runtime (fetch(chrome.runtime.getURL('rules/x.json')))
    for (const m of src.matchAll(/runtime\.getURL\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const clean = m[1].replace(/[?#].*$/, '').replace(/^\.?\//, '');   // `options/options.html#pricing` → the file
      if (clean) queue.push(clean);
    }
  } else if (ext === '.html') {
    const html = fs.readFileSync(full, 'utf8');
    for (const m of html.matchAll(/<(?:script|link|img|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const ref = m[1];
      if (/^(https?:|data:|mailto:|#|\/\/)/.test(ref)) continue;
      const clean = ref.replace(/[?#].*$/, '');            // `options.html#pricing` → the file
      if (!clean) continue;
      queue.push(clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(dir, clean)));
    }
  }
}
if (missing.length) { console.error('MISSING (referenced but not on disk):\n  ' + missing.join('\n  ')); process.exit(2); }

// Refuse to ship anything that is obviously not runtime, even if something references it by mistake.
const forbidden = [...files].filter((f) => /\.test\.js$/.test(f) || /^tools\//.test(f) || /(^|\/)(README|PERMISSIONS)\.md$/.test(f) || /^package\.json$/.test(f) || /test-realm-rig\.js$/.test(f));
if (forbidden.length) { console.error('REFUSING to package non-runtime files that are reachable from the manifest:\n  ' + forbidden.join('\n  ')); process.exit(3); }

const sorted = [...files].sort();
if (LIST_ONLY) { console.log(sorted.join('\n')); console.log(`\n${sorted.length} files (${manifestFile}, version ${manifest.version})`); process.exit(0); }

// ── 3. stage + zip ─────────────────────────────────────────────────────────
const outDir = path.join(REPO, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const stage = fs.mkdtempSync(path.join(outDir, '.stage-'));
try {
  for (const rel of sorted) {
    const dst = path.join(stage, rel === manifestFile ? 'manifest.json' : rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(EXT, rel), dst);
  }
  // the manifest itself (root) — copied above under its shipped name
  if (!fs.existsSync(path.join(stage, 'manifest.json'))) fs.copyFileSync(path.join(EXT, manifestFile), path.join(stage, 'manifest.json'));
  const zipName = `nullecho-${manifest.version}-${FIREFOX ? 'firefox' : 'chrome'}.zip`;
  const zipPath = path.join(outDir, zipName);
  fs.rmSync(zipPath, { force: true });
  execFileSync('zip', ['-r', '-X', '-q', zipPath, '.', '-x', '.*', '__MACOSX/*'], { cwd: stage, stdio: 'inherit' });
  const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n').sort();
  const size = fs.statSync(zipPath).size;
  console.log(`${path.relative(REPO, zipPath)}  (${(size / 1024).toFixed(1)} KB, ${listing.length} files, ${manifestFile} → manifest.json, version ${manifest.version})`);
  for (const f of listing) console.log('  ' + f);
  const stray = listing.filter((f) => /\.test\.js$|^tools\/|README|PERMISSIONS|package\.json|_metadata|test-realm-rig|\.DS_Store/.test(f));
  if (stray.length) { console.error('STRAY files in zip: ' + stray.join(', ')); process.exit(4); }
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
