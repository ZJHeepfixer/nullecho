/**
 * Nullecho — loader ⇄ shim ⇄ gpc, end to end
 * ═════════════════════════════════════════
 * `shim-handshake.test.js` attacks `shim.js` with a synthetic loader. This file
 * runs the REAL `shim-loader.js` against the real `shim.js` and `gpc.js`, because
 * the nonce handshake is a contract between three files and a contract is exactly
 * the thing unit tests each mock away.
 *
 * The setup mirrors the browser's shape rather than flattening it:
 *
 *   · TWO JavaScript realms — one ISOLATED (the loader), one MAIN (shim + gpc) —
 *     sharing ONE DOM object graph. That is what an isolated world is: separate
 *     globals, same document. Run them in one realm and the test would prove
 *     nothing about the boundary the whole design rests on.
 *   · Injection in manifest order: loader, then shim, then gpc.
 *   · A service worker that answers `nullecho:get-persona` asynchronously, which is
 *     the reason the handshake exists at all.
 *
 * `navigator.userAgent` is the observable. It returns REAL_UA only when the shim
 * has stood down, so each scenario's expected value says plainly what happened.
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
const source = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');

const REAL_UA = 'Mozilla/5.0 (REAL MACHINE)';
const SALTED = {
  id: 'win11-chrome-rtx3060', platform: 'Win32', ua: 'Mozilla/5.0 (SALTED PERSONA)',
  uaData: { platform: 'Windows' },
  gpu: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  cores: 12, memory: 16,
  screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
  fontList: ['Arial'], noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 }, seed: 42,
};

/**
 * @param {object} opts
 * @param {boolean} [opts.allowlisted]   service worker says the user switched Nullecho off here
 * @param {boolean} [opts.gpcOn]         service worker's GPC answer for this site
 * @param {boolean} [opts.pageScriptRan] the MAIN-world scripts lost the document_start race
 * @param {boolean} [opts.swDown]        no answer from the service worker
 * @param {object[]} [opts.preForge]     payloads a page script dispatches BEFORE the
 *                                       service worker answers, racing the loader
 * @param {boolean} [opts.subframe]      this document is an iframe, not the main page
 */
