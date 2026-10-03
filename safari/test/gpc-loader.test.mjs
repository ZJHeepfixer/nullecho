/**
 * Nullecho for Safari — the GPC loader against the real gpc.js.
 *
 * Two JavaScript realms sharing one DOM graph, as in ext/src/handshake-integration.test.js:
 * the ISOLATED realm runs safari/extension/src/gpc-loader.js, the MAIN realm runs
 * ext/src/gpc.js byte for byte. Injection in manifest order (loader first). The observable
 * is `navigator.globalPrivacyControl` in the MAIN realm, plus what the loader dispatched.
 *
 * `NULLECHO_GPC_LOADER_SRC=<file>` runs another loader (a mutant) to show a test failing.
 *
 * Run: `node --test safari/test/*.test.mjs` from the repo root (Node 22; `node --test safari/test/` needs a newer Node).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { HERE, EXT } from './helpers.mjs';
import { EVENTS, HANDSHAKE } from '../../ext/src/protocol.js';

const LOADER_PATH = process.env.NULLECHO_GPC_LOADER_SRC || path.resolve(HERE, '../extension/src/gpc-loader.js');
const LOADER_SRC = fs.readFileSync(LOADER_PATH, 'utf8');
const GPC_SRC = fs.readFileSync(path.join(EXT, 'src/gpc.js'), 'utf8');

/**
 * @param {object} [opts]
 * @param {boolean} [opts.nativeFalse]     the browser ships Navigator.prototype.globalPrivacyControl = false (macOS Safari 27)
 * @param {boolean} [opts.pageScriptRan]   the content scripts lost the document_start race
 * @param {boolean} [opts.loaderLast]      inject the loader AFTER gpc.js (the ordering the manifest forbids)
 * @param {boolean} [opts.noLoader]        do not inject the loader at all
 * @param {boolean} [opts.noCsprng]        the MAIN realm has no crypto.getRandomValues (gpc.js publishes nonce: null)
 * @param {boolean} [opts.notContentScript] the ISOLATED realm has no runtime.id
 * @param {object[]} [opts.preBoot]        status events a page script dispatches BEFORE gpc.js boots (forged boot)
 */
