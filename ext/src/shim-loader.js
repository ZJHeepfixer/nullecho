/**
 * Nullecho — persona loader (ISOLATED world, document_start).
 * ════════════════════════════════════════════════════════
 * Classic script. MV3 does not support ES modules for content scripts, so the
 * protocol literals below are duplicated from `src/protocol.js`. Keep them in sync.
 *
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE RACE, AND HOW WE CLOSE IT
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * The requirement: `src/shim.js` must have a coherent persona *synchronously* at
 * document_start, before the first page script runs. The obstacle: the persona is
 * derived from a secret salt that lives in the service worker, and every route
 * from a content script to the service worker is asynchronous. There is no
 * synchronous read of `chrome.storage`, no synchronous `sendMessage`, and the
 * MAIN world has no `chrome.*` at all.
 *
 * Approaches considered and rejected:
 *
 *   ✗ `chrome.storage.session` with TRUSTED_AND_UNTRUSTED_CONTEXTS.
 *     Fast, but session storage is not partitioned per origin. Any page's content
 *     script could read the persona map for *every* site — which hands a hostile
 *     site the exact cross-site join Nullecho exists to prevent. Rejected on security,
 *     not on latency. (It is also still async, so it would not have closed the race
 *     anyway.)
 *
 *   ✗ Injecting the salt into the page via a `<script>` data attribute.
 *     The MAIN world is the page. Anything readable there is readable by the page.
 *     Publishing the salt to every site lets any one of them derive every other
 *     site's persona. Same failure, worse.
 *
 *   ✗ `chrome.scripting.executeScript` with the persona baked in.
 *     This is the documented Chrome timing bug: MAIN-world dynamic injection can
 *     land after DOMContentLoaded (docs/THREAT-MODEL.md, "MAIN-world injection
 *     race"). Strictly worse than static declaration.
 *
 *   ✗ `chrome.userScripts.register()` with a generated code string.
 *     This *would* work — it registers ahead of navigation, so there is no
 *     per-navigation async hop — but it requires the user to flip a per-extension
 *     "Allow User Scripts" toggle (Chrome 138+) or enable developer mode. Not
 *     acceptable for a privacy tool aimed at ordinary users. Keep on file as a
 *     power-user opt-in for v0.2.
 *
 *   ✗ Synchronous XHR to an extension resource.
 *     Extension files are static; the salt is generated at runtime. Nothing to read.
 *
 * The approach taken: **two-stage persona, with an upgrade gate.**
 *
 *   Stage 1 (synchronous, zero async work).  `shim.js` patches every target API at
 *   document_start using a FALLBACK persona it derives itself, from the origin plus
 *   a public build-time constant. There is therefore *never* a window in which the
 *   APIs are unpatched or in which a page can read a real value. The fallback is a
 *   whole persona from the same pool, so it is internally consistent — no
 *   Chrome-UA-with-Apple-GPU contradiction at any point (docs/DECISIONS.md D2).
 *
 *   Stage 2 (async, typically 1–5 ms).  This loader asks the service worker for the
 *   *real* salted persona and hands it over. `shim.js` swaps to it — but ONLY if no
 *   shimmed API has been read yet. If the page already read something, the shim
 *   stays locked on the fallback for the life of the document.
 *
 * Why the read gate matters more than winning the race: swapping personas mid-page
 * would produce exactly the cross-field contradiction that D2 identifies as worse
 * than no defense at all (cores from persona A, GPU from persona B). Losing the
 * race costs the user salt rotation on that one page load; swapping mid-flight
 * would cost them the whole guarantee.
 *
 *
 * RESIDUAL RISKS — stated, not hidden
 * ───────────────────────────────────
 *
 *  R1. Pages that fingerprint in an inline <script> in <head> get the FALLBACK
 *      persona, not the salted one. The fallback is per-origin, so cross-site
 *      linkage is still broken and every field is still consistent — but the
 *      persona is the same for every Nullecho user on that origin and does not change
 *      when the user hits "New identity". This is reported to the service worker
 *      and surfaced in the popup as "Persona not rotated on this load". It fails
 *      LOUD, never silently.
 *
 *  R2. The fallback pepper is a public constant in an open-source shim, so the
 *      fallback persona set is enumerable. A site that sees a known fallback
 *      persona can infer "this visitor runs Nullecho". Detectability of a privacy
 *      tool is an accepted cost across this whole design (docs/THREAT-MODEL.md);
 *      it is not linkage.
 *
 *  R3. ✅ CLOSED 2026-08-20 — the forgeable transport.
 *
 *      The ISOLATED→MAIN channel is a DOM CustomEvent, which is the page's own
 *      machinery. This note used to say a forger "can pick which persona it is
 *      shown. It learns nothing about other origins," and treat that as tolerable.
 *      It was not the whole story: the same channel carries `enabled:false`, the
 *      allowlist stand-down. A page that dispatched
 *
 *          new CustomEvent('nullecho:persona',
 *            { detail: JSON.stringify({ ok: true, enabled: false }) })
 *
 *      got the shim to restore the real descriptors and hand over the true machine.
 *      Any tracker that had heard of Nullecho could switch it off — worst on
 *      exactly the sites where it matters most.
 *
 *      Now: each MAIN-world script mints a 128-bit nonce at document_start and
 *      publishes it in its `{ phase: 'boot' }` status event, before any page script
 *      exists to hear it. This loader echoes the nonce back with the payload, and a
 *      payload without it is discarded. The full contract, including what the
 *      scheme rests on and what it cannot cover, is in `src/protocol.js` under
 *      "THE NONCE HANDSHAKE".
 *
 *      What survives: the payload is still *visible* to the page once delivered
 *      (the page can have a listener by then). That was always true and is not the
 *      hole — the payload is this origin's own persona, which the page can read off
 *      `navigator` anyway. Visibility is not authority.
 *
 *  R3b. RESIDUAL: the nonce is only unobservable if the MAIN-world script wins the
 *      `document_start` race. If it does not (the Chrome MAIN-world injection bug,
 *      docs/THREAT-MODEL.md), a page script already owns the realm and can both
 *      read the nonce and hook the primitives the shim needs to check it. Nothing
 *      in-page can recover from that. So this loader MEASURES it: at the instant a
 *      boot event arrives it checks, from the ISOLATED world the page cannot reach,
 *      whether any page script had run yet — and reports `nonce-exposed` when one
 *      had, instead of assuming the guarantee held. Note the same race already
 *      decides whether the shim protected anything at all on that page.
 *
 *  R4. If the MAIN-world content script fails to inject at all, the page is
 *      unprotected. We detect that (the shim owes us a boot status) and report it
 *      rather than letting the popup imply protection that is not there.
 *
 *  R5. ORDERING DEPENDENCY, now checked. The nonce reaches us only if these
 *      listeners are installed before `shim.js` dispatches its boot event — i.e.
 *      only if the manifest keeps this file FIRST in `content_scripts` at
 *      `document_start`. That was already load-bearing for R4's boot detection;
 *      under the handshake it also gates the persona upgrade. `protocol.test.js`
 *      asserts the ordering in both manifests, so a reorder fails the suite rather
 *      than silently pinning every page to the fallback persona.
 */