async function runPage(opts = {}) {
  const { allowlisted = false, gpcOn = true, pageScriptRan = false, swDown = false,
    preForge = null, subframe = false } = opts;

  // ── one DOM, shared by both realms ───────────────────────────────────────
  const registry = new Map();
  const listenersOf = (t) => { if (!registry.has(t)) registry.set(t, []); return registry.get(t); };
  const windows = [];                    // realm globals, in injection order

  class Ev {
    constructor(type, init) { this.type = type; this._detail = init && init.detail; this._stopped = false; }
    stopPropagation() { this._stopped = true; }
    stopImmediatePropagation() { this._stopped = true; }
  }
  Object.defineProperty(Ev.prototype, 'detail', { get() { return this._detail; }, configurable: true });

  const document = {};
  const dom = {
    addEventListener(type, fn, capture) { listenersOf(this).push({ type, fn, capture: !!capture }); },
    removeEventListener(type, fn, capture) {
      const l = listenersOf(this);
      const i = l.findIndex((x) => x.type === type && x.fn === fn && x.capture === !!capture);
      if (i >= 0) l.splice(i, 1);
    },
    dispatchEvent(ev) {
      // Capture phase reaches every realm's window before the document. Both
      // realms' windows are in that path because they are the same window as far
      // as the DOM is concerned.
      for (const w of windows) {
        for (const l of listenersOf(w).slice()) {
          if (l.type === ev.type && l.capture) l.fn.call(w, ev);
        }
        if (ev._stopped) return true;
      }
      for (const l of listenersOf(document).slice()) if (l.type === ev.type) l.fn.call(document, ev);
      return true;
    },
  };
  Object.assign(document, dom);
  document.createElement = () => ({});
  document.readyState = pageScriptRan ? 'interactive' : 'loading';
  document.scripts = { length: pageScriptRan ? 1 : 0 };
  document.documentElement = { getAttribute: () => null, setAttribute() {}, removeAttribute() {} };

  class FakeEventTarget {}
  Object.assign(FakeEventTarget.prototype, dom);

  class Navigator {}
  Object.defineProperty(Navigator.prototype, 'userAgent', {
    get() { return REAL_UA; }, configurable: true, enumerable: true,
  });

  const logs = [];
  const base = () => ({
    document, CustomEvent: Ev, EventTarget: FakeEventTarget,
    crypto: { getRandomValues: (a) => webcrypto.getRandomValues(a) },
    location: { hostname: 'example.test', origin: 'https://example.test' },
    setTimeout, clearTimeout, queueMicrotask, Promise,
    console: {
      log() {}, info() {},
      warn: (...a) => logs.push(String(a[0])),
      error: (...a) => logs.push(String(a[0])),
    },
  });

  // ── MAIN realm: shim.js and gpc.js, the page's own JS context ────────────
  const mainCtx = vm.createContext({
    ...base(), navigator: Object.create(Navigator.prototype), Navigator,
  });
  windows.push(vm.runInContext('globalThis', mainCtx));

  // ── ISOLATED realm: shim-loader.js, plus a service worker ────────────────
  const toWorker = [];
  const isoCtx = vm.createContext({
    ...base(),
    chrome: {
      runtime: {
        id: 'nullecho-integration',
        lastError: undefined,
        sendMessage(msg, cb) {
          toWorker.push(msg);
          if (typeof cb !== 'function') return undefined;
          if (msg.type !== 'nullecho:get-persona') { setTimeout(() => cb(undefined), 0); return undefined; }
          if (swDown) { setTimeout(() => cb(undefined), 0); return undefined; }
          setTimeout(() => cb({
            ok: true,
            enabled: !allowlisted,
            gpc: gpcOn,
            site: 'example.test',
            persona: allowlisted ? null : SALTED,
            loudFailures: true,
          }), 1);
          return undefined;
        },
      },
    },
  });
  const isoWin = vm.runInContext('globalThis', isoCtx);
  windows.push(isoWin);
  // `top === self` is how the loader tells a main document from a subframe. Make
  // it real rather than letting two `undefined`s compare equal by accident.
  isoCtx.self = isoWin;
  isoCtx.top = subframe ? { aDifferentWindow: true } : isoWin;

  // Manifest order. This is the ordering protocol.test.js pins in both manifests.
  vm.runInContext(source('shim-loader.js'), isoCtx, { filename: 'shim-loader.js' });
  vm.runInContext(source('shim.js'), mainCtx, { filename: 'shim.js' });
  vm.runInContext(source('gpc.js'), mainCtx, { filename: 'gpc.js' });

  // A page script runs here: after the content scripts, before the service worker
  // has answered. This is the earliest a real page can act, and it is when a
  // "shout first" downgrade attempt would land.
  if (preForge) {
    for (const payload of preForge) {
      document.dispatchEvent(new Ev('nullecho:persona', {
        detail: typeof payload === 'string' ? payload : JSON.stringify(payload),
      }));
    }
  }

  await new Promise((r) => setTimeout(r, swDown ? 400 : 60));

  return {
    ua: mainCtx.navigator.userAgent,
    gpc: mainCtx.navigator.globalPrivacyControl,
    /** Everything the loader told the service worker, in order. */
    reported: toWorker.filter((m) => m.type === 'nullecho:shim-status')
      .map((m) => m.reason ?? (m.upgraded ? 'upgraded' : 'ok')),
    logs,
    /** A page script's view: dispatch a forged persona event after the fact. */
    forge: (payload) => document.dispatchEvent(new Ev('nullecho:persona', { detail: JSON.stringify(payload) })),
    read: () => mainCtx.navigator.userAgent,
  };
}

// ── the happy path ─────────────────────────────────────────────────────────

test('a normal page: the loader authenticates and the shim takes the salted persona', async () => {
  const r = await runPage();
  assert.equal(r.ua, SALTED.ua, 'the salted persona never arrived — the handshake did not complete');
  assert.equal(r.gpc, true, 'GPC should be up on a normal page');
  assert.deepEqual(r.reported, ['upgraded']);
});

test('an allowlisted site: the authenticated stand-down restores the real APIs', async () => {
  const r = await runPage({ allowlisted: true });
  assert.equal(r.ua, REAL_UA, 'the user switched Nullecho off here and it stayed on');
  assert.equal(r.gpc, undefined, 'the JS signal must agree with the allowAllRequests DNR rule');
  assert.deepEqual(r.reported, ['allowlisted']);
});

