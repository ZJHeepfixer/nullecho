/**
 * D53 (2026-10-14) — on Firefox the GPU identity is Firefox's own, and under
 * `privacy.resistFingerprinting` the WebGL patch stands down entirely.
 *
 * Measured in real Firefox 156.0 (macOS, Apple M2 Max, headful, fresh profile, the 0.9.1 store
 * package installed over WebDriver BiDi; docs/DECISIONS.md D53):
 *
 *   WebGL 1, extension OFF   VENDOR "Mozilla"  RENDERER "Apple M1, or similar"  UNMASKED_VENDOR "Apple"
 *                            UNMASKED_RENDERER "Apple M1, or similar"  VERSION "WebGL 1.0"
 *                            SHADING_LANGUAGE_VERSION "WebGL GLSL ES 1.0"  MAX_TEXTURE_SIZE 8192
 *   WebGL 1, 0.9.1 ON        RENDERER/UNMASKED_RENDERER "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, …)"
 *                            UNMASKED_VENDOR "Google Inc. (Apple)"  VERSION "WebGL 1.0 (OpenGL ES 2.0 Chromium)"
 *                            MAX_TEXTURE_SIZE 16384
 *   RFP, extension OFF       every string "Mozilla", MAX_TEXTURE_SIZE 2048, MAX_VIEWPORT_DIMS 4096,
 *                            read-back randomised by Firefox; time zone "Atlantic/Reykjavik", offset 0;
 *                            screen 800×600 with avail == full at (0,0), colorDepth 24
 *   RFP, 0.9.1 ON            UNMASKED_* back to the persona's ANGLE strings, limits 16384
 *   WebGPU adapter, OFF      vendor "" architecture "" subgroup 4/128;  0.9.1 ON: "apple" "metal-3" 32/32
 *
 * The engines below are modelled on those numbers. Each Gecko realm is a Firefox because its
 * `Navigator.prototype` carries `oscpu`/`buildID`, exactly the structural test the shim uses.
 * Run against the 0.9.1 shim with `NULLECHO_SHIM_SRC=<old shim.js>`: every test not marked GUARD
 * fails there. GUARD tests pin Chromium behaviour that D53 must NOT change.
 *
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootRealm } from './test-realm-rig.js';
import { PERSONAS, FONT_SETS } from './personas.js';

// ── the machines ───────────────────────────────────────────────────────────

const FIREFOX = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:156.0) Gecko/20100101 Firefox/156.0',
  appVersion: '5.0 (Macintosh)', platform: 'MacIntel', vendor: '',
};
/** Firefox on Linux on ARM: a real, non-RFP UA that is NOT one of RFP's three templates. */
const FIREFOX_LINUX_ARM = {
  userAgent: 'Mozilla/5.0 (X11; Linux aarch64; rv:156.0) Gecko/20100101 Firefox/156.0',
  appVersion: '5.0 (X11)', platform: 'Linux aarch64', vendor: '',
};
const CHROME = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  appVersion: '5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  platform: 'MacIntel', vendor: 'Google Inc.',
};

const P = { VENDOR: 0x1f00, RENDERER: 0x1f01, VERSION: 0x1f02, SLV: 0x8b8c, UV: 0x9245, UR: 0x9246,
  MAX_TEX: 0x0d33, MAX_CUBE: 0x851c, MAX_RB: 0x84e8, VIEWPORT: 0x0d3a, LINE: 0x846e };

