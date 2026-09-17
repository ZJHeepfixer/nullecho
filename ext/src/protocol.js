/**
 * Nullecho — internal protocol constants.
 * ────────────────────────────────────
 * ES module. Imported by `background.js`, `popup/popup.js`, `options/options.js`
 * (all module contexts).
 *
 * ⚠ `src/shim-loader.js`, `src/shim.js` and `src/gpc.js` are CLASSIC content
 * scripts — MV3 does not support ES modules for content scripts — so they inline
 * the literals below. If you change a string here, change it there too.
 *
 * That used to be enforced by this comment alone, which is not enforcement.
 * `CONTENT_SCRIPT_LITERALS` at the bottom of this file names every inlined
 * constant, and `protocol.test.js` reads the three classic scripts as text and
 * fails if any of them has drifted. Add a literal to a content script → add it
 * there too, or the drift is invisible again.
 */

/** Messages: content script / UI  →  service worker. */
export const MSG = {
  // from shim-loader.js (content script, ISOLATED world)
  GET_PERSONA: 'nullecho:get-persona',   // → { ok, persona, enabled, gpc, site }
  FP_DETECTED: 'nullecho:fp-detected',   // { api, count }
  SHIM_STATUS: 'nullecho:shim-status',   // { upgraded, lockedToFallback, reason }

  // from popup / options (extension pages)
  GET_SITE_REPORT: 'nullecho:get-site-report',   // { site } → SiteReport
  GET_OVERVIEW: 'nullecho:get-overview',         // → { settings, allowlist, sites, identity }
  ROTATE_SALT: 'nullecho:rotate-salt',           // → { identity }
  SET_SITE_ENABLED: 'nullecho:set-site-enabled', // { site, enabled }
  SET_SETTINGS: 'nullecho:set-settings',         // { patch }
  CLEAR_STATS: 'nullecho:clear-stats',           // { site? }  omit site = all
};

/** DOM CustomEvent names bridging ISOLATED ⇄ MAIN world. */
export const EVENTS = {
  /**
   * loader → MAIN world. `detail` is a JSON **string** (see shim-loader.js for
   * why). On success: `{ ok, enabled, gpc, site, persona, nonce, gpcNonce,
   * reportTokens }` — `reportTokens` is the list of one-time reply tokens the
   * reverse channel (DETECT/STATUS below) spends from, one per report, in order
   * (D30). On failure: `{ ok: false, reason, nonce, gpcNonce }`, no tokens.
   */
  PERSONA: 'nullecho:persona',
  /**
   * MAIN world → loader. `detail` is a JSON string: `{ api, count, token }`.
   * Authenticated by a one-time `token` (D30): the loader accepts a report only
   * if it carries the token at the head of its `reportTokens` queue, spends it,
   * and `stopImmediatePropagation()`s the event, so no page listener ever sees a
   * live token. A report made before the handshake has delivered `reportTokens`
   * carries no `token` at all — the loader drops it, and the shim re-sends it
   * (tokened, from a bounded backlog) once the handshake lands.
   */
  DETECT: 'nullecho:detect',
  /**
   * MAIN world → loader. `detail` is a JSON string. Two shapes:
   *   { phase: 'boot', channel, nonce } — first act of each MAIN-world script.
   *     UNAUTHENTICATED by necessity (it is what the reply tokens are minted in
   *     response to): allowed to change only "something announced itself" and
   *     that channel's nonce, and reports nothing to the service worker.
   *   { upgraded, lockedToFallback, reason, token } — every status after the
   *     boot event. Authenticated and swallowed exactly like DETECT above (D30).
   */
  STATUS: 'nullecho:status',
};

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE NONCE HANDSHAKE — why the loader→MAIN channel is authenticated
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `EVENTS.PERSONA` is a DOM event. DOM events are the page's own machinery, so
 * until 2026-08-20 any page script could dispatch one. The payoff was not subtle:
 *
 *     document.dispatchEvent(new CustomEvent('nullecho:persona', {
 *       detail: JSON.stringify({ ok: true, enabled: false })
 *     }));
 *
 * `enabled:false` is the allowlist instruction — "stand down, put the real
 * descriptors back". A tracker that had heard of Nullecho could therefore ask
 * Nullecho to switch itself off and then read the true machine. That is strictly
 * worse than the previously-documented risk (a page choosing which persona it is
 * shown): it strips the defense rather than steering it.
 *
 * The fix, in three parts:
 *
 *  1. **Each MAIN-world script mints its own nonce** from `crypto.getRandomValues`
 *     and publishes it in its `{ phase: 'boot' }` status event, as its first
 *     observable act at `document_start`. No page script has run at that instant,
 *     so no page listener can be registered to hear it.
 *  2. **The loader echoes the nonce back** in the persona payload. A payload whose
 *     nonce does not match is discarded — and, importantly, does NOT consume the
 *     one-shot, or a page could deny the upgrade by shouting first.
 *  3. **Exactly one handshake is accepted.** After that every message is ignored,
 *     which is what makes the nonce's later disclosure harmless (see below).
 *
 * ── What the nonce rests on, and what it does not ───────────────────────────
 *
 * The whole scheme rests on ONE property: the MAIN-world script's boot event is
 * dispatched before any page script runs. Three things make that real rather than
 * assumed, and one thing it cannot cover:
 *
 *  · Both manifests declare the three content scripts at `run_at: document_start`,
 *    loader FIRST. `protocol.test.js` asserts that ordering in both files, so a
 *    reordering that would silently break the handshake fails the suite instead.
 *  · The MAIN-world scripts listen on `window` in the CAPTURE phase, registered at
 *    document_start. `window` is the first node in the propagation path of an
 *    event dispatched on `document`, and same-phase listeners fire in registration
 *    order — so a page listener added later cannot see, and cannot
 *    `stopPropagation()` away, the delivery before we have consumed it. Listening
 *    only on `document` (the pre-2026-08-20 design) would have left the nonce
 *    stealable by `window.addEventListener(..., true)`.
 *  · The loader independently verifies, from the ISOLATED world — which the page
 *    cannot reach into — that no page script had executed at the instant the boot
 *    event arrived. If it had, the loader reports `nonce-exposed` rather than
 *    quietly assuming the guarantee held.
 *  · **Residual, and not fixable from inside the page:** if the MAIN-world script
 *    loses the document_start race (the Chrome MAIN-world injection bug in
 *    docs/THREAT-MODEL.md), the page owns the realm first and can hook
 *    `JSON.parse`, `CustomEvent.prototype.detail`, `crypto.getRandomValues` and
 *    `addEventListener` before we capture them. Nothing an in-page shim does can
 *    recover trust from that position. The shim captures those primitives at boot
 *    so that the only way to beat it is to win the injection race — the same race
 *    that already decides whether the shim protects anything at all.
 *
 * The nonce IS observable to the page after use: the loader's delivery event
 * carries it, and by then page scripts are running. That is by design — a replay
 * hits `handshakeDone` and is dropped. The nonce authenticates one message; it is
 * not a long-lived secret.
 */