function runPage(opts = {}) {
  const { nativeFalse = false, pageScriptRan = false, loaderLast = false, noLoader = false, noCsprng = false,
    notContentScript = false, preBoot = null } = opts;

  // ── one DOM, shared by both realms ─────────────────────────────────────────
  const registry = new Map();
  const listenersOf = (t) => { if (!registry.has(t)) registry.set(t, []); return registry.get(t); };
  const windows = [];
  const dispatched = [];                     // every event that went through document.dispatchEvent
  let domWrites = 0;

  class Ev {
    constructor(type, init) { this.type = type; this._detail = init && init.detail; this._stopped = false; this._stoppedImmediate = false; }
    stopPropagation() { this._stopped = true; }
    stopImmediatePropagation() { this._stopped = true; this._stoppedImmediate = true; }
    /** DOM: reflects the stop-propagation flag, which stopImmediatePropagation also sets. */
    get cancelBubble() { return this._stopped; }
  }
  Object.defineProperty(Ev.prototype, 'detail', { get() { return this._detail; }, configurable: true });

  const document = {};
  const dom = {
    addEventListener(type, fn, capture) { listenersOf(this).push({ type, fn, capture: !!capture }); },
    removeEventListener() {},
    dispatchEvent(ev) {
      dispatched.push(ev);
      for (const w of windows) {
        for (const l of listenersOf(w).slice()) {
          if (ev._stoppedImmediate) break;
          if (l.type === ev.type && l.capture) l.fn.call(w, ev);
        }
        if (ev._stopped) return true;
      }
      for (const l of listenersOf(document).slice()) {
        if (ev._stoppedImmediate) break;
        if (l.type === ev.type) l.fn.call(document, ev);
      }
      return true;
    },
  };
  Object.assign(document, dom);
  document.readyState = pageScriptRan ? 'interactive' : 'loading';
  document.scripts = { length: pageScriptRan ? 1 : 0 };
  document.documentElement = { getAttribute: () => null, setAttribute() { domWrites++; }, removeAttribute() { domWrites++; } };
  document.createElement = () => ({});

  class FakeEventTarget {}
  Object.assign(FakeEventTarget.prototype, dom);

  class Navigator {}
  Object.defineProperty(Navigator.prototype, 'onLine', { get() { return true; }, configurable: true, enumerable: true });
  if (nativeFalse) {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get() { return false; }, configurable: true, enumerable: true });
  }

  const warns = [];
  const base = () => ({
    document, CustomEvent: Ev, EventTarget: FakeEventTarget,
    setTimeout, clearTimeout, queueMicrotask, Promise,
    console: { log() {}, info() {}, warn: (...a) => warns.push(String(a[0])), error: (...a) => warns.push(String(a[0])) },
  });

  const mainCtx = vm.createContext({
    ...base(), navigator: Object.create(Navigator.prototype), Navigator,
    ...(noCsprng ? {} : { crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) } }),
  });
  const mainWin = vm.runInContext('globalThis', mainCtx);

  const isoCtx = vm.createContext({
    ...base(),
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    browser: notContentScript ? {} : { runtime: { id: 'org.nullecho.app.Extension (TEST)' } },
  });
  const isoWin = vm.runInContext('globalThis', isoCtx);
  const isoKeysBefore = Object.keys(isoWin).sort();

  // Capture order for the shared window: the ISOLATED world's listeners were registered first in
  // the browser only if the loader ran first; the rig keeps registration order per window object,
  // and both windows are visited in injection order.
  const inject = {
    loader: () => { windows.push(isoWin); if (!noLoader) vm.runInContext(LOADER_SRC, isoCtx, { filename: 'gpc-loader.js' }); },
    gpc: () => { windows.push(mainWin); vm.runInContext(GPC_SRC, mainCtx, { filename: 'gpc.js' }); },
  };
  const page = (code) => vm.runInContext(code, mainCtx, { filename: 'page.js' });
  const forge = (type, payload) => document.dispatchEvent(new Ev(type, { detail: typeof payload === 'string' ? payload : JSON.stringify(payload) }));

  if (loaderLast) { inject.gpc(); inject.loader(); }
  else {
    inject.loader();
    if (preBoot) for (const p of preBoot) forge(EVENTS.STATUS, p);
    inject.gpc();
  }

  const boots = dispatched.filter((e) => e.type === EVENTS.STATUS).map((e) => JSON.parse(e._detail));
  const replies = dispatched.filter((e) => e.type === EVENTS.PERSONA);
  return {
    gpc: () => mainCtx.navigator.globalPrivacyControl,
    desc: () => Object.getOwnPropertyDescriptor(mainCtx.Navigator.prototype, 'globalPrivacyControl'),
    boots, replies,
    reply: replies[0] ? JSON.parse(replies[0]._detail) : null,
    accepted: replies[0] ? replies[0]._stoppedImmediate : false,
    forge, page, warns, domWrites,
    isoNewGlobals: Object.keys(isoWin).sort().filter((k) => !isoKeysBefore.includes(k)),
  };
}

// ── the protocol literals the loader inlines ──────────────────────────────────

test('the loader inlines the protocol literals exactly (EVENTS, HANDSHAKE)', () => {
  const pin = (name, value) => assert.ok(LOADER_SRC.includes(`const ${name} = ${JSON.stringify(value).replace(/"/g, "'")};`), `${name} drifted from ext/src/protocol.js (${value})`);
  pin('EV_PERSONA', EVENTS.PERSONA);
  pin('EV_STATUS', EVENTS.STATUS);
  pin('CH_GPC', HANDSHAKE.CHANNEL.GPC);
  pin('BOOT_PHASE', HANDSHAKE.BOOT_PHASE);
});

// ── the happy path ────────────────────────────────────────────────────────────

