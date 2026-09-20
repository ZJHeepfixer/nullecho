/**
 * Nullecho — ONE `Function.prototype.toString` mask per realm (D46)
 * ═════════════════════════════════════════════════════════════════
 * THE REGRESSION, measured 2026-09-20 with `ext/` loaded UNPACKED into Chrome
 * for Testing 149 (`harness/unpacked-chrome.mjs claim`):
 *
 *      lieCount 199 · hasToStringProxy true · extensionHashPattern 30
 *
 * on both loopback origins, against 2 / false / 0 for the same page in
 * page-script mode — which never loads `gpc.js`. D38 had given `gpc.js` its own
 * `Function.prototype.toString` wrapper layered over the one `shim.js` owns,
 * because a separate classic content script has no way into the shim's
 * `NATIVE_SRC` WeakMap. From ANY other realm that wrapper was readable: the
 * child's mask asks `NATIVE_SRC` about the top realm's
 * `Function.prototype.toString`, no shim closure knows that function, so it
 * delegates to the child's native and prints the wrapper's source. CreepJS
 * turns one revealed `toString` into a `failed toString` lie on every API it
 * audits. Decisive control on the day: the same build with `src/gpc.js` dropped
 * from the manifest read 2 / false / 0.
 *
 * THE RULE: one mask per realm, owned by `shim.js`. The shim installs
 * `navigator.globalPrivacyControl` itself now, through `markNative`, and
 * `gpc.js` stands aside wherever it finds the signal already up — see D46.
 *
 * The rig is the one `native-source-2026-09-19.test.js` uses: a `node:vm` realm
 * with a fake `Function.prototype.toString` installed BEFORE `shim.js` boots, so
 * the shim's boot-captured copy is the fake — exactly the position a real engine
 * is in. `chrome` prints V8's spelling, `firefox` SpiderMonkey's; both were
 * measured in the real browsers on 2026-09-19.
 *
 * The cross-realm proof itself is a BROWSER measurement, not a vm one, and it
 * lives in `harness/unpacked-chrome.mjs claim` (D46's receipt). What this file
 * pins is the invariant that makes it hold: after both MAIN-world scripts have
 * run, `Function.prototype.toString` is still the function `shim.js` installed
 * and registered in `NATIVE_SRC`.
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
const GPC_SRC = fs.readFileSync(path.join(HERE, 'gpc.js'), 'utf8');
const readJSON = (p) => JSON.parse(fs.readFileSync(path.join(HERE, '..', p), 'utf8'));

/**
 * A page realm with enough DOM for the shim to patch. Lifted verbatim from
 * `native-source-2026-09-19.test.js`, because what is under test here is how the
 * same two files compose.
 */