/** Firefox 156, M2 Max, measured. `astc` is NOT in the measured Mac list; it is added so that a filter would be visible. */
const FF_GL = {
  strings: { [P.VENDOR]: 'Mozilla', [P.RENDERER]: 'Apple M1, or similar', [P.UV]: 'Apple', [P.UR]: 'Apple M1, or similar' },
  version: ['WebGL 1.0', 'WebGL 2.0'], slv: ['WebGL GLSL ES 1.0', 'WebGL GLSL ES 3.00'],
  maxTex: 8192, viewport: 16384,
  extensions: ['ANGLE_instanced_arrays', 'EXT_texture_filter_anisotropic', 'OES_texture_float', 'WEBGL_compressed_texture_astc',
    'WEBGL_compressed_texture_s3tc', 'WEBGL_debug_renderer_info', 'WEBGL_debug_shaders', 'WEBGL_lose_context'],
};
/** Firefox 156 with privacy.resistFingerprinting, measured. */
const FF_RFP_GL = {
  strings: { [P.VENDOR]: 'Mozilla', [P.RENDERER]: 'Mozilla', [P.UV]: 'Mozilla', [P.UR]: 'Mozilla' },
  version: ['WebGL 1.0', 'WebGL 2.0'], slv: ['WebGL GLSL ES 1.0', 'WebGL GLSL ES 3.00'],
  maxTex: 2048, viewport: 4096,
  extensions: ['ANGLE_instanced_arrays', 'EXT_texture_filter_anisotropic', 'OES_texture_float', 'WEBGL_compressed_texture_astc',
    'WEBGL_compressed_texture_s3tc', 'WEBGL_debug_renderer_info', 'WEBGL_lose_context'],
};
/** Chrome on the same Mac, for the Chromium GUARD tests. */
const CHROME_GL = {
  strings: { [P.VENDOR]: 'WebKit', [P.RENDERER]: 'WebKit WebGL', [P.UV]: 'Google Inc. (Apple)', [P.UR]: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)' },
  version: ['WebGL 1.0 (OpenGL ES 2.0 Chromium)', 'WebGL 2.0 (OpenGL ES 3.0 Chromium)'],
  slv: ['WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)', 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)'],
  maxTex: 16384, viewport: 16384,
  extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_compressed_texture_astc', 'WEBGL_compressed_texture_etc',
    'WEBGL_compressed_texture_s3tc', 'WEBGL_debug_renderer_info'],
};
const FF_GPU = { vendor: '', architecture: '', device: '', description: '', subgroupMinSize: 4, subgroupMaxSize: 128 };

const LA = { zone: 'America/Los_Angeles', jan: 480, jul: 420 };
const RFP_CLOCK = { zone: 'Atlantic/Reykjavik', jan: 0, jul: 0 };
const UTC_CLOCK = { zone: 'UTC', jan: 0, jul: 0 };
const LONDON = { zone: 'Europe/London', jan: 0, jul: -60 };
const MAC_SCREEN = { width: 1512, height: 982, availWidth: 1512, availHeight: 906, availLeft: 0, availTop: 25, colorDepth: 30 };
const RFP_SCREEN = { width: 800, height: 600, availWidth: 800, availHeight: 600, availLeft: 0, availTop: 0, colorDepth: 24 };

/**
 * The engine's source, run in the realm BEFORE the shim (bootRealm's `engine`), so every native
 * the shim captures at boot is this engine's. `__natives` holds the methods as the engine shipped
 * them, so "still native" is an identity comparison.
 */