test('a normal page: gpc.js boots, the loader echoes the nonce synchronously, gpc.js accepts, GPC reads true', () => {
  const r = runPage();
  assert.equal(r.gpc(), true);
  assert.equal(r.boots.length, 1);
  assert.deepEqual([r.boots[0].phase, r.boots[0].channel, typeof r.boots[0].nonce, r.boots[0].nonce.length], ['boot', 'gpc', 'string', HANDSHAKE.NONCE_BYTES * 2]);
  assert.equal(r.replies.length, 1, 'exactly one reply');
  assert.equal(r.reply.gpcNonce, r.boots[0].nonce, 'the reply must echo the nonce gpc.js published');
  assert.deepEqual([r.reply.ok, r.reply.enabled, r.reply.gpc], [true, true, true], 'explicit own fields (D29)');
  assert.equal(r.accepted, true, 'gpc.js stops an authenticated reply dead, so no page listener sees gpcNonce');
  assert.deepEqual(r.warns, [], 'nothing to warn about on a clean boot');
});

test('the reply is dispatched from inside the boot event (no window with a live nonce)', () => {
  // The loader's reply is the SECOND event dispatched overall, before gpc.js's boot dispatch has
  // returned: the rig records dispatch order, and a reply that came a task later would also be
  // recorded after any page code that ran in between.
  const r = runPage();
  const order = r.replies.length && r.boots.length ? r.replies[0] : null;
  assert.ok(order, 'no reply at all');
  const i = (type) => { let n = -1; for (let k = 0; k < r.replies.length; k++) n = k; return n; };
  assert.equal(r.replies[0]._stoppedImmediate, true);
  // gpc.js nulls its nonce once configApplied: a later reply with the SAME nonce must be ignored.
  r.forge(EVENTS.PERSONA, { ok: true, enabled: true, gpc: false, gpcNonce: r.boots[0].nonce });
  assert.equal(r.gpc(), true, 'a replay of the real nonce moved the signal: the one-shot was not consumed');
  void i;
});

test('the getter has a native accessor\'s name and shape (D32/D38) — the Safari build relies on gpc.js alone for this', () => {
  const r = runPage();
  const d = r.desc();
  assert.ok(d && typeof d.get === 'function');
  assert.equal(d.get.name, 'get globalPrivacyControl');
  assert.equal(Object.prototype.hasOwnProperty.call(d.get, 'prototype'), false);
  assert.equal(d.configurable, true);
  assert.equal(d.enumerable, true);
});

// ── the macOS case: the browser already ships the property as false ──────────

test('macOS Safari 27: a native Navigator.prototype.globalPrivacyControl = false reads true after boot, and stays true', () => {
  const r = runPage({ nativeFalse: true });
  assert.equal(r.gpc(), true, 'the native false must be overridden');
  assert.equal(r.accepted, true);
  r.forge(EVENTS.PERSONA, { ok: true, enabled: true, gpc: false, gpcNonce: 'ffffffffffffffffffffffffffffffff' });
  r.forge(EVENTS.PERSONA, { ok: true, enabled: false });
  assert.equal(r.gpc(), true);
});

test('iOS case: no native property, loader absent — gpc.js still defaults ON (the loader only closes the handshake)', () => {
  const r = runPage({ noLoader: true });
  assert.equal(r.gpc(), true);
  assert.equal(r.replies.length, 0);
});

// ── forgeries from page script ────────────────────────────────────────────────

test('a page cannot switch GPC off: wrong nonce, no nonce, enabled:false, string payloads, object payloads', () => {
  const r = runPage();
  const attempts = [
    { ok: true, enabled: true, gpc: false, gpcNonce: 'ffffffffffffffffffffffffffffffff' },
    { ok: true, enabled: true, gpc: false },
    { ok: true, enabled: false },
    { ok: false, reason: 'x' },
    'not json',
  ];
  for (const a of attempts) { r.forge(EVENTS.PERSONA, a); assert.equal(r.gpc(), true, `forgery moved the signal: ${JSON.stringify(a)}`); }
  // and a page that pollutes Object.prototype gains nothing either (D29)
  r.page("Object.prototype.gpc = false; Object.prototype.enabled = false;");
  r.forge(EVENTS.PERSONA, { ok: true, gpcNonce: 'ffffffffffffffffffffffffffffffff' });
  assert.equal(r.gpc(), true);
});