export const HANDSHAKE = {
  /** Which MAIN-world script a `{ phase: 'boot' }` status event came from. */
  CHANNEL: {
    /** `src/shim.js` — the fingerprint shim. Payload field: `nonce`. */
    SHIM: 'shim',
    /** `src/gpc.js` — the Global Privacy Control property. Payload field: `gpcNonce`. */
    GPC: 'gpc',
  },
  /** Bytes of `crypto.getRandomValues` behind each nonce. 16 → 128 bits, hex-encoded. */
  NONCE_BYTES: 16,
  /** `{ phase: <this> }` marks the one status event that carries a nonce. */
  BOOT_PHASE: 'boot',
};

/**
 * ════════════════════════════════════════════════════════════════════════════
 * THE REVERSE CHANNEL — why DETECT/STATUS reports are authenticated too. D30.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The nonce handshake above authenticates the FORWARD channel (loader → MAIN):
 * a page cannot forge the persona delivery. Until 2026-09-16 nothing authenticated
 * the REVERSE channel (MAIN → loader) the same way. `EVENTS.DETECT` and
 * `EVENTS.STATUS` are DOM events on `document`, so a page could dispatch them
 * itself — three lines raised the sticky `nonce-exposed` warning, overwrote a
 * real `lockedToFallback` with a healthy status, and added a million to the
 * popup's fingerprinting counter.
 *
 * A single shared secret does not fix this: the first tokened report (the
 * upgrade status, sent within milliseconds) would hand that one token to any
 * page listener, and from then on the page could mint as many "reports" as it
 * likes. So the loader mints **32 one-time tokens** at `document_start` and
 * delivers them as `reportTokens` inside the same nonce-authenticated persona
 * payload described above. Every DETECT/STATUS report after that spends the
 * next token in order; the loader accepts a report only if it carries the
 * token at the head of its queue, then `stopImmediatePropagation()`s it — so a
 * page never observes a live token, only the absence of an event. A token a
 * page HAS observed is a token the loader has already spent, which closes
 * harvest-and-replay by construction.
 *
 * This rests on the same ordering guarantee as the forward handshake, run in
 * reverse: the loader listens on `window` in the CAPTURE phase, registered at
 * `document_start` ahead of any page listener, so it sees every report before
 * the page's own `document`-level listener could.
 *
 * The boot event (`{ phase: 'boot', ... }`) cannot itself carry a token — it is
 * what the tokens are minted in reply to — so it stays unauthenticated and is
 * trusted with almost nothing: not "the shim is healthy", only "something
 * announced itself" and that channel's nonce. `shim-never-booted` now turns on
 * an authenticated reply rather than on that forgeable event.
 *
 * The list is finite and a page controls how many DETECT reports the shim
 * makes (its `touch()` schedule fires at read 1, 10, 50, then every 250 per
 * API), so a page could spend the whole list on canvas reads alone and leave
 * the shim unable to report a later stand-down or a locked fallback — the half
 * of this channel that has to stay truthful. The last **four** tokens are
 * reserved for statuses for exactly that reason.
 *
 * Full argument, residuals (lockstep substitution if the cross-world listener
 * ordering claim is ever wrong; exhaustion and the status reserve it forced)
 * and the guard tests: `docs/DECISIONS.md` D30, and the "THE REVERSE CHANNEL"
 * comment block in `src/shim-loader.js` this is a shorter mirror of.
 */