const DOM_SETUP = `
(() => {
  const NATIVES = new WeakSet();
  globalThis.__isNative = (f) => NATIVES.has(f);
  globalThis.__markNative = (f) => { if (typeof f === 'function') NATIVES.add(f); return f; };
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

/**
 * Boot one realm: DOM, then the fake engine, then `shim.js`, then `gpc.js` —
 * manifest order. `gpc` false leaves gpc.js out (a shipped-breakage host, where
 * its content script is `exclude_matches`-ed off).
 */
function bootRealm({ engine = 'chrome', hostname = 'example.test', gpc = true,
                     nativeGpc, origin } = {}) {
  const sandbox = {
    location: { hostname, origin: origin ?? `https://${hostname || 'example.test'}` },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  const page = (code) => vm.runInContext(code, ctx, { filename: 'page.js' });
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });

  // Firefox ships GPC natively; `nativeGpc` installs that starting state, as a
  // getter-shorthand accessor the realm calls native.
  if (nativeGpc !== undefined) {
    page(`(() => {
      const h = { get globalPrivacyControl() { return ${nativeGpc}; } };
      const g = Object.getOwnPropertyDescriptor(h, 'globalPrivacyControl').get;
      globalThis.__nativeGpcGet = g;
      globalThis.__markNative(g);
      Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {
        get: g, configurable: true, enumerable: true,
      });
    })();`);
  }

  vm.runInContext(ENGINE(engine), ctx, { filename: 'engine.js' });

  let gpcBoot = null;
  ctx.document.addEventListener('nullecho:status', (e) => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (d.phase === 'boot' && d.channel === 'gpc') gpcBoot = d;
  }, true);
  let shimBoot = null;
  ctx.document.addEventListener('nullecho:status', (e) => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (_) { return; }
    if (d.phase === 'boot' && d.channel === 'shim') shimBoot = d;
  }, true);

  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  const afterShim = {
    toString: page('Function.prototype.toString'),
    getter: page(`(Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl') || {}).get`),
  };
  if (gpc) vm.runInContext(GPC_SRC, ctx, { filename: 'gpc.js' });

  const send = (payload) => page(
    `document.dispatchEvent(new CustomEvent('nullecho:persona', { detail: ${JSON.stringify(JSON.stringify(payload))} }))`,
  );
  const descriptor = () => page(`Object.getOwnPropertyDescriptor(Navigator.prototype, 'globalPrivacyControl')`);
  return {
    ctx, page, afterShim, send, descriptor,
    get shimBoot() { return shimBoot; },
    get gpcBoot() { return gpcBoot; },
    value: () => page('navigator.globalPrivacyControl'),
    src: (expr) => page(`Function.prototype.toString.call(${expr})`),
    deliver: (over = {}) => send({
      ok: true, enabled: true, gpc: true, site: hostname, persona: DELIVERED,
      nonce: shimBoot && shimBoot.nonce, gpcNonce: gpcBoot && gpcBoot.nonce, ...over,
    }),
  };
}

/** Enough of a persona to pass `validPersona`; none of it is what is under test. */
const DELIVERED = {
  id: 'macos-chrome-m1-pro', platform: 'MacIntel', ua: 'Mozilla/5.0 (delivered)',
  uaData: { platform: 'macOS', platformVersion: '14.6.0', architecture: 'arm', bitness: '64', model: '', wow64: false },
  gpu: { vendor: 'v', renderer: 'r', unmaskedVendor: 'v', maxTextureSize: 16384 },
  cores: 10, memory: 32,
  screen: { width: 2560, height: 1440, availHeight: 1415, colorDepth: 24, dpr: 1 },
  fontList: ['Helvetica'], noise: { canvas: 0.31, audio: 0.57, webgl: 0.73 }, seed: 0x0badf00d,
};

/** The CreepJS / review shape probes, run inside the realm that owns the function. */
const shapeOf = (s, expr) => s.page(`(() => {
  const f = ${expr};
  const r = { names: Object.getOwnPropertyNames(f).sort().join(','), protoIn: 'prototype' in f };
  try { class X extends f {} r.extends = 'no-throw'; } catch (e) { r.extends = e.constructor.name; }
  try { new f(); r.construct = 'no-throw'; } catch (e) { r.construct = e.constructor.name; }
  return r;
})()`);
const NATIVE_SHAPE = { names: 'length,name', protoIn: false, extends: 'TypeError', construct: 'TypeError' };
/** A vm realm's objects fail `deepEqual` on prototype identity alone; compare structure. */
const plain = (x) => JSON.parse(JSON.stringify(x));

// ═══════════════════════════════════════════════════════════════════════════
// 1. ONE mask per realm — the regression itself
// ═══════════════════════════════════════════════════════════════════════════

test('D46: gpc.js does not replace Function.prototype.toString when shim.js already owns it', () => {
  const s = bootRealm();
  assert.ok(s.gpcBoot, 'sanity: gpc.js still booted and published its nonce');
  assert.equal(s.page('Function.prototype.toString'), s.afterShim.toString,
    'REGRESSION: a SECOND toString mask — every other realm delegates to its native and prints it');
});

