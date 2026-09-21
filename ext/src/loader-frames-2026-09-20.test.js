/**
 * 2026-09-20 — first breakage run in a user's Chrome. Every YouTube watch page
 * printed "[Nullecho] The page-world shim did not answer on this document" six
 * seconds after load, and so did the first load of Chart.js, Squoosh and IRS.
 * The top document had booted at ~300 ms and authenticated at once; the alarm
 * came from a child `about:blank` frame with `sandbox="allow-same-origin"` — no
 * `allow-scripts`, so no page script can run there and Chrome injects no
 * MAIN-world script into it. Nothing to protect, nothing to alarm about.
 *
 * D48: (1) a frame whose sandbox forbids script neither reports nor prints;
 * (2) the console line is the top document's alone, as the R3b warning already
 * is; (3) a sub-frame miss still reaches the service worker as a status carrying
 * `top: false`, which the worker counts per site instead of showing as the
 * page's status. The loader's BOOT_CHECK_MS is 3 s; the rig clamps timers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loaderRealm } from './test-realm-rig.js';

const frame = (sandbox) => ({ getAttribute: (n) => (n === 'sandbox' ? sandbox : null) });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const neverBooted = (r) => r.toWorker.filter((m) => m.type === 'nullecho:shim-status' && m.reason === 'shim-never-booted');
const printed = (r) => r.isoConsole.filter((c) => /did not answer/.test(c.text));

test('D48: the top document with no shim reply reports `shim-never-booted` with top:true and prints the alarm', async () => {
  const r = loaderRealm({ fastTimers: true });
  await wait(250);
  assert.equal(neverBooted(r).length, 1, 'one status');
  assert.equal(neverBooted(r)[0].top, true);
  assert.equal(printed(r).length, 1, 'one console line, from the top document');
  assert.equal(printed(r)[0].method, 'error');
});

test('D48: a sub-frame (no sandbox) with no shim reply reports with top:false and prints NOTHING', async () => {
  const r = loaderRealm({ fastTimers: true, isTop: false, frameElement: frame(null) });
  await wait(250);
  assert.equal(neverBooted(r).length, 1, 'the worker still hears it');
  assert.equal(neverBooted(r)[0].top, false);
  assert.equal(printed(r).length, 0, 'the console line is the top document\'s alone');
});

test('D48: a sandboxed sub-frame WITHOUT allow-scripts neither reports nor prints — no page script can run there', async () => {
  const r = loaderRealm({ fastTimers: true, isTop: false, frameElement: frame('allow-same-origin') });
  await wait(250);
  assert.equal(neverBooted(r).length, 0, 'nothing to protect, nothing to report');
  assert.equal(printed(r).length, 0);
});

test('D48: a sandboxed sub-frame WITH allow-scripts is a real realm and still reports (quietly)', async () => {
  const r = loaderRealm({ fastTimers: true, isTop: false, frameElement: frame('allow-scripts allow-same-origin') });
  await wait(250);
  assert.equal(neverBooted(r).length, 1);
  assert.equal(neverBooted(r)[0].top, false);
  assert.equal(printed(r).length, 0);
});

test('D48: an empty sandbox attribute (`sandbox=""`) forbids script too', async () => {
  const r = loaderRealm({ fastTimers: true, isTop: false, frameElement: frame('') });
  await wait(250);
  assert.equal(neverBooted(r).length, 0);
});

test('D48 GUARD: a top document that DID get a reply never reports never-booted (the alarm did not get louder elsewhere)', async () => {
  const r = loaderRealm({ fastTimers: true });
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'a'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0]?.reportTokens;
  assert.ok(Array.isArray(tokens) && tokens.length, 'rig: the loader delivered no reply tokens');
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, token: tokens[0] });
  await wait(250);
  assert.equal(neverBooted(r).length, 0);
  assert.equal(printed(r).length, 0);
});
