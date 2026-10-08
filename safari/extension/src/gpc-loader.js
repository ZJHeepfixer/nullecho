/**
 * Nullecho for Safari — GPC loader (ISOLATED world, document_start).
 * ═══════════════════════════════════════════════════════════════════
 * The Safari build ships `ext/src/gpc.js` byte for byte. Since D46 that script
 * turns `navigator.globalPrivacyControl` on at boot and then waits for the
 * ISOLATED-world loader to authenticate ONE configuration message: it mints a
 * nonce, publishes it in a `{ phase: 'boot', channel: 'gpc', nonce }` status
 * event, and accepts the first `nullecho:persona` event whose `gpcNonce` echoes
 * it. In Chrome that loader is `src/shim-loader.js`, which also carries the
 * persona handshake, the reverse channel and the service-worker round trip.
 * None of that exists in phase 1 on Safari — no persona, no learner, no worker
 * — so this file is the GPC half of that protocol and nothing else. See
 * `ext/src/protocol.js` ("THE NONCE HANDSHAKE") for the contract it implements;
 * `safari/test/gpc-loader.test.mjs` runs the real gpc.js against this file.
 *
 * WHY ANSWER AT ALL, when GPC is always on and gpc.js defaults to on? Two
 * reasons, both about leaving nothing live behind:
 *
 *   1. The handshake is one-shot. Until it completes, gpc.js holds its nonce
 *      and will still act on a correctly-authenticated `{ gpc: false }`. The
 *      nonce is unreadable from the page by construction (published before any
 *      page script exists), but "unreadable" is weaker than "gone". Once this
 *      file echoes it, gpc.js sets `configApplied` and nulls the nonce, and no
 *      later message — forged, replayed or real — can move the signal again.
 *   2. Authentication proves, per document, the ordering the scheme rests on.
 *      gpc.js only accepts a reply that carries the nonce it just published, and
 *      it only published it to listeners that already existed. A reply that
 *      lands means this file's listener was registered before gpc.js ran.
 *
 * ⚠ SAFARI DOES NOT GUARANTEE THAT ORDER ACROSS WORLDS — measured, and why.
 * Chrome injects `content_scripts` entries at one `run_at` in manifest order,
 * which is what `shim-loader.js` R5 and `protocol.test.js` rely on. WebKit keeps
 * user scripts in `WebUserContentController::m_userScripts`, a
 * `HashMap<Ref<InjectedBundleScriptWorld>, Vector<UserScript>>`, and
 * `forEachUserScript` walks that map in hash order: scripts in ONE world run in
 * manifest order, but which world goes first is decided by the hash of the
 * world objects, i.e. per web-content process, not by the manifest. Measured
 * 2026-10-02, Safari on the iOS 27.0 Simulator, this file first in the manifest
 * and an ISOLATED probe declared before it: over six loads of a five-document
 * page (top, cross-origin, two about:blank, one srcdoc), 25 of 30 documents saw
 * the boot event and got the reply (`gpcNonce` echoed, reply stopped by gpc.js);
 * the 5 misses were all five documents of ONE load, exactly the per-process
 * pattern the source predicts. Every document, hit or miss, still read
 * `navigator.globalPrivacyControl === true` from its first inline script.
 *
 * So the handshake is best-effort on Safari and the design has to be safe when
 * it never happens — which it is, because gpc.js turns the signal ON before it
 * announces and defaults ON when nothing answers: the miss costs the one-shot
 * close, not the signal, and the nonce it leaves live was published before any
 * page script existed and is held in no place a page can read. A page still
 * cannot forge a reply (it needs the nonce) and cannot replay one (there was
 * none). `safari/test/gpc-loader.test.mjs` pins the loader-after-gpc.js case.
 *
 * WHAT IS REPRODUCED FROM shim-loader.js, and what is not:
 *
 *   ✓ Listener on `window` in the CAPTURE phase first, then `document`, through
 *     `EventTarget.prototype` — `window` is the first node in the propagation
 *     path of an event dispatched on `document`, same-phase listeners fire in
 *     registration order, and this file is the first content script at
 *     `document_start`, so it hears the boot event before any page listener.
 *   ✓ First boot event on the channel wins; every later one is inert, whatever
 *     it carries (review R2-1). A page that lost the document_start race cannot
 *     be first; a page that won it owns the realm anyway (R3b).
 *   ✓ Own-property reads of every field (D29); `detail` must be a JSON string,
 *     which is the only shape gpc.js sends.
 *   ✓ The reply is dispatched SYNCHRONOUSLY, from inside the boot event's own
 *     dispatch. gpc.js registers its listener before it announces, so the reply
 *     is consumed before this handler returns — there is no window in which a
 *     live nonce sits anywhere but in two closures the page cannot reach.
 *     gpc.js stops the accepted reply dead (`stopImmediatePropagation`), so no
 *     page listener ever sees `gpcNonce` even on a page that had one.
 *   ✓ The R3b measurement: whether a page script could already have run when
 *     the boot event arrived, read from THIS world (the page cannot patch what
 *     an isolated world sees). Reported only when the reply authenticated —
 *     gpc.js stops an accepted reply, and `cancelBubble` on our own event
 *     object tells us so — because a forged boot event must not be able to
 *     raise a warning (review C1). It goes to this world's console, which page
 *     script cannot hook; there is no service worker to report it to.
 *   ✗ No reply tokens, no DETECT/STATUS reporting, no stand-down: those carry
 *     the persona and the counters, which do not exist here. gpc.js reads the
 *     fields it needs as own properties, so a payload without them is safe:
 *     `enabled` is sent explicitly as `true` and `gpc` as `true`.
 *
 * Nothing here touches the DOM, defines a global, or makes a request. The ~50
 * hosts that break when they see GPC are handled one level up: both content
 * scripts carry the same `exclude_matches` (copied from ext/manifest.json at
 * build time), so on those sites neither this file nor gpc.js runs at all.
 */

