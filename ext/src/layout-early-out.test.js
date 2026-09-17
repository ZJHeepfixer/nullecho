/**
 * Nullecho — the layout early-out (D34)
 * ══════════════════════════════════════
 * Companion to docs/DECISIONS.md D34 and docs/PERFORMANCE-2026-09-17.md §2.
 *
 * THE COST BEING REMOVED. `fontMetric()` forces two synchronous re-layouts on any
 * leaf element with short text whose computed `font-family` names a known system
 * font the persona lacks. The ordinary modern stack
 *
 *     -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
 *
 * names `"Segoe UI"` and `Roboto`, which a macOS or Linux persona does not have, so
 * `planFamilies()` sets `dropped` and EVERY text-bearing leaf on EVERY page pays
 * +31 µs per `offsetWidth` and +60 µs per `getBoundingClientRect`.
 *
 * THE RULE (D34). Dropping a family from the stack can only change what is
 * rendered if the HOST actually has that family installed. If the host lacks it
 * too, the browser's own font matching already skipped it and the shim's removal
 * is a no-op — so the real measurement IS the shimmed measurement, and the two
 * forced layouts are pure waste. Symmetrically, a family the persona CLAIMS needs
 * no synthesis when the host really has it.
 *
 * WHAT MUST NOT MOVE. A fingerprinter's probe puts the family under test FIRST
 * (`"Segoe UI", monospace`). Those probes must return exactly what they returned
 * before this change, on a host that has the family and on a host that does not.
 * These tests pin both.
 *
 * THE RIG. A `node:vm` realm whose layout is a deterministic function of a
 * simulated HOST font set: `offsetWidth` resolves the element's effective
 * font-family list the way CSS does — first installed or generic family wins — and
 * returns `text.length * factor`. That makes "did the shim change the number?" and
 * "did the shim force a layout?" both exactly observable:
 *
 *   · `__forced`  — incremented on every `style.setProperty('font-family', …)`,
 *                   which only `measureWithFamily()` does. 0 ⇒ the fast path ran.
 *   · `__native`  — what the page would have measured with no shim at all.
 *
 * The rig deliberately does NOT model per-glyph fallback: the point of the D34
 * rule is that it does not have to. A host-absent family supplies no glyph at any
 * codepoint, so its removal is a no-op for every string. The per-glyph attack pass
 * is recorded in D34.
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

/** A macOS-shaped persona: it has Helvetica and Arial, it does NOT have Segoe UI or Roboto. */
const PERSONA_FONTS = ['Arial', 'Courier New', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Menlo', 'Symbol', 'Times New Roman', 'Verdana'];

const DELIVERED = {
  id: 'mac-chrome-m1-pro', platform: 'MacIntel',
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  uaData: { platform: 'macOS', platformVersion: '14.0.0', architecture: 'arm', bitness: '64', model: '', wow64: false },
  gpu: { vendor: 'Google Inc. (Apple)', renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)', unmaskedVendor: 'Google Inc. (Apple)', maxTextureSize: 16384 },
  cores: 10, memory: 16,
  screen: { width: 1728, height: 1117, availHeight: 1079, colorDepth: 30, dpr: 2 },
  fontList: PERSONA_FONTS, noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 0x1234abcd,
};
const RIG_TOKENS = Array.from({ length: 32 }, (_, i) => `rigtoken${String(i).padStart(8, '0')}`);

/**
 * A realm whose layout is a pure function of a simulated host font set.
 *
 * `__HOST` maps an installed family name to its per-character width. A family not
 * in the map is not installed and is skipped by resolution, exactly as a browser
 * skips a family it has no face for.
 */
const DOM_SETUP = `
(() => {
  const slots = new WeakMap();
  const slot = (o) => { let s = slots.get(o); if (!s) { s = {}; slots.set(o, s); } return s; };
  const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };
  const attr = (C, name, init) => Object.defineProperty(C.prototype, name, {
    get() { brand(this, C); const s = slot(this); return name in s ? s[name] : init; },
    set(v) { brand(this, C); slot(this)[name] = v; },
    configurable: true, enumerable: true,
  });
  const ro = (C, name, read) => Object.defineProperty(C.prototype, name, {
    get() { brand(this, C); return read(this); }, configurable: true, enumerable: true,
  });

  // ── the layout model ─────────────────────────────────────────────────────
  const GENERIC = { 'monospace': 10, 'sans-serif': 7, 'serif': 8, 'cursive': 9, 'fantasy': 11,
                    'system-ui': 7, '-apple-system': 7, 'BlinkMacSystemFont': 7 };
  globalThis.__HOST = Object.create(null);          // installed family -> per-char width
  const LAST_RESORT = 7;                            // what a stack that resolves to nothing gets

  const unquote = (s) => {
    s = String(s).trim();
    if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
    return s;
  };
  const parseList = (css) => {
    const out = []; let cur = '', q = null;
    for (const ch of String(css)) {
      if (q) { if (ch === q) q = null; else cur += ch; }
      else if (ch === '"' || ch === "'") q = ch;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out.map(unquote).filter((x) => x.length);
  };
  /** CSS font matching, simplified to whole families: first installed or generic wins. */
  const factorFor = (css) => {
    for (const fam of parseList(css)) {
      if (Object.prototype.hasOwnProperty.call(globalThis.__HOST, fam)) return globalThis.__HOST[fam];
      if (Object.prototype.hasOwnProperty.call(GENERIC, fam)) return GENERIC[fam];
    }
    return LAST_RESORT;
  };
  globalThis.__factorFor = factorFor;

  // ── the DOM ──────────────────────────────────────────────────────────────
  class EventTarget {
    addEventListener() {} removeEventListener() {}
    dispatchEvent(ev) {
      for (const node of [globalThis, document]) {
        for (const l of (slot(node).ls || [])) {
          if (l.type !== ev.type) continue;
          if (node === globalThis && !l.capture) continue;
          l.fn.call(node, ev);
        }
      }
      return true;
    }
  }
  const addL = (t, type, fn, capture) => { const s = slot(t); (s.ls || (s.ls = [])).push({ type, fn, capture: !!capture }); };
  EventTarget.prototype.addEventListener = function (type, fn, capture) { addL(this, type, fn, capture); };
  class Event { constructor(type) { this.type = type; } stopPropagation() {} stopImmediatePropagation() {} }
  class CustomEvent extends Event { constructor(type, init) { super(type); this._detail = init ? init.detail : undefined; } }
  Object.defineProperty(CustomEvent.prototype, 'detail', { get() { return this._detail; }, configurable: true });

  class Navigator {}
  ro(Navigator, 'userAgent', () => 'Mozilla/5.0 (REAL MACHINE)');
  ro(Navigator, 'platform', () => 'MacIntel');
  const navigator = Object.create(Navigator.prototype);

  globalThis.__forced = 0;                          // every forced re-layout the shim causes
  class CSSStyleDeclaration {
    constructor(el) { slot(this).el = el; slot(this).props = Object.create(null); slot(this).prio = Object.create(null); }
    getPropertyValue(p) { brand(this, CSSStyleDeclaration); return slot(this).props[p] || ''; }
    getPropertyPriority(p) { brand(this, CSSStyleDeclaration); return slot(this).prio[p] || ''; }
    setProperty(p, v, prio) {
      brand(this, CSSStyleDeclaration);
      if (p === 'font-family') globalThis.__forced++;
      slot(this).props[p] = String(v); slot(this).prio[p] = prio || '';
    }
    removeProperty(p) {
      brand(this, CSSStyleDeclaration);
      if (p === 'font-family') globalThis.__forced++;
      const v = slot(this).props[p]; delete slot(this).props[p]; delete slot(this).prio[p]; return v || '';
    }
  }
  // The computed-style object the shim reads through captured getters.
  ro(CSSStyleDeclaration, 'fontFamily', (o) => slot(o).props['font-family'] || '');
  ro(CSSStyleDeclaration, 'fontSize', (o) => slot(o).props['font-size'] || '14px');
  ro(CSSStyleDeclaration, 'fontWeight', (o) => slot(o).props['font-weight'] || '400');
  ro(CSSStyleDeclaration, 'fontStyle', (o) => slot(o).props['font-style'] || 'normal');
  ro(CSSStyleDeclaration, 'letterSpacing', (o) => slot(o).props['letter-spacing'] || 'normal');

  class Node extends EventTarget {}
  ro(Node, 'nodeType', () => 1);
  ro(Node, 'textContent', (o) => slot(o).text || '');
  ro(Node, 'isConnected', () => true);
  ro(Node, 'parentElement', () => null);

  class Element extends Node {
    getBoundingClientRect() { brand(this, Element); return new DOMRect(0, 0, widthOf(this), 20); }
  }
  ro(Element, 'childElementCount', () => 0);
  ro(Element, 'clientWidth', (o) => widthOf(o));
  class HTMLElement extends Element {}
  /** The element's OWN inline font-family wins over its stylesheet one, as !important does. */
  const widthOf = (el) => {
    const s = slot(el);
    const inline = s.style ? s.style.getPropertyValue('font-family') : '';
    const css = inline || s.css || 'sans-serif';
    return (s.text || '').length * factorFor(css);
  };
  ro(HTMLElement, 'offsetWidth', (o) => widthOf(o));
  ro(HTMLElement, 'offsetHeight', () => 20);
  ro(HTMLElement, 'style', (o) => { const s = slot(o); return s.style || (s.style = new CSSStyleDeclaration(o)); });
  class HTMLIFrameElement extends HTMLElement {}
  ro(HTMLIFrameElement, 'contentWindow', () => null);
  class MutationObserver { observe() {} disconnect() {} }

  class DOMRectReadOnly { constructor(x, y, w, h) { const s = slot(this); s.x = x; s.y = y; s.w = w; s.h = h; } }
  ro(DOMRectReadOnly, 'x', (o) => slot(o).x);
  ro(DOMRectReadOnly, 'y', (o) => slot(o).y);
  ro(DOMRectReadOnly, 'width', (o) => slot(o).w);
  ro(DOMRectReadOnly, 'height', (o) => slot(o).h);
  class DOMRect extends DOMRectReadOnly {}

  const getComputedStyle = (el) => {
    const cs = new CSSStyleDeclaration(el);
    cs.setProperty('font-family', slot(el).css || 'sans-serif');
    globalThis.__forced--;   // the rig's own bookkeeping write is not a page re-layout
    cs.setProperty('font-size', '14px');
    return cs;
  };

  // ── canvas, only as much as the font path uses ───────────────────────────
  class TextMetrics { constructor(w) { slot(this).width = w; } }
  ro(TextMetrics, 'width', (o) => slot(o).width);
  class ImageData {
    constructor(w, h) { slot(this).width = w; slot(this).height = h; slot(this).data = new Uint8ClampedArray(w * h * 4); }
  }
  ro(ImageData, 'width', (o) => slot(o).width);
  ro(ImageData, 'height', (o) => slot(o).height);
  ro(ImageData, 'data', (o) => slot(o).data);

  globalThis.__measured = 0;
  function contextClass(CanvasCtor) {
    class Ctx {
      constructor(canvas) { slot(this).canvas = canvas; }
      measureText(text) {
        brand(this, Ctx);
        if (arguments.length < 1) throw new TypeError("Failed to execute 'measureText' on '" + Ctx.name + "': 1 argument required, but only 0 present.");
        globalThis.__measured++;
        const font = slot(this).font || '10px sans-serif';
        const fam = font.replace(/^[^]*?\\d+(?:\\.\\d+)?(?:px|pt|em|rem|%)\\s+/, '');
        return new TextMetrics([...String(text)].length * factorFor(fam));
      }
      getImageData(sx, sy, sw, sh) { brand(this, Ctx); return new ImageData(sw, sh); }
      putImageData() { brand(this, Ctx); }
      drawImage() { brand(this, Ctx); }
    }
    ro(Ctx, 'canvas', (o) => slot(o).canvas);
    attr(Ctx, 'font', '10px sans-serif');
    return Ctx;
  }
  class HTMLCanvasElement extends HTMLElement {
    getContext() { brand(this, HTMLCanvasElement); const s = slot(this); return s.ctx || (s.ctx = new CanvasRenderingContext2D(this)); }
    toDataURL() { brand(this, HTMLCanvasElement); return 'data:image/png;fake,'; }
    toBlob(cb) { brand(this, HTMLCanvasElement); cb({ size: 1 }); }
  }
  attr(HTMLCanvasElement, 'width', 300);
  attr(HTMLCanvasElement, 'height', 150);
  const CanvasRenderingContext2D = contextClass(HTMLCanvasElement);
  Object.defineProperty(CanvasRenderingContext2D, 'name', { value: 'CanvasRenderingContext2D' });
  class OffscreenCanvas {
    constructor(w, h) { slot(this).width = w; slot(this).height = h; }
    getContext() { brand(this, OffscreenCanvas); const s = slot(this); return s.ctx || (s.ctx = new OffscreenCanvasRenderingContext2D(this)); }
    convertToBlob() { brand(this, OffscreenCanvas); return Promise.resolve({ size: 1 }); }
  }
  attr(OffscreenCanvas, 'width', 0);
  attr(OffscreenCanvas, 'height', 0);
  const OffscreenCanvasRenderingContext2D = contextClass(OffscreenCanvas);
  Object.defineProperty(OffscreenCanvasRenderingContext2D, 'name', { value: 'OffscreenCanvasRenderingContext2D' });

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

  /** Make a leaf element with short text and a stylesheet font stack. */
  globalThis.__leaf = (css, text) => {
    const el = new HTMLElement();
    slot(el).css = css; slot(el).text = text;
    return el;
  };
  /** What the page would measure with NO shim at all. */
  globalThis.__native = (el) => widthOf(el);

  Object.assign(globalThis, {
    EventTarget, Event, CustomEvent, Navigator, navigator, Node, Element, HTMLElement, HTMLIFrameElement,
    MutationObserver, getComputedStyle, CSSStyleDeclaration, DOMRect, DOMRectReadOnly,
    HTMLCanvasElement, CanvasRenderingContext2D, OffscreenCanvas, OffscreenCanvasRenderingContext2D,
    ImageData, TextMetrics, document,
  });
  globalThis.Document = EventTarget;   // the shim reads Document.prototype.fonts; absent here, which is honest
  globalThis.__nativeOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth').get;
})();
`;

/**
 * Boot the real shim, with `host` naming the families the MACHINE has installed
 * (family -> per-character width).
 */
function bootRealm(host) {
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {}, trace() {} },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  const win = vm.runInContext('globalThis', ctx);
  Object.assign(win.__HOST, host);

  let boot = null;
  const onReverse = (ev) => { try { const d = JSON.parse(ev.detail); if (d.phase === 'boot' && !boot) boot = d; } catch (_) {} };
  ctx.EventTarget.prototype.addEventListener.call(win, 'nullecho:status', onReverse, true);
  ctx.document.addEventListener('nullecho:status', onReverse, true);
  ctx.EventTarget.prototype.addEventListener.call(win, 'nullecho:detect', onReverse, true);
  ctx.document.addEventListener('nullecho:detect', onReverse, true);

  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  const send = (payload) => vm.runInContext(
    'document.dispatchEvent(new CustomEvent("nullecho:persona", { detail: __payload }))',
    Object.assign(ctx, { __payload: JSON.stringify(payload) }),
  );
  send({ ok: true, enabled: true, gpc: false, site: 'example.test', dev: true, persona: DELIVERED, nonce: boot.nonce, reportTokens: RIG_TOKENS });

  return {
    win,
    /** Read `offsetWidth` through the SHIM, reporting the forced layouts it cost. */
    read(css, text) {
      const el = win.__leaf(css, text);
      const native = win.__native(el);
      win.__forced = 0;
      const shimmed = el.offsetWidth;
      return { shimmed, native, forced: win.__forced };
    },
    rect(css, text) {
      const el = win.__leaf(css, text);
      const native = win.__native(el);
      win.__forced = 0;
      const shimmed = el.getBoundingClientRect().width;
      return { shimmed, native, forced: win.__forced };
    },
    measure(font, text) {
      const cx = vm.runInContext('document.createElement("canvas").getContext("2d")', ctx);
      cx.font = font;
      win.__measured = 0;
      const shimmed = cx.measureText(text).width;
      return { shimmed, measured: win.__measured };
    },
  };
}