test('D46: the realm ends with exactly one masking layer, and it is the shim\'s', () => {
  const s = bootRealm();
  // The layer the shim installed answers for ITSELF, which is what makes every
  // OTHER realm's copy of the same closure answer for it too (shared NATIVE_SRC).
  assert.equal(s.page('Function.prototype.toString.call(Function.prototype.toString)'),
    'function toString() { [native code] }');
  // And it is not wrapped: unwrapping one layer would reach shim source.
  const self = s.page('Function.prototype.toString');
  assert.equal(self, s.afterShim.toString);
});

test('D46 CONTROL: with no shim in the realm, gpc.js still masks — it is the only layer there', () => {
  const sandbox = {
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, queueMicrotask,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  vm.runInContext(ENGINE('chrome'), ctx, { filename: 'engine.js' });
  const before = vm.runInContext('Function.prototype.toString', ctx);
  vm.runInContext(GPC_SRC, ctx, { filename: 'gpc.js' });
  const page = (c) => vm.runInContext(c, ctx, { filename: 'page.js' });
  assert.equal(page('navigator.globalPrivacyControl'), true, 'gpc.js is the whole feature here');
  assert.notEqual(page('Function.prototype.toString'), before,
    'with nothing underneath, gpc.js must still mask its own getter');
  assert.equal(page(`Function.prototype.toString.call(Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl').get)`),
    'function get globalPrivacyControl() { [native code] }');
});

test('D46: gpc.js masks only when it OWNS the property — the two bail conditions are the same three', () => {
  // No Navigator at all: neither file can install, so neither may mask.
  const ctx = vm.createContext({
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, queueMicrotask,
  });
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  vm.runInContext('delete globalThis.Navigator; Object.defineProperty(globalThis, "navigator", { value: undefined, configurable: true });', ctx);
  const before = vm.runInContext('Function.prototype.toString', ctx);
  vm.runInContext(GPC_SRC, ctx, { filename: 'gpc.js' });
  assert.equal(vm.runInContext('Function.prototype.toString', ctx), before,
    'gpc.js masked a realm it could not install into');
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. The shim owns the property; gpc.js stands aside (D46)
// ═══════════════════════════════════════════════════════════════════════════

test('D46: shim.js installs navigator.globalPrivacyControl, and gpc.js leaves that getter alone', () => {
  const s = bootRealm();
  assert.ok(s.afterShim.getter, 'the shim installed the property before gpc.js ran');
  assert.equal(s.descriptor().get, s.afterShim.getter, 'gpc.js redefined the shim\'s getter');
  assert.equal(s.value(), true, 'ON is the shipped default, presented from document_start');
});

test('D38/D43 KEEP: the shim\'s getter is named and shaped like a WebIDL accessor', () => {
  const s = bootRealm();
  assert.equal(s.page(`Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl').get.name`),
    'get globalPrivacyControl');
  assert.deepEqual(plain(shapeOf(s, `Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl').get`)),
    NATIVE_SHAPE);
  const d = s.descriptor();
  assert.equal(d.set, undefined, 'a readonly attribute has no setter');
  assert.equal(d.enumerable, true);
  assert.equal(d.configurable, true);
});

for (const [engine, want] of [
  ['chrome', 'function get globalPrivacyControl() { [native code] }'],
  ['firefox', 'function globalPrivacyControl() {\n    [native code]\n}'],
]) {
  test(`D38/D43 KEEP: on ${engine} the getter stringifies in that engine's own spelling`, () => {
    const s = bootRealm({ engine });
    assert.equal(s.src(`Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl').get`), want);
    // …and byte-identical to an accessor on the same interface the shim never touches.
    const control = s.src(`Object.getOwnPropertyDescriptor(Navigator.prototype,'webdriver').get`);
    assert.equal(want, control.split('webdriver').join('globalPrivacyControl'));
  });
}

test('D37 KEEP: an authenticated gpc:false leaves the property reading FALSE, not undefined', () => {
  const s = bootRealm();
  s.deliver({ gpc: false });
  assert.equal(s.value(), false, 'the spec: "The value is false if no Sec-GPC header field would be sent"');
  assert.ok(s.descriptor(), 'the property must still exist');
  assert.equal(s.src(`Object.getOwnPropertyDescriptor(Navigator.prototype,'globalPrivacyControl').get`),
    'function get globalPrivacyControl() { [native code] }',
    'an excepted site must not get a louder tell than an on one');
});

test('D37 KEEP: a whole-extension stand-down restores the ORIGINAL state — absent where the browser had none', () => {
  const s = bootRealm();
  s.deliver({ enabled: false, persona: null });
  assert.equal(s.descriptor(), undefined,
    'allowlisted means Nullecho is not here; a stock Chrome has no such property');
  assert.equal(s.value(), undefined);
});

test('D46: gpc.js must not put a stood-down property back — the exact hole a second owner opens', () => {
  // gpc.js hears the shim's relay on the same stand-down and used to redefine
  // whatever descriptor it captured at boot, which is now the SHIM's getter.
  const s = bootRealm();
  assert.ok(s.gpcBoot, 'sanity: the relay has somewhere to go');
  s.deliver({ enabled: false, persona: null });
  assert.equal(s.descriptor(), undefined, 'REGRESSION: gpc.js reinstated a removed accessor');
});

test('D37 KEEP: where the browser ships GPC and says false, standing the signal down hands the NATIVE back', () => {
  const s = bootRealm({ nativeGpc: false });
  assert.equal(s.value(), true, 'precondition: the shim raised the signal over the native false');
  s.deliver({ gpc: false });
  assert.equal(s.descriptor().get, s.page('__nativeGpcGet'),
    'an untouched native accessor is strictly better than an identical-looking replacement');
  assert.equal(s.value(), false);
});

test('D37 KEEP: a native GPC that is already ON is left completely alone by both files', () => {
  const s = bootRealm({ nativeGpc: true });
  assert.equal(s.descriptor().get, s.page('__nativeGpcGet'),
    'redefining a native true buys nothing and costs a double-shim tell');
  assert.equal(s.page('Function.prototype.toString'), s.afterShim.toString,
    'and neither file may mask a realm it did not install into');
  s.deliver({ gpc: false });
  assert.equal(s.descriptor().get, s.page('__nativeGpcGet'), 'and standing down must not delete it either');
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. The shipped breakage list — the one thing `exclude_matches` used to do
// ═══════════════════════════════════════════════════════════════════════════

/** The array literal inside shim.js's generated mirror, read as text. */
function shimBreakageHosts() {
  const block = /const GPC_BREAKAGE_HOSTS = setOf\(strSplit\(([\s\S]*?)'\|'\)\);/.exec(SHIM_SRC);
  assert.ok(block, 'shim.js lost its GPC breakage mirror');
  const joined = [...block[1].matchAll(/'([^']*)'/g)].map((m) => m[1]).join('');
  return joined.split('|').filter(Boolean);
}

test('D46: the shim\'s inlined breakage list is exactly rules/gpc.json rule 5000', () => {
  const rule = readJSON('rules/gpc.json').find((r) => r.id === 5000);
  const fromRules = [...rule.condition.excludedRequestDomains].sort();
  assert.deepEqual(shimBreakageHosts().sort(), fromRules,
    'a host in one list and not the other is a site that breaks, or a signal silently dropped');
});

test('D46: it is also exactly the manifest exclusion it replaces, in both manifests', () => {
  for (const name of ['manifest.json', 'manifest.firefox.json']) {
    const entry = readJSON(name).content_scripts.find((c) => (c.js ?? []).includes('src/gpc.js'));
    assert.ok(entry, `${name} no longer declares src/gpc.js`);
    const hosts = entry.exclude_matches.map((p) => p.replace(/^\*:\/\/\*\./, '').replace(/\/\*$/, '')).sort();
    assert.deepEqual(shimBreakageHosts().sort(), hosts, `GPC breakage drift against ${name}`);
  }
});

test('D46: on a shipped breakage host the shim installs nothing, and gpc.js is not there either', () => {
  for (const hostname of ['usaa.com', 'www.usaa.com', 'secure.login.usaa.com', 'spotify.com']) {
    const s = bootRealm({ hostname, gpc: false });   // exclude_matches keeps gpc.js off
    assert.equal(s.afterShim.getter, undefined, `${hostname}: shim.js installed the property that breaks these sites`);
    assert.equal(s.descriptor(), undefined, hostname);
    assert.equal(s.value(), undefined, hostname);
  }
});

test('D46: a look-alike host is NOT excluded, and an about:blank child inherits the parent\'s answer', () => {
  assert.equal(bootRealm({ hostname: 'notusaa.com' }).value(), true, 'suffix matching must be label-wise');
  assert.equal(bootRealm({ hostname: 'usaa.com.evil.test' }).value(), true);
  // `location.hostname` is '' in an about:blank/srcdoc child; its origin is the
  // parent's, which is what `match_origin_as_fallback` keys on.
  assert.equal(bootRealm({ hostname: '', origin: 'https://www.usaa.com', gpc: false }).value(), undefined,
    'a blank child of an excluded page must not raise the signal its parent suppresses');
  assert.equal(bootRealm({ hostname: '', origin: 'https://example.test' }).value(), true);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. The handshake still decides, and still cannot be decided by the page
// ═══════════════════════════════════════════════════════════════════════════

test('D29 KEEP: an absent `gpc` on a failure payload defaults the signal ON, not to Object.prototype', () => {
  const s = bootRealm();
  s.page('Object.prototype.gpc = false; Object.prototype.enabled = false;');
  s.send({ ok: false, reason: 'no response from Nullecho service worker',
    nonce: s.shimBoot.nonce, gpcNonce: s.gpcBoot.nonce });
  s.page('delete Object.prototype.gpc; delete Object.prototype.enabled;');
  assert.equal(s.value(), true, 'the page turned the user\'s do-not-sell signal off through a prototype');
});

test('D30 KEEP: an unauthenticated payload cannot take the signal down', () => {
  const s = bootRealm();
  s.send({ ok: true, enabled: true, gpc: false, site: 'a.test', nonce: '0'.repeat(32) });
  assert.equal(s.value(), true, 'the site the do-not-sell signal is aimed at switched it off without the nonce');
  s.deliver({ gpc: false });
  assert.equal(s.value(), false, 'control: the genuine delivery still takes it down');
});

test('D46: the signal never changes identity mid-document — OFF is a state write, not a redefine', () => {
  const s = bootRealm();
  const get = s.descriptor().get;
  s.deliver({ gpc: false });
  assert.equal(s.descriptor().get, get,
    'a descriptor that changes after the page has read it is a tell of its own');
});

test('D33 KEEP: neither file writes to the page console while installing the signal', () => {
  const said = [];
  const ctx = vm.createContext({
    location: { hostname: 'example.test', origin: 'https://example.test' },
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    console: { log: (...a) => said.push(a), info: (...a) => said.push(a), warn: (...a) => said.push(a), error: (...a) => said.push(a) },
    setTimeout, clearTimeout, queueMicrotask,
  });
  vm.runInContext(DOM_SETUP, ctx, { filename: 'dom-setup.js' });
  vm.runInContext(ENGINE('chrome'), ctx, { filename: 'engine.js' });
  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });
  vm.runInContext(GPC_SRC, ctx, { filename: 'gpc.js' });
  assert.deepEqual(said, [], `a MAIN-world script spoke to the page console: ${JSON.stringify(said)}`);
});
