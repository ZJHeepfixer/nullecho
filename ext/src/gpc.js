/**
 * Nullecho — Global Privacy Control
 * ──────────────────────────────
 * Two halves of one signal (DECISIONS.md D6):
 *
 *   1. `Sec-GPC: 1` on outgoing requests — a static DNR `modifyHeaders` rule,
 *      shipped as its own ruleset (`rules/gpc.json`, rule id 5000) so the user
 *      can toggle it independently of the blocklists.
 *   2. `navigator.globalPrivacyControl === true` — set from a MAIN-world
 *      content script at document_start, because a site's JS reads the JS
 *      property, not the header.
 *
 * ─── HONEST LIMITS. Read before writing any UI copy. ────────────────────────
 *
 * GPC has real statutory teeth: California's $1.2M Sephora settlement (2022)
 * was partly for ignoring it, and CCPA regulations treat it as a valid opt-out
 * request. It is worth shipping. It is *not* a switch that stops data sales.
 *
 *   - A USENIX Security 2025 study found only about one in three sites that
 *     appear to sell or share data implement any opt-out signal at all, and of
 *     those, only ~44% honoured every signal they claimed to support. The
 *     realistic expectation is well under half of applicable sites — not
 *     "most", and certainly not "all".
 *   - Enforcement is jurisdictional: California, Colorado, Connecticut and a
 *     handful of other US states. Most of the world, nowhere.
 *   - It is a *request*, not a technical control. Sending `Sec-GPC: 1` prevents
 *     no collection whatsoever. The blocking layer does that; this layer
 *     creates a legal obligation the site may or may not meet.
 *   - We cannot verify compliance. Nullecho can show the signal was sent. It
 *     cannot show anyone acted on it, and must never imply that it can.
 *
 * UI copy should read like "asks sites not to sell or share your data —
 * legally binding in some US states, honoured inconsistently", never "stops
 * sites from selling your data".
 *
 * Watch item (D6): California AB 566 requires browsers to ship a built-in
 * opt-out signal from 2027-01-01, which may make this feature redundant.
 *
 * ─── GPC is a disclosed signal, and that is not a fingerprinting bug ───────
 *
 * Chrome does not implement `navigator.globalPrivacyControl` natively, so a
 * page that sees it is looking at either an extension or a non-Chrome browser.
 * That costs roughly a bit of entropy, and no amount of `toString` masking can
 * hide it — the entire point of GPC is to be *seen*. This is the one place in
 * Nullecho where announcing yourself is the feature, which is exactly why it is a
 * per-user toggle and why layer 2 must not be judged by the same standard.
 *
 * ─── Known breakage ────────────────────────────────────────────────────────
 *
 * Some sites break when GPC is present rather than honouring it. EasyPrivacy
 * carries a dedicated "! GPC" section that neutralises
 * `navigator.globalPrivacyControl` on ~50 hosts — USAA, for instance, answers
 * with "Enable Cookies. Please enable cookies in your browser to access USAA."
 * Note what that tells us: sites break on the **JS property**, not the header.
 * Suppressing only the header would not have been enough.
 *
 * That list therefore appears in two places, and `ext/rules/validate.mjs`
 * fails the build if they drift apart:
 *   - `rules/gpc.json` rule 5000 → `excludedRequestDomains` (header)
 *   - `manifest.json` → the `src/gpc.js` content script's `exclude_matches`
 *     (JS property)
 *
 * User-added exceptions arrive later, through the persona handshake, and are
 * applied by correcting the property after the fact. See `applyConfig`.
 *
 * ─── Loading ───────────────────────────────────────────────────────────────
 *
 * A *classic* script on purpose, so one source can serve as both a MAIN-world
 * content script (which cannot be an ES module) and a side-effect import in
 * the module service worker:
 *
 *     import './gpc.js';           // background.js — exposes globalThis.NullechoGPC
 *
 * In a page it installs the property and defines nothing else, deliberately:
 * any global Nullecho leaves on `window` is itself a fingerprinting surface.
 */

