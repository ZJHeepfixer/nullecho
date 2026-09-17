/**
 * Nullecho — the shim's handshake, under a hostile page
 * ═══════════════════════════════════════════════════════
 * `src/shim.js` runs inside the page's own JavaScript realm, and the channel the
 * loader uses to reach it — a DOM CustomEvent — is the page's own machinery. Until
 * 2026-08-20 that channel was unauthenticated, and the payload it carried included
 * the allowlist stand-down. So this was a complete, three-line defeat of the
 * product, available to any script on any page:
 *
 *     document.dispatchEvent(new CustomEvent('nullecho:persona', {
 *       detail: JSON.stringify({ ok: true, enabled: false })
 *     }));
 *
 * The shim would restore every original descriptor and hand over the true machine.
 * Worse than being fingerprinted through Nullecho: Nullecho would be the thing that
 * handed the fingerprint over, on exactly the sites that bother to ask.
 *
 * These tests run the real `src/shim.js` in a `node:vm` realm with a DOM small
 * enough to be honest about — one navigator property, one event system — and then
 * attack it. `navigator.userAgent` is the observable: it returns the harness's
 * REAL_UA only if the shim has stood down, so "did the forgery work?" is one read.
 *
 * The event system deliberately models the part of DOM dispatch that matters here:
 * an event dispatched on `document` propagates window → document, capture-phase
 * listeners fire in registration order, and `stopPropagation()` stops the walk.
 * That is not incidental detail — it is the mechanism a page would use to steal the
 * nonce before the shim could spend it, and the reason the shim listens on `window`
 * rather than only on `document`.
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

/**
 * The persona the "service worker" delivers. `id` is a real pool id so the drift
 * warning stays quiet; `ua` is deliberately unlike anything in the pool so that
 * "upgraded to the salted persona" is distinguishable from "still on the fallback".
 */
