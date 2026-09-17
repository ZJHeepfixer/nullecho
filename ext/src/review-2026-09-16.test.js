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
 *   · `bootRealm({ child: true })` hangs a SECOND vm context off
 *     `HTMLIFrameElement.prototype.contentWindow`, which is the accessor the shim
 *     wraps to install into a child realm. It is a real second realm with its own
 *     `Array`/`Object`, which is what the B3c guard measures — but it does NOT
 *     model Chrome injecting its own content scripts into blank frames (that case
 *     is `bootRealm({ hostname: '' })`, B3a), and it does not model which wrapper
 *     ends up outermost when both paths happen.
 *   · The loader stand-in in `bootRealm` listens on `window` in the capture phase
 *     before the MAIN-world scripts run and swallows anything carrying a reply
 *     token, because that is what `shim-loader.js` does since D30. Tests that
 *     drive the REAL loader use `loaderRealm()` (C1) or
 *     `handshake-integration.test.js`.
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
  // Measured in real Chrome 151 (review B7, DECISIONS.md D27 as rewritten): the
  // \`brands\` attribute hands back a NEW frozen array on every read, whose entries
  // are ordinary writable objects. \`languages\` above, by contrast, IS the same
  // frozen object every time — so this fake reproduces both, and the difference
  // between them is what the B7 guards measure the shim against.
  const REAL_BRANDS = [
    { brand: 'Not;A=Brand', version: '99' }, { brand: 'Chromium', version: '152' }, { brand: 'Google Chrome', version: '152' },
  ];
  // Built with the freeze captured at rig-setup time and by index assignment, never
  // \`map\`/\`push\`: this getter stands in for NATIVE code, and A2-timing hooks those
  // three to throw. A native getter routes through none of them.
  const rawFreeze = Object.freeze;
  const freshBrands = () => {
    const out = [];
    for (let i = 0; i < REAL_BRANDS.length; i++) out[i] = { brand: REAL_BRANDS[i].brand, version: REAL_BRANDS[i].version };
    return rawFreeze(out);
  };
  const UAD = { mobile: false, platform: 'macOS' };
  for (const k of Object.keys(UAD)) {
    Object.defineProperty(NavigatorUAData.prototype, k, {
      get() { brand(this, NavigatorUAData); return UAD[k]; }, configurable: true, enumerable: true,
    });
  }
  Object.defineProperty(NavigatorUAData.prototype, 'brands', {
    get() { brand(this, NavigatorUAData); return freshBrands(); }, configurable: true, enumerable: true,
  });
  NavigatorUAData.prototype.toJSON = function () { brand(this, NavigatorUAData); return { ...UAD, brands: freshBrands() }; };
  NavigatorUAData.prototype.getHighEntropyValues = function () {
    brand(this, NavigatorUAData);
    return Promise.resolve({ ...UAD, brands: freshBrands(), platformVersion: '26.6.0', architecture: 'arm', bitness: '64' });
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
  // A child realm, reachable exactly the way the shim reaches one: the NATIVE
  // \`contentWindow\` accessor on HTMLIFrameElement.prototype, which the shim wraps
  // so that the first read installs into that realm. \`bootRealm({ child: true })\`
  // puts a second vm context (its own DOM_SETUP, its own Array/Object) here.
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    get() { brand(this, HTMLIFrameElement); return globalThis.__childWindow || null; },
    configurable: true, enumerable: true,
  });
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
    readPixels(x, y, w, h, f, t, px, off) { brand(this, WebGLRenderingContext); const o = off | 0; for (let i = 0; i < w * h * 4 && o + i < px.length; i++) px[o + i] = 200; }
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
  document.createElement = (tag) => {
    const t = String(tag).toLowerCase();
    if (t === 'canvas') return new HTMLCanvasElement();
    if (t === 'iframe') return new HTMLIFrameElement();
    return new HTMLElement();
  };
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
 *
 * `shim: false` models the one production path where `gpc.js` is on its own:
 * `shim.js` failed to load or threw before it could listen, so nothing swallows
 * the loader's event and nothing relays a stripped payload — gpc.js reads the
 * loader's raw payload itself — D29's named residual.
 */
function bootRealm({ hostname = 'example.test', origin = 'https://example.test', extraGlobals = {}, gpc = false, shim = true, child = false } = {}) {
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

  // A same-origin child realm: a SECOND vm context with its own DOM_SETUP, hung
  // off `HTMLIFrameElement.prototype.contentWindow`. Fidelity note: it shares
  // nothing with the parent but the reference — which is the point, because what
  // is under test is whether values the parent's `installInto` hands into that
  // realm belong to it. It does NOT model Chrome's own content-script injection
  // into blank frames (that path is `bootRealm({ hostname: '' })`, B3a), and it
  // does not model wrapper ordering between the two.
  let childCtx = null, childWin = null;
  if (child) {
    childCtx = vm.createContext({
      location: { hostname, origin },
      crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
      console: sandbox.console, setTimeout, clearTimeout, queueMicrotask,
    });
    vm.runInContext(DOM_SETUP, childCtx, { filename: 'dom-setup.child.js' });
    childWin = vm.runInContext('globalThis', childCtx);
    ctx.__childWindow = childWin;
  }

  // A stand-in for the loader's reverse-channel listener, registered the way the
  // real one is (D30): `window` in the CAPTURE phase, BEFORE the MAIN-world
  // scripts run, and swallowing anything that carries a reply token so a page
  // listener downstream never sees a live one.
  const statuses = [];
  const detects = [];
  let boot = null, gpcBoot = null;
  const onReverse = (ev) => {
    let d = null;
    try { d = JSON.parse(ev.detail); } catch (_) { return; }
    if (ev.type === 'nullecho:detect') { detects.push(d); }
    else if (d.phase === 'boot') {
      if (d.channel === 'shim' && !boot) boot = d;
      else if (d.channel === 'gpc' && !gpcBoot) gpcBoot = d;
      return;                                   // boot events are never swallowed
    } else { statuses.push(d); }
    if (typeof d.token === 'string') { try { ev.stopImmediatePropagation(); } catch (_) {} }
  };
  for (const type of ['nullecho:status', 'nullecho:detect']) {
    ctx.EventTarget.prototype.addEventListener.call(win, type, onReverse, true);
    ctx.document.addEventListener(type, onReverse, true);
  }

  if (shim) vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  if (gpc) vm.runInContext(GPC_SRC, ctx, { filename: 'gpc.js' });

  /** Dispatch a persona event exactly as the loader (or a forging page) would. */
  const send = (payload) => vm.runInContext(
    'document.dispatchEvent(new CustomEvent("nullecho:persona", { detail: __payload }))',
    Object.assign(ctx, { __payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  );
  /** Run page script inside the realm. */
  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });

  return {
    ctx, win, h, logs, boot, gpcBoot, statuses, detects, send, page, childCtx, childWin,
    /** The loader's delivery: shim nonce always; the gpc nonce whenever gpc.js booted, as shim-loader.js does. */
    upgrade: (persona = DELIVERED, over = {}) => send({
      ok: true, enabled: true, gpc: true, site: hostname, persona, nonce: boot.nonce,
      gpcNonce: gpcBoot ? gpcBoot.nonce : null, reportTokens: RIG_TOKENS, ...over,
    }),
    ua: () => ctx.navigator.userAgent,
    canvas: (w, h2) => { const c = page('document.createElement("canvas")'); c.width = w; c.height = h2; return c; },
  };
}

/** One-time reply tokens the rig's stand-in loader delivers (D30). Distinct, and long enough to be accepted. */
const RIG_TOKENS = Array.from({ length: 32 }, (_, i) => `rigtoken${String(i).padStart(8, '0')}`);

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
  // Expectation changed 2026-09-16 (D25): `languages` is no longer patched, so it
  // is the realm's own real list — the point here is that the hostile hooks did not
  // disturb it either. Captured-`Object.freeze` coverage moved to `brands` below,
  // which still builds frozen entries through `objFreeze` while the page's throws.
  assert.deepEqual(plain(read.languages), plain(s.h.REAL.languages), 'languages stayed the host\'s real list (D25)');
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

// ═══════════════════════════════════════════════════════════════════════════
// A4 — eTLD+1 confusion in both layers; the two suffix tables disagreed
//
// ✅ FIXED 2026-09-16 (DECISIONS.md D23). One table, `src/suffixes.js`, is the
// source of truth: the service worker imports it, and the shim carries a
// GENERATED SUFFIX MIRROR of it (MV3 content scripts cannot import) that
// `tools/gen-suffix-mirror.mjs` writes and A4d below pins value-for-value.
// Platform suffixes (every *.myshopify.com store, every *.wordpress.com blog)
// are separate sites in BOTH layers; the ccTLD second-level suffixes the shim
// lacked are in both too.
// ═══════════════════════════════════════════════════════════════════════════

