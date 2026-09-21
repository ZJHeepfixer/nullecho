/**
 * 2026-09-20 — first breakage run in a user's Chrome. On Google Maps the loader
 * printed "could NOT patch: offscreenCanvas.getImageData" on every load. The page
 * was fine: the wrapper caught its own throw and returned the native bytes. But
 * the API was UNPROTECTED on every page that reads an OffscreenCanvas, not only
 * Maps: `patchGetImageData` reached for the context's canvas through the
 * accessor captured from `CanvasRenderingContext2D`, and Chrome's brand check
 * throws `Illegal invocation` when that getter meets an
 * `OffscreenCanvasRenderingContext2D`. The rig brand-checks the same way, so
 * this test failed on the shim it was written against
 * (`NULLECHO_SHIM_SRC=<(git show 1e1dde9:ext/src/shim.js)`) and passes now.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootRealm } from './test-realm-rig.js';

const READ = (ctor) => `
  (() => {
    const cv = ${ctor === 'OffscreenCanvas' ? 'new OffscreenCanvas(8, 8)' : "(() => { const c = document.createElement('canvas'); c.width = 8; c.height = 8; return c; })()"};
    const ctx = cv.getContext('2d');
    ctx.fillRect(0, 0, 8, 8);
    const img = ctx.getImageData(2, 2, 4, 4);
    return { w: img.width, h: img.height, bytes: Array.from(img.data) };
  })()
`;

test('offscreenCanvas.getImageData: a partial read on an OffscreenCanvas context records no run-time failure', () => {
  const s = bootRealm();
  s.upgrade();
  const out = s.page(READ('OffscreenCanvas'));
  assert.equal(out.w, 4);
  assert.equal(out.h, 4);
  const failed = Array.from(s.dev().failures, (f) => `${f.label}: ${String(f.error).split('\n')[0]}`);
  assert.deepEqual(failed, [], 'the offscreen wrapper must not fail on its own receiver');
});

test('offscreenCanvas.getImageData: the same ink read through an OffscreenCanvas and an HTMLCanvasElement is noised identically', () => {
  const s = bootRealm();
  s.upgrade();
  const on = s.page(READ('HTMLCanvasElement'));
  const off = s.page(READ('OffscreenCanvas'));
  assert.deepEqual(off.bytes, on.bytes, 'one canvas key, one persona, one noise pattern — whichever canvas type carries the pixels');
  const flat = on.bytes.every((b, i) => b === [90, 120, 150, 255][i % 4]);
  assert.equal(flat, false, 'rig sanity: the on-screen read carries persona noise, so equality is a statement about noise, not about raw bytes');
  assert.deepEqual(Array.from(s.dev().failures), []);
});

test('offscreenCanvas.getImageData: a whole-canvas read on an OffscreenCanvas context is counted as a canvas read and records no failure', () => {
  const s = bootRealm();
  s.upgrade();
  const before = s.dev().reads | 0;
  s.page(`(() => { const oc = new OffscreenCanvas(4, 4); const c = oc.getContext('2d'); c.fillRect(0, 0, 4, 4); c.getImageData(0, 0, 4, 4); })()`);
  assert.ok((s.dev().reads | 0) > before, 'the read is counted');
  assert.deepEqual(Array.from(s.dev().failures), []);
});
