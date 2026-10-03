#!/usr/bin/env node
/**
 * Assemble the Safari extension: EXACTLY the files its manifest reaches, nothing else.
 *
 *   node safari/tools/build-extension.mjs            # → dist/safari/extension/ (recreated from scratch)
 *   node safari/tools/build-extension.mjs --zip      # also dist/nullecho-<version>-safari.zip (manifest.json at the zip root)
 *   node safari/tools/build-extension.mjs --list     # print the file set and exit; writes nothing
 *   node safari/tools/build-extension.mjs --out DIR  # build into DIR instead of dist/safari/extension (tests use a temp dir)
 *
 * Same philosophy as ext/tools/package.mjs — which is left untouched, because the Chrome 0.9.1
 * package it produces is in store review: start from every path the manifest names, close over
 * imports and HTML asset references, hard-fail on a missing file, refuse anything that is not
 * runtime code. Three sources feed the tree:
 *
 *   safari/extension/**             the Safari manifest, the GPC loader and the popup — Safari-only code
 *   ext/                            files shared with the Chrome build, copied VERBATIM: src/gpc.js and the
 *                                   icons. Only the paths in EXT_SHARED may be pulled from ext/, so a
 *                                   manifest edit that reaches for src/shim.js fails here instead of
 *                                   shipping a Chrome persona to Safari (safari/CAPABILITY-AUDIT.md)
 *   safari/tools/safari-rules.mjs   the rulesets, generated from ext/rules (see its header for why)
 *
 * The manifest in safari/extension/ is a template with exactly two placeholders, filled here so
 * that ext/manifest.json stays the single source of truth for both:
 *
 *   "version": "0.0.0"      → ext/manifest.json's version
 *   "exclude_matches": []   → the src/gpc.js content script's exclude_matches from ext/manifest.json,
 *                             on BOTH Safari content scripts: the ~50 hosts that break when they see
 *                             GPC. ext/rules/validate.mjs keeps that list equal to rule 5000's
 *                             exclusions, so header and property stay off on the same sites.
 *
 * Everything else in the template ships as written. The template's permissions, rulesets and
 * content-script order are checked here against what the Safari build may contain; the same
 * invariants are asserted on the OUTPUT by safari/test/, which is what proves them.
 *
 * dist/ is gitignored. The container app's Xcode project (safari/xcode/, maintained separately)
 * references dist/safari/extension/ as its extension resources, so the output path is a contract:
 * after `node safari/tools/build-extension.mjs` with no arguments it exists with manifest.json at
 * its root.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildSafariRulesets, SAFARI_RULESETS } from './safari-rules.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const SAFARI_SRC = path.resolve(HERE, '../extension');
export const EXT = path.join(REPO, 'ext');
export const DEFAULT_OUT = path.join(REPO, 'dist', 'safari', 'extension');

/** The only ext/ files the Safari build may ship, verbatim. Anything else must live under safari/extension. */
export const EXT_SHARED = [/^src\/gpc\.js$/, /^icons\/icon-\d+\.png$/];

/**
 * Names that must never appear in a Safari package, whatever references them: the persona
 * lane, the learner, the pricing scan, the Chrome worker, the Client-Hint rulesets, and
 * non-runtime files (package.mjs's list, plus the Safari-specific ones).
 */
export const FORBIDDEN = [
  /(^|\/)shim(-loader)?\.js$/, /(^|\/)personas?\.js$/, /(^|\/)persona-validator\.js$/,
  /(^|\/)heuristics\.js$/, /(^|\/)pricing[^/]*\.js$/, /(^|\/)background\.js$/, /(^|\/)linkage\.js$/,
  /(^|\/)ua-[a-z]+\.json$/, /(^|\/)linux-ground-truth\.js$/,
  /\.test\.m?js$/, /^tools\//, /(^|\/)(README|PERMISSIONS)\.md$/, /^package\.json$/, /test-realm-rig\.js$/,
  /(^|\/)_metadata(\/|$)/, /\.DS_Store$/,
];