/** A macOS-shaped machine: it has what the persona has, and nothing Windows-only. */
const MAC_HOST = { Arial: 7, 'Courier New': 10, Georgia: 8, Helvetica: 7.5, 'Helvetica Neue': 7.6, Menlo: 10, 'Times New Roman': 8, Verdana: 9 };
/** The same machine with Segoe UI additionally installed — the case the defense exists for. */
const MAC_HOST_WITH_SEGOE = { ...MAC_HOST, 'Segoe UI': 6.25 };
/** …and with `Symbol` installed but metrically identical to monospace for Latin text. */
const SYMBOL_HOST = { ...MAC_HOST, Symbol: 10 };

/** The stack essentially every modern page ships. */
const PAGE_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
/**
 * The same stack with the two Apple keywords removed. `-apple-system` and
 * `BlinkMacSystemFont` are GENERIC_FAMILIES to the shim and resolve on a Mac, so in
 * PAGE_STACK nothing after them ever renders; this variant is the case where the
 * page's own text really is painted in Helvetica.
 */
const PAGE_STACK_NO_APPLE = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE FAST PATH — a persona-absent family the HOST also lacks
// ═══════════════════════════════════════════════════════════════════════════

test('D34: the ordinary page stack forces NO layout when the dropped families are absent from the host too', () => {
  const s = bootRealm(MAC_HOST);
  const r = s.read(PAGE_STACK, 'Dashboard');
  assert.equal(r.forced, 0, 'measureWithFamily must not run: dropping Segoe UI/Roboto cannot change a pixel here');
  assert.equal(r.shimmed, r.native, 'and the number handed to the page is the real one');
});

