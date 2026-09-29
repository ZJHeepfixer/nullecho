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

// ── D51 (2026-09-28): the System row names the REAL browser ────────────────
// It printed the persona's pinned "Chrome 151" (from `p.ua`) while the owner's
// Chrome was 153. Since D51 the page is shown the browser's own UA, brands and
// version, so the row must say that browser — read from the popup's own navigator,
// which the shim never touches — and never a persona field.

function lift(name) {
  const start = POPUP.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `rig: ${name} not found in popup.js`);
  const next = POPUP.indexOf('\nfunction ', start + 10);
  return POPUP.slice(start, next < 0 ? undefined : next);
}
const OS_LABEL_SRC = /const OS_LABEL = \{[\s\S]*?\};/.exec(POPUP)[0];
const { realBrowser, prettySystem } = new Function(
  `${OS_LABEL_SRC}\n${lift('realBrowser')}\n${lift('prettySystem')}\nreturn { realBrowser, prettySystem };`)();

test('D51 popup System row: the real browser\'s brand and major version, never a persona `ua`', () => {
  assert.doesNotMatch(lift('prettySystem') + lift('realBrowser'), /\bp\.ua\b|persona\.ua\b/, 'the row reads a persona ua');
  const chrome999 = { userAgentData: { brands: [{ brand: 'Not_A Brand', version: '8' }, { brand: 'Chromium', version: '999' }, { brand: 'Google Chrome', version: '999' }] },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36' };
  // A stale persona that still carries a ua must not win.
  const stale = { os: 'macos-14', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36' };
  const row = prettySystem(stale, chrome999);
  assert.match(row, /^macOS 14 · Google Chrome 999 /);
  assert.doesNotMatch(row, /151/);
  assert.match(row, /real browser, not changed/);
  assert.equal(realBrowser({ userAgentData: { brands: [{ brand: 'Chromium', version: '999' }, { brand: 'Not)A;Brand', version: '24' }, { brand: 'Microsoft Edge', version: '999' }] } }), 'Microsoft Edge 999');
  assert.equal(realBrowser({ userAgentData: { brands: [{ brand: 'Not-A.Brand', version: '24' }, { brand: 'Chromium', version: '146' }] } }), 'Chromium 146', 'Chrome for Testing has no Google Chrome brand');
  assert.equal(realBrowser({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0' }), 'Firefox 140', 'Firefox has no userAgentData');
  assert.equal(realBrowser({ userAgentData: { brands: [] }, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36 Edg/999.0.0.0' }), 'Microsoft Edge 999');
  assert.equal(realBrowser({}), 'your browser');
  assert.equal(realBrowser({ get userAgentData() { throw new Error('x'); } }), 'your browser');
});
