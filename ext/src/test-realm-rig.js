/**
 * Shared unit rig: a page realm whose DOM brand-checks like Chrome's, the real
 * `shim.js` booted inside it (`bootRealm`), and the real `shim-loader.js` in a
 * scripted isolated world (`loaderRealm`). Extracted 2026-09-20 from
 * claim-verification-2026-09-17.test.js so a regression test is a dozen lines,
 * not a copy of three hundred. `NULLECHO_SHIM_SRC` / `NULLECHO_LOADER_SRC`
 * point the rig at another build (e.g. `git show HEAD:ext/src/shim.js`) to
 * prove a new test fails on the code it was written against.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM_SRC = fs.readFileSync(process.env.NULLECHO_SHIM_SRC || path.join(HERE, 'shim.js'), 'utf8');
const LOADER_SRC = fs.readFileSync(process.env.NULLECHO_LOADER_SRC || path.join(HERE, 'shim-loader.js'), 'utf8');

const DELIVERED = {
  id: 'win11-chrome-rtx3060', platform: 'Win32',
  ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  uaData: { platform: 'Windows', platformVersion: '15.0.0', architecture: 'x86', bitness: '64', model: '', wow64: false },
  gpu: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', unmaskedVendor: 'Google Inc. (NVIDIA)', maxTextureSize: 16384 },
  cores: 12, memory: 16,
  screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
  fontList: ['Arial'], noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 0x1234abcd,
};
const RIG_TOKENS = Array.from({ length: 32 }, (_, i) => `rigtoken${String(i).padStart(8, '0')}`);

// ═══════════════════════════════════════════════════════════════════════════
// A page realm whose DOM brand-checks like Chrome's
// ═══════════════════════════════════════════════════════════════════════════

const DOM_SETUP = `
(() => {
  const listeners = new WeakMap();
  const listenersFor = (t) => { let l = listeners.get(t); if (!l) { l = []; listeners.set(t, l); } return l; };
  // A WebIDL accessor/method called on the wrong receiver throws exactly this.
  const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };
  // A prototype accessor, brand-checked, backed by a private slot — the shape of
  // every DOM attribute the shim reads through a captured getter.
  const slots = new WeakMap();
  const slot = (o) => { let s = slots.get(o); if (!s) { s = {}; slots.set(o, s); } return s; };
  const attr = (C, name, init) => Object.defineProperty(C.prototype, name, {
    get() { brand(this, C); const s = slot(this); return name in s ? s[name] : init; },
    set(v) { brand(this, C); slot(this)[name] = v; },
    configurable: true, enumerable: true,
  });
  const ro = (C, name, read) => Object.defineProperty(C.prototype, name, {
    get() { brand(this, C); return read(this); }, configurable: true, enumerable: true,
  });

  class EventTarget {
    addEventListener(type, fn, capture) { listenersFor(this).push({ type, fn, capture: !!capture }); }
    removeEventListener(type, fn, capture) {
      const l = listenersFor(this);
      const i = l.findIndex((x) => x.type === type && x.fn === fn && x.capture === !!capture);
      if (i >= 0) l.splice(i, 1);
    }
    dispatchEvent(ev) {
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
  Object.defineProperty(CustomEvent.prototype, 'detail', { get() { return this._detail; }, configurable: true, enumerable: true });

  class Navigator {}
  ro(Navigator, 'userAgent', () => 'Mozilla/5.0 (REAL MACHINE)');
  ro(Navigator, 'appVersion', () => '5.0 (REAL MACHINE)');
  ro(Navigator, 'platform', () => 'MacIntel');
  ro(Navigator, 'hardwareConcurrency', () => 12);
  ro(Navigator, 'vendor', () => 'Google Inc.');
  const navigator = Object.create(Navigator.prototype);

  class Node extends EventTarget {}
  ro(Node, 'nodeType', () => 1);
  ro(Node, 'textContent', () => '');
  class Element extends Node { getBoundingClientRect() { brand(this, Element); return { x: 0, y: 0, width: 100, height: 20 }; } }
  class HTMLElement extends Element {}
  ro(HTMLElement, 'offsetWidth', () => 100);
  ro(HTMLElement, 'offsetHeight', () => 20);
  class HTMLIFrameElement extends HTMLElement {}
  ro(HTMLIFrameElement, 'contentWindow', () => null);
  class MutationObserver { observe() {} disconnect() {} }
  const getComputedStyle = () => ({ fontFamily: '', fontSize: '', fontWeight: '', fontStyle: '', letterSpacing: '' });

  // ── ImageData / TextMetrics: accessors, like the real ones ──────────────
  class ImageData {
    constructor(w, h) { slot(this).width = w; slot(this).height = h; slot(this).data = new Uint8ClampedArray(w * h * 4); }
  }
  ro(ImageData, 'width', (o) => slot(o).width);
  ro(ImageData, 'height', (o) => slot(o).height);
  ro(ImageData, 'data', (o) => slot(o).data);
  class TextMetrics { constructor(w) { slot(this).width = w; } }
  ro(TextMetrics, 'width', (o) => slot(o).width);

  // ── the 2D context, on-screen and offscreen ─────────────────────────────
  function contextClass(CanvasCtor) {
    class Ctx {
      constructor(canvas) { slot(this).canvas = canvas; slot(this).buf = new Uint8ClampedArray(canvas.width * canvas.height * 4); }
      fillRect(x, y, w, h) {
        brand(this, Ctx);
        const b = slot(this).buf, W = slot(this).canvas.width;
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
          const p = (yy * W + xx) * 4; b[p] = 90; b[p + 1] = 120; b[p + 2] = 150; b[p + 3] = 255;
        }
      }
      getImageData(sx, sy, sw, sh) {
        brand(this, Ctx);
        if (arguments.length < 4) throw new TypeError("Failed to execute 'getImageData' on '" + Ctx.name + "': 4 arguments required, but only " + arguments.length + ' present.');
        const b = slot(this).buf, W = slot(this).canvas.width, out = new ImageData(sw, sh), d = out.data;
        for (let r = 0; r < sh; r++) for (let c = 0; c < sw; c++) {
          const s = ((sy + r) * W + (sx + c)) * 4, t = (r * sw + c) * 4;
          d[t] = b[s]; d[t + 1] = b[s + 1]; d[t + 2] = b[s + 2]; d[t + 3] = b[s + 3];
        }
        return out;
      }
      putImageData(img, dx, dy) {
        brand(this, Ctx);
        const b = slot(this).buf, W = slot(this).canvas.width, d = img.data;
        for (let r = 0; r < img.height; r++) for (let c = 0; c < img.width; c++) {
          const t = ((dy + r) * W + (dx + c)) * 4, s = (r * img.width + c) * 4;
          for (let k = 0; k < 4; k++) b[t + k] = d[s + k];
        }
      }
      drawImage(src, dx, dy) {
        brand(this, Ctx);
        const sctx = slot(src).ctx; if (!sctx) return;
        const b = slot(this).buf, W = slot(this).canvas.width, sb = slot(sctx).buf, SW = src.width;
        for (let r = 0; r < src.height; r++) for (let c = 0; c < SW; c++) {
          const t = ((dy + r) * W + (dx + c)) * 4, s = (r * SW + c) * 4;
          for (let k = 0; k < 4; k++) b[t + k] = sb[s + k];
        }
      }
      measureText(text) {
        brand(this, Ctx);
        if (arguments.length < 1) throw new TypeError("Failed to execute 'measureText' on '" + Ctx.name + "': 1 argument required, but only 0 present.");
        // Width depends on the font so the shim's "claimed font" path has two distinct readings to compare.
        const font = slot(this).font || '10px sans-serif';
        return new TextMetrics(String(text).length * (/Arial/.test(font) ? 7 : 6));
      }
    }
    ro(Ctx, 'canvas', (o) => slot(o).canvas);
    attr(Ctx, 'font', '10px sans-serif');
    attr(Ctx, 'fillStyle', '#000');
    attr(Ctx, 'textBaseline', 'alphabetic');
    return Ctx;
  }
  class HTMLCanvasElement extends HTMLElement {
    getContext(kind) {
      brand(this, HTMLCanvasElement);
      // Rig hook: with \`__breakScratch\` set, a canvas that has no context YET
      // cannot get one — the page's own canvases already have theirs, so only the
      // shim's scratch copies break. A genuine run-time shim failure, on demand.
      let c = slot(this).ctx;
      if (!c) { if (globalThis.__breakScratch) throw new Error('rig: scratch canvas broken'); c = slot(this).ctx = new CanvasRenderingContext2D(this); }
      return c;
    }
    toDataURL() { brand(this, HTMLCanvasElement); const c = slot(this).ctx; return 'data:image/png;fake,' + (c ? Array.from(slot(c).buf).join(',') : ''); }
    toBlob(cb) { brand(this, HTMLCanvasElement); if (typeof cb !== 'function') throw new TypeError("Failed to execute 'toBlob' on 'HTMLCanvasElement': parameter 1 is not of type 'Function'."); cb({ size: 1 }); }
  }
  attr(HTMLCanvasElement, 'width', 300);
  attr(HTMLCanvasElement, 'height', 150);
  const CanvasRenderingContext2D = contextClass(HTMLCanvasElement);
  Object.defineProperty(CanvasRenderingContext2D, 'name', { value: 'CanvasRenderingContext2D' });

  class OffscreenCanvas {
    constructor(w, h) { slot(this).width = w; slot(this).height = h; }
    getContext(kind) { brand(this, OffscreenCanvas); let c = slot(this).ctx; if (!c) { c = slot(this).ctx = new OffscreenCanvasRenderingContext2D(this); } return c; }
    convertToBlob() { brand(this, OffscreenCanvas); return Promise.resolve({ size: 1 }); }
  }
  attr(OffscreenCanvas, 'width', 0);
  attr(OffscreenCanvas, 'height', 0);
  const OffscreenCanvasRenderingContext2D = contextClass(OffscreenCanvas);
  Object.defineProperty(OffscreenCanvasRenderingContext2D, 'name', { value: 'OffscreenCanvasRenderingContext2D' });

  // ── audio ────────────────────────────────────────────────────────────────
  class AudioBuffer {
    constructor(length, channels) {
      slot(this).length = length; slot(this).channels = [];
      for (let c = 0; c < (channels || 1); c++) { const a = new Float32Array(length); for (let i = 0; i < length; i++) a[i] = Math.sin(i / 7) * 0.5; slot(this).channels.push(a); }
    }
    getChannelData(c) {
      brand(this, AudioBuffer);
      const ch = slot(this).channels[c | 0];
      if (!ch) throw new DOMException_('channel index (' + c + ') exceeds number of channels', 'IndexSizeError');
      return ch;
    }
    copyFromChannel(dest, c, start) {
      brand(this, AudioBuffer);
      if (!(dest instanceof Float32Array)) throw new TypeError("Failed to execute 'copyFromChannel' on 'AudioBuffer': parameter 1 is not of type 'Float32Array'.");
      const ch = slot(this).channels[c | 0];
      if (!ch) throw new DOMException_('channel index (' + c + ') exceeds number of channels', 'IndexSizeError');
      dest.set(ch.subarray(start | 0, (start | 0) + dest.length));
    }
  }
  ro(AudioBuffer, 'length', (o) => slot(o).length);
  ro(AudioBuffer, 'numberOfChannels', (o) => slot(o).channels.length);
  class DOMException_ extends Error { constructor(m, name) { super(m); this.name = name; } }

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
    EventTarget, Event, CustomEvent, Navigator, navigator, Node, Element, HTMLElement, HTMLIFrameElement,
    MutationObserver, getComputedStyle, HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D,
    ImageData, TextMetrics, AudioBuffer, document,
  });
  // The natives, held before the shim runs, so "still patched" is a comparison and not a guess.
  globalThis.__natives = {
    toDataURL: HTMLCanvasElement.prototype.toDataURL,
    toBlob: HTMLCanvasElement.prototype.toBlob,
    convertToBlob: OffscreenCanvas.prototype.convertToBlob,
    copyFromChannel: AudioBuffer.prototype.copyFromChannel,
    measureText: CanvasRenderingContext2D.prototype.measureText,
  };
})();
`;

/**
 * Boot the real shim in the realm above, with a stand-in for the loader's
 * reverse-channel listener (window capture, registered first, swallowing tokened
 * reports — D30). `console` records EVERY call the shim makes to it, by method.
 */
