/**
 * Nullecho — the SHAPE of every function the shim installs
 * ═════════════════════════════════════════════════════════
 * Companion to docs/CLAIM-VERIFICATION-2026-09-17.md §3a / §3b and DECISIONS.md D32.
 *
 * The 2026-09-17 harness pointed vendored CreepJS at `shim.js` for the first time
 * and found that every replacement the shim installed was a plain `function () {}`.
 * A plain function carries an own `prototype` and is a constructor; a native WebIDL
 * accessor or method has neither. Three one-line probes separate them, CreepJS runs
 * all three, and because `Function.prototype.toString` had the same defect, ONE
 * patch poisoned CreepJS's per-API `failed toString` check for every API on the
 * page — 453 lie records over 198 APIs, `stealth.hasToStringProxy: true`, and a
 * `headless.webDriverIsOn: true` bot verdict for a browser whose `webdriver`
 * getter was never touched.
 *
 * These tests pin the native shape for a patched ACCESSOR, a patched METHOD, the
 * `Function.prototype.toString` replacement (the cascade root), an UNPATCHED
 * control, and — so no future install site can regress it by bypassing the
 * helpers — a sweep of every function the shim changed in the realm. The guards
 * at the bottom pin what the fix must not cost: the delegated brand check
 * (ARKENFOX-RESPONSE.md claim (f)), descriptor flags, and toString masking.
 *
 * Fidelity: the fake DOM is defined INSIDE the `node:vm` realm, like the review
 * file's, and its accessors/methods brand-check their receiver the way WebIDL
 * ones do. The probes below are the exact expressions CreepJS evaluates
 * (`harness/vendor/creepjs-2026-06-11.js`, `queryLies`), and the same ones the
 * harness page reports as `invariants.nativeShapePatched`.
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

/** What the un-shimmed machine says. Seeing this back means the shim stood down. */
const REAL_UA = 'Mozilla/5.0 (REAL MACHINE — the thing we are hiding)';

// ── a page realm, small enough to be honest about ──────────────────────────

const DOM_SETUP = `
(() => {
  const listeners = new WeakMap();
  const listenersFor = (t) => { let l = listeners.get(t); if (!l) { l = []; listeners.set(t, l); } return l; };
  // A WebIDL accessor/method called on the wrong receiver throws exactly this.
  const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };

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
  Object.defineProperty(CustomEvent.prototype, 'detail', {
    get() { return this._detail; }, configurable: true, enumerable: true,
  });

  // ── Navigator: three accessors the shim patches, one it never touches ──
  const REAL = { userAgent: ${JSON.stringify(REAL_UA)}, platform: 'MacIntel', hardwareConcurrency: 12, webdriver: false };
  class Navigator {}
  for (const k of Object.keys(REAL)) {
    Object.defineProperty(Navigator.prototype, k, {
      get() { brand(this, Navigator); return REAL[k]; }, configurable: true, enumerable: true,
    });
  }

  class Element extends EventTarget {}
  class HTMLElement extends Element {}
  class CanvasRenderingContext2D {
    constructor(canvas) { this.canvas = canvas; this._buf = new Uint8ClampedArray(canvas.width * canvas.height * 4); this.font = '10px sans-serif'; }
    fillRect() {}
    fillText() {}
    getImageData(sx, sy, sw, sh) {
      brand(this, CanvasRenderingContext2D);
      const W = this.canvas.width; const out = new Uint8ClampedArray(sw * sh * 4);
      for (let r = 0; r < sh; r++) for (let c = 0; c < sw; c++) {
        const s = ((sy + r) * W + (sx + c)) * 4, d = (r * sw + c) * 4;
        for (let k = 0; k < 4; k++) out[d + k] = this._buf[s + k];
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
    drawImage() {}
    measureText(t) { brand(this, CanvasRenderingContext2D); return { width: t.length * 7 }; }
  }
  class HTMLCanvasElement extends HTMLElement {
    constructor() { super(); this.width = 300; this.height = 150; this._ctx = null; }
    getContext() { if (!this._ctx) this._ctx = new CanvasRenderingContext2D(this); return this._ctx; }
    toDataURL() { brand(this, HTMLCanvasElement); return 'data:fake,' + (this._ctx ? Array.from(this._ctx._buf).join(',') : ''); }
    toBlob(cb) { cb(null); }
  }
  class MutationObserver { observe() {} disconnect() {} }

  const document = new EventTarget();
  document.createElement = (tag) => (tag === 'canvas' ? new HTMLCanvasElement() : new HTMLElement());
  document.documentElement = { getAttribute: () => null, removeAttribute() {}, setAttribute() {} };
  document.body = new HTMLElement();

  Object.assign(globalThis, {
    EventTarget, Event, CustomEvent, Navigator, navigator: Object.create(Navigator.prototype),
    Element, HTMLElement, HTMLCanvasElement, CanvasRenderingContext2D, MutationObserver, document,
    getComputedStyle: () => ({ fontFamily: '', fontSize: '', fontWeight: '', fontStyle: '', letterSpacing: '' }),
  });
})();
`;