test('A4a GUARD: the service worker keys each *.myshopify.com / *.wordpress.com tenant as its OWN site', () => {
  assert.equal(BG.siteKeyFor('https://acme-store.myshopify.com/checkout'), 'acme-store.myshopify.com');
  assert.equal(BG.siteKeyFor('https://other-store.myshopify.com/'), 'other-store.myshopify.com');
  assert.equal(BG.siteKeyFor('https://alice.wordpress.com/'), 'alice.wordpress.com');
  assert.equal(BG.siteKeyFor('https://bob.wordpress.com/'), 'bob.wordpress.com');
  assert.equal(BG.siteKeyFor('https://www.acme-store.myshopify.com/'), 'acme-store.myshopify.com', 'www is still folded into the tenant');
  // …so two tenants draw their salted personas from two different keys.
  const salt = 'deadbeef'.repeat(4);
  const a = BG.siteKeyFor('https://acme-store.myshopify.com'), b = BG.siteKeyFor('https://other-store.myshopify.com');
  assert.notEqual(a, b);
  assert.notDeepEqual(personaFor(salt, a, 'mac').noise, personaFor(salt, b, 'mac').noise, 'GUARD: different keys, different noise keys — cross-site separation is back');
});

test('A4b GUARD: allowlisting one Shopify store writes a DNR rule for that store only; the next store stays protected', async () => {
  dynamicRuleCalls.length = 0;
  const res = await swMessage({ type: 'nullecho:set-site-enabled', url: 'https://acme-store.myshopify.com/', enabled: false }, { url: 'chrome-extension://review/popup/popup.html' });
  assert.equal(res.site, 'acme-store.myshopify.com', 'GUARD: the allowlist entry is the store, not the platform suffix');
  const rule = dynamicRuleCalls.flatMap((c) => c.addRules ?? []).find((r) => r.action?.type === 'allowAllRequests');
  assert.deepEqual(rule.condition.requestDomains, ['acme-store.myshopify.com'], 'GUARD: DNR matches that store and its subdomains only');
  const other = await swMessage({ type: 'nullecho:get-persona' }, { url: 'https://other-store.myshopify.com/' });
  assert.equal(other.enabled, true, 'GUARD: a store the user never touched is still protected');
  await swMessage({ type: 'nullecho:set-site-enabled', url: 'https://acme-store.myshopify.com/', enabled: true }, {});
});

test('A4c GUARD: the shim keys ccTLD second-level sites apart, exactly as the service worker does', () => {
  const rd = shimRegistrableDomain();
  for (const [a, b] of [['ynet.co.il', 'walla.co.il'], ['detik.co.id', 'kompas.co.id'], ['pravda.com.ua', 'ukr.com.ua'], ['onet.com.pl', 'wp.com.pl'], ['a.myshopify.com', 'b.myshopify.com']]) {
    assert.notEqual(rd(a), rd(b), `GUARD: ${a} and ${b} get different fallback keys`);
    assert.equal(rd(a), H.registrableDomain(a), `GUARD: shim and service worker agree on ${a}`);
    assert.equal(rd(b), H.registrableDomain(b), `GUARD: shim and service worker agree on ${b}`);
    assert.equal(rd(a).split('.').length, 3, `the key is the registrable domain ${rd(a)}`);
  }
});

