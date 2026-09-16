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
 * Every noise value is a pure function of (persona noise key, stable coordinates).
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
  // page is arrival order. It has to spend that advantage immediately: the four
  // primitives the handshake depends on are all page-patchable, and a page that
  // patched them could read the nonce out of a legitimate delivery and forge a
  // stand-down with it.
  //
  //   JSON.parse                      — could rewrite the payload it parses
  //   CustomEvent.prototype.detail    — could rewrite what `ev.detail` returns
  //   addEventListener / dispatchEvent — could drop or redirect our messages
  //   crypto.getRandomValues          — could make the nonce predictable
  //
  // Capturing them makes the ONLY way to beat the handshake winning the
  // document_start race — which is the same race that already decides whether
  // this shim protects anything (docs/THREAT-MODEL.md, "MAIN-world injection
  // race"). It does not close that race. Nothing in the page can.
  // ══════════════════════════════════════════════════════════════════════════
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
    getRandomValues: (() => {
      try {
        const c = globalThis.crypto;
        return c && typeof c.getRandomValues === 'function' ? c.getRandomValues.bind(c) : null;
      } catch (_) { return null; }
    })(),
  };

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

  function mintNonce() {
    if (!RAW.getRandomValues) return null;
    try {
      const bytes = new Uint8Array(NONCE_BYTES);
      RAW.getRandomValues(bytes);
      let out = '';
      for (let i = 0; i < bytes.length; i++) out += (bytes[i] + 0x100).toString(16).slice(1);
      return out.length === NONCE_BYTES * 2 ? out : null;
    } catch (_) { return null; }
  }

  /**
   * Length-independent, early-exit-free comparison. The page can dispatch as many
   * guesses as it likes (a wrong nonce deliberately does not consume the one-shot),
   * so it gets unlimited attempts at a timing oracle. 128 bits makes guessing
   * hopeless and this makes measuring pointless; neither costs anything.
   */
  function nonceMatches(candidate) {
    const expected = nonceBox.value;
    if (typeof expected !== 'string' || typeof candidate !== 'string') return false;
    if (candidate.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
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
      id: "macos-chrome-m2-air", weight: 22, platform: "MacIntel", os: "macos-14",
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
      id: "macos-chrome-m3-4k", weight: 16, platform: "MacIntel", os: "macos-14",
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
      id: "macos-chrome-intel-iris", weight: 8, platform: "MacIntel", os: "macos-14",
      ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      uaData: {"platform":"macOS","platformVersion":"14.6.0","architecture":"x86","bitness":"64","model":"","wow64":false},
      gpu: {
        vendor: "Google Inc. (Intel)",
        renderer: "ANGLE (Intel, ANGLE Metal Renderer: Intel(R) Iris(TM) Plus Graphics 645, Unspecified Version)",
        unmaskedVendor: "Google Inc. (Intel)", maxTextureSize: 16384,
      },
      cores: 8, memory: 16,
      screen: { width: 1440, height: 900, availHeight: 875, colorDepth: 24, dpr: 2 },
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

  const POOL_IDS = new Set(PERSONAS.map((p) => p.id));

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
    const v = String(value).toLowerCase();
    if (v.indexOf('win') >= 0) return 'win';
    if (v.indexOf('mac') >= 0 || v.indexOf('darwin') >= 0) return 'mac';
    if (v.indexOf('cros') >= 0 || v.indexOf('chrome os') >= 0) return 'linux';
    if (v.indexOf('linux') >= 0 || v.indexOf('x11') >= 0 || v.indexOf('bsd') >= 0) return 'linux';
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
    const of = (fam) => PERSONAS.filter((p) => familyFromPlatformString(p.platform) === fam);
    const list = of(HOST_FAMILY);
    return list.length ? list : of(DEFAULT_FAMILY);
  })();

  // FNV-1a / xorshift32 — byte-for-byte the same selection as src/personas.js, so
  // the fallback and the salted persona come from one pool with one algorithm.
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
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
    const total = HOST_POOL.reduce((a, p) => a + p.weight, 0);
    let roll = rand() * total;
    let chosen = HOST_POOL[HOST_POOL.length - 1];
    for (const p of HOST_POOL) { roll -= p.weight; if (roll <= 0) { chosen = p; break; } }
    const out = {};
    for (const k in chosen) out[k] = chosen[k];
    out.fontList = FONT_SETS[chosen.fonts];
    out.seed = seed;
    out.noise = { canvas: rand(), audio: rand(), webgl: rand() };
    return out;
  }

  /**
   * Registrable-domain key. Mirrors `siteKeyFor()` in background.js so the
   * fallback persona and the salted persona are keyed identically — otherwise the
   * "upgrade" would be a *different machine*, not the same one re-salted.
   * Same v0.1 approximation, same TODO(v0.2): use a real PSL.
   */
  const MULTI_LABEL_SUFFIXES = new Set(('co.uk|org.uk|ac.uk|gov.uk|net.uk|me.uk|ltd.uk|plc.uk|com.au|net.au|' +
    'org.au|edu.au|gov.au|id.au|co.nz|net.nz|org.nz|govt.nz|ac.nz|co.jp|ne.jp|or.jp|ac.jp|go.jp|ad.jp|com.br|' +
    'net.br|org.br|gov.br|co.in|net.in|org.in|gen.in|firm.in|com.cn|net.cn|org.cn|gov.cn|edu.cn|co.za|org.za|' +
    'net.za|gov.za|com.mx|com.ar|com.tr|com.sg|com.hk|com.tw|com.my|co.kr|or.kr|go.kr|github.io|gitlab.io|' +
    'pages.dev|workers.dev|netlify.app|vercel.app|herokuapp.com|web.app|firebaseapp.com|glitch.me|onrender.com|' +
    'surge.sh|neocities.org|blogspot.com|wordpress.com|tumblr.com|myshopify.com|s3.amazonaws.com|cloudfront.net|' +
    'azurewebsites.net|appspot.com').split('|'));

  function registrableDomain(hostname) {
    if (!hostname) return '';
    const host = String(hostname).toLowerCase().replace(/\.$/, '');
    const isIp = /^\[?[0-9a-f:.]+\]?$/i.test(host) && (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.indexOf(':') >= 0);
    if (isIp || host === 'localhost' || host.indexOf('.') < 0) return host;
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    const lastTwo = parts.slice(-2).join('.');
    const lastThree = parts.slice(-3).join('.');
    if (MULTI_LABEL_SUFFIXES.has(lastThree)) return parts.slice(-4).join('.');
    if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return lastThree;
    return lastTwo;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Mutable state. Every patch reads through this, so a persona upgrade is a
  //    pointer swap rather than a second round of patching.
  // ══════════════════════════════════════════════════════════════════════════

  const state = {
    persona: null,
    derived: null,
    reads: 0,          // the upgrade gate
    perApi: Object.create(null),
    handshakeDone: false,
    upgraded: false,
    standingDown: false,
    /** Persona payloads rejected for a bad/absent nonce. Non-zero = a page tried. */
    forged: 0,
    forgeryReported: false,
    dev: false,
    failures: [],
    internal: 0,       // >0 while the shim measures for itself; suppresses counting
  };

  /** APIs worth telling the service worker about. UA reads would drown the signal. */
  const REPORTABLE = new Set(['canvas', 'webgl', 'webgpu', 'audio', 'fonts']);

  function emit(name, obj) {
    try {
      // Pristine ctor + dispatcher (section 0a): a page that replaced either one
      // could otherwise swallow our reports, and the boot report carries the nonce.
      RAW.dispatchEvent.call(document, new RAW.CustomEvent(name, { detail: RAW.jsonStringify(obj) }));
    } catch (_) { /* a page that broke CustomEvent is not our problem to solve */ }
  }

  function fail(label, err) {
    state.failures.push({ label, error: String((err && err.stack) || err) });
    try {
      console.error(
        '[Nullecho] shim could NOT patch "' + label + '". That API is UNPROTECTED on this page. ' +
        'A silently-unpatched API is the worst outcome — please report this.', err
      );
    } catch (_) { /* console itself is patched or gone */ }
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
    if (!REPORTABLE.has(api)) return;
    // Bounded reporting: first read, then a coarsening schedule. 40 canvas reads in
    // one page is not a UI rendering; it is a repeated-sampling attack. We keep
    // returning the same value regardless — this only makes it visible to the user.
    if (n === 1 || n === 10 || n === 50 || n % 250 === 0) emit(EV_DETECT, { api, count: n });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Primitives: native-source masking, descriptor-preserving patching, PRF
  // ══════════════════════════════════════════════════════════════════════════

  const RESTORES = [];
  const NATIVE_SRC = new WeakMap();

  const objDefineProperty = Object.defineProperty;
  const objGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  const objGetPrototypeOf = Object.getPrototypeOf;

  /**
   * Requirement 1: `Function.prototype.toString` on a patched function must report
   * `[native code]`. Page scripts check this routinely — a wrapper whose source is
   * visible is a louder tell than the value it was hiding.
   *
   * We register the *exact* string Chrome would emit and consult a WeakMap from a
   * patched `Function.prototype.toString`. WeakMap, not a property, so the mapping
   * is not enumerable, not reachable, and not forgeable from the page.
   */
  function markNative(fn, name, model) {
    try {
      objDefineProperty(fn, 'name', { value: name, writable: false, enumerable: false, configurable: true });
      if (model) {
        objDefineProperty(fn, 'length', { value: model.length, writable: false, enumerable: false, configurable: true });
      }
    } catch (_) { /* name/length are best-effort; the toString mapping is the load-bearing part */ }
    NATIVE_SRC.set(fn, 'function ' + name + '() { [native code] }');
    return fn;
  }

  function patchFunctionToString(win) {
    const FP = win.Function.prototype;
    const d = objGetOwnPropertyDescriptor(FP, 'toString');
    if (!d || typeof d.value !== 'function') throw new Error('Function.prototype.toString missing');
    if (NATIVE_SRC.has(d.value)) return; // this realm is already done
    const orig = d.value;
    const replacement = function toString() {
      const src = NATIVE_SRC.get(this);
      if (src !== undefined) return src;
      return orig.call(this);
    };
    markNative(replacement, 'toString', orig);
    RESTORES.push({ target: FP, prop: 'toString', desc: d });
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
    if (!d) throw new Error('no own descriptor for "' + prop + '"');
    if (!d.get) throw new Error('"' + prop + '" is not an accessor');
    if (!d.configurable) throw new Error('"' + prop + '" is not configurable');
    const origGet = d.get;
    const getter = function () { return impl.call(this, origGet); };
    markNative(getter, 'get ' + prop, origGet);
    RESTORES.push({ target, prop, desc: d });
    objDefineProperty(target, prop, {
      get: getter, set: d.set, enumerable: d.enumerable, configurable: d.configurable,
    });
    return origGet;
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
   */
  function spoofGetter(target, prop, api, read) {
    return replaceGetter(target, prop, function (origGet) {
      const real = origGet.call(this);            // brand check + real value
      if (state.standingDown) return real;
      touch(api);
      return read.call(this, origGet, real);
    });
  }

  /** Replace a method, preserving `writable`/`enumerable`/`configurable`. */
  function replaceMethod(target, prop, factory) {
    const d = objGetOwnPropertyDescriptor(target, prop);
    if (!d || typeof d.value !== 'function') throw new Error('no method "' + prop + '"');
    if (!d.configurable) throw new Error('method "' + prop + '" is not configurable');
    const orig = d.value;
    const impl = factory(orig);
    markNative(impl, prop, orig);
    RESTORES.push({ target, prop, desc: d });
    objDefineProperty(target, prop, {
      value: impl, writable: d.writable, enumerable: d.enumerable, configurable: d.configurable,
    });
    return orig;
  }

  function restoreAll() {
    for (let i = RESTORES.length - 1; i >= 0; i--) {
      try { objDefineProperty(RESTORES[i].target, RESTORES[i].prop, RESTORES[i].desc); } catch (_) {}
    }
    RESTORES.length = 0;
  }

  // ── deterministic pseudo-random function ───────────────────────────────────
  // No state, no counter, no clock. prf(key, i) is the whole noise source.

  function fin32(x) {
    x = (x ^ (x >>> 16)) >>> 0;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x = (x ^ (x >>> 15)) >>> 0;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  }
  function prf(key, i) { return fin32((key ^ Math.imul((i + 1) | 0, 0x9e3779b1)) >>> 0); }
  function keyFromUnit(u) {
    const k = Math.floor((typeof u === 'number' ? u : 0.5) * 4294967296) >>> 0;
    return k || 0x9e3779b9;
  }
  function keyMix(key, a, b) { return fin32((fin32((key ^ Math.imul(a >>> 0, 0x85ebca6b)) >>> 0) ^ Math.imul(b >>> 0, 0xc2b2ae35)) >>> 0); }
  function keyStr(key, s) {
    let h = key >>> 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
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
  function brandsFor(ua) {
    const m = /Chrome\/([\d.]+)/.exec(ua || '');
    const full = (m && m[1]) || '151.0.0.0';
    const major = full.split('.')[0];
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
  const UNIFORM_GL_VENDOR = new Set(['WebKit', 'Mozilla']);
  const UNIFORM_GL_RENDERER = new Set(['WebKit WebGL', 'Mozilla']);

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
  function webgpuIdentity(gpu) {
    const r = (gpu && gpu.renderer) || '';
    if (/Apple/i.test(r)) return { vendor: 'apple', architecture: 'metal-3', subgroupMinSize: 32, subgroupMaxSize: 32 };
    if (/NVIDIA/i.test(r)) return { vendor: 'nvidia', architecture: 'ampere', subgroupMinSize: 32, subgroupMaxSize: 32 };
    if (/AMD|Radeon/i.test(r)) return { vendor: 'amd', architecture: 'gcn-5', subgroupMinSize: 32, subgroupMaxSize: 64 };
    if (/Intel/i.test(r)) return { vendor: 'intel', architecture: 'gen-9', subgroupMinSize: 8, subgroupMaxSize: 32 };
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

  function glExtensionDenyFor(persona) {
    const r = (persona.gpu && persona.gpu.renderer) || '';
    if (/Direct3D11|D3D11/i.test(r)) return new Set(GL_DENY_D3D11);
    if (/Mesa/i.test(r)) return new Set(GL_DENY_MESA);
    // Apple/Metal genuinely exposes ASTC, ETC and S3TC — nothing to strip.
    return new Set();
  }

  /** Features we allow through. We can only ever *remove*, never invent. */
  const WEBGPU_FEATURES_CORE = ['core-features-and-limits', 'depth-clip-control', 'depth32float-stencil8',
    'indirect-first-instance', 'rg11b10ufloat-renderable', 'shader-f16', 'float32-filterable',
    'bgra8unorm-storage', 'timestamp-query', 'texture-compression-bc'];
  const WEBGPU_FEATURES_APPLE = WEBGPU_FEATURES_CORE.concat(['texture-compression-etc2', 'texture-compression-astc']);

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
  const FONT_UNIVERSE_EXTRA = ('Bookman|Cantarell|Century Gothic|Courier|Helvetica Neue|Lucida Bright|Perpetua|' +
    'Roboto|SF Pro|SF Pro Display|SF Pro Text|Times|Apple Chancery|Apple Color Emoji|Apple SD Gothic Neo|' +
    'Segoe UI Variable|MS Sans Serif|MS Serif|Sitka Text|Yu Mincho|Meiryo|PingFang SC|Hiragino Sans').split('|');

  const KNOWN_SYSTEM_FONTS = new Set(
    FONT_SETS['windows-11'].concat(FONT_SETS['macos-14'], FONT_SETS['ubuntu-22'], FONT_UNIVERSE_EXTRA)
  );

  const GENERIC_FAMILIES = new Set(('serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|' +
    'ui-monospace|ui-rounded|math|emoji|fangsong|-apple-system|BlinkMacSystemFont|inherit|initial|unset|revert|' +
    'revert-layer|default').split('|'));

  function derive(persona) {
    const b = brandsFor(persona.ua);
    const scr = persona.screen || {};
    const noise = persona.noise || {};
    const gpu = persona.gpu || {};
    return {
      persona,
      ua: persona.ua,
      appVersion: String(persona.ua || '').replace(/^Mozilla\//, ''),
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
      webgpuFeatures: new Set(/Apple/i.test(gpu.renderer || '') ? WEBGPU_FEATURES_APPLE : WEBGPU_FEATURES_CORE),
      glExtensionDeny: glExtensionDenyFor(persona),
      fontList: persona.fontList || FONT_SETS[persona.fonts] || [],
      fontSet: new Set(persona.fontList || FONT_SETS[persona.fonts] || []),
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
   *  · Deterministic: the perturbation for a pixel depends only on the persona's
   *    canvas key, the canvas dimensions and the pixel's ABSOLUTE coordinates.
   *    Reading a sub-rectangle therefore yields the same bytes as reading the whole
   *    canvas — the two read paths cannot be differenced against each other.
   *  · Bounded: ±1 or ±2 on R/G/B only, roughly 1 pixel in 8. Never alpha, never
   *    geometry, never a coordinate. Charts, games and captchas still render.
   *  · Non-degenerate: if a perturbation would clamp (0 or 255) the sign flips, so
   *    a selected pixel always actually changes. Noise that silently no-ops on
   *    black and white areas would leave large flat regions un-noised.
   *
   * BLANK-CANVAS REALISM. A canvas that has never been drawn on reads back as all
   * zeros in every real browser, and a fingerprinter can check that in two lines —
   * so noising an untouched canvas would be a louder tell than the value it hides.
   * We therefore skip a region that contains no ink at all. But once a region does
   * contain ink we noise ALL of it, transparent margins included: an earlier
   * version skipped transparent pixels individually, and the harness's
   * `canvasPixels` probe — which hashes only the first 400 bytes, i.e. the blank
   * rows above the text — came back byte-identical to the unshimmed machine. Whole
   * regions, or nothing.
   *
   * NOTE: ARCHITECTURE.md phrases this as "±1-2 LSB on alpha". We perturb RGB and
   * leave alpha untouched instead — an alpha change alters compositing and can
   * accumulate across draws, whereas an RGB LSB change cannot. Alpha is also what
   * hit-testing code reads. Same entropy, less blast radius. Flagged so the doc and
   * the code can be reconciled deliberately.
   */
  function noiseRGBA(data, canvasW, key, ox, oy, w, h) {
    let hasInk = false;
    for (let p = 3; p < data.length; p += 4) { if (data[p] !== 0) { hasInk = true; break; } }
    if (!hasInk) return;
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

  /** Float audio noise: ≤8e-7 amplitude — below the 24-bit LSB, i.e. inaudible. */
  function noiseFloat(arr, key, count) {
    const n = count == null ? arr.length : count;
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

  const INSTALLED = new WeakSet();

  function installInto(win) {
    if (!win || INSTALLED.has(win)) return;
    INSTALLED.add(win);

    const doc = win.document;
    const D = () => state.derived;

    // ── Function.prototype.toString FIRST: everything patched after it must
    //    already be maskable, and it is itself a patched function.
    safe('Function.prototype.toString', () => patchFunctionToString(win));

    // ────────────────────────────────────────────────────────────────────────
    // NAVIGATOR
    // ────────────────────────────────────────────────────────────────────────
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
      spoofGetter(N, 'hardwareConcurrency', 'navigator', () => Math.max(4, D().cores | 0));
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
    safe('navigator.maxTouchPoints', () => {
      const N = ownerOf(win.navigator, 'maxTouchPoints');
      // Consistency, not entropy: the pool is entirely desktop machines. A non-zero
      // touch count next to a Win32/desktop persona is a free contradiction.
      spoofGetter(N, 'maxTouchPoints', 'navigator', () => 0);
    });
    safe('navigator.languages', () => {
      const N = ownerOf(win.navigator, 'languages');
      // en-US/en is the single largest crowd and matches the personas' regions. NOT
      // persona-derived: personas.js has no locale field, and a locale that
      // disagrees with the timezone (which we leave real, see TIMEZONE) is worse
      // than one that agrees with most of the planet's English-speaking traffic.
      spoofGetter(N, 'languages', 'navigator', () => Object.freeze(['en-US', 'en']));
    });
    safe('navigator.language', () => {
      const N = ownerOf(win.navigator, 'language');
      spoofGetter(N, 'language', 'navigator', () => 'en-US');
    });

    // navigator.userAgentData — patch NavigatorUAData.prototype rather than
    // substituting a fake object, so the object keeps its real class and passes
    // `Object.prototype.toString.call()` / instanceof checks.
    safe('navigator.userAgentData', () => {
      const UAD = win.NavigatorUAData;
      if (!UAD || !UAD.prototype) return; // not a Chromium build
      const P = UAD.prototype;

      spoofGetter(P, 'brands', 'navigator', () => D().brands.map((b) => Object.freeze({ ...b })));
      spoofGetter(P, 'mobile', 'navigator', () => false);
      spoofGetter(P, 'platform', 'navigator', () => D().uaData.platform || '');

      // `instanceof` stands in for the native brand check on these two: unlike an
      // accessor we cannot cheaply delegate (getHighEntropyValues does real async
      // work), but a replacement that answers for `{}` is a free shim detector.
      const brandCheck = (self) => {
        if (!(self instanceof UAD)) throw new win.TypeError('Illegal invocation');
      };

      replaceMethod(P, 'toJSON', (orig) => function toJSON() {
        brandCheck(this);
        if (state.standingDown) return orig.apply(this, arguments);
        touch('navigator');
        const d = D();
        return { brands: d.brands.map((b) => ({ ...b })), mobile: false, platform: d.uaData.platform || '' };
      });

      replaceMethod(P, 'getHighEntropyValues', (orig) => function getHighEntropyValues(hints) {
        brandCheck(this);
        if (state.standingDown) return orig.apply(this, arguments);
        touch('navigator');
        const d = D();
        // Chrome always includes the low-entropy trio, then whatever was asked for.
        const out = {
          brands: d.brands.map((b) => ({ ...b })),
          mobile: false,
          platform: d.uaData.platform || '',
        };
        const want = new Set(Array.isArray(hints) ? hints : []);
        if (want.has('architecture')) out.architecture = d.uaData.architecture || '';
        if (want.has('bitness')) out.bitness = d.uaData.bitness || '';
        if (want.has('model')) out.model = d.uaData.model || '';
        if (want.has('platformVersion')) out.platformVersion = d.uaData.platformVersion || '';
        if (want.has('uaFullVersion')) out.uaFullVersion = d.uaFullVersion;
        if (want.has('fullVersionList')) out.fullVersionList = d.fullVersionList.map((b) => ({ ...b }));
        if (want.has('wow64')) out.wow64 = !!d.uaData.wow64;
        if (want.has('formFactors')) out.formFactors = ['Desktop'];
        return win.Promise.resolve(out);
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
    const Ctx2D = win.CanvasRenderingContext2D;
    const OffCtx2D = win.OffscreenCanvasRenderingContext2D;

    const origGetImageData = Ctx2D && Ctx2D.prototype.getImageData;
    const origPutImageData = Ctx2D && Ctx2D.prototype.putImageData;
    const origDrawImage = Ctx2D && Ctx2D.prototype.drawImage;

    function canvasKeyFor(w, h) { return keyMix(D().canvasKey, w, h); }

    /**
     * Produce a same-size canvas holding the noised pixels of `src`. `drawImage`
     * between canvases is an exact premultiplied blit, so the copy itself is
     * lossless; only the putImageData round-trip can shift a semi-transparent
     * pixel by ±1, and that shift is deterministic too.
     * Returns null when noising is impossible (zero-size, or a tainted canvas —
     * in which case the original call will throw SecurityError exactly as native).
     */
    function noisedCopy(src) {
      const w = src.width | 0, h = src.height | 0;
      if (!w || !h) return null;
      const tmp = doc.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d', { willReadFrequently: true });
      if (!tctx) return null;
      origDrawImage.call(tctx, src, 0, 0);
      const img = origGetImageData.call(tctx, 0, 0, w, h);
      noiseRGBA(img.data, w, canvasKeyFor(w, h), 0, 0, w, h);
      origPutImageData.call(tctx, img, 0, 0);
      return tmp;
    }

    function patchGetImageData(proto, label) {
      replaceMethod(proto, 'getImageData', (orig) => function getImageData(sx, sy) {
        const img = orig.apply(this, arguments);
        if (state.standingDown) return img;
        touch('canvas');
        try {
          const cv = this.canvas;
          const cw = cv ? cv.width | 0 : img.width;
          const ch = cv ? cv.height | 0 : img.height;
          // sw/sh may be negative; the real origin is the top-left of the rect.
          const x = (sx | 0), y = (sy | 0);
          const sw = arguments.length > 2 ? (arguments[2] | 0) : img.width;
          const sh = arguments.length > 3 ? (arguments[3] | 0) : img.height;
          const ox = sw < 0 ? x + sw : x;
          const oy = sh < 0 ? y + sh : y;
          noiseRGBA(img.data, cw, canvasKeyFor(cw, ch), ox, oy, img.width, img.height);
        } catch (err) { fail(label, err); }
        return img;
      });
    }

    safe('canvas.getImageData', () => patchGetImageData(Ctx2D.prototype, 'canvas.getImageData'));
    safe('offscreenCanvas.getImageData', () => {
      if (!OffCtx2D || !OffCtx2D.prototype) return;
      patchGetImageData(OffCtx2D.prototype, 'offscreenCanvas.getImageData');
    });

    safe('canvas.toDataURL', () => {
      replaceMethod(win.HTMLCanvasElement.prototype, 'toDataURL', (orig) => function toDataURL() {
        if (state.standingDown) return orig.apply(this, arguments);
        touch('canvas');
        let tmp = null;
        try { tmp = noisedCopy(this); }
        catch (err) { if (!err || err.name !== 'SecurityError') fail('canvas.toDataURL', err); }
        return orig.apply(tmp || this, arguments);
      });
    });

    safe('canvas.toBlob', () => {
      replaceMethod(win.HTMLCanvasElement.prototype, 'toBlob', (orig) => function toBlob() {
        if (state.standingDown) return orig.apply(this, arguments);
        touch('canvas');
        let tmp = null;
        try { tmp = noisedCopy(this); }
        catch (err) { if (!err || err.name !== 'SecurityError') fail('canvas.toBlob', err); }
        return orig.apply(tmp || this, arguments);
      });
    });

    safe('offscreenCanvas.convertToBlob', () => {
      const OC = win.OffscreenCanvas;
      if (!OC || !OC.prototype || !OC.prototype.convertToBlob) return;
      replaceMethod(OC.prototype, 'convertToBlob', (orig) => function convertToBlob() {
        if (state.standingDown) return orig.apply(this, arguments);
        touch('canvas');
        let tmp = null;
        try {
          const w = this.width | 0, h = this.height | 0;
          if (w && h) {
            tmp = new OC(w, h);
            const tctx = tmp.getContext('2d');
            if (tctx) {
              tctx.drawImage(this, 0, 0);
              const img = origGetImageData.call(tctx, 0, 0, w, h);
              noiseRGBA(img.data, w, canvasKeyFor(w, h), 0, 0, w, h);
              origPutImageData.call(tctx, img, 0, 0);
            } else { tmp = null; }
          }
        } catch (err) { if (!err || err.name !== 'SecurityError') fail('offscreenCanvas.convertToBlob', err); tmp = null; }
        return orig.apply(tmp || this, arguments);
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
        // Illegal invocation exactly as it would unpatched.
        const real = orig.apply(this, arguments);
        if (state.standingDown) return real;
        touch('webgl');
        const d = D();
        const gpu = d.gpu;
        switch (pname) {
          case GL.UNMASKED_VENDOR_WEBGL: return gpu.unmaskedVendor || gpu.vendor;
          case GL.UNMASKED_RENDERER_WEBGL: return gpu.renderer;
          case GL.VENDOR:
            return UNIFORM_GL_VENDOR.has(real) ? real : gpu.vendor;
          case GL.RENDERER:
            return UNIFORM_GL_RENDERER.has(real) ? real : gpu.renderer;
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
            const n = gpu.maxTextureSize || 16384;
            return new win.Int32Array([n, n]);
          }
          case GL.ALIASED_LINE_WIDTH_RANGE:
            return new win.Float32Array([1, 1]); // universal on ANGLE; every persona is ANGLE
          default:
            return real;
        }
      });

      replaceMethod(P, 'getSupportedExtensions', (orig) => function getSupportedExtensions() {
        const real = orig.apply(this, arguments);
        if (state.standingDown || !real) return real;
        touch('webgl');
        const deny = D().glExtensionDeny;
        if (!deny.size) return real;
        return real.filter((e) => !deny.has(String(e).toLowerCase()));
      });

      replaceMethod(P, 'getExtension', (orig) => function getExtension(name) {
        // Delegate first: brand check, and the real object for the allowed case.
        const real = orig.apply(this, arguments);
        if (state.standingDown) return real;
        touch('webgl');
        return D().glExtensionDeny.has(String(name).toLowerCase()) ? null : real;
      });

      replaceMethod(P, 'readPixels', (orig) => function readPixels(x, y, width, height, format) {
        const r = orig.apply(this, arguments);
        if (state.standingDown) return r;
        touch('webgl');
        try {
          const pixels = arguments[6];
          const dstOffset = arguments.length > 7 ? (arguments[7] | 0) : 0;
          // Only the 8-bit RGBA path — the one fingerprinters use. Float/half-float
          // reads are left alone rather than corrupted with a wrongly-scaled delta.
          if (format === GL.RGBA && ArrayBuffer.isView(pixels) && pixels.BYTES_PER_ELEMENT === 1) {
            const w = width | 0, h = height | 0;
            const key = keyMix(D().webglKey, w, h);
            // Same blank-buffer rule as the canvas kernel: never invent content in
            // a read that came back entirely empty.
            let hasInk = false;
            for (let p = dstOffset + 3; p < pixels.length; p += 4) { if (pixels[p] !== 0) { hasInk = true; break; } }
            if (!hasInk) return r;
            for (let row = 0; row < h; row++) {
              for (let col = 0; col < w; col++) {
                const abs = (y + row) * 4096 + (x + col); // stable virtual coords
                const hh = prf(key, abs);
                if ((hh & 7) !== 0) continue;
                const p = dstOffset + (row * w + col) * 4;
                if (p + 3 >= pixels.length) continue;
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
      for (const k of ['vendor', 'architecture']) {
        if (objGetOwnPropertyDescriptor(P, k)) spoofGetter(P, k, 'webgpu', pick(k));
      }
      // Empty on stock Chrome without the developer-features flag — that IS the crowd value.
      for (const k of ['device', 'description']) {
        if (objGetOwnPropertyDescriptor(P, k)) spoofGetter(P, k, 'webgpu', () => '');
      }
      for (const k of ['subgroupMinSize', 'subgroupMaxSize']) {
        if (objGetOwnPropertyDescriptor(P, k)) spoofGetter(P, k, 'webgpu', pick(k));
      }
    });

    safe('webgpu.limits', () => {
      const SL = win.GPUSupportedLimits;
      if (!SL || !SL.prototype) return;
      const P = SL.prototype;
      for (const prop of Object.getOwnPropertyNames(P)) {
        if (prop === 'constructor') continue;
        const cap = WEBGPU_DEFAULT_LIMITS[prop];
        if (cap === undefined) continue; // unknown/new limit: pass through (documented gap)
        const isMin = prop.indexOf('min') === 0;
        const d = objGetOwnPropertyDescriptor(P, prop);
        if (!d || !d.get) continue;
        replaceGetter(P, prop, function (origGet) {
          const real = origGet.call(this);
          if (state.standingDown || typeof real !== 'number') return real;
          touch('webgpu');
          return isMin ? Math.max(real, cap) : Math.min(real, cap);
        });
      }
    });

    safe('webgpu.features', () => {
      const SF = win.GPUSupportedFeatures;
      if (!SF || !SF.prototype) return;
      const P = SF.prototype;
      const origValues = P.values;
      const origSize = objGetOwnPropertyDescriptor(P, 'size');
      if (typeof origValues !== 'function' || !origSize || !origSize.get) return;

      const views = new WeakMap();
      function view(self) {
        let v = views.get(self);
        if (!v) {
          v = [];
          const allow = D().webgpuFeatures;
          // We can only ever remove. Nothing is invented, so `requestDevice()`
          // validation (which runs against the REAL adapter) can never be surprised.
          for (const f of origValues.call(self)) if (allow.has(f)) v.push(f);
          views.set(self, v);
        }
        return v;
      }

      replaceGetter(P, 'size', function (origGet) {
        if (state.standingDown) return origGet.call(this);
        touch('webgpu');
        return view(this).length;
      });
      replaceMethod(P, 'has', (orig) => function has(f) {
        if (state.standingDown) return orig.apply(this, arguments);
        touch('webgpu');
        return view(this).indexOf(String(f)) >= 0;
      });
      for (const m of ['values', 'keys']) {
        if (!objGetOwnPropertyDescriptor(P, m)) continue;
        replaceMethod(P, m, (orig) => function () {
          if (state.standingDown) return orig.apply(this, arguments);
          touch('webgpu');
          return view(this)[Symbol.iterator]();
        });
      }
      if (objGetOwnPropertyDescriptor(P, 'entries')) {
        replaceMethod(P, 'entries', (orig) => function entries() {
          if (state.standingDown) return orig.apply(this, arguments);
          touch('webgpu');
          return view(this).map((f) => [f, f])[Symbol.iterator]();
        });
      }
      if (objGetOwnPropertyDescriptor(P, 'forEach')) {
        replaceMethod(P, 'forEach', (orig) => function forEach(cb, thisArg) {
          if (state.standingDown) return orig.apply(this, arguments);
          touch('webgpu');
          for (const f of view(this)) cb.call(thisArg, f, f, this);
        });
      }
      if (objGetOwnPropertyDescriptor(P, Symbol.iterator)) {
        const d = objGetOwnPropertyDescriptor(P, Symbol.iterator);
        const origIter = d.value;
        const impl = function () {
          if (state.standingDown) return origIter.apply(this, arguments);
          touch('webgpu');
          return view(this)[Symbol.iterator]();
        };
        markNative(impl, '[Symbol.iterator]', origIter);
        RESTORES.push({ target: P, prop: Symbol.iterator, desc: d });
        objDefineProperty(P, Symbol.iterator, {
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
        if (state.standingDown) return orig.apply(this, arguments);
        touch('webgpu');
        const p = orig.apply(this, arguments);
        if (!p || typeof p.then !== 'function') return p;
        return p.then((adapter) => {
          try {
            if (adapter && !win.GPUAdapterInfo) {
              const info = adapter.info;
              if (info) {
                const w = D().webgpu;
                for (const k of ['vendor', 'architecture', 'device', 'description']) {
                  const val = k === 'device' || k === 'description' ? '' : w[k];
                  objDefineProperty(info, k, { value: val, enumerable: true, configurable: true });
                }
              }
            }
          } catch (err) { fail('webgpu.requestAdapter.info', err); }
          return adapter;
        });
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
    const noisedChannels = new WeakMap();

    function ensureChannelNoised(buffer, channel, arr) {
      let seen = noisedChannels.get(buffer);
      if (!seen) { seen = new Set(); noisedChannels.set(buffer, seen); }
      if (seen.has(channel)) return;
      seen.add(channel);
      noiseFloat(arr, keyMix(D().audioKey, channel, buffer.length | 0));
    }

    safe('AudioBuffer.getChannelData', () => {
      const AB = win.AudioBuffer;
      if (!AB || !AB.prototype) return;
      replaceMethod(AB.prototype, 'getChannelData', (orig) => function getChannelData(channel) {
        const arr = orig.apply(this, arguments);
        if (state.standingDown) return arr;
        touch('audio');
        try { ensureChannelNoised(this, channel | 0, arr); } catch (err) { fail('AudioBuffer.getChannelData', err); }
        return arr;
      });
      if (AB.prototype.copyFromChannel) {
        const origGet = AB.prototype.getChannelData; // already patched → guarded by the Set
        replaceMethod(AB.prototype, 'copyFromChannel', (orig) => function copyFromChannel(dest, channelNumber) {
          if (!state.standingDown) {
            touch('audio');
            try {
              state.internal++;
              try { ensureChannelNoised(this, channelNumber | 0, origGet.call(this, channelNumber)); }
              finally { state.internal--; }
            } catch (err) { fail('AudioBuffer.copyFromChannel', err); }
          }
          return orig.apply(this, arguments);
        });
      }
    });

    safe('AnalyserNode frequency data', () => {
      const AN = win.AnalyserNode;
      if (!AN || !AN.prototype) return;

      replaceMethod(AN.prototype, 'getFloatFrequencyData', (orig) => function getFloatFrequencyData(array) {
        orig.apply(this, arguments);
        if (state.standingDown) return;
        touch('audio');
        try {
          // dB values, typically -100..0. ±1e-4 dB is far below anything audible or
          // visible in a spectrum display, and is stable per bin.
          const key = keyMix(D().audioKey, this.fftSize | 0, array.length | 0);
          for (let i = 0; i < array.length; i++) {
            const hh = prf(key, i);
            if ((hh & 3) !== 0) continue;
            const mag = (1 + ((hh >>> 4) & 3)) * 1e-4;
            array[i] += (hh >>> 3) & 1 ? mag : -mag;
          }
        } catch (err) { fail('AnalyserNode.getFloatFrequencyData', err); }
      });

      replaceMethod(AN.prototype, 'getByteFrequencyData', (orig) => function getByteFrequencyData(array) {
        orig.apply(this, arguments);
        if (state.standingDown) return;
        touch('audio');
        try {
          const key = keyMix(D().audioKey, this.fftSize | 0, array.length | 0);
          for (let i = 0; i < array.length; i++) {
            const hh = prf(key, i);
            if ((hh & 7) !== 0) continue;
            const v = array[i];
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
    function isGeneric(n) { return GENERIC_FAMILIES.has(n) || GENERIC_FAMILIES.has(n.toLowerCase()); }
    function cssFamily(n) { return isGeneric(n) ? n : '"' + n.replace(/"/g, '') + '"'; }

    function parseFamilyList(css) {
      const out = [];
      let cur = '', q = null;
      for (let i = 0; i < css.length; i++) {
        const ch = css[i];
        if (q) { if (ch === q) q = null; else cur += ch; }
        else if (ch === '"' || ch === "'") q = ch;
        else if (ch === ',') { if (cur.trim()) out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      if (cur.trim()) out.push(cur.trim());
      return out;
    }

    // Web fonts registered through @font-face or the FontFace API. Recomputed only
    // when the set size changes, so this is cheap on steady-state pages.
    let webFontCache = null, webFontCount = -1;
    function webFontFamilies() {
      try {
        const fs = doc.fonts;
        if (!fs) return null;
        if (webFontCache && fs.size === webFontCount) return webFontCache;
        const s = new Set();
        fs.forEach((ff) => { if (ff && ff.family) s.add(String(ff.family).replace(/^["']|["']$/g, '')); });
        webFontCache = s; webFontCount = fs.size;
        return s;
      } catch (_) { return null; }
    }

    function planFamilies(families) {
      const wf = webFontFamilies();
      const kept = [];
      let dropped = false;
      for (const f of families) {
        if (isGeneric(f)) { kept.push(f); continue; }
        if (wf && wf.has(f)) { kept.push(f); continue; }       // page's own web font — untouchable
        if (!KNOWN_SYSTEM_FONTS.has(f)) { kept.push(f); continue; } // outside our universe — gap G3
        if (D().fontSet.has(f)) { kept.push(f); continue; }    // the persona has it
        dropped = true;                                        // known system font the persona lacks
      }
      // Whichever family actually gets used is the first non-generic survivor.
      let claimed = null;
      for (const f of kept) {
        if (isGeneric(f)) continue;
        if (D().fontSet.has(f) && !(wf && wf.has(f))) claimed = f;
        break;
      }
      return { kept, claimed, dropped };
    }

    let measuring = false;

    function measureWithFamily(el, familyCss, origGet) {
      const style = el.style;
      const prev = style.getPropertyValue('font-family');
      const prio = style.getPropertyPriority('font-family');
      measuring = true;
      state.internal++;
      try {
        style.setProperty('font-family', familyCss, 'important');
        return origGet.call(el);
      } finally {
        if (prev) style.setProperty('font-family', prev, prio);
        else style.removeProperty('font-family');
        state.internal--;
        measuring = false;
      }
    }

    /** Bounded, deterministic, and never large enough to wreck a layout. */
    function presenceDelta(family, prop, base, fontSize) {
      const h = keyStr(D().fontKey, family + '|' + prop + '|' + fontSize);
      const cap = Math.max(1, Math.min(6, Math.round(Math.abs(base) * 0.03)));
      const d = 1 + (h % cap);
      return ((h >>> 8) & 1) && base - d > 0 ? -d : d;
    }

    const metricCache = new WeakMap();

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
      if (state.standingDown || measuring) return origGet.call(el);
      // Cheap structural gates first — these keep the shim off the hot path that
      // real layout code uses (containers, long text, detached nodes).
      if (!el || el.nodeType !== 1 || el.childElementCount !== 0) return origGet.call(el);
      const text = el.textContent;
      if (!text || text.length === 0 || text.length > 128) return origGet.call(el);
      if (!el.isConnected) return origGet.call(el);

      const cs = win.getComputedStyle(el);
      const famCss = cs && cs.fontFamily;
      if (!famCss) return origGet.call(el);

      const families = parseFamilyList(famCss);
      if (families.length === 0) return origGet.call(el);
      const plan = planFamilies(families);
      if (!plan.dropped && !plan.claimed) return origGet.call(el); // nothing to decide

      touch('fonts');

      const parentW = el.parentElement ? el.parentElement.clientWidth : -1;
      const key = (cacheTag || prop) + '|' + famCss + '|' + cs.fontSize + '|' + cs.fontWeight + '|' +
        cs.fontStyle + '|' + cs.letterSpacing + '|' + parentW + '|' + text;
      let cache = metricCache.get(el);
      if (cache && cache.has(key)) return cache.get(key);

      const keptCss = plan.kept.map(cssFamily).join(',') || 'sans-serif';
      const base = measureWithFamily(el, keptCss, origGet);
      let result = base;

      if (plan.claimed) {
        const genericCss = plan.kept.filter(isGeneric).map(cssFamily).join(',') || 'sans-serif';
        const fallback = measureWithFamily(el, genericCss, origGet);
        // base === fallback ⇒ the claimed font is not really installed here, so the
        // persona's claim needs synthesising. Otherwise the real metric already
        // says "present" and we return it verbatim.
        if (base === fallback) result = base + presenceDelta(plan.claimed, prop, base, cs.fontSize);
      }

      if (!cache) { cache = new Map(); metricCache.set(el, cache); }
      if (cache.size > 64) cache.clear();
      cache.set(key, result);
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
        const r = orig.apply(this, arguments);
        if (state.standingDown || measuring) return r;
        try {
          // Scoped to HTMLElement to bound the blast radius; SVG text metrics are a
          // documented gap (G3) rather than something we half-cover here.
          if (!(this instanceof win.HTMLElement)) return r;
          const widthOf = function () { return orig.call(this).width; };
          const heightOf = function () { return orig.call(this).height; };
          const adjW = fontMetric(this, 'offsetWidth', widthOf, 'rectWidth');
          const adjH = fontMetric(this, 'offsetHeight', heightOf, 'rectHeight');
          if (adjW === r.width && adjH === r.height) return r;
          return new win.DOMRect(r.x, r.y, adjW, adjH);
        } catch (err) { fail('Element.getBoundingClientRect', err); return r; }
      });
    });

    // measureText: same logic, but the fallback can be measured exactly by
    // re-running the native call with a rewritten font shorthand — no DOM involved.
    safe('CanvasRenderingContext2D.measureText', () => {
      const TM = win.TextMetrics;
      const adjust = new WeakMap();
      if (TM && TM.prototype) {
        for (const p of ['width', 'actualBoundingBoxLeft', 'actualBoundingBoxRight']) {
          if (!objGetOwnPropertyDescriptor(TM.prototype, p)) continue;
          replaceGetter(TM.prototype, p, function (origGet) {
            const real = origGet.call(this);
            const a = adjust.get(this);
            return (!state.standingDown && a && typeof real === 'number') ? real * a : real;
          });
        }
      }

      const FONT_SHORTHAND =
        /^\s*(.*?)((?:\d*\.?\d+)(?:px|pt|pc|in|cm|mm|q|em|rem|ex|ch|vw|vh|vmin|vmax|%)(?:\s*\/\s*\S+)?)\s+(.+)$/i;

      const patch = (proto) => replaceMethod(proto, 'measureText', (orig) => function measureText() {
        if (state.standingDown) return orig.apply(this, arguments);
        let m;
        try {
          const parsed = FONT_SHORTHAND.exec(this.font || '');
          if (!parsed) return orig.apply(this, arguments);
          const plan = planFamilies(parseFamilyList(parsed[3]));
          if (!plan.dropped && !plan.claimed) return orig.apply(this, arguments);

          touch('fonts');
          const prefix = parsed[1] + parsed[2] + ' ';
          const saved = this.font;
          state.internal++;
          try {
            this.font = prefix + (plan.kept.map(cssFamily).join(',') || 'sans-serif');
            m = orig.apply(this, arguments);
            if (plan.claimed) {
              const w1 = m.width;
              this.font = prefix + (plan.kept.filter(isGeneric).map(cssFamily).join(',') || 'sans-serif');
              const w2 = orig.apply(this, arguments).width;
              if (w1 === w2 && TM && TM.prototype) {
                const h = keyStr(D().fontKey, plan.claimed + '|measureText|' + parsed[2]);
                adjust.set(m, 1 + (((h % 25) + 5) / 1000) * ((h >>> 8) & 1 ? -1 : 1)); // ±0.5%..3%
              }
            }
          } finally {
            this.font = saved;
            state.internal--;
          }
        } catch (err) {
          fail('CanvasRenderingContext2D.measureText', err);
          return orig.apply(this, arguments);
        }
        return m;
      });

      patch(Ctx2D.prototype);
      if (OffCtx2D && OffCtx2D.prototype && objGetOwnPropertyDescriptor(OffCtx2D.prototype, 'measureText')) {
        patch(OffCtx2D.prototype);
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
      const hook = (prop, toWindow) => {
        if (!objGetOwnPropertyDescriptor(P, prop)) return;
        replaceGetter(P, prop, function (origGet) {
          const v = origGet.call(this);
          if (!state.standingDown) {
            try { const w = toWindow(v); if (w) installInto(w); }
            catch (_) { /* cross-origin: nothing to patch and nothing to leak */ }
          }
          return v;
        });
      };
      hook('contentWindow', (w) => w);
      hook('contentDocument', (d) => (d ? d.defaultView : null));

      // `window[0]` / `window.frames[0]` reach the same realm WITHOUT going through
      // `contentWindow`, and those are live indexed properties on the WindowProxy
      // that cannot be intercepted. So we also install as frames are inserted.
      //
      // HONEST LIMIT: a MutationObserver callback runs at the next microtask
      // checkpoint, so a script that appends an iframe and reads `window[0]` in the
      // SAME synchronous block still touches a pristine realm and sees the real
      // machine. Narrow, but real, and it is a genuine bypass rather than a
      // theoretical one. Closing it properly needs the browser to run our content
      // script in every child realm.
      try {
        const obs = new win.MutationObserver((records) => {
          if (state.standingDown) return;
          for (const rec of records) {
            for (const node of rec.addedNodes) {
              try {
                if (node && node.tagName === 'IFRAME') installInto(node.contentWindow);
                else if (node && node.querySelectorAll) {
                  for (const f of node.querySelectorAll('iframe')) installInto(f.contentWindow);
                }
              } catch (_) { /* cross-origin */ }
            }
          }
        });
        obs.observe(doc, { childList: true, subtree: true });
      } catch (err) { fail('iframe insertion observer', err); }
    });

  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Self-tests. Requirement 2: prove determinism rather than assert it.
  // ══════════════════════════════════════════════════════════════════════════

  function cheapHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }

  /**
   * 50 consecutive canvas reads must produce ONE hash. If this ever reports more
   * than one, the noise has become per-read and the averaging attack works again.
   */
  function selfTest(iterations) {
    const n = iterations || 50;
    const out = { reads: n, toDataURL: null, getImageData: null, stable: false, unique: 0 };
    state.internal++;
    try {
      const urls = new Set(), pixels = new Set();
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
        urls.add(cheapHash(c.toDataURL()));
        pixels.add(cheapHash(Array.prototype.join.call(ctx.getImageData(0, 0, 220, 44).data, ',')));
      }
      out.toDataURL = { unique: urls.size, hash: urls.values().next().value };
      out.getImageData = { unique: pixels.size, hash: pixels.values().next().value };
      out.unique = Math.max(urls.size, pixels.size);
      out.stable = urls.size === 1 && pixels.size === 1;
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
    try { raw = RAW.detailGet ? RAW.detailGet.call(ev) : ev.detail; }
    catch (_) { return null; }
    return typeof raw === 'string' ? raw : null;
  }

  function onPersonaEvent(ev) {
    handleHandshake(detailOf(ev));
  }

  function status(obj) { emit(EV_STATUS, obj); }

  function validPersona(p) {
    return !!(p && typeof p.ua === 'string' && p.platform && p.gpu && p.screen &&
      Array.isArray(p.fontList) && p.noise && typeof p.noise.canvas === 'number');
  }

  function handleHandshake(json) {
    if (state.handshakeDone) return;               // exactly one, ever

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
    if (!payload || typeof payload !== 'object' || !nonceMatches(payload.nonce)) {
      state.forged++;
      if (!state.forgeryReported) {
        state.forgeryReported = true;
        status({
          upgraded: false,
          lockedToFallback: false,
          reason: nonceBox.value ? 'forged-handshake-rejected' : 'no-csprng-handshake-refused',
        });
        try {
          console.warn(
            '[Nullecho] Ignored a persona handshake that did not carry this page\'s ' +
            'boot nonce. Either something on this page is impersonating the ' +
            'extension, or Nullecho lost the document_start race here. Protection ' +
            'stays ON either way.'
          );
        } catch (_) { /* console is the page's */ }
      }
      return;
    }

    state.handshakeDone = true;
    nonceBox.value = null;                         // used once; no replay value
    try { removeListeners(); } catch (_) {}

    if (payload.ok !== true) {
      status({ upgraded: false, lockedToFallback: false, reason: (payload && payload.reason) || 'handshake failed' });
      return;
    }

    if (payload.dev === true) installDevSurface();

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
    if (payload.enabled === false) {
      state.standingDown = true;
      restoreAll();
      status({ upgraded: false, lockedToFallback: false, reason: 'allowlisted' });
      return;
    }

    if (!validPersona(payload.persona)) {
      fail('persona handshake', new Error('malformed persona payload; staying on the fallback'));
      status({ upgraded: false, lockedToFallback: true, reason: 'malformed-persona' });
      return;
    }

    if (!POOL_IDS.has(payload.persona.id)) {
      // Not fatal — the delivered persona is authoritative — but it means the
      // inlined mirror (gap G7) has drifted from src/personas.js.
      console.warn('[Nullecho] persona id "' + payload.persona.id + '" is not in the shim\'s inlined pool. ' +
        'src/shim.js and src/personas.js have drifted — regenerate the mirror.');
    }

    // THE GATE. Swapping personas after a read would mix fields from two machines,
    // which DECISIONS.md D2 identifies as worse than no defense at all.
    if (state.reads > 0) {
      status({ upgraded: false, lockedToFallback: true, reason: 'api-read-before-handshake' });
      return;
    }

    state.persona = payload.persona;
    state.derived = derive(payload.persona);
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
        value: Object.freeze({
          version: '0.1.0',
          get personaId() { return state.persona && state.persona.id; },
          get persona() { return state.persona; },
          get upgraded() { return state.upgraded; },
          get standingDown() { return state.standingDown; },
          /** Persona payloads rejected for a bad nonce. Non-zero = a page tried. */
          get forged() { return state.forged; },
          get reads() { return state.reads; },
          get perApi() { return { ...state.perApi }; },
          get failures() { return state.failures.slice(); },
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
    for (const t of [globalThis, document]) {
      if (!t || !RAW.addEventListener) continue;
      try { RAW.addEventListener.call(t, EV_PERSONA, onPersonaEvent, true); LISTEN_TARGETS.push(t); }
      catch (_) { /* not an EventTarget in this realm */ }
    }
  }

  function removeListeners() {
    for (const t of LISTEN_TARGETS) {
      try { RAW.removeEventListener.call(t, EV_PERSONA, onPersonaEvent, true); } catch (_) {}
    }
    LISTEN_TARGETS.length = 0;
  }

  addListeners();

  // (b) Tell the loader we exist, and hand it the nonce. Its absence is how the
  //     loader detects a failed injection; the nonce is how this script tells a
  //     real reply from a page's impersonation of one. This dispatch is the first
  //     thing about Nullecho that is observable from the page — and at
  //     document_start there is nothing on the page yet to observe it.
  status({ phase: BOOT_PHASE, channel: CHANNEL, nonce: nonceBox.value });

  if (!nonceBox.value) {
    // No CSPRNG: we cannot authenticate anything, so we will accept nothing. Say
    // so rather than silently never upgrading.
    try {
      console.error(
        '[Nullecho] No crypto.getRandomValues in this realm, so the persona ' +
        'handshake cannot be authenticated. Staying on the fallback persona for ' +
        'this page and refusing every handshake, including a genuine one.'
      );
    } catch (_) { /* console is the page's */ }
  }

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
      const siteKey = registrableDomain(location.hostname) || location.origin || 'opaque';
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
