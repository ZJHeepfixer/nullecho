/**
 * Nullecho — the shim says nothing to the page's console, and a brand-check throw
 * is not a patch failure
 * ═══════════════════════════════════════════════════════════════════════════
 * Companion to docs/CLAIM-VERIFICATION-2026-09-17.md §3d and DECISIONS.md D33.
 *
 * CreepJS's `failed call interface error` / `failed new instance error` probes
 * call every patched method with an illegal receiver — `fn.call({})`, `new fn()`.
 * The native original correctly throws `TypeError: Illegal invocation` (the brand
 * check, ARKENFOX-RESPONSE.md claim (f)). Five wrappers ran shim work BEFORE the
 * original spoke — `toDataURL`, `toBlob`, `convertToBlob`, `copyFromChannel`,
 * `measureText` — so that throw landed in the wrapper's own `catch`, which read it
 * as "the patch failed" and wrote
 *
 *     [Nullecho] shim could NOT patch "…". That API is UNPROTECTED on this page…
 *
 * to the PAGE's console. Both halves were wrong: the API was patched and working
 * (a false alarm), and a page-installed `console.error` hook now read the product
 * name back — a nominative detector in three lines. Measured in real Chrome 151:
 * control 0 messages, shim on 1 per illegal call, "Nullecho" named: true.
 *
 * The rule these tests pin: the ORIGINAL speaks first. Every wrapper either
 * delegates before doing anything, or reads a captured native accessor on the
 * receiver outside any `try` that reaches `fail()`, so the original's verdict on
 * the receiver and the arguments — `Illegal invocation`, "1 argument required" —
 * reaches the caller exactly as it would unpatched, unlogged and uncounted. And
 * the shim never writes to the page's console at all: a genuine patch failure
 * rides the D30 status channel as a `failures` list, and `shim-loader.js` prints
 * it from the ISOLATED world, which the page cannot hook.
 *
 * Fidelity: the fake DOM is defined INSIDE the `node:vm` realm, and — this is the
 * part that matters here — its canvas, context, offscreen and audio members are
 * PROTOTYPE ACCESSORS and methods that brand-check their receiver the way WebIDL
 * ones do. A rig that defines `width` as an own instance property would let the
 * shim's captured getter fall back to a plain read that cannot throw, and these
 * tests would pass against the defect.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SHIM_SRC, LOADER_SRC, DELIVERED, RIG_TOKENS, bootRealm, loaderRealm } from './test-realm-rig.js';

/** The five wrappers that used to run shim work before the original spoke. */
const ILLEGAL_RECEIVER_CASES = [
  { label: 'canvas.toDataURL',              fn: 'HTMLCanvasElement.prototype.toDataURL',              native: 'toDataURL',       args: '' },
  { label: 'canvas.toBlob',                 fn: 'HTMLCanvasElement.prototype.toBlob',                 native: 'toBlob',          args: 'function () {}' },
  { label: 'offscreenCanvas.convertToBlob', fn: 'OffscreenCanvas.prototype.convertToBlob',            native: 'convertToBlob',   args: '' },
  { label: 'AudioBuffer.copyFromChannel',   fn: 'AudioBuffer.prototype.copyFromChannel',              native: 'copyFromChannel', args: 'new Float32Array(4), 0' },
  { label: 'CanvasRenderingContext2D.measureText', fn: 'CanvasRenderingContext2D.prototype.measureText', native: 'measureText', args: '"x"' },
];

// ═══════════════════════════════════════════════════════════════════════════
// §3d REPRO — an illegal receiver is the original's business, not a patch failure
// ═══════════════════════════════════════════════════════════════════════════