/**
 * ⛔ REMOVED 2026-08-20: `BOOT_ATTR = 'data-nullecho-boot'`.
 *
 * An attribute on <html> used to carry the persona payload as a second delivery
 * channel, "in case the MAIN-world shim boots after the loader dispatched". Under
 * the nonce handshake that case cannot occur — the loader has nothing to send
 * until it has heard the shim's boot event, which proves the shim is already
 * listening. What the attribute would still do is publish the nonce into the DOM,
 * where any later page script can read it at leisure. A channel whose only
 * remaining function is to leak the secret that protects the other channel is not
 * a fallback.
 *
 * Do not reintroduce it. `protocol.test.js` asserts the string appears nowhere in
 * `ext/`.
 */

/** Static ruleset ids — must match `declarative_net_request.rule_resources` in the manifest. */
export const RULESETS = {
  ads: 'ads',
  analytics: 'analytics',
  social: 'social',
  fingerprinting: 'fingerprinting',
  gpc: 'gpc',
};

/**
 * Static rulesets that actually *block* requests, and whose matches therefore
 * belong in the "requests blocked" count.
 *
 * `gpc` is deliberately absent. Its single rule sets a header on nearly every
 * request, so counting its matches would report the page's entire request log
 * as blocked. This list decides only what the counter believes; ownership of
 * the `gpc` ruleset stays with `gpc.js` (see the header of `background.js`).
 */
export const BLOCKING_RULESET_IDS = ['ads', 'analytics', 'social', 'fingerprinting'];

/** Human-facing category labels, used by popup + options. */
export const CATEGORY_LABELS = {
  ads: 'Ad networks',
  analytics: 'Analytics & telemetry',
  social: 'Social widgets & pixels',
  fingerprinting: 'Fingerprinting scripts',
  /** Dynamic rules written by the three-strike observer in `heuristics.js`. */
  heuristic: 'Learned trackers',
  'heuristic-cookie': 'Cookies stripped',
};

export const DEFAULT_SETTINGS = {
  categories: {
    ads: true,
    analytics: true,
    social: true,
    fingerprinting: true,
  },
  /** Sec-GPC header (DNR) + navigator.globalPrivacyControl (shim). */
  gpc: true,
  /**
   * Days between automatic salt rotations. 0 = off (the default).
   *
   * Off by default on purpose: rotating the salt makes every site see a brand-new
   * machine, which some sites treat as a suspicious login and answer with a
   * re-auth challenge. That is a real cost, so the user opts into it.
   */
  autoRotateDays: 0,
  /** Log loudly to the page console when the persona handshake fails or is downgraded. */
  loudFailures: true,
};

/** Dynamic DNR rule ids for the per-site allowlist live at or above this number. */
export const ALLOW_RULE_ID_BASE = 900000;

// ── matched-rule classification ─────────────────────────────────────────────
//
// `declarativeNetRequest.onRuleMatchedDebug` and `getMatchedRules()` both report
// every rule that ACTED on a request — blocks, `allow` exceptions and
// `modifyHeaders` alike — and a `MatchedRule` carries only `{ ruleId, rulesetId }`.
// The action type is not in the event. So "was this request blocked?" can only be
// answered from the id, which Nullecho owns and `rules/validate.mjs` enforces, and
// never from the ruleset id, which Chrome owns and reuses (`_dynamic`) across
// four unrelated layers.
//
// Getting this wrong is not cosmetic. `gpc.json` rule 5000 matches nearly every
// request, and the allowlist's `allowAllRequests` rules match precisely on the
// sites the user switched Nullecho off for.