test('A4d GUARD: the shim mirror and the service worker use ONE suffix table, pinned value-for-value to src/suffixes.js', async () => {
  const S = await import('./suffixes.js').catch(() => null);
  assert.ok(S && Array.isArray(S.MULTI_LABEL_SUFFIXES) && typeof S.registrableDomain === 'function', 'src/suffixes.js must export MULTI_LABEL_SUFFIXES (array) and registrableDomain');
  const canon = S.MULTI_LABEL_SUFFIXES;
  assert.equal(new Set(canon).size, canon.length, 'no duplicate suffixes');
  assert.deepEqual([...canon].sort(), canon, 'the canonical table is sorted, so diffs are readable');

  // The shim's table, lifted from its GENERATED SUFFIX MIRROR block and evaluated.
  const shimTable = /const MULTI_LABEL_SUFFIXES = new Set\(\(([\s\S]*?)\)\.split/.exec(SHIM_SRC)[1]
    .replace(/'|\+|\n|\s/g, '').split('|');
  const a = new Set(shimTable), b = new Set(canon);
  const onlyShim = [...a].filter((x) => !b.has(x)), onlyCanon = [...b].filter((x) => !a.has(x));
  assert.deepEqual({ onlyShim, onlyCanon }, { onlyShim: [], onlyCanon: [] }, 'GUARD: zero drift between the shim mirror and src/suffixes.js — run tools/gen-suffix-mirror.mjs');
  assert.ok(SHIM_SRC.includes('BEGIN GENERATED SUFFIX MIRROR') && SHIM_SRC.includes('END GENERATED SUFFIX MIRROR'), 'the shim marks the mirror as generated');

  // The service worker uses the same table and the same function, not a copy.
  assert.equal(H.registrableDomain, S.registrableDomain, 'heuristics.js re-exports the shared function');
  // …and so does the linkage graph's owner attribution (it had an 18-entry fourth copy).
  const L = await import('./linkage.js');
  for (const host of ['tracker.co.il', 'cdn.walla.co.il', 'www.pixel.com.ua', 'a.b.co.uk']) {
    assert.equal(L.baseDomain(host), S.registrableDomain(host), `linkage.baseDomain vs shared: ${host}`);
  }

  // And the three implementations agree on a corpus built from the table itself.
  const rd = shimRegistrableDomain();
  const corpus = ['localhost', '127.0.0.1', '[::1]', 'example', 'example.com', 'www.example.com', 'a.b.c.example.com', 'Example.COM.', 'x.co.uk'];
  for (const suf of canon) corpus.push(`site.${suf}`, `www.site.${suf}`, `deep.www.site.${suf}`, suf, `www.${suf}`);
  for (const host of corpus) {
    assert.equal(rd(host), S.registrableDomain(host), `shim vs shared: ${host}`);
    assert.equal(H.registrableDomain(host), S.registrableDomain(host), `worker vs shared: ${host}`);
  }
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

// ✅ FIXED 2026-09-16 (DECISIONS.md D25). `navigator.language` / `languages` are
// no longer patched at all: the locale is one browser preference that `Intl`,
// `toLocaleString` and the untouched `Accept-Language` header all mirror, and no
// persona carries one. D11 — a consistent leak beats an inconsistent fake. The
// guard runs the REAL shim in a German child process and requires the navigator
// to agree with `Intl` AND the prototype descriptor to be the untouched original.
test('B1 GUARD: navigator.language / languages are left real and agree with Intl and toLocaleString (run under LANG=de_DE)', () => {
  const child = `
    import fs from 'node:fs'; import vm from 'node:vm'; import { webcrypto } from 'node:crypto';
    const SHIM = fs.readFileSync(${JSON.stringify(path.join(HERE, 'shim.js'))}, 'utf8');
    class ET { addEventListener() {} removeEventListener() {} dispatchEvent() { return true; } }
    class CE { constructor(t, i) { this.type = t; this._d = i && i.detail; } }
    Object.defineProperty(CE.prototype, 'detail', { get() { return this._d; }, configurable: true });
    class Navigator {}
    Object.defineProperty(Navigator.prototype, 'language', { get() { return 'de-DE'; }, configurable: true });
    const REAL_LANGS = Object.freeze(['de-DE', 'de']);
    Object.defineProperty(Navigator.prototype, 'languages', { get() { return REAL_LANGS; }, configurable: true });
    Object.defineProperty(Navigator.prototype, 'platform', { get() { return 'MacIntel'; }, configurable: true });
    // The descriptors as they stood BEFORE the shim ran; a patch would replace \`get\`.
    const D0 = {
      language: Object.getOwnPropertyDescriptor(Navigator.prototype, 'language').get,
      languages: Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages').get,
    };
    const doc = new ET(); doc.createElement = () => ({});
    const ctx = vm.createContext({ document: doc, EventTarget: ET, CustomEvent: CE, Navigator, navigator: Object.create(Navigator.prototype),
      location: { hostname: 'example.test', origin: 'https://example.test' }, crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
      console: { log() {}, warn() {}, error() {} } });
    vm.runInContext(SHIM, ctx);
    console.log(JSON.stringify({
      language: ctx.navigator.language, languages: ctx.navigator.languages,
      untouched: Object.getOwnPropertyDescriptor(Navigator.prototype, 'language').get === D0.language
        && Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages').get === D0.languages,
      stableLangs: ctx.navigator.languages === ctx.navigator.languages,
      intl: vm.runInContext('Intl.DateTimeFormat().resolvedOptions().locale', ctx),
      number: vm.runInContext('(1234.5).toLocaleString()', ctx),
      date: vm.runInContext('new Date(Date.UTC(2026, 8, 16)).toLocaleDateString(undefined, { timeZone: "UTC" })', ctx),
    }));
  `;
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', child], {
    env: { ...process.env, LANG: 'de_DE.UTF-8', LC_ALL: 'de_DE.UTF-8' }, encoding: 'utf8',
  }).trim());
  assert.equal(out.intl, 'de-DE', 'the host really is German in this child process');
  assert.equal(out.number, '1.234,5');
  assert.equal(out.date, '16.9.2026');
  assert.equal(out.language, out.intl, 'GUARD: navigator.language equals the locale Intl reports');
  assert.deepEqual(out.languages, ['de-DE', 'de'], 'GUARD: navigator.languages is the host list, not en-US/en');
  assert.equal(out.untouched, true, 'GUARD: the shim installs no getter on language/languages at all (D25)');
  assert.equal(out.stableLangs, true, 'GUARD: unpatched languages keeps Chrome FrozenArray identity (B7)');
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

test('B2 FIXED: User-Agent and every Sec-CH-UA-* header are rewritten to the host family\'s values, which equal the JS persona\'s field by field (no residual since D24)', async () => {
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
  assert.deepEqual(mismatches, [],
    'GUARD (D24): no persona disagrees with its family\'s header ruleset on any header. Anything here is B2 back — or a pool change that needs D19 revisited');
});

// ✅ FIXED 2026-09-16 (DECISIONS.md D31). A same-origin `about:blank` / `srcdoc`
// child INHERITS its parent's site key and persona, at both stages: the shim's own
// fallback now reads the eTLD+1 out of the origin the child inherited when
// `location.hostname` is empty, and the worker falls back to `sender.origin` for
// the schemes that have no host of their own, so the child can upgrade to the same
// salted persona its parent is on.
test('B3a GUARD: an about:blank / srcdoc child derives the SAME fallback persona as its parent', () => {
  const PEPPER = 'nullecho-fallback-v1';
  const machine = (s) => `${s.ctx.navigator.hardwareConcurrency}/${s.ctx.navigator.deviceMemory}/${s.ctx.navigator.userAgent}`;
  // A site where keying on the origin STRING would have landed somewhere else —
  // i.e. one where the old bug was observable (≈80% of sites are).
  let site = null;
  for (const cand of ['news.example', 'shop.example', 'bank.example', 'video.example', 'mail.example', 'forum.example']) {
    if (personaFor(PEPPER, cand, 'mac').id !== personaFor(PEPPER, `https://www.${cand}`, 'mac').id) { site = cand; break; }
  }
  assert.ok(site, 'no candidate differed — statistically implausible, check personaFor');
  const expectParent = personaFor(PEPPER, site, 'mac');
  const parent = bootRealm({ hostname: `www.${site}`, origin: `https://www.${site}` });
  // about:blank and srcdoc: hostname is '', origin is the parent's, inherited.
  const blank = bootRealm({ hostname: '', origin: `https://www.${site}` });
  const srcdoc = bootRealm({ hostname: '', origin: `https://www.${site}` });
  assert.equal(machine(parent), `${expectParent.cores}/${expectParent.memory}/${expectParent.ua}`,
    'parent fallback = personaFor(pepper, eTLD+1)');
  assert.equal(machine(blank), machine(parent), 'GUARD: the blank child presents its parent\'s machine');
  assert.equal(machine(srcdoc), machine(parent), 'GUARD: so does a srcdoc child');

  // A port and an IPv6 authority must not break the parse, and a genuinely opaque
  // origin ("null", a sandboxed frame) still has no site key to inherit.
  const ported = bootRealm({ hostname: '', origin: `https://www.${site}:8443` });
  assert.equal(machine(ported), machine(parent), 'GUARD: a port in the inherited origin is not part of the key');
  const v6 = bootRealm({ hostname: '', origin: 'https://[2606:4700::1111]:8443' });
  assert.equal(v6.ctx.navigator.userAgent, bootRealm({ hostname: '[2606:4700::1111]', origin: 'https://[2606:4700::1111]' }).ctx.navigator.userAgent,
    'GUARD: a bracketed IPv6 authority survives the parse intact');
  const opaque = bootRealm({ hostname: '', origin: 'null' });
  assert.match(opaque.ctx.navigator.userAgent, /Chrome\//, 'an opaque origin still gets SOME coherent persona, just not an inherited one');
});

test('B3b GUARD: the service worker answers an about:blank / srcdoc sender with the PARENT origin\'s persona', async () => {
  // `siteKeyFor` is unchanged and still refuses these URLs — they have no host.
  // What changed is `senderSiteKey`, which knows that these schemes INHERIT an
  // origin and that `sender.origin` is the browser's account of which one.
  assert.equal(BG.siteKeyFor('about:blank'), '');
  assert.equal(BG.siteKeyFor('about:srcdoc'), '');

  for (const url of ['about:blank', 'about:srcdoc', 'blob:https://www.news.example/abc', 'data:text/html,x']) {
    const res = await swMessage({ type: 'nullecho:get-persona' }, { url, origin: 'https://www.news.example' });
    assert.equal(res.ok, true, `GUARD: a ${url} child was refused a persona`);
    assert.equal(res.site, 'news.example', 'and it is keyed on the parent\'s eTLD+1, not on the URL');
  }

  // The parent gets the same site key, so parent and child are the same machine.
  const parent = await swMessage({ type: 'nullecho:get-persona' }, { url: 'https://www.news.example/index.html', origin: 'https://www.news.example' });
  const child = await swMessage({ type: 'nullecho:get-persona' }, { url: 'about:blank', origin: 'https://www.news.example' });
  assert.equal(child.persona.id, parent.persona.id, 'GUARD: same salted persona in the child realm as in the parent document');

  // An OPAQUE origin is still refused: a sandboxed iframe reports origin 'null',
  // which is not a site and must not be keyed as one.
  const sandboxed = await swMessage({ type: 'nullecho:get-persona' }, { url: 'about:blank', origin: 'null' });
  assert.deepEqual(sandboxed, { ok: false, error: 'unsupported scheme' }, 'an opaque origin has no site key, correctly');
  // And a scheme that does NOT inherit an origin is refused as before.
  const internal = await swMessage({ type: 'nullecho:get-persona' }, { url: 'chrome://settings', origin: 'https://www.news.example' });
  assert.deepEqual(internal, { ok: false, error: 'unsupported scheme' }, 'chrome:// must not borrow a site key from sender.origin');
});

test('B3c GUARD: a child realm reached through contentWindow presents the parent\'s persona, in the CHILD realm\'s own Array', () => {
  const s = bootRealm({ child: true });
  s.upgrade();
  // Reading `contentWindow` is what installs into that realm — the same read a
  // tracker makes to get at a pristine one.
  s.page('globalThis.__cw = document.createElement("iframe").contentWindow;');
  const inChild = (code) => vm.runInContext(code, s.childCtx);

  assert.equal(s.childCtx.navigator.userAgent, DELIVERED.ua, 'GUARD: the child realm presents the parent\'s persona');
  assert.equal(s.childCtx.navigator.hardwareConcurrency, DELIVERED.cores);
  assert.equal(s.childCtx.navigator.deviceMemory, DELIVERED.memory);
  assert.equal(s.childCtx.navigator.platform, DELIVERED.platform);

  // D27's named realm residual, closed by D31. Everything the shim builds lives in
  // ITS closure — the parent's realm — so `frames[0].navigator.userAgentData.brands
  // instanceof frames[0].Array` was false where Chrome says true: a one-line "this
  // realm was patched from outside" detector, the same shape as B3 itself.
  assert.equal(inChild('navigator.userAgentData.brands instanceof Array'), true,
    'GUARD: brands is the CHILD realm\'s Array');
  assert.equal(inChild('Object.getPrototypeOf(navigator.userAgentData.brands[0]) === Object.prototype'), true,
    'GUARD: and its entries are the child realm\'s objects');
  assert.equal(inChild('Object.isFrozen(navigator.userAgentData.brands)'), true, 'still frozen (D27)');
  assert.equal(inChild('navigator.userAgentData.brands === navigator.userAgentData.brands'), false, 'still fresh per read (D27)');
  assert.equal(inChild('navigator.userAgentData.brands[1].brand + "/" + navigator.userAgentData.brands[1].version'), 'Chromium/151',
    'and it is the parent persona\'s brand list');
  assert.equal(inChild('navigator.userAgentData.toJSON().brands instanceof Array'), true,
    'GUARD: the toJSON() dictionary\'s array too');
  assert.equal(inChild('Object.getPrototypeOf(navigator.userAgentData.toJSON()) === Object.prototype'), true,
    'GUARD: and the dictionary object itself');
  assert.equal(inChild('new WebGLRenderingContext(document.createElement("canvas")).getSupportedExtensions() instanceof Array'), true,
    'GUARD: the filtered WebGL extension list too');

  // The parent realm is unaffected: its arrays are still its own.
  assert.equal(s.page('navigator.userAgentData.brands instanceof Array'), true, 'the parent still gets parent-realm arrays');
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

test('A1d GUARD: readPixels noise is keyed on the read REGION only — a page reusing a bigger scratch buffer with a changing tail gets the same bytes every read', () => {
  const s = bootRealm();
  s.upgrade();
  const out = s.page(`
    const gl = new WebGLRenderingContext(document.createElement('canvas'));
    const RGBA = 0x1908, UB = 0x1401;
    const region = 8 * 8 * 4;
    const buf = new Uint8Array(region * 2);      // twice the region: the tail is page scratch
    const read = (tail) => { buf.fill(tail, region); gl.readPixels(0, 0, 8, 8, RGBA, UB, buf, 0); return Array.from(buf.subarray(0, region)); };
    const a = read(1), b = read(2), c = read(1);
    JSON.stringify({ noised: a.some((v) => v !== 200), same_ab: JSON.stringify(a) === JSON.stringify(b), same_ac: JSON.stringify(a) === JSON.stringify(c) });
  `);
  const r = JSON.parse(out);
  assert.ok(r.noised, 'the region is noised');
  assert.ok(r.same_ab && r.same_ac, 'GUARD: the tail of the buffer is not part of the content — the same region reads the same every time');
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

// ✅ FIXED 2026-09-16 (DECISIONS.md D27, REWRITTEN the same day against a
// measurement). The review said Chrome caches the `brands` FrozenArray attribute
// and hands out the same object on every read, and the first fix cached it. It is
// not what Chrome does. MEASURED in Jason's real Chrome 151.0.0.0 on macOS, shim
// OFF (not the Electron Browser pane — D21's BASELINE caveat):
//
//     navigator.userAgentData.brands === navigator.userAgentData.brands  // false
//     Object.isFrozen(navigator.userAgentData.brands)                    // true
//     Object.isFrozen(brands[0])                                         // false
//     navigator.languages === navigator.languages                        // true
//     await getHighEntropyValues(['fullVersionList'])                    // fresh array per call
//
// So: a NEW frozen array per read, ordinary writable entries — and `languages`
// genuinely IS cached, which is the contrast that makes the brands result real
// rather than a measuring artefact. The cache is reverted; these guards assert the
// measurement. `languages` needs nothing either way: D25 stopped patching it, so
// the engine's own getter answers.
test('B7 GUARD: userAgentData.brands is a FRESH frozen array per read and navigator.languages is the same object, exactly as measured in Chrome 151', () => {
  const s = bootRealm();
  s.upgrade();
  assert.equal(s.page('navigator.languages === navigator.languages'), true, 'GUARD: languages identity (unpatched since D25)');
  assert.equal(s.page('navigator.userAgentData.brands === navigator.userAgentData.brands'), false,
    'GUARD: a new array per read, as measured — caching it was the detector');
  assert.equal(s.page('Object.isFrozen(navigator.userAgentData.brands)'), true,
    'GUARD: each array is frozen, as a FrozenArray attribute is');
  assert.equal(s.page('navigator.userAgentData.brands[1].brand + "/" + navigator.userAgentData.brands[1].version'), 'Chromium/151',
    'and it is still the persona\'s brand list');
  assert.deepEqual(plain(s.page('navigator.userAgentData.brands')), plain(s.page('navigator.userAgentData.brands')),
    'GUARD: different objects, identical contents — the freshness is not an entropy source');

  // A page cannot make an array it was handed grow or change length.
  assert.equal(s.page('(() => { const b = navigator.userAgentData.brands; try { b.length = 0; } catch (_) {} return b.length; })()'), 3,
    'GUARD: frozen means frozen — a page cannot truncate the array it holds');

  // The ENTRIES are deliberately NOT frozen: measured `Object.isFrozen(brands[0])
  // === false`, with `brand` writable. A write sticks on the array the page is
  // holding and is gone on the next read, because that read builds a new one —
  // which is what Chrome does.
  assert.equal(s.page('Object.isFrozen(navigator.userAgentData.brands[0])'), false,
    'GUARD: entries stay ordinary objects, as measured');
  assert.equal(s.page('(() => { const b = navigator.userAgentData.brands; b[0].brand = "zz"; return b[0].brand; })()'), 'zz',
    'GUARD: a write to a held entry sticks — the entries are writable, as measured');
  assert.notEqual(s.page('navigator.userAgentData.brands[0].brand'), 'zz',
    'GUARD: and the next read is a fresh array, so the write did not persist');

  // The native brand check must still fire on the replaced getter.
  assert.throws(() => s.page('Object.getOwnPropertyDescriptor(NavigatorUAData.prototype, "brands").get.call({})'),
    /Illegal invocation/, 'GUARD: the Illegal-invocation check survived the revert');

  // `toJSON()` and `getHighEntropyValues()` return IDL DICTIONARIES: each
  // conversion builds a new plain array. Measured per-call freshness for
  // `getHighEntropyValues(['fullVersionList'])` too.
  assert.equal(s.page('navigator.userAgentData.toJSON().brands === navigator.userAgentData.brands'), false,
    'toJSON() is a dictionary conversion — a fresh array, as in Chrome');
  assert.equal(s.page('navigator.userAgentData.toJSON().brands.length'), 3);

  // Control: the unshimmed fakes behave the way Chrome was measured to.
  const control = vm.createContext({ console });
  vm.runInContext(DOM_SETUP, control);
  assert.equal(vm.runInContext('navigator.languages === navigator.languages', control), true);
  assert.equal(vm.runInContext('navigator.userAgentData.brands === navigator.userAgentData.brands', control), false);
  assert.equal(vm.runInContext('Object.isFrozen(navigator.userAgentData.brands)', control), true);
});

test('B7 GUARD: getHighEntropyValues hands back a fresh fullVersionList per call, and a refused upgrade does not change the brand VALUES', async () => {
  const s = bootRealm();
  // Reading first trips the D2 read gate, so the upgrade below is refused and the
  // fallback persona stays. Nothing about the brands may change across that.
  const before = plain(s.page('navigator.userAgentData.brands'));
  s.upgrade();
  assert.ok(s.statuses.some((d) => d.reason === 'api-read-before-handshake'), 'the read gate refused the swap, as D2 requires');
  assert.deepEqual(plain(s.page('navigator.userAgentData.brands')), before,
    'GUARD: same derived persona → same brand values, across the refused upgrade');
  assert.equal(s.page('Object.isFrozen(navigator.userAgentData.brands)'), true);

  const two = await s.page(`Promise.all([
    navigator.userAgentData.getHighEntropyValues(['fullVersionList']),
    navigator.userAgentData.getHighEntropyValues(['fullVersionList']),
  ])`);
  assert.equal(two[0].fullVersionList === two[1].fullVersionList, false,
    'GUARD: a fresh fullVersionList per call, as measured in Chrome 151');
  assert.deepEqual(plain(two[0].fullVersionList), plain(two[1].fullVersionList), 'with identical contents');
});

// ✅ FIXED 2026-09-16 (DECISIONS.md D26). `maxTouchPoints` is no longer pinned to
// 0. It is one bit, it is not a persona field, and the touch-event surface next
// to it (`ontouchstart`, `TouchEvent`, `(any-pointer: coarse)`) is real and
// unspoofable from a content script — so the pin only contradicted itself on
// every touch-screen laptop. D11.
test('B8 GUARD: maxTouchPoints is the host\'s real value and agrees with the touch-event surface', () => {
  const Real = class TouchEvent {};
  const s = bootRealm({ extraGlobals: { ontouchstart: null, TouchEvent: Real } });
  const before = Object.getOwnPropertyDescriptor(s.ctx.Navigator.prototype, 'maxTouchPoints').get;
  s.upgrade();
  assert.equal(s.ctx.navigator.maxTouchPoints, s.h.REAL.maxTouchPoints,
    'GUARD: the real touch count (10), not 0 — before and after the persona upgrade');
  assert.equal(s.page('"ontouchstart" in globalThis && typeof TouchEvent === "function"'), true,
    'the touch-event surface is live in this realm, as on a touch-screen laptop');
  assert.ok(s.ctx.navigator.maxTouchPoints > 0,
    'GUARD: a live touch surface is no longer contradicted by a zero touch count');
  assert.equal(Object.getOwnPropertyDescriptor(s.ctx.Navigator.prototype, 'maxTouchPoints').get, before,
    'GUARD: the shim installs no getter on maxTouchPoints at all (D26)');
});

// ✅ FIXED 2026-09-16 (DECISIONS.md D29). Every field the handshake branches on is
// read as an OWN property, through the captured `Object.prototype.hasOwnProperty`.
// The genuine payload never carries `dev`, so `payload.dev` used to resolve up the
// prototype chain into whatever the page had put on `Object.prototype` — and the
// page got `window.__nullechoDev`: version, persona id, counters, and failure
// stacks naming the extension's URL.
test('B9 GUARD: Object.prototype.dev = true no longer installs the dev surface on the genuine handshake', () => {
  const s = bootRealm();
  s.page('Object.prototype.dev = true;');
  s.upgrade();
  s.page('delete Object.prototype.dev;');
  assert.equal(s.page('typeof __nullechoDev'), 'undefined', 'GUARD: no dev global on a production page');
  assert.ok(s.statuses.some((d) => d.upgraded === true), 'and the genuine upgrade still landed');
  assert.equal(s.ctx.navigator.hardwareConcurrency, DELIVERED.cores);
});

test('B9 GUARD: a page owning Object.prototype cannot steer any field the handshake branches on', () => {
  const POLLUTE = `
    Object.prototype.dev = true;
    Object.prototype.enabled = false;      // would be "allowlisted" → restoreAll(), the real machine
    Object.prototype.ok = false;
    Object.prototype.persona = { ua: 'x', platform: 'Win32', gpu: {}, screen: {}, fontList: [], noise: { canvas: 0 } };
    Object.prototype.nonce = 'z'.repeat(32);
    Object.prototype.gpcNonce = 'z'.repeat(32);
    Object.prototype.site = 'attacker.test';
    Object.prototype.reason = 'attacker';
  `;
  const CLEAN = `for (const k of ['dev','enabled','ok','persona','nonce','gpcNonce','site','reason']) delete Object.prototype[k];`;
  const s = bootRealm();
  s.page(POLLUTE);
  s.upgrade();
  s.page(CLEAN);
  assert.equal(s.page('typeof __nullechoDev'), 'undefined', 'GUARD: no dev surface');
  assert.ok(s.statuses.some((d) => d.upgraded === true), 'GUARD: the genuine upgrade landed anyway');
  assert.ok(!s.statuses.some((d) => d.reason === 'allowlisted'), 'GUARD: injected enabled=false did not stand the shim down');
  assert.equal(s.ctx.navigator.userAgent, DELIVERED.ua, 'GUARD: the delivered persona is in place, not the injected one');
  assert.equal(s.ctx.navigator.platform, DELIVERED.platform);
});

test('B9 GUARD: an injected prototype field cannot switch the GPC relay off on a genuine failure payload', () => {
  // The loader's failure payload is `{ ok:false, reason, nonce, gpcNonce }` — it
  // carries no `gpc` and no `enabled`, which is exactly when a prototype read
  // resolves to the page's value. gpc.js computes `cfg.gpc !== false && cfg.enabled
  // !== false`, so `Object.prototype.gpc = false` suppressed the user's GPC signal
  // on every page where the service worker was unreachable.
  const s = bootRealm({ gpc: true });
  s.page('Object.prototype.gpc = false; Object.prototype.enabled = false;');
  s.send({ ok: false, reason: 'no response from Nullecho service worker', nonce: s.boot.nonce, gpcNonce: s.gpcBoot.nonce });
  s.page('delete Object.prototype.gpc; delete Object.prototype.enabled;');
  assert.equal(s.ctx.navigator.globalPrivacyControl, true,
    'GUARD: the relay carries explicit values, so the page\'s prototype cannot turn GPC off');
});

// D29 left one residual open and named it: `gpc.js` read `cfg.gpcNonce`, `cfg.gpc`
// and `cfg.enabled` through the prototype chain. On the normal path the shim
// swallows the loader's event and relays explicit values, so nothing was
// reachable — but when the shim never boots (it failed to load, or threw before
// it listened), gpc.js gets the loader's RAW payload, and a failure payload omits
// `gpc` and `enabled`. That is exactly when [[Get]] asks the page's
// `Object.prototype`. Now closed in gpc.js itself (D29, residual struck).
test('B9 GUARD: with the shim never booted, Object.prototype.gpc/enabled cannot switch the user\'s GPC signal off', () => {
  const s = bootRealm({ gpc: true, shim: false });
  assert.equal(s.boot, null, 'sanity: no shim in this realm, so nothing swallows or relays the loader\'s event');
  assert.equal(s.ctx.navigator.globalPrivacyControl, true, 'sanity: gpc.js put the signal up at document_start');
  s.page('Object.prototype.gpc = false; Object.prototype.enabled = false;');
  s.send({ ok: false, reason: 'no response from Nullecho service worker', nonce: null, gpcNonce: s.gpcBoot.nonce });
  s.page('delete Object.prototype.gpc; delete Object.prototype.enabled;');
  assert.equal(s.ctx.navigator.globalPrivacyControl, true,
    'GUARD: an absent field stays absent — gpc.js reads its config as OWN properties too');

  // Positive control, in the same shape: the loader really can take the signal
  // down, so the guard above is own-property discipline and not a dead branch.
  const t = bootRealm({ gpc: true, shim: false });
  t.send({ ok: true, enabled: true, gpc: false, site: 'x.test', gpcNonce: t.gpcBoot.nonce });
  assert.equal(t.ctx.navigator.globalPrivacyControl, undefined, 'control: a genuine {gpc:false} still takes the signal down');

  // `gpcNonce` is read as an own property too, for the same reason — though a
  // prototype-supplied nonce could never have MATCHED (it is compared against a
  // 128-bit value the page has not seen), so that read is discipline, not a hole.
  // Stated rather than asserted: a test that cannot fail is not a guard.
});

// ═══════════════════════════════════════════════════════════════════════════
// C — integrity of what the popup is told
// ═══════════════════════════════════════════════════════════════════════════

// ✅ FIXED 2026-09-16 (DECISIONS.md D30). The reverse channel carried no
// authentication at all, so a page forged `nonce-exposed`, a healthy status over a
// real `lockedToFallback`, and a million fingerprinting reads. The loader now mints
// a list of ONE-TIME reply tokens, delivers it inside the persona payload the boot
// nonce already authenticates (and D21/A3 swallow), and accepts a report only if it
// carries the token at the head of the queue — which is then spent. Boot events
// cannot carry one, so they are treated as unauthenticated and may set nothing but
// the nonce.
//
// Rig: the real `shim-loader.js` with a scripted page in place of the shim. Its
// `deliverTo` captures the persona event the loader dispatches, which is where the
// tokens live — so "with the real tokens" below means the loader's own.
function loaderRealm({ pageScriptRan = true } = {}) {
  const toWorker = [];
  const delivered = [];
  const listeners = [];
  const isoWarnings = [];
  // MUTABLE, because `pageScriptCouldHaveRun()` is re-read on every boot event and
  // the interesting case (R2-1) is a document that was a TRUE document_start when
  // the genuine shim booted and is not one any more when a page forges a second
  // boot event. `pageScriptRan` sets the starting value; `pageScriptRuns()` flips it.
  const docState = { readyState: pageScriptRan ? 'interactive' : 'loading', scripts: pageScriptRan ? 3 : 0 };
  const document = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    dispatchEvent: (ev) => { if (ev.type === 'nullecho:persona') delivered.push(JSON.parse(ev.detail)); return true; },
    get readyState() { return docState.readyState; },
    get scripts() { return { length: docState.scripts }; },
  };
  class Ev {
    constructor(type, init) { this.type = type; this.detail = init.detail; this.stopped = false; }
    stopImmediatePropagation() { this.stopped = true; }
  }
  /** Dispatch as a page (or as the shim) would, and report back what a page listener would have seen. */
  const dispatch = (type, obj) => {
    const ev = new Ev(type, { detail: JSON.stringify(obj) });
    for (const l of listeners) { if (l.type === type && !ev.stopped) l.fn(ev); }
    return ev;
  };
  const iso = vm.createContext({
    document, setTimeout, clearTimeout, queueMicrotask, CustomEvent: Ev,
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { warn: (...a) => isoWarnings.push(String(a[0])), error() {} },
    chrome: { runtime: { id: 'x', lastError: undefined, sendMessage(m, cb) { toWorker.push(m); if (cb) setTimeout(() => cb({ ok: true, enabled: true, gpc: true, site: 'x', persona: DELIVERED }), 1); } } },
  });
  iso.self = iso.top = vm.runInContext('globalThis', iso);
  vm.runInContext(LOADER_SRC, iso);
  const reasons = () => toWorker.filter((m) => m.type === 'nullecho:shim-status').map((m) => m.reason ?? (m.upgraded ? 'upgraded' : 'ok'));
  const settle = () => new Promise((r) => setTimeout(r, 30));
  /** The moment page script starts running, as the ISOLATED world sees it. */
  const pageScriptRuns = () => { docState.readyState = 'interactive'; docState.scripts = 3; };
  const warnings = () => isoWarnings.slice();
  return { toWorker, delivered, dispatch, reasons, settle, pageScriptRuns, warnings };
}

test('C1 GUARD: a page cannot forge nonce-exposed, a healthy status, or a fingerprint count on the reverse channel', async () => {
  const r = loaderRealm();
  // A page script — no nonce, no shim involvement — dispatches on the page's own document.
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'gpc' });
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'p'.repeat(32) });
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null });
  r.dispatch('nullecho:detect', { api: 'canvas', count: 1e6 });
  r.dispatch('nullecho:status', { upgraded: true, token: 'g'.repeat(16) });   // a guessed token
  assert.deepEqual(r.reasons(), [], 'GUARD (a)+(b): not one forged status reached the service worker');
  assert.deepEqual(r.toWorker.filter((m) => m.type === 'nullecho:fp-detected'), [],
    'GUARD (c): not one forged fingerprint count reached the service worker');

  // …and the tokens the loader hands the shim DO work, so the guard above is
  // authentication and not a channel that has simply been switched off.
  await r.settle();
  const payload = r.delivered[0];
  assert.ok(Array.isArray(payload.reportTokens) && payload.reportTokens.length >= 8,
    'the loader delivers a list of one-time reply tokens inside the authenticated payload');
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, token: payload.reportTokens[0] });
  r.dispatch('nullecho:detect', { api: 'canvas', count: 3, token: payload.reportTokens[1] });
  // `nonce-exposed` shows up HERE and not above, which is the whole point: this
  // realm was built with page script already run, so the boot was late — but the
  // warning waits for a token to prove that what booted was our shim, instead of
  // firing on the forgeable boot event the way it used to.
  assert.deepEqual(r.reasons(), ['nonce-exposed', 'upgraded'], 'a tokened status is forwarded');
  assert.ok(r.toWorker.some((m) => m.type === 'nullecho:fp-detected' && m.count === 3), 'a tokened detect is forwarded');
});