test('3d REPRO: an illegal-receiver call on every fixed method throws Illegal invocation, logs nothing, records no failure, counts no read, and leaves the patch working', () => {
  const s = bootRealm();
  s.upgrade();
  assert.equal(s.dev().upgraded, true, 'rig: the delivered persona did not land');
  const readsBefore = s.dev().reads;

  for (const c of ILLEGAL_RECEIVER_CASES) {
    assert.notEqual(s.page(c.fn), s.page('__natives.' + c.native), `${c.label}: the rig never patched it`);
    const before = s.consoleCalls.length;

    // CreepJS's two probes, verbatim in shape.
    assert.throws(() => s.page(`${c.fn}.call({}${c.args ? ', ' + c.args : ''})`),
      (e) => e instanceof s.win.TypeError && /Illegal invocation/.test(e.message),
      `${c.label}: fn.call({}) must throw the native TypeError: Illegal invocation`);
    assert.throws(() => s.page(`new ${c.fn}(${c.args})`),
      (e) => e instanceof s.win.TypeError,
      `${c.label}: new fn() must throw a TypeError`);

    assert.equal(s.consoleCalls.length, before,
      `${c.label}: the shim wrote to the PAGE console on an illegal receiver:\n${s.consoleCalls.slice(before).map((x) => x.method + ': ' + x.text).join('\n')}`);
    assert.deepEqual(Array.from(s.dev().failures), [], `${c.label}: a brand-check throw was recorded as a patch failure`);
    assert.notEqual(s.page(c.fn), s.page('__natives.' + c.native), `${c.label}: the patch is gone after the illegal call`);
  }
  assert.equal(s.dev().reads, readsBefore, 'an illegal-receiver call is not a read: nothing was read');
  assert.deepEqual(s.detects, [], 'and it must not fire a detect report either');

  // …and every one of them still works on a legal receiver.
  s.page('const cv = document.createElement("canvas"); cv.getContext("2d").fillRect(0, 0, 300, 150);');
  assert.match(s.page('cv.toDataURL()'), /^data:image\/png;fake,\d/, 'toDataURL still functional');
  assert.equal(s.page('let blobSeen = null; cv.toBlob((b) => { blobSeen = b; }); blobSeen && blobSeen.size'), 1, 'toBlob still functional');
  assert.equal(s.page('typeof new OffscreenCanvas(8, 8).convertToBlob().then'), 'function', 'convertToBlob still functional');
  assert.equal(s.page('const ab = new AudioBuffer(64, 1); const out = new Float32Array(64); ab.copyFromChannel(out, 0); out.some((v) => v !== 0)'), true, 'copyFromChannel still functional');
  assert.equal(s.page('cv.getContext("2d").font = "16px Arial"; cv.getContext("2d").measureText("mmmm").width > 0'), true, 'measureText still functional');
  assert.equal(s.consoleCalls.length, 0, 'the legal calls wrote nothing to the page console either');
});

test('3d REPRO: measureText() with no argument on a font the persona claims is the original\'s error, not a patch failure', () => {
  const s = bootRealm();
  s.upgrade();
  // 'Arial' is in the delivered fontList, so this drives the plan path — the one
  // that calls the original from inside the wrapper's own try block.
  s.page('const cx = document.createElement("canvas").getContext("2d"); cx.font = "16px Arial";');
  assert.throws(() => s.page('cx.measureText()'),
    (e) => e instanceof s.win.TypeError && /1 argument required/.test(e.message),
    'the native "1 argument required" TypeError must reach the caller');
  assert.equal(s.consoleCalls.length, 0, `page console got:\n${s.consoleCalls.map((x) => x.method + ': ' + x.text).join('\n')}`);
  assert.deepEqual(Array.from(s.dev().failures), []);
  assert.equal(s.page('cx.font'), '16px Arial', 'the font was restored after the throw');
});

// ═══════════════════════════════════════════════════════════════════════════
// The shim never writes to the page's console
// ═══════════════════════════════════════════════════════════════════════════

test('3d GUARD: nothing the page can provoke makes the shim write to the page console — boot, a forged handshake, illegal calls, a genuine failure', () => {
  const s = bootRealm({ lockToDataURL: true });
  // A forged handshake used to earn a console.warn naming the product.
  s.send({ ok: true, enabled: false });
  s.send('{not json');
  s.upgrade();
  for (const c of ILLEGAL_RECEIVER_CASES) {
    try { s.page(`${c.fn}.call({}${c.args ? ', ' + c.args : ''})`); } catch (_) { /* expected */ }
  }
  assert.ok(s.dev().failures.some((f) => f.label === 'canvas.toDataURL'),
    'rig: the non-configurable toDataURL should have produced a genuine install failure');
  assert.deepEqual(s.consoleCalls, [], 'the shim must not write to a console the page can hook');
});

