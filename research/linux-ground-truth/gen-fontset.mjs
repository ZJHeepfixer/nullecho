#!/usr/bin/env node
/**
 * gen-fontset.mjs — derive the Linux persona font set from MEASURED data.
 * `node research/linux-ground-truth/gen-fontset.mjs` (from the repo root or anywhere).
 *
 * Reads   ubuntu2204-families.txt   `fc-list : family` on a DEFAULT Ubuntu 22.04 desktop
 *                                   (every font package in Canonical's desktop ISO manifest,
 *                                   u2204.manifest — see README.md for the method)
 * Writes  ext/src/linux-ground-truth.js         the list as an ES module. personas.js uses it
 *                                               AS `FONT_SETS['ubuntu-22']`; persona-validator.js
 *                                               checks every Linux persona against it.
 *         ext/src/shim.js  → 'ubuntu-22' entry  inside the GENERATED MIRROR block ONLY. The
 *                                               content script cannot import (MV3, gap G7), so
 *                                               the mirror carries a literal copy. Nothing else
 *                                               in shim.js is touched; the script aborts if the
 *                                               entry is not found exactly once.
 *
 * The ONE transformation: fontconfig's FcNameUnparse backslash-escapes `-` `:` `,` and `\`
 * inside family names when fc-list prints them, so `padmaa\-Bold.1.1` in the .txt is the
 * family `padmaa-Bold.1.1`. Everything else is verbatim, in file order. Nothing is added,
 * dropped, renamed or re-sorted here — a hand-curated Linux font list is exactly the defect
 * this replaces (five claimed families that no real install has).
 *
 * personas.test.js re-derives the list from the .txt with the same rule and fails if the
 * generated module drifts from it, so the .txt is the single source of truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SRC_TXT = path.join(HERE, 'ubuntu2204-families.txt');
const OUT_MODULE = path.join(ROOT, 'ext', 'src', 'linux-ground-truth.js');
const SHIM = path.join(ROOT, 'ext', 'src', 'shim.js');

/** fc-list escaping, undone. Exported for the test that re-derives the list. */
export const unescapeFcList = (s) => s.replace(/\\(.)/g, '$1');

export function readMeasured(file = SRC_TXT) {
  const names = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.length > 0).map(unescapeFcList);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupes.length) throw new Error(`duplicate families in ${file}: ${dupes.join(', ')}`);
  for (const n of names) {
    if (n !== n.trim()) throw new Error(`untrimmed family in ${file}: ${JSON.stringify(n)}`);
    if (/['|\\]/.test(n)) throw new Error(`family needs quoting the emitters do not do: ${JSON.stringify(n)}`);
  }
  return names;
}

/** `'a|b|c' +` lines, packed to ~100 columns, last line closed with `).split('|'),`. */
function mirrorEntry(key, names, indent = '    ') {
  const lines = [];
  let cur = '';
  for (const n of names) {
    const piece = n + '|';
    if (cur.length + piece.length > 100 && cur.length > 0) { lines.push(cur); cur = ''; }
    cur += piece;
  }
  lines.push(cur.replace(/\|$/, ''));
  // Every line but the last already ends in '|' — the separator lives at the chunk boundary.
  const body = lines.map((l) => `${indent}  '${l}'`).join(' +\n');
  return `${indent}'${key}': (\n${body}).split('|'),`;
}

function moduleSource(names) {
  const items = names.map((n) => `  '${n}',`).join('\n');
  return `/**
 * Nullecho — Linux font ground truth.  GENERATED — do not hand-edit.
 * ─────────────────────────────────────────────────────────────────
 * Source:  research/linux-ground-truth/ubuntu2204-families.txt
 *          = \`fc-list : family\` on a DEFAULT Ubuntu 22.04 desktop install (every font
 *          package named in Canonical's own desktop ISO manifest, u2204.manifest).
 *          Measured 2026-08-21; the method, so it can be re-run, is in that folder's README.
 * Regen:   node research/linux-ground-truth/gen-fontset.mjs
 *
 * Why a module and not just a literal in personas.js: persona-validator.js needs the
 * MEASURED list independently of FONT_SETS, so that "every font a Linux persona claims
 * exists on a real Ubuntu" is a check rather than a tautology. personas.test.js pins this
 * file to the .txt, and pins FONT_SETS['ubuntu-22'] to this file.
 *
 * What was wrong before this existed (research/linux-ground-truth/README.md): the
 * hand-written 30-family set claimed five families no real install has — Noto Sans,
 * Noto Serif, Century Schoolbook L, Dingbats, DejaVu Math TeX Gyre. Font detection
 * records present/absent per probed family, so a persona that says "present" for a
 * family every real Ubuntu says "absent" for is self-contradicting (DECISIONS.md D2) and
 * an ordinary probe list catches it — Noto Sans is on most of them.
 *
 * Two things a reader will notice, both deliberate:
 *   - fc-list backslash-escapes \`-\` \`:\` \`,\` \`\\\` in names; the generator un-escapes them
 *     (one entry affected: padmaa-Bold.1.1).
 *   - Four entries are fontconfig's LOCALISED family names (गार्गी, नालिमाटी, অনি, মুক্তি —
 *     Gargi, Kalimati, Ani, Mukti). Chrome on Linux resolves CSS font-family through
 *     fontconfig, which matches every alias a face declares, so a real Ubuntu reports
 *     those present too. They stay because the list is measured, not curated.
 */

/** ${names.length} families, verbatim measured order (C-locale \`sort -u\`). */
export const UBUNTU_2204_FAMILIES = Object.freeze([
${items}
]);

/**
 * Measured ground truth keyed by FONT_SETS key. The validator REJECTS a Linux persona
 * whose fonts key has no entry here: a Linux font set is derived from a real default
 * install or it does not ship. To add one (e.g. 'ubuntu-24' from
 * research/linux-ground-truth/ubuntu2404-families.txt), extend the generator — never
 * type a list in.
 */
export const LINUX_FONT_GROUND_TRUTH = Object.freeze({
  'ubuntu-22': UBUNTU_2204_FAMILIES,
});
`;
}

function patchShim(names) {
  const src = fs.readFileSync(SHIM, 'utf8');
  const begin = src.indexOf('// ─── BEGIN GENERATED MIRROR');
  const end = src.indexOf('// ─── END GENERATED MIRROR');
  if (begin < 0 || end < 0 || end < begin) throw new Error('shim.js: GENERATED MIRROR markers not found');
  const block = src.slice(begin, end);
  const re = /^( *)'ubuntu-22': \(\n[\s\S]*?\)\.split\('\|'\),/m;
  const matches = block.match(new RegExp(re.source, 'gm')) || [];
  if (matches.length !== 1) throw new Error(`shim.js mirror: expected exactly one 'ubuntu-22' entry, found ${matches.length}`);
  const indent = re.exec(block)[1];
  const patched = block.replace(re, mirrorEntry('ubuntu-22', names, indent));
  const next = src.slice(0, begin) + patched + src.slice(end);
  if (next === src) return false;
  fs.writeFileSync(SHIM, next);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = readMeasured();
  fs.writeFileSync(OUT_MODULE, moduleSource(names));
  const shimChanged = patchShim(names);
  console.log(`ubuntu-22: ${names.length} families from ${path.relative(ROOT, SRC_TXT)}`);
  console.log(`  wrote  ${path.relative(ROOT, OUT_MODULE)}`);
  console.log(`  shim   ${path.relative(ROOT, SHIM)} 'ubuntu-22' mirror entry ${shimChanged ? 'REWRITTEN' : 'already current'}`);
}