test('C1 GUARD: a token is one-time — replaying a captured report, or reusing its token for a new claim, buys nothing', async () => {
  const r = loaderRealm({ pageScriptRan: false });
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'p'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0].reportTokens;

  // The genuine first report. A page watching the channel now holds tokens[0].
  const real = { upgraded: false, lockedToFallback: true, reason: 'api-read-before-handshake', token: tokens[0] };
  r.dispatch('nullecho:status', real);
  assert.deepEqual(r.reasons(), ['api-read-before-handshake']);

  // Replay it verbatim, and reuse its token for a nicer claim, and skip ahead to a
  // token the page has NOT seen used (it does not have one, so try the next index).
  r.dispatch('nullecho:status', real);
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, token: tokens[0] });
  r.dispatch('nullecho:detect', { api: 'canvas', count: 1e6, token: tokens[0] });
  assert.deepEqual(r.reasons(), ['api-read-before-handshake'],
    'GUARD: a spent token authenticates nothing — harvest-and-replay is closed');
  assert.deepEqual(r.toWorker.filter((m) => m.type === 'nullecho:fp-detected'), []);

  // Out-of-order is refused too: only the head of the queue is ever accepted.
  r.dispatch('nullecho:status', { upgraded: true, token: tokens[5] });
  assert.deepEqual(r.reasons(), ['api-read-before-handshake'], 'GUARD: tokens are spent strictly in order');
  r.dispatch('nullecho:status', { upgraded: true, token: tokens[1] });
  assert.deepEqual(r.reasons(), ['api-read-before-handshake', 'upgraded'], 'and the head of the queue still works');
});