test('D34: getBoundingClientRect takes the same fast path (both call sites, one helper)', () => {
  const s = bootRealm(MAC_HOST);
  const r = s.rect(PAGE_STACK, 'Dashboard');
  assert.equal(r.forced, 0);
  assert.equal(r.shimmed, r.native);
});

test('D34: a claimed family listed FIRST keeps the slow path even when the host has it', () => {
  // Nothing generic precedes Helvetica here, so this element's width is readable as
  // a presence probe for it. The early-out must not touch that shape.
  const s = bootRealm(MAC_HOST);
  const r = s.read(PAGE_STACK_NO_APPLE, 'Dashboard');
  assert.equal(r.native, 'Dashboard'.length * MAC_HOST.Helvetica, 'rig check');
  assert.ok(r.forced > 0, 'claimedFirst ⇒ the old path, byte for byte');
  assert.equal(r.shimmed, r.native, 'and here the old path returns the real metric anyway');
});

test('D34 REGRESSION: an installed family with no glyph for the text still gets its synthetic presence', () => {
  // The macOS `Symbol` shape. The machine HAS the family and the persona claims it,
  // but it carries no Latin glyph, so the width falls back to the generic and a
  // host-presence test alone would wrongly call this "nothing to do". `claimedFirst`
  // is what keeps it on the measuring path.
  const s = bootRealm(SYMBOL_HOST);
  const r = s.read('"Symbol", monospace', 'mmmmmmmmmmlli');
  assert.equal(r.native, 'mmmmmmmmmmlli'.length * 10, 'rig check: indistinguishable from monospace');
  assert.notEqual(r.shimmed, r.native, 'the probe must still be told the persona has it');
  assert.ok(r.forced > 0);
});