/**
 * Every function-valued own property (value / get / set) on `Function.prototype`,
 * on every global constructor's prototype, and on every global object. Taken
 * BEFORE and AFTER the shim boots, the diff is exactly "what the shim installed".
 */
const SNAPSHOT = `
(() => {
  const out = [];
  const targets = [['Function.prototype', Function.prototype]];
  for (const name of Object.getOwnPropertyNames(globalThis)) {
    if (name === 'globalThis') continue;
    let v; try { v = globalThis[name]; } catch (_) { continue; }
    if (typeof v === 'function' && v.prototype && typeof v.prototype === 'object') targets.push([name + '.prototype', v.prototype]);
    else if (v && typeof v === 'object') targets.push([name, v]);
  }
  for (const [label, obj] of targets) {
    for (const key of Reflect.ownKeys(obj)) {
      const d = Object.getOwnPropertyDescriptor(obj, key);
      for (const kind of ['value', 'get', 'set']) {
        if (typeof d[kind] === 'function') out.push({ label, key: String(key), kind, fn: d[kind] });
      }
    }
  }
  return out;
})()
`;

/**
 * The probes, verbatim from CreepJS \`queryLies\` (own property names, own keys,
 * \`'prototype' in\`, \`class extends\`, \`new\`, \`.arguments\`/\`.caller\`) and the
 * harness's \`shape()\`. Evaluated in the page realm, as a page would.
 */
const PROBE = `
(f) => {
  const r = {
    names: Object.getOwnPropertyNames(f).sort().join(','),
    ownKeys: Reflect.ownKeys(f).map(String).sort().join(','),
    protoIn: 'prototype' in f,
    protoDesc: Object.getOwnPropertyDescriptor(f, 'prototype') !== undefined,
  };
  try { class X extends f {} r.extends = 'no-throw'; } catch (e) { r.extends = e.constructor.name; }
  try { new f(); r.construct = 'no-throw'; } catch (e) { r.construct = e.constructor.name; }
  try { void f.arguments; void f.caller; r.arguments = 'no-throw'; } catch (e) { r.arguments = e.constructor.name; }
  return r;
}
`;

/** What Chrome's own native accessors and methods read under PROBE. */
const NATIVE = {
  names: 'length,name', ownKeys: 'length,name', protoIn: false, protoDesc: false,
  extends: 'TypeError', construct: 'TypeError', arguments: 'TypeError',
};

function bootRealm() {
  const logs = [];
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn: (...a) => logs.push(String(a[0])), error: (...a) => logs.push(String(a[0])) },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });
  const before = page(SNAPSHOT);
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  const after = page(SNAPSHOT);
  // `{ ...r }`: the probe's result object belongs to the vm realm, and
  // `deepStrictEqual` compares prototypes — copy it into this realm first.
  const rawProbe = page(PROBE);
  const probe = (f) => ({ ...rawProbe(f) });
  const desc = (objExpr, prop) => page(`Object.getOwnPropertyDescriptor(${objExpr}, ${JSON.stringify(prop)})`);
  const find = (list, label, key, kind) => list.find((e) => e.label === label && e.key === key && e.kind === kind);
  /** `Function.prototype.toString` of the realm, applied to a function handle from the realm. */
  const nativeSrc = (fn) => { ctx.__f = fn; try { return page('Function.prototype.toString.call(__f)'); } finally { delete ctx.__f; } };
  return { ctx, page, logs, before, after, probe, desc, find, nativeSrc };
}

