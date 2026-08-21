/**
 * Nullecho — persona pool + selection tests
 * ──────────────────────────────────────────
 * Two jobs:
 *
 *  1. Every shipped persona is internally consistent, and the validator that
 *     proves it actually rejects the contradictions it claims to catch. A
 *     validator that passes everything is worse than no validator — it produces
 *     confidence without protection.
 *
 *  2. The determinism properties the whole design rests on (ARCHITECTURE.md,
 *     "The design: per-origin stable personas"):
 *       - same (salt, origin)  → same persona, forever   [no instability signal]
 *       - same salt, different origins → different personas [breaks cross-site linking]
 *       - new salt → re-roll  [the "new identity" button must actually work]
 *       - noise deterministic per (salt, origin) [defeats the averaging attack]
 *
 *  3. Since D12: selection never leaves the host's OS family, and every family
 *     is stocked well enough that constraining to it does not cost the property
 *     in (2). The pool-shape tests are therefore run PER FAMILY — a pool-wide
 *     assertion would now be testing something no user ever experiences.
 *
 * Every test that cares about pool shape passes an EXPLICIT family. Tests must
 * not depend on the OS of the machine running them, and `personaFor`'s default
 * argument is the real host.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  PERSONAS, FONT_SETS, FAMILIES, DEFAULT_FAMILY, MIN_PERSONAS_PER_FAMILY,
  personaFor, personasForFamily, familyOf, seedFor, hashString, rngFrom, newSalt,
  detectHostFamily, familyFromPlatformString, hostFamily,
} from './personas.js';
import {
  validatePersona, validatePool, validateFamilies, MAX_DEVICE_MEMORY, HDR_PANELS,
  FAMILY_WEIGHT_TOTAL, MAX_FAMILY_COLLISION,
} from './persona-validator.js';

const SALT_A = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SALT_B = '00112233445566778899aabbccddeeff';

const familyWeight = (family) =>
  personasForFamily(family).reduce((a, p) => a + p.weight, 0);
const origins = (n, tag = 'o') =>
  Array.from({ length: n }, (_, i) => `https://${tag}${i}.example`);

/** Assert the persona is rejected and that some error explains why. */
function assertRejected(persona, pattern, label) {
  const { valid, errors } = validatePersona(persona);
  assert.equal(valid, false, `${label}: expected validatePersona to REJECT this persona`);
  assert.ok(
    errors.some((e) => pattern.test(e)),
    `${label}: no error matched ${pattern}\n  got:\n${errors.map((e) => '    - ' + e).join('\n')}`,
  );
}

/** A known-good persona to mutate into fixtures. Deep-cloned so tests can't leak. */
function baseWindows(overrides = {}) {
  const base = structuredClone(PERSONAS.find((p) => p.id === 'win11-chrome-uhd620'));
  return { ...base, ...overrides, id: overrides.id ?? 'fixture' };
}
function baseMac(overrides = {}) {
  const base = structuredClone(PERSONAS.find((p) => p.id === 'macos-chrome-m1'));
  return { ...base, ...overrides, id: overrides.id ?? 'fixture' };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. The shipped pool
// ═══════════════════════════════════════════════════════════════════════════

test('every shipped persona passes the consistency validator', () => {
  const failures = [];
  for (const p of PERSONAS) {
    const { valid, errors } = validatePersona(p);
    if (!valid) failures.push(...errors);
  }
  assert.deepEqual(failures, [], `pool has inconsistent personas:\n${failures.join('\n')}`);
});

test('the pool as a whole is valid: unique ids, positive weights', () => {
  const { valid, errors } = validatePool(PERSONAS);
  assert.equal(valid, true, errors.join('\n'));

  const ids = PERSONAS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'persona ids must be unique');
  for (const p of PERSONAS) {
    assert.ok(p.weight > 0, `${p.id}: weight must be > 0`);
  }
});

test('validatePool reports duplicate ids', () => {
  const dupe = [PERSONAS[0], structuredClone(PERSONAS[0])];
  const { valid, errors } = validatePool(dupe);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => /duplicate persona id/.test(e)), errors.join('\n'));
});

test('personaFor() output — the object the shim actually consumes — validates', () => {
  // personaFor spreads the persona and attaches fontList/seed/noise. The shim
  // reads *that* object, so that is what has to be consistent.
  for (const family of FAMILIES) {
    for (const o of origins(50)) {
      const p = personaFor(SALT_A, o, family);
      const { valid, errors } = validatePersona(p);
      assert.equal(valid, true, `${family} ${o} → ${p.id}: ${errors.join('; ')}`);
    }
  }
});