test('D34: measureText takes the fast path on the same stack', () => {
  const s = bootRealm(MAC_HOST);
  s.measure('13px ' + PAGE_STACK, 'warm');   // first call pays the one-time host probe
  const r = s.measure('13px ' + PAGE_STACK, 'Dashboard');
  const native = 'Dashboard'.length * 7;   // -apple-system resolves first, as on a real Mac
  assert.equal(r.shimmed, native, 'the real width, unadjusted');
  assert.equal(r.measured, 1, 'exactly one native measureText — the delegation, and nothing else');
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. THE SLOW PATH MUST SURVIVE — a persona-absent family the host HAS
// ═══════════════════════════════════════════════════════════════════════════

test('D34: a host-PRESENT persona-absent family still takes the slow path, and is still removed', () => {
  const s = bootRealm(MAC_HOST_WITH_SEGOE);
  const r = s.read(PAGE_STACK_NO_APPLE, 'Dashboard');
  assert.ok(r.forced > 0, 'the machine really has Segoe UI, so the drop changes the measurement and must be measured');
  assert.equal(r.native, 'Dashboard'.length * MAC_HOST_WITH_SEGOE['Segoe UI'], 'rig check: the page would really render in Segoe UI');
  assert.equal(r.shimmed, 'Dashboard'.length * MAC_HOST_WITH_SEGOE.Helvetica,
    'the page is told what a machine WITHOUT Segoe UI would measure — the defense');
  assert.notEqual(r.shimmed, r.native);
});

test('D34: the fingerprinter probe — family FIRST — is unchanged on a host that HAS it', () => {
  const s = bootRealm(MAC_HOST_WITH_SEGOE);
  const r = s.read('"Segoe UI", monospace', 'mmmmmmmmmmlli');
  assert.equal(r.native, 'mmmmmmmmmmlli'.length * MAC_HOST_WITH_SEGOE['Segoe UI']);
  assert.equal(r.shimmed, 'mmmmmmmmmmlli'.length * 10, 'monospace: the probe is told Segoe UI is absent');
  assert.ok(r.forced > 0);
});

test('D34: the fingerprinter probe — family FIRST — is unchanged on a host that LACKS it', () => {
  const s = bootRealm(MAC_HOST);
  const r = s.read('"Segoe UI", monospace', 'mmmmmmmmmmlli');
  assert.equal(r.shimmed, 'mmmmmmmmmmlli'.length * 10, 'monospace, byte-identical to the slow path');
  assert.equal(r.shimmed, r.native, 'because the host lacks it, the truth and the spoof are the same number');
});

test('D34: a probe for a family the PERSONA claims and the host lacks still gets a synthesised presence', () => {
  // Host has no Helvetica; persona claims it. Without synthesis the probe sees the
  // monospace baseline and concludes the persona is lying.
  const s = bootRealm({ Arial: 7, 'Courier New': 10 });
  const r = s.read('"Helvetica", monospace', 'mmmmmmmmmmlli');
  assert.equal(r.native, 'mmmmmmmmmmlli'.length * 10, 'rig check: really falls back to monospace');
  assert.notEqual(r.shimmed, r.native, 'the shim must still move it off the baseline');
  assert.ok(r.forced > 0, 'and that requires the real measurement, so the slow path stays');
});

test('D34: the probe listed SECOND behind a host-absent family behaves as it did', () => {
  // `"Nonexistent Webfont", "Segoe UI", monospace` — the first family is outside the
  // system-font universe and not installed, so Segoe UI is what actually renders.
  const s = bootRealm(MAC_HOST_WITH_SEGOE);
  const r = s.read('"Zzz Not A Font", "Segoe UI", monospace', 'mmmmmmmmmmlli');
  assert.equal(r.native, 'mmmmmmmmmmlli'.length * MAC_HOST_WITH_SEGOE['Segoe UI']);
  assert.equal(r.shimmed, 'mmmmmmmmmmlli'.length * 10, 'still reported as monospace');
  assert.ok(r.forced > 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE EARLY-OUT IS PER FAMILY, CACHED, AND CHEAP
// ═══════════════════════════════════════════════════════════════════════════

test('D34: the host-presence probe runs a bounded number of times, not once per element', () => {
  const s = bootRealm(MAC_HOST);
  s.win.__measured = 0;
  for (let i = 0; i < 50; i++) s.read(PAGE_STACK, 'row ' + i);
  const first = s.win.__measured;
  s.win.__measured = 0;
  for (let i = 0; i < 50; i++) s.read(PAGE_STACK, 'row ' + i);
  assert.equal(s.win.__measured, 0, 'the second 50 reads probe nothing: the answer is cached per family');
  assert.ok(first > 0 && first < 200, `the first sweep probes a bounded number of times (got ${first})`);
});

test('D34: generic-only and empty stacks never reach the font path at all', () => {
  const s = bootRealm(MAC_HOST);
  for (const css of ['sans-serif', 'monospace', 'serif, sans-serif', '']) {
    assert.equal(s.read(css, 'hello').forced, 0, css || '(empty)');
  }
});

test('D34: a stack of ONLY dropped families still reports the fallback the browser really uses', () => {
  // Nothing survives the plan but the implicit last resort. On a host that lacks
  // them both, the real measurement already IS the fallback.
  const s = bootRealm(MAC_HOST);
  const r = s.read('"Segoe UI", "Segoe UI Emoji"', 'hello');
  assert.equal(r.shimmed, r.native);
  assert.equal(r.forced, 0);
});