const UA = ['Navigator.prototype', 'userAgent', 'get'];
const GID = ['CanvasRenderingContext2D.prototype', 'getImageData', 'value'];
const TS = ['Function.prototype', 'toString', 'value'];
const WD = ['Navigator.prototype', 'webdriver', 'get'];

// ═══════════════════════════════════════════════════════════════════════════
// §3b — the three shape probes, on a patched accessor, a patched method, and
// the toString replacement; with an unpatched control and a negative control.
// ═══════════════════════════════════════════════════════════════════════════

test('CV-3b GUARD: a patched ACCESSOR (Navigator.prototype.userAgent getter) has the shape of a native getter', () => {
  const s = bootRealm();
  const was = s.find(s.before, ...UA).fn, is = s.find(s.after, ...UA).fn;
  assert.notEqual(is, was, 'precondition: the shim did patch userAgent (otherwise the probe is vacuous)');
  assert.deepEqual(s.probe(is), NATIVE, 'REGRESSION: the patched getter is a plain function — own `prototype`, constructible, `class extends` does not throw');
});

test('CV-3b GUARD: a patched METHOD (CanvasRenderingContext2D.prototype.getImageData) has the shape of a native method', () => {
  const s = bootRealm();
  const was = s.find(s.before, ...GID).fn, is = s.find(s.after, ...GID).fn;
  assert.notEqual(is, was, 'precondition: the shim did patch getImageData');
  assert.deepEqual(s.probe(is), NATIVE, 'REGRESSION: the patched method is a plain function');
});

test('CV-3a GUARD: the Function.prototype.toString replacement has a native shape (it is the root of the 198-API cascade)', () => {
  const s = bootRealm();
  const was = s.find(s.before, ...TS).fn, is = s.find(s.after, ...TS).fn;
  assert.notEqual(is, was, 'precondition: the shim did patch Function.prototype.toString');
  assert.deepEqual(s.probe(is), NATIVE, 'REGRESSION: the toString replacement is a plain function — CreepJS flags EVERY API through it');
  // CreepJS's `failed toString`, second half: `apiFunction.toString` must itself read native.
  assert.equal(s.page('Function.prototype.toString.toString()'), 'function toString() { [native code] }');
  assert.equal(s.page('Function.prototype.toString.call(Function.prototype.toString)'), 'function toString() { [native code] }');
});

test('CV-3b CONTROL: an accessor the shim never touches (Navigator.prototype.webdriver) is the same function and reads native', () => {
  const s = bootRealm();
  const was = s.find(s.before, ...WD).fn, is = s.find(s.after, ...WD).fn;
  assert.equal(is, was, 'webdriver must stay unpatched — it is the harness\'s positive control');
  assert.deepEqual(s.probe(is), NATIVE);
  // Negative control: the probe DOES discriminate. A page's own plain function
  // fails it (sloppy page code also carries own `arguments`/`caller`; strict
  // code — the shim is strict — does not, and still fails on `prototype`).
  for (const src of ['(function pageFn() {})', '(function () { "use strict"; return function pageFn() {}; })()']) {
    const plain = s.probe(s.page(src));
    assert.match(plain.names, /(^|,)prototype(,|$)/, src);
    assert.equal(plain.protoIn, true, src);
    assert.equal(plain.protoDesc, true, src);
    assert.equal(plain.extends, 'no-throw', src);
    assert.equal(plain.construct, 'no-throw', src);
  }
});