test('a second boot event — forged after the real one — is inert: no second reply, nothing moves', () => {
  const r = runPage();
  r.forge(EVENTS.STATUS, { phase: 'boot', channel: 'gpc', nonce: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' });
  r.forge(EVENTS.STATUS, { phase: 'boot', channel: 'gpc', nonce: r.boots[0].nonce });
  assert.equal(r.replies.length, 1, 'the loader answered a second boot event');
  assert.equal(r.gpc(), true);
});

test('a boot event on another channel (shim) is ignored — there is no shim on Safari', () => {
  const r = runPage({ preBoot: [{ phase: 'boot', channel: 'shim', nonce: 'dddddddddddddddddddddddddddddddd' }] });
  // the real gpc boot that followed still got its reply
  assert.equal(r.replies.length, 1);
  assert.equal(r.reply.gpcNonce, r.boots.find((b) => b.channel === 'gpc').nonce);
  assert.equal(r.gpc(), true);
});

test('lost race: a page forges a gpc boot BEFORE gpc.js runs — the loader answers the forgery, gpc.js ignores it, GPC stays on', () => {
  const fake = 'cccccccccccccccccccccccccccccccc';
  const r = runPage({ pageScriptRan: true, preBoot: [{ phase: 'boot', channel: 'gpc', nonce: fake }] });
  assert.equal(r.replies.length, 1, 'first boot on the channel wins, ever');
  assert.equal(r.reply.gpcNonce, fake);
  assert.equal(r.accepted, false, 'gpc.js had not booted; nobody authenticated the reply');
  assert.equal(r.gpc(), true);
  // the page now holds the fake nonce; it buys nothing
  r.forge(EVENTS.PERSONA, { ok: true, enabled: true, gpc: false, gpcNonce: fake });
  assert.equal(r.gpc(), true);
  assert.deepEqual(r.warns, [], 'an unaccepted reply must not raise the late-boot warning (a page could trigger it)');
});

test('late boot that still authenticates is reported from the ISOLATED console, once', () => {
  const r = runPage({ pageScriptRan: true });
  assert.equal(r.gpc(), true);
  assert.equal(r.accepted, true);
  assert.equal(r.warns.length, 1);
  assert.match(r.warns[0], /booted after page script had already run/);
});

test('gpc.js without a CSPRNG publishes no nonce; the loader does not reply and does not retry; GPC stays on', () => {
  const r = runPage({ noCsprng: true });
  assert.equal(r.boots[0].nonce, null);
  assert.equal(r.replies.length, 0);
  assert.equal(r.gpc(), true);
  r.forge(EVENTS.STATUS, { phase: 'boot', channel: 'gpc', nonce: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });
  assert.equal(r.replies.length, 0, 'a second boot event must be inert whatever it carries');
});

// ── ordering and footprint ───────────────────────────────────────────────────

test('ORDER DEPENDENCY: a loader injected after gpc.js never hears the boot event (the manifest order is load-bearing)', () => {
  const r = runPage({ loaderLast: true });
  assert.equal(r.replies.length, 0, 'a reply arrived although the loader registered after the boot event — the rig is wrong');
  assert.equal(r.gpc(), true, 'GPC still defaults on; only the one-shot close is lost');
});

test('the loader leaves nothing behind: no globals in its realm, no DOM writes, no listener on the persona channel', () => {
  const r = runPage();
  assert.deepEqual(r.isoNewGlobals, []);
  assert.equal(r.domWrites, 0);
});

test('outside a content script (no runtime.id) the loader does nothing', () => {
  const r = runPage({ notContentScript: true });
  assert.equal(r.replies.length, 0);
  assert.equal(r.gpc(), true);
});