/**
 * Static rules that live in a ruleset but do not block: per-site `allow`
 * exceptions and header rules.
 *
 * `rules/validate.mjs` asserts this is exactly the set of non-`block` rules in
 * the shipped JSON, so adding an exception without updating it fails validation
 * rather than silently inflating the counter.
 */
export const NON_BLOCKING_STATIC_RULE_IDS = new Set([
  4700, // fingerprinting.json — anti-fraud vendors allowed on bank / checkout origins
  5000, // gpc.json — sets Sec-GPC; matches nearly every request
]);

/**
 * Reserved dynamic rule-id ranges, `[lo, hi]` inclusive. Mirrored — and checked
 * against — `DYNAMIC_RANGES` in `rules/validate.mjs`.
 */
export const DYNAMIC_RULE_RANGES = {
  allowlist: [ALLOW_RULE_ID_BASE, ALLOW_RULE_ID_BASE + 999],
  heuristicBlock: [1_000_000, 1_049_999],
  heuristicCookie: [1_050_000, 1_099_999],
  gpcException: [1_100_000, 1_100_999],
};

/** What a matched rule actually did to the request. */
export const OUTCOME = {
  /** Request was cancelled. This is what "requests blocked" counts. */
  BLOCKED: 'blocked',
  /** Request went through with its Cookie / Set-Cookie headers removed. */
  STRIPPED: 'stripped',
  /** Allow rules, GPC header rules, anything unrecognised. Never counted. */
  IGNORED: 'ignored',
};

const inRange = (id, [lo, hi]) => id >= lo && id <= hi;

/**
 * Classify one `MatchedRule` — `{ ruleId, rulesetId }` — from
 * `onRuleMatchedDebug` or `getMatchedRules()`.
 *
 * Unrecognised rules are IGNORED rather than guessed at: an over-count is a
 * claim Nullecho cannot back, and docs/THREAT-MODEL.md's copy rules put concrete
 * counts on the screen precisely because they are meant to be literally true.
 *
 * @param {{ ruleId?: number, rulesetId?: string } | null | undefined} rule
 * @returns {{ outcome: string, category: string|null }}
 */
export function classifyMatchedRule(rule) {
  const id = rule?.ruleId;
  const rulesetId = rule?.rulesetId;

  // Runtime rules. Chrome reports these under one synthetic ruleset id, so the
  // range is the only thing that says which layer wrote them.
  if (Number.isInteger(id)) {
    if (inRange(id, DYNAMIC_RULE_RANGES.heuristicBlock)) {
      return { outcome: OUTCOME.BLOCKED, category: 'heuristic' };
    }
    if (inRange(id, DYNAMIC_RULE_RANGES.heuristicCookie)) {
      return { outcome: OUTCOME.STRIPPED, category: 'heuristic-cookie' };
    }
    // Matching either of these means Nullecho deliberately did NOT block.
    if (inRange(id, DYNAMIC_RULE_RANGES.allowlist) ||
        inRange(id, DYNAMIC_RULE_RANGES.gpcException)) {
      return { outcome: OUTCOME.IGNORED, category: null };
    }
  }

  if (BLOCKING_RULESET_IDS.includes(rulesetId) && !NON_BLOCKING_STATIC_RULE_IDS.has(id)) {
    return { outcome: OUTCOME.BLOCKED, category: rulesetId };
  }

  return { outcome: OUTCOME.IGNORED, category: null };
}

/** Cap on distinct tracker domains remembered per site (bounds storage growth). */
export const MAX_TRACKERS_PER_SITE = 60;

/** Cap on distinct sites kept in the stats table. */
export const MAX_SITES = 500;

// ── content-script literal registry ─────────────────────────────────────────
//
// MV3 forbids ES modules in content scripts, so the three classic scripts below
// declare these values as their own `const`s. That duplication is forced; the
// drift is not. `protocol.test.js` reads each file as text, pulls out
// `const <NAME> = '<value>'`, and asserts it equals what this module exports.
//
// The header comment that used to be the only thing holding the two sides
// together is still there, but it is now backed by a test — the same reason
// `src/shim.js`'s persona pool is a generated mirror rather than a typed one
// (gap G7: it drifted twice).

