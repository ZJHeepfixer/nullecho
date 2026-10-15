/**
 * 0.9.2 (D53) — the popup and options page name the browser they are actually running in.
 *
 * The same `ext/` ships to Chrome, Microsoft Edge (the Chrome zip, unchanged) and Firefox. Until
 * 0.9.2 the shipped UI said "Chrome only reports the individual blocked URLs…" and "Nullecho
 * exists for Chrome" wherever it ran, told a Firefox user "On Firefox or Brave, their built-in
 * protections are stronger", and — after D53 made the GPU the engine's own on Firefox — would
 * have listed the persona's graphics card under "What this site sees" in a browser where no site
 * sees it. Edge Add-ons policy 1.1.2 also says an extension "must not reference other browsers".
 *
 * Rule held here: the static HTML is the neutral copy (names no browser), `browser-kind.js`
 * swaps in Chrome's or Firefox's wording at run time, and Edge/other keep the neutral copy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserKind, copyFor, BROWSER_COPY } from './browser-kind.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(HERE, '..', rel), 'utf8');
const POPUP_HTML = read('popup/popup.html');
const OPTIONS_HTML = read('options/options.html');
const POPUP_JS = read('popup/popup.js');

const brands = (...names) => ({ userAgentData: { brands: names.map(([brand, version]) => ({ brand, version })) } });
const UA = {
  chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:156.0) Gecko/20100101 Firefox/156.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 OPR/125.0.0.0',
};

test('browserKind: brand list first, then the UA product token', () => {
  assert.equal(browserKind(brands(['Google Chrome', '153'], ['Not_A Brand', '8'], ['Chromium', '153'])), 'chrome');
  assert.equal(browserKind(brands(['Not)A;Brand', '24'], ['Microsoft Edge', '141'], ['Chromium', '141'])), 'edge');
  assert.equal(browserKind(brands(['Brave', '141'], ['Chromium', '141'], ['Not_A Brand', '24'])), 'other');
  assert.equal(browserKind(brands(['Not-A.Brand', '24'], ['Chromium', '146'])), 'other', 'Chrome for Testing');
  assert.equal(browserKind({ userAgent: UA.firefox }), 'firefox', 'Firefox has no userAgentData');
  assert.equal(browserKind({ userAgentData: { brands: [] }, userAgent: UA.edge }), 'edge');
  assert.equal(browserKind({ userAgent: UA.opera }), 'other');
  assert.equal(browserKind({ userAgent: UA.chrome }), 'chrome');
  assert.equal(browserKind({}), 'other');
  assert.equal(browserKind({ get userAgentData() { throw new Error('x'); } }), 'other');
  assert.equal(copyFor('nonsense'), BROWSER_COPY.other);
});

const OTHER_BROWSERS = /\b(Chrome|Chromium|Firefox|Brave|Opera|Safari|Mozilla)\b/;

test('Edge (and anything unrecognised) is never shown another browser\'s name — Edge policy 1.1.2', () => {
  for (const kind of ['edge', 'other']) {
    for (const [key, text] of Object.entries(copyFor(kind))) {
      assert.doesNotMatch(text, OTHER_BROWSERS, `${kind}.${key}: ${text}`);
    }
  }
});

test('Firefox copy never says Chrome or uses Chromium-only terms', () => {
  for (const [key, text] of Object.entries(copyFor('firefox'))) {
    assert.doesNotMatch(text, /\bChrome\b|\bChromium\b|unpacked/, `firefox.${key}: ${text}`);
  }
  assert.match(copyFor('firefox').stronger, /Firefox/);
  assert.notEqual(copyFor('firefox').poolNote, '', 'Firefox says which profile fields do not apply there');
});

test('Chrome keeps its wording', () => {
  const c = copyFor('chrome');
  assert.equal(c.stronger, 'On Firefox or Brave, their built-in protections are stronger.');
  assert.match(c.limitBody, /Nullecho exists for Chrome, where neither is available/);
  assert.match(c.blockedUrls, /^Chrome only reports the individual blocked URLs to unpacked \(developer\) builds/);
  assert.equal(c.poolNote, '');
});

// ── the shipped HTML is the neutral copy ───────────────────────────────────

/** The text content of the element with `id`, tags stripped, whitespace collapsed. */
function textById(html, id) {
  const m = new RegExp(`<(\\w+)[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</\\1>`).exec(html);
  assert.ok(m, `#${id} is in the page`);
  return m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
const visibleText = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('popup.html and options.html ship the neutral copy, equal to the table', () => {
  const n = copyFor('other');
  assert.equal(textById(POPUP_HTML, 'foot-stronger'), n.stronger);
  assert.equal(textById(OPTIONS_HTML, 'limit-stronger-title'), n.limitTitle);
  assert.equal(textById(OPTIONS_HTML, 'limit-stronger-body'), n.limitBody);
  assert.equal(textById(OPTIONS_HTML, 'limit-differs'), n.differs);
  assert.match(OPTIONS_HTML, /<p class="note" id="pool-note" hidden><\/p>/);
});

test('the shipped HTML names no browser in visible text (Mozilla\'s Lightbeam post-mortem is a citation, not a browser)', () => {
  for (const [name, html] of [['popup.html', POPUP_HTML], ['options.html', OPTIONS_HTML]]) {
    const hits = [...visibleText(html).matchAll(/\b(Chrome|Chromium|Firefox|Brave|Opera|Safari)\b/g)].map((m) => m[0]);
    assert.deepEqual(hits, [], `${name} names a browser in its static text`);
  }
});

test('the popup builds the browser-specific sentences from the table, not from literals', () => {
  assert.doesNotMatch(POPUP_JS, /'Chrome only reports/);
  assert.match(POPUP_JS, /note\.textContent = COPY\.blockedUrls;/);
  assert.match(POPUP_JS, /\$\('foot-stronger'\)\.textContent = COPY\.stronger;/);
});

// ── "What this site sees" in Firefox ───────────────────────────────────────

function lift(name) {
  const start = POPUP_JS.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `rig: ${name} not found in popup.js`);
  const next = POPUP_JS.indexOf('\nfunction ', start + 10);
  return POPUP_JS.slice(start, next < 0 ? undefined : next);
}
const OS_LABEL_SRC = /const OS_LABEL = \{[\s\S]*?\};/.exec(POPUP_JS)[0];
const rows = new Function(`${OS_LABEL_SRC}\n${['realBrowser', 'prettySystem', 'prettyGpu', 'prettyGpuRow', 'prettyCpuRow'].map(lift).join('\n')}
  return { prettySystem, prettyGpuRow, prettyCpuRow };`)();

const PERSONA = { os: 'macos-14', cores: 8, memory: 16, gpu: { renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)' } };

test('popup rows in Firefox: no persona graphics card, memory or OS version — Firefox shows its own', () => {
  const ff = { userAgent: UA.firefox };
  const sys = rows.prettySystem(PERSONA, ff, 'firefox');
  assert.match(sys, /^Firefox 156 /);
  assert.doesNotMatch(sys, /macOS 14/);
  const gpu = rows.prettyGpuRow(PERSONA, 'firefox');
  assert.doesNotMatch(gpu, /M2|ANGLE/);
  assert.match(gpu, /as Firefox reports it/);
  const cpu = rows.prettyCpuRow(PERSONA, 'firefox');
  assert.match(cpu, /^8 cores/);
  assert.doesNotMatch(cpu, /16 GB/);
});

test('popup rows in Chrome and Edge are unchanged: the persona\'s OS, graphics card and memory', () => {
  for (const [kind, nav] of [['chrome', { userAgent: UA.chrome }], ['edge', { userAgent: UA.edge }]]) {
    assert.match(rows.prettySystem(PERSONA, nav, kind), /^macOS 14 · /);
    assert.equal(rows.prettyGpuRow(PERSONA, kind), 'Apple M2');
    assert.equal(rows.prettyCpuRow(PERSONA, kind), '8 cores · 16 GB');
  }
});
