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
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHIM_SRC = fs.readFileSync(path.join(HERE, 'shim.js'), 'utf8');
const LOADER_SRC = fs.readFileSync(path.join(HERE, 'shim-loader.js'), 'utf8');

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

/** The real `shim-loader.js` with a scripted page in place of the shim (after review-2026-09-16's `loaderRealm`). */
function loaderRealm() {
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
    document, setTimeout, clearTimeout, queueMicrotask, CustomEvent: Ev,
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { warn: (...a) => isoConsole.push({ method: 'warn', text: a.map(String).join(' ') }), error: (...a) => isoConsole.push({ method: 'error', text: a.map(String).join(' ') }) },
    chrome: { runtime: { id: 'x', lastError: undefined, sendMessage(m, cb) { toWorker.push(m); if (cb) setTimeout(() => cb({ ok: true, enabled: true, gpc: true, site: 'x', persona: DELIVERED, loudFailures: true }), 1); } } },
  });
  iso.self = iso.top = vm.runInContext('globalThis', iso);
  vm.runInContext(LOADER_SRC, iso);
  const settle = () => new Promise((r) => setTimeout(r, 30));
  return { toWorker, delivered, dispatch, settle, isoConsole };
}

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
