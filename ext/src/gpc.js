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
 * ─── GPC is a disclosed signal. Its IMPLEMENTATION is not. ─────────────────
 *
 * Chrome does not implement `navigator.globalPrivacyControl` natively, so a
 * page that sees it is looking at either an extension or a non-Chrome browser.
 * That costs roughly a bit of entropy, and it is the feature: the entire point
 * of GPC is to be *seen*. This is the one place in Nullecho where announcing
 * yourself is the point, which is why it is a per-user toggle and why layer 2
 * must not be judged by the same standard.
 *
 * ⚠ That argument used to end "…and no amount of `toString` masking can hide
 * it", which conflated two different things and was wrong about the second
 * (review 2026-09-19, G3). Disclosing *that the signal is on* is ~1 bit and is
 * the feature. Disclosing *which software is sending it* is not the feature and
 * is a stable cross-site bit that undoes some of what the persona lane buys.
 * Measured in Chrome for Testing 147: `desc.get.name` was `"get"` and
 * `desc.get.toString()` was `"get() { return true; }"`, where every other
 * accessor on `Navigator.prototype` reads `"get <attr>"` / `[native code]` — a
 * one-line detector with no false positives, and on Firefox (which ships GPC
 * natively) it separated Nullecho from the browser's own signal. Both are now
 * fixed here to the same standard `shim.js` holds itself to (DECISIONS.md D32).
 *
 * ⚠ HONEST LIMIT, not fixed and not claimed fixed: on Chrome the property is
 * the LAST own key of `Navigator.prototype`, because it is appended at
 * document_start; a WebIDL member sits in declaration order. Nothing an
 * in-page script can do reorders an interface's own keys, so a page that
 * compares key ORDER still learns the property was installed rather than
 * declared. See DECISIONS.md D38.
 *
 * ─── OPEN LIMIT: the worker half of the spec is not implemented (A8 / G5) ──
 *
 * The spec says, normatively: `WorkerNavigator includes GlobalPrivacyControl;`
 * (W3C GPC, Working Draft 2026-09-17). Nullecho sets nothing in worker scope,
 * so inside a Worker the page's own code sees no GPC property while the server
 * sees `Sec-GPC: 1` on the very request that worker made.
 *
 * ✅ Measured 2026-09-19, signal ON, header confirmed going out:
 *
 *   Chrome for Testing 147  window `true`   · classic Worker `undefined`,
 *                           blob: Worker `undefined`, ServiceWorker `undefined`
 *                           (`'globalPrivacyControl' in WorkerNavigator.prototype === false`)
 *   Firefox 156 + Nullecho  window `true`   · Worker `false`, blob: Worker `false`
 *   Firefox 156 stock       window `false`  · Worker `false`  ← consistent
 *
 * The Firefox row is the one that costs something: both values come from one
 * preference natively, so no stock Firefox can produce `true` in the window and
 * `false` in a worker. That pair is a cleaner detector than anything the getter
 * itself leaks, and it is not closed here.
 *
 * Why it is not closed here: a MAIN-world content script cannot inject into a
 * worker scope. Reaching it at all means wrapping `Worker`/`SharedWorker` to
 * prepend a `defineProperty` to the script, which covers same-origin and
 * `blob:` classic workers only — module workers, cross-origin worker sources
 * and service workers stay uncovered — and the wrapper is itself detectable.
 * That is a design decision with its own breakage surface, not a patch. **A8
 * stays open.** The header is unaffected: DNR matches at the request level, and
 * worker- and service-worker-initiated requests carry `Sec-GPC: 1` (18 of 18
 * and 4 of 4, captured).
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
    // D29, residual now closed: every config field is read as an OWN property
    // through this, so a field the loader OMITTED cannot be supplied by the page's
    // `Object.prototype`.
    const rawHasOwn = Object.prototype.hasOwnProperty;
    // D32/D38: the getter's SHAPE and SOURCE are built from these. `rawFuncToString`
    // is whatever layer owns `Function.prototype.toString` when we boot — in the
    // shipped manifest that is `shim.js`'s masking replacement, which runs first.
    const rawGetOwnPropDesc = Object.getOwnPropertyDescriptor;
    const RawFunctionProto = Function.prototype;
    const rawFuncToString = RawFunctionProto.toString;
    const rawIndexOf = String.prototype.indexOf;
    // ─── END CAPTURED BUILTINS ────────────────────────────────────────────

    /**
     * Own-property read. An absent field reads as `undefined`, never as whatever
     * the page left on `Object.prototype` — see `applyConfig`.
     */
    const ownField = (obj, key) => (rawApply(rawHasOwn, obj, [key]) ? obj[key] : undefined);

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

    // ── the property: its value, and its shape ────────────────────────────
    //
    // Spec (W3C GPC, 2026-09-17 WD): `readonly attribute boolean
    // globalPrivacyControl`, and "The value is `false` if no `Sec-GPC` header
    // field would be sent; otherwise, the value is `true`." `undefined` is not
    // a conformant value, and `delete` is not a conformant way to reach it —
    // review 2026-09-19 G2. On Firefox, which implements GPC natively, the old
    // `delete` removed the BROWSER's own property and left the user with a
    // Firefox where `'globalPrivacyControl' in Navigator.prototype === false`:
    // a state no stock Firefox can produce, and therefore a stronger identifier
    // than the one the per-site exception was meant to avoid.

    const GPC_PROP = 'globalPrivacyControl';
    /**
     * A sibling accessor on the same interface, used ONLY as a formatting
     * model for the masked source. It must be one the shim does not patch, so
     * that what we copy is the engine's own spelling — measured 2026-09-19:
     * Chrome for Testing 147 prints `function get onLine() { [native code] }`;
     * Firefox 156 prints `function onLine() {\n    [native code]\n}`, with no
     * `get ` and with newlines. Copying beats assuming.
     */
    const MODEL_PROP = 'onLine';

    const NAV_PROTO = RawNavigator ? RawNavigator.prototype : null;

    /**
     * The descriptor the BROWSER shipped, captured before we overwrite it, and
     * the value it yields. Firefox ships GPC natively, so neither is
     * hypothetical — and by D21 discipline this is read once, at boot, not
     * looked up later on an object the page has had time to touch.
     */
    const nativeDesc = NAV_PROTO ? rawGetOwnPropDesc(NAV_PROTO, GPC_PROP) : undefined;
    const nativeValue = (() => {
      if (!nativeDesc) return undefined;
      if (!nativeDesc.get) return nativeDesc.value;
      try { return rawApply(nativeDesc.get, navigator, []); } catch { return undefined; }
    })();

    // Getter SHORTHAND, twice, once per value. D32: a function defined this way
    // has exactly `length` and `name`, no own `prototype`, and is not a
    // constructor — a native WebIDL accessor's shape — and its `name` is
    // "get globalPrivacyControl", which is what every other accessor on
    // `Navigator.prototype` is called. A plain `{ get() {…} }` is named "get".
    const onHolder = { get globalPrivacyControl() { return true; } };
    const offHolder = { get globalPrivacyControl() { return false; } };
    const getOn = rawGetOwnPropDesc(onHolder, GPC_PROP).get;
    const getOff = rawGetOwnPropDesc(offHolder, GPC_PROP).get;

    /**
     * What a native accessor on this interface stringifies to, with the model's
     * name swapped for ours — so the spelling is the ENGINE's, not an assumption
     * about Chrome. Falls back to the `markNative` form `shim.js` uses when
     * there is no usable model (a test rig, or a browser without `onLine`).
     */
    const NATIVE_SOURCE = (() => {
      const fallback = 'function get ' + GPC_PROP + '() { [native code] }';
      try {
        const d = NAV_PROTO ? rawGetOwnPropDesc(NAV_PROTO, MODEL_PROP) : null;
        if (!d || typeof d.get !== 'function') return fallback;
        const src = rawApply(rawFuncToString, d.get, []);
        if (typeof src !== 'string') return fallback;
        if (rawApply(rawIndexOf, src, ['[native code]']) < 0) return fallback;
        const at = rawApply(rawIndexOf, src, [MODEL_PROP]);
        if (at < 0) return fallback;
        return rawApply(rawStrSlice, src, [0, at])
             + GPC_PROP
             + rawApply(rawStrSlice, src, [at + MODEL_PROP.length]);
      } catch { return fallback; }
    })();

    /**
     * `shim.js` owns `Function.prototype.toString` and masks every function IT
     * installs through a WeakMap it alone can reach. `gpc.js` is a separate
     * classic script in the same world with no way into that map, so it layers
     * one more masking wrapper on top: ours for our two getters, delegate for
     * everything else, and — the part that matters — the wrapper answers for
     * ITSELF with whatever the layer below said about itself, because otherwise
     * `Function.prototype.toString.toString()` would print this file. Echoing
     * the layer below is the zero-delta answer: with the shim present that is
     * `[native code]`, with no shim it is the engine's own native string, and
     * in both cases the page sees exactly what it would have seen without us.
     * Installed once, at document_start, before any page script.
     *
     * Residual: `shim.js`'s `restoreAll()` on a whole-extension stand-down puts
     * the original `toString` back over this wrapper. That is the allowlisted
     * case, where `standDown()` below has already handed the property back, so
     * there is nothing left to mask.
     */
    (() => {
      try {
        const d = rawGetOwnPropDesc(RawFunctionProto, 'toString');
        if (!d || typeof d.value !== 'function') return;
        const prev = d.value;
        // What the layer below says about ITSELF — native, or shim.js's mask.
        let selfSrc;
        try { selfSrc = rawApply(prev, prev, []); }
        catch { selfSrc = 'function toString() { [native code] }'; }
        const holder = {
          toString() {
            if (this === getOn || this === getOff) return NATIVE_SOURCE;
            if (this === masked) return selfSrc;
            return rawApply(prev, this, []);
          },
        };
        const masked = rawGetOwnPropDesc(holder, 'toString').value;
        rawDefineProperty(RawFunctionProto, 'toString', {
          value: masked,
          writable: d.writable,
          enumerable: d.enumerable,
          configurable: d.configurable,
        });
      } catch { /* leave the source visible rather than break the page */ }
    })();

    /** True only while *we* own the property, so we never delete a native one. */
    let ownedByUs = false;

    function define(getter) {
      rawDefineProperty(NAV_PROTO, GPC_PROP, {
        get: getter,
        // configurable: true matches the spec'd property, and is what lets us
        // move the signal on a site the user has excepted. The observed failure
        // mode is sites *reading* GPC and refusing service — not sites
        // overwriting it — so locking the property down buys nothing and costs
        // us the recovery path.
        configurable: true,
        enumerable: true,
      });
      ownedByUs = true;
    }

    function setSignal(on) {
      if (!NAV_PROTO || typeof navigator === 'undefined') return;
      try {
        if (on) {
          if (ownedByUs) return;
          // Already true? Another extension or a GPC-native browser got here
          // first. Redefining would be a no-op at best and a detectable
          // double-shim at worst.
          if (navigator[GPC_PROP] === true) return;
          define(getOn);
          return;
        }
        // OFF means "no Sec-GPC header would be sent", which the spec says reads
        // `false` — not absent. Where the browser's own property already says
        // exactly that, hand it back instead: an untouched native accessor is
        // strictly better than an identical-looking replacement.
        if (nativeDesc && nativeValue === false) {
          rawDefineProperty(NAV_PROTO, GPC_PROP, nativeDesc);
          ownedByUs = false;
          return;
        }
        if (nativeDesc && !ownedByUs) return;   // a native `true` we never took over
        define(getOff);
      } catch {
        // Non-configurable native definition: the browser ships GPC itself.
      }
    }

    /**
     * The user allowlisted this site: Nullecho stands down here entirely, so the
     * property goes back to exactly what the browser had — absent on Chrome,
     * the native accessor on Firefox. This is NOT the same as GPC being off,
     * which is a preference the spec wants reported as `false`.
     */
    function standDown() {
      if (!NAV_PROTO) return;
      try {
        if (nativeDesc) rawDefineProperty(NAV_PROTO, GPC_PROP, nativeDesc);
        else if (ownedByUs) delete NAV_PROTO[GPC_PROP];
        ownedByUs = false;
      } catch { /* someone locked it after us */ }
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
      if (!nonceMatches(ownField(cfg, 'gpcNonce'))) return false;
      configApplied = true;
      nonce = null;                                    // used once; no replay value
      // `enabled === false` means the user allowlisted this site outright. The
      // per-site allowlist emits a DNR `allow` rule, which suppresses the
      // Sec-GPC header too — so handing the property back here keeps the two
      // halves telling the same story. `gpc === false` is a different fact:
      // the signal is off, the header is not sent, and the spec says the
      // property must say `false` rather than vanish (G2).
      //
      // OWN properties, never `cfg.gpc` (D29). Authentication proves the loader
      // sent this message; it says nothing about the fields the loader left OUT,
      // and an absent own property is exactly when [[Get]] consults an object the
      // page owns. On the normal path `src/shim.js` swallows the loader's event
      // and relays explicit values for all three fields (D29), so nothing was
      // reachable there — but when the shim never boots, the loader's RAW payload
      // arrives here, and its failure shape (`{ok:false, reason, nonce, gpcNonce}`)
      // carries neither `gpc` nor `enabled`. `Object.prototype.gpc = false` then
      // suppressed the user's do-not-sell signal: a privacy regression the page
      // could trigger, on the one path where the extension is already degraded.
      if (ownField(cfg, 'enabled') === false) standDown();
      else setSignal(ownField(cfg, 'gpc') !== false);
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
    // Index loop, not `for…of`: `for…of` reads `Symbol.iterator` off this realm's
    // `Array.prototype`, which is a run-time prototype call (D21). Boot-only here,
    // so it was never reachable — but review R2-2 found the same shape inside
    // `installInto()` in shim.js, where it very much was, and a lint with an
    // exemption nobody can audit is how that one survived.
    const TARGETS = [globalThis, document];
    for (let i = 0; i < TARGETS.length; i++) {
      try { rawApply(rawAdd, TARGETS[i], [EVENT_PERSONA, onPersona, true]); } catch { /* not an EventTarget */ }
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
  /** Two rules per excepted host — see `syncExceptionRules`. */
  const RULES_PER_EXCEPTION = 2;
  const MAX_EXCEPTIONS = EXCEPTION_RULE_LIMIT / RULES_PER_EXCEPTION;

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
   *
   * TWO rules per host, and that is the whole of review 2026-09-19 G1.
   *
   * DNR **ANDs** the fields inside one `condition`. A single condition carrying
   * both `requestDomains` and `initiatorDomains` therefore matched only a
   * request that was BOTH to the host and from it — which the entry navigation
   * is not: a URL typed, bookmarked, opened in a new tab or followed from
   * another site has no initiator at all. Chrome's own matcher, asked directly
   * with `chrome.declarativeNetRequest.testMatchOutcome` in Chrome for Testing
   * 147 with `a.test` excepted:
   *
   *   top-level nav to a.test (NO initiator)    -> [5200, 5000]   exception MISSED
   *   top-level nav to a.test (initiator a.test)-> [1100000, 5200, 5000]
   *   a.test subresource -> a.test              -> [1100000, 5200, 5000]
   *   a.test page -> third.test (3P)            -> [5200, 5000]   exception MISSED
   *   b.test page -> a.test subresource         -> [5200, 5000]   exception MISSED
   *
   * …and a header capture agreed: the document request carried `Sec-GPC: 1`
   * while the popup printed "Global Privacy Control was **not** sent to this
   * site". The exclusion lists on rule 5000 behave the OPPOSITE way — they are
   * ORed — which is why the shipped breakage list was correct and only the
   * user-facing exception was broken.
   *
   * So: one rule keyed on `requestDomains` (the entry navigation and every
   * request TO the host) and one on `initiatorDomains` (every request the
   * excepted page makes, third parties included). Together they approximate the
   * top-level scoping the spec actually names — `gpcAtNavigation` — which is
   * also what G8 asks for.
   */
  async function syncExceptionRules() {
    await loadUserExceptions();
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing
      .filter((r) => r.id >= EXCEPTION_RULE_BASE
                  && r.id < EXCEPTION_RULE_BASE + EXCEPTION_RULE_LIMIT)
      .map((r) => r.id);

    const action = {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'Sec-GPC', operation: 'remove' }],
    };
    const addRules = [];
    userExceptions.slice(0, MAX_EXCEPTIONS).forEach((host, i) => {
      const base = EXCEPTION_RULE_BASE + i * RULES_PER_EXCEPTION;
      addRules.push(
        {
          id: base,
          priority: 2, // must beat rule 5000's priority 1
          action,
          condition: { requestDomains: [host], resourceTypes: HEADER_RESOURCE_TYPES },
        },
        {
          id: base + 1,
          priority: 2,
          action,
          condition: { initiatorDomains: [host], resourceTypes: HEADER_RESOURCE_TYPES },
        },
      );
    });

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
     * True when the USER excepted this host, as opposed to Nullecho shipping
     * GPC off here because the site breaks. The popup needs the difference:
     * one is a switch the user can flip back, the other is a shipped fact
     * with a different sentence attached (review 2026-09-19 G1 / G4).
     */
    async isUserExcepted(host) {
      const h = normalise(host);
      if (!h) return false;
      const user = await loadUserExceptions();
      return user.some((d) => h === d || h.endsWith(`.${d}`));
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