function bootRealm({ lockToDataURL = false, syncReply = false, csprng = true } = {}) {
  const consoleCalls = [];
  const rec = (method) => (...a) => consoleCalls.push({ method, text: a.map(String).join(' ') });
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: csprng ? { getRandomValues: (a) => webcrypto.getRandomValues(a) } : {},
    console: { log: rec('log'), info: rec('info'), warn: rec('warn'), error: rec('error'), debug: rec('debug'), trace: rec('trace') },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  if (lockToDataURL) {
    // A realm in which one patch group genuinely cannot install: the method is
    // not configurable, so `replaceMethod` throws and `safe()` records a failure.
    vm.runInContext(`Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', { configurable: false })`, ctx);
  }
  const win = vm.runInContext('globalThis', ctx);

  const statuses = [];
  const detects = [];
  let boot = null;
  const onReverse = (ev) => {
    let d = null;
    try { d = JSON.parse(ev.detail); } catch (_) { return; }
    if (ev.type === 'nullecho:detect') detects.push(d);
    else if (d.phase === 'boot') {
      if (!boot) boot = d;
      // A loader that answers INSIDE the boot dispatch — what every standalone
      // harness page does, and what a future loader fast path could do.
      if (syncReply && d.channel === 'shim' && d.nonce) send({ ok: true, enabled: true, gpc: false, site: 'example.test', dev: true, persona: DELIVERED, nonce: d.nonce, reportTokens: RIG_TOKENS });
      return;
    }
    else statuses.push(d);
    if (typeof d.token === 'string') { try { ev.stopImmediatePropagation(); } catch (_) {} }
  };
  for (const type of ['nullecho:status', 'nullecho:detect']) {
    ctx.EventTarget.prototype.addEventListener.call(win, type, onReverse, true);
    ctx.document.addEventListener(type, onReverse, true);
  }

  const send = (payload) => vm.runInContext(
    'document.dispatchEvent(new CustomEvent("nullecho:persona", { detail: __payload }))',
    Object.assign(ctx, { __payload: typeof payload === 'string' ? payload : JSON.stringify(payload) }),
  );
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });
  return {
    ctx, win, boot, statuses, detects, consoleCalls, send, page,
    upgrade: (over = {}) => send({ ok: true, enabled: true, gpc: false, site: 'example.test', dev: true, persona: DELIVERED, nonce: boot.nonce, reportTokens: RIG_TOKENS, ...over }),
    dev: () => page('__nullechoDev'),
  };
}