function engineSrc({ gecko = true, gl = FF_GL, clock = LA, screen = MAC_SCREEN, gpu = FF_GPU } = {}) {
  return `(() => {
    const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };
    const ro = (C, name, read) => Object.defineProperty(C.prototype, name, {
      get() { brand(this, C); return read(this); }, configurable: true, enumerable: true });
    if (${gecko}) {
      ro(Navigator, 'oscpu', () => 'Intel Mac OS X 10.15');
      ro(Navigator, 'buildID', () => '20181001000000');
    }
    const GL = ${JSON.stringify(gl)};
    const make = (name, idx) => {
      const C = { [name]: class {} }[name];
      const table = Object.assign({}, GL.strings, { ${P.VERSION}: GL.version[idx], ${P.SLV}: GL.slv[idx],
        ${P.MAX_TEX}: GL.maxTex, ${P.MAX_CUBE}: GL.maxTex, ${P.MAX_RB}: GL.maxTex });
      Object.defineProperty(C.prototype, 'getParameter', { configurable: true, writable: true, value: function getParameter(p) {
        brand(this, C);
        if (p === ${P.VIEWPORT}) { const a = new Int32Array(2); a[0] = GL.viewport; a[1] = GL.viewport; return a; }
        if (p === ${P.LINE}) { const a = new Float32Array(2); a[0] = 1; a[1] = 1; return a; }
        return p in table ? table[p] : null;
      } });
      Object.defineProperty(C.prototype, 'getSupportedExtensions', { configurable: true, writable: true,
        value: function getSupportedExtensions() { brand(this, C); return GL.extensions.slice(); } });
      Object.defineProperty(C.prototype, 'getExtension', { configurable: true, writable: true,
        value: function getExtension(n) { brand(this, C); return GL.extensions.includes(n) ? { name: n } : null; } });
      // A uniform clear colour, as gl.clear() leaves it: any byte that differs afterwards was written by the shim.
      Object.defineProperty(C.prototype, 'readPixels', { configurable: true, writable: true,
        value: function readPixels(x, y, w, h, f, t, px) {
          brand(this, C);
          for (let i = 0; i + 3 < px.length && i < w * h * 4; i += 4) { px[i] = 51; px[i + 1] = 102; px[i + 2] = 153; px[i + 3] = 255; }
        } });
      return C;
    };
    globalThis.WebGLRenderingContext = make('WebGLRenderingContext', 0);
    globalThis.WebGL2RenderingContext = make('WebGL2RenderingContext', 1);
    class GPUAdapterInfo {}
    const GPU = ${JSON.stringify(gpu)};
    for (const k of Object.keys(GPU)) ro(GPUAdapterInfo, k, () => GPU[k]);
    globalThis.GPUAdapterInfo = GPUAdapterInfo;
    class Screen {}
    const SCR = ${JSON.stringify(screen)};
    for (const k of Object.keys(SCR)) ro(Screen, k, () => SCR[k]);
    globalThis.Screen = Screen;
    globalThis.screen = Object.create(Screen.prototype);
    const CLOCK = ${JSON.stringify(clock)};
    class DateTimeFormat { resolvedOptions() { return { locale: 'en-US', calendar: 'gregory', numberingSystem: 'latn', timeZone: CLOCK.zone }; } }
    Intl.DateTimeFormat = DateTimeFormat;
    const getMonth = Date.prototype.getMonth;
    Date.prototype.getTimezoneOffset = function getTimezoneOffset() { return getMonth.call(this) < 6 ? CLOCK.jan : CLOCK.jul; };
    const nat = (C) => ({ getParameter: C.prototype.getParameter, getSupportedExtensions: C.prototype.getSupportedExtensions,
      getExtension: C.prototype.getExtension, readPixels: C.prototype.readPixels });
    globalThis.__glNatives = { webgl: nat(WebGLRenderingContext), webgl2: nat(WebGL2RenderingContext),
      gpuVendor: Object.getOwnPropertyDescriptor(GPUAdapterInfo.prototype, 'vendor').get };
  })();`;
}

/** A persona as the worker delivers it: a real pool entry plus its font list, noise keys and seed. */
function delivered(id) {
  const p = PERSONAS.find((x) => x.id === id);
  assert.ok(p, `persona ${id} is in the pool`);
  return { ...p, fontList: FONT_SETS[p.fonts], noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 0x1234abcd };
}
// A mac persona with 8 cores against the rig machine's 12, so "the persona still applies" is visible,
// and a D3D11 one whose extension deny-list (astc/etc/etc1/pvrtc) would be visible if it ran.
const MAC_PERSONA = 'macos-chrome-m2-air';
const WIN_PERSONA = 'win11-chrome-rtx3060';

function boot({ real = FIREFOX, persona = MAC_PERSONA, ...engine } = {}) {
  const r = bootRealm({ real, engine: engineSrc(engine) });
  r.upgrade({ persona: delivered(persona) });
  // Accepted — or, under resistFingerprinting (D54), declined out loud.
  assert.ok(r.statuses.some((s) => s.upgraded === true || s.reason === 'resist-fingerprinting'), 'the authenticated handshake was answered');
  return r;
}

/** Everything a fingerprinter reads from one context, as plain values (JSON, so no realm's Array leaks out). */
function readGL(r, kind) {
  return JSON.parse(r.page(`JSON.stringify((() => {
    const gl = new ${kind === 'webgl2' ? 'WebGL2RenderingContext' : 'WebGLRenderingContext'}();
    const px = new Uint8Array(16 * 16 * 4);
    gl.readPixels(0, 0, 16, 16, 0x1908, 0x1401, px);
    let changed = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] !== 51 || px[i + 1] !== 102 || px[i + 2] !== 153 || px[i + 3] !== 255) changed++;
    const proto = Object.getPrototypeOf(gl);
    const nat = __glNatives.${kind};
    return {
      VENDOR: gl.getParameter(${P.VENDOR}), RENDERER: gl.getParameter(${P.RENDERER}),
      UNMASKED_VENDOR: gl.getParameter(${P.UV}), UNMASKED_RENDERER: gl.getParameter(${P.UR}),
      VERSION: gl.getParameter(${P.VERSION}), SLV: gl.getParameter(${P.SLV}),
      MAX_TEXTURE_SIZE: gl.getParameter(${P.MAX_TEX}), MAX_CUBE: gl.getParameter(${P.MAX_CUBE}), MAX_RB: gl.getParameter(${P.MAX_RB}),
      VIEWPORT: Array.from(gl.getParameter(${P.VIEWPORT})),
      extensions: gl.getSupportedExtensions(), astc: gl.getExtension('WEBGL_compressed_texture_astc') !== null,
      pixelsChanged: changed,
      native: { getParameter: proto.getParameter === nat.getParameter, getSupportedExtensions: proto.getSupportedExtensions === nat.getSupportedExtensions,
        getExtension: proto.getExtension === nat.getExtension, readPixels: proto.readPixels === nat.readPixels },
    };
  })())`));
}

