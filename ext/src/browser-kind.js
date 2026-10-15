/**
 * Nullecho — which browser the extension's own pages are running in, and the
 * few sentences that have to differ between them. 0.9.2 (DECISIONS.md D53).
 *
 * The same package runs in Chrome, Microsoft Edge (the Chrome zip, unchanged)
 * and Firefox (manifest.firefox.json). Until 0.9.2 the popup and the options
 * page said "Chrome" where they might be running in Edge, and told a Firefox
 * user "On Firefox or Brave, their built-in protections are stronger" as if they
 * were somewhere else. Edge Add-ons policy 1.1.2 also says an extension "must not
 * reference other browsers".
 *
 * So the STATIC text in popup.html / options.html is the browser-neutral version
 * (true everywhere, names no browser), and the pages swap in the Chrome or the
 * Firefox wording at run time. Edge, Brave, Opera, Chrome for Testing and
 * anything unrecognised keep the neutral text.
 *
 * Read from the extension page's OWN navigator, which no content script touches:
 * the brand list where there is one (Chromium), else the user-agent product token
 * (Firefox has no `userAgentData`). Pure — `browser-kind.test.js` imports it.
 */

/**
 * D54 — what the popup and the options page say, in these words, when the page
 * shim reports that Firefox's resistFingerprinting is on and the device profile
 * has been left to Firefox.
 */
export const RFP_ON = "Firefox's resistFingerprinting is on, so Nullecho leaves your device profile to Firefox.";

/** The shim's status reason for that state (shim.js `applyAuthenticated`). */
export const RFP_REASON = 'resist-fingerprinting';

/** @returns {'chrome' | 'edge' | 'firefox' | 'other'} */
export function browserKind(nav = globalThis.navigator) {
  try {
    const brands = nav?.userAgentData?.brands;
    if (brands && brands.length) {
      const names = Array.from(brands, (b) => String(b?.brand ?? ''));
      if (names.includes('Microsoft Edge')) return 'edge';
      if (names.includes('Google Chrome')) return 'chrome';
      return 'other';   // Brave, Opera, Chromium / Chrome for Testing, …
    }
    const ua = String(nav?.userAgent ?? '');
    if (/\bFirefox\/\d/.test(ua)) return 'firefox';
    if (/\bEdg\/\d/.test(ua)) return 'edge';
    if (/\bOPR\/\d/.test(ua)) return 'other';
    if (/\bChrome\/\d/.test(ua)) return 'chrome';
  } catch (_) { /* fall through */ }
  return 'other';
}

/**
 * The neutral wording is what popup.html / options.html ship with; a test holds
 * the HTML and this table equal, so the two cannot drift.
 */
const NEUTRAL = {
  /** popup footer, after "sites can tell it is installed." */
  stronger: 'Fingerprinting protection built into a browser is stronger than any extension.',
  /** options → "What Nullecho can’t do", the comparison card. */
  limitTitle: 'Browsers with built-in protection do this better',
  limitBody: 'Fingerprinting protection built into a browser works below the JavaScript layer, where an extension simply cannot reach — so it covers things Nullecho never will. Where your browser offers it, it is the stronger choice. Nullecho makes a different trade: a different device profile per site instead of one identical profile for everyone.',
  /** options → "Your browser and its version", last sentence. */
  differs: 'What differs per site is the device underneath: processor, memory, graphics, fonts and operating-system version.',
  /** options → under the profile pool. Empty = no note. */
  poolNote: '',
  /** popup → the per-category panel shown when this site has no recorded domain list yet (D55). */
  blockedUrls: 'A per-category count for the page open in this tab. The domain list for this site fills in as Nullecho records blocks made by its own pages.',
};

export const BROWSER_COPY = {
  other: NEUTRAL,
  edge: NEUTRAL,
  chrome: {
    ...NEUTRAL,
    stronger: 'On Firefox or Brave, their built-in protections are stronger.',
    limitTitle: 'Firefox and Brave do this better',
    limitBody: 'Firefox\'s resistFingerprinting and Brave\'s built-in protections work below the JavaScript layer, where an extension simply cannot reach — so they cover things Nullecho never will. If you can use either, they are the stronger choice. Nullecho exists for Chrome, where neither is available, and makes a different trade: a different device profile per site instead of one identical profile for everyone.',
  },
  firefox: {
    ...NEUTRAL,
    stronger: 'Firefox’s own resistFingerprinting setting is stronger.',
    limitTitle: 'Firefox’s resistFingerprinting does this better',
    limitBody: 'Firefox’s privacy.resistFingerprinting setting works below the JavaScript layer, where an extension simply cannot reach — so it covers things Nullecho never will, and it is the stronger choice. It gives every Firefox that uses it the same profile; Nullecho makes a different trade: a different device profile per site. When Nullecho recognises that resistFingerprinting is on, it leaves your whole device profile to Firefox — overriding any of RFP’s shared values would make you the one RFP user who differs — and keeps blocking trackers and sending Global Privacy Control.',
    differs: 'In Firefox, what differs per site is the processor core count and the fonts, plus a small per-site noise in canvas, audio and WebGL read-backs — unless resistFingerprinting is on, when none of it does. Graphics, memory and operating-system version are reported exactly as Firefox reports them.',
    poolNote: 'In Firefox only each profile’s core count and fonts apply: sites see your graphics card as Firefox itself reports it (a generalised model), Firefox does not expose memory, and it reports a frozen operating-system version.',
  },
};

/** The copy for this browser. */
export function copyFor(kind) {
  return BROWSER_COPY[kind] ?? BROWSER_COPY.other;
}
