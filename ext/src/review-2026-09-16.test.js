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
  let boot = null, gpcBoot = null;
  ctx.document.addEventListener('nullecho:status', (ev) => {
    const d = JSON.parse(ev.detail);
    if (d.phase === 'boot') {
      if (d.channel === 'shim' && !boot) boot = d;
      else if (d.channel === 'gpc' && !gpcBoot) gpcBoot = d;
    }
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
    ctx, win, h, logs, boot, gpcBoot, statuses, send, page,
    /** The loader's delivery: shim nonce always; the gpc nonce whenever gpc.js booted, as shim-loader.js does. */
    upgrade: (persona = DELIVERED, over = {}) => send({
      ok: true, enabled: true, gpc: true, site: hostname, persona, nonce: boot.nonce,
      gpcNonce: gpcBoot ? gpcBoot.nonce : null, ...over,
    }),
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
// A1 — content-independent noise was INVERTIBLE (canvas + audio)
//
// ✅ FIXED 2026-09-16 (DECISIONS.md D22). The noise key now folds in a digest
// of the real content — `key = mix(personaKey, w, h, digest(pixels))` — so a
// pattern learned from a known input says nothing about any other image. The
// digest and the ink gate are taken over the WHOLE canvas once per read and
// the returned rectangle is sliced from that (B5), and silence is never noised
// (B4). Each test below asserts the attack now fails AND that determinism —
// the averaging defence — survived: same content, same bytes, every read.
// ═══════════════════════════════════════════════════════════════════════════

/** The bytes of rect (x,y,w,h) inside a full W-wide RGBA read. */
const sliceOfFull = (full, W, x, y, w, h) => {
  const out = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) for (let k = 0; k < 4; k++) out.push(full[(((y + r) * W) + (x + c)) * 4 + k]);
  return out;
};

test('A1a GUARD: the pattern learned from a uniform fill no longer subtracts back to the real pixels; reads stay deterministic', () => {
  const s = bootRealm();
  s.upgrade();

  const probe = s.canvas(64, 32);
  const pc = probe.getContext('2d'); pc.fillStyle = 'rgb(128,128,128)'; pc.fillRect(0, 0, 64, 32);
  const pattern = deltaFrom(pc.getImageData(0, 0, 64, 32).data, 128);
  assert.ok(pattern.some((d) => d !== 0), 'a uniform fill is still noised — it has ink');

  // Content-keyed: a fill one LSB away must produce an unrelated pattern.
  const probe2 = s.canvas(64, 32);
  const pc2 = probe2.getContext('2d'); pc2.fillStyle = 'rgb(129,129,129)'; pc2.fillRect(0, 0, 64, 32);
  const pattern2 = deltaFrom(pc2.getImageData(0, 0, 64, 32).data, 129);
  assert.ok(!bytesEqual(pattern, pattern2), 'two fills one LSB apart yield different patterns');

  const target = s.canvas(64, 32);
  const truth = paintReal(target);
  const ctx = target.getContext('2d');
  const noised = ctx.getImageData(0, 0, 64, 32).data;
  assert.ok(!bytesEqual(noised, truth), 'the fingerprint read is noised');

  const recovered = Array.from(noised, (v, i) => v - pattern[i]);
  assert.ok(!bytesEqual(recovered, truth),
    'GUARD: subtracting the learned pattern does NOT recover the real bytes');

  // The averaging defence: identical content → identical bytes on every read path.
  assert.ok(bytesEqual(ctx.getImageData(0, 0, 64, 32).data, noised), 'a second read is byte-identical');
  assert.equal(target.toDataURL(), 'data:fake,' + Array.from(noised).join(','),
    'toDataURL encodes exactly the bytes getImageData returns');
});

test('A1b GUARD: after subtraction the two sites still disagree and neither yields the real bytes — the join stays broken', () => {
  let truth = null;
  const recoverOn = (hostname, persona) => {
    const s = bootRealm({ hostname, origin: `https://${hostname}` });
    s.upgrade(persona);
    const probe = s.canvas(64, 32);
    const pc = probe.getContext('2d'); pc.fillStyle = 'rgb(128,128,128)'; pc.fillRect(0, 0, 64, 32);
    const pattern = deltaFrom(pc.getImageData(0, 0, 64, 32).data, 128);
    const target = s.canvas(64, 32);
    truth = paintReal(target, 7); // same "machine" draws the same real content on both sites
    const noised = target.getContext('2d').getImageData(0, 0, 64, 32).data;
    return { noised, recovered: Array.from(noised, (v, i) => v - pattern[i]) };
  };
  const a = recoverOn('news.example', DELIVERED);
  const b = recoverOn('shop.example', DELIVERED_B);
  assert.ok(!bytesEqual(a.noised, b.noised), 'the two sites are noised differently');
  assert.ok(!bytesEqual(a.recovered, b.recovered), 'GUARD: no cross-site join by subtraction');
  assert.ok(!bytesEqual(a.recovered, truth) && !bytesEqual(b.recovered, truth), 'GUARD: neither site recovers the truth');
});

test('A1c GUARD: a silent AudioBuffer reads back all zeros, and a pattern learned from a known buffer does not subtract to the real samples', () => {
  const s = bootRealm();
  s.upgrade();
  const N = 4096;

  const silent = s.page(`new AudioBuffer(${N})`);
  assert.ok(Array.from(silent.getChannelData(0)).every((v) => v === 0),
    'B4 half: a never-written AudioBuffer reads back all zeros, as in every real browser');

  // The attacker's probe: a constant fill, read back, pattern "learned".
  const known = s.page(`new AudioBuffer(${N})`);
  known._d[0].fill(0.25);
  const learned = Array.from(known.getChannelData(0), (v) => v - 0.25);
  assert.ok(learned.some((d) => d !== 0), 'a written buffer is noised');

  const real = s.page(`new AudioBuffer(${N})`);
  const truth = new Float32Array(N);
  for (let i = 0; i < N; i++) truth[i] = Math.sin(i / 7) * 0.5;
  real._d[0].set(truth);
  const noised = Float32Array.from(real.getChannelData(0));
  let maxNoise = 0, maxErr = 0;
  for (let i = 0; i < N; i++) {
    maxNoise = Math.max(maxNoise, Math.abs(noised[i] - truth[i]));
    maxErr = Math.max(maxErr, Math.abs((noised[i] - learned[i]) - truth[i]));
  }
  assert.ok(maxNoise >= 1e-7, 'the real buffer is noised');
  assert.ok(maxErr >= 1e-7, `GUARD: subtracting the learned pattern leaves error ${maxErr} — the noise is keyed on the content`);

  // Determinism: the same content in a fresh buffer gets the same samples.
  const again = s.page(`new AudioBuffer(${N})`);
  again._d[0].set(truth);
  assert.ok(bytesEqual(Float32Array.from(again.getChannelData(0)), noised), 'identical content → identical noised samples');
});

// ═══════════════════════════════════════════════════════════════════════════
// A2 — page hooks on uncaptured builtins reach the shim's native originals
//
// ✅ FIXED 2026-09-16 (DECISIONS.md D21). Every test below was a reproduction;
// each is now the inverse — a regression guard asserting the hook changes
// NOTHING. The hooks are installed AFTER the shim boots and after the genuine
// handshake (the review's timing); `A2-timing` below installs them before the
// handshake lands and keeps them live through it. Both timings must hold.
// ═══════════════════════════════════════════════════════════════════════════

test('A2a GUARD: hooking Function.prototype.call sees NO call from the shim and gets no native getter', () => {
  const s = bootRealm();
  s.upgrade();
  assert.equal(s.ua(), DELIVERED.ua, 'sanity: the persona is in place');

  const out = s.page(`
    const leaked = [];
    const origCall = Function.prototype.call;
    Function.prototype.call = function (thisArg, ...args) {
      leaked.push(this);
      return Reflect.apply(this, thisArg, args);
    };
    let spoofed;
    try {
      spoofed = navigator.userAgent;
      void navigator.hardwareConcurrency; void navigator.deviceMemory; void navigator.platform;
      void navigator.userAgentData.brands;
    } finally { Function.prototype.call = origCall; }
    // The attacker's harvest: any leaked function that answers differently from the spoof.
    const replacement = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get;
    let real = null;
    for (const fn of leaked) {
      if (fn === replacement) continue;
      try { const v = Reflect.apply(fn, navigator, []); if (typeof v === 'string' && v !== spoofed) { real = v; break; } } catch {}
    }
    ({ spoofed, real, calls: leaked.length });
  `);
  assert.equal(out.spoofed, DELIVERED.ua, 'the spoof held while the hook was live');
  assert.equal(out.real, null, 'REGRESSION: a native navigator getter reached the page through a .call hook');
  assert.equal(out.calls, 0, 'REGRESSION: the shim invoked Function.prototype.call at run time (D21: every builtin is captured at boot)');
});

test('A2b GUARD: hooking Function.prototype.apply sees NO call from the shim; toDataURL stays noised, getParameter stays spoofed', () => {
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
    let spoofed, hookedDataURL;
    try {
      spoofed = gl.getParameter(0x9246);
      hookedDataURL = __c.toDataURL();
    } finally { Function.prototype.apply = origApply; }
    const nativeGetParameter = leaked.find((f) => f.name === 'getParameter' && f !== WebGLRenderingContext.prototype.getParameter);
    const nativeToDataURL = leaked.find((f) => f.name === 'toDataURL' && f !== HTMLCanvasElement.prototype.toDataURL);
    ({
      spoofed, hookedDataURL, applies: leaked.length,
      real: nativeGetParameter ? Reflect.apply(nativeGetParameter, gl, [0x9246]) : null,
      realDataURL: nativeToDataURL ? Reflect.apply(nativeToDataURL, __c, []) : null,
      shimDataURL: __c.toDataURL(),
    });
  `.replace(/__c/g, '__canvasUnderTest'), Object.assign(s.ctx, { __canvasUnderTest: c }));
  const rawDataURL = 'data:fake,' + Array.from(c.getContext('2d')._buf).join(',');
  assert.equal(out.spoofed, DELIVERED.gpu.renderer, 'the persona GPU was presented while the hook was live');
  assert.equal(out.real, null, 'REGRESSION: the native getParameter reached the page through an .apply hook');
  assert.equal(out.realDataURL, null, 'REGRESSION: the native toDataURL reached the page through an .apply hook');
  assert.equal(out.applies, 0, 'REGRESSION: the shim invoked Function.prototype.apply at run time');
  assert.notEqual(out.hookedDataURL, rawDataURL, 'REGRESSION: toDataURL under the hook returned the un-noised canvas');
  assert.equal(out.hookedDataURL, out.shimDataURL, 'determinism: the hooked read equals the unhooked read');
});

test('A2c GUARD: hooking String.prototype.charCodeAt no longer makes a forged nonce match; the genuine one still does under the hook', () => {
  const s = bootRealm();
  const fallbackUA = s.ua();
  s.page(`
    globalThis.__origCharCodeAt = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function () { return 0; };
    document.dispatchEvent(new CustomEvent('nullecho:persona', {
      detail: JSON.stringify({ ok: true, enabled: false, nonce: '0'.repeat(32) }),
    }));
  `);
  assert.notEqual(s.ua(), REAL_UA, 'REGRESSION: a page that never saw the nonce stood the shim down');
  assert.equal(s.ua(), fallbackUA, 'the forgery changed nothing: still the fallback persona');
  assert.ok(s.statuses.some((d) => d.reason === 'forged-handshake-rejected'), 'the forgery was reported as such');
  assert.ok(!s.statuses.some((d) => d.reason === 'allowlisted'), 'and not as an allowlist');
  // Timing 2: the hook is STILL installed when the loader's genuine delivery lands.
  s.upgrade();
  assert.equal(s.ua(), DELIVERED.ua, 'the genuine handshake authenticated through the captured charCodeAt while the live one was hooked');
  s.page('String.prototype.charCodeAt = globalThis.__origCharCodeAt;');
});

test('A2d GUARD: the same charCodeAt hook cannot delete navigator.globalPrivacyControl through gpc.js; the real gpcNonce still can', () => {
  const s = bootRealm({ gpc: true });
  assert.equal(s.ctx.navigator.globalPrivacyControl, true, 'sanity: gpc.js set the signal');
  assert.ok(s.gpcBoot && typeof s.gpcBoot.nonce === 'string', 'sanity: gpc.js published its own boot nonce');
  s.page(`
    globalThis.__origCharCodeAt = String.prototype.charCodeAt;
    String.prototype.charCodeAt = function () { return 0; };
    document.dispatchEvent(new CustomEvent('nullecho:persona', {
      detail: JSON.stringify({ gpc: false, gpcNonce: '0'.repeat(32), nonce: '0'.repeat(32) }),
    }));
  `);
  assert.equal(s.ctx.navigator.globalPrivacyControl, true,
    'REGRESSION: the site the do-not-sell signal is aimed at switched it off without the nonce');
  // Timing 2: the loader's genuine delivery (both nonces) with the hook still live.
  // It reaches gpc.js through the shim's relay (A3 below) and must still be honoured.
  s.upgrade(DELIVERED, { gpc: false });
  assert.equal(s.ua(), DELIVERED.ua, 'the shim half authenticated');
  assert.equal(s.ctx.navigator.globalPrivacyControl, undefined, 'the gpc half authenticated its own nonce under the hook');
  s.page('String.prototype.charCodeAt = globalThis.__origCharCodeAt;');
});

test('A2e GUARD: hooking %TypedArray%.prototype.length during a read no longer skips the canvas noise', () => {
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
  assert.ok(!bytesEqual(out, truth), 'REGRESSION: getImageData under the hook returned the real, un-noised pixels');
  const honest = c.getContext('2d').getImageData(0, 0, 32, 16).data;
  assert.ok(bytesEqual(out, honest), 'determinism: the hooked read equals the unhooked read');
});

test('A2f GUARD: hooking Math.imul no longer changes the noise — two sites still differ, and each equals its unhooked read', () => {
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
  assert.ok(bytesEqual(a.hooked, a.plain), 'REGRESSION: Math.imul hook altered site A\'s noise');
  assert.ok(bytesEqual(b.hooked, b.plain), 'REGRESSION: Math.imul hook altered site B\'s noise');
  assert.ok(!bytesEqual(a.hooked, b.hooked), 'REGRESSION: with Math.imul neutered, both sites returned the same bytes');
});

/**
 * A2, the OTHER timing. The review's tests hook after the upgrade. Here every
 * hook goes in after boot but BEFORE the loader's genuine delivery, stays live
 * through the handshake, and stays live while the page reads. Hostile where the
 * fake DOM can bear it (wrong answers), observing where the fake dispatcher
 * itself needs the primitive (`call`/`apply` forward, but record every use).
 */
test('A2-timing GUARD: with a dozen builtins hooked BEFORE the genuine handshake lands, the upgrade, the spoof and the noise are unchanged', async () => {
  const s = bootRealm();
  const c = s.canvas(24, 12);
  const truth = paintReal(c, 11);
  // `call`, `apply` and `WeakMap.get` are OBSERVING hooks (the fake dispatcher in
  // DOM_SETUP needs them working — a real browser's is native) that record every
  // receiver they see; the harvest below is what an attacker would do with them.
  // The rest are hostile: they answer wrongly or throw.
  s.page(`
    const LEAKED = globalThis.__leaked = [];      // every function routed through .call / .apply
    const MAPS = globalThis.__maps = [];          // every WeakMap routed through .get
    const H = globalThis.__hooks = [];
    const hook = (obj, name, impl) => {
      const d = Object.getOwnPropertyDescriptor(obj, name); H[H.length] = [obj, name, d];
      Object.defineProperty(obj, name, { ...d, ...(d.get ? { get: impl } : { value: impl }) });
    };
    const TAP = Object.getPrototypeOf(Uint8ClampedArray.prototype);
    const origWmGet = WeakMap.prototype.get;
    hook(Function.prototype, 'call', function (t, ...a) { LEAKED[LEAKED.length] = this; return Reflect.apply(this, t, a); });
    hook(Function.prototype, 'apply', function (t, a) { LEAKED[LEAKED.length] = this; return Reflect.apply(this, t, a || []); });
    hook(WeakMap.prototype, 'get', function (k) { MAPS[MAPS.length] = this; return Reflect.apply(origWmGet, this, [k]); });
    hook(String.prototype, 'charCodeAt', () => 0);
    hook(Math, 'imul', () => 0);
    hook(Math, 'floor', () => NaN); hook(Math, 'max', () => NaN); hook(Math, 'min', () => NaN);
    hook(TAP, 'length', function () { return 0; });
    hook(Set.prototype, 'has', () => false);
    hook(Set.prototype, 'add', function () { return this; });
    hook(Array, 'isArray', () => false);
    hook(ArrayBuffer, 'isView', () => false);
    hook(Object, 'freeze', () => { throw new Error('page-owned freeze'); });
    hook(Promise, 'resolve', () => { throw new Error('page-owned Promise.resolve'); });
    hook(Array.prototype, 'filter', () => { throw new Error('page-owned filter'); });
    hook(Array.prototype, 'map', () => { throw new Error('page-owned map'); });
    hook(Array.prototype, 'push', () => { throw new Error('page-owned push'); });
  `);

  // The loader's genuine delivery lands NOW, with every hook live.
  s.upgrade();
  assert.ok(s.statuses.some((d) => d.upgraded === true), 'the shim reported the upgrade with charCodeAt hooked');
  assert.equal(s.ctx.navigator.hardwareConcurrency, DELIVERED.cores, 'the delivered persona is in place (cores)');
  assert.equal(s.ctx.navigator.deviceMemory, DELIVERED.memory, 'the delivered persona is in place (memory)');

  const read = s.page(`(() => {
    const gl = new WebGLRenderingContext(document.createElement('canvas'));
    const img = Array.from(__c.getContext('2d').getImageData(0, 0, 24, 12).data); // plain array: own .length
    const he = navigator.userAgentData.getHighEntropyValues(['architecture', 'platformVersion']);
    const brands = navigator.userAgentData.brands; let brandStr = '';
    for (let i = 0; i < brands.length; i++) brandStr += (i ? ' ' : '') + brands[i].brand + '/' + brands[i].version;
    return {
      ua: navigator.userAgent, cores: navigator.hardwareConcurrency, memory: navigator.deviceMemory,
      languages: navigator.languages, brands: brandStr,
      renderer: gl.getParameter(0x9246), extensions: gl.getSupportedExtensions(),
      toDataURL: __c.toDataURL(), img, he,
    };
  })()`.replace(/__c/g, '__canvasUnderTest'), Object.assign(s.ctx, { __canvasUnderTest: c }));

  assert.equal(read.ua, DELIVERED.ua);
  assert.equal(read.cores, DELIVERED.cores, 'hardwareConcurrency (goes through a captured Math.max)');
  assert.equal(read.memory, DELIVERED.memory);
  assert.deepEqual(plain(read.languages), ['en-US', 'en'], 'languages (captured Object.freeze)');
  assert.equal(read.brands, 'Not;A=Brand/99 Chromium/151 Google Chrome/151', 'brands (no Array.prototype.map)');
  assert.equal(read.renderer, DELIVERED.gpu.renderer);
  assert.deepEqual(plain(read.extensions), ['WEBGL_compressed_texture_astc', 'WEBGL_debug_renderer_info', 'OES_texture_float'],
    'an Apple persona strips nothing; the list came back through an index loop, not .filter');
  assert.ok(!bytesEqual(read.img, truth), 'getImageData was noised with %TypedArray%.length and Math.imul hooked');
  const rawDataURL = 'data:fake,' + Array.from(c.getContext('2d')._buf).join(',');
  assert.notEqual(read.toDataURL, rawDataURL, 'toDataURL was noised');
  const he = await read.he;
  assert.equal(he.architecture, DELIVERED.uaData.architecture, 'getHighEntropyValues (captured Promise.resolve, Set.has, Array.isArray)');

  // THE HARVEST. Everything that went through the hooked call/apply/get: does any
  // of it answer with the real machine, the raw canvas, or the patched-function oracle?
  const harvest = s.page(`(() => {
    const gl = new WebGLRenderingContext(document.createElement('canvas'));
    const spoofedUA = navigator.userAgent;
    const patchedUA = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get;
    let realUA = null, realRenderer = null, rawDataURL = null, oracle = false;
    for (const fn of __leaked) {
      if (typeof fn !== 'function') continue;
      try { const v = Reflect.apply(fn, navigator, []); if (typeof v === 'string' && v !== spoofedUA && v.startsWith('Mozilla/')) realUA = v; } catch {}
      try { const v = Reflect.apply(fn, gl, [0x9246]); if (v === ${JSON.stringify(REAL_RENDERER)}) realRenderer = v; } catch {}
      try { const v = Reflect.apply(fn, __c, []); if (typeof v === 'string' && v === ${JSON.stringify(rawDataURL)}) rawDataURL = v; } catch {}
    }
    for (const m of __maps) { try { if (WeakMap.prototype.has.call(m, patchedUA)) oracle = true; } catch {} }
    return { realUA, realRenderer, rawDataURL, oracle, routed: __leaked.length, maps: __maps.length };
  })()`.replace(/__c/g, '__canvasUnderTest'));
  assert.equal(harvest.realUA, null, 'REGRESSION: a native navigator getter was routed through the live call/apply');
  assert.equal(harvest.realRenderer, null, 'REGRESSION: the native getParameter was routed through the live call/apply');
  assert.equal(harvest.rawDataURL, null, 'REGRESSION: the native toDataURL was routed through the live call/apply');
  assert.equal(harvest.oracle, false, 'REGRESSION: NATIVE_SRC was routed through the live WeakMap.prototype.get (C2)');

  // Unhook, read again: byte-identical. Hook state cannot be a side channel either.
  s.page('for (const [obj, name, d] of globalThis.__hooks.reverse()) Object.defineProperty(obj, name, d);');
  const again = s.page(`Array.from(__c.getContext('2d').getImageData(0, 0, 24, 12).data)`.replace(/__c/g, '__canvasUnderTest'));
  assert.ok(bytesEqual(again, read.img), 'determinism across hook state');
  assert.equal(s.page('__canvasUnderTest.toDataURL()'), read.toDataURL);
});

/**
 * D21's invariant, as a lint: after the captured-builtins block, neither
 * MAIN-world script may name a builtin global or call a builtin prototype
 * method bare. Comments and string literals are stripped first; the shim's
 * generated persona mirror and its boot-only `registrableDomain` (which A4c
 * lifts out verbatim and runs in a bare context) are exempt.
 */
test('A2-lint GUARD: shim.js and gpc.js call no builtin prototype after the capture block (D21)', () => {
  const stripped = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  const GLOBALS = /\b(Math|JSON|Reflect|Object|Array|ArrayBuffer|Symbol|Promise|String|Number|RegExp|WeakMap|WeakSet|Set|Map)\s*\./g;
  const CTORS = /\bnew\s+(Set|Map|WeakMap|WeakSet)\s*\(/g;
  const METHODS = /\.(call|apply|bind|charCodeAt|imul|isArray|freeze|toLowerCase|has|add|filter|map|forEach|indexOf|then|exec|test|replace|trim|slice|join|push|reduce|concat|split|padStart|toString|some|every|keys|values|entries|get|set|clear|delete)\s*\(/g;

  const check = (label, body) => {
    const hits = [];
    for (const re of [GLOBALS, CTORS, METHODS]) {
      for (const m of body.matchAll(re)) {
        const line = body.slice(0, m.index).split('\n').length;
        hits.push(`${label}: "${m[0].trim()}" near line ${line}`);
      }
    }
    assert.deepEqual(hits, [], `bare builtin use after the capture block:\n${hits.join('\n')}`);
  };

  let shim = SHIM_SRC.slice(SHIM_SRC.indexOf('END CAPTURED BUILTINS'));
  shim = shim.replace(/BEGIN GENERATED MIRROR[\s\S]*?END GENERATED MIRROR/, '');
  shim = shim.replace(/const MULTI_LABEL_SUFFIXES[\s\S]*?function registrableDomain\(hostname\) \{[\s\S]*?\n  \}/, '');
  assert.ok(SHIM_SRC.includes('BEGIN CAPTURED BUILTINS') && SHIM_SRC.includes('END CAPTURED BUILTINS'), 'shim.js lost its capture-block markers');
  check('shim.js', stripped(shim));

  const start = GPC_SRC.indexOf('END CAPTURED BUILTINS');
  const end = GPC_SRC.indexOf('// ══ extension half');
  assert.ok(start > 0 && end > start, 'gpc.js lost its capture-block or extension-half markers');
  check('gpc.js (page half)', stripped(GPC_SRC.slice(start, end)));
});

// ═══════════════════════════════════════════════════════════════════════════
// A3 — the persona payload (noise keys included) is readable by the page
//
// ✅ FIXED 2026-09-16 (D21): the shim stops the authenticated event dead and
// relays a stripped `{ ok, enabled, gpc, gpcNonce }` for gpc.js, which stops
// that in turn. Page listeners on window (capture) — the earliest a page can
// be — see neither.
// ═══════════════════════════════════════════════════════════════════════════

test('A3 GUARD: a page window-capture listener sees neither the persona delivery nor the gpc relay; gpc.js still gets its config', () => {
  const s = bootRealm({ gpc: true });
  assert.equal(s.ctx.navigator.globalPrivacyControl, true, 'sanity: gpc.js is up');
  s.page(`
    globalThis.__stolen = null; globalThis.__fires = 0;
    globalThis.EventTarget.prototype.addEventListener.call(globalThis, 'nullecho:persona', (ev) => {
      globalThis.__fires++; globalThis.__stolen = JSON.parse(ev.detail);
    }, true);
    document.addEventListener('nullecho:persona', (ev) => { globalThis.__fires++; }, true);
    document.addEventListener('nullecho:persona', (ev) => { globalThis.__fires++; });
  `);
  s.upgrade(DELIVERED, { gpc: false });
  assert.equal(s.ua(), DELIVERED.ua, 'the shim consumed the handshake');
  assert.equal(s.ctx.navigator.globalPrivacyControl, undefined, 'gpc.js heard {gpc:false} through the shim\'s relay');
  assert.equal(s.ctx.__stolen, null, 'REGRESSION: a page listener read the delivered payload');
  assert.equal(s.ctx.__fires, 0, 'REGRESSION: a page listener fired on the delivery or on the relay');
});

test('A3 GUARD: with gpc.js absent (excluded host) nothing is relayed, and an unauthenticated event is left to the page', () => {
  const s = bootRealm();
  s.page(`
    globalThis.__seen = [];
    globalThis.EventTarget.prototype.addEventListener.call(globalThis, 'nullecho:persona', (ev) => { globalThis.__seen.push(JSON.parse(ev.detail)); }, true);
  `);
  s.upgrade();                                     // gpcNonce: null → no relay
  assert.equal(s.ua(), DELIVERED.ua);
  assert.deepEqual(plain(s.ctx.__seen), [], 'nothing reached the page: no delivery, no relay');
  // The page's own event (wrong nonce) is not ours to swallow — swallowing it would be a free presence probe.
  s.send({ ok: true, enabled: false, nonce: 'f'.repeat(32) });
  assert.equal(s.ctx.__seen.length, 1, 'an unauthenticated event propagates normally');
  assert.equal(s.ua(), DELIVERED.ua, 'and changes nothing');
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
//
// FIXED 2026-09-16 (DECISIONS.md D20). The URL-derived `ID_PARAM` strike is
// gone — retired, not tightened, because the network layer cannot distinguish
// a parameter the third party originated from one the embedding page pasted
// in — and `SET_COOKIE` now counts only cookies the browser would actually
// keep cross-site (`SameSite=None`, not `Partitioned`), so "embed any site with
// a session cookie on three pages" is closed too. The test is now the guard.

test('A5 FIXED: an ID-bearing query string from three attacker-controlled sites earns the victim NOTHING — no record, no rule', async () => {
  await H.reset();
  dynamicRuleCalls.length = 0;
  assert.equal(webRequestListeners.onBeforeRequest, undefined,
    'a URL-only observer is registered again — the attacker controls every byte of the URL');
  const { onBeforeSendHeaders, onHeadersReceived } = webRequestListeners;
  assert.equal(typeof onBeforeSendHeaders, 'function');
  assert.equal(typeof onHeadersReceived, 'function');

  const url = 'https://cdn.victim.example/logo.png?gclid=' + 'Q7'.repeat(12);
  // github.io subdomains are (correctly) separate registrable domains — three free
  // pages are three "unrelated first parties". Everything the attacker can arrange
  // is here: the decorated URL, no cookie for the victim (the attacker cannot
  // write the victim's jar), and a victim server that does what ordinary servers
  // do — sets a session cookie and even reflects the parameter into one — but
  // without `SameSite=None`, which Chrome drops from a cross-site response.
  for (const site of ['a1.github.io', 'a2.github.io', 'a3.github.io']) {
    const base = { tabId: 1, type: 'image', url, initiator: `https://${site}` };
    onBeforeSendHeaders({ ...base, requestHeaders: [{ name: 'Accept', value: 'image/avif,image/webp,*/*' }] });
    onHeadersReceived({ ...base, responseHeaders: [
      { name: 'Content-Type', value: 'image/png' },
      { name: 'Set-Cookie', value: 'PHPSESSID=8f3a9c1d2e4b6a7f8c9d0e1f2a3b4c5d; Path=/; HttpOnly' },
      { name: 'Set-Cookie', value: 'gclid=' + 'Q7'.repeat(12) + '; Path=/; SameSite=Lax' },
    ] });
  }
  await new Promise((r) => setTimeout(r, 30));
  assert.equal((await H.getState()).find((d) => d.domain === 'victim.example'), undefined,
    'victim.example was recorded on the strength of a URL the attacker wrote');
  assert.deepEqual(dynamicRuleCalls.flatMap((c) => c.addRules ?? []), [], 'a rule was written');

  // Positive control — the learner is still alive for a third party that DOES
  // set a cross-site identifier on three unrelated sites (EFF's three strikes).
  for (const site of ['news.test', 'shop.test', 'blog.test']) {
    onHeadersReceived({ tabId: 1, type: 'script', url: 'https://t.tracker.example/px.js', initiator: `https://${site}`,
      responseHeaders: [{ name: 'Set-Cookie', value: 'uid=8f3a9c1d2e4b6a7f8c9d0e1f2a3b4c5d; Path=/; Secure; SameSite=None' }] });
  }
  for (let i = 0; i < 50 && (await H.getState()).find((d) => d.domain === 'tracker.example')?.status !== 'blocked'; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal((await H.getState()).find((d) => d.domain === 'tracker.example')?.status, 'blocked');
  const rule = dynamicRuleCalls.flatMap((c) => c.addRules ?? []).find((r) => r.condition?.requestDomains?.[0] === 'tracker.example');
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

// FIXED 2026-09-16 (DECISIONS.md D19). Three static `modifyHeaders` rulesets —
// one per host OS family, generated from personas.js + the shim's GREASE brand —
// rewrite `User-Agent` and every `Sec-CH-UA-*` request header; background.js
// enables the host family's one. Family-level rather than per-origin because the
// `main_frame` request precedes any content script, so a per-origin rule cannot
// exist for the first request to a site — while D12 already pins every persona
// this host can be shown (fallback included) to one family. The guard boots the
// REAL shim once per persona and compares what its navigator says to the bytes
// the ruleset would put on the wire, field by field.

test('B2 FIXED: User-Agent and every Sec-CH-UA-* header are rewritten to the host family\'s values, which equal the JS persona\'s field by field (one documented residual)', async () => {
  const s0 = bootRealm(); // host navigator says Chrome/152
  assert.match(s0.h.REAL.userAgent, /Chrome\/152/, 'the browser itself would send Chrome/152');
  assert.match(s0.ua(), /Chrome\/151\.0\.0\.0/, 'the JS persona still says 151 — the header follows it, not the other way round');

  const WANT = ['User-Agent', 'Sec-CH-UA', 'Sec-CH-UA-Mobile', 'Sec-CH-UA-Platform', 'Sec-CH-UA-Full-Version-List',
    'Sec-CH-UA-Full-Version', 'Sec-CH-UA-Platform-Version', 'Sec-CH-UA-Arch', 'Sec-CH-UA-Bitness', 'Sec-CH-UA-Model', 'Sec-CH-UA-WoW64'];
  const families = { win: 'ua-win.json', mac: 'ua-mac.json', linux: 'ua-linux.json' };
  const familyOfPlatform = { Win32: 'win', MacIntel: 'mac', 'Linux x86_64': 'linux' };
  // Chrome's wire form (RFC 8941), written out here rather than imported so this
  // check does not lean on the generator it is checking.
  const q = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  const list = (arr) => Array.from(arr, (b) => `${q(b.brand)};v=${q(b.version)}`).join(', ');
  const bool = (b) => (b ? '?1' : '?0');

  // Both manifests register the three rulesets, DISABLED — the worker picks one.
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    const m = JSON.parse(fs.readFileSync(path.join(EXT, name), 'utf8'));
    for (const [fam, file] of Object.entries(families)) {
      const r = m.declarative_net_request.rule_resources.find((x) => x.path === `rules/${file}`);
      assert.ok(r, `${name} does not register ${file}`);
      assert.equal(r.id, `ua-${fam}`);
      assert.equal(r.enabled, false, `${name}: three enabled at once would fight over the same headers`);
    }
  }

  const mismatches = [];
  let checked = 0;
  for (const [fam, file] of Object.entries(families)) {
    const rules = JSON.parse(fs.readFileSync(path.join(EXT, 'rules', file), 'utf8'));
    const wire = {};
    for (const r of rules) {
      assert.equal(r.action.type, 'modifyHeaders');
      assert.ok(r.condition.resourceTypes.includes('main_frame'), 'the navigation is the first request the server sees');
      for (const h of r.action.requestHeaders) { assert.equal(h.operation, 'set'); wire[h.header] = h.value; }
    }
    assert.deepEqual(Object.keys(wire).sort(), [...WANT].sort(), `${file} rewrites exactly these headers`);

    for (const p of PERSONAS.filter((p) => familyOfPlatform[p.platform] === fam)) {
      const s = bootRealm();
      s.upgrade({ ...p, fontList: ['Helvetica'], noise: { canvas: 0.31, audio: 0.57, webgl: 0.73 }, seed: 1 });
      assert.equal(s.statuses.at(-1)?.upgraded, true, `${p.id}: the shim did not accept the persona`);
      const hi = await s.page('navigator.userAgentData.getHighEntropyValues(["architecture","bitness","model","platformVersion","uaFullVersion","fullVersionList","wow64"])');
      const js = {
        'User-Agent': s.ua(),
        'Sec-CH-UA': list(s.page('navigator.userAgentData.brands')),
        'Sec-CH-UA-Mobile': bool(s.page('navigator.userAgentData.mobile')),
        'Sec-CH-UA-Platform': q(s.page('navigator.userAgentData.platform')),
        'Sec-CH-UA-Full-Version-List': list(hi.fullVersionList),
        'Sec-CH-UA-Full-Version': q(hi.uaFullVersion),
        'Sec-CH-UA-Platform-Version': q(hi.platformVersion),
        'Sec-CH-UA-Arch': q(hi.architecture),
        'Sec-CH-UA-Bitness': q(hi.bitness),
        'Sec-CH-UA-Model': q(hi.model),
        'Sec-CH-UA-WoW64': bool(hi.wow64),
      };
      for (const name of WANT) {
        checked += 1;
        if (js[name] !== wire[name]) mismatches.push({ persona: p.id, header: name, js: js[name], wire: wire[name] });
      }
    }
  }
  assert.equal(checked, PERSONAS.length * WANT.length, 'every persona × every header was compared');
  assert.deepEqual(mismatches, [
    { persona: 'macos-chrome-intel-iris', header: 'Sec-CH-UA-Arch', js: '"x86"', wire: '"arm"' },
  ], 'THE RESIDUAL (D19): one persona, one header. Anything else here is B2 back — or a pool change that needs D19 revisited');
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

test('B4 GUARD: silence is not noised — a silent analyser returns all-zero bytes and all -Infinity floats', () => {
  const s = bootRealm();
  s.upgrade();
  const bytes = s.page('const a = new AnalyserNode(); const u = new Uint8Array(1024); a.getByteFrequencyData(u); Array.from(u).filter((v) => v !== 0).length');
  assert.equal(bytes, 0, 'GUARD: a silent byte spectrum has no non-zero bins');
  const floats = s.page('const a2 = new AnalyserNode(); const f = new Float32Array(1024); a2.getFloatFrequencyData(f); Array.from(f).filter((v) => v !== -Infinity).length');
  assert.equal(floats, 0, 'GUARD: a silent float spectrum is -Infinity in every bin');
});

test('B5 GUARD: a sub-rectangle read equals the same region of a full read byte for byte — inked or blank', () => {
  const s = bootRealm();
  s.upgrade();
  const c = s.canvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(200,30,30)'; ctx.fillRect(16, 16, 16, 16); // ink only bottom-right
  const full = ctx.getImageData(0, 0, 32, 32).data;
  const corner = ctx.getImageData(0, 0, 8, 8).data;
  assert.ok(bytesEqual(corner, sliceOfFull(full, 32, 0, 0, 8, 8)), 'GUARD: transparent corner — sub-rect read === slice of the full read');
  assert.ok(corner.some((v) => v !== 0), 'and it is noised: the canvas has ink, so the whole region is (margins included)');
  const inked = ctx.getImageData(16, 16, 16, 16).data;
  assert.ok(bytesEqual(inked, sliceOfFull(full, 32, 16, 16, 16, 16)), 'GUARD: inked quadrant — sub-rect read === slice of the full read');

  const blank = s.canvas(32, 32).getContext('2d');
  assert.ok(blank.getImageData(0, 0, 8, 8).data.every((v) => v === 0) && blank.getImageData(0, 0, 32, 32).data.every((v) => v === 0),
    'a never-drawn canvas reads all zeros on both paths');
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

test('C2 GUARD: hooking WeakMap.prototype.get never sees NATIVE_SRC; toString masking still works under the hook (fixed with A2, D21)', () => {
  const s = bootRealm();
  const out = s.page(`
    let map = null, gets = 0;
    const origGet = WeakMap.prototype.get;
    WeakMap.prototype.get = function (k) { gets++; map = this; return origGet.call(this, k); };
    let plainSrc, patchedSrc;
    try {
      plainSrc = (function pageFn() { return 1; }).toString();
      patchedSrc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent').get.toString();
    } finally { WeakMap.prototype.get = origGet; }
    ({ gotMap: map instanceof WeakMap, gets, plainSrc, patchedSrc });
  `);
  assert.equal(out.gotMap, false, 'REGRESSION: the shim consulted NATIVE_SRC through the live WeakMap.prototype.get');
  assert.equal(out.gets, 0, 'REGRESSION: the patched toString invoked WeakMap.prototype.get at run time');
  assert.match(out.plainSrc, /return 1/, 'an ordinary function still prints its source');
  assert.equal(out.patchedSrc, 'function get userAgent() { [native code] }', 'the mask still applied while the hook was live');
});

test('C3 REPRO: the heuristics layer waits for a nullecho:signal message that no file ever sends (CANVAS / SUPERCOOKIE strikes are dead)', () => {
  const senders = fs.readdirSync(HERE).filter((f) => f.endsWith('.js') && !f.includes('.test.') && f !== 'heuristics.js')
    .filter((f) => src(f).includes('nullecho:signal'));
  assert.deepEqual(senders, [], 'THE FINDING: handleContentReport() is unreachable — the shim reports nullecho:fp-detected, which only bumps a counter');
  assert.equal(H.handleContentReport({ type: 'nullecho:fp-detected', api: 'canvas', count: 1 }, { url: 'https://x.example' }), false);
});