const CHROME_FORMAT = /ANGLE|Google Inc\.|Chromium|Direct3D|D3D11|Metal Renderer|OpenGL ES/;

// ── 1. Firefox, no RFP: the engine's GPU identity, the persona everywhere else ──

test('D53: on Firefox every WebGL string, limit and extension is the engine\'s own — none in Chrome\'s format', () => {
  for (const persona of [MAC_PERSONA, WIN_PERSONA]) {
    const r = boot({ persona });
    for (const [kind, i] of [['webgl', 0], ['webgl2', 1]]) {
      const g = readGL(r, kind);
      const where = `${persona} ${kind}`;
      assert.equal(g.VENDOR, 'Mozilla', where);
      assert.equal(g.RENDERER, 'Apple M1, or similar', where);
      assert.equal(g.UNMASKED_VENDOR, 'Apple', where);
      assert.equal(g.UNMASKED_RENDERER, 'Apple M1, or similar', where);
      assert.equal(g.VERSION, FF_GL.version[i], where);
      assert.equal(g.SLV, FF_GL.slv[i], where);
      for (const k of ['VENDOR', 'RENDERER', 'UNMASKED_VENDOR', 'UNMASKED_RENDERER', 'VERSION', 'SLV']) {
        assert.doesNotMatch(g[k], CHROME_FORMAT, `${where} ${k} is in Chrome's format: ${g[k]}`);
      }
      // The persona's 16384 is larger than this engine allows; a page that sized a texture to it would fail.
      assert.equal(g.MAX_TEXTURE_SIZE, 8192, where);
      assert.equal(g.MAX_CUBE, 8192, where);
      assert.equal(g.MAX_RB, 8192, where);
      assert.deepEqual(g.VIEWPORT, [16384, 16384], where);
      // Nothing removed: the D3D11 persona's deny-list would have taken astc out.
      assert.deepEqual(g.extensions, FF_GL.extensions, where);
      assert.equal(g.astc, true, where);
      // And not merely equal — untouched: the engine's own methods, so no wrapper to detect.
      assert.deepEqual(g.native, { getParameter: true, getSupportedExtensions: true, getExtension: true, readPixels: false }, where);
    }
  }
});

test('D53 GUARD: on Firefox the rest of the persona still applies — CPU cores and WebGL read-back noise', () => {
  const r = boot();
  assert.equal(r.page('navigator.hardwareConcurrency'), 8, 'persona cores (the rig machine has 12)');
  for (const kind of ['webgl', 'webgl2']) {
    assert.ok(readGL(r, kind).pixelsChanged > 0, `${kind} read-back is noised, as canvas is`);
  }
});

test('D53: on Firefox the WebGPU adapter identity is the engine\'s ("" vendor), never the persona\'s', () => {
  const r = boot();
  assert.equal(r.page('Object.create(GPUAdapterInfo.prototype).vendor'), '');
  assert.equal(r.page('Object.create(GPUAdapterInfo.prototype).architecture'), '');
  assert.equal(r.page('Object.create(GPUAdapterInfo.prototype).subgroupMinSize'), 4);
  assert.equal(r.page('Object.getOwnPropertyDescriptor(GPUAdapterInfo.prototype, "vendor").get === __glNatives.gpuVendor'), true);
});

// ── 2. Firefox with resistFingerprinting: stand down ───────────────────────