(function () {
  'use strict';

  const IN_EXTENSION_WORKER =
    typeof chrome !== 'undefined' &&
    !!(chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules);

  if (!IN_EXTENSION_WORKER) {
    runInPage();
    return;
  }

  // ══ page half ════════════════════════════════════════════════════════════

  function runInPage() {
    // Inlined from src/protocol.js — content scripts are classic scripts and
    // cannot import it. `protocol.test.js` reads this file as text and fails if
    // these drift.
    const EVENT_PERSONA = 'nullecho:persona';
    const EVENT_STATUS = 'nullecho:status';
    const CHANNEL = 'gpc';
    const BOOT_PHASE = 'boot';
    const NONCE_BYTES = 16;

    // ── pristine primitives + boot nonce ──────────────────────────────────
    //
    // Same reasoning as src/shim.js section 0a, same threat: `applyConfig` can
    // take the GPC signal back DOWN, so an unauthenticated channel let any page
    // dispatch `{ gpc: false }` and delete its own `navigator.globalPrivacyControl`.
    // GPC is the one part of Nullecho with statutory teeth (DECISIONS.md D6);
    // letting the party the signal is aimed at switch it off is the whole ballgame.
    //
    // The Sec-GPC *header* is DNR's and was never reachable from the page, so this
    // was a half-defeat rather than a full one — but a site that reads the JS
    // property and ignores the header would have seen exactly what it wanted.
    //
    // DECISIONS.md D21 (review A2d): capturing `JSON.parse` and `detail` was not
    // enough — `nonceMatches` compared through the LIVE `String.prototype.charCodeAt`,
    // and `rawDetailGet.call(e)` went through the live `Function.prototype.call`.
    // `String.prototype.charCodeAt = () => 0` made any 32-character string match
    // and let the site delete its own do-not-sell signal. Every builtin this half
    // touches after boot is now captured here and invoked through a captured
    // `Reflect.apply`; nothing below calls a prototype at run time.
    // ─── BEGIN CAPTURED BUILTINS ──────────────────────────────────────────
    const rawApply = Reflect.apply;
    const rawParse = JSON.parse;
    const rawStringify = JSON.stringify;
    const rawDefineProperty = Object.defineProperty;
    const rawCharCodeAt = String.prototype.charCodeAt;
    const rawNumToString = Number.prototype.toString;
    const rawStrSlice = String.prototype.slice;
    const RawUint8Array = Uint8Array;
    const RawNavigator = typeof Navigator === 'undefined' ? null : Navigator;
    const RawCustomEvent = globalThis.CustomEvent;
    const rawDetailGet = (() => {
      try {
        const d = RawCustomEvent && Object.getOwnPropertyDescriptor(RawCustomEvent.prototype, 'detail');
        return d && d.get;
      } catch { return null; }
    })();
    // Resolved through the CustomEvent chain (Event.prototype in a browser) so a
    // test rig whose fake event does not extend Event still yields one.
    const rawStopImmediate = (() => {
      try {
        const f = RawCustomEvent && RawCustomEvent.prototype && RawCustomEvent.prototype.stopImmediatePropagation;
        return typeof f === 'function' ? f : null;
      } catch { return null; }
    })();
    const rawAdd = globalThis.EventTarget && globalThis.EventTarget.prototype.addEventListener;
    const rawDispatch = globalThis.EventTarget && globalThis.EventTarget.prototype.dispatchEvent;
    // ─── END CAPTURED BUILTINS ────────────────────────────────────────────

    let nonce = (() => {
      try {
        const c = globalThis.crypto;
        if (!c || typeof c.getRandomValues !== 'function') return null;
        const bytes = new RawUint8Array(NONCE_BYTES);
        c.getRandomValues(bytes);
        let out = '';
        for (let i = 0; i < NONCE_BYTES; i++) {
          out += rawApply(rawStrSlice, rawApply(rawNumToString, bytes[i] + 0x100, [16]), [1]);
        }
        return out;
      } catch { return null; }
    })();

    let configApplied = false;

    function nonceMatches(candidate) {
      if (typeof nonce !== 'string' || typeof candidate !== 'string') return false;
      if (candidate.length !== nonce.length) return false;
      let diff = 0;
      for (let i = 0; i < nonce.length; i++) {
        diff |= rawApply(rawCharCodeAt, nonce, [i]) ^ rawApply(rawCharCodeAt, candidate, [i]);
      }
      return diff === 0;
    }

    /** True only while *we* own the property, so we never delete a native one. */
    let ownedByUs = false;

    function setSignal(on) {
      if (!RawNavigator || typeof navigator === 'undefined') return;
      if (on) {
        if (ownedByUs) return;
        try {
          // Already true? Another extension or a GPC-native browser got here
          // first. Redefining would be a no-op at best and a detectable
          // double-shim at worst.
          if (navigator.globalPrivacyControl === true) return;
          rawDefineProperty(RawNavigator.prototype, 'globalPrivacyControl', {
            get() { return true; },
            // configurable: true matches the spec'd property, and is what lets
            // us take the signal back down on a site the user has excepted.
            // The observed failure mode is sites *reading* GPC and refusing
            // service — not sites overwriting it — so locking the property
            // down buys nothing and costs us the recovery path.
            configurable: true,
            enumerable: true,
          });
          ownedByUs = true;
        } catch {
          // Non-configurable native definition: the browser ships GPC itself.
        }
      } else if (ownedByUs) {
        try {
          delete RawNavigator.prototype.globalPrivacyControl;
          ownedByUs = false;
        } catch { /* someone locked it after us */ }
      }
    }

    /**
     * Default ON, applied synchronously at document_start before any page
     * script runs. GPC-on is the shipped default and the shipped breakage
     * hosts are excluded via the manifest's `exclude_matches`, so the common
     * case is correct with zero latency. The handshake below only ever has to
     * walk the signal *back* — for a user-added exception, or when GPC is
     * switched off globally.
     */
    setSignal(true);

    /** Returns true only when the payload authenticated and was applied. */
    function applyConfig(raw) {
      if (configApplied) return false;                 // one-shot, like the shim
      let cfg;
      try {
        cfg = typeof raw === 'string' ? rawParse(raw) : raw;
      } catch {
        return false;
      }
      if (!cfg || typeof cfg !== 'object') return false;
      // AUTHENTICATE. Only the loader can echo the nonce published below, and a
      // mismatch is dropped WITHOUT consuming the one-shot — otherwise a page
      // could shout first and pin the signal to whatever the default happened to
      // be. Silently: unlike the shim, gpc.js has no reporting channel of its own,
      // and adding one to argue with a hostile page is not worth a global.
      if (!nonceMatches(cfg.gpcNonce)) return false;
      configApplied = true;
      nonce = null;                                    // used once; no replay value
      // `enabled === false` means the user allowlisted this site outright. The
      // per-site allowlist emits a DNR `allow` rule, which suppresses the
      // Sec-GPC header too — so dropping the JS property here keeps the two
      // halves telling the same story.
      const on = cfg.gpc !== false && cfg.enabled !== false;
      setSignal(on);
      return true;
    }

    // Listen on `window` in the CAPTURE phase FIRST, then `document`.
    //
    // The loader dispatches on `document`, and `window` is the first node in that
    // event's propagation path — so a page's own `window` capture listener would
    // otherwise run before a document-phase listener of ours, read the nonce out
    // of the payload, and `stopPropagation()` it away. Same-phase listeners fire in
    // registration order and this runs at document_start, so ours is first. The
    // `document` registration is a fallback for any engine that does not put the
    // window in a document event's path; the one-shot makes the double delivery a
    // no-op.
    //
    // `detail` is read through the descriptor captured above, never the live
    // property: a page that redefines `CustomEvent.prototype.detail` could
    // otherwise swap the payload after we have authenticated nothing yet.
    //
    // WHAT WE ACTUALLY RECEIVE (D21, review A3). `src/shim.js` registers on the
    // same event before us and, once ITS nonce authenticates the loader's
    // delivery, stops that event dead — so a page listener can never read the
    // persona out of it — and re-dispatches a stripped `{ ok, enabled, gpc,
    // gpcNonce }` on this same channel for us. We authenticate that copy with our
    // own nonce and stop it in turn. When the shim is absent (it never is in the
    // shipped manifest; it is in `gpc.test.js`) the loader's original event
    // reaches us directly and the same code runs. Either way, an event we have
    // accepted goes no further.
    const onPersona = (e) => {
      let raw;
      try { raw = rawDetailGet ? rawApply(rawDetailGet, e, []) : e.detail; } catch { return; }
      if (!applyConfig(raw)) return;
      try { if (rawStopImmediate) rawApply(rawStopImmediate, e, []); } catch { /* not a real Event */ }
    };
    for (const target of [globalThis, document]) {
      try { rawApply(rawAdd, target, [EVENT_PERSONA, onPersona, true]); } catch { /* not an EventTarget */ }
    }

    // Announce, and publish the nonce. First thing observable from the page, and
    // at document_start there is no page script yet to observe it. The loader
    // echoes it back in the persona payload as `gpcNonce`.
    //
    // The old `data-nullecho-boot` attribute channel is gone: it would have written
    // this nonce into the DOM for any later script to read. See src/protocol.js.
    try {
      rawApply(rawDispatch, document, [new RawCustomEvent(EVENT_STATUS, {
        detail: rawStringify({ phase: BOOT_PHASE, channel: CHANNEL, nonce }),
      })]);
    } catch { /* nothing to do; GPC stays at its default of ON */ }
  }

  // ══ extension half ═══════════════════════════════════════════════════════

  const RULESET_ID = 'gpc';
  const RULESET_PATH = 'rules/gpc.json';
  const HEADER_RULE_ID = 5000;

  /** Reserved runtime id range — see ext/rules/validate.mjs DYNAMIC_RANGES. */
  const EXCEPTION_RULE_BASE = 1_100_000;
  const EXCEPTION_RULE_LIMIT = 1000;

  // Namespaced to match the sibling lanes' convention (`nullecho:heuristics:v1`).
  const STORAGE_KEY = 'nullecho:gpc:v1';

  const HEADER_RESOURCE_TYPES = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font',
    'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'other',
  ];

  let userExceptions = null;
  let shippedExceptions = null;

  const normalise = (host) =>
    String(host || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

  /** Read the shipped breakage list back out of the ruleset we actually ship. */
  async function loadShippedExceptions() {
    if (shippedExceptions) return shippedExceptions;
    try {
      const res = await fetch(chrome.runtime.getURL(RULESET_PATH));
      const rules = await res.json();
      const rule = rules.find((r) => r.id === HEADER_RULE_ID);
      shippedExceptions = rule?.condition?.excludedRequestDomains ?? [];
    } catch {
      shippedExceptions = [];
    }
    return shippedExceptions;
  }

  async function loadUserExceptions() {
    if (userExceptions) return userExceptions;
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const saved = stored[STORAGE_KEY];
    userExceptions = Array.isArray(saved?.exceptions) ? saved.exceptions : [];
    return userExceptions;
  }

  const saveUserExceptions = () =>
    chrome.storage.local.set({ [STORAGE_KEY]: { exceptions: userExceptions } });

  /**
   * Per-site header suppression, as a *higher-priority `modifyHeaders` remove*
   * rather than an `allow` rule.
   *
   * DNR priorities are global across every ruleset, so an `allow` rule here
   * would also switch off ad, analytics and social blocking on that site —
   * the opposite of what a user asking for "GPC off, please" wants. A
   * competing modifyHeaders rule at higher priority suppresses just the header.
   */
  async function syncExceptionRules() {
    await loadUserExceptions();
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing
      .filter((r) => r.id >= EXCEPTION_RULE_BASE
                  && r.id < EXCEPTION_RULE_BASE + EXCEPTION_RULE_LIMIT)
      .map((r) => r.id);

    const addRules = userExceptions.slice(0, EXCEPTION_RULE_LIMIT).map((host, i) => ({
      id: EXCEPTION_RULE_BASE + i,
      priority: 2, // must beat rule 5000's priority 1
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Sec-GPC', operation: 'remove' }],
      },
      condition: {
        requestDomains: [host],
        initiatorDomains: [host],
        resourceTypes: HEADER_RESOURCE_TYPES,
      },
    }));

    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  }

  const NullechoGPC = {
    RULESET_ID,
    HEADER_RULE_ID,
    STORAGE_KEY,

    /** Call from the service worker once at startup. */
    init() {
      return syncExceptionRules().catch((e) => console.error('[nullecho] gpc init:', e));
    },

    async isEnabled() {
      const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
      return enabled.includes(RULESET_ID);
    },

    /**
     * Turn the Sec-GPC header on or off.
     *
     * The JS property follows separately: it is set unconditionally at
     * document_start and corrected by the persona handshake, so whoever owns
     * settings must report `gpc: false` in the GET_PERSONA response when this
     * is off. Header and property disagreeing is worse than either being off.
     */
    async setEnabled(on) {
      await chrome.declarativeNetRequest.updateEnabledRulesets(
        on ? { enableRulesetIds: [RULESET_ID] } : { disableRulesetIds: [RULESET_ID] },
      );
    },

    /** Hosts where Nullecho ships GPC off because the site breaks with it on. */
    shippedExceptions: () => loadShippedExceptions(),

    /** Hosts the user has excepted. */
    userExceptions: () => loadUserExceptions().then((x) => x.slice()),

    /**
     * Synchronous per-site exception check, for the GET_PERSONA hot path.
     *
     * The persona handshake runs at document_start with the page waiting on
     * it, so it cannot afford an async storage read. This answers from the
     * cache `init()` primes at worker startup; on a cold worker it returns
     * `false` — i.e. "not excepted", the shipped default — and self-corrects
     * on the next navigation once `init()` resolves. Wrong for at most one
     * page load, on a list that is empty for almost every user.
     *
     * The ~50 shipped breakage hosts are not checked here: the content script
     * is excluded from them in the manifest, so it never runs there at all.
     */
    isExceptedSync(host) {
      const h = normalise(host);
      if (!h || !userExceptions) return false;
      return userExceptions.some((d) => h === d || h.endsWith(`.${d}`));
    },

    /**
     * True if GPC should be reported to this site. The authoritative,
     * async version — use `isExceptedSync` on the handshake path.
     */
    async isEnabledForSite(host) {
      const h = normalise(host);
      if (!h) return false;
      if (!(await NullechoGPC.isEnabled())) return false;
      const shipped = await loadShippedExceptions();
      const user = await loadUserExceptions();
      const hit = (list) => list.some((d) => h === d || h.endsWith(`.${d}`));
      return !hit(shipped) && !hit(user);
    },

    /**
     * Add or remove a per-site exception. This is the recovery path for a site
     * that misbehaves with GPC — "enable cookies" errors, blank pages, refused
     * sign-in — and is strictly better than switching GPC off globally.
     */
    async setSiteException(host, excepted) {
      const h = normalise(host);
      if (!h) return;
      await loadUserExceptions();
      const has = userExceptions.includes(h);
      if (excepted === has) return;
      userExceptions = excepted
        ? [...userExceptions, h]
        : userExceptions.filter((x) => x !== h);
      await saveUserExceptions();
      await syncExceptionRules();
    },
  };

  globalThis.NullechoGPC = NullechoGPC;
})();