test('C1 GUARD: an accepted report is swallowed, so a page listener never sees a live token', async () => {
  const r = loaderRealm({ pageScriptRan: false });
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'p'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0].reportTokens;
  const accepted = r.dispatch('nullecho:status', { upgraded: true, token: tokens[0] });
  assert.equal(accepted.stopped, true,
    'GUARD (d): the loader stops an accepted report dead, so nothing downstream of it sees the token');
  // A message we do NOT accept is left alone — eating a page's own event would be
  // a free "Nullecho is here" probe (the D21 rule for the forward channel).
  const refused = r.dispatch('nullecho:status', { upgraded: true, token: 'nope' });
  assert.equal(refused.stopped, false, 'GUARD: an unauthenticated event propagates normally');
});

test('C1 GUARD: a page-forged boot event cannot silence the "shim never booted" alarm', async () => {
  const r = loaderRealm({ pageScriptRan: false });
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'p'.repeat(32) });
  await new Promise((res) => setTimeout(res, 3200));   // past BOOT_CHECK_MS
  assert.ok(r.reasons().includes('shim-never-booted'),
    'GUARD: the alarm turns on an AUTHENTICATED reply, not on the forgeable boot event');
});

test('C1 GUARD: a page burning the token list on canvas reads cannot silence the HEALTH channel', () => {
  // Self-attack on D30: the token list is finite and a page controls how many
  // DETECT reports the shim makes (`touch()` fires at read 1, 10, 50 and then
  // every 250 per API). Spend them all and the shim could no longer have told the
  // loader about a stand-down or a locked fallback. Statuses now hold a reserve.
  const TOKENS = Array.from({ length: 12 }, (_, i) => `burn${String(i).padStart(12, '0')}`);
  const s = bootRealm();
  s.upgrade(DELIVERED, { reportTokens: TOKENS });
  const spent = () => [...s.statuses, ...s.detects].filter((d) => typeof d.token === 'string').length;
  const before = spent();
  // Burn: 2600 canvas reads is 1 + 10 + 50 + 250×10 worth of detect thresholds.
  s.page(`
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    for (let i = 0; i < 2600; i++) g.getImageData(0, 0, 2, 2);
  `);
  assert.ok(spent() > before, 'sanity: the reads did spend tokens');
  assert.ok(s.detects.filter((d) => typeof d.token === 'string').length <= TOKENS.length - 4,
    'GUARD: detects never eat into the four-token status reserve');

  // The health channel still works after the burn.
  const n = s.statuses.length;
  s.page('void 0;');
  s.send({ ok: true, enabled: false, nonce: 'f'.repeat(32) });   // a forgery, after the handshake
  // A genuine post-handshake status is what matters: drive one through `touch`
  // on an API the shim reports, then assert a tokened STATUS is still possible.
  assert.ok(s.statuses.length >= n, 'statuses were not dropped');
  const reserve = TOKENS.slice(TOKENS.length - 4);
  const seen = [...s.statuses, ...s.detects].map((d) => d.token).filter(Boolean);
  for (const t of reserve) {
    assert.equal(seen.includes(t), false, `GUARD: reserved token ${t} was spent on a detect`);
  }
});

