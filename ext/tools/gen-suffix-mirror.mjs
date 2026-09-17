#!/usr/bin/env node
/**
 * Regenerate the GENERATED SUFFIX MIRROR block in src/shim.js from src/suffixes.js
 * (DECISIONS.md D23). Idempotent: prints "already current" when nothing changed.
 *
 *     node tools/gen-suffix-mirror.mjs
 *
 * The block is `const MULTI_LABEL_SUFFIXES = new Set(('…').split('|'))` plus the
 * source of `registrableDomain` verbatim (its private `SUFFIX_SET` renamed to the
 * shim's Set). review-2026-09-16.test.js (A4d) fails on any drift.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MULTI_LABEL_SUFFIXES, registrableDomain } from '../src/suffixes.js';

const SHIM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/shim.js');
const BEGIN = '// ─── BEGIN GENERATED SUFFIX MIRROR';
const END = '  // ─── END GENERATED SUFFIX MIRROR';

function tableLines(list) {
  const lines = []; let cur = '';
  for (const s of list) { const piece = `${s}|`; if ((cur + piece).length > 100) { lines.push(cur); cur = ''; } cur += piece; }
  if (cur) lines.push(cur);
  const last = lines.length - 1;
  lines[last] = lines[last].replace(/\|$/, '');
  return lines.map((l, i) => `    '${l}'${i < last ? ' +' : ''}`).join('\n');
}

function block() {
  const fn = registrableDomain.toString().replace(/\bSUFFIX_SET\b/g, 'MULTI_LABEL_SUFFIXES');
  const indented = fn.split('\n').map((l) => (l ? '  ' + l : l)).join('\n');
  return `  const MULTI_LABEL_SUFFIXES = new Set((\n${tableLines(MULTI_LABEL_SUFFIXES)}).split('|'));\n\n${indented}\n`;
}

const src = fs.readFileSync(SHIM, 'utf8');
const b = src.indexOf(BEGIN), e = src.indexOf(END);
if (b < 0 || e < 0 || e < b) throw new Error('shim.js: GENERATED SUFFIX MIRROR markers not found');
const headerEnd = src.indexOf('\n', b) + 1;
const next = src.slice(0, headerEnd) + block() + src.slice(e);
if (next === src) { console.log(`shim.js suffix mirror already current (${MULTI_LABEL_SUFFIXES.length} suffixes)`); }
else { fs.writeFileSync(SHIM, next); console.log(`shim.js suffix mirror REWRITTEN (${MULTI_LABEL_SUFFIXES.length} suffixes)`); }