test('CV-3b SWEEP: every function the shim installed anywhere in the realm has a native shape', () => {
  const s = bootRealm();
  const changed = s.after.filter((e) => {
    const prev = s.find(s.before, e.label, e.key, e.kind);
    return !prev || prev.fn !== e.fn;
  });
  const names = changed.map((e) => `${e.label}.${e.key}#${e.kind}`).sort();
  for (const must of ['Function.prototype.toString#value', 'Navigator.prototype.userAgent#get',
    'CanvasRenderingContext2D.prototype.getImageData#value', 'HTMLCanvasElement.prototype.toDataURL#value']) {
    assert.ok(names.includes(must), `precondition: the sweep sees ${must} as installed by the shim (saw: ${names.join(', ')})`);
  }
  const bad = [];
  for (const e of changed) {
    const r = s.probe(e.fn);
    try { assert.deepEqual(r, NATIVE); } catch (_) { bad.push(`${e.label}.${e.key}#${e.kind} → ${JSON.stringify(r)}`); }
    // …and every one of them must be one the shim MASKS, or the sweep is looking at the wrong thing.
    assert.match(s.nativeSrc(e.fn), /\[native code\]/,
      `${e.label}.${e.key}#${e.kind} changed but is not masked — not a shim install?`);
  }
  assert.deepEqual(bad, [], `REGRESSION: shim-installed functions with a non-native shape:\n${bad.join('\n')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// What the fix must NOT cost. Green before the fix; they exist to stay green.
// ═══════════════════════════════════════════════════════════════════════════

test('CV-3b KEEP: the brand check survives — a patched accessor or method called with a wrong receiver still throws Illegal invocation (ARKENFOX (f))', () => {
  const s = bootRealm();
  assert.throws(() => s.page('Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get.call({})'),
    (e) => e.constructor.name === 'TypeError' && /Illegal invocation/.test(e.message));
  assert.throws(() => s.page('CanvasRenderingContext2D.prototype.getImageData.call({}, 0, 0, 1, 1)'),
    (e) => e.constructor.name === 'TypeError' && /Illegal invocation/.test(e.message));
  assert.throws(() => s.page('new (Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get)()'),
    (e) => e.constructor.name === 'TypeError');
  // …and the RIGHT receiver still goes through: the persona, not the machine.
  const ua = s.page('navigator.userAgent');
  assert.equal(typeof ua, 'string');
  assert.notEqual(ua, REAL_UA, 'the getter must still forward `this` to the delegate and serve the persona');
  assert.match(ua, /Chrome\//);
  const px = s.page('document.createElement("canvas").getContext("2d").getImageData(0, 0, 2, 2).data.length');
  assert.equal(px, 16, 'the method must still forward `this` and its arguments');
});

test('CV-3b KEEP: descriptors keep their original enumerable / configurable / writable flags and the original setter', () => {
  const s = bootRealm();
  const ua = s.desc('Navigator.prototype', 'userAgent');
  assert.deepEqual([ua.enumerable, ua.configurable, ua.set], [true, true, undefined]);
  const gid = s.desc('CanvasRenderingContext2D.prototype', 'getImageData');
  assert.deepEqual([gid.writable, gid.enumerable, gid.configurable], [true, false, true]);
  const ts = s.desc('Function.prototype', 'toString');
  assert.deepEqual([ts.writable, ts.enumerable, ts.configurable], [true, false, true]);
});

test('CV-3b KEEP: toString masking, name and length are unchanged by the shape fix', () => {
  const s = bootRealm();
  assert.equal(s.page('Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get.toString()'), 'function get userAgent() { [native code] }');
  assert.equal(s.page('CanvasRenderingContext2D.prototype.getImageData.toString()'), 'function getImageData() { [native code] }');
  assert.equal(s.page('HTMLCanvasElement.prototype.toDataURL.toString()'), 'function toDataURL() { [native code] }');
  assert.match(s.page('(function pageFn() { return 42; }).toString()'), /return 42/, 'a genuine page function still prints its source');
  assert.equal(s.page('Object.getOwnPropertyDescriptor(Navigator.prototype, "userAgent").get.name'), 'get userAgent');
  assert.equal(s.page('CanvasRenderingContext2D.prototype.getImageData.name'), 'getImageData');
  assert.equal(s.page('CanvasRenderingContext2D.prototype.getImageData.length'), 4, 'length is the original\'s (4 params in the fake, 4 in Chrome)');
  for (const [obj, prop] of [['Navigator.prototype', 'userAgent'], ['CanvasRenderingContext2D.prototype', 'getImageData']]) {
    const f = obj === 'Navigator.prototype' ? `Object.getOwnPropertyDescriptor(${obj}, "${prop}").get` : `${obj}.${prop}`;
    for (const own of ['name', 'length']) {
      const d = s.page(`Object.getOwnPropertyDescriptor(${f}, "${own}")`);
      assert.deepEqual([d.writable, d.enumerable, d.configurable], [false, false, true], `${prop}.${own} descriptor matches a native's`);
    }
  }
});