/** The real `shim-loader.js` with a scripted page in place of the shim (after review-2026-09-16's `loaderRealm`). */
/**
 * @param frameElement  what `globalThis.frameElement` reads in the isolated world (null = top or cross-origin parent)
 * @param isTop         whether `top === self`
 * @param fastTimers    clamp every setTimeout to 40 ms so BOOT_CHECK_MS-gated paths run in a unit test
 */
function loaderRealm({ frameElement = null, isTop = true, fastTimers = false } = {}) {
  const toWorker = [];
  const delivered = [];
  const listeners = [];
  const isoConsole = [];
  const document = {
    addEventListener: (type, fn) => listeners.push({ type, fn }),
    dispatchEvent: (ev) => { if (ev.type === 'nullecho:persona') delivered.push(JSON.parse(ev.detail)); return true; },
    readyState: 'loading',
    scripts: { length: 0 },
  };
  class Ev {
    constructor(type, init) { this.type = type; this.detail = init.detail; this.stopped = false; }
    stopImmediatePropagation() { this.stopped = true; }
  }
  const dispatch = (type, obj) => {
    const ev = new Ev(type, { detail: JSON.stringify(obj) });
    for (const l of listeners) { if (l.type === type && !ev.stopped) l.fn(ev); }
    return ev;
  };
  const iso = vm.createContext({
    document, setTimeout: fastTimers ? (fn, ms, ...a) => setTimeout(fn, Math.min(ms | 0, 40), ...a) : setTimeout, clearTimeout, queueMicrotask, CustomEvent: Ev, frameElement,
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { warn: (...a) => isoConsole.push({ method: 'warn', text: a.map(String).join(' ') }), error: (...a) => isoConsole.push({ method: 'error', text: a.map(String).join(' ') }) },
    chrome: { runtime: { id: 'x', lastError: undefined, sendMessage(m, cb) { toWorker.push(m); if (cb) setTimeout(() => cb({ ok: true, enabled: true, gpc: true, site: 'x', persona: DELIVERED, loudFailures: true }), 1); } } },
  });
  iso.self = vm.runInContext('globalThis', iso); iso.top = isTop ? iso.self : {};
  vm.runInContext(LOADER_SRC, iso);
  const settle = () => new Promise((r) => setTimeout(r, 30));
  return { toWorker, delivered, dispatch, settle, isoConsole };
}

export { HERE, SHIM_SRC, LOADER_SRC, DELIVERED, RIG_TOKENS, DOM_SETUP, bootRealm, loaderRealm };