test('a GPC exception reaches gpc.js through the same authenticated payload', async () => {
  const r = await runPage({ gpcOn: false });
  assert.equal(r.ua, SALTED.ua, 'a GPC exception must not disturb the persona');
  // `false`, not absent. The spec: "The value is false if no Sec-GPC header
  // field would be sent." Standing the whole extension DOWN is the other case
  // (the test above) and restores whatever the browser had — G2, 2026-09-19.
  assert.equal(r.gpc, false);
});

test('an unreachable service worker fails loud and keeps the fallback persona', async () => {
  const r = await runPage({ swDown: true });
  assert.notEqual(r.ua, REAL_UA, 'a dead service worker must never expose the real machine');
  assert.match(r.ua, /Chrome\//, 'expected the coherent fallback persona');
  assert.ok(r.logs.some((l) => /Could not reach the extension service worker/.test(l)));
});

// ── the exploit, against the real three-file stack ─────────────────────────

test('a page cannot switch off a live install by dispatching enabled:false', async () => {
  // Both windows a real page gets: before the service worker answers (when the
  // handshake is still open) and after (when it has been spent).
  const r = await runPage({ preForge: [{ ok: true, enabled: false }] });
  assert.equal(r.ua, SALTED.ua,
    'a forged stand-down reached the shim through the real loader path');

  r.forge({ ok: true, enabled: false });
  r.forge({ ok: true, enabled: false, nonce: 'f'.repeat(32) });
  assert.equal(r.read(), SALTED.ua, 'a post-handshake forgery stood the shim down');
});

test('a page cannot pre-empt the handshake by shouting before the worker answers', async () => {
  // The forgeries land after the content scripts and before the service worker
  // replies — the earliest a real page script can act. If a bad nonce consumed the
  // one-shot, this would pin every visitor to the un-rotated fallback persona, and
  // a page would not have to guess anything to do it.
  const r = await runPage({
    preForge: [
      { ok: true, enabled: false },
      { ok: true, enabled: false, nonce: '0'.repeat(32) },
      { ok: false, reason: 'go away' },
      'not json{',
    ],
  });
  assert.equal(r.ua, SALTED.ua, 'shouting first denied the genuine handshake');
  assert.equal(r.gpc, true, 'shouting first denied gpc.js its config too');
});

// ── the ordering guarantee, measured rather than assumed ───────────────────

test('when the MAIN-world scripts win the race, nothing is reported as exposed', async () => {
  const r = await runPage();
  assert.ok(!r.reported.includes('nonce-exposed'), r.reported.join(','));
});

test('when they lose it, the loader says so from the world the page cannot reach', async () => {
  // The page cannot forge this: `document.scripts` and `document.readyState` are
  // read in the ISOLATED world, which has its own DOM prototypes. Asking the
  // MAIN-world shim to self-report would be asking a possibly-compromised realm
  // whether it is compromised.
  const r = await runPage({ pageScriptRan: true });
  assert.ok(r.reported.includes('nonce-exposed'),
    'a late boot went unreported, so the popup would imply protection it cannot prove');
  assert.ok(r.logs.some((l) => /booted after page script had already run/.test(l)));

  // …and the page still works. This is a disclosure, not a failure to function.
  assert.equal(r.ua, SALTED.ua);
});

test('a subframe booting late is NOT reported — that warning is for the main document', async () => {
  // `about:blank` and `srcdoc` children report readyState 'complete' the moment a
  // content script reaches them, so this check would fire on nearly every page
  // carrying an ad iframe. It would even be *correct* to — the parent is
  // same-origin with its own blank child and owns that realm regardless — but a
  // warning that always fires is a warning nobody reads. The structural case is
  // documented in docs/THREAT-MODEL.md instead.
  const r = await runPage({ pageScriptRan: true, subframe: true });
  assert.ok(!r.reported.includes('nonce-exposed'),
    'subframe noise reached the popup, which is how a real warning gets ignored');
  assert.equal(r.ua, SALTED.ua, 'a subframe must still get its persona');
});