test('D53: under resistFingerprinting nothing WebGL is touched — RFP\'s "Mozilla", 2048 and read-back stand', () => {
  for (const clock of [RFP_CLOCK, UTC_CLOCK]) {
    const r = boot({ gl: FF_RFP_GL, clock, screen: RFP_SCREEN });
    assert.ok(r.statuses.some((s) => s.reason === 'resist-fingerprinting'), 'the shim says why it stood down (D54)');
    for (const [kind, i] of [['webgl', 0], ['webgl2', 1]]) {
      const g = readGL(r, kind);
      const where = `${clock.zone} ${kind}`;
      for (const k of ['VENDOR', 'RENDERER', 'UNMASKED_VENDOR', 'UNMASKED_RENDERER']) assert.equal(g[k], 'Mozilla', `${where} ${k}`);
      assert.equal(g.VERSION, FF_RFP_GL.version[i], where);
      assert.equal(g.MAX_TEXTURE_SIZE, 2048, where);
      assert.deepEqual(g.VIEWPORT, [4096, 4096], where);
      assert.equal(g.pixelsChanged, 0, `${where}: the shim added nothing to Firefox's own read-back`);
      assert.deepEqual(g.native, { getParameter: true, getSupportedExtensions: true, getExtension: true, readPixels: true }, where);
    }
  }
});

// ── 3. The RFP inference needs every signal ────────────────────────────────

test('D53: no single RFP-looking signal stands WebGL down — clock, screen and UA template are all required', () => {
  const cases = [
    ['real clock, RFP screen', { clock: LA, screen: RFP_SCREEN }],
    ['RFP clock, real (menu-bar) screen', { clock: RFP_CLOCK, screen: MAC_SCREEN }],
    ['London: offset 0 in January only', { clock: LONDON, screen: RFP_SCREEN }],
    ['RFP clock + screen, but a UA RFP never sends', { clock: RFP_CLOCK, screen: RFP_SCREEN, real: FIREFOX_LINUX_ARM }],
    ['RFP clock + screen, but a 30-bit display', { clock: RFP_CLOCK, screen: { ...RFP_SCREEN, colorDepth: 30 } }],
  ];
  for (const [label, over] of cases) {
    const r = boot(over);
    const g = readGL(r, 'webgl');
    assert.equal(g.native.readPixels, false, `${label}: read-back is still wrapped (not RFP)`);
    assert.ok(g.pixelsChanged > 0, `${label}: read-back is still noised`);
    assert.equal(g.UNMASKED_RENDERER, 'Apple M1, or similar', `${label}: Gecko identity regardless`);
  }
});

// ── 4. Chromium is unchanged ───────────────────────────────────────────────

test('D53 GUARD: on Chromium the persona\'s GPU strings, limits and extension filter apply exactly as before', () => {
  const r = boot({ real: CHROME, gecko: false, gl: CHROME_GL, persona: WIN_PERSONA });
  const p = delivered(WIN_PERSONA);
  const g = readGL(r, 'webgl');
  assert.equal(g.VENDOR, 'WebKit');
  assert.equal(g.RENDERER, 'WebKit WebGL');
  assert.equal(g.UNMASKED_VENDOR, p.gpu.unmaskedVendor);
  assert.equal(g.UNMASKED_RENDERER, p.gpu.renderer);
  assert.equal(g.VERSION, 'WebGL 1.0 (OpenGL ES 2.0 Chromium)');
  assert.equal(g.MAX_TEXTURE_SIZE, 16384);
  assert.equal(g.astc, false, 'the D3D11 persona still removes ASTC');
  assert.ok(!g.extensions.includes('WEBGL_compressed_texture_etc'));
  assert.ok(g.pixelsChanged > 0);
  assert.equal(g.native.getParameter, false);
  assert.equal(r.page('Object.create(GPUAdapterInfo.prototype).vendor'), 'nvidia', 'WebGPU adapter identity is the persona\'s');
});

test('D53 GUARD: an RFP-shaped Chromium (UTC, full-screen avail, 24-bit) is still Chromium — no stand-down', () => {
  const r = boot({ real: CHROME, gecko: false, gl: CHROME_GL, clock: UTC_CLOCK, screen: RFP_SCREEN, persona: MAC_PERSONA });
  const g = readGL(r, 'webgl');
  assert.equal(g.UNMASKED_RENDERER, delivered(MAC_PERSONA).gpu.renderer);
  assert.ok(g.pixelsChanged > 0);
});
