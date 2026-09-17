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
 *      ✅ And since 2026-09-16 (review A3, D21) the payload is not visible either:
 *      the shim stops the authenticated delivery dead, so a page listener sees
 *      neither the persona's noise keys nor the reply tokens D30 now carries in it.
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
 *      Since 2026-09-16 (review C1, D30) the measurement is taken at boot but only
 *      REPORTED once a reverse message authenticates. A boot event carries no
 *      token — it is what the tokens are minted in reply to — so raising the
 *      warning straight from it let any page script raise it too.
 *
 *  R4. If the MAIN-world content script fails to inject at all, the page is
 *      unprotected. We detect that and report it rather than letting the popup
 *      imply protection that is not there. What counts as "the shim is here" is an
 *      AUTHENTICATED reverse message, not a boot event: a boot event is forgeable,
 *      so basing the alarm on it let a page silence the loudest thing the popup can
 *      say (review C1, D30).
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
  /** One-time reply tokens minted for the shim. See "THE REVERSE CHANNEL" below. */
  const REPLY_TOKENS = 32;
  const REPLY_TOKEN_BYTES = 8;

  const runtime = (globalThis.chrome ?? globalThis.browser)?.runtime;
  if (!runtime?.id) return; // not running as an extension content script

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
   * ════════════════════════════════════════════════════════════════════════
   * THE REVERSE CHANNEL (MAIN → here), and why a single shared token is not
   * enough — review C1, DECISIONS.md D30.
   * ════════════════════════════════════════════════════════════════════════
   *
   * `nullecho:status` and `nullecho:detect` used to carry no authentication at
   * all, so three lines of page script raised the sticky `nonce-exposed`
   * warning, overwrote a real `lockedToFallback` with a healthy status, and
   * added a million to the popup's fingerprinting counter.
   *
   * The obvious fix — mint one token, deliver it inside the authenticated
   * persona payload, require it on every later report — does not hold up. The
   * reports are DOM events on `document`, which the page can listen for. The
   * first tokened report (the upgrade status) hands the token to any page
   * listener, and from then on the page can mint as many "reports" as it likes.
   *
   * So: **one-time tokens, used strictly in order.** We mint 32 of them, deliver
   * the list inside the same authenticated payload the nonce protects, and
   * accept a message only if it carries the token at the head of the queue —
   * which is then spent. A token a page has seen is a token we have already
   * consumed, so harvest-and-replay buys nothing.
   *
   * And we listen on `window` in the CAPTURE phase, registered here at
   * document_start. That is the same ordering argument D13 makes for the
   * forward channel, run in reverse: `window` is the first node in the
   * propagation path of an event dispatched on `document`, same-phase listeners
   * fire in registration order, and this file is the first content script at
   * `document_start` — so we see each report before any page listener does, and
   * we `stopImmediatePropagation()` the ones we accept, which means a page
   * never sees a live token at all.
   *
   * ⚠ That last property rests on Blink keeping ONE registration-ordered
   * listener list per target across isolated worlds. Asserted from the engine's
   * shape, not measured in a real browser here (the same BASELINE caveat D21
   * carries). If it is wrong, the one-time tokens still hold: the worst a
   * watching page could then do is substitute content for a report the shim
   * really sent, in lockstep, one for one — never invent one.
   *
   * A message we do NOT accept is left to propagate, exactly as D21 leaves an
   * unauthenticated persona event alone: swallowing it would be a free
   * "Nullecho is here" probe.
   */
  const replyTokens = mintTokens();
  /** Tokens not yet spent, in order. `queue[0]` is the only one we will accept next. */
  const queue = replyTokens.slice();

  /** True once a reverse message has authenticated. The health check turns on this, not on a boot event. */
  let authedSeen = false;
  /** A boot event arrived at all. UNAUTHENTICATED — a page can forge one. Used for nothing but the CSPRNG note. */
  let bootAnnounced = false;
  /**
   * The boot event arrived at a moment when a page script could already have run
   * — the MAIN-world script lost the document_start race and its nonce may have
   * been observed (residual risk R3b). Measured when the boot event lands, but
   * only REPORTED once an authenticated reverse message proves our shim is the
   * thing that booted. Otherwise a page could raise this warning by forging a
   * boot event, which is half of review finding C1.
   *
   * ⚠ Measured from the FIRST boot event on a channel only — see `bootSeen`.
   * Re-measuring on every boot event left the warning forgeable after all
   * (review R2-1): the token gate stops a page's *report* being believed, but a
   * page that dispatches a second boot event is not reporting anything, it is
   * steering a measurement we take on its behalf, and the genuine shim's next
   * tokened report then flushes it through as a sticky `nonce-exposed`.
   */
  let bootLate = false;
  /**
   * Which channels have already announced themselves. The FIRST boot event on a
   * channel is the only one allowed to publish that channel's nonce or to move the
   * R3b measurement; every later one is inert. A page cannot be the first — that
   * would mean it won the document_start race, which is the condition the R3b
   * warning exists to report.
   */
  const bootSeen = { [CH_SHIM]: false, [CH_GPC]: false };
  let nonceExposed = false;
  let healthReported = false;
  let bootCheckElapsed = false;
  let bootstrapFinished = false;

  function mintTokens() {
    const out = [];
    try {
      const c = globalThis.crypto;
      if (!c || typeof c.getRandomValues !== 'function') return out;
      for (let i = 0; i < REPLY_TOKENS; i++) {
        const bytes = new Uint8Array(REPLY_TOKEN_BYTES);
        c.getRandomValues(bytes);
        let s = '';
        for (let b = 0; b < bytes.length; b++) s += (bytes[b] + 0x100).toString(16).slice(1);
        out.push(s);
      }
    } catch { /* no CSPRNG: `queue` stays empty and nothing will ever authenticate */ }
    return out;
  }

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
  //
  //    `window` in the CAPTURE phase first, `document` second — see THE REVERSE
  //    CHANNEL above. Registered through `EventTarget.prototype` so a realm whose
  //    global is not itself an EventTarget (test rigs) still gets the window
  //    registration rather than silently falling back to document-only.
  // ─────────────────────────────────────────────────────────────────────────
  for (const target of [globalThis, document]) {
    for (const [type, fn] of [[EV_DETECT, onDetect], [EV_STATUS, onStatus]]) {
      try {
        const add = globalThis.EventTarget?.prototype?.addEventListener ?? target.addEventListener;
        add.call(target, type, fn, true);
      } catch { /* not an EventTarget in this realm */ }
    }
  }

  function parseDetail(ev) {
    // `detail` is a JSON string on purpose. Structured cloning of plain objects
    // across worlds works in Chrome but has historically produced `null` in some
    // Firefox/Chrome combinations; a string always survives.
    try {
      return typeof ev.detail === 'string' ? JSON.parse(ev.detail) : (ev.detail ?? null);
    } catch { return null; }
  }

  /**
   * Spend the one-time token a reverse message must carry, or refuse the message.
   *
   * OWN property, never `d.token`: `parseDetail` may hand back the page's own
   * object (the non-string `detail` path), and an absent own property is exactly
   * when `[[Get]]` consults something the page controls — the D29 lesson, applied
   * to this channel.
   *
   * Accepting SWALLOWS the event, so the spent token never reaches a page
   * listener. Refusing leaves it alone: eating a page's own event would be a free
   * "Nullecho is here" probe (D21's rule for the forward channel).
   */
  function spendToken(d, ev) {
    if (!queue.length) return false;
    let token;
    try { token = Object.prototype.hasOwnProperty.call(d, 'token') ? d.token : undefined; }
    catch { return false; }
    if (typeof token !== 'string' || token !== queue[0]) return false;
    queue.shift();
    try { ev.stopImmediatePropagation(); } catch { /* not a real Event */ }
    onAuthenticated();
    return true;
  }

  /**
   * The first reverse message that authenticates is also the first proof that the
   * thing which published a boot nonce is OUR shim. Only then is it honest to
   * report the R3b race measurement — a page that forges a boot event can raise no
   * warning, because it can never get here.
   */
  function onAuthenticated() {
    authedSeen = true;
    if (nonceExposed || !bootLate) return;
    nonceExposed = true;
    send({ type: MSG_SHIM_STATUS, upgraded: false, lockedToFallback: false, reason: 'nonce-exposed' });
    if (loud) {
      console.warn(
        '[Nullecho] The page-world script booted after page script had already ' +
        'run, so its handshake nonce may have been observed. Nullecho most likely ' +
        'also lost the fingerprint race on this page — the same race governs both.'
      );
    }
  }

  function onDetect(ev) {
    const d = parseDetail(ev);
    if (!d || !spendToken(d, ev)) return;
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

  /**
   * A boot event is the one reverse message that CANNOT carry a token — it is what
   * we mint the tokens in reply to. So it is treated as UNAUTHENTICATED and is
   * allowed to change exactly two things: the fact that something announced itself,
   * and the per-channel nonce (first announcement wins, and a forged second one is
   * ignored). It reports NOTHING to the service worker: no health, no counts, and
   * not the `nonce-exposed` warning, which used to be raised straight from here and
   * was therefore forgeable by three lines of page script (review C1).
   */
  function onBoot(d) {
    const channel = d.channel === CH_GPC ? CH_GPC : CH_SHIM;
    if (channel === CH_SHIM) bootAnnounced = true;

    // ONE announcement per channel, ever. Not "the first one that happens to carry
    // a nonce" — a second boot event must be inert whatever it carries, or a page
    // can forge one and steer what we measure from it (review R2-1). A genuine shim
    // that booted without a CSPRNG publishes no nonce and gets no second chance:
    // nothing is ever delivered to it and `shim-never-booted` says so, which is the
    // right answer and the one D30 already chose for that case.
    const firstOnChannel = !bootSeen[channel];
    bootSeen[channel] = true;
    if (!firstOnChannel) { maybeDeliver(); return; }

    if (nonces[channel] === null && typeof d.nonce === 'string' && d.nonce.length >= 16) {
      nonces[channel] = d.nonce;
    }

    // R3b: verify the ordering guarantee the nonce rests on, per page, instead of
    // assuming it. MEASURED here, at the moment the boot event lands — it is a
    // statement about this instant — and REPORTED later, by `onAuthenticated()`,
    // once a token proves our shim is what booted.
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
    //
    // SHIM CHANNEL ONLY. `gpc.js` is `exclude_matches`-ed off ~50 hosts, so on
    // those pages its channel never announces and a page's forged gpc boot event
    // WOULD be the first one — `firstOnChannel` cannot protect a channel that has
    // no genuine announcement to be first. The measurement is about the shim's
    // nonce anyway, so it is taken from the shim's announcement and no other.
    if (channel === CH_SHIM && isTopFrame() && pageScriptCouldHaveRun()) bootLate = true;

    maybeDeliver();
  }

  function onStatus(ev) {
    const d = parseDetail(ev);
    if (!d) return;
    if (d.phase === BOOT_PHASE) { onBoot(d); return; }
    if (!spendToken(d, ev)) return;
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
    // `reportTokens` rides inside the payload the nonce already authenticates, so
    // only the shim that proved it minted that nonce ever learns them — and D21/A3
    // stop this event dead at the shim, so no page listener sees the delivery at
    // all. Review C1, D30.
    const payload = {
      ...pending,
      nonce: nonces[CH_SHIM],
      gpcNonce: nonces[CH_GPC],
      reportTokens: replyTokens,
    };
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
  //
  //    This used to turn on a boot event having arrived. A boot event is
  //    unauthenticated, so a page could SILENCE this alarm — the loudest thing
  //    the popup can say — by dispatching three lines of forged JSON (review C1).
  //    It now turns on an authenticated reverse message, which only our shim can
  //    produce: `applyAuthenticated()` emits exactly one status on every branch,
  //    so a genuine shim that received any delivery has answered by now.
  //
  //    One alarm, not two. The old `no-boot-nonce` report ("booted, but published
  //    no nonce, so it is on the un-rotated fallback") was quieter than
  //    `shim-never-booted` and could only be distinguished from it using the
  //    forgeable boot event — i.e. a page could downgrade "you are NOT patched"
  //    to "you are patched but not rotated". The genuine case it described (a
  //    realm with no CSPRNG) now gets the loud alarm plus a console line; a
  //    quieter claim derived from unauthenticated evidence is not worth the hole.
  //
  //    The check waits for BOTH the timer and the end of `bootstrap()`: a slow
  //    service worker can take longer than BOOT_CHECK_MS once retries are counted,
  //    and reporting "never booted" while we have not yet sent the persona would
  //    be a false alarm.
  // ─────────────────────────────────────────────────────────────────────────
  function checkHealth() {
    if (healthReported || !bootCheckElapsed || !bootstrapFinished || authedSeen) return;
    healthReported = true;
    send({
      type: MSG_SHIM_STATUS,
      upgraded: false,
      lockedToFallback: false,
      reason: 'shim-never-booted',
    });
    if (loud) {
      console.error(
        '[Nullecho] The page-world shim did not answer on this document. ' +
        'Fingerprinting APIs are NOT patched here. If you see this on a normal ' +
        'page, please report it — a silent miss is the failure mode this project ' +
        'most wants to avoid.'
      );
      if (bootAnnounced && !nonces[CH_SHIM]) {
        console.error(
          '[Nullecho] Something announced itself on the shim channel but published ' +
          'no handshake nonce, so no persona could be authenticated or sent. In a ' +
          'genuine install that means this realm has no crypto.getRandomValues.'
        );
      }
    }
  }

  setTimeout(() => { bootCheckElapsed = true; checkHealth(); }, BOOT_CHECK_MS);

  bootstrap().then(() => { bootstrapFinished = true; checkHealth(); },
    () => { bootstrapFinished = true; checkHealth(); });
})();
