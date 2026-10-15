/**
 * D54 (2026-10-14) — under Firefox's privacy.resistFingerprinting, Nullecho's WHOLE device layer
 * stands down. Blocking and Global Privacy Control stay on.
 *
 * Measured in real Firefox 156 with RFP on and the D53 build: WebGL was left alone, but the page
 * read hardwareConcurrency 10 — the persona's — where RFP reports 8 for everyone. RFP's protection
 * is that every RFP user reports the same values; one overridden value makes this user the one who
 * differs. So nothing that overrides a value may be installed when `GECKO_RFP` holds.
 *
 * The strong test here is a SNAPSHOT: every own property descriptor of every interface prototype in
 * the realm, taken before the shim boots and again after the authenticated handshake. Under RFP the
 * only differences allowed are the four that are not device values — the `Function.prototype.toString`
 * mask, the GPC getter, and the two child-realm doors that carry those two into frames. A patch group
 * added later and not gated on RFP fails here without anyone having to remember this file.
 *
 * Also: the fifth RFP signal (D54), a VETO from the page clock — RFP's 16.667 ms rounding makes
 * `performance.now()` at document_start 0 or 16.667 (measured), a normal Firefox's 1 ms rounding a
 * small positive integer (6–16 measured).
 *
 * Run against the D53 shim (`NULLECHO_SHIM_SRC`): the snapshot and value tests fail.
 * Run: `node --test` from `ext/`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootRealm } from './test-realm-rig.js';
import { PERSONAS, FONT_SETS } from './personas.js';

const FIREFOX = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:156.0) Gecko/20100101 Firefox/156.0',
  appVersion: '5.0 (Macintosh)', platform: 'MacIntel', vendor: '',
};
const RFP_CLOCK = { zone: 'Atlantic/Reykjavik', jan: 0, jul: 0 };
const LA = { zone: 'America/Los_Angeles', jan: 480, jul: 420 };
const RFP_SCREEN = { width: 800, height: 600, availWidth: 800, availHeight: 600, availLeft: 0, availTop: 0, colorDepth: 24 };
const MAC_SCREEN = { width: 1512, height: 982, availWidth: 1512, availHeight: 906, availLeft: 0, availTop: 25, colorDepth: 30 };

function engineSrc({ clock = RFP_CLOCK, screen = RFP_SCREEN, now = 16.667 } = {}) {
  return `(() => {
    const brand = (self, C) => { if (!(self instanceof C)) throw new TypeError('Illegal invocation'); };
    const ro = (C, name, read) => Object.defineProperty(C.prototype, name, {
      get() { brand(this, C); return read(this); }, configurable: true, enumerable: true });
    ro(Navigator, 'oscpu', () => 'Intel Mac OS X 10.15');
    ro(Navigator, 'buildID', () => '20181001000000');
    // WebGL, WebGPU and an AnalyserNode, so every persona group has something to patch.
    const gl = (name) => {
      const C = { [name]: class {} }[name];
      for (const m of ['getParameter', 'getSupportedExtensions', 'getExtension', 'readPixels']) {
        Object.defineProperty(C.prototype, m, { configurable: true, writable: true,
          value: { [m](...a) { brand(this, C); return m === 'getParameter' ? 'Mozilla' : (m === 'getSupportedExtensions' ? [] : null); } }[m] });
      }
      return C;
    };
    globalThis.WebGLRenderingContext = gl('WebGLRenderingContext');
    globalThis.WebGL2RenderingContext = gl('WebGL2RenderingContext');
    class GPUAdapterInfo {}
    for (const k of ['vendor', 'architecture', 'device', 'description']) ro(GPUAdapterInfo, k, () => '');
    ro(GPUAdapterInfo, 'subgroupMinSize', () => 4); ro(GPUAdapterInfo, 'subgroupMaxSize', () => 128);
    globalThis.GPUAdapterInfo = GPUAdapterInfo;
    class GPUSupportedLimits {}
    ro(GPUSupportedLimits, 'maxTextureDimension2D', () => 16384);
    globalThis.GPUSupportedLimits = GPUSupportedLimits;
    class AnalyserNode {}
    Object.defineProperty(AnalyserNode.prototype, 'getFloatFrequencyData', { configurable: true, writable: true, value: function getFloatFrequencyData(a) { a.fill(-50); } });
    Object.defineProperty(AnalyserNode.prototype, 'getByteFrequencyData', { configurable: true, writable: true, value: function getByteFrequencyData(a) { a.fill(7); } });
    globalThis.AnalyserNode = AnalyserNode;
    class Screen {}
    const SCR = ${JSON.stringify(screen)};
    for (const k of Object.keys(SCR)) ro(Screen, k, () => SCR[k]);
    globalThis.Screen = Screen;
    globalThis.screen = Object.create(Screen.prototype);
    const CLOCK = ${JSON.stringify(clock)};
    class DateTimeFormat { resolvedOptions() { return { timeZone: CLOCK.zone }; } }
    Intl.DateTimeFormat = DateTimeFormat;
    const getMonth = Date.prototype.getMonth;
    Date.prototype.getTimezoneOffset = function getTimezoneOffset() { return getMonth.call(this) < 6 ? CLOCK.jan : CLOCK.jul; };
    globalThis.performance = { now: () => ${JSON.stringify(now)} };

    // Every own descriptor of every interface prototype, plus Function.prototype.toString.
    globalThis.__snap = () => {
      const out = new Map();
      for (const name of Object.getOwnPropertyNames(globalThis)) {
        if (name.startsWith('__')) continue;
        let v; try { v = globalThis[name]; } catch (_) { continue; }
        if (typeof v !== 'function' || !v.prototype || typeof v.prototype !== 'object') continue;
        for (const k of Reflect.ownKeys(v.prototype)) {
          const d = Object.getOwnPropertyDescriptor(v.prototype, k);
          out.set(name + '.prototype.' + String(k), [d.value, d.get, d.set]);
        }
      }
      return out;
    };
    globalThis.__before = __snap();
    globalThis.__diff = () => {
      const after = __snap();
      const changed = [];
      for (const [k, v] of after) { const b = __before.get(k); if (!b || b[0] !== v[0] || b[1] !== v[1] || b[2] !== v[2]) changed.push(k); }
      for (const k of __before.keys()) if (!after.has(k)) changed.push(k + ' (removed)');
      return changed.sort();
    };
  })();`;
}

function delivered(id = 'macos-chrome-m1-pro') {   // 10 cores — the value measured leaking through RFP
  const p = PERSONAS.find((x) => x.id === id);
  return { ...p, fontList: FONT_SETS[p.fonts], noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 0x1234abcd };
}

function boot(engine) {
  const r = bootRealm({ real: FIREFOX, engine: engineSrc(engine) });
  r.upgrade({ persona: delivered(), gpc: true });   // the user's GPC setting: on
  return r;
}

/** The four non-device changes the shim may make under RFP. */
const RFP_ALLOWED = [
  'Function.prototype.toString',
  'HTMLIFrameElement.prototype.contentWindow',
  'Navigator.prototype.globalPrivacyControl',
];