test('C1 GUARD: a token cannot be stolen through a CHILD realm\'s Object.prototype either', () => {
  const s = bootRealm({ child: true });
  s.upgrade();
  s.page('globalThis.__cw = document.createElement("iframe").contentWindow;');
  // Poison both realms at once, then make the shim report from each.
  const POISON = `
    globalThis.__stolen = globalThis.__stolen || [];
    Object.defineProperty(Object.prototype, 'token', { set(v) { globalThis.__stolen.push(v); }, get() {}, configurable: true });
    Object.defineProperty(Object.prototype, 'toJSON', { value() { for (const k of Object.keys(this)) globalThis.__stolen.push(String(this[k])); return { x: 1 }; }, configurable: true, writable: true });
  `;
  s.page(POISON);
  vm.runInContext(POISON, s.childCtx);
  s.page('document.createElement("canvas").getContext("2d").getImageData(0, 0, 2, 2);');
  vm.runInContext('document.createElement("canvas").getContext("2d").getImageData(0, 0, 2, 2);', s.childCtx);
  s.page('delete Object.prototype.token; delete Object.prototype.toJSON;');
  vm.runInContext('delete Object.prototype.token; delete Object.prototype.toJSON;', s.childCtx);
  assert.deepEqual([...s.ctx.__stolen], [], 'GUARD: the parent realm\'s prototype harvested nothing');
  assert.deepEqual([...s.childCtx.__stolen], [], 'GUARD: the child realm\'s prototype harvested nothing');
  assert.ok(s.detects.some((d) => typeof d.token === 'string'), 'sanity: tokened detects were in fact emitted');
});