(() => {
  'use strict';

  // ── protocol literals (mirror of ext/src/protocol.js) ─────────────────────
  //    `safari/test/gpc-loader.test.mjs` reads this file as text and fails if
  //    these drift from HANDSHAKE / EVENTS there.
  const EV_PERSONA = 'nullecho:persona';
  const EV_STATUS = 'nullecho:status';
  const CH_GPC = 'gpc';
  const BOOT_PHASE = 'boot';

  const runtime = (globalThis.browser ?? globalThis.chrome)?.runtime;
  if (!runtime?.id) return; // not running as an extension content script

  /** The first boot event on the gpc channel has been seen; later ones are inert. */
  let bootSeen = false;
  /** One reply, ever. */
  let replied = false;

  /**
   * `detail` is a JSON string on purpose (see shim-loader.js `parseDetail`): a
   * string survives the world boundary in every engine, and a non-string here
   * can only be a page's own object, which this file has no business reading.
   */
  function parseDetail(ev) {
    try {
      return typeof ev.detail === 'string' ? JSON.parse(ev.detail) : null;
    } catch { return null; }
  }

  /** Own property or `undefined` — never something inherited (D29). */
  function own(obj, key) {
    try { return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined; }
    catch { return undefined; }
  }

  /**
   * Has any page script executed yet, as seen from the ISOLATED world? At a
   * true `document_start` the document holds `<html>` and nothing else. Used
   * only to downgrade a claim, never to make one (shim-loader.js R3b).
   */
  function pageScriptCouldHaveRun() {
    try {
      if (document.readyState !== 'loading') return true;
      return (document.scripts ? document.scripts.length : 0) > 0;
    } catch {
      return true;
    }
  }

  function onStatus(ev) {
    if (bootSeen) return;
    const d = parseDetail(ev);
    if (!d || typeof d !== 'object') return;
    if (own(d, 'phase') !== BOOT_PHASE || own(d, 'channel') !== CH_GPC) return;

    // ONE announcement per channel, ever — not "the first one that carries a
    // usable nonce". A genuine gpc.js that booted without a CSPRNG publishes
    // `nonce: null` and gets no reply; GPC stays at its default of ON there.
    bootSeen = true;
    const nonce = own(d, 'nonce');
    if (typeof nonce !== 'string' || nonce.length < 16) return;

    const late = pageScriptCouldHaveRun();

    if (replied) return;
    replied = true;
    let accepted = false;
    try {
      // Explicit own fields, never omitted: gpc.js reads `enabled` and `gpc` as
      // own properties, so an absent one cannot be supplied by the page (D29),
      // but sending both leaves nothing to interpret.
      const reply = new CustomEvent(EV_PERSONA, {
        detail: JSON.stringify({ ok: true, enabled: true, gpc: true, gpcNonce: nonce }),
      });
      document.dispatchEvent(reply);
      // gpc.js calls `stopImmediatePropagation()` on a reply it authenticated,
      // and on nothing else. That sets the event's stop-propagation flag, which
      // `cancelBubble` reads back — on OUR event object, which the page never
      // held. A page listener could also stop it, but only on a page that was
      // already running script, which is the case `late` names anyway.
      accepted = reply.cancelBubble === true;
    } catch { /* nothing to do; GPC stays at its default of ON */ }

    if (late && accepted) {
      console.warn(
        '[Nullecho] The page-world GPC script booted after page script had already ' +
        'run, so its handshake nonce may have been observed. The signal is still on.'
      );
    }
  }

  // `window` in the CAPTURE phase first, `document` second. Registered through
  // `EventTarget.prototype` so a realm whose global is not itself an EventTarget
  // (test rigs) still gets the window registration.
  for (const target of [globalThis, document]) {
    try {
      const add = globalThis.EventTarget?.prototype?.addEventListener ?? target.addEventListener;
      add.call(target, EV_STATUS, onStatus, true);
    } catch { /* not an EventTarget in this realm */ }
  }
})();
