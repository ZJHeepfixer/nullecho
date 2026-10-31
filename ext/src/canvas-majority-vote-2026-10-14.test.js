/**
 * 2026-10-14 — DECISIONS.md D56. The WWW '25 majority-vote attack, run on the SHIPPED kernel.
 *
 * Nguyen & Vadrevu, "Breaking the Shield" (WWW '25, doi:10.1145/3696410.3714713), Algorithm 3:
 * draw the same content on several canvases, each with a different colour strip on top, read
 * the region below the strip from every canvas and keep, per pixel and channel, the value most
 * of the reads agree on. Our kernel keys the noise on a digest of the WHOLE canvas (D22), so
 * each strip colour is a fresh digest and a fresh 1-in-8 pixel selection; the true value is
 * what most reads carry.
 *
 * ⚠ READ THIS BEFORE "FIXING" A RED TEST. The FINDING tests PASS while the defect is present —
 * the convention of review-2026-09-16.test.js. They assert what a page can do TODAY. A kernel
 * change that defeats the vote turns them red; then flip them into guards AND re-measure with
 * `harness/canvas-majority-vote.mjs`, including its translate and colour-shift variants — D56
 * records why every deterministic kernel we tried fell to one of those.
 *
 * Proven able to fail: with `canvasKeyFor` reverted to the pre-D22 position-only key
 * (`NULLECHO_SHIM_SRC=<file with "facts.digest" removed from canvasKeyFor>`), every strip gets
 * the same pattern, the vote returns the noised bytes, and the FINDING tests go red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootRealm, DELIVERED } from './test-realm-rig.js';

const W = 64, H = 40, STRIP = 4;

/** The page's side: N canvases, the same "real" content below a unique strip, region read back through the shim. */
const ATTACK = (N, seed) => `
  (() => {
    const W = ${W}, H = ${H}, STRIP = ${STRIP}, N = ${N};
    let s = ${seed} >>> 0;
    const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
    // The machine's real rendering of the fingerprint region (what the page cannot see).
    const real = new ImageData(W, H + STRIP), rd = real.data;
    for (let i = 0; i < rd.length; i += 4) { rd[i] = next() & 255; rd[i + 1] = next() & 255; rd[i + 2] = next() & 255; rd[i + 3] = 255; }
    const reads = [], again = [];
    for (let k = 0; k < N; k++) {
      const c = document.createElement('canvas'); c.width = W; c.height = H + STRIP;
      const ctx = c.getContext('2d');
      ctx.putImageData(real, 0, 0);
      const strip = new ImageData(W, STRIP), sd = strip.data;
      for (let i = 0; i < sd.length; i += 4) { sd[i] = (k * 37) & 255; sd[i + 1] = (k * 91 + 13) & 255; sd[i + 2] = (k * 53 + 101) & 255; sd[i + 3] = 255; }
      ctx.putImageData(strip, 0, 0);
      reads.push(Array.from(ctx.getImageData(0, STRIP, W, H).data));
      again.push(Array.from(ctx.getImageData(0, STRIP, W, H).data));
    }
    const truth = Array.from(rd.subarray(W * STRIP * 4));
    return { reads, again, truth };
  })()
`;

/** Algorithm 3's vote. 'majority': > N/2 (the paper's "≥ 3 of 5"), else F1. 'plurality': most frequent, ties to F1. */
function vote(reads, mode) {
  const n = reads.length, out = reads[0].slice();
  for (let i = 0; i < out.length; i++) {
    if (i % 4 === 3) continue;
    const counts = new Map();
    for (const r of reads) counts.set(r[i], (counts.get(r[i]) || 0) + 1);
    let best = reads[0][i], max = counts.get(best);
    for (const [v, c] of counts) if (c > max) { best = v; max = c; }
    if (mode === 'plurality' || max > n / 2) out[i] = best;
  }
  return out;
}
const differing = (a, b) => a.reduce((k, v, i) => k + (v !== b[i] ? 1 : 0), 0);

test('D56 FINDING: Algorithm 3 recovers the real bytes through the shipped kernel (N = 21, plurality and strict majority)', () => {
  const s = bootRealm();
  s.upgrade();
  const { reads, again, truth } = s.page(ATTACK(21, 0x5eed));
  assert.ok(reads.every((r, k) => differing(r, again[k]) === 0), 'each canvas reads back byte-identical twice — the repeated-read property holds');
  assert.ok(reads.every((r) => differing(r, truth) > 0), 'every single read is noised');
  assert.ok(new Set(reads.map((r) => r.join())).size === reads.length, 'each strip colour gets its own noise: 21 different reads of one region');
  assert.equal(differing(vote(reads, 'plurality'), truth), 0, 'FINDING: the plurality vote returns the real bytes');
  assert.equal(differing(vote(reads, 'majority'), truth), 0, 'FINDING: the strict-majority vote returns the real bytes');
});

test('D56 FINDING: two personas recover the SAME real bytes — the vote restores the cross-site join for the canvas signal', () => {
  const a = bootRealm(); a.upgrade();
  const b = bootRealm(); b.upgrade({ persona: { ...DELIVERED, noise: { canvas: 0.6180339, audio: 0.5, webgl: 0.75 } } });
  const ra = a.page(ATTACK(21, 0x5eed)), rb = b.page(ATTACK(21, 0x5eed));
  assert.ok(differing(ra.reads[0], rb.reads[0]) > 0, 'the two personas read different noised bytes — the single-read defence works');
  const va = vote(ra.reads, 'plurality'), vb = vote(rb.reads, 'plurality');
  assert.equal(differing(va, vb), 0, 'FINDING: after the vote both personas hand the page identical bytes');
  assert.equal(differing(va, ra.truth), 0, 'FINDING: and they are the real ones');
});

test('D56: at N = 5 the strict majority still leaves errors on a 64×40 region — the attack needs more canvases, not a different idea', () => {
  const s = bootRealm();
  s.upgrade();
  const { reads, truth } = s.page(ATTACK(5, 0x5eed));
  const wrong = differing(vote(reads, 'majority'), truth);
  // P(a pixel is selected in ≥ 3 of 5 independent 1-in-8 draws) ≈ 1.6%; 2,560 pixels × 3 channels.
  assert.ok(wrong > 0 && wrong < 400, `strict majority at N = 5 leaves a small residue (${wrong} channels) — a matter of N`);
});
