/**
 * Nullecho — the masked source is the ENGINE's spelling, not Chrome's
 * ═══════════════════════════════════════════════════════════════════
 * `markNative` wrote one hard-coded string on every engine:
 *
 *   Chrome 147   function get userAgent() { [native code] }
 *   Firefox 156  function userAgent() {\n    [native code]\n}
 *
 * SpiderMonkey drops the `get `/`set ` prefix from the SOURCE — it keeps it in
 * `.name` — and indents the body. So on Firefox every shim-masked function was
 * one string compare away from any native the shim leaves alone:
 * `HTMLCanvasElement.prototype.toDataURL` read single-line while
 * `HTMLCanvasElement.prototype.getContext`, same interface, same kind, read
 * multi-line. D38 had already solved this for the ONE getter in `gpc.js` by
 * copying a native's source instead of assuming Chrome's; D43 generalises it to
 * all 43 install sites.
 *
 * The rig is a `node:vm` realm with a fake `Function.prototype.toString`
 * installed BEFORE `shim.js` boots, so the shim's boot-captured copy is the
 * fake — which is exactly the position a real engine is in. `engine: 'chrome'`
 * prints V8's spelling, `engine: 'firefox'` prints SpiderMonkey's, and both
 * report `[native code]` for the realm's own natives, so the shim's models are
 * native the way they are in a browser. Both spellings were measured in the real
 * browsers on 2026-09-19; nothing here is inferred.
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

/**
 * A page realm with enough DOM for the shim to patch, plus `__isNative` so the
 * fake engine knows which of the realm's functions are "native". Everything the
 * shim cannot find is skipped by its own `safe()`, so this stays small.
 */
const DOM_SETUP = `
(() => {
  const NATIVES = new WeakSet();
  globalThis.__isNative = (f) => NATIVES.has(f);
  const mark = (f) => { if (typeof f === 'function') NATIVES.add(f); return f; };

  const listeners = new WeakMap();
  const listenersFor = (t) => { let l = listeners.get(t); if (!l) { l = []; listeners.set(t, l); } return l; };
  const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };

  class EventTarget {
    addEventListener(type, fn, capture) { listenersFor(this).push({ type, fn, capture: !!capture }); }
    removeEventListener() {}
    dispatchEvent(ev) {
      for (const node of [globalThis, document]) {
        for (const l of listenersFor(node).slice()) {
          if (l.type !== ev.type) continue;
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

  const REAL = { userAgent: 'Mozilla/5.0 (REAL MACHINE)', platform: 'MacIntel', hardwareConcurrency: 12, webdriver: false, onLine: true };
  class Navigator {}
  for (const k of Object.keys(REAL)) {
    // Getter SHORTHAND, so the accessor is named "get <attr>" the way a real
    // WebIDL one is. A plain \`{ get() {} }\` is named "get", and a rig built
    // that way cannot tell a correct mask from a wrong one (review G3/D38).
    const holder = { get [k]() { brand(this, Navigator); return REAL[k]; } };
    Object.defineProperty(Navigator.prototype, k, {
      get: Object.getOwnPropertyDescriptor(holder, k).get, configurable: true, enumerable: true,
    });
  }

  class CanvasRenderingContext2D {
    constructor(canvas) { this.canvas = canvas; this._buf = new Uint8ClampedArray(canvas.width * canvas.height * 4); this.font = '10px sans-serif'; }
    fillRect() {} fillText() {} drawImage() {}
    getImageData(sx, sy, sw, sh) {
      brand(this, CanvasRenderingContext2D);
      return { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
    }
    putImageData() {}
    measureText(t) { brand(this, CanvasRenderingContext2D); return { width: String(t).length * 7 }; }
  }
  class Element extends EventTarget {}
  {
    const holder = { get innerHTML() { return this._html || ''; }, set innerHTML(v) { this._html = String(v); } };
    const d = Object.getOwnPropertyDescriptor(holder, 'innerHTML');
    Object.defineProperty(Element.prototype, 'innerHTML', { get: d.get, set: d.set, configurable: true, enumerable: true });
  }
  class HTMLElement extends Element {}
  class HTMLCanvasElement extends HTMLElement {
    constructor() { super(); this.width = 16; this.height = 16; }
    getContext(kind) { brand(this, HTMLCanvasElement); if (kind !== '2d') return null; if (!this._ctx) this._ctx = new CanvasRenderingContext2D(this); return this._ctx; }
    toDataURL() { brand(this, HTMLCanvasElement); return 'data:image/png;base64,AAAA'; }
    toBlob(cb) { brand(this, HTMLCanvasElement); cb({ size: 4 }); }
  }

  class Document extends EventTarget {
    createElement(tag) { return tag === 'canvas' ? new HTMLCanvasElement() : new HTMLElement(); }
  }

  Object.assign(globalThis, { EventTarget, Event, CustomEvent, Navigator, Element, HTMLElement,
    HTMLCanvasElement, CanvasRenderingContext2D, Document });
  globalThis.navigator = new Navigator();
  globalThis.document = new Document();
  globalThis.window = globalThis;
  globalThis.self = globalThis;

  // Everything the realm calls "native" — the models markNative is handed.
  for (const C of [EventTarget, Event, CustomEvent, Navigator, Element, HTMLElement,
                   HTMLCanvasElement, CanvasRenderingContext2D, Document]) {
    for (const key of Object.getOwnPropertyNames(C.prototype)) {
      const d = Object.getOwnPropertyDescriptor(C.prototype, key);
      mark(d.value); mark(d.get); mark(d.set);
    }
  }
})();
`;