const DELIVERED = {
  id: 'win11-chrome-rtx3060',
  platform: 'Win32',
  ua: 'Mozilla/5.0 (DELIVERED PERSONA) Chrome/151.0.0.0',
  uaData: { platform: 'Windows', architecture: 'x86', bitness: '64', platformVersion: '15.0.0' },
  gpu: { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  cores: 12,
  memory: 16,
  screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
  fontList: ['Arial', 'Segoe UI'],
  noise: { canvas: 0.25, audio: 0.5, webgl: 0.75 },
  seed: 0x1234abcd,
};

// ── a page realm, small enough to be honest about ──────────────────────────

/**
 * Boot one instance of the real shim in a fresh realm.
 *
 * Returns the handles a *page script* would have (it can dispatch events and read
 * `navigator`), plus the handles the *loader* would have (the boot event it heard).
 * Keeping both in one object is the point: every assertion below is about which of
 * the two is able to do what.
 */
function bootShim() {
  const listeners = new WeakMap();     // target → [{ type, fn, capture }]
  const dispatched = [];               // every nullecho:* event the shim emitted

  function listenersFor(target) {
    let list = listeners.get(target);
    if (!list) { list = []; listeners.set(target, list); }
    return list;
  }

  class FakeEventTarget {
    addEventListener(type, fn, capture) { listenersFor(this).push({ type, fn, capture: !!capture }); }
    removeEventListener(type, fn, capture) {
      const list = listenersFor(this);
      const i = list.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture);
      if (i >= 0) list.splice(i, 1);
    }
    dispatchEvent(ev) { return propagate(ev); }
  }

  class FakeCustomEvent {
    constructor(type, init) {
      this.type = type;
      this._detail = init ? init.detail : undefined;
      this._stopped = false;
      this._stoppedImmediate = false;
    }
    stopPropagation() { this._stopped = true; }
    // Modelled separately: the shim now stops the authenticated delivery dead
    // (review A3 / D21), and "dead" means no later listener on the SAME node
    // either — which `_stopped` alone did not capture.
    stopImmediatePropagation() { this._stopped = true; this._stoppedImmediate = true; }
  }
  // A prototype accessor, like the real one — the shim reads `detail` through the
  // descriptor it captured at boot, and that only means anything if there is one.
  Object.defineProperty(FakeCustomEvent.prototype, 'detail', {
    get() { return this._detail; }, configurable: true, enumerable: true,
  });

  /**
   * Capture-phase walk of [window, document], then the target's own listeners.
   * This is the ordering the whole nonce scheme leans on, so the harness models it
   * rather than flattening it into "call everyone".
   */
  let win = null;                                   // the realm's own global object
  function propagate(ev) {
    const path = win ? [win, document] : [document]; // window first, then document
    for (const node of path) {
      for (const l of listenersFor(node).slice()) {
        if (l.type !== ev.type) continue;
        if (node === win && !l.capture) continue;    // window only sees capture here
        if (ev._stoppedImmediate) break;
        l.fn.call(node, ev);
      }
      if (ev._stopped) break;
    }
    return true;
  }

  class Navigator {}
  Object.defineProperty(Navigator.prototype, 'userAgent', {
    get() { return REAL_UA; }, configurable: true, enumerable: true,
  });

  const document = new FakeEventTarget();
  document.createElement = () => ({});
  document.documentElement = { getAttribute: () => null, removeAttribute() {}, setAttribute() {} };

  const warnings = [];
  const sandbox = {
    document,
    navigator: Object.create(Navigator.prototype),
    Navigator,
    location: { hostname: 'example.test', origin: 'https://example.test' },
    CustomEvent: FakeCustomEvent,
    EventTarget: FakeEventTarget,
    crypto: { getRandomValues: (arr) => webcrypto.getRandomValues(arr) },
    console: {
      log() {}, info() {},
      warn: (...a) => warnings.push(String(a[0])),
      error: (...a) => warnings.push(String(a[0])),
    },
  };
  const ctx = vm.createContext(sandbox);
  // The realm's global object is NOT the sandbox object — the shim's
  // `addEventListener.call(globalThis, …)` keys off the former, so the harness has
  // to hold the same reference or it silently models a shim that never listened
  // on `window` at all.
  win = vm.runInContext('globalThis', ctx);

  // The loader's position: listeners in place BEFORE the MAIN-world script runs.
  // (Manifest ordering, asserted separately in protocol.test.js.)
  let boot = null;
  let personaTargetsAtBoot = [];
  document.addEventListener('nullecho:status', (ev) => {
    const d = JSON.parse(ev.detail);
    dispatched.push(d);
    if (d.phase === 'boot' && !boot) {
      boot = d;
      // Which targets already carried a persona listener when the nonce went out?
      personaTargetsAtBoot = [
        listenersFor(win).some((l) => l.type === 'nullecho:persona') && 'window',
        listenersFor(document).some((l) => l.type === 'nullecho:persona') && 'document',
      ].filter(Boolean);
    }
  }, true);

  vm.runInContext(SHIM_SRC, ctx, { filename: 'shim.js' });

  /** Dispatch a `nullecho:persona` event the way a page script would. */
  const send = (payload) => document.dispatchEvent(new FakeCustomEvent('nullecho:persona', {
    detail: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }));

  return {
    ctx, win, document, boot, dispatched, warnings, send, personaTargetsAtBoot,
    FakeCustomEvent,
    addPageListener: (target, type, fn, capture) =>
      listenersFor(target === 'window' ? win : document).push({ type, fn, capture: !!capture }),
    ua: () => ctx.navigator.userAgent,
    statuses: () => dispatched.filter((d) => !d.phase),
  };
}