/** Permissions the Safari build must and must not declare (audit 01 §0, §3). */
export const REQUIRED_PERMISSIONS = ['declarativeNetRequest', 'declarativeNetRequestWithHostAccess'];
export const FORBIDDEN_PERMISSIONS = ['webRequest', 'webRequestBlocking', 'declarativeNetRequestFeedback', 'scripting', 'userScripts', 'cookies', 'tabs'];

const stripLeading = (p) => p.replace(/^\.?\//, '');

/**
 * Fill the template from ext/manifest.json. Pure: returns a new object.
 *
 * @param {object} template   safari/extension/manifest.json, parsed
 * @param {object} extManifest ext/manifest.json, parsed
 */
export function fillManifest(template, extManifest) {
  const m = JSON.parse(JSON.stringify(template));
  if (m.version !== '0.0.0') {
    throw new Error(`safari/extension/manifest.json must carry the placeholder version "0.0.0" (got ${JSON.stringify(m.version)}); the real version comes from ext/manifest.json`);
  }
  if (typeof extManifest.version !== 'string' || !/^\d+(\.\d+){1,3}$/.test(extManifest.version)) {
    throw new Error(`ext/manifest.json version is not usable: ${JSON.stringify(extManifest.version)}`);
  }
  m.version = extManifest.version;

  const gpcEntry = (extManifest.content_scripts ?? []).find((cs) => (cs.js ?? []).includes('src/gpc.js'));
  if (!gpcEntry || !Array.isArray(gpcEntry.exclude_matches) || gpcEntry.exclude_matches.length === 0) {
    throw new Error('ext/manifest.json has no src/gpc.js content script with a non-empty exclude_matches');
  }
  const scripts = m.content_scripts ?? [];
  if (scripts.length === 0) throw new Error('template declares no content_scripts');
  for (const cs of scripts) {
    if (!Array.isArray(cs.exclude_matches) || cs.exclude_matches.length !== 0) {
      throw new Error(`template content script ${JSON.stringify(cs.js)} must carry the placeholder "exclude_matches": []`);
    }
    cs.exclude_matches = gpcEntry.exclude_matches.slice();
  }
  return m;
}

/** Refuse a manifest the Safari build must not ship. Throws with every problem listed. */
export function checkManifest(m) {
  const problems = [];
  for (const p of REQUIRED_PERMISSIONS) if (!(m.permissions ?? []).includes(p)) problems.push(`missing permission "${p}"`);
  for (const p of FORBIDDEN_PERMISSIONS) if ((m.permissions ?? []).includes(p)) problems.push(`forbidden permission "${p}"`);
  if (m.background) problems.push('a background worker is declared; phase 1 has no need for one (safari/CAPABILITY-AUDIT.md §3.5)');
  if (!(m.host_permissions ?? []).includes('<all_urls>')) problems.push('host_permissions must include <all_urls> (GPC content scripts and the header need it)');

  const declared = m.declarative_net_request?.rule_resources ?? [];
  const want = SAFARI_RULESETS.map((r) => ({ id: r.id, enabled: r.enabled, path: r.path }));
  const got = declared.map((r) => ({ id: r.id, enabled: r.enabled, path: r.path }));
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    problems.push(`rule_resources must be exactly ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }

  const cs = m.content_scripts ?? [];
  const expect = [['src/gpc-loader.js', 'ISOLATED'], ['src/gpc.js', 'MAIN']];
  if (cs.length !== expect.length) problems.push(`expected ${expect.length} content scripts, got ${cs.length}`);
  expect.forEach(([file, world], i) => {
    const e = cs[i];
    if (!e) return;
    if (JSON.stringify(e.js) !== JSON.stringify([file])) problems.push(`content_scripts[${i}] must be [${file}] (the loader must run before gpc.js), got ${JSON.stringify(e.js)}`);
    if (e.world !== world) problems.push(`content_scripts[${i}] must run in the ${world} world`);
    if (e.run_at !== 'document_start') problems.push(`content_scripts[${i}] must run at document_start`);
    if (e.all_frames !== true) problems.push(`content_scripts[${i}] must set all_frames`);
    if (JSON.stringify(e.matches) !== JSON.stringify(['<all_urls>'])) problems.push(`content_scripts[${i}] must match <all_urls>`);
  });
  if (cs.length === 2 && JSON.stringify(cs[0].exclude_matches) !== JSON.stringify(cs[1].exclude_matches)) {
    problems.push('both content scripts must carry the same exclude_matches');
  }

  const desc = String(m.description ?? '');
  for (const bad of [/\bstops?\b/i, /protects? you from fingerprinting/i, /\bevery request\b/i, /\banonym/i]) {
    if (bad.test(desc)) problems.push(`description over-claims (${bad}): ${JSON.stringify(desc)}`);
  }
  if (problems.length) throw new Error('refusing to build this manifest:\n  ' + problems.join('\n  '));
}

/**
 * Compute the file set from a filled manifest, resolving each path to its source, exactly as
 * ext/tools/package.mjs does (roots → closure over imports and HTML references).
 *
 * @returns {Map<string, {from: 'generated'|'safari'|'ext', source?: string, text?: string}>}
 */
export function resolveFiles(manifest, { safariSrc = SAFARI_SRC, ext = EXT, generated = new Map() } = {}) {
  const roots = new Set();
  const add = (p) => { if (typeof p === 'string' && p && !/^(https?:|data:|safari-web-extension:|chrome-extension:)/.test(p)) roots.add(stripLeading(p)); };
  add(manifest.background?.service_worker);
  for (const s of manifest.background?.scripts ?? []) add(s);
  for (const cs of manifest.content_scripts ?? []) { for (const f of cs.js ?? []) add(f); for (const f of cs.css ?? []) add(f); }
  add(manifest.action?.default_popup);
  for (const v of Object.values(manifest.action?.default_icon ?? {})) add(v);
  for (const v of Object.values(manifest.icons ?? {})) add(v);
  add(manifest.options_page); add(manifest.options_ui?.page);
  for (const r of manifest.declarative_net_request?.rule_resources ?? []) add(r.path);
  for (const w of manifest.web_accessible_resources ?? []) for (const r of w.resources ?? []) add(r);

  const files = new Map();
  const missing = [];
  const queue = [...roots];
  const locate = (rel) => {
    if (generated.has(rel)) return { from: 'generated', text: generated.get(rel) };
    const s = path.join(safariSrc, rel);
    if (fs.existsSync(s) && fs.statSync(s).isFile()) return { from: 'safari', source: s };
    if (EXT_SHARED.some((re) => re.test(rel))) {
      const e = path.join(ext, rel);
      if (fs.existsSync(e) && fs.statSync(e).isFile()) return { from: 'ext', source: e };
    }
    return null;
  };
  while (queue.length) {
    const rel = queue.shift();
    if (files.has(rel)) continue;
    const found = locate(rel);
    if (!found) { missing.push(rel); continue; }
    files.set(rel, found);
    const text = found.text ?? fs.readFileSync(found.source, 'utf8');
    const kind = path.extname(rel).toLowerCase();
    const dir = path.dirname(rel);
    if (kind === '.js' || kind === '.mjs') {
      for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'";]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        queue.push(path.posix.normalize(path.posix.join(dir, m[1] ?? m[2] ?? m[3])));
      }
      for (const m of text.matchAll(/runtime\.getURL\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const clean = stripLeading(m[1].replace(/[?#].*$/, ''));
        if (clean) queue.push(clean);
      }
    } else if (kind === '.html') {
      for (const m of text.matchAll(/<(?:script|link|img|source|iframe)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
        const ref = m[1];
        if (/^(https?:|data:|mailto:|#|\/\/)/.test(ref)) continue;
        const clean = ref.replace(/[?#].*$/, '');
        if (!clean) continue;
        queue.push(clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(dir, clean)));
      }
    }
  }
  if (missing.length) {
    throw new Error(
      'MISSING (referenced by the manifest or a shipped file, but neither under safari/extension, generated, ' +
      'nor an allowed ext/ file):\n  ' + missing.join('\n  '),
    );
  }
  const forbidden = [...files.keys()].filter((f) => FORBIDDEN.some((re) => re.test(f)));
  if (forbidden.length) throw new Error('REFUSING to package non-Safari or non-runtime files that are reachable from the manifest:\n  ' + forbidden.join('\n  '));
  return files;
}

/**
 * Build the extension folder.
 *
 * @param {object} [opts]
 * @param {string} [opts.outDir]        where to assemble (default dist/safari/extension); recreated
 * @param {boolean} [opts.zip]          also write dist/nullecho-<version>-safari.zip next to dist/safari
 * @param {boolean} [opts.list]         print the file set and return without writing
 * @param {string} [opts.templatePath]  alternative template (tests)
 * @param {string} [opts.extDir]        alternative ext/ (tests)
 * @param {boolean} [opts.quiet]
 */
export async function build(opts = {}) {
  const extDir = opts.extDir ?? EXT;
  const templatePath = opts.templatePath ?? path.join(SAFARI_SRC, 'manifest.json');
  const outDir = path.resolve(opts.outDir ?? DEFAULT_OUT);
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);

  const extManifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const manifest = fillManifest(template, extManifest);
  checkManifest(manifest);

  const generated = new Map();
  for (const rs of buildSafariRulesets(path.join(extDir, 'rules'))) generated.set(rs.path, rs.text);
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  generated.set('manifest.json', manifestText);

  const files = resolveFiles(manifest, { ext: extDir, generated });
  files.set('manifest.json', { from: 'generated', text: manifestText });
  const sorted = [...files.keys()].sort();

  if (opts.list) {
    for (const f of sorted) log(`${f}  (${files.get(f).from})`);
    log(`\n${sorted.length} files, version ${manifest.version}`);
    return { manifest, files: sorted, outDir: null, version: manifest.version };
  }

  // Recreate the folder: a stale file from an earlier build must not survive, because the
  // container app ships whatever is in here.
  if (!outDir.startsWith(path.join(REPO, 'dist') + path.sep) && !opts.outDir) throw new Error(`refusing to recreate ${outDir}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const rel of sorted) {
    const dst = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const f = files.get(rel);
    if (f.from === 'generated') fs.writeFileSync(dst, f.text);
    else fs.copyFileSync(f.source, dst);
  }
  log(`${path.relative(REPO, outDir) || outDir}/  (${sorted.length} files, Nullecho ${manifest.version} for Safari)`);
  for (const f of sorted) log(`  ${f}  (${files.get(f).from})`);

  let zipPath = null;
  if (opts.zip) {
    const distDir = path.dirname(path.dirname(outDir));
    zipPath = path.join(distDir, `nullecho-${manifest.version}-safari.zip`);
    fs.rmSync(zipPath, { force: true });
    execFileSync('zip', ['-r', '-X', '-q', zipPath, '.', '-x', '.*', '__MACOSX/*'], { cwd: outDir, stdio: 'inherit' });
    const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n').sort();
    const stray = listing.filter((f) => FORBIDDEN.some((re) => re.test(f)));
    if (stray.length) throw new Error('STRAY files in zip: ' + stray.join(', '));
    if (!listing.includes('manifest.json')) throw new Error('zip has no manifest.json at its root');
    log(`${path.relative(REPO, zipPath)}  (${(fs.statSync(zipPath).size / 1024).toFixed(1)} KB, ${listing.length} files)`);
  }
  return { manifest, files: sorted, outDir, zipPath, version: manifest.version };
}

// ── CLI ───────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  try {
    await build({
      zip: argv.includes('--zip'),
      list: argv.includes('--list'),
      outDir: outIdx >= 0 ? argv[outIdx + 1] : undefined,
    });
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