/**
 * The engine's own `Function.prototype.toString`, installed before the shim and
 * therefore the thing the shim captures at boot. Both spellings were measured in
 * the real browsers on 2026-09-19 (D42); nothing here is inferred.
 */
const ENGINE = (engine) => `
(() => {
  const real = Function.prototype.toString;
  const bare = (n) => (n.slice(0, 4) === 'get ' || n.slice(0, 4) === 'set ') ? n.slice(4) : n;
  const spell = (f) => ${engine === 'firefox'
    ? "'function ' + bare(f.name || '') + '() {\\n    [native code]\\n}'"
    : "'function ' + (f.name || '') + '() { [native code] }'"};
  const holder = {
    toString() {
      if (this === masked) return spell({ name: 'toString' });
      if (typeof this !== 'function') return real.call(this);
      if (globalThis.__isNative(this)) return spell(this);
      const src = real.call(this);
      // A genuine V8 intrinsic in this realm (Object.prototype.hasOwnProperty,
      // the __proto__ accessors) — respell it the way this engine would.
      if (src.indexOf('[native code]') >= 0) return spell(this);
      return src;
    },
  };
  const masked = Object.getOwnPropertyDescriptor(holder, 'toString').value;
  Object.defineProperty(Function.prototype, 'toString', {
    value: masked, writable: true, enumerable: false, configurable: true,
  });
})();
`;

function bootRealm(engine) {
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  vm.runInContext(ENGINE(engine), ctx, { filename: 'engine.js' });
  const nativeControl = (expr) => page(`Function.prototype.toString.call(${expr})`);
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  const src = (expr) => page(`Function.prototype.toString.call(${expr})`);
  const name = (expr) => page(`(${expr}).name`);
  return { ctx, page, src, name, nativeControl };
}

/** The ten-plus functions the shim installs in this realm, with their kind. */
const MASKED = [
  ['get', 'Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get'],
  ['get', 'Object.getOwnPropertyDescriptor(Navigator.prototype, "platform").get'],
  ['get', 'Object.getOwnPropertyDescriptor(Navigator.prototype, "hardwareConcurrency").get'],
  ['method', 'HTMLCanvasElement.prototype.toDataURL'],
  ['method', 'HTMLCanvasElement.prototype.toBlob'],
  ['method', 'CanvasRenderingContext2D.prototype.getImageData'],
  ['method', 'CanvasRenderingContext2D.prototype.measureText'],
  ['method', 'Function.prototype.toString'],
];

/** What the engine prints for a real native of that kind, with the name swapped. */
function expected(engine, kind, plainName) {
  const shown = engine === 'firefox' ? plainName : (kind === 'method' ? plainName : `${kind} ${plainName}`);
  return engine === 'firefox'
    ? `function ${shown}() {\n    [native code]\n}`
    : `function ${shown}() { [native code] }`;
}