/** The full, authenticated payload the loader would send. */
const realPayload = (boot, over = {}) => ({
  ok: true, enabled: true, gpc: true, site: 'example.test',
  persona: DELIVERED, nonce: boot.nonce, ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
// the boot announcement
// ═══════════════════════════════════════════════════════════════════════════

test('the shim publishes a 128-bit nonce in its boot event', () => {
  const s = bootShim();
  assert.ok(s.boot, 'no boot event: the loader can never authenticate to this shim');
  assert.equal(s.boot.phase, 'boot');
  assert.equal(s.boot.channel, 'shim');
  assert.match(s.boot.nonce, /^[0-9a-f]{32}$/, 'nonce must be 16 CSPRNG bytes, hex-encoded');
});

test('two instances get different nonces', () => {
  assert.notEqual(bootShim().boot.nonce, bootShim().boot.nonce);
});

test('it listens BEFORE it announces', () => {
  // The ordering the scheme rests on is "no page script has run when the nonce is
  // published". The half of that the shim owns is "I am already listening when I
  // publish" — otherwise there is a window in which the loader's authenticated
  // reply would be dropped and the page's later forgery would be the only offer.
  const s = bootShim();
  assert.ok(s.personaTargetsAtBoot.length >= 1,
    'the nonce went out before any nullecho:persona listener existed');
});

test('it listens at the head of the propagation path, not only on document', () => {
  // A page's window-capture listener fires before any document-phase listener. If
  // the shim listened only on `document`, that page listener could read the nonce
  // out of the loader's payload and stopPropagation() it away — and the nonce
  // would have bought nothing. See the interception test below for the live proof.
  const s = bootShim();
  assert.deepEqual(s.personaTargetsAtBoot, ['window', 'document'],
    'the shim must be listening on window (capture) as well as document, before it announces');
});

// ═══════════════════════════════════════════════════════════════════════════
// THE EXPLOIT — a hostile page asking Nullecho to switch itself off
// ═══════════════════════════════════════════════════════════════════════════

test('a page forging {ok:true, enabled:false} does NOT get the real fingerprint', () => {
  const s = bootShim();

  s.send({ ok: true, enabled: false });

  assert.notEqual(s.ua(), REAL_UA,
    'THE VULNERABILITY: an unauthenticated stand-down restored the true machine');
  assert.match(s.ua(), /Chrome\//, 'the fallback persona should still be in place');
  assert.ok(
    s.statuses().every((d) => d.reason !== 'allowlisted'),
    'the shim reported that it stood down for a forged payload',
  );
});

test('every shape of unauthenticated stand-down is refused', () => {
  for (const forged of [
    { ok: true, enabled: false },                                   // the classic
    { ok: true, enabled: false, persona: null },
    { ok: true, enabled: false, nonce: 'f'.repeat(32) },            // wrong nonce, right shape
    { ok: true, enabled: false, nonce: '' },
    { ok: true, enabled: false, nonce: null },
    { ok: true, enabled: false, nonce: 0 },
  ]) {
    const s = bootShim();
    s.send(forged);
    assert.notEqual(s.ua(), REAL_UA, `forgery got through: ${JSON.stringify(forged)}`);
  }
});

test('a forgery cannot guess its way in by brute force, and each miss is refused', () => {
  const s = bootShim();
  const wrong = s.boot.nonce.slice(0, -1) + (s.boot.nonce.endsWith('0') ? '1' : '0');
  for (let i = 0; i < 50; i++) s.send({ ok: true, enabled: false, nonce: wrong });
  assert.notEqual(s.ua(), REAL_UA);
});

test('a near-miss nonce (right prefix, wrong length) is refused', () => {
  const s = bootShim();
  for (const n of [s.boot.nonce.slice(0, 16), s.boot.nonce + '0', ' ' + s.boot.nonce]) {
    s.send({ ok: true, enabled: false, nonce: n });
    assert.notEqual(s.ua(), REAL_UA, `refused nonce variant ${JSON.stringify(n)} was accepted`);
  }
});

test('the loader\'s authenticated stand-down still works — the fix is not just "never stand down"', () => {
  const s = bootShim();
  s.send(realPayload(s.boot, { enabled: false, persona: null }));
  assert.equal(s.ua(), REAL_UA, 'an allowlisted site must actually get its real APIs back');
});

// ═══════════════════════════════════════════════════════════════════════════
// the one-shot, and why a rejection must not consume it
// ═══════════════════════════════════════════════════════════════════════════

test('a rejected forgery does not consume the handshake', () => {
  // If a bad nonce burned the one-shot, "shout first" would become a downgrade
  // attack: every page could pin every visitor to the un-rotated fallback persona
  // without ever needing to guess anything.
  const s = bootShim();
  s.send({ ok: true, enabled: false });
  s.send({ ok: true, enabled: false, nonce: 'deadbeef'.repeat(4) });
  s.send(realPayload(s.boot));
  assert.equal(s.ua(), DELIVERED.ua, 'the genuine handshake was locked out by earlier forgeries');
});

test('the authenticated handshake is accepted exactly once', () => {
  const s = bootShim();
  s.send(realPayload(s.boot));
  assert.equal(s.ua(), DELIVERED.ua);

  // Replay the *same, valid* nonce with the destructive instruction. The nonce is
  // observable to the page after delivery (its own listener can read the payload),
  // so single-use is what makes that disclosure harmless.
  s.send(realPayload(s.boot, { enabled: false, persona: null }));
  assert.notEqual(s.ua(), REAL_UA, 'a replay of the spent nonce stood the shim down');
});

// ═══════════════════════════════════════════════════════════════════════════
// interception — the attack the nonce alone would NOT have stopped
// ═══════════════════════════════════════════════════════════════════════════

test('a page window-capture listener cannot steal the handshake before the shim spends it', () => {
  const s = bootShim();

  // The page registers where it can see an event first: window, capture phase.
  let stolen = null;
  s.addPageListener('window', 'nullecho:persona', (ev) => {
    stolen = JSON.parse(ev.detail);
    ev.stopPropagation();     // …and tries to make sure the shim never sees it
  }, true);

  s.send(realPayload(s.boot));

  // The shim registered at document_start, so it is ahead of the page in
  // registration order and consumed the payload first.
  assert.equal(s.ua(), DELIVERED.ua, 'the page intercepted the handshake before the shim');

  // 2026-09-16 (review A3, DECISIONS.md D21): the page no longer learns
  // ANYTHING — not the spent nonce, and not the persona's noise keys, which
  // were the actual hole. The shim stops the authenticated delivery dead.
  assert.equal(stolen, null, 'the page listener saw the delivery');
  // The spent nonce is still worthless even to a page that somehow has it.
  s.send({ ok: true, enabled: false, nonce: s.boot.nonce });
  assert.notEqual(s.ua(), REAL_UA, 'a spent nonce was still good for a stand-down');
});

test('a page that repatches CustomEvent.prototype.detail cannot swap the payload', () => {
  // The shim reads `detail` through the descriptor it captured at document_start.
  // Without that, a page could return the real payload to itself (learning the
  // nonce) and hand the shim a forged one carrying that same nonce.
  const s = bootShim();
  const proto = s.FakeCustomEvent.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, 'detail');

  let seen = null;
  Object.defineProperty(proto, 'detail', {
    get() {
      const real = original.get.call(this);
      try {
        const parsed = JSON.parse(real);
        if (parsed && parsed.nonce) {
          seen = parsed.nonce;
          return JSON.stringify({ ok: true, enabled: false, nonce: parsed.nonce });
        }
      } catch { /* not ours */ }
      return real;
    },
    configurable: true,
  });

  s.send(realPayload(s.boot));
  Object.defineProperty(proto, 'detail', original);

  assert.notEqual(s.ua(), REAL_UA,
    'a repatched detail getter swapped the payload and stood the shim down');
});

// ═══════════════════════════════════════════════════════════════════════════
// the honest path still has to work
// ═══════════════════════════════════════════════════════════════════════════

test('the authenticated upgrade swaps to the salted persona', () => {
  // Note: nothing may read a shimmed API before the handshake here. The upgrade
  // gate refuses to swap personas after a read, because mixing fields from two
  // machines is the contradiction DECISIONS.md D2 calls worse than no defense.
  const s = bootShim();
  s.send(realPayload(s.boot));
  assert.equal(s.ua(), DELIVERED.ua);
  assert.ok(s.statuses().some((d) => d.upgraded === true), 'no upgraded status was reported');
});

test('an authenticated failure payload keeps the fallback and reports it', () => {
  const s = bootShim();
  s.send({ ok: false, reason: 'timeout', nonce: s.boot.nonce });
  assert.notEqual(s.ua(), REAL_UA);
  assert.ok(s.statuses().some((d) => d.reason === 'timeout'));
});

test('a forgery is reported once, not on every attempt', () => {
  const s = bootShim();
  for (let i = 0; i < 5; i++) s.send({ ok: true, enabled: false });
  const reports = s.statuses().filter((d) => d.reason === 'forged-handshake-rejected');
  assert.equal(reports.length, 1, 'forgery reporting must be bounded — a page controls the rate');
});
