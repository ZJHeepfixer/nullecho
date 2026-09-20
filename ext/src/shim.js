/**
 * Nullecho — MAIN-world fingerprint shim.
 * ═══════════════════════════════════════
 * Classic script, `"world": "MAIN"`, `"run_at": "document_start"`. This file *is*
 * the page's JavaScript context. Everything it does is visible to the page; the
 * only thing it has that the page does not is *arrival order*.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * CONTRACT WITH src/shim-loader.js  (do not redesign — implemented, not invented)
 * ──────────────────────────────────────────────────────────────────────────────
 *  · First acts, in this order: register the persona listener on `window` in the
 *    capture phase, then dispatch `nullecho:status`
 *    { phase: 'boot', channel: 'shim', nonce } — which both tells the loader the
 *    MAIN-world script actually injected (loader residual risk R4) and hands it the
 *    128-bit nonce that authenticates its reply. The nonce is minted from
 *    `crypto.getRandomValues` before anything is dispatched, so no page script can
 *    have observed it. See "THE NONCE HANDSHAKE" in src/protocol.js.
 *  · Patch EVERYTHING synchronously, before the handshake, using a FALLBACK
 *    persona derived here from the registrable domain + a public pepper. There is
 *    never a window in which a page can read a true value.
 *  · Accept the salted persona over `nullecho:persona` (detail = JSON **string**)
 *    at most once, and ONLY if it echoes the boot nonce. A payload that does not
 *    is discarded without consuming the one-shot — otherwise a page could deny the
 *    upgrade by shouting first.
 *  · Upgrade ONLY if no shimmed API has been read yet. A persona swap after a read
 *    produces exactly the cross-field contradiction DECISIONS.md D2 calls worse
 *    than no defense (cores from persona A, GPU from persona B). If a read already
 *    happened we stay locked on the fallback and say so, loudly.
 *  · `{ enabled: false }` / `persona: null` (allowlisted site) → restore every
 *    original descriptor and stand down.
 *  · Report suspicious read volume over `nullecho:detect` { api, count }.
 *
 * The upgrade is a *data* swap, not a re-patch: every shim reads its values out of
 * `state.derived` at call time. Patching happens exactly once, so there is no
 * second install to race and no window of double-wrapped functions.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE ONE PROPERTY THAT MATTERS: DETERMINISM
 * ──────────────────────────────────────────────────────────────────────────────
 * Every noise value is a pure function of (persona noise key, a digest of the real
 * content, stable coordinates) — D22. Content-keyed, so a known input teaches a page
 * nothing about the pattern on any other image; deterministic, so repeated reads agree.
 * No call counters, no Math.random, no time. Reading the same canvas 50 times
 * returns 50 identical results, which is what defeats the averaging attack that
 * broke Brave's per-read farbling in 2025. Noise that varies per read is not a
 * defense; it is a slower way to leak the same value plus a "this user runs an
 * anti-fingerprinting tool" flag.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * KNOWN GAPS — stated here so nobody has to discover them the hard way
 * ──────────────────────────────────────────────────────────────────────────────
 *  G1. Web Workers / Service Workers. Content scripts do not run there. A tracker
 *      that fingerprints from `new Worker()` (OffscreenCanvas, navigator, WebGL in
 *      a worker) sees the real machine. Unreachable from a MAIN-world shim.
 *  G2. WASM-compiled fingerprinting ("The WASM Cloak", 2025) can re-derive some
 *      signals without touching the JS APIs patched here. Partial gap for every
 *      shim-based defense. See DECISIONS.md D9.
 *  G3. Fonts are measurement-faked, not actually installed/uninstalled. The shim
 *      covers `offsetWidth`, `offsetHeight`, `measureText` and
 *      `getBoundingClientRect` — which agree with each other by construction. It
 *      does NOT cover `Element.getClientRects()`, `Range.getClientRects()`
 *      (DOMRectList is not constructible from JS) or SVG text metrics. Those remain
 *      both a bypass and a detector. See the FONTS section.
 *  G4. `Intl.DateTimeFormat().resolvedOptions().timeZone` and
 *      `Date.prototype.getTimezoneOffset` are deliberately NOT shimmed. See TIMEZONE.
 *  G5. THE WHOLE DISPLAY LAYER is deliberately not spoofed — screen geometry,
 *      devicePixelRatio, colour depth, HDR and gamut all leak truthfully. CSS
 *      `@media` mirrors every one of them below the JS layer and cannot be
 *      intercepted, so spoofing them produced a self-contradiction instead of a
 *      disguise. This is the largest single protection reduction in the shim; the
 *      reasoning is in the DISPLAY LAYER section and in docs/ARKENFOX-RESPONSE.md.
 *  G6. `window.outerWidth/innerWidth` are not spoofed either — same layer, and
 *      faking the viewport breaks responsive layout outright.
 *  G7. The persona pool below is a GENERATED MIRROR of `src/personas.js`. MV3
 *      forbids ES modules in content scripts and the fallback must be derived
 *      synchronously, so there is no import to make. Regenerate on pool changes;
 *      `personas.test.js` should assert the two agree.
 *  G8. User *preference* media features (`prefers-reduced-motion`,
 *      `prefers-color-scheme`, `prefers-contrast`, `forced-colors`, …) are left
 *      truthful on purpose. They carry entropy; spoofing them harms disabled
 *      users — a privacy tool that triggers the animations a vestibular-disorder
 *      user disabled has its priorities inverted. An accepted leak, not an oversight.
 *  G9. EVERY guarantee in this file, including the nonce handshake, is downstream of
 *      winning the `document_start` race. If a page script runs first it owns the
 *      realm: it can replace `JSON.parse`, `CustomEvent.prototype.detail`,
 *      `crypto.getRandomValues` and `addEventListener` before we capture them, and
 *      then read the nonce out of a legitimate delivery. Section 0a captures those
 *      primitives at boot so that beating the handshake requires beating the race —
 *      no more, no less. It cannot be fixed from inside the page, and the race is
 *      already the thing that decides whether this shim protects anything at all
 *      (docs/THREAT-MODEL.md, "MAIN-world injection race"). The loader measures
 *      whether the race was won on each page and reports `nonce-exposed` when it
 *      was not, so the failure is visible rather than assumed away.
 */