/** @type {Record<string, Record<string, string>>} path → { inlined const name: value } */
export const CONTENT_SCRIPT_LITERALS = {
  'src/shim-loader.js': {
    MSG_GET_PERSONA: MSG.GET_PERSONA,
    MSG_FP_DETECTED: MSG.FP_DETECTED,
    MSG_SHIM_STATUS: MSG.SHIM_STATUS,
    EV_PERSONA: EVENTS.PERSONA,
    EV_DETECT: EVENTS.DETECT,
    EV_STATUS: EVENTS.STATUS,
    CH_SHIM: HANDSHAKE.CHANNEL.SHIM,
    CH_GPC: HANDSHAKE.CHANNEL.GPC,
    BOOT_PHASE: HANDSHAKE.BOOT_PHASE,
  },
  'src/shim.js': {
    EV_PERSONA: EVENTS.PERSONA,
    EV_DETECT: EVENTS.DETECT,
    EV_STATUS: EVENTS.STATUS,
    CHANNEL: HANDSHAKE.CHANNEL.SHIM,
    BOOT_PHASE: HANDSHAKE.BOOT_PHASE,
  },
  'src/gpc.js': {
    EVENT_PERSONA: EVENTS.PERSONA,
    EVENT_STATUS: EVENTS.STATUS,
    CHANNEL: HANDSHAKE.CHANNEL.GPC,
    BOOT_PHASE: HANDSHAKE.BOOT_PHASE,
  },
};

/**
 * Numeric literals the classic scripts also inline. Kept separate because the
 * drift test has to match `= 16;` rather than `= '…';`.
 */
export const CONTENT_SCRIPT_NUMERIC_LITERALS = {
  'src/shim.js': { NONCE_BYTES: HANDSHAKE.NONCE_BYTES },
  'src/gpc.js': { NONCE_BYTES: HANDSHAKE.NONCE_BYTES },
};

/**
 * Reverse-channel payload field names (D30): `reportTokens` (the one-time list,
 * minted by `shim-loader.js` and delivered inside the persona payload) and
 * `token` (the per-report spend, attached by `shim.js` and read by
 * `shim-loader.js`).
 *
 * Deliberately NOT in `CONTENT_SCRIPT_LITERALS` above: that registry pins
 * values THIS MODULE exports (`MSG`/`EVENTS`/`HANDSHAKE`) against a `const NAME
 * = '<value>'` re-declaration in a content script, and neither field is a
 * protocol.js export — both are private vocabulary between `shim-loader.js`
 * and `shim.js` alone, written inline rather than declared as a named const in
 * either file, so the existing `inlinedString()` pinning mechanism has nothing
 * to match against.
 *
 * Pinned here the same way in spirit — read as text, fail on drift — but each
 * entry is the exact functional call site (`payload string → regex source`),
 * not bare presence of the word: `reportTokens` and `token` also appear in
 * comments and in shim.js's own `state.reportTokens` field, so a check for the
 * word alone would keep passing after the call site that actually produces or
 * reads the cross-file value had been renamed out from under it.
 *
 * This does not stand in for the behavioral guards: the full contract
 * (one-time, order-enforced, swallowed on accept, four reserved for statuses)
 * is exercised against each file's REAL implementation by the D30/C1 guards in
 * `review-2026-09-16.test.js` (`loaderRealm()` drives the real loader;
 * `bootRealm()` drives the real shim against a hand-written loader stand-in
 * that uses these same two field names) and by `shim-handshake.test.js`.
 *
 * @type {Record<string, Record<string, string>>} path → { field: regex source
 *   matching the call site that produces or consumes it }
 */
export const REVERSE_CHANNEL_PAYLOAD_FIELDS = {
  'src/shim-loader.js': {
    // The delivery payload key: `reportTokens: replyTokens,` in maybeDeliver().
    reportTokens: String.raw`reportTokens:\s*replyTokens\b`,
    // The own-property read: `hasOwnProperty.call(d, 'token')` in spendToken().
    token: String.raw`hasOwnProperty\.call\(d,\s*'token'\)`,
  },
  'src/shim.js': {
    // The read of the delivered list: `ownField(payload, 'reportTokens')`.
    reportTokens: String.raw`ownField\(payload,\s*'reportTokens'\)`,
    // The per-report spend: `objDefineProperty(obj, 'token', …)` in report().
    token: String.raw`objDefineProperty\(obj,\s*'token'`,
  },
};

/**
 * Strings that must NOT appear anywhere under `ext/`. Each one is a channel or a
 * behaviour that was removed for a security reason, where re-adding it would
 * look like a harmless convenience.
 */
export const FORBIDDEN_LITERALS = {
  'data-nullecho-boot':
    'the <html> boot attribute was removed 2026-08-20 — it publishes the handshake ' +
    'nonce into the DOM, where any later page script can read it',
};