test('every persona resolves to a real font set, and only its own OS fonts', () => {
  for (const p of PERSONAS) {
    assert.ok(FONT_SETS[p.fonts], `${p.id}: fonts key "${p.fonts}" missing from FONT_SETS`);
    assert.ok(FONT_SETS[p.fonts].length > 10, `${p.id}: font set is suspiciously short`);
    assert.equal(personaFor(SALT_A, 'https://x.example').fontList !== undefined, true);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Determinism — the property the design depends on
// ═══════════════════════════════════════════════════════════════════════════

test('personaFor(salt, origin) is stable across 100 calls', () => {
  const origin = 'https://news.example';
  const first = personaFor(SALT_A, origin);
  for (let i = 0; i < 100; i++) {
    const again = personaFor(SALT_A, origin);
    assert.equal(again.id, first.id, `call ${i}: persona changed`);
    assert.equal(again.seed, first.seed, `call ${i}: seed changed`);
    assert.deepEqual(again.noise, first.noise, `call ${i}: noise changed`);
    assert.deepEqual(again.screen, first.screen, `call ${i}: screen changed`);
    assert.equal(again.ua, first.ua, `call ${i}: UA changed`);
  }
});

test('stability holds for many different origins, not just one lucky one', () => {
  for (const o of origins(200)) {
    const a = personaFor(SALT_A, o);
    const b = personaFor(SALT_A, o);
    assert.equal(a.id, b.id, `${o}: unstable`);
    assert.deepEqual(a.noise, b.noise, `${o}: noise unstable`);
  }
});

test('hashString / seedFor / rngFrom are pure', () => {
  assert.equal(hashString('abc'), hashString('abc'));
  assert.equal(seedFor(SALT_A, 'https://x.example'), seedFor(SALT_A, 'https://x.example'));
  const s = seedFor(SALT_A, 'https://x.example');
  const r1 = rngFrom(s), r2 = rngFrom(s);
  for (let i = 0; i < 20; i++) assert.equal(r1(), r2(), `rng diverged at draw ${i}`);
});

test('different origins spread across the WHOLE family (cross-site linking broken)', () => {
  // The property that matters after D12: within the family a user is actually
  // constrained to, origins still land on different machines. Checked for every
  // family, because each one is somebody's entire pool.
  for (const family of FAMILIES) {
    const pool = personasForFamily(family);
    const seen = new Map();
    const list = origins(2000, 'site');
    for (const o of list) {
      const p = personaFor(SALT_A, o, family);
      seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
    }

    assert.ok(seen.size > 1, `${family}: all origins got the SAME persona — linking not broken`);
    assert.equal(seen.size, pool.length,
      `${family}: only ${seen.size}/${pool.length} personas ever chosen`);

    // No single persona may swallow the family.
    for (const [id, n] of seen) {
      assert.ok(n / list.length < 0.6,
        `${family}/${id} took ${(n / list.length * 100).toFixed(1)}% of origins`);
    }

    // Two specific unrelated origins must not be forced to match.
    const a = personaFor(SALT_A, 'https://bank.example', family);
    const b = personaFor(SALT_A, 'https://tracker.example', family);
    assert.notEqual(a.seed, b.seed, `${family}: distinct origins produced an identical seed`);
  }
});

test('a new salt re-rolls personas for the same origins ("new identity" works)', () => {
  for (const family of FAMILIES) {
    const pool = personasForFamily(family);
    const W = familyWeight(family);
    const list = origins(500, 'reroll');
    let changedPersona = 0;

    for (const o of list) {
      assert.notEqual(
        seedFor(SALT_A, o), seedFor(SALT_B, o),
        `${o}: seed did not change when the salt changed`,
      );
      const a = personaFor(SALT_A, o, family);
      const b = personaFor(SALT_B, o, family);
      assert.notDeepEqual(a.noise, b.noise, `${o}: noise survived the salt rotation`);
      if (a.id !== b.id) changedPersona++;
    }

    // The chance a re-roll lands on the same persona is Σ(wᵢ/W)² — 0.18–0.22
    // per family — so ~80% of origins should change. Anything under half means
    // the salt is not really feeding selection.
    const rate = changedPersona / list.length;
    const expected = 1 - pool.reduce((a, p) => a + (p.weight / W) ** 2, 0);
    assert.ok(rate > 0.5,
      `${family}: only ${(rate * 100).toFixed(1)}% of origins re-rolled (expect ≈${(expected * 100).toFixed(0)}%)`);
  }
});

test('newSalt() produces distinct 128-bit hex salts', () => {
  const salts = new Set(Array.from({ length: 200 }, () => newSalt()));
  assert.equal(salts.size, 200, 'newSalt() collided');
  for (const s of salts) assert.match(s, /^[0-9a-f]{32}$/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Noise determinism — what defeats the repeated-sampling averaging attack
// ═══════════════════════════════════════════════════════════════════════════

test('noise is deterministic per (salt, origin) — averaging attack has nothing to average', () => {
  const origin = 'https://canvas-probe.example';
  const { noise } = personaFor(SALT_A, origin);

  // A page that samples the canvas 50× must see the identical noise key each
  // time; otherwise the mean converges on the true value.
  const samples = Array.from({ length: 50 }, () => personaFor(SALT_A, origin).noise);
  for (const [i, s] of samples.entries()) {
    assert.deepEqual(s, noise, `sample ${i} differed — per-read noise is recoverable by averaging`);
  }

  const canvasKeys = new Set(samples.map((s) => s.canvas));
  assert.equal(canvasKeys.size, 1, 'canvas noise key varied across reads');
});

test('noise keys are well-formed and differ across origins', () => {
  const seenCanvas = new Set();
  for (const o of origins(500, 'noise')) {
    const { noise } = personaFor(SALT_A, o);
    for (const k of ['canvas', 'audio', 'webgl']) {
      assert.equal(typeof noise[k], 'number', `${o}: noise.${k} is not a number`);
      assert.ok(noise[k] >= 0 && noise[k] < 1, `${o}: noise.${k} out of [0,1): ${noise[k]}`);
    }
    seenCanvas.add(noise.canvas);
  }
  // Distinct origins must not share a canvas key, or two sites could correlate.
  assert.ok(seenCanvas.size > 490, `only ${seenCanvas.size}/500 distinct canvas keys`);
});

test('the three noise channels are independent of each other', () => {
  for (const o of origins(100, 'chan')) {
    const { noise } = personaFor(SALT_A, o);
    assert.notEqual(noise.canvas, noise.audio, `${o}: canvas and audio noise identical`);
    assert.notEqual(noise.audio, noise.webgl, `${o}: audio and webgl noise identical`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Weighted selection
// ═══════════════════════════════════════════════════════════════════════════

test('weighted selection respects weights over ~10,000 origins, per family', () => {
  const N = 10000;
  for (const family of FAMILIES) {
    const pool = personasForFamily(family);
    const W = familyWeight(family);
    const counts = new Map(pool.map((p) => [p.id, 0]));
    for (let i = 0; i < N; i++) {
      const p = personaFor(SALT_A, `https://w${i}.example`, family);
      counts.set(p.id, counts.get(p.id) + 1);
    }

    const sorted = [...pool].sort((a, b) => b.weight - a.weight);
    const heaviest = sorted[0];
    const lightest = sorted[sorted.length - 1];

    assert.ok(
      counts.get(heaviest.id) > counts.get(lightest.id) * 1.5,
      `${family}: weighting is not applied: ${heaviest.id} (w=${heaviest.weight}) got ` +
      `${counts.get(heaviest.id)}, ${lightest.id} (w=${lightest.weight}) got ${counts.get(lightest.id)}`,
    );

    // Every persona reachable — a persona nobody ever gets is dead weight.
    for (const p of pool) {
      assert.ok(counts.get(p.id) > 0, `${p.id} was never selected in ${N} draws`);
    }

    // Each share within 3 percentage points of its weight. Measured error at
    // this N is well under 1pt, so 3pt is a generous non-flaky band that still
    // catches a mis-ordered or off-by-one cumulative-weight walk.
    for (const p of pool) {
      const actual = counts.get(p.id) / N * 100;
      const want = p.weight / W * 100;
      assert.ok(
        Math.abs(actual - want) < 3,
        `${p.id}: expected ≈${want.toFixed(1)}%, got ${actual.toFixed(1)}%`,
      );
    }
  }
});

test('selection ordering matches weight ordering, per family', () => {
  const N = 10000;
  for (const family of FAMILIES) {
    const pool = personasForFamily(family);
    const counts = new Map(pool.map((p) => [p.id, 0]));
    for (let i = 0; i < N; i++) {
      const { id } = personaFor(SALT_B, `https://ord${i}.example`, family);
      counts.set(id, counts.get(id) + 1);
    }
    // Compare only pairs whose weights differ by enough that sampling noise at
    // this N cannot flip them (σ ≈ 40 draws per persona, so a 3-point gap is ~7σ).
    // A strict full-ordering assert would be brittle against future weight tweaks
    // without testing anything more.
    for (const a of pool) {
      for (const b of pool) {
        if (a.weight - b.weight < 3) continue;
        assert.ok(
          counts.get(a.id) > counts.get(b.id),
          `${family}: ${a.id} (w=${a.weight}) got ${counts.get(a.id)} but ${b.id} ` +
          `(w=${b.weight}) got ${counts.get(b.id)}`,
        );
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. The validator must REJECT contradictions
//    (a validator that passes everything is the worst outcome — it manufactures
//     confidence while the user is unprotected)
// ═══════════════════════════════════════════════════════════════════════════

test('rejects: Windows UA + Apple GPU renderer', () => {
  assertRejected(
    baseWindows({
      id: 'broken-win-apple-gpu',
      gpu: {
        vendor: 'Google Inc. (Apple)',
        renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
        unmaskedVendor: 'Google Inc. (Apple)',
        maxTextureSize: 16384,
      },
    }),
    /Apple\/Metal but the platform is Win32/,
    'Windows UA + Apple GPU',
  );
});

test('rejects: Direct3D11 renderer on macOS', () => {
  assertRejected(
    baseMac({
      id: 'broken-mac-d3d11',
      gpu: {
        vendor: 'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
        unmaskedVendor: 'Google Inc. (NVIDIA)',
        maxTextureSize: 16384,
      },
      uaData: { ...structuredClone(PERSONAS.find((p) => p.id === 'macos-chrome-m1').uaData), architecture: 'x86' },
    }),
    /Direct3D is Windows-only/,
    'macOS + D3D11',
  );
});

test('rejects: Mesa renderer on Win32', () => {
  assertRejected(
    baseWindows({
      id: 'broken-win-mesa',
      gpu: {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)',
        unmaskedVendor: 'Google Inc. (Intel)',
        maxTextureSize: 16384,
      },
    }),
    /Mesa is the Linux\/BSD userspace GL stack/,
    'Win32 + Mesa',
  );
});

test('rejects: 3 cores', () => {
  assertRejected(
    baseWindows({ id: 'broken-3-cores', cores: 3 }),
    /cores 3 is not a real hardwareConcurrency value/,
    '3 cores',
  );
});

test('rejects: colorDepth 30 (HDR re-identifies — DECISIONS.md D3)', () => {
  const p = baseWindows({ id: 'broken-hdr' });
  p.screen = { ...p.screen, colorDepth: 30 };
  assertRejected(p, /colorDepth must be 24.*HDR/s, 'colorDepth 30');
});

test('rejects: macOS persona carrying Windows fonts', () => {
  // Both ways it can be expressed: by font-set key, and by an explicit list.
  assertRejected(
    baseMac({ id: 'broken-mac-winfonts-key', fonts: 'windows-11' }),
    /is a win set but the platform "MacIntel" is mac/,
    'macOS + windows-11 font key',
  );

  assertRejected(
    baseMac({
      id: 'broken-mac-segoe-list',
      fonts: 'macos-14',
      fontList: [...FONT_SETS['macos-14'], 'Segoe UI'],
    }),
    /contains "Segoe UI", which does not ship on MacIntel/,
    'macOS font list containing Segoe UI',
  );
});

test('rejects: Windows persona carrying Helvetica Neue', () => {
  assertRejected(
    baseWindows({
      id: 'broken-win-helvetica',
      fontList: [...FONT_SETS['windows-11'], 'Helvetica Neue'],
    }),
    /contains "Helvetica Neue", which does not ship on Win32/,
    'Windows + Helvetica Neue',
  );
});

test('rejects: unknown fonts key', () => {
  assertRejected(
    baseWindows({ id: 'broken-font-key', fonts: 'windows-95' }),
    /does not exist in FONT_SETS/,
    'unknown font set',
  );
});

test('rejects: UA and uaData.platform disagree', () => {
  const p = baseWindows({ id: 'broken-hints' });
  p.uaData = { ...p.uaData, platform: 'macOS' };
  assertRejected(p, /Client Hints must agree with the UA string/, 'UA/CH mismatch');

  const q = baseMac({ id: 'broken-hints-linux' });
  q.uaData = { ...q.uaData, platform: 'Linux' };
  assertRejected(q, /UA claims macOS but uaData.platform is "Linux"/, 'mac UA + Linux hint');
});

test('rejects: arm architecture paired with a discrete NVIDIA GPU', () => {
  const p = baseWindows({ id: 'broken-arm-nvidia' });
  p.uaData = { ...p.uaData, architecture: 'arm' };
  p.gpu = {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    unmaskedVendor: 'Google Inc. (NVIDIA)',
    maxTextureSize: 16384,
  };
  assertRejected(p, /architecture is "arm" but the GPU is an x86-host part/, 'arm + RTX 3060');
});

test('rejects: Apple Silicon renderer without arm architecture', () => {
  const p = baseMac({ id: 'broken-m1-x86' });
  p.uaData = { ...p.uaData, architecture: 'x86' };
  assertRejected(p, /Apple M-series is arm64/, 'Apple M1 + x86');
});

test('rejects: deviceMemory above Chrome\'s desktop reporting ceiling', () => {
  // Desktop Chromium clamps to 2–32 (Android is the one that clamps to 8).
  // 64 is unreachable and therefore a tell.
  assertRejected(
    baseWindows({ id: 'broken-mem-64', memory: 64 }),
    /is not a plausible RAM size/,
    'memory 64',
  );
  assertRejected(
    baseWindows({ id: 'broken-mem-5', memory: 5 }),
    /is not a plausible RAM size/,
    'memory 5',
  );

  // Direct check of the ceiling rule itself, bypassing the value-set check.
  const { errors } = validatePersona(baseWindows({ id: 'ceiling', memory: MAX_DEVICE_MEMORY + 1 }));
  assert.ok(errors.length > 0, 'a value above the ceiling must be rejected');
});

test('ACCEPTS 16 and 32 GB — the desktop clamp is 32, not 8', () => {
  // Regression guard. The pool previously assumed Chrome caps deviceMemory at
  // 8; that is the Android ceiling. Verified against Chromium's
  // approximated_device_memory.cc (kMaxMemory = 32.0f on desktop) and measured
  // on real Chrome 151, which returns 32. If someone "restores" the 8 cap,
  // this test fails.
  assert.equal(MAX_DEVICE_MEMORY, 32);
  for (const memory of [8, 16, 32]) {
    const p = baseWindows({ id: `mem-${memory}`, memory, cores: 16 });
    const { valid, errors } = validatePersona(p);
    assert.equal(valid, true, `memory ${memory} should validate: ${errors.join('; ')}`);
  }
});

test('EVERY FAMILY spreads across memory buckets — a uniform 8 GB family is itself a tell', () => {
  // Pool-wide used to be enough. It is not any more: a Mac user only ever draws
  // from the mac family, so the spread has to exist inside each one.
  for (const family of FAMILIES) {
    const pool = personasForFamily(family);
    const W = familyWeight(family);
    const byMemory = new Map();
    for (const p of pool) {
      byMemory.set(p.memory, (byMemory.get(p.memory) ?? 0) + p.weight);
    }
    assert.ok(byMemory.size >= 3,
      `${family}: only ${byMemory.size} distinct memory values — ${[...byMemory.keys()].join(', ')}`);

    for (const [memory, weight] of byMemory) {
      assert.ok(
        weight / W < 0.6,
        `${family}: ${(weight / W * 100).toFixed(0)}% reports deviceMemory ${memory} — a cluster`,
      );
    }
  }
});

test('rejects: an HDR panel, which would force colorDepth 30', () => {
  // 1512×982 is a 14" MacBook Pro XDR display. Measured on real Chrome 151: it
  // reports colorDepth 30. Claiming that panel with colorDepth 24 is the exact
  // kind of contradiction this validator exists to catch, so the panel is out.
  for (const [width, height] of HDR_PANELS) {
    const p = baseMac({ id: `broken-hdr-panel-${width}` });
    p.screen = { ...p.screen, width, height, availHeight: height - 25 };
    assertRejected(p, /is a 10-bit HDR panel/, `${width}×${height} XDR panel`);
  }
});

test('rejects: a discrete gaming GPU paired with 8 GB of RAM', () => {
  // The pool shipped an RTX 3060 with 8 GB. Nobody builds that.
  const p = baseWindows({ id: 'broken-rtx-8gb', memory: 8, cores: 12 });
  p.gpu = {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    unmaskedVendor: 'Google Inc. (NVIDIA)',
    maxTextureSize: 16384,
  };
  assertRejected(p, /discrete gaming GPU .* with only 8 GB/, 'RTX 3060 + 8 GB');

  // …but an *integrated* Radeon Vega with 8 GB is a real budget laptop and must
  // still pass, or the rule is too blunt to be useful.
  const ok = PERSONAS.find((x) => x.id === 'win11-chrome-amd-vega');
  assert.equal(ok.memory, 8);
  assert.equal(validatePersona(ok).valid, true, 'integrated Vega + 8 GB must remain valid');
});

test('rejects: 32 GB paired with a low core count', () => {
  assertRejected(
    baseWindows({ id: 'broken-32gb-2core', memory: 32, cores: 2 }),
    /32 GB builds are enthusiast\/workstation parts/,
    '32 GB + 2 cores',
  );
});

test('rejects: availHeight >= height', () => {
  const p = baseWindows({ id: 'broken-availheight' });
  p.screen = { ...p.screen, availHeight: p.screen.height };
  assertRejected(p, /availHeight .* must be < screen.height/, 'availHeight == height');
});

test('rejects: uncommon panel size', () => {
  const p = baseWindows({ id: 'broken-panel' });
  p.screen = { ...p.screen, width: 1234, height: 987, availHeight: 939 };
  assertRejected(p, /is not a high-population panel size/, 'odd panel');
});

test('rejects: weight of zero or below', () => {
  assertRejected(baseWindows({ id: 'broken-w0', weight: 0 }), /weight must be a number > 0/, 'weight 0');
  assertRejected(baseWindows({ id: 'broken-wneg', weight: -5 }), /weight must be a number > 0/, 'weight -5');
});

test('rejects: gpu.vendor and gpu.renderer naming different vendors', () => {
  const p = baseWindows({ id: 'broken-vendor-mismatch' });
  p.gpu = { ...p.gpu, vendor: 'Google Inc. (NVIDIA)', unmaskedVendor: 'Google Inc. (NVIDIA)' };
  assertRejected(p, /cannot disagree/, 'vendor/renderer mismatch');
});

test('rejects: Windows 11 os key with a Windows 10 platformVersion', () => {
  const p = baseWindows({ id: 'broken-winver' });
  p.uaData = { ...p.uaData, platformVersion: '10.0.0' };
  assertRejected(p, /below the Windows 11 threshold/, 'win11 + platformVersion 10');
});

test('rejects: a Windows 10 taskbar height on a Windows 11 persona', () => {
  // This is the exact defect the pool shipped with (1366×768 with availHeight
  // 728 = a 40px Windows 10 taskbar on a Windows 11 machine).
  const p = baseWindows({ id: 'broken-taskbar' });
  p.screen = { ...p.screen, availHeight: p.screen.height - 40 };
  assertRejected(p, /reserves 48px for its default taskbar/, 'win10 taskbar on win11');
});

test('rejects: an OpenGL macOS renderer on a modern Chrome UA', () => {
  // The pool's other shipped defect.
  const p = baseMac({ id: 'broken-mac-opengl' });
  p.uaData = { ...p.uaData, architecture: 'x86' };
  p.gpu = {
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 645, OpenGL 4.1)',
    unmaskedVendor: 'Google Inc. (Intel)',
    maxTextureSize: 16384,
  };
  assertRejected(p, /uses the ANGLE Metal backend by default/, 'macOS OpenGL backend');
});

test('validator never throws on malformed input', () => {
  for (const junk of [null, undefined, 42, 'nope', [], {}, { id: 'x' }, { gpu: null, screen: null }]) {
    const r = validatePersona(junk);
    assert.equal(typeof r.valid, 'boolean');
    assert.ok(Array.isArray(r.errors));
    assert.equal(r.valid, false, `${JSON.stringify(junk)} should not validate`);
  }
});

test('every rejection carries a message naming the persona', () => {
  const { errors } = validatePersona(baseWindows({ id: 'named-fixture', cores: 3 }));
  assert.ok(errors.every((e) => e.includes('named-fixture')), errors.join('\n'));
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. The host-OS constraint (DECISIONS.md D12)
//
//    The claim being tested: constraining selection to the host's OS family
//    removes the cross-OS contradictions WITHOUT costing cross-site
//    unlinkability. Both halves need proof — the constraint is only safe while
//    every family stays big enough to keep origins apart.
// ═══════════════════════════════════════════════════════════════════════════

test('a persona is NEVER selected outside the host family', () => {
  for (const family of FAMILIES) {
    for (let i = 0; i < 5000; i++) {
      const p = personaFor(SALT_A, `https://x${i}.example`, family);
      assert.equal(familyOf(p), family,
        `origin ${i} on a ${family} host was shown ${p.id} (${familyOf(p)}) — ` +
        'a foreign-OS persona is exactly what D12 removes');
    }
  }
});

test('the same (salt, origin, family) is stable — the constraint did not break determinism', () => {
  for (const family of FAMILIES) {
    const origin = 'https://news.example';
    const first = personaFor(SALT_A, origin, family);
    for (let i = 0; i < 100; i++) {
      const again = personaFor(SALT_A, origin, family);
      assert.equal(again.id, first.id, `${family} call ${i}: persona changed`);
      assert.equal(again.seed, first.seed, `${family} call ${i}: seed changed`);
      assert.deepEqual(again.noise, first.noise, `${family} call ${i}: noise changed`);
    }
  }
});

test('the family argument changes WHICH persona, never the seed or the noise keys', () => {
  // The PRNG stream is consumed in the same order regardless of family: one
  // draw for the weighted roll, then three for the noise keys. If a future edit
  // adds a draw inside the family branch, every canvas/audio/webgl key silently
  // shifts and this catches it.
  for (const o of origins(200, 'stream')) {
    const win = personaFor(SALT_A, o, 'win');
    const mac = personaFor(SALT_A, o, 'mac');
    const linux = personaFor(SALT_A, o, 'linux');
    assert.equal(win.seed, mac.seed);
    assert.equal(win.seed, linux.seed);
    assert.deepEqual(win.noise, mac.noise, `${o}: noise keys moved with the family`);
    assert.deepEqual(win.noise, linux.noise, `${o}: noise keys moved with the family`);
  }
});

test('detectHostFamily reads the real platform, in the documented order', () => {
  const nav = (o) => o;

  // Chrome: userAgentData.platform is the authoritative low-entropy hint.
  assert.equal(detectHostFamily(nav({ userAgentData: { platform: 'Windows' } })), 'win');
  assert.equal(detectHostFamily(nav({ userAgentData: { platform: 'macOS' } })), 'mac');
  assert.equal(detectHostFamily(nav({ userAgentData: { platform: 'Linux' } })), 'linux');

  // Firefox and old Chrome: navigator.platform.
  assert.equal(detectHostFamily(nav({ platform: 'Win32' })), 'win');
  assert.equal(detectHostFamily(nav({ platform: 'MacIntel' })), 'mac');
  assert.equal(detectHostFamily(nav({ platform: 'Linux x86_64' })), 'linux');
  assert.equal(detectHostFamily(nav({ platform: 'Linux aarch64' })), 'linux');

  // Last resort: the UA string. Chrome freezes the OS token, which still names
  // the family even though it names nothing finer.
  assert.equal(detectHostFamily(nav({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  })), 'mac');
  assert.equal(detectHostFamily(nav({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  })), 'linux');

  // Ordering: userAgentData wins over a stale/lying navigator.platform.
  assert.equal(
    detectHostFamily(nav({ userAgentData: { platform: 'macOS' }, platform: 'Win32' })),
    'mac',
    'navigator.platform was preferred over userAgentData.platform',
  );

  // ChromeOS is deliberately mapped to linux (fontconfig + Mesa underneath).
  assert.equal(detectHostFamily(nav({ userAgentData: { platform: 'Chrome OS' } })), 'linux');
  assert.equal(familyFromPlatformString('CrOS x86_64 14541.0.0'), 'linux');

  // Hosts we do not model report null; callers substitute DEFAULT_FAMILY.
  assert.equal(detectHostFamily(nav({ platform: 'iPhone' })), null);
  assert.equal(detectHostFamily(nav({})), null);
  assert.equal(detectHostFamily(null), null);
  assert.equal(detectHostFamily('nope'), null);
});

test('a getter that throws does not take the whole detection down', () => {
  const hostile = {
    get userAgentData() { throw new Error('nope'); },
    get platform() { throw new Error('nope'); },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  assert.equal(detectHostFamily(hostile), 'win');
});

test('an undetectable host falls back to the LARGEST family, not to nothing', () => {
  // Failing closed would mean no persona, i.e. the real machine on display.
  // Failing to a random family would break determinism. So: the biggest crowd.
  assert.ok(FAMILIES.includes(DEFAULT_FAMILY));
  // `undefined` means "not specified" — that path detects the host and is
  // covered by the hostFamily() test below. Everything else means "unknown".
  for (const bogus of [null, 'bsd', 'plan9', 42]) {
    const p = personaFor(SALT_A, 'https://unknown.example', bogus);
    assert.equal(familyOf(p), DEFAULT_FAMILY,
      `family ${JSON.stringify(bogus)} should fall back to ${DEFAULT_FAMILY}, got ${p.id}`);
  }
  // …and it is still deterministic.
  assert.equal(
    personaFor(SALT_A, 'https://unknown.example', null).id,
    personaFor(SALT_A, 'https://unknown.example', 'nonsense').id,
  );
});

test('hostFamily() resolves to a real family on whatever machine runs the tests', () => {
  assert.ok(FAMILIES.includes(hostFamily()), `hostFamily() returned ${hostFamily()}`);
  // The default argument of personaFor must be that same family — otherwise the
  // service worker and the shim could disagree about which pool they are using.
  assert.equal(familyOf(personaFor(SALT_A, 'https://default.example')), hostFamily());
});

test('every family is stocked well enough to be somebody\'s entire pool', () => {
  for (const family of FAMILIES) {
    const pool = personasForFamily(family);
    assert.ok(pool.length >= MIN_PERSONAS_PER_FAMILY,
      `family ${family} has ${pool.length} personas, minimum is ${MIN_PERSONAS_PER_FAMILY}`);
    assert.equal(pool.reduce((a, p) => a + p.weight, 0), FAMILY_WEIGHT_TOTAL,
      `family ${family} weights must be renormalised to ${FAMILY_WEIGHT_TOTAL}`);

    // The number the whole change turns on: how often two unrelated origins are
    // shown the SAME machine and can therefore still be joined.
    const W = familyWeight(family);
    const collision = pool.reduce((a, p) => a + (p.weight / W) ** 2, 0);
    assert.ok(collision <= MAX_FAMILY_COLLISION,
      `family ${family}: collision probability ${collision.toFixed(3)} > ${MAX_FAMILY_COLLISION}`);
  }
  assert.deepEqual(validateFamilies(PERSONAS), []);
});

test('every persona in the expanded families passes the same consistency rules', () => {
  // The macOS and Linux entries added in D12 get no easier a ride than the
  // Windows ones that were already there.
  const added = [
    'macos-chrome-m2-air', 'macos-chrome-mini-m2', 'macos-chrome-m3-4k', 'macos-chrome-m1-pro',
    'linux-chrome-mesa-xe', 'linux-chrome-amd-renoir', 'linux-chrome-nvidia-rtx3060',
    'linux-chrome-mesa-uhd630',
  ];
  for (const id of added) {
    const p = PERSONAS.find((x) => x.id === id);
    assert.ok(p, `${id} is missing from the pool`);
    const { valid, errors } = validatePersona(p);
    assert.equal(valid, true, `${id}: ${errors.join('; ')}`);
  }
});

// ── the family rules must REJECT the shapes they exist to prevent ──────────

test('rejects: a family too thin to protect anyone (the pre-D12 Linux family)', () => {
  const thin = PERSONAS.filter((p) => familyOf(p) !== 'linux')
    .concat(PERSONAS.find((p) => p.id === 'linux-chrome-mesa'));
  const errors = validateFamilies(thin);
  assert.ok(errors.some((e) => /family "linux" has only 1 persona/.test(e)), errors.join('\n'));
});

test('rejects: weights not renormalised inside a family', () => {
  const skewed = PERSONAS.map((p) =>
    p.id === 'macos-chrome-m1' ? { ...p, weight: p.weight + 5 } : p);
  const errors = validateFamilies(skewed);
  assert.ok(errors.some((e) => /family "mac" weights sum to 105/.test(e)), errors.join('\n'));
});

test('rejects: one persona swallowing its family', () => {
  const dominant = PERSONAS.map((p) => {
    if (familyOf(p) !== 'mac') return p;
    return { ...p, weight: p.id === 'macos-chrome-m1' ? 60 : 8 };
  });
  const errors = validateFamilies(dominant);
  assert.ok(errors.some((e) => /takes 60% of the "mac" family/.test(e)), errors.join('\n'));
  assert.ok(errors.some((e) => /collision probability/.test(e)), errors.join('\n'));
});

test('rejects: a family where every reachable persona reports the same RAM', () => {
  const flat = PERSONAS.map((p) => (familyOf(p) === 'mac' ? { ...p, memory: 16 } : p));
  const errors = validateFamilies(flat);
  assert.ok(errors.some((e) => /family "mac" spans only 1 deviceMemory value/.test(e)),
    errors.join('\n'));
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. The shim's inlined mirror (shim.js gap G7)
//
//    MV3 forbids ES modules in content scripts, so src/shim.js carries a copy
//    of this pool between GENERATED MIRROR markers. The comment saying "keep it
//    in sync" was the only thing holding them together, and the pool drifted
//    twice on exactly that. This is the check.
//
//    A drifted mirror is not cosmetic: shim.js derives the stage-1 FALLBACK
//    persona from its own copy, so a stale mirror means every page that
//    fingerprints before the handshake lands sees a machine from the old pool —
//    including, after D12, one on the wrong OS.
// ═══════════════════════════════════════════════════════════════════════════

const SHIM_SRC = () => fs.readFileSync(fileURLToPath(new URL('./shim.js', import.meta.url)), 'utf8');

test('src/shim.js inlined pool is an exact mirror of this one', () => {
  const src = SHIM_SRC();

  const block = /BEGIN GENERATED MIRROR[^\n]*\n([\s\S]*?)\n\s*\/\/ ─── END GENERATED MIRROR/
    .exec(src);
  assert.ok(block, 'the GENERATED MIRROR markers are missing from src/shim.js');

  // The block is plain declarations; evaluating it is how we compare the values
  // the shim will actually use rather than the text they are written in.
  const mirrored = new Function(`${block[1]}\nreturn { FONT_SETS, PERSONAS };`)();

  assert.deepEqual(mirrored.FONT_SETS, FONT_SETS,
    'shim.js FONT_SETS has drifted from personas.js — regenerate the mirror');

  assert.deepEqual(
    mirrored.PERSONAS.map((p) => p.id),
    PERSONAS.map((p) => p.id),
    'shim.js persona ids/order have drifted from personas.js — regenerate the mirror',
  );

  for (const p of PERSONAS) {
    const m = mirrored.PERSONAS.find((x) => x.id === p.id);
    // Compare the fields the shim reads. `personaFor` adds fontList/seed/noise
    // at call time, so the stored entry is the whole contract.
    assert.deepEqual(m, {
      id: p.id, weight: p.weight, platform: p.platform, os: p.os, ua: p.ua,
      uaData: p.uaData, gpu: p.gpu, cores: p.cores, memory: p.memory,
      screen: p.screen, fonts: p.fonts,
    }, `${p.id} differs between personas.js and the shim mirror`);
  }

  // And the mirror has to be a valid pool in its own right — same rules, same
  // family invariants. A mirror that is internally fine but breaks D12 would
  // hand the fallback persona a foreign OS.
  const { valid, errors } = validatePool(mirrored.PERSONAS);
  assert.equal(valid, true, `the mirrored pool does not validate:\n${errors.join('\n')}`);
});

test('src/shim.js constrains its FALLBACK persona to the host family too', () => {
  // The shim derives stage 1 itself, before the service worker answers. If it
  // drew from the whole pool, a page that fingerprints in an inline <script>
  // would still get a foreign-OS machine — D12 would only apply to pages that
  // are slow enough to lose the race.
  const src = SHIM_SRC();

  assert.match(src, /const HOST_FAMILY = /,
    'shim.js does not detect the host OS family');
  assert.match(src, /const HOST_POOL = /,
    'shim.js does not constrain its pool to the host family');
  assert.match(src, /for \(const p of HOST_POOL\)/,
    'shim.js personaFor() still walks the unconstrained pool');
  // Detection has to happen before the patches, or it reads the persona back.
  assert.ok(
    src.indexOf('const HOST_FAMILY = ') < src.indexOf('function installInto'),
    'shim.js detects the host family after installInto() is defined — check the ordering',
  );
});