(() => {
  'use strict';

  // ── protocol literals (mirror of src/protocol.js) ─────────────────────────
  //    `protocol.test.js` reads this file as text and fails if these drift.
  const MSG_GET_PERSONA = 'nullecho:get-persona';
  const MSG_FP_DETECTED = 'nullecho:fp-detected';
  const MSG_SHIM_STATUS = 'nullecho:shim-status';
  const EV_PERSONA = 'nullecho:persona';
  const EV_DETECT  = 'nullecho:detect';
  const EV_STATUS  = 'nullecho:status';
  const CH_SHIM    = 'shim';
  const CH_GPC     = 'gpc';
  const BOOT_PHASE = 'boot';

  const HANDSHAKE_TIMEOUT_MS = 1500;
  const BOOT_CHECK_MS = 3000;
  const RETRIES = 2;

  const runtime = (globalThis.chrome ?? globalThis.browser)?.runtime;
  if (!runtime?.id) return; // not running as an extension content script

  let shimBooted = false;
  let delivered = false;
  let loud = true; // overwritten by the service worker's settings

  /**
   * Nonces published by the two MAIN-world scripts in their boot events. Each one
   * authenticates our reply to that script and nothing else. Never sent to the
   * service worker, never logged: they are page-local, single-use, and the SW has
   * no business holding them.
   */
  const nonces = { [CH_SHIM]: null, [CH_GPC]: null };

  /** Persona answer from the service worker, parked until we have a nonce to sign it with. */
  let pending = null;

  /**
   * True once a boot event has arrived at a moment when a page script could
   * already have run — i.e. the MAIN-world script lost the document_start race and
   * its nonce may have been observed (residual risk R3b).
   */
  let nonceExposed = false;

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Reverse channel FIRST.
  //    Content scripts at the same run_at are injected in manifest declaration
  //    order, and this file is declared before the MAIN-world entries — so these
  //    listeners exist before `shim.js` executes its first statement. Nothing
  //    the shim reports at boot can be lost.
  //
  //    This was already load-bearing for R4 (boot detection). Since the handshake
  //    nonce arrives in that same boot event, it now gates the persona upgrade too,
  //    so `protocol.test.js` asserts the manifest ordering in both builds rather
  //    than leaving it to this comment (R5).
  // ─────────────────────────────────────────────────────────────────────────
  document.addEventListener(EV_DETECT, onDetect, true);
  document.addEventListener(EV_STATUS, onStatus, true);

  function parseDetail(ev) {
    // `detail` is a JSON string on purpose. Structured cloning of plain objects
    // across worlds works in Chrome but has historically produced `null` in some
    // Firefox/Chrome combinations; a string always survives.
    try {
      return typeof ev.detail === 'string' ? JSON.parse(ev.detail) : (ev.detail ?? null);
    } catch { return null; }
  }

  function onDetect(ev) {
    const d = parseDetail(ev);
    if (!d) return;
    send({ type: MSG_FP_DETECTED, api: d.api, count: d.count });
  }

  /**
   * Has any page script executed yet, as seen from the ISOLATED world?
   *
   * This is the one place we can answer that honestly. The page cannot patch what
   * an isolated world sees — it has its own copies of the DOM prototypes — so
   * `document.scripts` and `document.readyState` are the browser's account, not
   * the page's claim. Asking the MAIN-world shim to self-report would be asking a
   * possibly-compromised realm whether it is compromised.
   *
   * At a true `document_start` the document holds `<html>` and nothing else: no
   * script element has been parsed, so none has executed. A script element being
   * present is not proof one *ran* (it may be deferred), which is why this is only
   * ever used to downgrade a claim, never to make one.
   */
  function pageScriptCouldHaveRun() {
    try {
      if (document.readyState !== 'loading') return true;
      return (document.scripts ? document.scripts.length : 0) > 0;
    } catch {
      return true; // cannot tell → assume the worse of the two
    }
  }

  /** Read in the ISOLATED world, so a page cannot lie about it either. */
  function isTopFrame() {
    try { return globalThis.top === globalThis.self; } catch { return false; }
  }

  function onBoot(d) {
    const channel = d.channel === CH_GPC ? CH_GPC : CH_SHIM;
    if (channel === CH_SHIM) shimBooted = true;
    if (nonces[channel] === null && typeof d.nonce === 'string' && d.nonce.length >= 16) {
      nonces[channel] = d.nonce;
    }

    // R3b: verify the ordering guarantee the nonce rests on, per page, instead of
    // assuming it. Report a miss; do not pretend it did not happen.
    //
    // TOP FRAME ONLY, on purpose. `about:blank` and `srcdoc` subframes report
    // `readyState: 'complete'` at the moment a content script reaches them, so this
    // check fires on almost every one — and it would be *correct* to, because the
    // parent document is same-origin with that child and already owns its realm
    // outright. But a warning that fires on every page with an ad iframe teaches
    // the user to ignore the warning, which costs more than it buys. That case is a
    // structural property of subframes rather than a per-page anomaly, so it lives
    // in docs/THREAT-MODEL.md; the popup only hears about the top-level document,
    // where a late boot is genuinely news.
    if (!nonceExposed && isTopFrame() && pageScriptCouldHaveRun()) {
      nonceExposed = true;
      send({
        type: MSG_SHIM_STATUS,
        upgraded: false,
        lockedToFallback: false,
        reason: 'nonce-exposed',
      });
      if (loud) {
        console.warn(
          '[Nullecho] The page-world script booted after page script had already ' +
          'run, so its handshake nonce may have been observed. Nullecho most likely ' +
          'also lost the fingerprint race on this page — the same race governs both.'
        );
      }
    }

    maybeDeliver();
  }

  function onStatus(ev) {
    const d = parseDetail(ev);
    if (!d) return;
    if (d.phase === BOOT_PHASE) { onBoot(d); return; }
    send({
      type: MSG_SHIM_STATUS,
      upgraded: d.upgraded,
      lockedToFallback: d.lockedToFallback,
      reason: d.reason,
    });
    if (loud && d.lockedToFallback) {
      console.warn(
        '[Nullecho] This page read a fingerprinting API before the salted persona ' +
        'arrived, so it is seeing the un-rotated fallback persona. Cross-site ' +
        'linkage is still broken; "New identity" will not change what THIS page saw.'
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Forward channel: ask the service worker, hand the result to the shim.
  // ─────────────────────────────────────────────────────────────────────────

  function send(message) {
    try {
      const p = runtime.sendMessage(message);
      // Chrome returns undefined when a callback form is used elsewhere; Firefox
      // returns a promise. Swallow rejections — a dead SW must not throw into the page.
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return p;
    } catch {
      return null; // "Extension context invalidated" during reload/update
    }
  }

  function requestPersona() {
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      const timer = setTimeout(() => done({ ok: false, error: 'timeout' }), HANDSHAKE_TIMEOUT_MS);

      try {
        runtime.sendMessage({ type: MSG_GET_PERSONA }, (res) => {
          clearTimeout(timer);
          const err = (globalThis.chrome ?? globalThis.browser)?.runtime?.lastError;
          if (err) return done({ ok: false, error: err.message });
          done(res ?? { ok: false, error: 'empty response' });
        });
      } catch (e) {
        clearTimeout(timer);
        done({ ok: false, error: String(e?.message ?? e) });
      }
    });
  }

  /**
   * Park the service worker's answer until we hold the shim's nonce, then send it
   * once. Ordering is not a race any more: the nonce arrives in the shim's boot
   * event, which the shim dispatches *after* installing its listener, so having
   * the nonce is proof the shim is listening. That is what retired the old
   * `data-nullecho-boot` attribute channel — see src/protocol.js.
   *
   * The gpc.js nonce is optional. That script is `exclude_matches`-ed off ~50
   * hosts, so on those pages it will never boot and must not hold up the shim's
   * persona. Both scripts are declared at the same `run_at` and boot in the same
   * batch, long before the service-worker round trip resolves, so in practice both
   * nonces are in hand before there is anything to deliver.
   */
  function maybeDeliver() {
    if (delivered || !pending || !nonces[CH_SHIM]) return;
    delivered = true;
    const payload = { ...pending, nonce: nonces[CH_SHIM], gpcNonce: nonces[CH_GPC] };
    pending = null;
    try {
      document.dispatchEvent(new CustomEvent(EV_PERSONA, { detail: JSON.stringify(payload) }));
    } catch (e) {
      if (loud) console.error('[Nullecho] failed to hand the persona to the page shim:', e);
    }
  }

  function deliver(payload) {
    if (delivered) return;
    pending = payload;
    maybeDeliver();
  }

  async function bootstrap() {
    let res = null;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      res = await requestPersona();
      if (res?.ok) break;
      if (res?.error === 'unsupported scheme') break; // not a retryable condition
      await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
    }

    if (typeof res?.loudFailures === 'boolean') loud = res.loudFailures;

    if (!res?.ok) {
      // FAIL LOUD. The shim keeps its fallback persona — the page is still
      // patched and still coherent — but nothing is salt-rotated, and the user
      // must be able to find that out.
      deliver({ ok: false, reason: res?.error ?? 'no response from Nullecho service worker' });
      if (loud) {
        console.error(
          '[Nullecho] Could not reach the extension service worker (%s). ' +
          'This page is running on the FALLBACK persona: still consistent, still ' +
          'different per site, but not rotated by your session identity.',
          res?.error ?? 'unknown'
        );
      }
      return;
    }

    // Allowlisted site: tell the shim to stand down and restore the originals it
    // captured at document_start. This is best-effort by construction — a
    // statically-declared content script cannot be un-declared at runtime, so the
    // page is briefly patched before the restore lands. Documented in README.md.
    deliver({
      ok: true,
      enabled: res.enabled,
      gpc: res.gpc,
      site: res.site,
      persona: res.persona, // null when the site is allowlisted
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Did the MAIN-world shim actually inject? (residual risk R4)
  //    `shim.js` owes us a `nullecho:status` event with { phase: 'boot' } as its
  //    first act. Absence means the MAIN-world content script never ran, and the
  //    user is unprotected on this page while the UI would otherwise imply
  //    otherwise. Report it.
  // ─────────────────────────────────────────────────────────────────────────
  setTimeout(() => {
    if (!shimBooted) {
      send({
        type: MSG_SHIM_STATUS,
        upgraded: false,
        lockedToFallback: false,
        reason: 'shim-never-booted',
      });
      if (loud) {
        console.error(
          '[Nullecho] The page-world shim did not start on this document. ' +
          'Fingerprinting APIs are NOT patched here. If you see this on a normal ' +
          'page, please report it — a silent miss is the failure mode this project ' +
          'most wants to avoid.'
        );
      }
      return;
    }

    // The shim booted but we never got a nonce out of it, so we never sent it a
    // persona and never will. Fail-safe (the page keeps the fallback persona,
    // fully patched) but not silent — the popup must not claim a rotation that
    // did not happen. R5: the usual cause would be a content-script reordering
    // that puts this file after shim.js.
    if (!delivered && !nonces[CH_SHIM]) {
      send({
        type: MSG_SHIM_STATUS,
        upgraded: false,
        lockedToFallback: true,
        reason: 'no-boot-nonce',
      });
      if (loud) {
        console.error(
          '[Nullecho] The page-world shim booted but never published a handshake ' +
          'nonce, so its persona could not be authenticated and was not sent. This ' +
          'page is on the un-rotated fallback persona.'
        );
      }
    }
  }, BOOT_CHECK_MS);

  bootstrap();
})();