for (const engine of ['chrome', 'firefox']) {
  test(`on ${engine}, every masked function reads exactly what that engine prints for a native of the same name and kind`, () => {
    const s = bootRealm(engine);
    const wrong = [];
    for (const [kind, expr] of MASKED) {
      const got = s.src(expr);
      const n = s.name(expr);
      assert.ok(typeof n === 'string' && n.length, `${expr} has no name`);
      const plain = (n.slice(0, 4) === 'get ' || n.slice(0, 4) === 'set ') ? n.slice(4) : n;
      const want = expected(engine, kind, plain);
      if (got !== want) wrong.push(`${expr}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`);
    }
    assert.deepEqual(wrong, [], `REGRESSION: the mask is not this engine's spelling:\n${wrong.join('\n')}`);
  });

  test(`on ${engine}, a masked function is byte-identical to an UNPATCHED native of the same kind with the name substituted`, () => {
    const s = bootRealm(engine);
    // The comparison an attacker makes: one patched member, one the shim never
    // touches, same interface, same kind — do they agree on spelling?
    const pairs = [
      ['HTMLCanvasElement.prototype.toDataURL', 'HTMLCanvasElement.prototype.getContext', 'toDataURL', 'getContext'],
      ['Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get',
        'Object.getOwnPropertyDescriptor(Navigator.prototype, "webdriver").get', 'userAgent', 'webdriver'],
    ];
    for (const [patchedExpr, controlExpr, patchedName, controlName] of pairs) {
      const control = s.src(controlExpr);
      assert.ok(control.includes('[native code]'), `${controlExpr} is not a native control`);
      const want = control.split(controlName).join(patchedName);
      assert.equal(s.src(patchedExpr), want,
        `${patchedExpr} does not match its unpatched neighbour ${controlExpr}`);
    }
  });

  test(`on ${engine}, Function.prototype.toString reports itself the way the engine does`, () => {
    const s = bootRealm(engine);
    const want = expected(engine, 'method', 'toString');
    assert.equal(s.page('Function.prototype.toString.toString()'), want);
    assert.equal(s.page('Function.prototype.toString.call(Function.prototype.toString)'), want);
  });

  test(`on ${engine}, the shim's own source never reaches the page`, () => {
    const s = bootRealm(engine);
    for (const [, expr] of MASKED) {
      const got = s.src(expr);
      assert.ok(got.includes('[native code]'), `${expr} leaked its source: ${got}`);
      assert.ok(!got.includes('apply('), `${expr} leaked shim source: ${got}`);
    }
  });
}

test('a NON-native model (another extension got there first) falls back to the engine template, never to that extension\'s source', () => {
  const s = bootRealm('firefox');
  // The realm's `onLine` getter is native and unpatched — the template source.
  const native = s.src('Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine").get');
  assert.equal(native, 'function onLine() {\n    [native code]\n}');
  // Everything the shim masked in this realm reads the same shape.
  for (const [, expr] of MASKED) {
    assert.match(s.src(expr), /\{\n {4}\[native code\]\n\}$/, `${expr} is not SpiderMonkey-shaped`);
  }
});

test('KEEP: D33 — the shim still writes nothing to the page console while deriving the spelling', () => {
  const said = [];
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log: (...a) => said.push(a), info: (...a) => said.push(a), warn: (...a) => said.push(a), error: (...a) => said.push(a) },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  vm.runInContext(ENGINE('firefox'), ctx, { filename: 'engine.js' });
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  assert.deepEqual(said, [], `shim.js spoke to the page console: ${JSON.stringify(said)}`);
});

test('LAST RESORT: an engine that will not stringify anything still yields `[native code]`, never shim source', () => {
  // No usable model and no usable template: every `Function.prototype.toString`
  // throws. The mask must still be the thing page scripts check for.
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  vm.runInContext(`Object.defineProperty(Function.prototype, 'toString', {
    value: function toString() { throw new TypeError('no source for you'); },
    writable: true, enumerable: false, configurable: true,
  });`, ctx, { filename: 'engine.js' });
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  const got = vm.runInContext(
    'Function.prototype.toString.call(Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get)',
    ctx, { filename: 'page.js' });
  assert.equal(got, 'function get userAgent() { [native code] }');
});