(() => {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  // 0. Protocol literals — mirror of src/protocol.js (classic script, no import)
  //    `protocol.test.js` reads this file as text and fails if these drift.
  // ══════════════════════════════════════════════════════════════════════════
  const EV_PERSONA = 'nullecho:persona';
  const EV_DETECT = 'nullecho:detect';
  const EV_STATUS = 'nullecho:status';
  const CHANNEL = 'shim';
  const BOOT_PHASE = 'boot';
  const NONCE_BYTES = 16;

  // ══════════════════════════════════════════════════════════════════════════
  // 0a. PRISTINE PRIMITIVES — captured before anything else in this file runs.
  //
  // Everything below is page machinery, and this script's only advantage over the
  // page is arrival order. It has to spend that advantage immediately, and it has
  // to spend it on EVERYTHING it will ever call — not just the four handshake
  // primitives the first version captured.
  //
  // DECISIONS.md D21, the lesson of the 2026-09-16 review (A2/C2): a shim that
  // captures `JSON.parse` and `CustomEvent.prototype.detail` but then does
  // `expected.charCodeAt(i)` or `origGet.call(this)` at run time has not made the
  // handshake depend on the document_start race at all. Any page script, at any
  // later moment, can hook `String.prototype.charCodeAt` (→ every nonce matches →
  // forged stand-down), `Function.prototype.call` (→ receives the NATIVE getter
  // the brand check delegates to → real userAgent/cores/GPU), `Math.imul` (→ noise
  // becomes persona-independent), `%TypedArray%.prototype.length` (→ the ink scan
  // sees an empty buffer → no noise), `WeakMap.prototype.get` (→ receives
  // NATIVE_SRC → an exact membership oracle for every patched function).
  //
  // THE RULE: the shim never calls a prototype at run time. Every builtin it uses
  // is captured here into a local constant and invoked through a boot-captured
  // `Reflect.apply`. `review-2026-09-16.test.js` hooks each of these from the page
  // and asserts nothing changes, and lints this file for bare `.call(`, `.apply(`,
  // `Math.`, `.charCodeAt(`, `new Set(` … outside this block.
  //
  // What this does NOT change: if the page owns the realm BEFORE this script runs
  // (the MAIN-world injection race, docs/THREAT-MODEL.md), it can pre-hook what we
  // capture. That race is measured by the loader (`nonce-exposed`); nothing in
  // the page can close it.
  // ══════════════════════════════════════════════════════════════════════════
  // ─── BEGIN CAPTURED BUILTINS — the lint in review-2026-09-16.test.js starts after END ───
  const RAW = {
    jsonParse: JSON.parse,
    jsonStringify: JSON.stringify,
    CustomEvent: globalThis.CustomEvent,
    addEventListener: globalThis.EventTarget && globalThis.EventTarget.prototype.addEventListener,
    removeEventListener: globalThis.EventTarget && globalThis.EventTarget.prototype.removeEventListener,
    dispatchEvent: globalThis.EventTarget && globalThis.EventTarget.prototype.dispatchEvent,
    detailGet: (() => {
      try {
        const CE = globalThis.CustomEvent;
        const d = CE && Object.getOwnPropertyDescriptor(CE.prototype, 'detail');
        return d && d.get;
      } catch (_) { return null; }
    })(),
    // Resolved through the CustomEvent chain so a realm whose fake CustomEvent
    // does not extend Event (test rigs) still yields one. In Chrome this is
    // `Event.prototype.stopImmediatePropagation`. Used to keep the persona payload
    // (noise keys, seed) out of page listeners — review finding A3.
    stopImmediatePropagation: (() => {
      try {
        const CE = globalThis.CustomEvent;
        const f = CE && CE.prototype && CE.prototype.stopImmediatePropagation;
        return typeof f === 'function' ? f : null;
      } catch (_) { return null; }
    })(),
    getRandomValues: (() => {
      try {
        const c = globalThis.crypto;
        return c && typeof c.getRandomValues === 'function' ? c.getRandomValues.bind(c) : null;
      } catch (_) { return null; }
    })(),
  };

  // `Reflect.apply` is the one primitive everything else routes through: it is an
  // intrinsic that consults no prototype when invoked. `uncurry(fn)` turns a
  // prototype method into a plain function taking the receiver first; the rest
  // parameter builds a fresh array (no iterator protocol involved).
  const apply = Reflect.apply;
  const uncurry = (fn) => (thisArg, ...args) => apply(fn, thisArg, args);
  const getterOf = (obj, prop) => {
    try {
      const d = obj && Object.getOwnPropertyDescriptor(obj, prop);
      return d && typeof d.get === 'function' ? d.get : null;
    } catch (_) { return null; }
  };

  // Constructors and statics. A page can reassign `window.Set`/`window.Math`
  // outright; a local binding cannot be reassigned by anyone.
  const RawString = String;
  const RawSet = Set;
  const RawMap = Map;
  const RawWeakMap = WeakMap;
  const RawWeakSet = WeakSet;
  const RawUint8Array = Uint8Array;
  const RawUint32Array = Uint32Array;   // bit-exact float digests (D22)
  const RawError = Error;
  const symIterator = Symbol.iterator;

  const objDefineProperty = Object.defineProperty;
  const objGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const objGetPrototypeOf = Object.getPrototypeOf;
  const objGetOwnPropertyNames = Object.getOwnPropertyNames;
  const objFreeze = Object.freeze;
  const objCreate = Object.create;
  const objSetPrototypeOf = Object.setPrototypeOf;
  const arrayIsArray = Array.isArray;
  const arrayBufferIsView = ArrayBuffer.isView;
  const mathImul = Math.imul;
  const mathFloor = Math.floor;
  const mathRound = Math.round;
  const mathAbs = Math.abs;
  const mathMax = Math.max;
  const mathMin = Math.min;

  // Prototype methods, uncurried. Receiver first.
  const fnHasInstance = uncurry(Function.prototype[Symbol.hasInstance]);
  const strCharCodeAt = uncurry(String.prototype.charCodeAt);
  const strToLowerCase = uncurry(String.prototype.toLowerCase);
  const strIndexOf = uncurry(String.prototype.indexOf);
  const strSlice = uncurry(String.prototype.slice);
  const strTrim = uncurry(String.prototype.trim);
  const strSplit = uncurry(String.prototype.split);   // boot-time tables only
  const numToString = uncurry(Number.prototype.toString);
  const arrayJoin = uncurry(Array.prototype.join);
  const arrayValues = uncurry(Array.prototype.values);
  const reExec = uncurry(RegExp.prototype.exec);
  const setHas = uncurry(Set.prototype.has);
  const setAdd = uncurry(Set.prototype.add);
  const setSizeGet = uncurry(getterOf(Set.prototype, 'size'));
  const mapGet = uncurry(Map.prototype.get);
  const mapSet = uncurry(Map.prototype.set);
  const mapHas = uncurry(Map.prototype.has);
  const mapClear = uncurry(Map.prototype.clear);
  const mapSizeGet = uncurry(getterOf(Map.prototype, 'size'));
  const wmGet = uncurry(WeakMap.prototype.get);
  const wmSet = uncurry(WeakMap.prototype.set);
  const wmHas = uncurry(WeakMap.prototype.has);
  const wsHas = uncurry(WeakSet.prototype.has);
  const wsAdd = uncurry(WeakSet.prototype.add);
  const promiseThen = uncurry(Promise.prototype.then);
  // Review B9: every handshake field is read as an OWN property through this, so a
  // page that owns `Object.prototype` cannot supply a field the loader omitted.
  const objHasOwn = uncurry(Object.prototype.hasOwnProperty);
  // `%TypedArray%.prototype.length` / `byteLength` — the review's A2e hook. The
  // getters are generic over every typed array, in any realm.
  const TypedArrayProto = objGetPrototypeOf(Uint8Array.prototype);
  const taLength = uncurry(getterOf(TypedArrayProto, 'length'));
  const taByteLength = uncurry(getterOf(TypedArrayProto, 'byteLength'));
  const taBuffer = uncurry(getterOf(TypedArrayProto, 'buffer'));
  const taByteOffset = uncurry(getterOf(TypedArrayProto, 'byteOffset'));
  const taJoin = uncurry(TypedArrayProto.join);
  // D42 — the ENGINE's own spelling of a native function's source. `markNative`
  // used to write Chrome's form on every engine; Firefox prints a different one
  // (no `get `/`set ` prefix, and an indented body), so every masked function was
  // one string compare from any native the shim leaves alone. The source is now
  // copied from a real native instead of assumed, which needs the engine's
  // `Function.prototype.toString` captured before we replace it, plus one
  // pristine native per KIND as a template for the cases where the function
  // being replaced is not itself native (test rigs; another extension first).
  const rawFuncToString = uncurry(Function.prototype.toString);
  const NATIVE_MODEL_METHOD = Object.prototype.hasOwnProperty;
  const NATIVE_MODEL_ACCESSOR = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__');
  // ─── END CAPTURED BUILTINS ────────────────────────────────────────────────

  // ── small helpers built only from the captures above ──────────────────────

  /** `re.test(s)` without `RegExp.prototype.test` → `exec` lookup on the way. Non-global regexes only. */
  const reTest = (re, s) => reExec(re, s) !== null;

  /**
   * Append to one of OUR arrays without `Array.prototype.push`, which goes
   * through [[Set]] and would invoke a setter a page had defined for that index
   * on `Array.prototype`. `DefineOwnProperty` consults nothing.
   */
  function pushOwn(arr, value) {
    objDefineProperty(arr, arr.length, { value, writable: true, enumerable: true, configurable: true });
    return arr;
  }

  /** A Set built without the constructor's iterable path (which calls `add` through the prototype). */
  function setOf(list) {
    const s = new RawSet();
    for (let i = 0; i < list.length; i++) setAdd(s, list[i]);
    return s;
  }

  /** `list.indexOf(x) >= 0` for our own arrays, without `Array.prototype.indexOf`. */
  function listHas(list, x) {
    for (let i = 0; i < list.length; i++) if (list[i] === x) return true;
    return false;
  }

  /** `String(x)`, then `toLowerCase`, both captured. */
  const lower = (x) => strToLowerCase(RawString(x));

  /**
   * Review B9. Read a field the way the handshake must read every field: OWN
   * property or nothing. `payload.dev` walked the prototype chain, so a page that
   * ran `Object.prototype.dev = true` before the worker answered was handed the
   * dev surface by the GENUINE, nonce-authenticated delivery — the loader never
   * sends `dev`, and an absent own property is precisely when the chain is
   * consulted. The same hole sat under every field the loader omits on some path.
   *
   * `objHasOwn` first, then an ordinary read: once the own property is known to
   * exist, `[[Get]]` stops there and the chain is never consulted.
   */
  const ownField = (obj, key) => (obj !== null && typeof obj === 'object' && objHasOwn(obj, key) ? obj[key] : undefined);

  /** One byte per element? Decided from captured getters; a DataView (no `length`) is simply "no". */
  function isByteView(view) {
    try { return taByteLength(view) === taLength(view); } catch (_) { return false; }
  }

  /**
   * Read a prototype accessor through a captured getter, or fall back to a plain
   * property read when the realm has no such accessor (test rigs define these as
   * own instance properties; every real browser has the accessor).
   */
  function propReader(Ctor, prop) {
    const g = getterOf(Ctor && Ctor.prototype, prop);
    return g ? (obj) => apply(g, obj, []) : (obj) => obj[prop];
  }
  function propWriter(Ctor, prop) {
    let s = null;
    try {
      const d = Ctor && Ctor.prototype && objGetOwnPropertyDescriptor(Ctor.prototype, prop);
      s = d && typeof d.set === 'function' ? d.set : null;
    } catch (_) { s = null; }
    return s ? (obj, v) => apply(s, obj, [v]) : (obj, v) => { obj[prop] = v; };
  }
  function methodOf(Ctor, prop) {
    try {
      const d = Ctor && Ctor.prototype && objGetOwnPropertyDescriptor(Ctor.prototype, prop);
      return d && typeof d.value === 'function' ? d.value : null;
    } catch (_) { return null; }
  }
  /** Invoke a captured method, or the live one when the realm exposes no prototype method (test rigs). */
  function methodCaller(Ctor, prop) {
    const m = methodOf(Ctor, prop);
    return m ? (obj, ...args) => apply(m, obj, args) : (obj, ...args) => apply(obj[prop], obj, args);
  }

  /**
   * The handshake nonce. 128 bits from the CSPRNG, minted before this script has
   * dispatched anything and therefore before any page script could observe it.
   *
   * `null` means we could not mint one — no `crypto.getRandomValues`. In that case
   * EVERY handshake is refused rather than accepted unauthenticated. The cost is a
   * page stuck on the fallback persona (still patched, still per-origin, just not
   * salt-rotated); the alternative would be a channel that looks authenticated and
   * is not. Falling back to `Math.random()` would be exactly that, which is why
   * there is no fallback.
   */
  const nonceBox = { value: mintNonce() };
  /**
   * Whether this realm could mint a nonce at all — decided HERE, at mint, and
   * never again read off `nonceBox`: the box is consumed (`= null`) by the one
   * genuine handshake, and `emit()` dispatches synchronously, so a loader that
   * replies inside the boot dispatch has already consumed it by the time any
   * line after `emit()` runs. A boot-time read of the box after `emit()` reported
   * "no CSPRNG" for a clean, authenticated handshake on every synchronous-reply
   * harness page (docs/PERFORMANCE-2026-09-17.md; the line is gone, D33). Any
   * "did we have a CSPRNG" question is answered by this constant.
   */
  const HAS_CSPRNG = nonceBox.value !== null;

  function mintNonce() {
    if (!RAW.getRandomValues) return null;
    try {
      const bytes = new RawUint8Array(NONCE_BYTES);
      RAW.getRandomValues(bytes);
      let out = '';
      for (let i = 0; i < NONCE_BYTES; i++) out += strSlice(numToString(bytes[i] + 0x100, 16), 1);
      return out.length === NONCE_BYTES * 2 ? out : null;
    } catch (_) { return null; }
  }

  /**
   * Length-independent, early-exit-free comparison. The page can dispatch as many
   * guesses as it likes (a wrong nonce deliberately does not consume the one-shot),
   * so it gets unlimited attempts at a timing oracle. 128 bits makes guessing
   * hopeless and this makes measuring pointless; neither costs anything.
   *
   * Compared through the CAPTURED `charCodeAt`. With the live one, a page that set
   * `String.prototype.charCodeAt = () => 0` made every 32-character string match
   * (review A2c) — and a matching nonce is the whole authentication.
   */
  function nonceMatches(candidate) {
    const expected = nonceBox.value;
    if (typeof expected !== 'string' || typeof candidate !== 'string') return false;
    if (candidate.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= strCharCodeAt(expected, i) ^ strCharCodeAt(candidate, i);
    return diff === 0;
  }

  /**
   * Public build-time pepper for the stage-1 fallback persona. Deliberately not a
   * secret: it ships in an open-source extension. Consequence (loader risk R2):
   * the fallback persona set is enumerable, so a site can infer "this visitor runs
   * Nullecho". That is detectability, not linkage — the fallback is still
   * per-origin, so cross-site joins stay broken.
   */
  const FALLBACK_PEPPER = 'nullecho-fallback-v1';

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Persona pool — MIRROR of src/personas.js. See gap G7.
  // ══════════════════════════════════════════════════════════════════════════

  // ─── BEGIN GENERATED MIRROR — do not hand-edit ────────────────────────────
  const FONT_SETS = {
    'windows-11': (
      'Arial|Arial Black|Bahnschrift|Calibri|Cambria|Candara|Comic Sans MS|Consolas|Constantia|Corbel|' +
      'Courier New|Ebrima|Franklin Gothic Medium|Gabriola|Gadugi|Georgia|Impact|Ink Free|Javanese Text|' +
      'Leelawadee UI|Lucida Console|Lucida Sans Unicode|Malgun Gothic|Marlett|Microsoft Himalaya|' +
      'Microsoft JhengHei|Microsoft New Tai Lue|Microsoft PhagsPa|Microsoft Sans Serif|Microsoft Tai Le|' +
      'Microsoft YaHei|Microsoft Yi Baiti|MingLiU-ExtB|Mongolian Baiti|MS Gothic|MV Boli|Myanmar Text|' +
      'Nirmala UI|Palatino Linotype|Segoe MDL2 Assets|Segoe Print|Segoe Script|Segoe UI|Segoe UI Emoji|' +
      'Segoe UI Historic|Segoe UI Symbol|SimSun|Sitka|Sylfaen|Symbol|Tahoma|Times New Roman|Trebuchet MS|' +
      'Verdana|Webdings|Wingdings|Yu Gothic').split('|'),
    'macos-14': (
      'American Typewriter|Andale Mono|Arial|Arial Black|Arial Narrow|Arial Rounded MT Bold|' +
      'Arial Unicode MS|Avenir|Avenir Next|Avenir Next Condensed|Baskerville|Big Caslon|Bodoni 72|' +
      'Bradley Hand|Brush Script MT|Chalkboard|Chalkduster|Charter|Cochin|Comic Sans MS|Copperplate|' +
      'Courier New|Didot|Futura|Geneva|Georgia|Gill Sans|Helvetica|Helvetica Neue|Herculanum|Hoefler Text|' +
      'Impact|Lucida Grande|Luminari|Marker Felt|Menlo|Monaco|Noteworthy|Optima|Palatino|Papyrus|Phosphate|' +
      'Rockwell|Savoye LET|SignPainter|Skia|Snell Roundhand|Tahoma|Times New Roman|Trattatello|' +
      'Trebuchet MS|Verdana|Zapfino').split('|'),
    'ubuntu-22': (
      'AR PL UKai CN|AR PL UKai HK|AR PL UKai TW|AR PL UKai TW MBE|AR PL UMing CN|AR PL UMing HK|' +
      'AR PL UMing TW|AR PL UMing TW MBE|Abyssinica SIL|Ani|AnjaliOldLipi|Bitstream Charter|C059|Chandas|' +
      'Chilanka|Courier 10 Pitch|D050000L|DejaVu Sans|DejaVu Sans Mono|DejaVu Serif|Dhurjati|' +
      'Droid Sans Fallback|Dyuthi|FreeMono|FreeSans|FreeSerif|Gargi|Garuda|Gayathri|Gayathri Thin|Gidugu|' +
      'Gubbi|Gurajada|Jamrul|KacstArt|KacstBook|KacstDecorative|KacstDigital|KacstFarsi|KacstLetter|' +
      'KacstNaskh|KacstOffice|KacstOne|KacstPen|KacstPoster|KacstQurn|KacstScreen|KacstTitle|KacstTitleL|' +
      'Kalapi|Kalimati|Karumbi|Keraleeyam|Khmer OS|Khmer OS System|Kinnari|LKLUG|LakkiReddy|Laksaman|' +
      'Liberation Mono|Liberation Sans|Liberation Sans Narrow|Liberation Serif|Likhan|Lohit Assamese|' +
      'Lohit Bengali|Lohit Devanagari|Lohit Gujarati|Lohit Gurmukhi|Lohit Kannada|Lohit Malayalam|' +
      'Lohit Odia|Lohit Tamil|Lohit Tamil Classical|Lohit Telugu|Loma|Mallanna|Mandali|Manjari|' +
      'Manjari Thin|Meera|Mitra|Mukti|NATS|NTR|Nakula|Navilu|Nimbus Mono PS|Nimbus Roman|Nimbus Sans|' +
      'Nimbus Sans Narrow|Norasi|Noto Color Emoji|Noto Mono|Noto Sans CJK HK|Noto Sans CJK JP|' +
      'Noto Sans CJK KR|Noto Sans CJK SC|Noto Sans CJK TC|Noto Sans Mono|Noto Sans Mono CJK HK|' +
      'Noto Sans Mono CJK JP|Noto Sans Mono CJK KR|Noto Sans Mono CJK SC|Noto Sans Mono CJK TC|' +
      'Noto Serif CJK HK|Noto Serif CJK JP|Noto Serif CJK KR|Noto Serif CJK SC|Noto Serif CJK TC|' +
      'OpenSymbol|P052|Padauk|Padauk Book|Pagul|Peddana|Phetsarath OT|Ponnala|Pothana2000|Potti Sreeramulu|' +
      'Purisa|Rachana|RaghuMalayalamSans|Ramabhadra|Ramaraja|Rasa|Rasa Light|Rasa Medium|Rasa SemiBold|' +
      'RaviPrakash|Rekha|Saab|Sahadeva|Samanata|Samyak Devanagari|Samyak Gujarati|Samyak Malayalam|' +
      'Samyak Tamil|Sarai|Sawasdee|Sree Krushnadevaraya|Standard Symbols PS|Suranna|Suravaram|Suruma|' +
      'Syamala Ramana|TenaliRamakrishna|Tibetan Machine Uni|Timmana|Tlwg Mono|Tlwg Typewriter|Tlwg Typist|' +
      'Tlwg Typo|URW Bookman|URW Gothic|Ubuntu|Ubuntu Condensed|Ubuntu Light|Ubuntu Mono|Ubuntu Thin|' +
      'Umpush|Uroob|Vemana2000|Waree|Yrsa|Yrsa Light|Yrsa Medium|Yrsa SemiBold|Z003|aakar|mry_KacstQurn|' +
      'ori1Uni|padmaa|padmaa-Bold.1.1|padmmaa|utkal|गार्गी|नालिमाटी|অনি|মুক্তি').split('|'),
  };

  const PERSONAS = [
    {
      id: "win11-chrome-uhd620", weight: 23, platform: "Win32", os: "windows-11",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Windows","platformVersion":"15.0.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Intel)",
        renderer: "ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00003EA0) Direct3D11 vs_5_0 ps_5_0, D3D11)",
        unmaskedVendor: "Google Inc. (Intel)", maxTextureSize: 16384,
      },
      cores: 8, memory: 8,
      screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
      fonts: "windows-11",
    },
    {
      id: "win11-chrome-iris-xe", weight: 31, platform: "Win32", os: "windows-11",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Windows","platformVersion":"15.0.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Intel)",
        renderer: "ANGLE (Intel, Intel(R) Iris(TM) Xe Graphics (0x00009A49) Direct3D11 vs_5_0 ps_5_0, D3D11)",
        unmaskedVendor: "Google Inc. (Intel)", maxTextureSize: 16384,
      },
      cores: 8, memory: 16,
      screen: { width: 1536, height: 864, availHeight: 816, colorDepth: 24, dpr: 1.25 },
      fonts: "windows-11",
    },
    {
      id: "win11-chrome-rtx3060", weight: 19, platform: "Win32", os: "windows-11",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Windows","platformVersion":"15.0.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (NVIDIA)",
        renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        unmaskedVendor: "Google Inc. (NVIDIA)", maxTextureSize: 16384,
      },
      cores: 12, memory: 16,
      screen: { width: 1920, height: 1080, availHeight: 1032, colorDepth: 24, dpr: 1 },
      fonts: "windows-11",
    },
    {
      id: "win11-chrome-rtx4060", weight: 16, platform: "Win32", os: "windows-11",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Windows","platformVersion":"15.0.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (NVIDIA)",
        renderer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)",
        unmaskedVendor: "Google Inc. (NVIDIA)", maxTextureSize: 16384,
      },
      cores: 16, memory: 32,
      screen: { width: 2560, height: 1440, availHeight: 1392, colorDepth: 24, dpr: 1 },
      fonts: "windows-11",
    },
    {
      id: "win11-chrome-amd-vega", weight: 11, platform: "Win32", os: "windows-11",
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Windows","platformVersion":"15.0.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (AMD)",
        renderer: "ANGLE (AMD, AMD Radeon(TM) Vega 8 Graphics (0x000015D8) Direct3D11 vs_5_0 ps_5_0, D3D11)",
        unmaskedVendor: "Google Inc. (AMD)", maxTextureSize: 16384,
      },
      cores: 8, memory: 8,
      screen: { width: 1366, height: 768, availHeight: 720, colorDepth: 24, dpr: 1 },
      fonts: "windows-11",
    },
    {
      id: "macos-chrome-m1", weight: 24, platform: "MacIntel", os: "macos-14",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"macOS","platformVersion":"14.6.0","architecture":"arm","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Apple)",
        renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)",
        unmaskedVendor: "Google Inc. (Apple)", maxTextureSize: 16384,
      },
      cores: 8, memory: 8,
      screen: { width: 1440, height: 900, availHeight: 875, colorDepth: 24, dpr: 2 },
      fonts: "macos-14",
    },
    {
      id: "macos-chrome-m2-air", weight: 26, platform: "MacIntel", os: "macos-14",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"macOS","platformVersion":"14.6.0","architecture":"arm","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Apple)",
        renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
        unmaskedVendor: "Google Inc. (Apple)", maxTextureSize: 16384,
      },
      cores: 8, memory: 16,
      screen: { width: 1470, height: 956, availHeight: 931, colorDepth: 24, dpr: 2 },
      fonts: "macos-14",
    },
    {
      id: "macos-chrome-mini-m2", weight: 16, platform: "MacIntel", os: "macos-14",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"macOS","platformVersion":"14.6.0","architecture":"arm","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Apple)",
        renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
        unmaskedVendor: "Google Inc. (Apple)", maxTextureSize: 16384,
      },
      cores: 8, memory: 8,
      screen: { width: 1920, height: 1080, availHeight: 1055, colorDepth: 24, dpr: 1 },
      fonts: "macos-14",
    },
    {
      id: "macos-chrome-m3-4k", weight: 20, platform: "MacIntel", os: "macos-14",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"macOS","platformVersion":"14.6.0","architecture":"arm","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Apple)",
        renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)",
        unmaskedVendor: "Google Inc. (Apple)", maxTextureSize: 16384,
      },
      cores: 8, memory: 16,
      screen: { width: 1920, height: 1080, availHeight: 1055, colorDepth: 24, dpr: 2 },
      fonts: "macos-14",
    },
    {
      id: "macos-chrome-m1-pro", weight: 14, platform: "MacIntel", os: "macos-14",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"macOS","platformVersion":"14.6.0","architecture":"arm","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Apple)",
        renderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)",
        unmaskedVendor: "Google Inc. (Apple)", maxTextureSize: 16384,
      },
      cores: 10, memory: 32,
      screen: { width: 2560, height: 1440, availHeight: 1415, colorDepth: 24, dpr: 1 },
      fonts: "macos-14",
    },
    {
      id: "linux-chrome-mesa", weight: 24, platform: "Linux x86_64", os: "ubuntu-22",
      ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Linux","platformVersion":"6.8.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Intel)",
        renderer: "ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)",
        unmaskedVendor: "Google Inc. (Intel)", maxTextureSize: 16384,
      },
      cores: 8, memory: 8,
      screen: { width: 1920, height: 1080, availHeight: 1053, colorDepth: 24, dpr: 1 },
      fonts: "ubuntu-22",
    },
    {
      id: "linux-chrome-mesa-xe", weight: 22, platform: "Linux x86_64", os: "ubuntu-22",
      ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Linux","platformVersion":"6.8.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Intel)",
        renderer: "ANGLE (Intel, Mesa Intel(R) Xe Graphics (TGL GT2), OpenGL 4.6)",
        unmaskedVendor: "Google Inc. (Intel)", maxTextureSize: 16384,
      },
      cores: 8, memory: 16,
      screen: { width: 1920, height: 1080, availHeight: 1053, colorDepth: 24, dpr: 1 },
      fonts: "ubuntu-22",
    },
    {
      id: "linux-chrome-amd-renoir", weight: 20, platform: "Linux x86_64", os: "ubuntu-22",
      ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Linux","platformVersion":"6.8.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (AMD)",
        renderer: "ANGLE (AMD, AMD Radeon Graphics (radeonsi, renoir, LLVM 15.0.7, DRM 3.49, 6.8.0-generic), OpenGL 4.6)",
        unmaskedVendor: "Google Inc. (AMD)", maxTextureSize: 16384,
      },
      cores: 8, memory: 8,
      screen: { width: 1366, height: 768, availHeight: 741, colorDepth: 24, dpr: 1 },
      fonts: "ubuntu-22",
    },
    {
      id: "linux-chrome-nvidia-rtx3060", weight: 20, platform: "Linux x86_64", os: "ubuntu-22",
      ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Linux","platformVersion":"6.8.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (NVIDIA Corporation)",
        renderer: "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3060/PCIe/SSE2, OpenGL 4.5.0 NVIDIA 550.120)",
        unmaskedVendor: "Google Inc. (NVIDIA Corporation)", maxTextureSize: 16384,
      },
      cores: 12, memory: 32,
      screen: { width: 2560, height: 1440, availHeight: 1413, colorDepth: 24, dpr: 1 },
      fonts: "ubuntu-22",
    },
    {
      id: "linux-chrome-mesa-uhd630", weight: 14, platform: "Linux x86_64", os: "ubuntu-22",
      ua: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"Linux","platformVersion":"6.8.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Intel)",
        renderer: "ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)",
        unmaskedVendor: "Google Inc. (Intel)", maxTextureSize: 16384,
      },
      cores: 6, memory: 16,
      screen: { width: 1600, height: 900, availHeight: 873, colorDepth: 24, dpr: 1 },
      fonts: "ubuntu-22",
    },
  ];
  // ─── END GENERATED MIRROR ─────────────────────────────────────────────────
  // (A run-time "delivered id is not in the mirror" check used to live here and
  // print to the page console; the mirror is pinned by `personas.test.js`
  // instead, and this file writes to no console the page can reach — D33.)

  /**
   * HOST OS FAMILY — DECISIONS.md D12. Mirrors `familyFromPlatformString()` and
   * `detectHostFamily()` in src/personas.js; the service worker runs the same
   * detection against its own (never-patched) navigator, so both stages of the
   * handshake draw from the same family.
   *
   * ⚠ ORDERING IS LOAD-BEARING. This is evaluated during module evaluation,
   * which is before `installInto()` patches anything. Read it any later and it
   * detects the PERSONA instead of the machine — the constraint silently
   * becomes a no-op and re-introduces the exact cross-OS contradiction it
   * exists to remove, with nothing failing anywhere.
   */
  const DEFAULT_FAMILY = 'win';

  function familyFromPlatformString(value) {
    if (!value) return null;
    const v = lower(value);
    if (strIndexOf(v, 'win') >= 0) return 'win';
    if (strIndexOf(v, 'mac') >= 0 || strIndexOf(v, 'darwin') >= 0) return 'mac';
    if (strIndexOf(v, 'cros') >= 0 || strIndexOf(v, 'chrome os') >= 0) return 'linux';
    if (strIndexOf(v, 'linux') >= 0 || strIndexOf(v, 'x11') >= 0 || strIndexOf(v, 'bsd') >= 0) return 'linux';
    return null;
  }

  const HOST_FAMILY = (() => {
    const nav = globalThis.navigator;
    let hit = null;
    // userAgentData first: never frozen, and it is what Chrome derives from the
    // OS. navigator.platform second (Firefox has no userAgentData at all). The
    // UA string last — its OS token is frozen, so it names the family and
    // nothing finer.
    try { if (nav && nav.userAgentData) hit = familyFromPlatformString(nav.userAgentData.platform); } catch (_) {}
    if (!hit) { try { hit = familyFromPlatformString(nav && nav.platform); } catch (_) {} }
    if (!hit) { try { hit = familyFromPlatformString(nav && nav.userAgent); } catch (_) {} }
    // An unmodelled host (iOS, Android, something exotic) lands in the largest
    // crowd rather than getting no persona at all — no persona means the real
    // machine on display, which is strictly worse.
    return hit || DEFAULT_FAMILY;
  })();

  /** The personas this host may be shown. Never empty. */
  const HOST_POOL = (() => {
    const of = (fam) => {
      const out = [];
      for (let i = 0; i < PERSONAS.length; i++) {
        if (familyFromPlatformString(PERSONAS[i].platform) === fam) pushOwn(out, PERSONAS[i]);
      }
      return out;
    };
    const list = of(HOST_FAMILY);
    return list.length ? list : of(DEFAULT_FAMILY);
  })();

  // FNV-1a / xorshift32 — byte-for-byte the same selection as src/personas.js, so
  // the fallback and the salted persona come from one pool with one algorithm.
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= strCharCodeAt(str, i); h = mathImul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function rngFrom(seed) {
    let s = seed || 1;
    return function next() {
      s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 0x100000000;
    };
  }
  function personaFor(salt, origin) {
    const seed = hashString(salt + '::' + origin);
    const rand = rngFrom(seed);
    // HOST_POOL, not PERSONAS: the stage-1 fallback must be the same OS as the
    // machine, or every page that fingerprints before the handshake lands gets
    // the cross-OS contradiction back.
    let total = 0;
    for (let i = 0; i < HOST_POOL.length; i++) total += HOST_POOL[i].weight;
    let roll = rand() * total;
    let chosen = HOST_POOL[HOST_POOL.length - 1];
    // Boot-only (runs before any page script), so the array iterator is safe here;
    // personas.test.js pins this exact loop as the D12 pool constraint.
    for (const p of HOST_POOL) { roll -= p.weight; if (roll <= 0) { chosen = p; break; } }
    const out = {};
    for (const k in chosen) out[k] = chosen[k];
    out.fontList = FONT_SETS[chosen.fonts];
    out.seed = seed;
    out.noise = { canvas: rand(), audio: rand(), webgl: rand() };
    return out;
  }

  /**
   * Registrable-domain key. A GENERATED mirror of src/suffixes.js (D23) — the
   * same table and the same function the service worker uses — so the fallback
   * persona and the salted persona are keyed identically; otherwise the "upgrade"
   * would be a *different machine*, not the same one re-salted. It drifted to 41
   * entries apart once (review A4d); the A4d guard now pins it value-for-value.
   *
   * ⚠ `registrableDomain` below is BOOT-ONLY and is kept byte-identical on
   * purpose: review-2026-09-16.test.js (A4c) lifts it out of this file by regex
   * and runs it in a bare context, so it must not reference the captured
   * builtins. The D21 lint exempts exactly this function.
   */
  // ─── BEGIN GENERATED SUFFIX MIRROR — do not hand-edit; node tools/gen-suffix-mirror.mjs ───
  const MULTI_LABEL_SUFFIXES = new Set((
    'ac.in|ac.jp|ac.nz|ac.uk|ad.jp|appspot.com|azureedge.net|azurewebsites.net|blogspot.com|' +
    'cloudfront.net|co.id|co.il|co.in|co.jp|co.kr|co.nz|co.th|co.uk|co.za|com.ar|com.au|com.bd|com.br|' +
    'com.cn|com.co|com.ec|com.eg|com.es|com.hk|com.mx|com.my|com.ng|com.pe|com.ph|com.pk|com.pl|com.ru|' +
    'com.sa|com.sg|com.tr|com.tw|com.ua|com.uy|com.ve|com.vn|edu.au|edu.cn|firebaseapp.com|firm.in|' +
    'fly.dev|gen.in|github.io|gitlab.io|glitch.me|go.jp|go.kr|gob.es|gob.mx|gov.au|gov.br|gov.cn|gov.in|' +
    'gov.uk|gov.za|govt.nz|herokuapp.com|id.au|ltd.uk|me.uk|myshopify.com|ne.jp|neocities.org|net.au|' +
    'net.br|net.cn|net.in|net.nz|net.uk|net.za|netlify.app|onrender.com|or.jp|or.kr|org.au|org.br|org.cn|' +
    'org.es|org.in|org.nz|org.uk|org.za|pages.dev|plc.uk|r2.dev|repl.co|s3.amazonaws.com|sch.uk|surge.sh|' +
    'translate.goog|tumblr.com|vercel.app|web.app|wordpress.com|workers.dev').split('|'));

  function registrableDomain(hostname) {
    if (!hostname) return '';
    const host = String(hostname).toLowerCase().replace(/\.$/, '');
    if (host.indexOf(':') >= 0 || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.indexOf('.') < 0) return host;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    const lastThree = parts.slice(-3).join('.');
    if (MULTI_LABEL_SUFFIXES.has(lastThree)) return parts.slice(-4).join('.');
    if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return lastThree;
    return lastTwo;
  }
  // ─── END GENERATED SUFFIX MIRROR ─────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════════════════
  // 1b. Global Privacy Control — the shipped breakage list (D46)
  // ══════════════════════════════════════════════════════════════════════════
  //
  // `navigator.globalPrivacyControl` is installed by THIS file, because the rule
  // is one `Function.prototype.toString` mask per realm and this file owns it
  // (DECISIONS.md D46; the regression it closes is in D42's closing paragraph).
  // `src/gpc.js` still carries the whole page half as a standalone fallback for
  // the realms this file never patched, and stands aside wherever the signal is
  // already up — see the comment above `ALREADY_SIGNALLED` there.
  //
  // ─── BEGIN GENERATED GPC BREAKAGE MIRROR ─────────────────────────────────
  //
  // Sites that BREAK when they see the JS property — EasyPrivacy's "! GPC"
  // section — mirrored from `ext/rules/gpc.json` rule 5000's
  // `excludedRequestDomains`, which is also what `manifest.json` turns into the
  // `src/gpc.js` content script's `exclude_matches`. That manifest exclusion is
  // what kept the property off these hosts while gpc.js owned it; this file has
  // no per-host injection of its own, so the list has to be readable here, at
  // document_start, before anything is installed. `ext/rules/validate.mjs` pins
  // `gpc.json` to the manifest and
  // `ext/src/gpc-one-mask-2026-09-20.test.js` pins this array to BOTH — a host
  // added to one list and not the others fails the build.
  //
  // Suffix-matched, because `*://*.usaa.com/*` matches every subdomain too.
  const GPC_PROP = 'globalPrivacyControl';
  const GPC_BREAKAGE_HOSTS = setOf(strSplit(
    'accuweather.com|acmemarkets.com|boston.com|capezio.com|chime.com|costco.com|' +
    'crunchyroll.com|deezer.com|delta.com|dnb.com|dnb.co.uk|dollargeneral.com|' +
    'engadget.com|espn.com|eventbrite.com|filson.com|flyfrontier.com|formula1.com|' +
    'geizhals.de|gladiatorgarageworks.com|harborfreight.com|hopwtr.com|jdsports.com|' +
    'kkrt.com|lenscrafters.com|livewithkellyandmark.com|madewell.com|mazdausa.com|' +
    'michaels.com|monsterenergy.com|newyorker.com|norton.com|pandora.com|porsche.com|' +
    'qobuz.com|rivals.com|soundcloud.com|spotify.com|subway.com|techcrunch.com|' +
    'tidal.com|tirerack.com|uber.com|ubereats.com|usaa.com|vimeo.com|visible.com|' +
    'weather.com|wunderground.com|yahoo.com', '|'));
  // ─── END GENERATED GPC BREAKAGE MIRROR ───────────────────────────────────

  /** `*://*.<host>/*` semantics: the host itself, or any subdomain of it. */
  function gpcSuppressedFor(hostname) {
    let h = lower(hostname || '');
    while (h) {
      if (setHas(GPC_BREAKAGE_HOSTS, h)) return true;
      const dot = strIndexOf(h, '.');
      if (dot < 0) return false;
      h = strSlice(h, dot + 1);
    }
    return false;
  }

  /**
   * One boot-time answer for this document. A same-origin child realm is by
   * definition the same host, and a cross-origin one is never installed into, so
   * the top document's location decides for every realm this file touches.
   * `location.hostname` is `''` in an `about:blank`/`srcdoc` child, whose
   * `location.origin` is the parent's — the same fallback `fallbackSiteKey()`
   * uses, and the same thing `match_origin_as_fallback` does for the manifest.
   */
  const GPC_SUPPRESSED = (() => {
    try {
      return gpcSuppressedFor(location.hostname) || gpcSuppressedFor(hostOfOrigin(location.origin));
    } catch (_) { return false; }
  })();

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Mutable state. Every patch reads through this, so a persona upgrade is a
  //    pointer swap rather than a second round of patching.
  // ══════════════════════════════════════════════════════════════════════════

  const state = {
    persona: null,
    derived: null,
    reads: 0,          // the upgrade gate
    perApi: objCreate(null),
    handshakeDone: false,
    upgraded: false,
    standingDown: false,
    /**
     * The Global Privacy Control signal this document reports (D46). ON is the
     * shipped default and is presented from document_start, because a page's own
     * script reads the property long before the service-worker round trip
     * resolves; the authenticated payload only ever walks it back. Read by the
     * one getter `installGpc` installs per realm, so a change is a state write
     * rather than a second `defineProperty` a page could watch.
     */
    gpc: true,
    /** Persona payloads rejected for a bad/absent nonce. Non-zero = a page tried. */
    forged: 0,
    forgeryReported: false,
    /** One-time tokens for the MAIN→ISOLATED reverse channel, from the authenticated payload (D30). */
    reportTokens: null,
    reportIndex: 0,
    dev: false,
    failures: [],
    /** How many of `failures` have ridden out on a status (D33), and how many statuses failures alone have triggered. */
    failuresReported: 0,
    failureStatuses: 0,
    /** The last health this file reported, restated when a run-time failure needs a status of its own (D33). */
    lastStatus: null,
    internal: 0,       // >0 while the shim measures for itself; suppresses counting
  };

  /** APIs worth telling the service worker about. UA reads would drown the signal. */
  const REPORTABLE = setOf(['canvas', 'webgl', 'webgpu', 'audio', 'fonts']);

  /**
   * Dispatch one MAIN→ISOLATED message.
   *
   * The payload is copied into a NULL-PROTOTYPE object before it is serialised.
   * `JSON.stringify` looks `toJSON` up the prototype chain, so a page that set
   * `Object.prototype.toJSON` would otherwise be handed every message we send —
   * including the boot nonce and (since D30) the reply tokens — as `this`, before
   * anything reaches the loader. Same class of bug as D29, one layer lower down.
   */
  function emit(name, obj) {
    try {
      const safe = objCreate(null);
      const keys = objGetOwnPropertyNames(obj);
      for (let i = 0; i < keys.length; i++) {
        objDefineProperty(safe, keys[i], { value: obj[keys[i]], enumerable: true, writable: true, configurable: true });
      }
      // Pristine ctor + dispatcher (section 0a): a page that replaced either one
      // could otherwise swallow our reports, and the boot report carries the nonce.
      apply(RAW.dispatchEvent, document, [new RAW.CustomEvent(name, { detail: RAW.jsonStringify(safe) })]);
    } catch (_) { /* a page that broke CustomEvent is not our problem to solve */ }
  }

  /**
   * A REPORT: a status or detect message the loader is meant to believe.
   *
   * Review C1 — this channel used to carry nothing an impostor could not produce,
   * so a page forged `nonce-exposed`, a healthy status over a real
   * `lockedToFallback`, and a million fingerprinting reads. Since D30 the loader
   * mints a list of ONE-TIME tokens and delivers it inside the persona payload the
   * boot nonce already authenticates; each report spends the next one.
   *
   * One-time, not one shared token, because these are DOM events on `document`:
   * a page can listen for them, so a single token would be public the moment the
   * first report went out and the page could then mint reports of its own. A token
   * a page can observe is a token the loader has already spent.
   *
   * `objDefineProperty`, not `obj.token = …`: a plain assignment for a property
   * the object does not own walks the prototype chain and would hand the token to
   * a setter the page installed on `Object.prototype`.
   *
   * Before the handshake there are no tokens. Those reports still go out — the
   * loader drops them, but this file's contract with the page and the harness is
   * to say things out loud — and are queued, bounded, to be re-sent with a token
   * once one exists, so a forgery attempt that happened before the genuine
   * delivery is not lost.
   */
  const REPORT_BACKLOG_MAX = 8;
  const REPORT_BACKLOG = [];
  /**
   * Tokens held back for STATUS reports only.
   *
   * Found by attacking this design: the token list is finite, and a page controls
   * how many DETECT reports the shim makes — `touch()` fires one at read 1, 10, 50
   * and then every 250 per API, so a few thousand `getImageData` calls would spend
   * the lot and the shim would go quiet. It could not then have told the loader
   * about a later stand-down or a locked fallback, which is the half of this
   * channel that has to be right. So the last few tokens are reserved for statuses;
   * a page can cost itself the read COUNTER (after the popup has already shown it
   * thousands of reads, which is the alarm anyway) and not the health report.
   */
  const STATUS_RESERVE = 4;

  function report(name, obj) {
    const tokens = state.reportTokens;
    const left = tokens ? tokens.length - state.reportIndex : 0;
    if (left > 0 && (name === EV_STATUS || left > STATUS_RESERVE)) {
      objDefineProperty(obj, 'token', {
        value: tokens[state.reportIndex++], writable: true, enumerable: true, configurable: true,
      });
      emit(name, obj);
      return;
    }
    if (!state.handshakeDone && REPORT_BACKLOG.length < REPORT_BACKLOG_MAX) {
      pushOwn(REPORT_BACKLOG, { name, obj });
    }
    emit(name, obj);
  }

  /** Re-send anything reported before the tokens arrived, now that they have. */
  function flushReportBacklog() {
    const backlog = REPORT_BACKLOG;
    for (let i = 0; i < backlog.length; i++) report(backlog[i].name, backlog[i].obj);
    backlog.length = 0;
  }

  /**
   * A status carrying nothing but run-time failures is sent at most this many
   * times per page. A page can make a noise path fail as often as it likes (a
   * scratch canvas that cannot get a context, say); it must not be able to make
   * this file spend the whole D30 token list — and the status reserve — on saying so.
   */
  const FAILURE_STATUS_MAX = 2;

  /**
   * Record that THE SHIM'S OWN code threw — a patch group that could not install,
   * or a noise path that broke at run time. That API is then unprotected on this
   * page, and a silently-unpatched API is the worst outcome this file has, so the
   * failure is reported: it rides the next status the shim sends as a `failures`
   * list of labels (install-time failures ride the upgrade status for free), or,
   * after the handshake, gets a status of its own restating the current health.
   * `shim-loader.js` prints it from the ISOLATED world and the service worker
   * records it (D33).
   *
   * NOT to the page's console, which is the one place this file used to write it.
   * A page-installed `console.error` hook read the product name straight back —
   * a nominative detector in three lines — and, worse, the message was usually
   * false: five wrappers ran shim work before delegating, so a wrong-receiver
   * call (`toDataURL.call({})`, CreepJS's probe) threw the ORIGINAL's `Illegal
   * invocation` into the wrapper's catch and was logged as "UNPROTECTED" about a
   * patch that was working (docs/CLAIM-VERIFICATION-2026-09-17.md §3d).
   *
   * THE RULE, therefore: the original speaks first. A wrapper delegates — or reads
   * a captured native accessor on the receiver — before, and outside, any `try`
   * whose catch reaches here, so the original's verdict on the receiver and the
   * arguments (`Illegal invocation`, "1 argument required", a tainted-canvas
   * SecurityError) reaches the caller exactly as it would unpatched, unlogged and
   * uncounted. Anything that still throws inside the try is ours.
   *
   * Labels only, never `err.stack`: this file is a MAIN-world content script, so a
   * stack names `chrome-extension://<id>/…`, and a status is a DOM event a page
   * can see before the handshake or past token exhaustion (D30 residual 5). The
   * stack stays on the dev surface, which production never installs.
   */
  function fail(label, err) {
    pushOwn(state.failures, { label, error: RawString((err && err.stack) || err) });
    const last = state.lastStatus;
    if (!state.handshakeDone || !last || state.failureStatuses >= FAILURE_STATUS_MAX) return;
    state.failureStatuses++;
    status({ upgraded: last.upgraded, lockedToFallback: last.lockedToFallback, reason: last.reason });
  }

  /** Run one patch group. A throw here must never stop the other groups. */
  function safe(label, fn) {
    try { fn(); return true; } catch (err) { fail(label, err); return false; }
  }

  /**
   * Count a shimmed read. Two jobs: gate the persona upgrade (loader contract),
   * and surface averaging-attack-shaped behaviour to the popup.
   */
  function touch(api) {
    if (state.internal > 0 || state.standingDown) return;
    state.reads++;
    const n = (state.perApi[api] = (state.perApi[api] || 0) + 1);
    if (!setHas(REPORTABLE, api)) return;
    // Bounded reporting: first read, then a coarsening schedule. 40 canvas reads in
    // one page is not a UI rendering; it is a repeated-sampling attack. We keep
    // returning the same value regardless — this only makes it visible to the user.
    if (n === 1 || n === 10 || n === 50 || n % 250 === 0) report(EV_DETECT, { api, count: n });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Primitives: native-source masking, descriptor-preserving patching, PRF
  // ══════════════════════════════════════════════════════════════════════════

  const RESTORES = [];
  const NATIVE_SRC = new RawWeakMap();

  /**
   * ── The spelling of `[native code]` is the ENGINE's, never ours (D42) ──────
   *
   * A native function's source string is not standardised beyond "an
   * implementation-defined NativeFunction". Measured 2026-09-19, same page, same
   * probe:
   *
   *   Chrome 147   `function get userAgent() { [native code] }`
   *   Firefox 156  `function userAgent() {\n    [native code]\n}`
   *
   * SpiderMonkey drops the `get `/`set ` prefix from the SOURCE (it keeps it in
   * `.name`) and indents the body. Writing Chrome's form on every engine — which
   * is what this file did — left every masked function one string compare from
   * any native the shim leaves alone: on Firefox `toDataURL` read single-line
   * while `getContext`, same interface, same kind, read multi-line.
   *
   * So don't spell it. COPY it:
   *
   *   1. from the function being replaced, when that function is itself native.
   *      Byte-identical by construction — it is literally what the page read a
   *      moment ago, name and all. This is the path every install site takes in
   *      a real browser, and it is also why an aliased native (WebIDL setlike
   *      `[Symbol.iterator]`, whose own name is `values`) now reports what the
   *      original reported instead of a name no engine prints.
   *   2. otherwise from a pristine native of the same KIND captured at boot,
   *      with the model's name swapped for ours. `get`/`set` fall out of the
   *      template: whichever prefix the engine puts there is carried along.
   *   3. and only if neither is usable — a rig with no natives at all — the
   *      Chrome form, which is what this file always wrote.
   *
   * This is `gpc.js`'s D38 calibration generalised from one getter to all 43
   * install sites. `rawFuncToString` is the engine's own, captured before
   * `patchFunctionToString` replaces it, so another extension's wrapper cannot
   * feed us a source and step 1's nativeness check cannot be spoofed by one.
   *
   * Requirement 1 is unchanged: `Function.prototype.toString` on a patched
   * function must report `[native code]`. Page scripts check this routinely — a
   * wrapper whose source is visible is a louder tell than the value it was
   * hiding. The mapping lives in a WeakMap, not a property, so it is not
   * enumerable, not reachable and not forgeable from the page — PROVIDED it is
   * consulted through the captured `WeakMap.prototype.get`. Through the live
   * one, a page hook received the map itself as `this` and could then `has()`
   * any function: an exact, enumerable oracle of everything we patched (C2).
   */

  /** `"get userAgent"` → `"userAgent"`. The engine decides whether to print it. */
  function bareName(name) {
    if (typeof name !== 'string') return '';
    const head = strSlice(name, 0, 4);
    return (head === 'get ' || head === 'set ') ? strSlice(name, 4) : name;
  }

  /** A function's OWN `name`, never one inherited from a page-owned prototype. */
  function ownNameOf(fn) {
    try {
      const d = objGetOwnPropertyDescriptor(fn, 'name');
      return d && typeof d.value === 'string' ? d.value : '';
    } catch (_) { return ''; }
  }

  /** What this engine prints for `fn`, below every masking layer. */
  function engineSourceOf(fn) {
    if (typeof fn !== 'function') return '';
    try {
      const s = rawFuncToString(fn);
      return typeof s === 'string' ? s : '';
    } catch (_) { return ''; }
  }

  const isNativeSource = (src) => src !== '' && strIndexOf(src, '[native code]') >= 0;

  /**
   * One template per kind — `{ src, name }` where `name` is the bare name that
   * appears in `src`. Built from intrinsics captured at boot, so a page cannot
   * substitute a model, and rebuilt for nothing afterwards.
   */
  function templateFrom(fn) {
    const src = engineSourceOf(fn);
    const n = bareName(ownNameOf(fn));
    if (!isNativeSource(src) || n === '' || strIndexOf(src, n + '(') < 0) return null;
    return { src, name: n };
  }

  const SRC_TEMPLATES = {
    method: templateFrom(NATIVE_MODEL_METHOD),
    'get ': templateFrom(NATIVE_MODEL_ACCESSOR && NATIVE_MODEL_ACCESSOR.get),
    'set ': templateFrom(NATIVE_MODEL_ACCESSOR && NATIVE_MODEL_ACCESSOR.set),
  };

  function sourceFromTemplate(tpl, name) {
    if (!tpl) return '';
    const at = strIndexOf(tpl.src, tpl.name + '(');
    if (at < 0) return '';
    return strSlice(tpl.src, 0, at) + bareName(name) + strSlice(tpl.src, at + tpl.name.length);
  }

  /** The exact string this engine would print for the function we are replacing. */
  function nativeSourceFor(name, model) {
    const fromModel = engineSourceOf(model);
    if (isNativeSource(fromModel)) return fromModel;
    const head = strSlice(typeof name === 'string' ? name : '', 0, 4);
    const kind = (head === 'get ' || head === 'set ') ? head : 'method';
    const fromTemplate = sourceFromTemplate(SRC_TEMPLATES[kind] || SRC_TEMPLATES.method, name);
    if (fromTemplate !== '') return fromTemplate;
    return 'function ' + name + '() { [native code] }';
  }

  function markNative(fn, name, model) {
    const src = nativeSourceFor(name, model);
    // A native model's OWN name wins: `length` was already taken from it, and a
    // replacement whose `name` and source disagree is a tell of its own. It only
    // ever differs for an aliased member — `GPUSupportedFeatures.prototype
    // [Symbol.iterator]` is named `values` in both engines, where this file used
    // to write `[Symbol.iterator]`.
    const modelName = isNativeSource(engineSourceOf(model)) ? ownNameOf(model) : '';
    const shown = modelName !== '' ? modelName : name;
    try {
      objDefineProperty(fn, 'name', { value: shown, writable: false, enumerable: false, configurable: true });
      if (model) {
        objDefineProperty(fn, 'length', { value: model.length, writable: false, enumerable: false, configurable: true });
      }
    } catch (_) { /* name/length are best-effort; the toString mapping is the load-bearing part */ }
    wmSet(NATIVE_SRC, fn, src);
    return fn;
  }

  /**
   * D32 — the SHAPE of an installed function. A native WebIDL method or accessor
   * has exactly two own properties, `length` and `name`, and is not a constructor:
   * `'prototype' in f` is false, and both `new f()` and `class X extends f {}`
   * throw. A plain `function () {}` has an own `prototype` and IS a constructor —
   * three one-line probes that CreepJS runs on every API it audits
   * (docs/CLAIM-VERIFICATION-2026-09-17.md §3b). A function defined by method or
   * getter shorthand has neither, so that is the only form this file installs.
   *
   * `shaped(name, fn)` wraps an ordinary implementation in such a method. The
   * receiver and the exact argument count pass through (rest parameters build a
   * fresh own-indexed array; nothing touches the iterator protocol, D21), and
   * `fn` itself is never reachable from the page. `name` may be a symbol.
   */
  function shaped(name, fn) {
    const holder = { [name](...args) { return apply(fn, this, args); } };
    return holder[name];
  }

  function patchFunctionToString(win) {
    const FP = win.Function.prototype;
    const d = objGetOwnPropertyDescriptor(FP, 'toString');
    if (!d || typeof d.value !== 'function') throw new RawError('Function.prototype.toString missing');
    if (wmHas(NATIVE_SRC, d.value)) return; // this realm is already done
    const orig = d.value;
    // Method shorthand, not `function toString() {}`. CreepJS's per-API
    // `failed toString` check inspects `apiFunction.toString` — THIS function —
    // so a plain-shaped replacement here flagged every API on the page at once,
    // patched or not, and `Navigator.webdriver` (never patched) reading as a lie
    // is what produced the bot verdict (D32, §3a).
    const holder = {
      toString() {
        const src = wmGet(NATIVE_SRC, this);
        if (src !== undefined) return src;
        return apply(orig, this, []);
      },
    };
    const replacement = objGetOwnPropertyDescriptor(holder, 'toString').value;
    markNative(replacement, 'toString', orig);
    pushOwn(RESTORES, { target: FP, prop: 'toString', desc: d });
    objDefineProperty(FP, 'toString', {
      value: replacement, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable,
    });
  }

  /** The prototype in `obj`'s chain that actually owns `prop`. */
  function ownerOf(obj, prop) {
    let o = obj;
    while (o) { if (objGetOwnPropertyDescriptor(o, prop)) return o; o = objGetPrototypeOf(o); }
    return null;
  }

  /**
   * Replace an accessor's getter, preserving `enumerable`, `configurable` and any
   * existing setter. `impl` receives the original getter so it can delegate.
   */
  function replaceGetter(target, prop, impl) {
    const d = objGetOwnPropertyDescriptor(target, prop);
    if (!d) throw new RawError('no own descriptor for "' + prop + '"');
    if (!d.get) throw new RawError('"' + prop + '" is not an accessor');
    if (!d.configurable) throw new RawError('"' + prop + '" is not configurable');
    const origGet = d.get;
    // Getter shorthand: no own `prototype`, not a constructor — a native
    // accessor's shape (D32). `this` stays dynamic; the delegate still runs the
    // brand check, so a wrong receiver still throws exactly where the original does.
    const holder = { get [prop]() { return apply(impl, this, [origGet]); } };
    const getter = objGetOwnPropertyDescriptor(holder, prop).get;
    markNative(getter, 'get ' + prop, origGet);
    pushOwn(RESTORES, { target, prop, desc: d });
    objDefineProperty(target, prop, {
      get: getter, set: d.set, enumerable: d.enumerable, configurable: d.configurable,
    });
    return origGet;
  }

  /**
   * The mirror of `replaceGetter` for a SETTER, preserving `enumerable`,
   * `configurable` and the existing getter. `impl(origSet, value)` receives the
   * original setter so it can delegate — which it must, because the delegation is
   * what reproduces the native brand check (`innerHTML` setter called on `{}`
   * throws `Illegal invocation`, and a naive replacement silently would not).
   *
   * Setter shorthand, not `function (v) {}`: no own `prototype`, not a
   * constructor — a native accessor's shape (D32). D35 is the first caller:
   * `Element.prototype.innerHTML` is one of the DOM's insertion entry points.
   */
  function replaceSetter(target, prop, impl) {
    const d = objGetOwnPropertyDescriptor(target, prop);
    if (!d) throw new RawError('no own descriptor for "' + prop + '"');
    if (!d.set) throw new RawError('"' + prop + '" has no setter');
    if (!d.configurable) throw new RawError('"' + prop + '" is not configurable');
    const origSet = d.set;
    const holder = { set [prop](v) { apply(impl, this, [origSet, v]); } };
    const setter = objGetOwnPropertyDescriptor(holder, prop).set;
    markNative(setter, 'set ' + prop, origSet);
    pushOwn(RESTORES, { target, prop, desc: d });
    objDefineProperty(target, prop, {
      get: d.get, set: setter, enumerable: d.enumerable, configurable: d.configurable,
    });
    return origSet;
  }

  /**
   * Accessor that always yields whatever `read()` returns now (persona-swap safe).
   *
   * The original getter is ALWAYS invoked first and its result discarded. That is
   * not waste — it reproduces the native brand check. A WebIDL accessor called with
   * the wrong receiver throws `TypeError: Illegal invocation`; a naive replacement
   * happily returns a value instead, and
   *
   *     Object.getOwnPropertyDescriptor(Navigator.prototype,'userAgent').get.call({})
   *
   * becomes a three-line, 100%-reliable detector for the whole shim. Delegating
   * first makes the replacement throw exactly where the original would.
   *
   * The delegation goes through the CAPTURED `Reflect.apply`. Written as
   * `origGet.call(this)` it went through the live `Function.prototype.call`, and a
   * page hook there received the NATIVE getter as `this` — the real userAgent,
   * cores, memory and GPU on a silver plate (review A2a/A2b).
   */
  function spoofGetter(target, prop, api, read) {
    return replaceGetter(target, prop, function (origGet) {
      const real = apply(origGet, this, []);      // brand check + real value
      if (state.standingDown) return real;
      touch(api);
      return apply(read, this, [origGet, real]);
    });
  }

  /** Replace a method, preserving `writable`/`enumerable`/`configurable`. */
  function replaceMethod(target, prop, factory) {
    const d = objGetOwnPropertyDescriptor(target, prop);
    if (!d || typeof d.value !== 'function') throw new RawError('no method "' + prop + '"');
    if (!d.configurable) throw new RawError('method "' + prop + '" is not configurable');
    const orig = d.value;
    const impl = shaped(prop, factory(orig));   // the factory's plain function is never installed (D32)
    markNative(impl, prop, orig);
    pushOwn(RESTORES, { target, prop, desc: d });
    objDefineProperty(target, prop, {
      value: impl, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable,
    });
    return orig;
  }

  function restoreAll() {
    for (let i = RESTORES.length - 1; i >= 0; i--) {
      const r = RESTORES[i];
      try {
        // `remove` is for a property the browser never had: GPC on Chrome, which
        // ships none, so "put it back" means DELETE rather than redefine (D46).
        // Stand-down has to leave the realm as the engine had it, and a `false`
        // where stock Chrome has nothing is still a Nullecho tell (D37).
        if (r.remove) delete r.target[r.prop];
        else objDefineProperty(r.target, r.prop, r.desc);
      } catch (_) {}
    }
    RESTORES.length = 0;
  }

  // ── Global Privacy Control, one realm at a time (D46) ──────────────────────
  //
  // Every realm this file patches gets the property, so a same-tick child realm
  // and its parent agree — the D31 rule. The realms are recorded because D37's
  // OFF branch hands a native accessor back where the browser has one.
  const GPC_REALMS = [];

  /**
   * Install `navigator.globalPrivacyControl` into `win`.
   *
   * D32 shape: a getter SHORTHAND, so the function has exactly `length` and
   * `name`, no own `prototype`, and is not a constructor — and its name is
   * `"get globalPrivacyControl"`, which is what every other accessor on
   * `Navigator.prototype` is called. D38/D43 source: `markNative` copies the
   * ENGINE's spelling — from the browser's own GPC getter where there is one
   * (Firefox), otherwise from the boot-time accessor template with our name
   * substituted, which is how Chrome gets
   * `function get globalPrivacyControl() { [native code] }` and Firefox gets its
   * own indented, prefix-less form.
   *
   * ⚠ HONEST LIMIT, unchanged by this move: on Chrome the property is still the
   * LAST own key of `Navigator.prototype`, because it is appended rather than
   * declared. Nothing an in-page script can do reorders an interface's own keys.
   * See D38.
   */
  function installGpc(win) {
    if (GPC_SUPPRESSED) return;                      // a shipped breakage host
    const NavCtor = win.Navigator;
    const P = NavCtor && NavCtor.prototype;
    if (!P) return;                                  // no Navigator in this realm
    const d = objGetOwnPropertyDescriptor(P, GPC_PROP);   // Firefox ships one
    if (d && !d.configurable) return;                // the engine locked it
    let nativeValue;
    if (d) {
      try { nativeValue = d.get ? apply(d.get, win.navigator, []) : d.value; }
      catch (_) { nativeValue = undefined; }
    }
    // Already `true`? A GPC-native browser with the preference on, or another
    // extension that got here first. Redefining is a no-op at best and a
    // detectable double-shim at worst (D37).
    if (nativeValue === true) return;

    const holder = { get globalPrivacyControl() { return state.gpc === true; } };
    const getter = objGetOwnPropertyDescriptor(holder, GPC_PROP).get;
    markNative(getter, 'get ' + GPC_PROP, d && d.get);
    pushOwn(RESTORES, d
      ? { target: P, prop: GPC_PROP, desc: d }
      : { target: P, prop: GPC_PROP, remove: true });
    objDefineProperty(P, GPC_PROP, {
      get: getter,
      set: d ? d.set : undefined,
      // WebIDL attributes are enumerable and configurable; `configurable` is
      // also what lets stand-down give the realm back (D38).
      enumerable: d ? d.enumerable : true,
      configurable: true,
    });
    pushOwn(GPC_REALMS, { target: P, nativeDesc: d || null, nativeValue, handedBack: false });
  }

  /**
   * The signal, from the authenticated payload. OFF reads `false` — never
   * deleted; `undefined` is not a conformant value and `delete` removed
   * Firefox's own property, which is review 2026-09-19 G2 / D37.
   *
   * Where the browser's own accessor ALREADY says `false`, hand it back: an
   * untouched native accessor is strictly better than an identical-looking
   * replacement (D37). That is the only descriptor swap after document_start,
   * it happens on Firefox only, and it is a swap from ours to the engine's.
   */
  function setGpcSignal(on) {
    state.gpc = on === true;
    if (state.gpc) return;
    for (let i = 0; i < GPC_REALMS.length; i++) {
      const r = GPC_REALMS[i];
      if (r.handedBack || !r.nativeDesc || r.nativeValue !== false) continue;
      try { objDefineProperty(r.target, GPC_PROP, r.nativeDesc); r.handedBack = true; } catch (_) {}
    }
  }

  // ── deterministic pseudo-random function ───────────────────────────────────
  // No state, no counter, no clock. prf(key, i) is the whole noise source.
  // Captured `Math.imul` throughout: with the live one, `Math.imul = () => 0`
  // collapsed every key to 0 and the noise became the same on every site (A2f).

  function fin32(x) {
    x = (x ^ (x >>> 16)) >>> 0;
    x = mathImul(x, 0x7feb352d) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    x = mathImul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }
  function prf(key, i) { return fin32((key ^ mathImul((i + 1) | 0, 0x9e3779b1)) >>> 0); }
  function keyFromUnit(u) {
    const k = mathFloor((typeof u === 'number' ? u : 0.5) * 4294967296) >>> 0;
    return k || 0x9e3779b9;
  }
  function keyMix(key, a, b) { return fin32((fin32((key ^ mathImul(a >>> 0, 0x85ebca6b)) >>> 0) ^ mathImul(b >>> 0, 0xc2b2ae35)) >>> 0); }
  function keyStr(key, s) {
    let h = key >>> 0;
    for (let i = 0; i < s.length; i++) h = mathImul(h ^ strCharCodeAt(s, i), 0x01000193) >>> 0;
    return fin32(h);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Derived persona values
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GREASE brand. Chrome emits a randomised "not a brand" entry whose exact form is
   * pinned to the *build*, not the user — so a single constant here is the correct
   * choice (everyone in the crowd looks the same).
   *
   * ⚠ MUST be re-pinned to whatever real Chrome N actually emits whenever the pool's
   * claimed Chrome version moves. A stale grease string is a version tell.
   */
  const GREASE = { brand: 'Not;A=Brand', version: '99' };

  /**
   * `uaData` in personas.js carries no brands/fullVersionList, and an *empty*
   * `navigator.userAgentData.brands` on a Chrome UA is itself a strong anomaly —
   * every real Chrome populates it. So we synthesise the list from the Chrome
   * version already present in the persona's UA string, which keeps Client Hints
   * agreeing with the UA field-by-field (the personas.js invariant).
   */
  const CHROME_VERSION_RE = /Chrome\/([\d.]+)/;
  function brandsFor(ua) {
    const m = reExec(CHROME_VERSION_RE, ua || '');
    const full = (m && m[1]) || '151.0.0.0';
    const dot = strIndexOf(full, '.');
    const major = dot < 0 ? full : strSlice(full, 0, dot);
    return {
      full,
      major,
      brands: [
        { brand: GREASE.brand, version: GREASE.version },
        { brand: 'Chromium', version: major },
        { brand: 'Google Chrome', version: major },
      ],
      fullVersionList: [
        { brand: GREASE.brand, version: GREASE.version + '.0.0.0' },
        { brand: 'Chromium', version: full },
        { brand: 'Google Chrome', version: full },
      ],
    };
  }

  // WebGL enum values, spelled out so we never need a live context to read them.
  const GL = {
    VENDOR: 0x1f00, RENDERER: 0x1f01, VERSION: 0x1f02, SHADING_LANGUAGE_VERSION: 0x8b8c,
    UNMASKED_VENDOR_WEBGL: 0x9245, UNMASKED_RENDERER_WEBGL: 0x9246,
    MAX_TEXTURE_SIZE: 0x0d33, MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
    MAX_RENDERBUFFER_SIZE: 0x84e8, MAX_VIEWPORT_DIMS: 0x0d3a,
    ALIASED_LINE_WIDTH_RANGE: 0x846e, RGBA: 0x1908,
  };

  /**
   * Chrome's *masked* VENDOR/RENDERER are the same constants on every machine, so
   * they are already crowd values and overwriting them would make us differ from
   * the crowd. We only substitute if the build leaks something GPU-specific there.
   */
  const UNIFORM_GL_VENDOR = setOf(['WebKit', 'Mozilla']);
  const UNIFORM_GL_RENDERER = setOf(['WebKit WebGL', 'Mozilla']);

  /**
   * WebGPU adapter identity per GPU family. `device`/`description` are empty on
   * stock Chrome (they need the WebGPU developer-features flag), so empty is the
   * crowd value.
   *
   * ⚠ APPROXIMATION: `architecture` and the subgroup sizes are what Chrome reports
   * for these families to the best of current knowledge; they have not been
   * verified against each physical GPU. Wrong values here are a cross-field tell,
   * so they need field validation before release, and they belong in personas.js
   * next to the WebGL strings rather than here.
   */
  const RE_APPLE = /Apple/i, RE_NVIDIA = /NVIDIA/i, RE_AMD = /AMD|Radeon/i, RE_INTEL = /Intel/i;
  const RE_D3D11 = /Direct3D11|D3D11/i, RE_MESA = /Mesa/i;
  function webgpuIdentity(gpu) {
    const r = (gpu && gpu.renderer) || '';
    if (reTest(RE_APPLE, r)) return { vendor: 'apple', architecture: 'metal-3', subgroupMinSize: 32, subgroupMaxSize: 32 };
    if (reTest(RE_NVIDIA, r)) return { vendor: 'nvidia', architecture: 'ampere', subgroupMinSize: 32, subgroupMaxSize: 32 };
    if (reTest(RE_AMD, r)) return { vendor: 'amd', architecture: 'gcn-5', subgroupMinSize: 32, subgroupMaxSize: 64 };
    if (reTest(RE_INTEL, r)) return { vendor: 'intel', architecture: 'gen-9', subgroupMinSize: 8, subgroupMaxSize: 32 };
    return { vendor: '', architecture: '', subgroupMinSize: 4, subgroupMaxSize: 128 };
  }

  /**
   * WebGL extensions the claimed GPU class cannot plausibly expose.
   *
   * A deny-list, not an allow-list: an allow-list would silently strip whatever a
   * future Chrome adds, while the entries we are actually confident about are
   * exactly the ones that contradict a persona. Conservative by design — only
   * families that are unambiguously wrong for the claimed hardware.
   *
   * ⚠ SHOULD MIGRATE into `personas.js` as a `gpu.extensionDeny` field so
   * `personas.test.js` can assert it against the claimed renderer string. It lives
   * in the shim today only to avoid two agents editing `personas.js` at once, which
   * means the pool validator cannot currently check it. Coordinate before moving.
   */
  const GL_DENY_D3D11 = [
    // Mobile / Apple-GPU texture compression. No desktop D3D11 driver exposes these.
    // Chrome 151 on the dev Mac advertises all four, which is how this was caught:
    // an RTX 3060 offering PVRTC is a contradiction one line of JS can see.
    'webgl_compressed_texture_astc', 'webgl_compressed_texture_etc',
    'webgl_compressed_texture_etc1', 'webgl_compressed_texture_pvrtc',
  ];
  const GL_DENY_MESA = [
    // Mesa on desktop Intel exposes ETC2, but not ASTC or PVRTC.
    'webgl_compressed_texture_astc', 'webgl_compressed_texture_pvrtc',
  ];
  // Built ONCE at boot. `derive()` runs at handshake time — after page scripts —
  // and `new Set(list)` goes through `Set.prototype.add`, which a page could have
  // made a no-op to empty the deny list and get the real extension list back.
  const GL_DENY_D3D11_SET = setOf(GL_DENY_D3D11);
  const GL_DENY_MESA_SET = setOf(GL_DENY_MESA);
  const GL_DENY_NONE = setOf([]);

  function glExtensionDenyFor(persona) {
    const r = (persona.gpu && persona.gpu.renderer) || '';
    if (reTest(RE_D3D11, r)) return GL_DENY_D3D11_SET;
    if (reTest(RE_MESA, r)) return GL_DENY_MESA_SET;
    // Apple/Metal genuinely exposes ASTC, ETC and S3TC — nothing to strip.
    return GL_DENY_NONE;
  }

  /** Features we allow through. We can only ever *remove*, never invent. */
  const WEBGPU_FEATURES_CORE = ['core-features-and-limits', 'depth-clip-control', 'depth32float-stencil8',
    'indirect-first-instance', 'rg11b10ufloat-renderable', 'shader-f16', 'float32-filterable',
    'bgra8unorm-storage', 'timestamp-query', 'texture-compression-bc'];
  const WEBGPU_FEATURES_APPLE = ['core-features-and-limits', 'depth-clip-control', 'depth32float-stencil8',
    'indirect-first-instance', 'rg11b10ufloat-renderable', 'shader-f16', 'float32-filterable',
    'bgra8unorm-storage', 'timestamp-query', 'texture-compression-bc',
    'texture-compression-etc2', 'texture-compression-astc'];
  const WEBGPU_FEATURES_CORE_SET = setOf(WEBGPU_FEATURES_CORE);
  const WEBGPU_FEATURES_APPLE_SET = setOf(WEBGPU_FEATURES_APPLE);

  /**
   * WebGPU spec default limits. Every conformant adapter supports at least these,
   * and `requestDevice()` with no explicit limits hands back exactly these — so an
   * app can always run on them. Reporting them is the maximum-crowd choice.
   * `min*` limits invert (smaller is better), so they clamp upward.
   */
  const WEBGPU_DEFAULT_LIMITS = {
    maxTextureDimension1D: 8192, maxTextureDimension2D: 8192, maxTextureDimension3D: 2048,
    maxTextureArrayLayers: 256, maxBindGroups: 4, maxBindGroupsPlusVertexBuffers: 24,
    maxBindingsPerBindGroup: 1000, maxDynamicUniformBuffersPerPipelineLayout: 8,
    maxDynamicStorageBuffersPerPipelineLayout: 4, maxSampledTexturesPerShaderStage: 16,
    maxSamplersPerShaderStage: 16, maxStorageBuffersPerShaderStage: 8,
    maxStorageTexturesPerShaderStage: 4, maxUniformBuffersPerShaderStage: 12,
    maxUniformBufferBindingSize: 65536, maxStorageBufferBindingSize: 134217728,
    minUniformBufferOffsetAlignment: 256, minStorageBufferOffsetAlignment: 256,
    maxVertexBuffers: 8, maxBufferSize: 268435456, maxVertexAttributes: 16,
    maxVertexBufferArrayStride: 2048, maxInterStageShaderComponents: 64,
    maxInterStageShaderVariables: 16, maxColorAttachments: 8,
    maxColorAttachmentBytesPerSample: 32, maxComputeWorkgroupStorageSize: 16384,
    maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256, maxComputeWorkgroupSizeZ: 64,
    maxComputeWorkgroupsPerDimension: 65535,
    maxStorageBuffersInFragmentStage: 8, maxStorageTexturesInFragmentStage: 4,
    maxStorageBuffersInVertexStage: 8, maxStorageTexturesInVertexStage: 4,
  };

  /**
   * System fonts we are willing to *remove* from a font stack. Restricting the shim
   * to a known universe is what keeps it away from web fonts: a page's `@font-face`
   * family is never called "Segoe UI", so it can never be stripped by accident.
   * Cost: a locally-installed font outside this list passes through (gap G3).
   */
  const FONT_UNIVERSE_EXTRA = strSplit('Bookman|Cantarell|Century Gothic|Courier|Helvetica Neue|Lucida Bright|Perpetua|' +
    'Roboto|SF Pro|SF Pro Display|SF Pro Text|Times|Apple Chancery|Apple Color Emoji|Apple SD Gothic Neo|' +
    'Segoe UI Variable|MS Sans Serif|MS Serif|Sitka Text|Yu Mincho|Meiryo|PingFang SC|Hiragino Sans', '|');

  const KNOWN_SYSTEM_FONTS = (() => {
    const s = new RawSet();
    const lists = [FONT_SETS['windows-11'], FONT_SETS['macos-14'], FONT_SETS['ubuntu-22'], FONT_UNIVERSE_EXTRA];
    for (let l = 0; l < lists.length; l++) for (let i = 0; i < lists[l].length; i++) setAdd(s, lists[l][i]);
    return s;
  })();

  const GENERIC_FAMILIES = setOf(strSplit('serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|' +
    'ui-monospace|ui-rounded|math|emoji|fangsong|-apple-system|BlinkMacSystemFont|inherit|initial|unset|revert|' +
    'revert-layer|default', '|'));

  function derive(persona) {
    const b = brandsFor(persona.ua);
    const scr = persona.screen || {};
    const noise = persona.noise || {};
    const gpu = persona.gpu || {};
    const ua = RawString(persona.ua || '');
    const fontList = persona.fontList || FONT_SETS[persona.fonts] || [];
    return {
      persona,
      ua: persona.ua,
      appVersion: strIndexOf(ua, 'Mozilla/') === 0 ? strSlice(ua, 8) : ua,
      platform: persona.platform,
      cores: persona.cores,
      memory: persona.memory,
      brands: b.brands,
      fullVersionList: b.fullVersionList,
      uaFullVersion: b.full,
      uaData: persona.uaData || {},
      // NOT APPLIED. The persona's screen block is carried here for the popup and
      // for tests, but the shim no longer reports it — CSS `@media` mirrors every
      // one of these values below the JS layer and cannot be intercepted, so
      // spoofing them produced a contradiction rather than a disguise. See the
      // DISPLAY LAYER section in installInto().
      screenUnapplied: {
        width: scr.width, height: scr.height,
        availHeight: scr.availHeight, colorDepth: scr.colorDepth, dpr: scr.dpr,
      },
      gpu,
      webgpu: webgpuIdentity(gpu),
      webgpuFeatures: reTest(RE_APPLE, gpu.renderer || '') ? WEBGPU_FEATURES_APPLE_SET : WEBGPU_FEATURES_CORE_SET,
      /** The same allow-list as an ARRAY, for the iterator-free features fallback (R2-2). */
      webgpuFeatureList: reTest(RE_APPLE, gpu.renderer || '') ? WEBGPU_FEATURES_APPLE : WEBGPU_FEATURES_CORE,
      glExtensionDeny: glExtensionDenyFor(persona),
      fontList,
      fontSet: setOf(fontList),
      canvasKey: keyFromUnit(noise.canvas),
      audioKey: keyFromUnit(noise.audio),
      webglKey: keyFromUnit(noise.webgl),
      fontKey: keyMix(keyFromUnit(noise.canvas), 0x464f4e54, persona.seed >>> 0),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. Noise kernels
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Sub-perceptual RGBA noise.
   *
   *  · Deterministic AND content-keyed (D22): the perturbation for a pixel depends
   *    on the persona's canvas key, the canvas dimensions, a digest of the WHOLE
   *    canvas's real pixels, and the pixel's ABSOLUTE coordinates. The digest is
   *    what closed review A1: with noise that was a function of coordinates alone,
   *    a page drew a uniform fill, read the pattern off it and subtracted that
   *    pattern from the real fingerprint canvas — exact recovery, join restored.
   *    Now a known input yields a pattern that says nothing about any other image.
   *    Same content still gives the same bytes on every read, so the averaging
   *    attack stays defeated.
   *  · The digest and the ink gate are computed over the whole canvas ONCE per
   *    read and the returned rectangle is sliced from that (review B5): a
   *    sub-rectangle read yields exactly the bytes of the same region inside a
   *    full read, whichever path a page takes. Callers gate; this kernel does not.
   *  · Bounded: ±1 or ±2 on R/G/B only, roughly 1 pixel in 8. Never alpha, never
   *    geometry, never a coordinate. Charts, games and captchas still render.
   *  · Non-degenerate: if a perturbation would clamp (0 or 255) the sign flips, so
   *    a selected pixel always actually changes. Noise that silently no-ops on
   *    black and white areas would leave large flat regions un-noised.
   *
   * BLANK-CANVAS REALISM. A canvas that has never been drawn on reads back as all
   * zeros in every real browser, and a fingerprinter can check that in two lines —
   * so noising an untouched canvas would be a louder tell than the value it hides.
   * We therefore skip a CANVAS that contains no ink at all (`scanRGBA` decides, on
   * the whole canvas). But once the canvas has ink we noise ALL of every read,
   * transparent margins included: an earlier version skipped transparent pixels
   * individually, and the harness's `canvasPixels` probe — which hashes only the
   * first 400 bytes, i.e. the blank rows above the text — came back byte-identical
   * to the unshimmed machine. Whole canvas, or nothing.
   *
   * NOTE: ARCHITECTURE.md phrases this as "±1-2 LSB on alpha". We perturb RGB and
   * leave alpha untouched instead — an alpha change alters compositing and can
   * accumulate across draws, whereas an RGB LSB change cannot. Alpha is also what
   * hit-testing code reads. Same entropy, less blast radius. Flagged so the doc and
   * the code can be reconciled deliberately.
   */
  /**
   * One pass over a byte buffer: is there any ink, and a 32-bit FNV-1a digest of
   * every byte in [`from`, `to`). Bound it to the CONTENT — a page may hand
   * `readPixels` a larger scratch buffer whose tail it scribbles on between reads,
   * and a digest that included the tail would change the noise on an unchanged
   * region (per-read noise: the averaging attack back). For RGBA pixels
   * (`alphaOnly`) ink means a non-zero
   * alpha; for a byte spectrum it means any non-zero bin. Written into `facts`
   * (one shared record, no per-read allocation). The length comes from the
   * captured `%TypedArray%.prototype.length` getter: the live one, hooked to
   * return 0 for one read, once made the ink scan see an empty buffer and hand
   * back the real pixels untouched (review A2e).
   */
  const facts = { ink: false, digest: 0 };
  function scanBytes(data, from, to, alphaOnly) {
    const len = taLength(data);
    const end = to < len ? to : len;
    let h = 0x811c9dc5, ink = false;
    for (let p = from; p < end; p++) {
      const v = data[p];
      h = mathImul(h ^ v, 0x01000193) >>> 0;
      if (v !== 0 && (!alphaOnly || (p & 3) === 3)) ink = true;
    }
    facts.ink = ink;
    facts.digest = fin32(h);
  }
  function scanRGBA(data) { scanBytes(data, 0, taLength(data), true); }

  /**
   * Same for a Float32Array, bit-exact through a Uint32 view over the same memory
   * (Float32 views are 4-byte aligned by construction, so the view always
   * succeeds). `facts.ink` here means "any sample whose bits differ from
   * `silentBits`" — 0 for samples, the bits of -Infinity for dB spectra.
   */
  function scanF32(arr, silentBits, count) {
    const n = count == null ? taLength(arr) : count;
    const u = new RawUint32Array(taBuffer(arr), taByteOffset(arr), n);
    let h = 0x811c9dc5, ink = false;
    for (let i = 0; i < n; i++) {
      const v = u[i];
      h = mathImul(h ^ (v & 0xffff), 0x01000193) >>> 0;
      h = mathImul(h ^ (v >>> 16), 0x01000193) >>> 0;
      if (v !== silentBits) ink = true;
    }
    facts.ink = ink;
    facts.digest = fin32(h);
  }
  const NEG_INF_BITS = 0xff800000;

  /** The per-read key: persona key × geometry × content digest (D22). */
  function contentKey(base, a, b, digest) { return keyMix(keyMix(base, a, b), digest, 0x5ecb1a7e); }

  function noiseRGBA(data, canvasW, key, ox, oy, w, h) {
    for (let row = 0; row < h; row++) {
      const ay = oy + row;
      const rowBase = row * w;
      const absRow = ay * canvasW;
      for (let col = 0; col < w; col++) {
        const abs = absRow + (ox + col);
        const hh = prf(key, abs);
        if ((hh & 7) !== 0) continue;                       // ~1 pixel in 8
        const p = (rowBase + col) * 4;
        for (let c = 0; c < 3; c++) {
          const bits = hh >>> (8 + c * 3);
          const mag = 1 + (bits & 1);                       // 1 or 2
          const sign = (bits & 2) ? 1 : -1;
          const v = data[p + c];
          let n = v + sign * mag;
          if (n < 0 || n > 255) n = v - sign * mag;
          if (n < 0) n = 0; else if (n > 255) n = 255;
          data[p + c] = n;
        }
      }
    }
  }

  /** Float audio noise: ≤8e-7 amplitude — below the 24-bit LSB, i.e. inaudible. Callers gate on silence and key on content (D22). */
  function noiseFloat(arr, key, count) {
    const n = count == null ? taLength(arr) : count;
    for (let i = 0; i < n; i++) {
      const hh = prf(key, i);
      if ((hh & 7) !== 0) continue;
      const mag = (1 + ((hh >>> 4) & 7)) * 1e-7;
      arr[i] += (hh >>> 3) & 1 ? mag : -mag;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. The patches
  // ══════════════════════════════════════════════════════════════════════════

  const INSTALLED = new RawWeakSet();

  /**
   * `navigator.userAgentData.brands` — review B7, DECISIONS.md D27 as REWRITTEN
   * against a measurement, and D31 for the realm.
   *
   * The review said Chrome caches this FrozenArray attribute and hands out the
   * same object on every read, and the first fix cached it on the derived persona.
   * Measured in real Chrome 151.0.0.0 on macOS with the shim off, that is wrong:
   *
   *     brands === brands            // FALSE — a new array per read
   *     Object.isFrozen(brands)      // true
   *     Object.isFrozen(brands[0])   // false, and `brand` is writable
   *     navigator.languages === navigator.languages   // true (so the engine CAN
   *                                                   //  cache; it just doesn't
   *                                                   //  cache this one)
   *
   * So: a fresh array per read, frozen, with ordinary entries. Caching it was the
   * detector. `toJSON()` and `getHighEntropyValues()` hand back an IDL DICTIONARY
   * whose `sequence<NavigatorUABrandVersion>` member is converted anew per call —
   * fresh and UNfrozen there, which the same measurement confirmed for
   * `fullVersionList`. The builders (`realmBrands`, `realmFreeze`) live inside
   * `installInto` because they have to belong to the realm being patched.
   */

  function installInto(win) {
    if (!win || wsHas(INSTALLED, win)) return;
    wsAdd(INSTALLED, win);

    const doc = win.document;
    const D = () => state.derived;

    // ── Per-realm natives, captured NOW (first touch of this realm, which for the
    //    main window is document_start and for a child realm is the first
    //    `contentWindow` read — before the page can have hooked anything in it).
    //    Constructors and statics a page could reassign on `win`, plus every DOM
    //    accessor / method the noise and font paths read at run time. The old
    //    code read `this.width`, `img.data`, `this.canvas`, `tmp.getContext()`
    //    through the live prototypes: a page that hooked `ImageData.prototype.data`
    //    fed the noise kernel a decoy buffer and kept the real one; a hook on
    //    `HTMLCanvasElement.prototype.width` returning 0 made `noisedCopy()` bail
    //    and `toDataURL` fall open to the native, un-noised call.
    const RealmTypeError = win.TypeError;
    // ── Per-realm Array / Object, for values we hand BACK to this realm.
    //
    // Review B3, and the realm residual D27 recorded: everything this file builds
    // is built in the shim's own closure, which for the top window is the page's
    // realm and for a child frame is its PARENT's. So `frames[0].navigator
    // .userAgentData.brands instanceof frames[0].Array` was `false` where Chrome
    // says `true` — a one-line "this child realm was patched from outside"
    // detector, the same shape as B3 itself. Captured here, at the first touch of
    // the realm, like the DOM natives below. (D31)
    // (Held through locals, never spelled `win.Object.freeze` — the D21 lint reads
    // this file as text and a bare `Object.` is exactly what it is there to catch.)
    const RealmArray = typeof win.Array === 'function' ? win.Array : Array;
    const realmObjectCtor = win.Object;
    const realmFreeze = (realmObjectCtor && typeof realmObjectCtor.freeze === 'function')
      ? realmObjectCtor.freeze : objFreeze;
    const realmObjProto = (realmObjectCtor && realmObjectCtor.prototype) || null;
    /** An object belonging to the realm being patched. */
    const realmObject = () => (realmObjProto ? objCreate(realmObjProto) : {});
    /** `obj[key] = value` by DEFINITION, so no setter on that realm's Object.prototype sees it. */
    const put = (obj, key, value) => {
      objDefineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
      return obj;
    };
    /** `copyBrands`, into this realm's Array and Objects. */
    const realmBrands = (list) => {
      const out = new RealmArray();
      for (let i = 0; i < list.length; i++) {
        const e = realmObject();
        put(e, 'brand', list[i].brand);
        put(e, 'version', list[i].version);
        pushOwn(out, e);
      }
      return out;
    };
    /** A copy of a native list into this realm's Array, keeping only what `keep` allows. */
    const realmList = (values, length, keep) => {
      const out = new RealmArray();
      for (let i = 0; i < length; i++) if (!keep || keep(values[i])) pushOwn(out, values[i]);
      return out;
    };
    const RealmInt32Array = win.Int32Array;
    const RealmFloat32Array = win.Float32Array;
    const RealmPromise = win.Promise;
    const realmPromiseResolve = RealmPromise && RealmPromise.resolve;
    const RealmDOMRect = win.DOMRect;
    const RealmHTMLElement = win.HTMLElement;
    const RealmMutationObserver = win.MutationObserver;
    const realmGetComputedStyle = win.getComputedStyle;

    const Ctx2D = win.CanvasRenderingContext2D;
    const OffCtx2D = win.OffscreenCanvasRenderingContext2D;
    const canvasWidth = propReader(win.HTMLCanvasElement, 'width');
    const canvasHeight = propReader(win.HTMLCanvasElement, 'height');
    const setCanvasWidth = propWriter(win.HTMLCanvasElement, 'width');
    const setCanvasHeight = propWriter(win.HTMLCanvasElement, 'height');
    const canvasGetContext = methodCaller(win.HTMLCanvasElement, 'getContext');
    const offWidth = propReader(win.OffscreenCanvas, 'width');
    const offHeight = propReader(win.OffscreenCanvas, 'height');
    const offGetContext = methodCaller(win.OffscreenCanvas, 'getContext');
    const ctxCanvas = propReader(Ctx2D, 'canvas');
    const ctxFont = propReader(Ctx2D, 'font');
    const setCtxFont = propWriter(Ctx2D, 'font');
    const offCtxFont = propReader(OffCtx2D, 'font');
    const setOffCtxFont = propWriter(OffCtx2D, 'font');
    // D34 — the host-font probe reads these, and only these. Captured here, before
    // any patch is installed, so the probe can never re-enter our own wrapper and
    // can never be handed a page-supplied `measureText` or `TextMetrics.width`.
    const origMeasureText = methodOf(Ctx2D, 'measureText');
    const tmWidth = propReader(win.TextMetrics, 'width');
    const imgData = propReader(win.ImageData, 'data');
    const imgWidth = propReader(win.ImageData, 'width');
    const imgHeight = propReader(win.ImageData, 'height');
    const docCreateElement = (() => {
      const owner = doc && ownerOf(doc, 'createElement');
      const d = owner && objGetOwnPropertyDescriptor(owner, 'createElement');
      const fn = d && typeof d.value === 'function' ? d.value : null;
      return fn ? (tag) => apply(fn, doc, [tag]) : (tag) => doc.createElement(tag);
    })();
    const abLength = propReader(win.AudioBuffer, 'length');
    const anFftSize = propReader(win.AnalyserNode, 'fftSize');
    const rectWidth = propReader(win.DOMRectReadOnly, 'width');
    const rectHeight = propReader(win.DOMRectReadOnly, 'height');
    const rectX = propReader(win.DOMRectReadOnly, 'x');
    const rectY = propReader(win.DOMRectReadOnly, 'y');
    const elStyle = propReader(win.HTMLElement, 'style');
    const nodeType = propReader(win.Node, 'nodeType');
    const nodeTextContent = propReader(win.Node, 'textContent');
    const nodeIsConnected = propReader(win.Node, 'isConnected');
    const nodeParentElement = propReader(win.Node, 'parentElement');
    const elChildElementCount = propReader(win.Element, 'childElementCount');
    const elClientWidth = propReader(win.Element, 'clientWidth');
    const elTagName = propReader(win.Element, 'tagName');
    const elQuerySelectorAll = methodCaller(win.Element, 'querySelectorAll');
    const nodeListLength = propReader(win.NodeList, 'length');
    const recordAddedNodes = propReader(win.MutationRecord, 'addedNodes');
    const cssGetPropertyValue = methodCaller(win.CSSStyleDeclaration, 'getPropertyValue');
    const cssGetPropertyPriority = methodCaller(win.CSSStyleDeclaration, 'getPropertyPriority');
    const cssSetProperty = methodCaller(win.CSSStyleDeclaration, 'setProperty');
    const cssRemoveProperty = methodCaller(win.CSSStyleDeclaration, 'removeProperty');
    const csFontFamily = propReader(win.CSSStyleDeclaration, 'fontFamily');
    const csFontSize = propReader(win.CSSStyleDeclaration, 'fontSize');
    const csFontWeight = propReader(win.CSSStyleDeclaration, 'fontWeight');
    const csFontStyle = propReader(win.CSSStyleDeclaration, 'fontStyle');
    const csLetterSpacing = propReader(win.CSSStyleDeclaration, 'letterSpacing');
    const docFonts = propReader(win.Document, 'fonts');
    const ffsSize = propReader(win.FontFaceSet, 'size');
    const ffsForEach = methodCaller(win.FontFaceSet, 'forEach');
    const ffFamily = propReader(win.FontFace, 'family');

    // ── Function.prototype.toString FIRST: everything patched after it must
    //    already be maskable, and it is itself a patched function.
    safe('Function.prototype.toString', () => patchFunctionToString(win));

    // ────────────────────────────────────────────────────────────────────────
    // NAVIGATOR
    // ────────────────────────────────────────────────────────────────────────

    // GPC first among the navigator patches, and immediately after the toString
    // mask it depends on (D46). Not a `spoofGetter`: reading the signal is not a
    // fingerprinting read and must not `touch()` — GPC exists to be read.
    safe('navigator.globalPrivacyControl', () => installGpc(win));

    safe('navigator.userAgent', () => {
      const N = ownerOf(win.navigator, 'userAgent');
      spoofGetter(N, 'userAgent', 'navigator', () => D().ua);
    });
    safe('navigator.appVersion', () => {
      const N = ownerOf(win.navigator, 'appVersion');
      spoofGetter(N, 'appVersion', 'navigator', () => D().appVersion);
    });
    safe('navigator.platform', () => {
      const N = ownerOf(win.navigator, 'platform');
      spoofGetter(N, 'platform', 'navigator', () => D().platform);
    });
    safe('navigator.hardwareConcurrency', () => {
      const N = ownerOf(win.navigator, 'hardwareConcurrency');
      // Never below 4: WASM/worker pools size themselves off this and 1 breaks them
      // (ARCHITECTURE.md, compatibility posture). The pool never goes below 8 anyway.
      spoofGetter(N, 'hardwareConcurrency', 'navigator', () => mathMax(4, D().cores | 0));
    });
    safe('navigator.deviceMemory', () => {
      const N = ownerOf(win.navigator, 'deviceMemory');
      if (!N) return; // absent in Firefox — not a failure
      // No ceiling assumed. BASELINE.md records Chrome 151 returning the true 32,
      // contradicting the documented clamp of 8; we simply present the persona's value.
      spoofGetter(N, 'deviceMemory', 'navigator', () => D().memory);
    });
    safe('navigator.vendor', () => {
      const N = ownerOf(win.navigator, 'vendor');
      // Every persona is a Chrome build; 'Google Inc.' is the crowd value.
      spoofGetter(N, 'vendor', 'navigator', () => 'Google Inc.');
    });
    // ────────────────────────────────────────────────────────────────────────
    // TOUCH — DELIBERATELY NOT SPOOFED  (reverted 2026-09-16, review B8, D26)
    //
    // `navigator.maxTouchPoints` was pinned to 0 "because the pool is entirely
    // desktop machines". Touch-screen desktops are not a rare configuration, and
    // on one of them everything AROUND the pin stayed true and said the opposite:
    // `'ontouchstart' in window`, `typeof TouchEvent`, `navigator.msMaxTouchPoints`
    // and `matchMedia('(any-pointer: coarse)')` — the last of which is a CSS media
    // feature, i.e. below JS and unreachable from a content script, exactly like
    // the DISPLAY LAYER below.
    //
    // Making that consistent would mean deleting `ontouchstart`, the `TouchEvent`
    // / `Touch` / `TouchList` constructors and every `ontouch*` handler slot from
    // the window — visible, breaking, and still leaving the media query. It is one
    // bit and it is not a persona field. D11: leave it truthful.
    // ────────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────
    // LOCALE — DELIBERATELY NOT SPOOFED  (reverted 2026-09-16, review B1, D25)
    //
    // `navigator.language` and `navigator.languages` were pinned to `en-US` /
    // `['en-US','en']`. They are not any more, for the same measured reason the
    // DISPLAY LAYER below is real: the locale is ONE browser preference and the
    // engine mirrors it in three places we cannot touch —
    //
    //   Intl.DateTimeFormat().resolvedOptions().locale   → the real locale
    //   (1234.5).toLocaleString() / toLocaleDateString() → real formatting
    //   the `Accept-Language` request header             → real, on every request
    //
    // In a clean Chrome those never disagree with `navigator.language`. Under the
    // pin, every non-en-US user was flagged by a two-line check — and a server
    // saw `de-DE` on the wire while the page's JS claimed `en-US`, which is the
    // D2 failure mode: identifying AND evasive. Spoofing `Intl` too, and
    // rewriting `Accept-Language` by DNR, is a project; the pin bought nothing in
    // return, because no persona carries a locale (personas.js has no such field,
    // so nothing in the pool goes unused by this removal). D11: prefer a
    // consistent leak to an inconsistent fake.
    // ────────────────────────────────────────────────────────────────────────

    // navigator.userAgentData — patch NavigatorUAData.prototype rather than
    // substituting a fake object, so the object keeps its real class and passes
    // `Object.prototype.toString.call()` / instanceof checks.
    safe('navigator.userAgentData', () => {
      const UAD = win.NavigatorUAData;
      if (!UAD || !UAD.prototype) return; // not a Chromium build
      const P = UAD.prototype;

      // A fresh frozen array per read — measured, D27. Built with THIS realm's
      // Array/Object/freeze (D31), so a child frame's `brands instanceof
      // frames[0].Array` is true, as it is in Chrome.
      spoofGetter(P, 'brands', 'navigator', () => realmFreeze(realmBrands(D().brands)));
      spoofGetter(P, 'mobile', 'navigator', () => false);
      spoofGetter(P, 'platform', 'navigator', () => D().uaData.platform || '');

      // `instanceof` stands in for the native brand check on these two: unlike an
      // accessor we cannot cheaply delegate (getHighEntropyValues does real async
      // work), but a replacement that answers for `{}` is a free shim detector.
      // Through the captured `Function.prototype[Symbol.hasInstance]`, so a page
      // cannot redefine the check.
      const brandCheck = (self) => {
        if (!fnHasInstance(UAD, self)) throw new RealmTypeError('Illegal invocation');
      };

      replaceMethod(P, 'toJSON', (orig) => function toJSON() {
        brandCheck(this);
        if (state.standingDown) return apply(orig, this, arguments);
        touch('navigator');
        const d = D();
        const out = realmObject();
        put(out, 'brands', realmBrands(d.brands));
        put(out, 'mobile', false);
        put(out, 'platform', d.uaData.platform || '');
        return out;
      });

      replaceMethod(P, 'getHighEntropyValues', (orig) => function getHighEntropyValues(hints) {
        brandCheck(this);
        if (state.standingDown) return apply(orig, this, arguments);
        touch('navigator');
        const d = D();
        // Chrome always includes the low-entropy trio, then whatever was asked for.
        // This realm's Array/Object throughout (D31), and every field DEFINED
        // rather than assigned, so no setter on that realm's `Object.prototype`
        // can intercept or swallow one.
        const out = realmObject();
        put(out, 'brands', realmBrands(d.brands));
        put(out, 'mobile', false);
        put(out, 'platform', d.uaData.platform || '');
        const want = setOf(arrayIsArray(hints) ? hints : []);
        if (setHas(want, 'architecture')) put(out, 'architecture', d.uaData.architecture || '');
        if (setHas(want, 'bitness')) put(out, 'bitness', d.uaData.bitness || '');
        if (setHas(want, 'model')) put(out, 'model', d.uaData.model || '');
        if (setHas(want, 'platformVersion')) put(out, 'platformVersion', d.uaData.platformVersion || '');
        if (setHas(want, 'uaFullVersion')) put(out, 'uaFullVersion', d.uaFullVersion);
        if (setHas(want, 'fullVersionList')) put(out, 'fullVersionList', realmBrands(d.fullVersionList));
        if (setHas(want, 'wow64')) put(out, 'wow64', !!d.uaData.wow64);
        if (setHas(want, 'formFactors')) put(out, 'formFactors', realmList(['Desktop'], 1, null));
        return apply(realmPromiseResolve, RealmPromise, [out]);
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // DISPLAY LAYER — DELIBERATELY NOT SPOOFED  (reverted 2026-08-20)
    //
    // `screen.width/height/availWidth/availHeight/colorDepth/pixelDepth`,
    // `window.devicePixelRatio` and the display-derived CSS media features were all
    // spoofed here. They are not any more. The reason is measured, not theoretical.
    //
    // CSS `@media` evaluation happens in the style engine, BELOW JavaScript, and it
    // mirrors every one of those values. Reading it back takes no cleverness:
    //
    //     <style>:root{--w:0} @media (min-device-width:1920px){:root{--w:1}}</style>
    //     getComputedStyle(document.documentElement).getPropertyValue('--w')
    //
    // A content script cannot intercept that. `document.styleSheets[i].cssRules`
    // THROWS for a cross-origin stylesheet, so a tracker serving its detection CSS
    // from its own domain is permanently out of reach; and rewriting the sheets we
    // can see would leave `CSSMediaRule.media.mediaText` visibly altered, which is
    // just a different detector.
    //
    // Measured on Chrome 151 with the spoof active: CSS disagreed with matchMedia on
    // 9 of 12 display features, including `device-width`, `device-height`,
    // `resolution`, `-webkit-device-pixel-ratio`, `dynamic-range`, `color-gamut`
    // and `color`. That is not one leaky feature; it is the entire display layer
    // visible through a window we cannot close.
    //
    // So BOTH halves had to go, not just the matchMedia half. Patching matchMedia
    // alone left CSS contradicting it. Reverting matchMedia alone would have left CSS
    // *and* matchMedia contradicting `screen.*` — strictly worse. The only
    // self-consistent options were "spoof all of it and accept a contradiction any
    // stylesheet can expose" or "spoof none of it". Per DECISIONS.md D2 a
    // contradiction is worse than a leak — it is identifying AND flags the user as
    // evasive — so we spoof none of it.
    //
    // COST, stated plainly: screen geometry, devicePixelRatio and colour depth are
    // strong, stable cross-site join keys and they now leak truthfully. On the
    // machine in research/BASELINE.md that is 1512×982 @2x with colorDepth 30 (HDR),
    // which that document calls a strong discriminator. This is the single largest
    // protection reduction in the shim and it is real. It also means the persona's
    // `screen` field is now unused by the shim: a Win32 persona will be reported
    // alongside the real panel. Unusual, but a machine that can exist — unlike the
    // contradiction it replaces.
    //
    // WHAT WOULD CHANGE IT: nothing reachable from a WebExtension. A browser-level
    // implementation (Firefox RFP, Brave) spoofs the style engine and the JS layer
    // together, which is precisely why those are stronger than any extension here.
    // See docs/ARKENFOX-RESPONSE.md, claim (a).
    // ────────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────────
    // CANVAS — all three read paths. Patching only toDataURL is trivially caught
    // by the harness's canvasPixels probe, which reads raw bytes instead.
    // ────────────────────────────────────────────────────────────────────────
    const origGetImageData = Ctx2D && Ctx2D.prototype.getImageData;
    const origPutImageData = Ctx2D && Ctx2D.prototype.putImageData;
    const origDrawImage = Ctx2D && Ctx2D.prototype.drawImage;
    // The Offscreen context has its OWN interface; `CanvasRenderingContext2D`'s
    // methods throw Illegal invocation on it. The previous convertToBlob used the
    // on-screen originals, threw, and fell open to the un-noised native call.
    const origOffGetImageData = OffCtx2D && OffCtx2D.prototype && OffCtx2D.prototype.getImageData;
    const origOffPutImageData = OffCtx2D && OffCtx2D.prototype && OffCtx2D.prototype.putImageData;
    const origOffDrawImage = OffCtx2D && OffCtx2D.prototype && OffCtx2D.prototype.drawImage;

    /** Key for one canvas read: call only after `scanRGBA` has run on the WHOLE canvas. */
    function canvasKeyFor(w, h) { return contentKey(D().canvasKey, w, h, facts.digest); }

    /**
     * Produce a same-size canvas holding the noised pixels of `src`. `drawImage`
     * between canvases is an exact premultiplied blit, so the copy itself is
     * lossless; only the putImageData round-trip can shift a semi-transparent
     * pixel by ±1, and that shift is deterministic too.
     * Returns null when noising is impossible (zero-size, or a tainted canvas —
     * in which case the original call will throw SecurityError exactly as native).
     *
     * Every DOM read here goes through a getter captured at install: `width`,
     * `height`, `getContext`, `createElement`, `ImageData.data`. A page hook on
     * any of them used to make this return null (→ the native, un-noised call) or
     * hand the kernel a decoy buffer.
     */
    function noisedCopy(src) {
      const w = canvasWidth(src) | 0, h = canvasHeight(src) | 0;
      if (!w || !h) return null;
      const tmp = docCreateElement('canvas');
      setCanvasWidth(tmp, w); setCanvasHeight(tmp, h);
      const tctx = canvasGetContext(tmp, '2d', { willReadFrequently: true });
      if (!tctx) return null;
      apply(origDrawImage, tctx, [src, 0, 0]);
      const img = apply(origGetImageData, tctx, [0, 0, w, h]);
      const data = imgData(img);
      scanRGBA(data);
      if (!facts.ink) return null;                       // blank canvas: native bytes are the honest answer
      noiseRGBA(data, w, canvasKeyFor(w, h), 0, 0, w, h);
      apply(origPutImageData, tctx, [img, 0, 0]);
      return tmp;
    }

    /**
     * `widthOf`/`heightOf` are the captured readers for the context's OWN canvas
     * type — an HTMLCanvasElement getter applied to an OffscreenCanvas throws.
     * The whole canvas is read (through the native original) whenever the request
     * is a sub-rectangle, so the ink gate and the content digest describe the
     * canvas, not the rectangle (B5). One extra native read per partial read.
     */
    function patchGetImageData(proto, label, widthOf, heightOf) {
      replaceMethod(proto, 'getImageData', (orig) => function getImageData(sx, sy) {
        const img = apply(orig, this, arguments);
        if (state.standingDown) return img;
        touch('canvas');
        try {
          const cv = ctxCanvas(this);
          const iw = imgWidth(img) | 0, ih = imgHeight(img) | 0;
          const cw = cv ? widthOf(cv) | 0 : iw;
          const ch = cv ? heightOf(cv) | 0 : ih;
          // sw/sh may be negative; the real origin is the top-left of the rect.
          const x = (sx | 0), y = (sy | 0);
          const sw = arguments.length > 2 ? (arguments[2] | 0) : iw;
          const sh = arguments.length > 3 ? (arguments[3] | 0) : ih;
          const ox = sw < 0 ? x + sw : x;
          const oy = sh < 0 ? y + sh : y;
          const whole = ox === 0 && oy === 0 && iw === cw && ih === ch;
          const data = imgData(img);
          scanRGBA(whole ? data : imgData(apply(orig, this, [0, 0, cw, ch])));
          if (!facts.ink) return img;
          noiseRGBA(data, cw, canvasKeyFor(cw, ch), ox, oy, iw, ih);
        } catch (err) { fail(label, err); }
        return img;
      });
    }

    safe('canvas.getImageData', () => patchGetImageData(Ctx2D.prototype, 'canvas.getImageData', canvasWidth, canvasHeight));
    safe('offscreenCanvas.getImageData', () => {
      if (!OffCtx2D || !OffCtx2D.prototype) return;
      patchGetImageData(OffCtx2D.prototype, 'offscreenCanvas.getImageData', offWidth, offHeight);
    });

    safe('canvas.toDataURL', () => {
      replaceMethod(win.HTMLCanvasElement.prototype, 'toDataURL', (orig) => function toDataURL() {
        if (state.standingDown) return apply(orig, this, arguments);
        // The native brand check FIRST, outside the try: a wrong receiver throws
        // `Illegal invocation` here, to the caller, as unpatched — it is not a
        // read, and it is not a patch failure (§3d). Delegating first would encode
        // the whole canvas twice, so the captured `width` getter stands in for it.
        canvasWidth(this);
        touch('canvas');
        let tmp = null;
        try { tmp = noisedCopy(this); }
        catch (err) { if (!err || err.name !== 'SecurityError') fail('canvas.toDataURL', err); }
        return apply(orig, tmp || this, arguments);
      });
    });

    safe('canvas.toBlob', () => {
      replaceMethod(win.HTMLCanvasElement.prototype, 'toBlob', (orig) => function toBlob() {
        if (state.standingDown) return apply(orig, this, arguments);
        canvasWidth(this);                              // brand check first — see toDataURL
        touch('canvas');
        let tmp = null;
        try { tmp = noisedCopy(this); }
        catch (err) { if (!err || err.name !== 'SecurityError') fail('canvas.toBlob', err); }
        return apply(orig, tmp || this, arguments);
      });
    });

    safe('offscreenCanvas.convertToBlob', () => {
      const OC = win.OffscreenCanvas;
      if (!OC || !OC.prototype || !OC.prototype.convertToBlob) return;
      replaceMethod(OC.prototype, 'convertToBlob', (orig) => function convertToBlob() {
        if (state.standingDown) return apply(orig, this, arguments);
        // Captured getters on the receiver, outside the try: the brand check
        // throws to the caller, not into `fail()` (§3d).
        const w = offWidth(this) | 0, h = offHeight(this) | 0;
        touch('canvas');
        let tmp = null;
        try {
          if (w && h && origOffGetImageData && origOffPutImageData && origOffDrawImage) {
            tmp = new OC(w, h);
            const tctx = offGetContext(tmp, '2d');
            if (tctx) {
              apply(origOffDrawImage, tctx, [this, 0, 0]);
              const img = apply(origOffGetImageData, tctx, [0, 0, w, h]);
              const data = imgData(img);
              scanRGBA(data);
              if (facts.ink) {
                noiseRGBA(data, w, canvasKeyFor(w, h), 0, 0, w, h);
                apply(origOffPutImageData, tctx, [img, 0, 0]);
              } else { tmp = null; }
            } else { tmp = null; }
          }
        } catch (err) { if (!err || err.name !== 'SecurityError') fail('offscreenCanvas.convertToBlob', err); tmp = null; }
        return apply(orig, tmp || this, arguments);
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // WEBGL
    //
    // The extension list is filtered to what the claimed GPU class can actually
    // expose. This started as gap G5 ("passed through") and was upgraded after the
    // adversarial suite caught it: an RTX 3060 on D3D11 was advertising
    // WEBGL_compressed_texture_astc / _etc / _etc1 / _pvrtc — mobile and Apple-GPU
    // texture formats that no desktop D3D11 driver exposes. One line of JS
    // contradicted the entire persona.
    //
    // REMOVAL ONLY. We never invent an extension, because we cannot back it with an
    // implementation; a page that asks for an invented extension would crash rather
    // than degrade. Removal is safe in the other direction — a page that wanted
    // ASTC falls back to S3TC or uncompressed, which is what it already does on the
    // hardware we are claiming to be.
    //
    // `getExtension()` is filtered with the SAME list. Filtering only the list would
    // just relocate the contradiction: `getSupportedExtensions()` omitting a name
    // that `getExtension()` still hands back is a two-line detector.
    // ────────────────────────────────────────────────────────────────────────
    function patchGLContext(Ctor, label, isGL2) {
      if (!Ctor || !Ctor.prototype) return;
      const P = Ctor.prototype;

      replaceMethod(P, 'getParameter', (orig) => function getParameter(pname) {
        // Always delegate first, even for parameters we fully replace: it performs
        // the native brand check, so `getParameter.call({}, 0x9245)` throws
        // Illegal invocation exactly as it would unpatched. Through the captured
        // `Reflect.apply` — a live `Function.prototype.apply` hook received the
        // native `getParameter` and read the real renderer with it (review A2b).
        const real = apply(orig, this, arguments);
        if (state.standingDown) return real;
        touch('webgl');
        const d = D();
        const gpu = d.gpu;
        switch (pname) {
          case GL.UNMASKED_VENDOR_WEBGL: return gpu.unmaskedVendor || gpu.vendor;
          case GL.UNMASKED_RENDERER_WEBGL: return gpu.renderer;
          case GL.VENDOR:
            return setHas(UNIFORM_GL_VENDOR, real) ? real : gpu.vendor;
          case GL.RENDERER:
            return setHas(UNIFORM_GL_RENDERER, real) ? real : gpu.renderer;
          case GL.VERSION:
            return isGL2 ? 'WebGL 2.0 (OpenGL ES 3.0 Chromium)' : 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
          case GL.SHADING_LANGUAGE_VERSION:
            return isGL2
              ? 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)'
              : 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
          case GL.MAX_TEXTURE_SIZE:
          case GL.MAX_CUBE_MAP_TEXTURE_SIZE:
          case GL.MAX_RENDERBUFFER_SIZE:
            return gpu.maxTextureSize || real;
          case GL.MAX_VIEWPORT_DIMS: {
            // Sized, then indexed: `new Int32Array([n, n])` would iterate the
            // literal through `Array.prototype[Symbol.iterator]`.
            const n = gpu.maxTextureSize || 16384;
            const dims = new RealmInt32Array(2); dims[0] = n; dims[1] = n;
            return dims;
          }
          case GL.ALIASED_LINE_WIDTH_RANGE: {
            const range = new RealmFloat32Array(2); range[0] = 1; range[1] = 1; // universal on ANGLE; every persona is ANGLE
            return range;
          }
          default:
            return real;
        }
      });

      replaceMethod(P, 'getSupportedExtensions', (orig) => function getSupportedExtensions() {
        const real = apply(orig, this, arguments);
        if (state.standingDown || !real) return real;
        touch('webgl');
        const deny = D().glExtensionDeny;
        if (!setSizeGet(deny)) return real;
        // Index loop + own-property writes, never `real.filter(...)`: `filter`
        // resolved through `Array.prototype` and its species lookup, and either
        // hook received the REAL extension list as `this`.
        // This realm's Array (D31): the filtered list is handed back to the realm
        // that asked, so `extensions instanceof frames[0].Array` stays true there.
        return realmList(real, real.length, (e) => !setHas(deny, lower(e)));
      });

      replaceMethod(P, 'getExtension', (orig) => function getExtension(name) {
        // Delegate first: brand check, and the real object for the allowed case.
        const real = apply(orig, this, arguments);
        if (state.standingDown) return real;
        touch('webgl');
        return setHas(D().glExtensionDeny, lower(name)) ? null : real;
      });

      replaceMethod(P, 'readPixels', (orig) => function readPixels(x, y, width, height, format) {
        const r = apply(orig, this, arguments);
        if (state.standingDown) return r;
        touch('webgl');
        try {
          const pixels = arguments[6];
          const dstOffset = arguments.length > 7 ? (arguments[7] | 0) : 0;
          // Only the 8-bit RGBA path — the one fingerprinters use. Float/half-float
          // reads are left alone rather than corrupted with a wrongly-scaled delta.
          // "8-bit" is decided from the captured `byteLength`/`length` getters, not
          // `BYTES_PER_ELEMENT` (a plain data property on the page's prototype).
          if (format === GL.RGBA && arrayBufferIsView(pixels) && isByteView(pixels)) {
            const w = width | 0, h = height | 0;
            const len = taLength(pixels);
            // Same blank-buffer rule as the canvas kernel: never invent content in
            // a read that came back entirely empty. Keyed on the read's content
            // (D22) — a known drawing teaches nothing about another one.
            scanBytes(pixels, dstOffset, dstOffset + w * h * 4, true);
            if (!facts.ink) return r;
            const key = contentKey(D().webglKey, w, h, facts.digest);
            for (let row = 0; row < h; row++) {
              for (let col = 0; col < w; col++) {
                const abs = (y + row) * 4096 + (x + col); // stable virtual coords
                const hh = prf(key, abs);
                if ((hh & 7) !== 0) continue;
                const p = dstOffset + (row * w + col) * 4;
                if (p + 3 >= len) continue;
                for (let c = 0; c < 3; c++) {
                  const bits = hh >>> (8 + c * 3);
                  const mag = 1 + (bits & 1);
                  const sign = (bits & 2) ? 1 : -1;
                  const v = pixels[p + c];
                  let n = v + sign * mag;
                  if (n < 0 || n > 255) n = v - sign * mag;
                  if (n < 0) n = 0; else if (n > 255) n = 255;
                  pixels[p + c] = n;
                }
              }
            }
          }
        } catch (err) { fail(label + '.readPixels', err); }
        return r;
      });
    }

    safe('WebGLRenderingContext', () => patchGLContext(win.WebGLRenderingContext, 'webgl', false));
    safe('WebGL2RenderingContext', () => patchGLContext(win.WebGL2RenderingContext, 'webgl2', true));

    // ────────────────────────────────────────────────────────────────────────
    // WEBGPU — per current research a bigger surface than WebGL (~25-35 bits),
    // most of it in `limits`, not `info`. Patching the prototypes covers every
    // adapter, including ones obtained before we were asked.
    // ────────────────────────────────────────────────────────────────────────
    safe('webgpu.adapterInfo', () => {
      const AI = win.GPUAdapterInfo;
      if (!AI || !AI.prototype) return; // no WebGPU on this build
      const P = AI.prototype;
      const pick = (k) => () => {
        const w = D().webgpu;
        return k in w ? w[k] : '';
      };
      // INDEX loops, never `for…of` — review R2-2. `for…of` reads `Symbol.iterator`
      // off the array, i.e. off this realm's `Array.prototype`, which is a prototype
      // call at run time (D21). `installInto` is document_start for the top window
      // but the first `contentWindow` read for a CHILD realm, so a page that had
      // replaced the array iterator by then made these three loops iterate NOTHING
      // and that child's GPUAdapterInfo was never patched — the real GPU vendor and
      // architecture, one `iframe.contentWindow` away. D21's lint had no `for…of`.
      const ID_KEYS = ['vendor', 'architecture'];
      for (let i = 0; i < ID_KEYS.length; i++) {
        const k = ID_KEYS[i];
        if (objGetOwnPropertyDescriptor(P, k)) spoofGetter(P, k, 'webgpu', pick(k));
      }
      // Empty on stock Chrome without the developer-features flag — that IS the crowd value.
      const BLANK_KEYS = ['device', 'description'];
      for (let i = 0; i < BLANK_KEYS.length; i++) {
        const k = BLANK_KEYS[i];
        if (objGetOwnPropertyDescriptor(P, k)) spoofGetter(P, k, 'webgpu', () => '');
      }
      const SUBGROUP_KEYS = ['subgroupMinSize', 'subgroupMaxSize'];
      for (let i = 0; i < SUBGROUP_KEYS.length; i++) {
        const k = SUBGROUP_KEYS[i];
        if (objGetOwnPropertyDescriptor(P, k)) spoofGetter(P, k, 'webgpu', pick(k));
      }
    });

    safe('webgpu.limits', () => {
      const SL = win.GPUSupportedLimits;
      if (!SL || !SL.prototype) return;
      const P = SL.prototype;
      const names = objGetOwnPropertyNames(P);
      for (let i = 0; i < names.length; i++) {
        const prop = names[i];
        if (prop === 'constructor') continue;
        const cap = WEBGPU_DEFAULT_LIMITS[prop];
        if (cap === undefined) continue; // unknown/new limit: pass through (documented gap)
        const isMin = strIndexOf(prop, 'min') === 0;
        const d = objGetOwnPropertyDescriptor(P, prop);
        if (!d || !d.get) continue;
        replaceGetter(P, prop, function (origGet) {
          const real = apply(origGet, this, []);
          if (state.standingDown || typeof real !== 'number') return real;
          touch('webgpu');
          return isMin ? mathMax(real, cap) : mathMin(real, cap);
        });
      }
    });

    safe('webgpu.features', () => {
      const SF = win.GPUSupportedFeatures;
      if (!SF || !SF.prototype) return;
      const P = SF.prototype;
      const origValues = P.values;
      const origForEach = methodOf(SF, 'forEach');   // captured BEFORE we patch it below
      const origHas = methodOf(SF, 'has');           // ditto — the iterator-free fallback
      const origSize = objGetOwnPropertyDescriptor(P, 'size');
      if (typeof origValues !== 'function' || !origSize || !origSize.get) return;

      const views = new RawWeakMap();
      function view(self) {
        let v = wmGet(views, self);
        if (!v) {
          v = [];
          const allow = D().webgpuFeatures;
          // We can only ever remove. Nothing is invented, so `requestDevice()`
          // validation (which runs against the REAL adapter) can never be surprised.
          // The native `forEach` walks the real set without going through the
          // (page-hookable) iterator protocol.
          const keep = (f) => { if (setHas(allow, f)) pushOwn(v, f); };
          if (origForEach) apply(origForEach, self, [keep]);
          else if (origHas) {
            // Fallback when this build has no `forEach`. The old one was
            // `for (const f of apply(origValues, self, []))`, which read
            // `Symbol.iterator` off a page-reachable prototype at run time — the
            // R2-2 hole, in the one place it could not leak (the filter still runs,
            // so a hostile iterator can only make the view SMALLER). Same
            // intersection, computed the other way round: ask the real set about
            // each allowed name. Deterministic, and no iterator protocol at all.
            const names = D().webgpuFeatureList;
            for (let i = 0; i < names.length; i++) {
              let real = false;
              try { real = !!apply(origHas, self, [names[i]]); } catch (_) { real = false; }
              if (real) keep(names[i]);
            }
          }
          wmSet(views, self, v);
        }
        return v;
      }

      replaceGetter(P, 'size', function (origGet) {
        if (state.standingDown) return apply(origGet, this, []);
        touch('webgpu');
        return view(this).length;
      });
      replaceMethod(P, 'has', (orig) => function has(f) {
        if (state.standingDown) return apply(orig, this, arguments);
        touch('webgpu');
        return listHas(view(this), RawString(f));
      });
      const iterNames = ['values', 'keys'];
      for (let i = 0; i < iterNames.length; i++) {
        const m = iterNames[i];
        if (!objGetOwnPropertyDescriptor(P, m)) continue;
        replaceMethod(P, m, (orig) => function () {
          if (state.standingDown) return apply(orig, this, arguments);
          touch('webgpu');
          return arrayValues(view(this));
        });
      }
      if (objGetOwnPropertyDescriptor(P, 'entries')) {
        replaceMethod(P, 'entries', (orig) => function entries() {
          if (state.standingDown) return apply(orig, this, arguments);
          touch('webgpu');
          const v = view(this);
          const pairs = [];
          for (let i = 0; i < v.length; i++) pushOwn(pairs, [v[i], v[i]]);
          return arrayValues(pairs);
        });
      }
      if (objGetOwnPropertyDescriptor(P, 'forEach')) {
        replaceMethod(P, 'forEach', (orig) => function forEach(cb, thisArg) {
          if (state.standingDown) return apply(orig, this, arguments);
          touch('webgpu');
          const v = view(this);
          for (let i = 0; i < v.length; i++) apply(cb, thisArg, [v[i], v[i], this]);
        });
      }
      if (objGetOwnPropertyDescriptor(P, symIterator)) {
        const d = objGetOwnPropertyDescriptor(P, symIterator);
        const origIter = d.value;
        const impl = shaped(symIterator, function () {
          if (state.standingDown) return apply(origIter, this, arguments);
          touch('webgpu');
          return arrayValues(view(this));
        });
        markNative(impl, '[Symbol.iterator]', origIter);
        pushOwn(RESTORES, { target: P, prop: symIterator, desc: d });
        objDefineProperty(P, symIterator, {
          value: impl, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable,
        });
      }
    });

    // Defensive belt for builds where the GPU* constructors are not exposed as
    // globals: fix up `adapter.info` on the instance we hand back.
    safe('webgpu.requestAdapter', () => {
      const gpu = win.navigator.gpu;
      if (!gpu) return;
      const GP = ownerOf(gpu, 'requestAdapter');
      if (!GP) return;
      replaceMethod(GP, 'requestAdapter', (orig) => function requestAdapter() {
        if (state.standingDown) return apply(orig, this, arguments);
        touch('webgpu');
        const p = apply(orig, this, arguments);
        if (!p || (typeof p !== 'object' && typeof p !== 'function')) return p;
        const fixup = (adapter) => {
          try {
            if (adapter && !win.GPUAdapterInfo) {
              const info = adapter.info;
              if (info) {
                const w = D().webgpu;
                const keys = ['vendor', 'architecture', 'device', 'description'];
                for (let i = 0; i < keys.length; i++) {
                  const k = keys[i];
                  const val = k === 'device' || k === 'description' ? '' : w[k];
                  objDefineProperty(info, k, { value: val, enumerable: true, configurable: true });
                }
              }
            }
          } catch (err) { fail('webgpu.requestAdapter.info', err); }
          return adapter;
        };
        try { return promiseThen(p, fixup); } catch (_) { return p; }
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // AUDIO
    //
    // `getChannelData()` returns the LIVE backing array — the same object every
    // call. Adding noise on every call would compound it and destroy determinism,
    // so we noise each (buffer, channel) exactly once and remember that we did.
    // In-place is also the right choice for correctness: pages legitimately write
    // through the returned array, which a defensive copy would silently break.
    // ────────────────────────────────────────────────────────────────────────
    const noisedChannels = new RawWeakMap();

    function ensureChannelNoised(buffer, channel, arr) {
      let seen = wmGet(noisedChannels, buffer);
      if (!seen) { seen = new RawSet(); wmSet(noisedChannels, buffer, seen); }
      if (setHas(seen, channel)) return;
      // Silence is never noised (B4): a never-written buffer reads all zeros in
      // every real browser. Not marked either — if the page fills it later, the
      // next read noises it then. Keyed on the samples' bits (D22).
      scanF32(arr, 0);
      if (!facts.ink) return;
      setAdd(seen, channel);
      noiseFloat(arr, contentKey(D().audioKey, channel, abLength(buffer) | 0, facts.digest));
    }

    safe('AudioBuffer.getChannelData', () => {
      const AB = win.AudioBuffer;
      if (!AB || !AB.prototype) return;
      // The NATIVE getChannelData, captured before the patch below replaces it.
      // copyFromChannel needs the live backing array to noise it in place; going
      // through the patched one would double-count the read.
      const nativeGetChannelData = AB.prototype.getChannelData;
      replaceMethod(AB.prototype, 'getChannelData', (orig) => function getChannelData(channel) {
        const arr = apply(orig, this, arguments);
        if (state.standingDown) return arr;
        touch('audio');
        try { ensureChannelNoised(this, channel | 0, arr); } catch (err) { fail('AudioBuffer.getChannelData', err); }
        return arr;
      });
      if (AB.prototype.copyFromChannel) {
        replaceMethod(AB.prototype, 'copyFromChannel', (orig) => function copyFromChannel(dest, channelNumber) {
          // Delegate FIRST: the native brand check and argument checks — a wrong
          // receiver, a `dest` that is not a Float32Array, a channel out of range —
          // throw here, to the caller, exactly as unpatched (§3d). This copy holds
          // the REAL samples and is overwritten below; no page code runs between.
          apply(orig, this, arguments);
          if (state.standingDown) return;
          touch('audio');
          try {
            state.internal++;
            try { ensureChannelNoised(this, channelNumber | 0, apply(nativeGetChannelData, this, [channelNumber])); }
            finally { state.internal--; }
          } catch (err) { fail('AudioBuffer.copyFromChannel', err); }
          // The channel is noised in place (once per channel); copy again so `dest`
          // carries the noised samples. A memcpy — the native call is the cheap part.
          return apply(orig, this, arguments);
        });
      }
    });

    safe('AnalyserNode frequency data', () => {
      const AN = win.AnalyserNode;
      if (!AN || !AN.prototype) return;

      replaceMethod(AN.prototype, 'getFloatFrequencyData', (orig) => function getFloatFrequencyData(array) {
        apply(orig, this, arguments);
        if (state.standingDown) return;
        touch('audio');
        try {
          // dB values, typically -100..0. ±1e-4 dB is far below anything audible or
          // visible in a spectrum display, and is stable per bin.
          const len = taLength(array);
          scanF32(array, NEG_INF_BITS);            // a silent spectrum is -Infinity in every bin
          if (!facts.ink) return;
          const key = contentKey(D().audioKey, anFftSize(this) | 0, len | 0, facts.digest);
          for (let i = 0; i < len; i++) {
            const hh = prf(key, i);
            if ((hh & 3) !== 0) continue;
            const mag = (1 + ((hh >>> 4) & 3)) * 1e-4;
            array[i] += (hh >>> 3) & 1 ? mag : -mag;
          }
        } catch (err) { fail('AnalyserNode.getFloatFrequencyData', err); }
      });

      replaceMethod(AN.prototype, 'getByteFrequencyData', (orig) => function getByteFrequencyData(array) {
        apply(orig, this, arguments);
        if (state.standingDown) return;
        touch('audio');
        try {
          const len = taLength(array);
          // Byte spectra clamp to 0 below minDecibels, so zero bins are the norm
          // in real output and a silent spectrum is all zeros (B4). Never touch a
          // zero bin; never touch a silent spectrum; key on the bins (D22).
          scanBytes(array, 0, len, false);
          if (!facts.ink) return;
          const key = contentKey(D().audioKey, anFftSize(this) | 0, len | 0, facts.digest);
          for (let i = 0; i < len; i++) {
            const hh = prf(key, i);
            if ((hh & 7) !== 0) continue;
            const v = array[i];
            if (v === 0) continue;
            let n = v + ((hh >>> 3) & 1 ? 1 : -1);
            if (n < 0 || n > 255) n = v - ((hh >>> 3) & 1 ? 1 : -1);
            if (n < 0) n = 0; else if (n > 255) n = 255;
            array[i] = n;
          }
        } catch (err) { fail('AnalyserNode.getByteFrequencyData', err); }
      });
    });

    // ────────────────────────────────────────────────────────────────────────
    // FONTS — the honest one
    //
    // We cannot install or uninstall fonts from JS, so this is measurement
    // substitution, and measurement substitution has a compatibility cost. The
    // design goal was "protect the detection path, leave the layout path alone":
    //
    //  1. RENDERING IS NEVER TOUCHED. We only change what JS *reports*. A page
    //     always paints with the fonts it really has, so nothing can visually break.
    //  2. We only ever consider families in a KNOWN SYSTEM FONT UNIVERSE. A web
    //     font from @font-face is never named "Segoe UI", so a webfont stack can
    //     never be mangled — this single rule removes the catastrophic failure mode.
    //  3. We only act on LEAF elements with short text (the shape of every font
    //     probe ever written). Containers, which is what real layout code measures,
    //     are passed through untouched.
    //  4. The baseline is measured on the element ITSELF (temporarily forcing the
    //     font stack, then restoring), so it is exact rather than a reconstruction.
    //  5. When a persona font IS genuinely installed locally, we return the REAL
    //     measurement — zero distortion. The synthetic delta only ever applies to a
    //     font the persona claims but the machine lacks, and it is bounded to
    //     ≤3% and ≤6px.
    //
    // Residual cost, stated plainly: a leaf element using a system-font stack can
    // have its reported offsetWidth off by a few pixels. JS that measures text to
    // decide truncation may truncate slightly early or late. That is the trade.
    // Gap G3: `getBoundingClientRect` IS now covered (see below) so the metric APIs
    // agree with each other. `Element.getClientRects()`, `Range.getClientRects()`
    // and SVG text metrics are NOT, and remain both a bypass and a detector.
    // ────────────────────────────────────────────────────────────────────────
    function isGeneric(n) { return setHas(GENERIC_FAMILIES, n) || setHas(GENERIC_FAMILIES, strToLowerCase(n)); }
    function stripChar(s, ch) {
      let out = '';
      for (let i = 0; i < s.length; i++) if (s[i] !== ch) out += s[i];
      return out;
    }
    function cssFamily(n) { return isGeneric(n) ? n : '"' + stripChar(n, '"') + '"'; }
    /** `list.map(cssFamily).join(',')` for our own lists, without Array.prototype. */
    function familiesCss(list, genericOnly) {
      const parts = [];
      for (let i = 0; i < list.length; i++) {
        if (genericOnly && !isGeneric(list[i])) continue;
        pushOwn(parts, cssFamily(list[i]));
      }
      return arrayJoin(parts, ',') || 'sans-serif';
    }

    function parseFamilyList(css) {
      const out = [];
      let cur = '', q = null;
      for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (q) { if (ch === q) q = null; else cur += ch; }
        else if (ch === '"' || ch === "'") q = ch;
        else if (ch === ',') { const t = strTrim(cur); if (t) pushOwn(out, t); cur = ''; }
        else cur += ch;
      }
      const t = strTrim(cur);
      if (t) pushOwn(out, t);
      return out;
    }

    // Web fonts registered through @font-face or the FontFace API. Recomputed only
    // when the set size changes, so this is cheap on steady-state pages.
    let webFontCache = null, webFontCount = -1;
    function unquote(s) {
      const first = s[0], last = s[s.length - 1];
      if (s.length >= 2 && (first === '"' || first === "'") && last === first) return strSlice(s, 1, -1);
      if (first === '"' || first === "'") return strSlice(s, 1);
      if (last === '"' || last === "'") return strSlice(s, 0, -1);
      return s;
    }
    function webFontFamilies() {
      try {
        const fs = docFonts(doc);
        if (!fs) return null;
        const size = ffsSize(fs);
        if (webFontCache && size === webFontCount) return webFontCache;
        const s = new RawSet();
        ffsForEach(fs, (ff) => {
          const fam = ff && ffFamily(ff);
          if (fam) setAdd(s, unquote(RawString(fam)));
        });
        webFontCache = s; webFontCount = size;
        return s;
      } catch (_) { return null; }
    }

    function planFamilies(families) {
      const wf = webFontFamilies();
      const kept = [];
      const droppedList = [];
      for (let i = 0; i < families.length; i++) {
        const f = families[i];
        if (isGeneric(f)) { pushOwn(kept, f); continue; }
        if (wf && setHas(wf, f)) { pushOwn(kept, f); continue; }       // page's own web font — untouchable
        if (!setHas(KNOWN_SYSTEM_FONTS, f)) { pushOwn(kept, f); continue; } // outside our universe — gap G3
        if (setHas(D().fontSet, f)) { pushOwn(kept, f); continue; }    // the persona has it
        pushOwn(droppedList, f);                                       // known system font the persona lacks
      }
      // Whichever family actually gets used is the first non-generic survivor.
      let claimed = null, claimedFirst = false;
      for (let i = 0; i < kept.length; i++) {
        const f = kept[i];
        if (isGeneric(f)) continue;
        if (setHas(D().fontSet, f) && !(wf && setHas(wf, f))) { claimed = f; claimedFirst = i === 0; }
        break;
      }
      return { kept, claimed, claimedFirst, dropped: droppedList.length > 0, droppedList };
    }

    // ────────────────────────────────────────────────────────────────────────
    // D34 — the layout early-out.
    //
    // `dropped` is true on essentially every real page, because the ordinary
    // stack `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …` names
    // "Segoe UI", which no macOS or Linux persona has. Before this, that made
    // every text-bearing leaf pay two forced re-layouts (+31 µs per offsetWidth,
    // +60 µs per getBoundingClientRect, 19 ms on a 300-row sweep —
    // docs/PERFORMANCE-2026-09-17.md §2).
    //
    // The rule: removing a family from a stack can only change what is painted
    // if the MACHINE actually has that family. If it does not, the browser's own
    // font matching already skipped it — at every codepoint, because a family
    // with no faces supplies no glyph — so the removal is a no-op and the real
    // measurement already IS the shimmed one. Symmetrically, a family the persona
    // CLAIMS needs no synthetic presence when the machine really has it: the
    // truth and the persona already agree.
    //
    // Rejected alternative: "is a family EARLIER in the list installed?" That one
    // is not exactly correct. CSS font matching is per GLYPH — an earlier family
    // that lacks a codepoint falls through to later families — so an earlier
    // resolving family does not prove the later one is unused. This rule needs no
    // such assumption.
    //
    // The probe is a canvas width comparison against three generics over several
    // scripts, run at most once per family name per realm and memoised. It uses
    // the natives captured at boot and never touches the DOM, so it forces no
    // layout and is invisible to a MutationObserver. Anything it cannot decide
    // (no canvas, a rejected font shorthand, a throw) reads as PRESENT, which
    // keeps the slow path and therefore the defense.
    // ────────────────────────────────────────────────────────────────────────
    const PROBE_GENERICS = ['monospace', 'sans-serif', 'serif'];
    // Latin, CJK, Cyrillic+Greek, Arabic, emoji. A family installed for one script
    // only — a CJK face, a symbol face — still shows up on one of these rows.
    const PROBE_TEXTS = [
      'mmmmmmmmmmlliWWW',
      '\u6f22\u5b57\u30ab\u30ca\uc9c0',   // CJK + kana + hangul
      '\u0410\u0431\u0432\u0413\u03b1\u03b2\u03b3', // Cyrillic + Greek
      '\u0645\u0631\u062d\u0628\u0627',   // Arabic
      '\ud83d\ude00\ud83c\udf0d',          // emoji
    ];
    const hostFontCache = new RawMap();
    let probeCtx = null, probeCtxTried = false;

    function probeContext() {
      if (probeCtxTried) return probeCtx;
      probeCtxTried = true;
      if (!origMeasureText) return null;
      try {
        const c = docCreateElement('canvas');
        setCanvasWidth(c, 8); setCanvasHeight(c, 8);
        probeCtx = canvasGetContext(c, '2d') || null;
      } catch (_) { probeCtx = null; }
      return probeCtx;
    }

    /** Is family `name` actually installed on THIS machine? Memoised, conservative. */
    function hostHasFamily(name) {
      if (mapHas(hostFontCache, name)) return mapGet(hostFontCache, name);
      let present = true;                       // undecidable ⇒ keep the slow path
      const cx = probeContext();
      if (cx) {
        state.internal++;
        try {
          present = false;
          const quoted = cssFamily(name);
          for (let g = 0; g < PROBE_GENERICS.length && !present; g++) {
            const baseFont = '72px ' + PROBE_GENERICS[g];
            const testFont = '72px ' + quoted + ',' + PROBE_GENERICS[g];
            setCtxFont(cx, baseFont);
            const baseEcho = ctxFont(cx);
            setCtxFont(cx, testFont);
            // A shorthand the engine refused leaves `font` untouched: undecidable.
            if (ctxFont(cx) === baseEcho) { present = true; break; }
            for (let t = 0; t < PROBE_TEXTS.length; t++) {
              setCtxFont(cx, baseFont);
              const a = tmWidth(apply(origMeasureText, cx, [PROBE_TEXTS[t]]));
              setCtxFont(cx, testFont);
              const b = tmWidth(apply(origMeasureText, cx, [PROBE_TEXTS[t]]));
              if (a !== b) { present = true; break; }
            }
          }
        } catch (_) { present = true; } finally { state.internal--; }
      }
      mapSet(hostFontCache, name, present);
      return present;
    }

    /**
     * Can this plan be answered with the REAL measurement, with no forced layout?
     *
     * Two independent questions, and BOTH must come back "nothing to do":
     *
     *  1. Every family we would remove is absent from the machine anyway, so the
     *     browser already skipped it — at every codepoint, because a family with
     *     no faces supplies no glyph.
     *
     *  2. The family the persona CLAIMS needs no synthetic presence. That takes
     *     two things, and the second one is not decoration:
     *       · the machine really has it — otherwise the persona's claim is the
     *         thing being forged and the measurement has to be built; and
     *       · a generic family is listed BEFORE it, so it is not what the page's
     *         text renders in and no probe can read its presence off this element.
     *     A probe puts the family under test FIRST (`"Segoe UI", monospace`), so
     *     `claimedFirst` keeps every probe on the old path, byte for byte. That
     *     matters for a family which is installed but has no glyph for the text
     *     being measured — macOS `Symbol` against Latin, say: the machine has it,
     *     the width still falls back to the generic, and the synthetic presence
     *     is the only thing that answers the probe.
     */
    function planIsNoOp(plan) {
      const d = plan.droppedList;
      for (let i = 0; i < d.length; i++) if (hostHasFamily(d[i])) return false;
      if (plan.claimed && (plan.claimedFirst || !hostHasFamily(plan.claimed))) return false;
      return true;
    }

    /**
     * Parse + plan + early-out decision, memoised by the computed `font-family`
     * string. It was rebuilt per element per call before this. The memo is
     * generational on the web-font set, because a `@font-face` that loads later
     * makes a family untouchable that was not before.
     */
    let planCache = new RawMap(), planCacheGen = -2;
    function planFor(famCss) {
      webFontFamilies();                                   // refresh webFontCount first
      if (planCacheGen !== webFontCount) { planCache = new RawMap(); planCacheGen = webFontCount; }
      if (mapHas(planCache, famCss)) return mapGet(planCache, famCss);
      let p = null;
      const families = parseFamilyList(famCss);
      if (families.length !== 0) {
        const plan = planFamilies(families);
        if (plan.dropped || plan.claimed) {
          p = {
            claimed: plan.claimed,
            noop: planIsNoOp(plan),
            keptCss: familiesCss(plan.kept, false),
            genericCss: familiesCss(plan.kept, true),
          };
        }
      }
      if (mapSizeGet(planCache) > 256) mapClear(planCache);
      mapSet(planCache, famCss, p);
      return p;
    }

    let measuring = false;

    function measureWithFamily(el, familyCss, origGet) {
      const style = elStyle(el);
      const prev = cssGetPropertyValue(style, 'font-family');
      const prio = cssGetPropertyPriority(style, 'font-family');
      measuring = true;
      state.internal++;
      try {
        cssSetProperty(style, 'font-family', familyCss, 'important');
        return apply(origGet, el, []);
      } finally {
        if (prev) cssSetProperty(style, 'font-family', prev, prio);
        else cssRemoveProperty(style, 'font-family');
        state.internal--;
        measuring = false;
      }
    }

    /** Bounded, deterministic, and never large enough to wreck a layout. */
    function presenceDelta(family, prop, base, fontSize) {
      const h = keyStr(D().fontKey, family + '|' + prop + '|' + fontSize);
      const cap = mathMax(1, mathMin(6, mathRound(mathAbs(base) * 0.03)));
      const d = 1 + (h % cap);
      return ((h >>> 8) & 1) && base - d > 0 ? -d : d;
    }

    const metricCache = new RawWeakMap();

    /**
     * @param prop      which presence-delta to use — 'offsetWidth' or 'offsetHeight'.
     *                  Shared between the integer and rect paths ON PURPOSE so both
     *                  receive the identical delta and cannot round apart.
     * @param origGet    called with `this = el`; returns the metric being measured.
     * @param cacheTag   cache namespace. Must differ between the integer and rect
     *                   paths or they collide on one cache entry and hand each other
     *                   the other's numbers.
     */
    function fontMetric(el, prop, origGet, cacheTag) {
      const real = () => apply(origGet, el, []);
      if (state.standingDown || measuring) return real();
      // Cheap structural gates first — these keep the shim off the hot path that
      // real layout code uses (containers, long text, detached nodes).
      if (!el || nodeType(el) !== 1 || elChildElementCount(el) !== 0) return real();
      const text = nodeTextContent(el);
      if (!text || text.length === 0 || text.length > 128) return real();
      if (!nodeIsConnected(el)) return real();

      const cs = apply(realmGetComputedStyle, win, [el]);
      const famCss = cs && csFontFamily(cs);
      if (!famCss) return real();

      const plan = planFor(famCss);
      if (!plan) return real();                          // nothing to decide

      // The read is counted either way: the page probed a font stack, and whether
      // we had work to do is our business, not a reason to lose the signal.
      touch('fonts');

      // D34 — the plan changes nothing that the machine could have rendered.
      if (plan.noop) return real();

      const parent = nodeParentElement(el);
      const parentW = parent ? elClientWidth(parent) : -1;
      const fontSize = csFontSize(cs);
      const key = (cacheTag || prop) + '|' + famCss + '|' + fontSize + '|' + csFontWeight(cs) + '|' +
        csFontStyle(cs) + '|' + csLetterSpacing(cs) + '|' + parentW + '|' + text;
      let cache = wmGet(metricCache, el);
      if (cache && mapHas(cache, key)) return mapGet(cache, key);

      const base = measureWithFamily(el, plan.keptCss, origGet);
      let result = base;

      if (plan.claimed) {
        const fallback = measureWithFamily(el, plan.genericCss, origGet);
        // base === fallback ⇒ the claimed font is not really installed here, so the
        // persona's claim needs synthesising. Otherwise the real metric already
        // says "present" and we return it verbatim.
        if (base === fallback) result = base + presenceDelta(plan.claimed, prop, base, fontSize);
      }

      if (!cache) { cache = new RawMap(); wmSet(metricCache, el, cache); }
      if (mapSizeGet(cache) > 64) mapClear(cache);
      mapSet(cache, key, result);
      return result;
    }

    safe('HTMLElement.offsetWidth/offsetHeight', () => {
      const H = win.HTMLElement.prototype;
      replaceGetter(H, 'offsetWidth', function (origGet) { return fontMetric(this, 'offsetWidth', origGet); });
      replaceGetter(H, 'offsetHeight', function (origGet) { return fontMetric(this, 'offsetHeight', origGet); });
    });

    /**
     * getBoundingClientRect must agree with offsetWidth about which fonts exist.
     *
     * The adversarial suite caught these two disagreeing: for a font the persona
     * claims but the machine lacks, `offsetWidth` said "present" (564→565) while
     * `getBoundingClientRect().width` said "absent" (563.52→563.52). One element,
     * two APIs, two different realities — impossible on a clean browser, so it was
     * simultaneously a bypass AND a shim detector. Per DECISIONS.md D2, that is
     * worse than leaking the font list honestly.
     *
     * The rect is measured DIRECTLY through the same font plan, not derived from the
     * rounded offsetWidth delta. An earlier version did derive it, and the removal
     * direction still leaked: "Helvetica Neue" (present on the machine, absent from a
     * Windows persona) gave offsetWidth 564 = the monospace baseline — correctly
     * "absent" — while the rect kept the real 564.12 against a 563.52 baseline, so
     * sub-pixel comparison still said "present". Both paths now share one presence
     * delta and one font plan, so they round together.
     *
     * ⚠ STILL UNREACHED (Arkenfox claim (e), and we are not pretending otherwise):
     * `Element.getClientRects()` and `Range.getClientRects()` return a DOMRectList,
     * which is not constructible from JS — returning an array-like instead would be
     * a worse tell than the disagreement it fixes. SVG `getComputedTextLength()` and
     * `getBBox()` are also unpatched. A tracker that uses any of those still gets the
     * true font list.
     */
    safe('Element.getBoundingClientRect (font-metric agreement)', () => {
      const E = win.Element.prototype;
      replaceMethod(E, 'getBoundingClientRect', (orig) => function getBoundingClientRect() {
        const r = apply(orig, this, arguments);
        if (state.standingDown || measuring) return r;
        try {
          // Scoped to HTMLElement to bound the blast radius; SVG text metrics are a
          // documented gap (G3) rather than something we half-cover here.
          if (!fnHasInstance(RealmHTMLElement, this)) return r;
          const widthOf = function () { return rectWidth(apply(orig, this, [])); };
          const heightOf = function () { return rectHeight(apply(orig, this, [])); };
          const adjW = fontMetric(this, 'offsetWidth', widthOf, 'rectWidth');
          const adjH = fontMetric(this, 'offsetHeight', heightOf, 'rectHeight');
          const rw = rectWidth(r), rh = rectHeight(r);
          if (adjW === rw && adjH === rh) return r;
          return new RealmDOMRect(rectX(r), rectY(r), adjW, adjH);
        } catch (err) { fail('Element.getBoundingClientRect', err); return r; }
      });
    });

    // measureText: same logic, but the fallback can be measured exactly by
    // re-running the native call with a rewritten font shorthand — no DOM involved.
    safe('CanvasRenderingContext2D.measureText', () => {
      const TM = win.TextMetrics;
      const adjust = new RawWeakMap();
      let nativeTMWidth = null;     // the NATIVE TextMetrics.width getter, for our own reads below
      if (TM && TM.prototype) {
        const props = ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight'];
        for (let i = 0; i < props.length; i++) {
          const p = props[i];
          if (!objGetOwnPropertyDescriptor(TM.prototype, p)) continue;
          const origGetter = replaceGetter(TM.prototype, p, function (origGet) {
            const real = apply(origGet, this, []);
            const a = wmGet(adjust, this);
            return (!state.standingDown && a && typeof real === 'number') ? real * a : real;
          });
          if (p === 'width') nativeTMWidth = origGetter;
        }
      }
      const widthOfMetrics = (m) => (nativeTMWidth ? apply(nativeTMWidth, m, []) : m.width);

      const FONT_SHORTHAND =
        /^\s*(.*?)((?:\d*\.?\d+)(?:px|pt|pc|in|cm|mm|q|em|rem|ex|ch|vw|vh|vmin|vmax|%)(?:\s*\/\s*\S+)?)\s+(.+)$/i;

      const patch = (proto, getFont, setFont) => replaceMethod(proto, 'measureText', (orig) => function measureText() {
        // Delegate FIRST. The native brand check and argument check — a wrong
        // receiver, `measureText()` with nothing to measure — throw here, to the
        // caller, exactly as unpatched; before this they threw inside the try
        // below and were logged as a patch failure (§3d). This measurement is
        // also the answer for every font that needs no work, so the common path
        // costs the same one native call it always did.
        const m0 = apply(orig, this, arguments);
        if (state.standingDown) return m0;
        let m = m0;
        try {
          const parsed = reExec(FONT_SHORTHAND, getFont(this) || '');
          if (!parsed) return m0;
          const plan = planFor(parsed[3]);
          if (!plan) return m0;

          touch('fonts');
          if (plan.noop) return m0;                    // D34 — nothing to substitute
          const prefix = parsed[1] + parsed[2] + ' ';
          const saved = getFont(this);
          state.internal++;
          try {
            setFont(this, prefix + plan.keptCss);
            m = apply(orig, this, arguments);
            if (plan.claimed) {
              const w1 = widthOfMetrics(m);
              setFont(this, prefix + plan.genericCss);
              const w2 = widthOfMetrics(apply(orig, this, arguments));
              if (w1 === w2 && TM && TM.prototype) {
                const h = keyStr(D().fontKey, plan.claimed + '|measureText|' + parsed[2]);
                wmSet(adjust, m, 1 + (((h % 25) + 5) / 1000) * ((h >>> 8) & 1 ? -1 : 1)); // ±0.5%..3%
              }
            }
          } finally {
            setFont(this, saved);
            state.internal--;
          }
        } catch (err) {
          fail('CanvasRenderingContext2D.measureText', err);
          return m0;
        }
        return m;
      });

      patch(Ctx2D.prototype, ctxFont, setCtxFont);
      if (OffCtx2D && OffCtx2D.prototype && objGetOwnPropertyDescriptor(OffCtx2D.prototype, 'measureText')) {
        patch(OffCtx2D.prototype, offCtxFont, setOffCtxFont);
      }
    });

    // ────────────────────────────────────────────────────────────────────────
    // TIMEZONE — deliberately NOT shimmed (gap G4)
    //
    // `Intl.DateTimeFormat().resolvedOptions().timeZone` and
    // `Date.prototype.getTimezoneOffset()` are left completely alone for v0.1.
    //
    // Reason: a timezone is checkable against the IP address, and Nullecho cannot
    // touch the IP (ARCHITECTURE.md non-goals). Presenting America/New_York from a
    // German IP is not camouflage — it is a bright "this client is lying" flag to
    // exactly the fraud-detection stack DECISIONS.md D2 warns about, and it earns
    // the user CAPTCHAs and re-auth challenges. Doing it consistently requires
    // knowing the exit IP's region, which means a VPN/proxy, which is a different
    // product. The cost is real: timezone stays as a coarse geographic signal.
    // It is a *coarse* one — city-level at best, shared with millions.
    //
    // What would change this: shipping alongside a network layer that pins the exit
    // region, at which point the persona gains a timezone field and this becomes
    // safe to spoof.
    // ────────────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────────────
    // Child realms. A same-origin `about:blank` / srcdoc iframe is a PRISTINE
    // realm — a tracker that creates one and reads `iframe.contentWindow.navigator`
    // bypasses everything above. Static content scripts do not reliably reach those
    // frames, so we install on first access instead.
    // ────────────────────────────────────────────────────────────────────────
    safe('iframe child realms', () => {
      const P = win.HTMLIFrameElement.prototype;
      let nativeContentWindow = null;
      const hook = (prop, toWindow) => {
        if (!objGetOwnPropertyDescriptor(P, prop)) return null;
        return replaceGetter(P, prop, function (origGet) {
          const v = apply(origGet, this, []);
          if (!state.standingDown) {
            try { const w = toWindow(v); if (w) installInto(w); }
            catch (_) { /* cross-origin: nothing to patch and nothing to leak */ }
          }
          return v;
        });
      };
      nativeContentWindow = hook('contentWindow', (w) => w);
      hook('contentDocument', (d) => (d ? d.defaultView : null));
      // The observer below reaches the child realm through the NATIVE getter we
      // just captured, never through `node.contentWindow` on the live prototype.
      const childWindowOf = (f) => (nativeContentWindow ? apply(nativeContentWindow, f, []) : f.contentWindow);

      // `window[0]` / `window.frames[0]` reach the same realm WITHOUT going through
      // `contentWindow`, and those are live indexed properties on the WindowProxy
      // that cannot be intercepted. So we also install as frames are inserted.
      //
      // The observer is the BACKSTOP, not the mechanism: its callback runs at the
      // next microtask checkpoint, which is a tick too late for a script that
      // inserts and reads in one synchronous block. The same-tick block below
      // installs from inside the insertion call itself (D35). What the observer
      // still earns is every path that block does not wrap — above all the HTML
      // PARSER, which inserts `<iframe>` elements by calling no DOM method at all.
      try {
        const obs = new RealmMutationObserver((records) => {
          if (state.standingDown) return;
          for (let r = 0; r < records.length; r++) {
            const added = recordAddedNodes(records[r]);
            const n = nodeListLength(added) | 0;
            for (let i = 0; i < n; i++) {
              const node = added[i];
              try {
                if (!node || nodeType(node) !== 1) continue;
                if (elTagName(node) === 'IFRAME') installInto(childWindowOf(node));
                else {
                  const frames = elQuerySelectorAll(node, 'iframe');
                  const fn = nodeListLength(frames) | 0;
                  for (let j = 0; j < fn; j++) installInto(childWindowOf(frames[j]));
                }
              } catch (_) { /* cross-origin */ }
            }
          }
        });
        obs.observe(doc, { childList: true, subtree: true });
      } catch (err) { fail('iframe insertion observer', err); }
    });

    // ────────────────────────────────────────────────────────────────────────
    // SAME-TICK child realms — D35, and the close of CLAIM-VERIFICATION §3c.
    //
    // A child browsing context is created SYNCHRONOUSLY, inside the native call
    // that connects the `<iframe>` element to the document. So the whole window
    // between "a pristine realm exists" and "we patch it" is the tail of that one
    // call — and the fix is to install before the call returns:
    //
    //     const n = self.length;
    //     document.body.appendChild(fragmentContainingAnIframe);   // ← here
    //     const w = self[n];            // …already patched by the time we land
    //
    // That is CreepJS's `getPhantomIframe()` verbatim (DocumentFragment → a div
    // whose `innerHTML` carries an `<iframe>` → `body.appendChild(frag)` →
    // `self[numberOfIframes]`), and everything it measures it measures in that
    // realm — including a `Function.prototype.toString` that, left pristine, prints
    // the shim's ACTUAL SOURCE for every function patched in the parent.
    //
    // COST DISCIPLINE. `appendChild` is one of the hottest calls on the web, so the
    // wrapper does exactly one extra thing on a page with no frames: read
    // `window.length` through its captured getter. Only if that is non-zero does it
    // walk `win[i]`, and `installInto` early-outs on an already-installed realm
    // through one WeakSet lookup. There is no subtree scan and no querySelectorAll.
    //
    // WHY NOT "did `length` GROW?". Because that test is unsound. Moving an already
    // connected `<iframe>` destroys its browsing context and creates a new one, so
    // the count is unchanged while the realm behind `window[0]` is brand new and
    // pristine — `appendChild(f)` twice is a two-line bypass of a delta test. The
    // unconditional walk costs the same as the "before" read it replaces when there
    // are no frames, and it is correct when there are.
    // ────────────────────────────────────────────────────────────────────────
    safe('same-tick child realms', () => {
      // `length` is a `[Replaceable]` attribute of the Window interface, so its
      // getter sits on the prototype rather than on the global object — resolved by
      // owner rather than assumed, captured HERE at the first touch of this realm,
      // and invoked only through the captured `Reflect.apply` (D21).
      //
      // `null` is not an error and is not reported as one: a realm that exposes no
      // `length` exposes no `window[n]` either, so it has no indexed frame list to
      // sweep and §3c's bypass does not exist in it. The wrappers still go in —
      // `window.open` hands back a realm that `length` never counted anyway.
      const winLength = getterOf(ownerOf(win, 'length'), 'length');

      /** Install into every document-tree child navigable this realm can see. */
      const reachFrames = () => {
        if (!winLength) return;
        let n = 0;
        try { n = apply(winLength, win, []) | 0; } catch (_) { return; }
        for (let i = 0; i < n; i++) {
          // `win[i]` is the one indexed WindowProxy read a page cannot intercept,
          // which is precisely why this hole existed; it is also why reading it
          // needs no captured builtin. A cross-origin frame throws inside
          // `installInto` (it reads `win.document`) and is marked as seen, so it
          // costs one throw ever, not one per insertion.
          //
          // The `wsHas` guard is `installInto`'s OWN first line, hoisted out — and
          // it is worth ~1 µs per frame per insertion. `installInto` declares
          // several hundred locals (every captured native in the realm), so its
          // interpreter frame is large and merely CALLING it costs about a
          // microsecond even when it returns on line 1. Measured on a page with 5
          // child frames: +3.4 µs per `appendChild` with the naive call, +0.5 µs
          // with this guard. Same WeakSet, same semantics, one function call less.
          try { const w = win[i]; if (w && !wsHas(INSTALLED, w)) installInto(w); }
          catch (_) { /* cross-origin: nothing to patch and nothing to leak */ }
        }
      };

      // ── THE TABLE ────────────────────────────────────────────────────────
      // Every DOM entry point that can connect an `<iframe>` to this document in
      // the caller's own tick. `ext/src/same-tick-realm.test.js` parses this
      // literal out of the source and fails if a row is not really wrapped, or if
      // a known entry point has lost its row.
      //
      // `kind`: 'method' and 'setter' sweep the frame list after delegating;
      // 'opener' installs into the window the call RETURNS (an auxiliary browsing
      // context is a realm of its own and `length` does not count it).
      //
      // `DocumentFragment` is on the list even though a fragment is never
      // connected: `ShadowRoot` does not define its own `append`/`prepend`/
      // `replaceChildren` and inherits DocumentFragment's, and a shadow root IS
      // connected. For an ordinary detached fragment the sweep is a no-op that
      // costs one accessor read — see D35 for what was considered and rejected.
      const INSERTION_SITES = [
        // interface           kind      property
        ['Node',              'method', 'appendChild'],
        ['Node',              'method', 'insertBefore'],
        ['Node',              'method', 'replaceChild'],
        ['Element',           'method', 'append'],
        ['Element',           'method', 'prepend'],
        ['Element',           'method', 'after'],
        ['Element',           'method', 'before'],
        ['Element',           'method', 'replaceWith'],
        ['Element',           'method', 'replaceChildren'],
        ['Element',           'method', 'insertAdjacentElement'],
        ['Element',           'method', 'insertAdjacentHTML'],
        ['Element',           'method', 'setHTMLUnsafe'],
        ['Element',           'setter', 'innerHTML'],
        ['Element',           'setter', 'outerHTML'],
        ['CharacterData',     'method', 'after'],
        ['CharacterData',     'method', 'before'],
        ['CharacterData',     'method', 'replaceWith'],
        ['ShadowRoot',        'setter', 'innerHTML'],
        ['ShadowRoot',        'method', 'setHTMLUnsafe'],
        ['Document',          'method', 'write'],
        ['Document',          'method', 'writeln'],
        ['Document',          'method', 'append'],
        ['Document',          'method', 'prepend'],
        ['Document',          'method', 'replaceChildren'],
        ['DocumentFragment',  'method', 'append'],
        ['DocumentFragment',  'method', 'prepend'],
        ['DocumentFragment',  'method', 'replaceChildren'],
        ['Range',             'method', 'insertNode'],
        ['Range',             'method', 'surroundContents'],
        ['Window',            'opener', 'open'],
      ];

      /** One wrapper factory for every site in the table. */
      const wrapSite = (iface, kind, prop) => {
        // `open` is an own method of the Window interface, which for a global
        // object means its owner is found by walking from `win` itself.
        const P = iface === 'Window' ? ownerOf(win, prop) : (win[iface] && win[iface].prototype);
        if (!P) return;
        const d = objGetOwnPropertyDescriptor(P, prop);
        if (!d) return;                              // not in this Chrome; nothing to wrap
        if (kind === 'setter') {
          if (typeof d.set !== 'function') return;
          replaceSetter(P, prop, function (origSet, v) {
            // `finally`, not a tail call: an entry point that throws AFTER
            // connecting a node (or one called with a wrong receiver, which
            // CreepJS does to every API it audits) must not skip the sweep.
            try { apply(origSet, this, [v]); }
            finally { if (!state.standingDown) reachFrames(); }
          });
          return;
        }
        if (typeof d.value !== 'function') return;
        if (kind === 'opener') {
          replaceMethod(P, prop, (orig) => function () {
            const w = apply(orig, this, arguments);
            if (!state.standingDown && w) {
              try { installInto(w); } catch (_) { /* cross-origin opener */ }
            }
            return w;
          });
          return;
        }
        replaceMethod(P, prop, (orig) => function () {
          try { return apply(orig, this, arguments); }
          finally { if (!state.standingDown) reachFrames(); }
        });
      };

      for (let i = 0; i < INSERTION_SITES.length; i++) {
        const row = INSERTION_SITES[i];
        try { wrapSite(row[0], row[1], row[2]); }
        catch (err) { fail('insertion site ' + row[0] + '.' + row[2], err); }
      }

      // Frames that already exist at this moment — a realm we are installing into
      // late, or a document whose parser ran ahead of us.
      reachFrames();
    });

    // ────────────────────────────────────────────────────────────────────────
    // HONEST LIMIT, as it now stands. Every DOM call that can connect an
    // `<iframe>` is wrapped, so the same-tick `window[n]` bypass is closed for
    // script-driven insertion at any depth — verified in real Chrome against
    // CreepJS's own `getPhantomIframe` shape, a grandchild and a great-grandchild,
    // `Range`, `DOMParser` + `adoptNode`/`importNode`, `<template>` clones, `src`
    // and `srcdoc` set before insertion, named `window.frames[name]` access, and a
    // MOVE (D35's attack table). What remains, MEASURED rather than assumed:
    //
    //  1. 🔴 **The HTML parser.** `<iframe>` in static markup, or written during
    //     parsing, is connected by the parser itself — no DOM method is called, so
    //     there is nothing to wrap. Measured inside an installed child realm: an
    //     inline `<script>` in the SAME parse read the host's 12 cores; the moment
    //     the enclosing `document.write` returned, the same frame read the
    //     persona's 8. So the window is one parse wide. The MutationObserver above
    //     closes it one microtask later, and in a real install Chrome's own
    //     `match_about_blank` injection should give that frame its own copy of the
    //     shim (D31) — that half is assumed, not verified.
    //  2. 🔴 **A frame navigated AFTER insertion.** Insert `about:blank` (we
    //     install), then assign `src`: the new realm reads the real machine and its
    //     `userAgent` getter is unpatched. `INSTALLED` is keyed on the WindowProxy,
    //     which SURVIVES navigation, so the sweep, `contentWindow` and the observer
    //     all say "already installed" about a realm that no longer exists.
    //     Pre-existing — every door has always used that key — and asynchronous, so
    //     it is not the same-tick bypass. The fix is to key on the realm's own
    //     `document` (a `[LegacyUnforgeable]` own property the page cannot spoof)
    //     with a second set for realms that throw on it; that is a change to
    //     `installInto`'s contract with its own cost, and it is the next decision.
    //     Note `src` set BEFORE insertion does NOT leak: Blink reuses the initial
    //     empty document's Window for that navigation, so it stays the realm we
    //     installed into.
    //  3. **A frame that starts cross-origin and later becomes same-origin.** Same
    //     root cause as 2: `installInto` marks a realm as seen before it discovers
    //     it cannot read its document, so that WindowProxy is never retried. The
    //     alternative is a throw on every sweep for every cross-origin ad frame.
    //  4. **Anything Chrome adds later.** A new insertion API with no row in
    //     `INSERTION_SITES` is unwrapped by construction. The lint test pins the
    //     table against the entry points we know about; it cannot pin it against
    //     ones that do not exist yet.
    //  5. **A realm we never learn about.** `window.open(..., 'noopener')` returns
    //     `null` (nothing for us to install into, and nothing for the page either);
    //     a cross-origin frame has nothing to patch; and a navigable that is
    //     neither indexed by `length` nor reachable through `contentWindow` is out
    //     of reach by construction. An `<iframe>` in a SHADOW tree is in that last
    //     class for `window[n]` — measured, `window.length` does not count it, so
    //     the page cannot reach it that way either — and `contentWindow` covers it.
    //
    // Rejected, with reasons, in DECISIONS.md D35: hooking the indexed
    // WindowProxy properties (not interceptable), hooking `window.length` as the
    // trigger (CreepJS reads it BEFORE inserting), a `length`-delta test (unsound
    // across a move), and a subtree scan on the insertion path (the cost).
    // ────────────────────────────────────────────────────────────────────────

  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Self-tests. Requirement 2: prove determinism rather than assert it.
  // ══════════════════════════════════════════════════════════════════════════

  function cheapHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = strCharCodeAt(str, i);
      h1 = mathImul(h1 ^ ch, 2654435761);
      h2 = mathImul(h2 ^ ch, 1597334677);
    }
    h1 = mathImul(h1 ^ (h1 >>> 16), 2246822507) ^ mathImul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = mathImul(h2 ^ (h2 >>> 16), 2246822507) ^ mathImul(h1 ^ (h1 >>> 13), 3266489909);
    let hex = numToString(4294967296 * (2097151 & h2) + (h1 >>> 0), 16);
    while (hex.length < 14) hex = '0' + hex;
    return hex;
  }

  /**
   * 50 consecutive canvas reads must produce ONE hash. If this ever reports more
   * than one, the noise has become per-read and the averaging attack works again.
   *
   * Dev-only. The canvas calls here go through the PATCHED page API on purpose —
   * the self-test measures what a page sees.
   */
  function selfTest(iterations) {
    const n = iterations || 50;
    const out = { reads: n, toDataURL: null, getImageData: null, stable: false, unique: 0 };
    state.internal++;
    try {
      const urls = new RawSet(), pixels = new RawSet();
      let firstUrl = null, firstPixels = null;
      for (let i = 0; i < n; i++) {
        const c = document.createElement('canvas');
        c.width = 220; c.height = 44;
        const ctx = c.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial"';
        ctx.fillStyle = '#f60';
        ctx.fillRect(10, 4, 60, 18);
        ctx.fillStyle = '#069';
        ctx.fillText('Nullecho determinism ✨', 4, 20);
        const u = cheapHash(c.toDataURL());
        const p = cheapHash(taJoin(ctx.getImageData(0, 0, 220, 44).data, ','));
        if (firstUrl === null) { firstUrl = u; firstPixels = p; }
        setAdd(urls, u);
        setAdd(pixels, p);
      }
      const us = setSizeGet(urls), ps = setSizeGet(pixels);
      out.toDataURL = { unique: us, hash: firstUrl };
      out.getImageData = { unique: ps, hash: firstPixels };
      out.unique = mathMax(us, ps);
      out.stable = us === 1 && ps === 1;
    } finally { state.internal--; }
    return out;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. Handshake with shim-loader.js
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Read `detail` through the descriptor captured at boot, never through the live
   * property. A page that redefines `CustomEvent.prototype.detail` can otherwise
   * see the loader's real payload (nonce included), return a forged one in its
   * place, and stand the shim down with its own nonce. Cheap to defend, fatal to
   * ignore.
   */
  function detailOf(ev) {
    if (!ev) return null;
    let raw;
    try { raw = RAW.detailGet ? apply(RAW.detailGet, ev, []) : ev.detail; }
    catch (_) { return null; }
    return typeof raw === 'string' ? raw : null;
  }

  /**
   * Review finding A3. The loader's delivery carries the persona — noise keys and
   * seed included — and a page listener on `window` (capture) registered after us
   * could read it: not the nonce (spent), but the keys that let it compute our
   * exact perturbation for any canvas size without drawing a probe.
   *
   * So: once a delivery AUTHENTICATES, we stop it dead through the captured
   * `stopImmediatePropagation` — we are the first listener on the first node of
   * the path, so nothing after us runs. Unauthenticated events are the page's own
   * and are left alone (swallowing them would be a free "Nullecho present" probe).
   *
   * THE TRAP, and the ordering decision (DECISIONS.md D21): `gpc.js` consumes the
   * SAME event, registers after us, and would now never hear its config. The
   * loader still sends one event; we re-dispatch a STRIPPED copy for gpc.js —
   * `{ ok, enabled, gpc, gpcNonce }`, no persona, no shim nonce — which gpc.js
   * authenticates with its own nonce (D13) and swallows in turn. The relay is
   * skipped when the loader had no gpc nonce (gpc.js is `exclude_matches`-ed off
   * ~50 hosts), so on those pages nothing at all reaches a page listener.
   * Delivery order is therefore: shim authenticates → shim swallows → shim relays
   * → gpc authenticates → gpc swallows.
   */
  function onPersonaEvent(ev) {
    const accepted = handleHandshake(detailOf(ev));
    if (!accepted) return;
    try { if (RAW.stopImmediatePropagation) apply(RAW.stopImmediatePropagation, ev, []); } catch (_) {}
    // Own-property reads, and `null` where the loader sent nothing — review B9,
    // D29. Both halves matter. The failure payload (`{ok:false, reason, nonce,
    // gpcNonce}`) carries neither `gpc` nor `enabled`, so reading them through the
    // prototype handed the page the values; and relaying `undefined` is the same
    // hole one step later, because `JSON.stringify` DROPS an undefined member and
    // gpc.js would then read the missing key off its own polluted prototype. Its
    // rule is `cfg.gpc !== false && cfg.enabled !== false`, so
    // `Object.prototype.gpc = false` silently suppressed the user's GPC signal on
    // every page where the service worker was unreachable. Explicit `null` keeps
    // that default ON and cannot be overridden.
    const gpcNonce = ownField(accepted, 'gpcNonce');
    if (typeof gpcNonce === 'string') {
      const orNull = (key) => { const v = ownField(accepted, key); return v === undefined ? null : v; };
      emit(EV_PERSONA, { ok: orNull('ok'), enabled: orNull('enabled'), gpc: orNull('gpc'), gpcNonce });
    }
  }

  /** An authenticated report (D30). The BOOT event is not one — it uses `emit` directly. */
  /**
   * A health report. Any failures not yet reported ride along as `failures`, a
   * list of labels (D33) — defined as an OWN property, never assigned, so a setter
   * a page put on `Object.prototype.failures` is not handed the list (D29/D30).
   */
  function status(obj) {
    state.lastStatus = { upgraded: obj.upgraded, lockedToFallback: obj.lockedToFallback, reason: obj.reason };
    const all = state.failures;
    if (all.length > state.failuresReported) {
      const labels = [];
      for (let i = state.failuresReported; i < all.length; i++) pushOwn(labels, all[i].label);
      state.failuresReported = all.length;
      // Null prototype: `emit()` copies only the TOP-LEVEL object onto a null
      // prototype, and `JSON.stringify` looks `toJSON` up the chain of every
      // nested object too — a page's `Object.prototype.toJSON` would be handed
      // this list. Still an array (`Array.isArray` is about the exotic object,
      // not the chain), so it serialises as one.
      objSetPrototypeOf(labels, null);
      objDefineProperty(obj, 'failures', { value: labels, writable: true, enumerable: true, configurable: true });
    }
    report(EV_STATUS, obj);
  }

  /**
   * The host of an origin string, without `new URL` (whose `hostname` getter is the
   * page's, and whose parse we would then be calling a prototype for). Handles
   * `https://host`, `https://host:8443`, and bracketed IPv6 authorities. Returns ''
   * for `null`, `about:blank` and anything else without a `scheme://` prefix.
   */
  function hostOfOrigin(origin) {
    const s = RawString(origin || '');
    const i = strIndexOf(s, '://');
    if (i < 0) return '';
    let rest = strSlice(s, i + 3);
    const slash = strIndexOf(rest, '/');
    if (slash >= 0) rest = strSlice(rest, 0, slash);
    if (strIndexOf(rest, '[') === 0) {                 // [::1]:8443 → [::1]
      const close = strIndexOf(rest, ']');
      return close >= 0 ? strSlice(rest, 0, close + 1) : rest;
    }
    const colon = strIndexOf(rest, ':');
    return colon >= 0 ? strSlice(rest, 0, colon) : rest;
  }

  /**
   * The site key the FALLBACK persona is derived from — review B3, D31.
   *
   * In an `about:blank` or `srcdoc` child, `location.hostname` is `''` and
   * `location.origin` is the PARENT's origin, inherited. Keying on the raw origin
   * string then produced `'https://www.news.example'` where the parent produced
   * `'news.example'` — a different seed, so (for about 80% of sites) a different
   * persona, inside a document tree the page can reach into either way. The child
   * now derives the parent's eTLD+1 from the origin it inherited, so a same-origin
   * child and its parent land on the same machine even before the upgrade.
   */
  function fallbackSiteKey() {
    return registrableDomain(location.hostname)
      || registrableDomain(hostOfOrigin(location.origin))
      || location.origin || 'opaque';
  }

  /**
   * Accept the loader's one-time reply tokens (D30) and flush anything reported
   * before they arrived. A malformed list leaves `reportTokens` null, which means
   * the loader will believe nothing we say for the rest of this document — the
   * safe direction: silence, never an unauthenticated claim.
   */
  function takeReportTokens(list) {
    if (!arrayIsArray(list)) return;
    const out = [];
    for (let i = 0; i < list.length; i++) {
      if (typeof list[i] === 'string' && list[i].length >= 8) pushOwn(out, list[i]);
    }
    if (!out.length) return;
    state.reportTokens = out;
    state.reportIndex = 0;
    flushReportBacklog();
  }

  /**
   * Own-property reads throughout (review B9, D29): a genuine payload whose
   * persona was truncated must FAIL here rather than be completed from whatever
   * the page left on `Object.prototype`. Every field `derive()` then consumes is
   * either checked here or has a literal default in `derive()` itself.
   */
  function validPersona(p) {
    if (!p || typeof p !== 'object') return false;
    const noise = ownField(p, 'noise');
    return !!(typeof ownField(p, 'ua') === 'string' && ownField(p, 'platform') &&
      ownField(p, 'gpu') && ownField(p, 'screen') && arrayIsArray(ownField(p, 'fontList')) &&
      noise && typeof ownField(noise, 'canvas') === 'number');
  }

  /**
   * Returns the authenticated payload (so the caller can stop propagation and
   * relay to gpc.js), or null when nothing was accepted.
   */
  function handleHandshake(json) {
    if (state.handshakeDone) return null;          // exactly one, ever

    let payload = null;
    try { payload = json ? RAW.jsonParse(json) : null; } catch (_) { payload = null; }

    // ── AUTHENTICATE FIRST ───────────────────────────────────────────────────
    // Everything below this gate is an instruction from something claiming to be
    // the loader. Only a holder of the nonce this script minted at document_start
    // — before any page script existed to observe it — can be that.
    //
    // A failed check does NOT consume the one-shot. If it did, a page could shout
    // one junk message at document_start and permanently deny the salted-persona
    // upgrade, turning an authentication check into a downgrade attack.
    // `ownField` throughout, never `payload.x` — review B9, D29.
    if (!payload || typeof payload !== 'object' || !nonceMatches(ownField(payload, 'nonce'))) {
      state.forged++;
      if (!state.forgeryReported) {
        state.forgeryReported = true;
        // The console line for this ("something is impersonating the extension, or
        // Nullecho lost the document_start race — protection stays ON") is printed
        // by shim-loader.js on receiving this reason, from the ISOLATED world. This
        // file never writes to the page's console: a page could provoke exactly
        // this message with one forged event and read the product name back (D33).
        status({
          upgraded: false,
          lockedToFallback: false,
          reason: HAS_CSPRNG ? 'forged-handshake-rejected' : 'no-csprng-handshake-refused',
        });
      }
      return null;
    }

    state.handshakeDone = true;
    nonceBox.value = null;                         // used once; no replay value
    try { removeListeners(); } catch (_) {}
    applyAuthenticated(payload);
    return payload;
  }

  function applyAuthenticated(payload) {
    // FIRST, before any status goes out: take the one-time reply tokens the loader
    // minted for this document (review C1, D30). They ride inside the payload the
    // boot nonce authenticates and the shim swallows (D21/A3), so no page listener
    // ever sees them; every report from here on spends one. Own-property read and
    // copied element by element with `pushOwn`, like every other payload field.
    takeReportTokens(ownField(payload, 'reportTokens'));

    // GPC, before every early return below (D46). The rule is gpc.js's, moved
    // here verbatim: `enabled === false` hands the property back — which the
    // stand-down branch's `restoreAll()` does — and anything else takes
    // `gpc !== false`. It runs on a FAILURE payload too, which carries neither
    // field, and that is why both reads are OWN-property reads (D29/B9): an
    // absent `gpc` must default the signal ON, not resolve to whatever the page
    // left on `Object.prototype`.
    if (ownField(payload, 'enabled') !== false) {
      try { setGpcSignal(ownField(payload, 'gpc') !== false); } catch (_) {}
    }

    // EVERY branch below reads an OWN property (review B9, D29). Authentication
    // proves the message came from the loader; it says nothing about the fields
    // the loader left OUT, and an absent own property is exactly when `[[Get]]`
    // asks `Object.prototype` — which the page owns.
    if (ownField(payload, 'ok') !== true) {
      status({ upgraded: false, lockedToFallback: false, reason: ownField(payload, 'reason') || 'handshake failed' });
      return;
    }

    // `dev` is the one the review caught: `background.js` NEVER sends it, so the
    // prototype was consulted on every single genuine handshake, and a page that
    // had written `Object.prototype.dev = true` got `window.__nullechoDev` —
    // persona id, counters, and failure stacks naming the extension's URL.
    if (ownField(payload, 'dev') === true) installDevSurface();

    // Allowlisted site → put the originals back and get out of the way.
    //
    // `enabled === false` is required EXPLICITLY. An earlier version also stood
    // down whenever `persona` was merely absent, which meant a payload of
    // `{ok:true, enabled:true}` — a truncated message, or a forged one — silently
    // stripped all protection and exposed the real machine. Standing down is the
    // most destructive thing this file can do, so it now happens only on an
    // unambiguous instruction. Anything else keeps the fallback persona.
    //
    // ✅ CLOSED 2026-08-20. The other half of that hole — a page dispatching its own
    // `{ok:true, enabled:false}` and being obeyed — is gone: this line is now
    // unreachable without the boot nonce, which no page script can have seen. See
    // the AUTHENTICATE FIRST gate above and the contract in src/protocol.js.
    // ✅ And since D29 it cannot be reached by `Object.prototype.enabled = false`
    // either — the read is own-only, so a payload that omits `enabled` omits it.
    if (ownField(payload, 'enabled') === false) {
      state.standingDown = true;
      restoreAll();
      status({ upgraded: false, lockedToFallback: false, reason: 'allowlisted' });
      return;
    }

    const persona = ownField(payload, 'persona');
    if (!validPersona(persona)) {
      fail('persona handshake', new Error('malformed persona payload; staying on the fallback'));
      status({ upgraded: false, lockedToFallback: true, reason: 'malformed-persona' });
      return;
    }

    // A delivered id outside the inlined pool would mean the mirror (gap G7) has
    // drifted from src/personas.js. Not fatal — the delivered persona is
    // authoritative — and no longer a run-time console line (D33): the mirror is
    // pinned by `personas.test.js` ("src/shim.js inlined pool is an exact mirror"),
    // which is where a drift belongs.

    // THE GATE. Swapping personas after a read would mix fields from two machines,
    // which DECISIONS.md D2 identifies as worse than no defense at all.
    if (state.reads > 0) {
      status({ upgraded: false, lockedToFallback: true, reason: 'api-read-before-handshake' });
      return;
    }

    state.persona = persona;
    state.derived = derive(persona);
    state.upgraded = true;
    status({ upgraded: true, lockedToFallback: false, reason: null });
  }

  /**
   * Dev surface. Installed ONLY when the boot payload carries `dev: true`, which
   * `background.js` never sets — so a production page gets no global at all
   * (requirement 1: no stray globals). Non-enumerable, so it does not show up in
   * `Object.keys(window)` even in dev.
   */
  function installDevSurface() {
    state.dev = true;
    try {
      objDefineProperty(globalThis, '__nullechoDev', {
        value: objFreeze({
          version: '0.1.0',
          get personaId() { return state.persona && state.persona.id; },
          get persona() { return state.persona; },
          get upgraded() { return state.upgraded; },
          get standingDown() { return state.standingDown; },
          /** Persona payloads rejected for a bad nonce. Non-zero = a page tried. */
          get forged() { return state.forged; },
          get reads() { return state.reads; },
          get perApi() { return { ...state.perApi }; },
          get failures() {
            const out = [];
            for (let i = 0; i < state.failures.length; i++) pushOwn(out, state.failures[i]);
            return out;
          },
          selfTest,
        }),
        writable: false, enumerable: false, configurable: true,
      });
    } catch (err) { fail('dev surface', err); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Boot
  // ══════════════════════════════════════════════════════════════════════════

  // (a) LISTEN BEFORE ANNOUNCING.
  //
  //     `window` in the CAPTURE phase, not `document`. An event dispatched on
  //     `document` propagates window → document, so a page's
  //     `window.addEventListener('nullecho:persona', fn, true)` fires BEFORE any
  //     document-phase listener — early enough to read the loader's payload
  //     (nonce and all) and then `stopPropagation()` so we never see the real one.
  //     A nonce alone would not have survived that; listening at the head of the
  //     path does, because same-phase listeners fire in registration order and
  //     ours is registered at document_start.
  //
  //     `document` capture is kept as a second registration purely for a browser
  //     that does not put the window in a document event's path. The one-shot in
  //     `handleHandshake` makes the duplicate delivery a no-op.
  const LISTEN_TARGETS = [];

  function addListeners() {
    const targets = [globalThis, document];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t || !RAW.addEventListener) continue;
      try { apply(RAW.addEventListener, t, [EV_PERSONA, onPersonaEvent, true]); pushOwn(LISTEN_TARGETS, t); }
      catch (_) { /* not an EventTarget in this realm */ }
    }
  }

  function removeListeners() {
    for (let i = 0; i < LISTEN_TARGETS.length; i++) {
      try { apply(RAW.removeEventListener, LISTEN_TARGETS[i], [EV_PERSONA, onPersonaEvent, true]); } catch (_) {}
    }
    LISTEN_TARGETS.length = 0;
  }

  addListeners();

  // (b) Tell the loader we exist, and hand it the nonce. Its absence is how the
  //     loader detects a failed injection; the nonce is how this script tells a
  //     real reply from a page's impersonation of one. This dispatch is the first
  //     thing about Nullecho that is observable from the page — and at
  //     document_start there is nothing on the page yet to observe it.
  //
  //     `emit`, not `status`: this is the one reverse message that cannot carry a
  //     reply token, because it is what the loader mints the tokens in reply to.
  //     The loader treats it as unauthenticated and lets it change nothing but the
  //     nonce it publishes (D30).
  emit(EV_STATUS, { phase: BOOT_PHASE, channel: CHANNEL, nonce: nonceBox.value });

  // No CSPRNG → `nonce: null` above: we cannot authenticate anything, so we will
  // accept nothing and stay on the fallback persona. That is said out loud by
  // shim-loader.js (`shim-never-booted`, plus its "published no handshake nonce"
  // line), from the ISOLATED world — not here (D33).

  // (c) Stage 1: fallback persona, derived synchronously, patched immediately.
  //     Keyed on the registrable domain so the stage-2 upgrade is the SAME site
  //     key the service worker used — a re-salt of one machine, not a new one.
  //
  //     ⚠ GUARDED, and the guard is load-bearing. `addListeners()` runs at (a),
  //     *before* the nonce is published at (b), so a reply that arrives
  //     synchronously inside that dispatch is handled before this line runs.
  //     Unguarded, this then overwrote the salted persona with the fallback
  //     while `{upgraded: true}` had already gone out — the shim presented the
  //     fallback and reported that it had rotated. Silent, and a lie to the UI.
  //     The real loader replies asynchronously (a service-worker round trip), so
  //     production never hit it; harness/shim-test.html replies synchronously
  //     and did, on the first run after the nonce handshake landed.
  //     Found 2026-08-21 while measuring D12.
  try {
    if (!state.persona && !state.standingDown) {
      const siteKey = fallbackSiteKey();
      state.persona = personaFor(FALLBACK_PEPPER, siteKey);
      state.derived = derive(state.persona);
    }
  } catch (err) {
    fail('fallback persona derivation', err);
  }

  if (state.standingDown) {
    // An allowlist stand-down already landed (same reentrancy path). It called
    // restoreAll() before anything was patched, so there is nothing to restore
    // and nothing to install — but patching now would re-protect a site the
    // user switched off.
  } else if (state.derived) {
    installInto(globalThis);
  } else {
    // Nothing coherent to present. Patching with a half-built persona would be
    // worse than not patching, but the user must not believe they are covered.
    status({ upgraded: false, lockedToFallback: false, reason: 'fallback-derivation-failed' });
  }

  // (d) Stage 2 needs no further wiring: the listeners went in at (a), before the
  //     nonce was published, so there is no window in which the loader could reply
  //     to a boot event we were not yet listening for.
  //
  //     The old `data-nullecho-boot` attribute channel is gone — see the removal
  //     note in src/protocol.js. It existed for the case "the shim booted after the
  //     loader dispatched", which the nonce makes impossible: the loader has
  //     nothing to send until it has heard this script's boot event.
})();