test('D54: under resistFingerprinting nothing that overrides a device value is installed — only toString, GPC and the frame doors', () => {
  const r = boot({});
  const changed = r.page('JSON.stringify(__diff())');
  const list = JSON.parse(changed);
  const unexpected = list.filter((k) => !RFP_ALLOWED.includes(k) && !/^(Node|Element|Document)\.prototype\./.test(k));
  assert.deepEqual(unexpected, [], `persona patches installed under RFP: ${unexpected.join(', ')}`);
  // The insertion doors (same-tick child realms) are frame plumbing, not device values; say which they are.
  for (const k of list.filter((x) => /^(Node|Element|Document)\.prototype\./.test(x))) {
    assert.match(k, /\.(appendChild|insertBefore|replaceChild|append|prepend|before|after|replaceWith|insertAdjacentElement|insertAdjacentHTML|innerHTML|outerHTML|replaceChildren|write|writeln|setHTMLUnsafe)$/, `${k} is not a frame door`);
  }
  assert.ok(list.includes('Navigator.prototype.globalPrivacyControl'), 'GPC stays on under RFP');
});

test('D54: under resistFingerprinting every value is the engine\'s — cores, canvas, text metrics, audio, WebGPU', () => {
  const r = boot({});
  assert.equal(r.page('navigator.hardwareConcurrency'), 12, 'the engine\'s cores, not the persona\'s 10');
  assert.equal(r.page('navigator.globalPrivacyControl'), true, 'GPC still sent');
  assert.equal(r.page(`(() => { const c = document.createElement('canvas'); c.width = 8; c.height = 8;
    const x = c.getContext('2d'); x.fillRect(0, 0, 8, 8); return c.toDataURL() === __natives.toDataURL.call(c); })()`), true, 'canvas read-back untouched');
  assert.equal(r.page(`(() => { const x = document.createElement('canvas').getContext('2d'); x.font = '10px Arial';
    return x.measureText('hello').width === __natives.measureText.call(x, 'hello').width; })()`), true, 'text metrics untouched');
  assert.equal(r.page(`(() => { const b = new AudioBuffer(64, 1); const a = Array.from(b.getChannelData(0));
    const fresh = new AudioBuffer(64, 1); return a.every((v, i) => v === Array.from(fresh.getChannelData(0))[i]); })()`), true, 'audio untouched');
  assert.equal(r.page('Object.create(GPUSupportedLimits.prototype).maxTextureDimension2D'), 16384, 'WebGPU limits not clamped');
  assert.ok(r.statuses.some((s) => s.reason === 'resist-fingerprinting'), 'and the shim says why');
});

test('D54 GUARD: the same Firefox WITHOUT resistFingerprinting gets the persona (the control for both tests above)', () => {
  const r = boot({ clock: LA, screen: MAC_SCREEN, now: 12 });
  assert.equal(r.page('navigator.hardwareConcurrency'), 10);
  const list = JSON.parse(r.page('JSON.stringify(__diff())'));
  for (const k of ['Navigator.prototype.hardwareConcurrency', 'HTMLCanvasElement.prototype.toDataURL', 'CanvasRenderingContext2D.prototype.measureText',
    'AudioBuffer.prototype.getChannelData', 'GPUSupportedLimits.prototype.maxTextureDimension2D', 'WebGLRenderingContext.prototype.readPixels']) {
    assert.ok(list.includes(k), `${k} is patched without RFP`);
  }
  assert.ok(r.statuses.some((s) => s.upgraded === true));
});

test('D54: the page-clock veto — RFP\'s 0 or 16.667 ms stands down; a 1 ms clock\'s whole number vetoes the other four signals', () => {
  for (const now of [0, 16.667, 33.334, 100, 200]) {
    assert.equal(boot({ now }).page('navigator.hardwareConcurrency'), 12, `performance.now() = ${now} at boot: RFP, stand down`);
  }
  for (const now of [6, 12, 16, 101]) {
    assert.equal(boot({ now }).page('navigator.hardwareConcurrency'), 10, `performance.now() = ${now} at boot: not RFP, persona applies`);
  }
  // A cross-origin-isolated page's 20 µs clock is fractional: no veto, the other four decide.
  assert.equal(boot({ now: 12.34 }).page('navigator.hardwareConcurrency'), 12);
});