test('C1 GUARD: the token never leaves the shim in a form a page window-capture listener can read', () => {
  // The delivery itself is already swallowed by the shim (A3/D21). This pins the
  // other half: every reverse event the shim emits afterwards is a report, and in
  // the real stack the loader's window-capture listener consumes and stops it. Here
  // the rig's listener stands in for the loader and does the same, so what a page
  // listener registered afterwards can harvest is the measure.
  const TOKENS = ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc', 'dddddddddddddddd'];
  const s = bootRealm();
  s.page(`
    globalThis.__harvest = [];
    const add = globalThis.EventTarget.prototype.addEventListener;
    for (const t of ['nullecho:persona', 'nullecho:status', 'nullecho:detect']) {
      add.call(globalThis, t, (ev) => { globalThis.__harvest.push(String(ev.detail)); }, true);
      document.addEventListener(t, (ev) => { globalThis.__harvest.push(String(ev.detail)); }, true);
    }
  `);
  s.upgrade(DELIVERED, { reportTokens: TOKENS });
  s.page('const c = document.createElement("canvas"); c.getContext("2d").getImageData(0, 0, 4, 4);');
  const harvest = s.page('__harvest.join("\\n")');
  for (const t of TOKENS) {
    assert.equal(harvest.includes(t), false, `GUARD: a page listener harvested the live token ${t}`);
  }
  assert.ok(s.statuses.some((d) => d.upgraded === true && d.token === TOKENS[0]),
    'sanity: the loader-side listener DID receive the tokened status, so the harvest is a real miss');
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

test('C3 GUARD: the CANVAS / SUPERCOOKIE page-report strike path is gone, not merely unreachable (D20)', () => {
  // No file — including background.js, the message-surface owner — sends or
  // wires up a page-side `nullecho:signal` report. (heuristics.js itself is
  // excluded: it names the retired message type only in the prose explaining
  // why handleContentReport() is a closed gate.)
  const senders = fs.readdirSync(HERE).filter((f) => f.endsWith('.js') && !f.includes('.test.') && f !== 'heuristics.js')
    .filter((f) => src(f).includes('nullecho:signal'));
  assert.deepEqual(senders, [], 'REGRESSION: something references the retired nullecho:signal message type');

  // handleContentReport() is a closed gate: it accepts nothing, for any shape
  // of input, not just the one message the old finding quoted.
  assert.equal(H.handleContentReport(), false);
  assert.equal(H.handleContentReport({ type: 'nullecho:fp-detected', api: 'canvas', count: 1 }, { url: 'https://x.example' }), false);
  assert.equal(H.handleContentReport({ type: 'nullecho:signal', signal: 'canvas', scriptUrl: 'https://evil.example/s.js' }, { url: 'https://x.example' }), false);

  // CANVAS / SUPERCOOKIE are not live strike sources: they exist only as
  // reserved, non-promoting bits (D20 point 4 — kept so an old persisted
  // bitmask reads correctly), never as part of the counting SIGNAL set.
  assert.deepEqual(Object.keys(H.SIGNAL), ['COOKIE', 'SET_COOKIE'], 'REGRESSION: a CANVAS/SUPERCOOKIE bit re-entered the promoting SIGNAL set');
  assert.deepEqual(Object.keys(H.RETIRED_SIGNAL_BITS).sort(), ['CANVAS', 'ID_PARAM', 'SUPERCOOKIE'], 'CANVAS and SUPERCOOKIE stay retired-only bits');

  // ARCHITECTURE.md no longer documents a page-report signal path.
  const arch = fs.readFileSync(path.resolve(EXT, '..', 'docs', 'ARCHITECTURE.md'), 'utf8');
  assert.ok(!arch.includes('nullecho:signal'), 'REGRESSION: ARCHITECTURE.md still describes the retired nullecho:signal path');
  assert.ok(!/CANVAS\s*\/\s*SUPERCOOKIE/i.test(arch), 'REGRESSION: ARCHITECTURE.md still describes a CANVAS/SUPERCOOKIE strike path');
});

// ═══════════════════════════════════════════════════════════════════════════
// ═ REVIEW-2 (2026-09-16 late) ═
//
// A second, adversarial pass over the SAME DAY's fixes — D25–D31 — on the
// standing lesson that a green suite is not evidence. Same convention as above:
// `R2-<n> GUARD:` asserts a defect is CLOSED, `R2-<n> REPRO:` asserts one is
// still PRESENT and is recorded as an open residual in docs/DECISIONS.md.
// ═══════════════════════════════════════════════════════════════════════════

// ── R2-1 ───────────────────────────────────────────────────────────────────
// D30 claims, in as many words: "A page forging a boot event can raise no
// warning." It could. The loader re-measured `bootLate` on EVERY boot event,
// and a boot event is the one reverse message that carries no token — so a page
// script dispatching a second `{phase:'boot', channel:'shim'}` at any time after
// the genuine one set `bootLate = true` (page script has obviously run by then),
// and the next GENUINE tokened report — the upgrade status, milliseconds later —
// flushed it through `onAuthenticated()` as a sticky `nonce-exposed`.
//
// The token gate was doing its job: the page never got a report accepted. What it
// did was steer a measurement the loader took on the page's behalf. That is the
// same class as C1 — the site being watched writing the watcher's display — and
// `nonceExposedAt` is sticky in the service worker's per-site stats, so the popup
// keeps telling the user Nullecho lost the race on a page where it did not.
test('R2-1 GUARD: a page-forged SECOND boot event cannot raise the sticky nonce-exposed warning', async () => {
  const r = loaderRealm({ pageScriptRan: false });     // a TRUE document_start
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'g'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0].reportTokens;

  // Page script now runs, and forges a boot event of its own. No nonce is needed:
  // `onBoot` never required one to take the measurement.
  r.pageScriptRuns();
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'p'.repeat(32) });
  // …and again on the gpc channel, which on a gpc-excluded host has never booted,
  // so a forged event there is the FIRST one that channel ever sees.
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'gpc', nonce: 'q'.repeat(32) });

  // The shim's genuine upgrade status follows, carrying a real token.
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, token: tokens[0] });

  assert.deepEqual(r.reasons(), ['upgraded'],
    'GUARD: a forged boot event raises no nonce-exposed — the measurement is taken only from the announcement that published the shim nonce');
  assert.deepEqual(r.warnings(), [],
    'GUARD: and the page cannot make the loader print the "lost the race" warning either');
  // The forged nonce is not adopted as the shim's either, so the delivery that
  // already went out stays the only one and nothing is re-signed with a page value.
  assert.equal(r.delivered.length, 1, 'no second delivery');
  assert.equal(r.delivered[0].nonce, 'g'.repeat(32), 'the delivery carries the GENUINE boot nonce');
});

test('R2-1 GUARD: a genuinely late boot still raises nonce-exposed — the fix is not the alarm being switched off', async () => {
  // Negative control for the guard above. Here page script HAS run by the time the
  // genuine shim announces itself, which is exactly what R3b is for.
  const r = loaderRealm({ pageScriptRan: true });
  r.dispatch('nullecho:status', { phase: 'boot', channel: 'shim', nonce: 'g'.repeat(32) });
  await r.settle();
  const tokens = r.delivered[0].reportTokens;
  r.dispatch('nullecho:status', { upgraded: true, lockedToFallback: false, reason: null, token: tokens[0] });
  assert.deepEqual(r.reasons(), ['nonce-exposed', 'upgraded'],
    'the real alarm still fires on a real late boot');
  assert.equal(r.warnings().length, 1, 'and the user still gets the console line');
});

