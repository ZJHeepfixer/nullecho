/**
 * 2026-09-22 — found while reviewing the Chrome Web Store screenshots. The popup's
 * "What this site sees" card printed the persona's `screen` (e.g. "1920×1080 · 2x ·
 * 24-bit") on its Display row. The shim has deliberately NOT spoofed the display
 * layer since 2026-08-20 (shim.js "DISPLAY LAYER — DELIBERATELY NOT SPOOFED"; CSS
 * @media mirrors it below JavaScript, so a fake contradicts itself), and the options
 * page tells the user "Screen dimensions, pixel density and colour depth are
 * reported honestly." So the popup was stating, under the heading "What this site
 * sees", a screen the site never saw. The persona's `screen` field is unused by the
 * shim and must not be presented as what a site sees.
 *
 * Source-level guard (the popup has no DOM test rig): the Display row must be built
 * from the real display, never from `p.screen` / `persona.screen`, and must say that
 * it is unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POPUP = fs.readFileSync(path.join(HERE, '..', 'popup', 'popup.js'), 'utf8');

function renderPersonaBody() {
  const start = POPUP.indexOf('function renderPersona(');
  assert.ok(start >= 0, 'rig: renderPersona not found in popup.js');
  const next = POPUP.indexOf('\nfunction ', start + 10);
  return POPUP.slice(start, next < 0 ? undefined : next);
}

test('popup Display row: never presents the persona\'s unused screen as what the site sees', () => {
  const body = renderPersonaBody();
  const screenLine = body.split('\n').find((l) => /\$\(['"]p-screen['"]\)\.textContent\s*=/.test(l) && !/'—'/.test(l));
  assert.ok(screenLine, 'rig: the p-screen assignment for a present persona was not found');
  assert.doesNotMatch(screenLine, /\bp\.screen\b|persona\.screen\b/, `the Display row is built from the persona's screen: ${screenLine.trim()}`);
});

test('popup Display row: says the display is the real one and is not changed', () => {
  assert.match(POPUP, /function realDisplay\(/, 'a realDisplay() formatter exists');
  const fn = POPUP.slice(POPUP.indexOf('function realDisplay('), POPUP.indexOf('function realDisplay(') + 600);
  assert.match(fn, /not changed/i, 'the row tells the user the display is not changed');
  assert.match(fn, /globalThis\.screen|\bscreen\.width\b/, 'the row reads the real screen');
});