test('3d GUARD (lint): shim.js contains no console call at all — the loader\'s isolated world is where anything naming the extension is printed', () => {
  const stripped = SHIM_SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  const hits = [];
  for (const m of stripped.matchAll(/\bconsole\s*\.\s*\w+/g)) {
    hits.push(`"${m[0]}" near line ${stripped.slice(0, m.index).split('\n').length}`);
  }
  assert.deepEqual(hits, [], `shim.js writes to the page console:\n${hits.join('\n')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// The genuine-failure warning is kept — it moves, it does not go quiet
// ═══════════════════════════════════════════════════════════════════════════

test('3d GUARD: a genuine install failure still reaches the loader — as a `failures` list on the authenticated status', () => {
  const s = bootRealm({ lockToDataURL: true });
  s.upgrade();
  const tokened = s.statuses.filter((d) => typeof d.token === 'string');
  assert.ok(tokened.length >= 1, 'no authenticated status went out after the upgrade');
  const carrying = tokened.filter((d) => Array.isArray(d.failures) && d.failures.length);
  assert.equal(carrying.length, 1, `exactly one status should carry the install failures; got ${carrying.length}`);
  assert.deepEqual(carrying[0].failures, ['canvas.toDataURL']);
  assert.equal(carrying[0].upgraded, true, 'the failures ride the status the shim was sending anyway');
  for (const d of carrying) {
    assert.ok(!JSON.stringify(d).includes('at '), 'labels only — a stack would name the extension URL on a DOM event');
  }
  assert.deepEqual(Array.from(s.dev().failures, (f) => f.label), ['canvas.toDataURL'], 'the dev surface still lists it, with its error');
  assert.ok(/not configurable/.test(s.dev().failures[0].error), 'and the dev surface keeps the error text');
});

test('3d GUARD: a genuine run-time failure after the handshake is reported on its own status, capped so it cannot spend the token reserve', () => {
  const s = bootRealm();
  s.upgrade();
  const carrying = () => s.statuses.filter((d) => typeof d.token === 'string' && Array.isArray(d.failures) && d.failures.length);
  assert.equal(carrying().length, 0, 'rig: nothing failed at install');

  s.page('const cvx = document.createElement("canvas"); cvx.getContext("2d").fillRect(0, 0, 300, 150); __breakScratch = true;');
  assert.match(s.page('cvx.toDataURL()'), /^data:/, 'the call still answers (falls open to the native, as before)');
  assert.deepEqual(Array.from(s.dev().failures, (f) => f.label), ['canvas.toDataURL'], 'rig: the broken scratch canvas must register as a genuine failure');
  assert.equal(carrying().length, 1, 'one tokened status carries the run-time failure');
  assert.deepEqual(carrying()[0].failures, ['canvas.toDataURL']);
  assert.equal(carrying()[0].upgraded, true, 'it restates the current health, so the service worker\'s last-writer slot stays truthful');
  assert.equal(carrying()[0].lockedToFallback, false);

  // A page can make the noise path fail as often as it likes; it must not be able
  // to make the shim spend the whole D30 token list on failure reports.
  for (let i = 0; i < 6; i++) s.page('cvx.toDataURL()');
  assert.ok(s.dev().failures.length >= 7, 'the dev surface keeps counting');
  assert.ok(carrying().length <= 2, `failure statuses are capped; got ${carrying().length}`);
  assert.equal(s.consoleCalls.length, 0, 'and nothing on the page console');
});

// ═══════════════════════════════════════════════════════════════════════════
// The loader prints it — from the ISOLATED world
// ═══════════════════════════════════════════════════════════════════════════


test('3d GUARD: the loader prints a genuine patch failure from the isolated world, names the API, and forwards it to the service worker', async () => {
  const r = loaderRealm();
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'a'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0]?.reportTokens;
  assert.ok(Array.isArray(tokens) && tokens.length, 'rig: the loader delivered no reply tokens');

  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, failures: ['canvas.toDataURL', 'AudioBuffer.getChannelData'], token: tokens[0] });
  const printed = r.isoConsole.filter((c) => /Nullecho/.test(c.text));
  assert.equal(printed.length, 1, `expected one isolated-world console line, got:\n${r.isoConsole.map((c) => c.method + ': ' + c.text).join('\n')}`);
  assert.equal(printed[0].method, 'error');
  assert.match(printed[0].text, /canvas\.toDataURL/);
  assert.match(printed[0].text, /AudioBuffer\.getChannelData/);
  assert.match(printed[0].text, /UNPROTECTED/, 'the warning keeps its teeth — it says what is unprotected');

  const status = r.toWorker.filter((m) => m.type === 'nullecho:shim-status').pop();
  assert.deepEqual(Array.from(status.failures), ['canvas.toDataURL', 'AudioBuffer.getChannelData'], 'the service worker hears the same list');
});

test('3d GUARD: the loader prints the forged-handshake warning the shim used to print itself — only once it is authenticated', async () => {
  const r = loaderRealm();
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'a'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0].reportTokens;

  // A page forging the status (no token) prints nothing — a page must not be able to make the loader talk.
  r.dispatch('nullecho:status', { upgraded: false, lockedToFallback: false, reason: 'forged-handshake-rejected' });
  assert.deepEqual(r.isoConsole, [], 'an unauthenticated report must not print');

  r.dispatch('nullecho:status', { upgraded: false, lockedToFallback: false, reason: 'forged-handshake-rejected', token: tokens[0] });
  const printed = r.isoConsole.filter((c) => /handshake/.test(c.text));
  assert.equal(printed.length, 1, `expected the forged-handshake line, got:\n${r.isoConsole.map((c) => c.text).join('\n')}`);
  assert.match(printed[0].text, /Nullecho/);
  assert.match(printed[0].text, /Protection stays ON/);
});

test('3d GUARD: a forged status cannot make the loader print a failure list — the list is only believed on a tokened report', async () => {
  const r = loaderRealm();
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'a'.repeat(32) });
  await r.settle();
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, failures: ['navigator.userAgent'] });
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, failures: ['navigator.userAgent'], token: 'g'.repeat(16) });
  assert.deepEqual(r.isoConsole, [], 'a page forged a failure report and the loader repeated it');
  assert.deepEqual(r.toWorker.filter((m) => m.type === 'nullecho:shim-status' && m.failures), []);
});

// ═══════════════════════════════════════════════════════════════════════════
// The nonce box is consumed inside a synchronous reply — nothing may read it after emit()
// ═══════════════════════════════════════════════════════════════════════════

test('PERF-doc REPRO: a loader that replies synchronously inside the boot dispatch gets a clean upgrade — no "no CSPRNG" claim anywhere, nothing on the page console', () => {
  const s = bootRealm({ syncReply: true });
  assert.ok(s.boot && s.boot.nonce, 'rig: the boot event went out with a nonce');
  assert.equal(s.dev().upgraded, true, 'the synchronous reply was accepted');
  assert.deepEqual(s.consoleCalls, [], 'the boot sequence read the consumed nonce box and cried "no CSPRNG"');
  assert.ok(!s.statuses.some((d) => /csprng/.test(String(d.reason))), 'no status may claim the realm lacked a CSPRNG');
  const upgraded = s.statuses.filter((d) => d.upgraded === true && typeof d.token === 'string');
  assert.equal(upgraded.length, 1, 'exactly one tokened upgrade status');
  // A junk handshake AFTER the one-shot was consumed is simply ignored: not
  // "no CSPRNG", not "forged" — the reason must come from mint time, never from the box.
  const before = s.statuses.length;
  s.send({ ok: true, enabled: false });
  assert.equal(s.statuses.length, before, 'a post-handshake junk message produces no status at all');
  assert.deepEqual(s.consoleCalls, []);
});

test('PERF-doc GUARD: a realm with no CSPRNG still refuses every handshake with the honest reason, and still says nothing to the page console', () => {
  const s = bootRealm({ csprng: false });
  assert.equal(s.boot.nonce, null, 'rig: no nonce could be minted');
  s.send({ ok: true, enabled: true, gpc: false, site: 'example.test', persona: DELIVERED, nonce: null, reportTokens: RIG_TOKENS });
  assert.equal(s.page('typeof __nullechoDev'), 'undefined', 'nothing was accepted (no dev surface installed)');
  assert.ok(s.statuses.some((d) => d.reason === 'no-csprng-handshake-refused'), `expected the no-CSPRNG refusal, got ${JSON.stringify(s.statuses.map((d) => d.reason))}`);
  assert.deepEqual(s.consoleCalls, [], 'the no-CSPRNG condition is the loader\'s to announce (shim-never-booted), not the page console\'s');
});