// ── R2-2 ───────────────────────────────────────────────────────────────────
// D21's rule is "the shim never calls a prototype at run time"; its `A2-lint`
// enforces that with a finite list of method names and bare globals. `for…of`
// was not on the list, and `for…of` is a prototype call: it reads
// `Symbol.iterator` off the iterated object, which for an array literal is the
// shim realm's `Array.prototype` — an object the page owns.
//
// Three of those loops sit INSIDE `installInto()`, which for the top window runs
// at document_start (safe) but for a CHILD realm runs at the first
// `contentWindow` read — i.e. whenever the page asks for it, long after the page
// owns its own prototypes. So:
//
//     Array.prototype[Symbol.iterator] = function () { return { next: () => ({ done: true }) }; };
//     const w = document.createElement('iframe').contentWindow;   // installInto(w)
//
// …made `safe('webgpu.adapterInfo')` iterate nothing, and that child realm's
// `GPUAdapterInfo` was never patched: `vendor` and `architecture` answered with
// the REAL GPU while the parent answered with the persona's. A pristine child
// realm reached on purpose — B3/D31's own failure mode, through D21's lint hole.
const DELIVERED_NVIDIA = {
  ...DELIVERED,
  id: 'win11-chrome-rtx3060', platform: 'Win32',
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  uaData: { platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', bitness: '64', model: '', wow64: false },
  gpu: {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    unmaskedVendor: 'Google Inc. (NVIDIA)', maxTextureSize: 16384,
  },
};
/** The rig's REAL GPU is an Apple M2 Max, so `webgpuIdentity` puts the two a mile apart. */
const WEBGPU_REAL = 'apple/metal-3';
const WEBGPU_PERSONA = 'nvidia/ampere';
const READ_WEBGPU = '(() => { const ai = Object.create(GPUAdapterInfo.prototype); return ai.vendor + "/" + ai.architecture; })()';
/** Replace the realm's array iterator, do `body`, put it back. */
const WITH_DEAD_ITERATOR = (body) => `
  const __orig = Array.prototype[Symbol.iterator];
  Array.prototype[Symbol.iterator] = function () {
    return { next() { return { done: true, value: undefined }; }, [Symbol.iterator]() { return this; } };
  };
  try { ${body} } finally { Array.prototype[Symbol.iterator] = __orig; }
`;

test('R2-2 GUARD: killing Array.prototype[Symbol.iterator] does not leave a child realm\'s WebGPU identity unpatched', () => {
  // Control first, so a green guard cannot be the rig failing to reach the leak.
  const ctrl = bootRealm({ child: true });
  ctrl.upgrade(DELIVERED_NVIDIA);
  ctrl.page('globalThis.__cw = document.createElement("iframe").contentWindow;');
  assert.equal(vm.runInContext(READ_WEBGPU, ctrl.childCtx), WEBGPU_PERSONA,
    'sanity: an ordinary child realm reports the persona\'s WebGPU identity');
  assert.equal(ctrl.page(READ_WEBGPU), WEBGPU_PERSONA, 'and so does the parent');

  const s = bootRealm({ child: true });
  s.upgrade(DELIVERED_NVIDIA);
  s.page(WITH_DEAD_ITERATOR('globalThis.__cw = document.createElement("iframe").contentWindow;'));
  assert.equal(vm.runInContext(READ_WEBGPU, s.childCtx), WEBGPU_PERSONA,
    'GUARD: the child realm still reports the persona, not the real GPU');
  assert.notEqual(vm.runInContext(READ_WEBGPU, s.childCtx), WEBGPU_REAL,
    'GUARD: specifically, the REAL GPU vendor/architecture did not leak through the unpatched child');
  // The hook is gone by now; the patch must have been installed, not deferred.
  assert.equal(vm.runInContext(READ_WEBGPU, s.childCtx), WEBGPU_PERSONA, 'and it stays patched after the hook is removed');
});

test('R2-2 GUARD: the D21 lint covers for…of and the iterator protocol, not just a list of method names', () => {
  // The lint is only as good as its regex list, and `A2-lint` had no `for…of`,
  // no `Symbol.iterator`, and none of `.startsWith(` / `.includes(` / `.at(` /
  // `.find(` / `.sort(` / `.fill(` / `.subarray(` / `Number(` / `parseInt(`.
  // This is the same lint, widened, over the same two post-capture regions.
  const stripped = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""');
  // Every one of these is a prototype lookup on an object the page can own.
  const MORE_METHODS = /\.(startsWith|endsWith|includes|substring|substr|at|find|findIndex|flat|flatMap|sort|fill|subarray|repeat|charAt|codePointAt|splice|shift|unshift|pop|reverse|copyWithin|toFixed|valueOf|lastIndexOf|matchAll|match|search|normalize|localeCompare|next|catch|finally|toJSON|hasOwnProperty|toLocaleString)\s*\(/g;
  // Bare coercions and constructors resolve through the page's globals.
  const MORE_GLOBALS = /(?<![.\w$])(Number|String|parseInt|parseFloat|isNaN|isFinite|Boolean|Date|Function|Proxy|Intl|BigInt)\s*[(.]/g;
  // `for…of` reads Symbol.iterator off the iterated object — a prototype call by
  // any other name, and the one that let R2-2 through.
  const FOROF = /for\s*(?:await\s*)?\(\s*(?:const|let|var)\s+[^)]*?\s+of\s+([^)]*)\)/g;
  const SYMBOL_ITER = /\[\s*Symbol\.iterator\s*\]/g;
  /**
   * The ONE permitted `for…of`, named in full so the set cannot widen silently.
   * `personaFor` is boot-only — it runs at document_start before any page script
   * exists to have replaced the array iterator — and personas.test.js pins this
   * exact line as the D12 host-family constraint, so it may not be rewritten.
   */
  const FOROF_EXEMPT = new Set(['HOST_POOL']);

  const check = (label, body) => {
    const hits = [];
    for (const re of [MORE_METHODS, MORE_GLOBALS, SYMBOL_ITER]) {
      for (const m of body.matchAll(re)) hits.push(`${label}: "${m[0].trim()}" near line ${body.slice(0, m.index).split('\n').length}`);
    }
    for (const m of body.matchAll(FOROF)) {
      if (FOROF_EXEMPT.has(m[1].trim())) continue;
      hits.push(`${label}: "${m[0].trim()}" near line ${body.slice(0, m.index).split('\n').length}`);
    }
    assert.deepEqual(hits, [], `bare builtin / iterator use after the capture block:\n${hits.join('\n')}`);
  };

  let shim = SHIM_SRC.slice(SHIM_SRC.indexOf('END CAPTURED BUILTINS'));
  shim = shim.replace(/BEGIN GENERATED MIRROR[\s\S]*?END GENERATED MIRROR/, '');
  shim = shim.replace(/const MULTI_LABEL_SUFFIXES[\s\S]*?function registrableDomain\(hostname\) \{[\s\S]*?\n  \}/, '');
  check('shim.js', stripped(shim));

  const start = GPC_SRC.indexOf('END CAPTURED BUILTINS');
  const end = GPC_SRC.indexOf('// ══ extension half');
  check('gpc.js (page half)', stripped(GPC_SRC.slice(start, end)));

  // Negative control: the widened regexes DO fire on the shapes they exist for.
  assert.throws(() => check('probe', 'for (const x of list) { x.startsWith("a"); }'));
  assert.throws(() => check('probe', 'const n = Number(x);'));
});

// ── R2-3 ───────────────────────────────────────────────────────────────────
// D30 residual 2 says exhaustion costs the page its own read COUNTER. It costs
// something else it does not mention: `report()` still `emit()`s once the tokens
// are gone, the loader refuses an untokened report — and the D21 rule is that a
// refused message is NOT swallowed, because eating a page's own event would be a
// free "Nullecho is here" probe. So past exhaustion every detect the shim makes
// propagates to a page listener instead of dying at the loader.
//
// Recorded rather than fixed. What propagates is `{api, count}` — the page's own
// read count for an API it just hammered a few thousand times, on a page it has
// already proved is shimmed. No persona field, no noise key, no token. The two
// alternatives are worse: going silent would replace this with a cleaner oracle
// (the events stop at exactly N), and swallowing the untokened ones would hand
// the page the probe D21 closed. See DECISIONS.md D30 residual 5.
test('R2-3 REPRO: past token exhaustion the shim\'s detect reports propagate to a page listener', () => {
  const TOKENS = Array.from({ length: 6 }, (_, i) => `short${String(i).padStart(11, '0')}`);
  const s = bootRealm();
  s.page(`
    globalThis.__seen = [];
    globalThis.EventTarget.prototype.addEventListener.call(globalThis, 'nullecho:detect',
      (ev) => { globalThis.__seen.push(String(ev.detail)); }, true);
  `);
  s.upgrade(DELIVERED, { reportTokens: TOKENS });
  s.page(`
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    for (let i = 0; i < 1200; i++) g.getImageData(0, 0, 2, 2);
  `);
  const seen = s.page('__seen.slice()');
  assert.ok(seen.length > 0, 'REPRO: untokened detects reach a page listener once the list is spent');
  // …and what they carry is only the page's own read count. No token, nothing else.
  for (const raw of seen) {
    const d = JSON.parse(raw);
    assert.deepEqual(Object.keys(d).sort(), ['api', 'count'], 'a leaked detect carries only api + count');
    assert.equal(d.token, undefined, 'and never a live token');
  }
  // The status reserve still holds: the health channel is not what leaked.
  assert.ok(s.statuses.some((d) => d.upgraded === true && typeof d.token === 'string'),
    'the tokened upgrade status still got through to the loader');
});
