/**
 * Nullecho — MV3 service worker.
 * ═══════════════════════════
 * MERGED FILE. Two lanes write here, so the boundaries are marked:
 *
 *   §1 blocking + GPC wiring        — heuristics / GPC / rules lane
 *   §2 identity, personas, UI state — extension-shell lane
 *
 * MV3 ordering rule this file exists to respect: `webRequest` and `runtime`
 * listeners must be registered *synchronously* during worker evaluation. A
 * listener added inside a promise callback is missed whenever Chrome respawns
 * the worker to deliver an event, and it fails silently — the extension just
 * quietly stops observing. Everything async happens behind `ready()`, which the
 * already-registered handlers await.
 *
 * ── Salt containment (§2) ─────────────────────────────────────────────────
 * The salt is the master secret: anyone holding it can derive *every* origin's
 * persona and therefore re-join the user across sites — exactly the linkage
 * Nullecho exists to break. So:
 *
 *   1. The salt is never sent to a content script, never written to
 *      `chrome.storage.session` with `TRUSTED_AND_UNTRUSTED_CONTEXTS`, and never
 *      appears in a message payload. Only the *derived persona for the asking
 *      frame's own origin* is sent out.
 *   2. The asking origin is taken from `sender.url` / `sender.origin`, never from
 *      anything the content script claims. A compromised renderer therefore cannot
 *      ask "what persona does bank.example see?".
 *   3. The UI shows a short non-reversible *fingerprint* of the salt (so the user
 *      can tell that "New identity" did something), never the salt itself.
 *
 * This costs latency: the loader has to do an async round trip instead of a fast
 * synchronous storage read. That trade is deliberate, and the loader/shim pair is
 * built to be safe while the round trip is in flight — see `shim-loader.js`.
 */

import './gpc.js';
import * as heuristics from './heuristics.js';
import { personaFor, newSalt, hashString, personasForFamily, hostFamily } from './personas.js';
import { buildLinkageGraph, reachByOwner } from './linkage.js';
import { EXTENSION_BLOCK_ERRORS, buildMatcher, requestFacts } from './block-counter.js';
import { topLevelHit, lateFlagReload, prune as pruneBotManagerSites, vendorLabel } from './bot-manager.js';
import {
  MSG,
  GPC_MSG,
  FP_STAND_DOWN,
  BOT_MANAGER_STORAGE_KEY,
  RULESETS,
  BLOCKING_RULESET_IDS,
  DEFAULT_SETTINGS,
  ALLOW_RULE_ID_BASE,
  MAX_TRACKERS_PER_SITE,
  MAX_SITES,
  OUTCOME,
  classifyMatchedRule,
} from './protocol.js';

// Firefox exposes `browser` and also aliases `chrome`, so `chrome` alone is
// portable for everything used here. `api` is kept for the §2 code that reads
// better with it.
const api = globalThis.chrome ?? globalThis.browser;

/**
 * eTLD+1. Shared with the heuristics layer on purpose — two different notions of
 * "site" in one extension would mean the persona boundary and the tracker
 * attribution boundary could disagree, which is a bug waiting to happen.
 */
const { registrableDomain } = heuristics;
export { registrableDomain };

// ═══════════════════════════════════════════════════════════════════════════
// §1 — blocking + GPC wiring
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Every top-level side effect goes through this.
 *
 * MV3 requires the event listeners to be registered synchronously from the
 * worker's top level, so everything here shares one execution: a throw in the
 * FIRST statement means `runtime.onMessage.addListener` further down is never
 * reached, and the extension has no message surface at all — no persona, no
 * popup, no options page, no GPC toggle — while every other part of it looks
 * installed. That is exactly what `extraHeaders` did on Firefox for as long as
 * there has been a Firefox manifest (DECISIONS.md D42).
 *
 * A feature we cannot wire up is a feature lost. It must never be the extension.
 */
function bootStep(label, fn) {
  try { fn(); } catch (e) { console.error(`[nullecho] boot step "${label}" failed:`, e); }
}

// D59's bot-manager observer rides on the heuristics layer's `onHeadersReceived`
// listener rather than registering a second one: the same filter, the same
// feature-detected `extraHeaders` (Chrome hides Set-Cookie without it, Firefox
// rejects it — D42), one event per response instead of two.
bootStep('heuristics.install', () => heuristics.install({ responseObservers: [onBotManagerHeaders] }));

bootStep('gpc.init', () => { void globalThis.NullechoGPC.init(); });

/**
 * Rule ids 4500-4699 in `fingerprinting.json` are the anti-fraud device-ID
 * vendors — ThreatMetrix, Iovation, Sift, Forter and friends. They are real
 * fingerprinters, and they are also wired into bank sign-in and checkout.
 * EasyPrivacy ships per-site exceptions for several of them, which is direct
 * evidence that blocking them breaks real flows.
 *
 * So they ship OFF, and the UI exposes them as an explicit opt-in. Blocking
 * a checkout is the fastest way to get uninstalled, and an uninstalled
 * extension protects no one.
 */
const STRICT_FP_RANGE = [4500, 4699];

/**
 * Read the tier-B ids out of the ruleset we actually ship, rather than assuming
 * the range is full. Chrome caps how many static rules may be disabled at once
 * (`MAX_NUMBER_OF_DISABLED_STATIC_RULES`), so spending 200 slots on the 8 rules
 * that exist would be wasteful — and would silently start disabling rules
 * nobody meant to touch the day someone adds one at 4508.
 */
let strictFpRuleIds = null;

/**
 * A ruleset Nullecho ships, read out of the package. The one `fetch` in this
 * file, and always a bundled file (`manifest.test.js` fails the build otherwise):
 * the tier-B ids below and the block counter (D55) both read from here.
 */
async function loadRuleset(id) {
  const res = await fetch(chrome.runtime.getURL(`rules/${id}.json`));
  return res.json();
}

async function strictFingerprintingRuleIds() {
  if (strictFpRuleIds) return strictFpRuleIds;
  try {
    const rules = await loadRuleset('fingerprinting');
    strictFpRuleIds = rules
      .map((r) => r.id)
      .filter((id) => id >= STRICT_FP_RANGE[0] && id <= STRICT_FP_RANGE[1]);
  } catch (e) {
    warn('strictFingerprintingRuleIds')(e);
    strictFpRuleIds = [];
  }
  return strictFpRuleIds;
}

export async function setStrictFingerprinting(on) {
  const ids = await strictFingerprintingRuleIds();
  if (!ids.length) return;
  await chrome.declarativeNetRequest.updateStaticRules({
    rulesetId: 'fingerprinting',
    [on ? 'enableRuleIds' : 'disableRuleIds']: ids,
  });
}

/**
 * Whether tier-B is currently on, read back from DNR rather than from a settings
 * field. There is no stored flag for this, and inventing one would give the UI a
 * second source of truth that can disagree with the rules actually loaded — the
 * exact failure the site report exists to avoid making claims about.
 */
export async function strictFingerprintingEnabled() {
  try {
    const ids = await strictFingerprintingRuleIds();
    if (!ids.length) return false;
    const disabled = await chrome.declarativeNetRequest.getDisabledRuleIds({
      rulesetId: 'fingerprinting',
    });
    const off = new Set(disabled ?? []);
    return !ids.some((id) => off.has(id));
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §2 — identity, personas, per-site state
// ═══════════════════════════════════════════════════════════════════════════

/** @type {{ salt: string, rotatedAt: number } | null} */
let identity = null;
/** @type {typeof DEFAULT_SETTINGS | null} */
let settings = null;
/** @type {Set<string> | null} */
let allowlist = null;
/**
 * site → { blocked, fp, fpByApi, trackers, byCategory, lastSeen, personaId,
 *          lastShimStatus, nonceExposedAt, subFrameMisses }
 * @type {Record<string, any> | null}
 */
let stats = null;
/**
 * D59 — sites whose own responses set a bot-manager cookie (bot-manager.js):
 * site → { vendor, cookie, at, override, reloadedAt? }. Persisted under
 * BOT_MANAGER_STORAGE_KEY, like the allowlist. `override: true` is the user's
 * "Use my device profile here anyway".
 * @type {Record<string, {vendor:string, cookie:string, at:number, override:boolean, reloadedAt?:number}> | null}
 */
let botSites = null;

let readyPromise = null;

function ready() {
  if (!readyPromise) readyPromise = init();
  return readyPromise;
}

async function init() {
  const got = await api.storage.local.get(['identity', 'settings', 'allowlist', 'stats', BOT_MANAGER_STORAGE_KEY]);

  identity = got.identity ?? { salt: newSalt(), rotatedAt: Date.now() };
  settings = { ...DEFAULT_SETTINGS, ...(got.settings ?? {}) };
  settings.categories = { ...DEFAULT_SETTINGS.categories, ...(got.settings?.categories ?? {}) };
  allowlist = new Set(got.allowlist ?? []);
  stats = got.stats ?? {};
  const bm = got[BOT_MANAGER_STORAGE_KEY];
  botSites = bm && typeof bm === 'object' && !Array.isArray(bm) ? bm : {};

  if (!got.identity) await api.storage.local.set({ identity });

  await Promise.all([
    applyRulesets().catch(warn('applyRulesets')),
    applyUaRuleset().catch(warn('applyUaRuleset')),
    syncAllowlistRules().catch(warn('syncAllowlistRules')),
  ]);
}

const warn = (where) => (err) => console.warn(`[nullecho] ${where} failed:`, err);

// ── DNR: the host family's Client-Hint ruleset ──────────────────────────────
//
// Since D51 (2026-09-28) nothing here rewrites what the browser says about
// itself: the shim reports the REAL `navigator.userAgent`, brands and full
// version, so the `User-Agent` / `Sec-CH-UA` / `-Mobile` / `-Platform` headers go
// out exactly as the browser writes them. Until then they were rewritten at
// family level to a pinned "Chrome/151" (D19) — a version the browser was not,
// on every request. What each ruleset still does is D49: REMOVE the seven
// Accept-CH hints, because the JS persona answers platformVersion / arch /
// bitness / model / wow64 with its own values and a header with the machine's
// would contradict it. The three rulesets are now identical but for their rule
// ids; one per family is kept so the manifests and this enable logic did not
// have to move in the same change (rules/gen-ua.mjs).
//
// Static ruleset enablement persists across browser sessions and is reset only
// by an extension update, and `init()` runs at every worker start, so the window
// in which the hints are not removed is the few milliseconds of the first worker
// start after install/update. See DECISIONS.md D19 / D49 / D51.

/** manifest `rule_resources[].id` per host family. Mirrored in rules/gen-ua.mjs. */
export const UA_RULESETS = { win: 'ua-win', mac: 'ua-mac', linux: 'ua-linux' };

export async function applyUaRuleset() {
  if (!api.declarativeNetRequest?.updateEnabledRulesets) return;
  const want = UA_RULESETS[hostFamily()] ?? UA_RULESETS.win;
  await api.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: [want],
    disableRulesetIds: Object.values(UA_RULESETS).filter((id) => id !== want),
  });
}

/**
 * The persona key for a URL. Returns '' for anything we do not shim
 * (chrome://, about:, extension pages, file: with no host…).
 */
export function siteKeyFor(url) {
  if (!url) return '';
  let u;
  try { u = new URL(url); } catch { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  return registrableDomain(u.hostname);
}

/**
 * Schemes whose documents have no host of their own and INHERIT the creating
 * document's origin. `sender.url` for such a frame is the literal `about:blank` /
 * `about:srcdoc`, which `siteKeyFor` correctly refuses — but the frame is
 * same-origin with its parent and must get the parent's persona, not none.
 */
const INHERITED_ORIGIN_SCHEMES = new Set(['about:', 'blob:', 'data:', 'filesystem:']);

/**
 * The persona key for whoever sent a message. Review B3 / DECISIONS.md D31.
 *
 * `sender.url` first, because it is the most specific thing the browser tells us.
 * When it names an inherited-origin scheme, fall back to `sender.origin` — also the
 * browser's own account, never anything out of the message body — so an
 * `about:blank` or `srcdoc` child of `https://news.example` keys on `news.example`
 * exactly as its parent does. Before this, `sender?.url || sender?.origin` never
 * reached the origin at all for those frames (`'about:blank'` is truthy), so the
 * worker answered `unsupported scheme` and the child was locked to a fallback
 * persona while its same-origin parent ran the salted one — a pristine-child-realm
 * detector, and a different machine inside the same document tree.
 *
 * A sandboxed iframe's `sender.origin` is the string `'null'`, which `siteKeyFor`
 * refuses: an opaque origin genuinely has no site key, and that is the right answer.
 *
 * ⚠ Precisely (review R2-4, which pins the whole table): that refusal is reached
 * only when `sender.url` is ALSO scheme-less. A frame sandboxed without
 * `allow-same-origin` but loading a real `https://` document has an opaque origin
 * and an ordinary `sender.url`, and the URL is consulted first — so it gets that
 * host's key. That is correct: it is that host's own document, and the shim's
 * `fallbackSiteKey()` in that frame keys on `location.hostname` and lands on the
 * same value, so the fallback and the upgrade agree. The `'null'` path is for
 * frames with no host of their own — a sandboxed `about:blank`, a `data:` frame.
 */
export function senderSiteKey(sender) {
  const url = sender?.url || '';
  const direct = siteKeyFor(url);
  if (direct) return direct;
  if (url) {
    let protocol = '';
    try { protocol = new URL(url).protocol; } catch { return ''; }
    if (!INHERITED_ORIGIN_SCHEMES.has(protocol)) return '';
  }
  return siteKeyFor(sender?.origin || '');
}

// ── stats ───────────────────────────────────────────────────────────────────

function blankSite() {
  return {
    blocked: 0,
    fp: 0,
    fpByApi: {},
    trackers: {},
    byCategory: {},
    /**
     * Requests the heuristic yellowlist let through with Cookie / Set-Cookie
     * removed. Deliberately NOT folded into `blocked`: the request was made and
     * answered, so calling it blocked would be a claim the network log
     * contradicts. See docs/THREAT-MODEL.md "Copy rules".
     */
    cookieStripped: 0,
    cookieTrackers: {},
    lastSeen: 0,
    personaId: null,
    lastShimStatus: null,
    /**
     * Patch groups the page shim reported it could NOT install (or that broke at
     * run time) on this site — labels such as `canvas.toDataURL`. Sticky and
     * de-duplicated, like `nonceExposedAt`: the healthy-looking status arrives in
     * the same message and a last-writer slot would lose it (D33).
     */
    patchFailures: [],
    /**
     * When a MAIN-world script last booted after page script had already run, as
     * measured by `shim-loader.js` from the ISOLATED world. Sticky, because the
     * shim's own (healthy-looking) status arrives right afterwards and would
     * otherwise overwrite it. 0 = never seen on this site.
     */
    nonceExposedAt: 0,
    subFrameMisses: 0,
  };
}

function siteStats(site) {
  if (!stats[site]) {
    // Bound the table. Evict the least-recently-seen sites rather than refusing
    // to record — the newest visit is the one the user is looking at.
    const keys = Object.keys(stats);
    if (keys.length >= MAX_SITES) {
      keys.sort((a, b) => (stats[a].lastSeen || 0) - (stats[b].lastSeen || 0));
      for (const k of keys.slice(0, Math.ceil(MAX_SITES * 0.1))) delete stats[k];
    }
    stats[site] = blankSite();
  } else if (stats[site].cookieTrackers === undefined) {
    // Stats written by an earlier build predate the cookie-strip fields. Back-fill
    // in place, so callers keep mutating the stored object.
    stats[site] = { ...blankSite(), ...stats[site] };
  }
  return stats[site];
}

let flushTimer = null;
function scheduleFlush() {
  if (flushTimer) return;
  // Debounced: DNR match events can fire hundreds of times per page load and we
  // do not want a storage write per event.
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try { await api.storage.local.set({ stats }); } catch (e) { warn('flush stats')(e); }
  }, 4000);
}

async function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await api.storage.local.set({ stats });
}

// ── DNR: category rulesets + allowlist ──────────────────────────────────────

/**
 * Category rulesets only. The `gpc` ruleset is **not** touched here — `gpc.js`
 * owns it, including its per-site exception rules, and two owners toggling one
 * ruleset is how you get a setting that silently reverts.
 */
async function applyRulesets() {
  if (!api.declarativeNetRequest?.updateEnabledRulesets) return;
  const enable = [];
  const disable = [];
  for (const key of BLOCKING_RULESET_IDS) {
    (settings.categories[key] ? enable : disable).push(RULESETS[key]);
  }
  await api.declarativeNetRequest.updateEnabledRulesets({
    enableRulesetIds: enable,
    disableRulesetIds: disable,
  });
}

/**
 * Mirror the allowlist into dynamic DNR rules.
 *
 * `allowAllRequests` on a main_frame whitelists every request made *by documents
 * in that frame's tree*, which is exactly "turn Nullecho's blocking off on this
 * site". Priority is set far above the static rulesets so it always wins.
 *
 * Rule-id ranges in use across the extension, all disjoint:
 *     1 000 –     5 099  static rulesets (ads/analytics/social/fingerprinting/gpc)
 *     5 100 –     5 399  static per-family Client-Hint removal rulesets (ua-win/mac/linux:
 *                          one rule each at 5101/5201/5301; x100 was the User-Agent
 *                          rewrite D51 retired)
 *     6 000 –     6 999  static personalization ruleset ("Pricing & personalization", 0.9.3)
 *   900 000 –   900 999  this allowlist            (ALLOW_RULE_ID_BASE)
 * 1 000 000 – 1 049 999  heuristics block rules
 * 1 050 000 – 1 099 999  heuristics cookie-block rules
 * 1 100 000 – 1 100 999  GPC per-site exceptions
 *
 * Each writer removes only ids inside its own range, so concurrent
 * `updateDynamicRules` calls from different layers cannot clobber each other.
 *
 * Note this only disables the BLOCKING layer. Turning the fingerprint shim off
 * for an allowlisted site is handled in `shim-loader.js` + `shim.js`, because a
 * statically declared content script cannot be un-declared at runtime. See
 * "The allowlist gap" in README.md.
 */
async function syncAllowlistRules() {
  if (!api.declarativeNetRequest?.updateDynamicRules) return;
  const existing = await api.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing
    .filter((r) => r.id >= ALLOW_RULE_ID_BASE && r.id < ALLOW_RULE_ID_BASE + 1000)
    .map((r) => r.id);

  const addRules = [...allowlist].slice(0, 1000).map((domain, i) => ({
    id: ALLOW_RULE_ID_BASE + i,
    priority: 100000,
    action: { type: 'allowAllRequests' },
    condition: {
      requestDomains: [domain],
      resourceTypes: ['main_frame'],
    },
  }));

  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

// ── blocked-request accounting ──────────────────────────────────────────────
//
// Three sources, and which one a build has decides what the UI may say (D55).
//
//  1. `onRuleMatchedDebug` — the request URL and the rule. Chrome and Edge give it
//     to UNPACKED builds only; Firefox has no such event. Feeds the lifetime
//     per-site counters (and the cookie-strip counters) when it exists.
//  2. `getMatchedRules({ tabId })` — Chrome and Edge, packed or not: every rule
//     that acted in the tab's current document (measured: a same-tab navigation
//     drops the previous page's matches), rule ids only, no URLs, and a QUOTA of
//     20 calls per 10 minutes shared by the whole extension (measured: call 21
//     fails "exceeds the MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL quota"; calls
//     made inside a user gesture are exempt). The popup's "blocked on this page".
//  3. `webRequest.onErrorOccurred` — every engine, packed or not: the browser
//     reports each request an extension rule cancelled (`net::ERR_BLOCKED_BY_CLIENT`
//     in Chrome, `NS_ERROR_ABORT` in Firefox), and `block-counter.js` attributes it
//     to one of Nullecho's own block rules or not at all. Feeds the per-tab tally
//     (the popup's number in Firefox, and Chrome's when the quota is spent) and,
//     where (1) is absent, the lifetime per-site counters.
//
// BOTH DNR APIs report every rule that ACTED on a request, not just blocking ones,
// and neither reports the action type: `gpc.json` rule 5000 sets Sec-GPC on nearly
// every request and the allowlist's `allowAllRequests` rules fire exactly where
// Nullecho blocked nothing. `classifyMatchedRule()` in protocol.js sorts a match
// into blocked / stripped / ignored by rule id; every path into these counters,
// including (3), goes through it. Chrome's own action-count badge
// (`setExtensionActionOptions({ displayActionCountAsBadgeText })`) is NOT used:
// measured, it counted 11 on a page where Nullecho blocked 4 — the other 7 were
// rule 5000 adding the GPC header.

/** Bump a domain's count in a per-site table, respecting the table's size cap. */
function bumpTracker(table, domain) {
  // Table full: keep counting the domains we already know about, drop new ones.
  if (table[domain] === undefined && Object.keys(table).length >= MAX_TRACKERS_PER_SITE) return;
  table[domain] = (table[domain] || 0) + 1;
}

/** A request Nullecho cancelled. This is what the lifetime "requests blocked" counts. */
function recordBlocked({ site, trackerDomain, category }) {
  if (!site) return;
  const s = siteStats(site);
  s.blocked += 1;
  s.lastSeen = Date.now();
  if (category) s.byCategory[category] = (s.byCategory[category] || 0) + 1;
  if (trackerDomain) bumpTracker(s.trackers, trackerDomain);
  scheduleFlush();
}

/**
 * A request the heuristic yellowlist let through with its Cookie / Set-Cookie
 * headers removed — the domain carries something visible (embedded video, live
 * chat) that blocking would break, so it keeps the resource and loses the
 * identity. Counted apart from `blocked`, because it was not blocked.
 */
function recordCookieStripped({ site, trackerDomain, category }) {
  if (!site) return;
  const s = siteStats(site);
  s.cookieStripped += 1;
  s.lastSeen = Date.now();
  if (category) s.byCategory[category] = (s.byCategory[category] || 0) + 1;
  if (trackerDomain) bumpTracker(s.cookieTrackers, trackerDomain);
  scheduleFlush();
}

/** Route one matched rule to the counter that describes what it actually did. */
function recordMatch(rule, request) {
  const { outcome, category } = classifyMatchedRule(rule);
  if (outcome === OUTCOME.IGNORED) return;

  // Attribute to the *page* the request was made from, not the tracker's own
  // domain — "trackers blocked on this site" is the number the user cares about.
  const site = siteKeyFor(request.initiator || request.documentUrl || request.url);
  const trackerDomain = siteKeyFor(request.url);

  if (outcome === OUTCOME.BLOCKED) recordBlocked({ site, trackerDomain, category });
  else recordCookieStripped({ site, trackerDomain, category });
}

/** Source (1). Present in unpacked Chrome/Edge builds only. */
const HAS_DEBUG_MATCHES = !!api.declarativeNetRequest?.onRuleMatchedDebug;
if (HAS_DEBUG_MATCHES) {
  api.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    await ready();
    recordMatch(info.rule, info.request);
  });
}

// ── source (3): the browser's own "an extension blocked this", attributed ────

/**
 * Nullecho's block rules as the browser runs them: the ENABLED static blocking
 * rulesets plus the dynamic rules (the learner's blocks). The static half is
 * re-read after a settings change (`invalidateBlockMatcher()`) and every 5 min;
 * the dynamic half is re-read, at most once a second, whenever a reported block
 * matches nothing — which is what a freshly promoted learned rule looks like.
 */
let blockMatcher = null;
let blockMatcherAt = 0;
let staticBlockRules = null;
let dynamicBlockRules = [];
let dynamicCheckedAt = 0;
let blockMatcherWork = null;

function invalidateBlockMatcher() { blockMatcher = null; staticBlockRules = null; }

async function rebuildBlockMatcher({ refreshDynamic }) {
  if (!staticBlockRules || Date.now() - blockMatcherAt > 5 * 60_000) {
    const enabled = new Set(await api.declarativeNetRequest.getEnabledRulesets());
    const rulesets = [];
    for (const id of BLOCKING_RULESET_IDS) {
      if (enabled.has(id)) rulesets.push({ id, rules: await loadRuleset(id) });
    }
    staticBlockRules = rulesets;
    refreshDynamic = true;
    blockMatcher = null;
  }
  if (refreshDynamic) {
    const dynamic = await api.declarativeNetRequest.getDynamicRules();
    dynamicCheckedAt = Date.now();
    if (blockMatcher && JSON.stringify(dynamic) === JSON.stringify(dynamicBlockRules)) return blockMatcher;
    dynamicBlockRules = dynamic;
    blockMatcher = null;
  }
  if (!blockMatcher) {
    blockMatcher = buildMatcher({ rulesets: staticBlockRules, dynamic: dynamicBlockRules });
    blockMatcherAt = Date.now();
  }
  return blockMatcher;
}

async function getBlockMatcher({ fresh = false } = {}) {
  const needStatic = !blockMatcher || !staticBlockRules || Date.now() - blockMatcherAt > 5 * 60_000;
  const needDynamic = fresh && Date.now() - dynamicCheckedAt > 1000;
  if (!needStatic && !needDynamic) return blockMatcher;
  if (!blockMatcherWork) {
    blockMatcherWork = rebuildBlockMatcher({ refreshDynamic: needDynamic }).finally(() => { blockMatcherWork = null; });
  }
  return blockMatcherWork;
}

/**
 * Per-tab tally of requests Nullecho blocked on the page now open in each tab.
 * Kept in `storage.session` (memory only — cleared when the browser closes, never
 * written to disk, never synced) because the background is suspended when idle
 * in both engines, and an in-memory count would silently restart at zero. A
 * top-level navigation starts the tab's count again; a closed tab's is dropped.
 */
const TAB_TALLY_KEY = 'nullecho:tab-blocked';
const TAB_TALLY_MAX = 300;
let tabTallies = null;
let tabTallyTimer = null;

async function tallies() {
  if (tabTallies) return tabTallies;
  let stored = null;
  try { stored = (await api.storage.session?.get(TAB_TALLY_KEY))?.[TAB_TALLY_KEY] ?? null; } catch { stored = null; }
  if (!tabTallies) tabTallies = stored && typeof stored === 'object' ? stored : {};
  return tabTallies;
}

function saveTallies() {
  if (tabTallyTimer) return;
  tabTallyTimer = setTimeout(async () => {
    tabTallyTimer = null;
    try { await api.storage.session?.set({ [TAB_TALLY_KEY]: tabTallies }); } catch (e) { warn('tab tally')(e); }
  }, 500);
}

async function resetTab(tabId) {
  const t = await tallies();
  if (t[tabId]) { delete t[tabId]; saveTallies(); }
}

async function countBlockedInTab(tabId, category) {
  const t = await tallies();
  const keys = Object.keys(t);
  if (!t[tabId] && keys.length >= TAB_TALLY_MAX) delete t[keys[0]];
  const rec = t[tabId] ?? (t[tabId] = { total: 0, byCategory: {} });
  rec.total += 1;
  rec.byCategory[category] = (rec.byCategory[category] || 0) + 1;
  saveTallies();
}

/**
 * One request the browser says an extension cancelled. Counted only if one of
 * Nullecho's own block rules covers it, and never on a site the user switched
 * Nullecho off for (another blocker's work there is not ours).
 */
export async function onRequestError(details) {
  if (!EXTENSION_BLOCK_ERRORS.has(details?.error)) return;
  const req = requestFacts(details);
  if (req.tabId < 0 || !req.host) return;
  await ready();
  const site = siteKeyFor(req.initiatorUrl || req.url);
  if (site && allowlist.has(site)) return;
  let rule = (await getBlockMatcher()).match(req);
  if (!rule) rule = (await getBlockMatcher({ fresh: true })).match(req);
  if (!rule) return;
  const { outcome, category } = classifyMatchedRule(rule);
  if (outcome !== OUTCOME.BLOCKED) return;
  await countBlockedInTab(req.tabId, category);
  if (!HAS_DEBUG_MATCHES) recordBlocked({ site, trackerDomain: siteKeyFor(req.url), category });
}

/** MUST NOT throw: it runs on the worker's top level, above the message listener (D42). */
function installBlockCounter() {
  const wr = api.webRequest;
  const urls = ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'];
  try {
    wr?.onErrorOccurred?.addListener((d) => { onRequestError(d).catch(warn('block counter')); }, { urls });
    // A new top-level document starts the tab's count again. `onSendHeaders`, not
    // `onBeforeRequest`: no URL-only observer is registered anywhere in this
    // worker (review A5 — a page writes every byte of a URL), and this one reads
    // nothing but the tab id.
    wr?.onSendHeaders?.addListener((d) => { if (d.tabId >= 0) resetTab(d.tabId).catch(() => {}); },
      { urls, types: ['main_frame'] });
    api.tabs?.onRemoved?.addListener((tabId) => { resetTab(tabId).catch(() => {}); });
  } catch (e) {
    warn('installBlockCounter')(e);
  }
}
installBlockCounter();

/**
 * The page count the popup shows (D55). Chrome/Edge: `getMatchedRules` for the
 * tab — the browser's own account — sorted by `classifyMatchedRule`. Where that
 * API is absent (Firefox) or its quota is spent, the webRequest tally for the
 * tab, which says so in `source`; `error` carries why the first one failed.
 */
async function blockedOnPage(tabId) {
  let error = null;
  if (api.declarativeNetRequest?.getMatchedRules) {
    try {
      const res = await api.declarativeNetRequest.getMatchedRules({ tabId });
      const byCategory = {};
      let total = 0;
      let stripped = 0;
      for (const m of res?.rulesMatchedInfo ?? []) {
        const { outcome, category } = classifyMatchedRule(m.rule);
        if (outcome === OUTCOME.BLOCKED) {
          total += 1;
          byCategory[category] = (byCategory[category] || 0) + 1;
        } else if (outcome === OUTCOME.STRIPPED) {
          stripped += 1;
        }
      }
      return { total, byCategory, stripped, source: 'getMatchedRules' };
    } catch (e) {
      error = /quota/i.test(String(e?.message ?? e)) ? 'quota' : 'unavailable';
    }
  }
  const t = (await tallies())[tabId];
  return { total: t?.total ?? 0, byCategory: { ...(t?.byCategory ?? {}) }, stripped: null, source: 'webRequest', error };
}

// ═══════════════════════════════════════════════════════════════════════════
// D59 — bot-manager stand-down: the observer (the rules are in bot-manager.js)
// ═══════════════════════════════════════════════════════════════════════════
//
// A site whose OWN response sets a measured bot manager's cookie gets the device
// layer stood down; blocking and GPC stay on. The decision has to be in place
// before the site's sensor runs — after one denial the next load is denied too —
// so it is taken from the response headers of the first document itself, which
// reach this worker before the loader's GET_PERSONA does (measured 2026-10-17 on
// tesla.com: 12-14 ms ahead with the worker running; with it stopped, the response
// event is what wakes it and is delivered first — research/bot-manager-2026-10/
// timing/). The handler queues on `ready()`, the same
// promise `handleShell` awaits, so a response heard first is recorded first.

/** Is the device layer standing down on this site? */
function botManagerStandsDown(site) {
  const e = botSites?.[site];
  return !!e && e.override !== true;
}

function botManagerReport(site) {
  const e = botSites?.[site];
  if (!e) return null;
  return {
    vendor: e.vendor,
    label: vendorLabel(e.vendor),
    cookie: e.cookie,
    at: e.at,
    override: e.override === true,
    standingDown: e.override !== true,
  };
}

/** tabId → the last top-frame handshake in it: { site, at, active }. Memory only. */
const topDocuments = new Map();
const TOP_DOCUMENTS_MAX = 300;

function noteTopDocument(tabId, rec) {
  if (!topDocuments.has(tabId) && topDocuments.size >= TOP_DOCUMENTS_MAX) {
    topDocuments.delete(topDocuments.keys().next().value);
  }
  topDocuments.set(tabId, rec);
}

/**
 * One response header event. Exported for the tests. Returns the work promise,
 * or undefined when the response is not a first-party bot-manager cookie.
 */
export function onBotManagerHeaders(details) {
  const hit = topLevelHit(details);
  if (!hit) return undefined;
  return ready().then(() => recordBotManager(hit, details)).catch(warn('bot-manager'));
}

async function recordBotManager(hit, details) {
  if (botSites[hit.site]) return;                 // known already: nothing changes, nothing is written
  const now = Date.now();
  // Synchronous up to the first `await`, so a GET_PERSONA queued behind this
  // event on `ready()` already sees the record.
  const entry = { vendor: hit.vendor, cookie: hit.cookie, at: now, override: false };
  botSites[hit.site] = entry;
  pruneBotManagerSites(botSites);

  const reload = lateFlagReload({
    entry, isNew: true, topDoc: topDocuments.get(details.tabId), site: hit.site,
    mainFrame: hit.mainFrame, responseAt: Number(details.timeStamp) || now, now,
  });
  // Recorded BEFORE the reload is issued, and persisted with the flag: the guard
  // that makes a second reload for this site impossible survives the worker.
  if (reload) entry.reloadedAt = now;
  await api.storage.local.set({ [BOT_MANAGER_STORAGE_KEY]: botSites });
  if (reload) {
    try { await api.tabs?.reload?.(details.tabId); } catch (e) { warn('bot-manager reload')(e); }
  }
}

// The response listener itself is registered by `heuristics.install()` at the top
// of this file (`responseObservers`). A closed tab's record goes with it.
bootStep('botManager.tabs', () => { api.tabs?.onRemoved?.addListener((tabId) => { topDocuments.delete(tabId); }); });

// ═══════════════════════════════════════════════════════════════════════════
// Message surface — ONE listener, registered synchronously (see header)
// ═══════════════════════════════════════════════════════════════════════════

/** Message types owned by §2. Anything else falls through to the §1 handlers. */
const SHELL_TYPES = new Set(Object.values(MSG));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ── §1 ──
  // There is deliberately NO page-side strike source here. The shim's
  // `nullecho:fp-detected` report says "some script read the canvas"; it does
  // not say WHICH third party's script, and blaming an unattributed read on
  // whichever third party happens to be on the page would let a page get an
  // arbitrary domain blocked. See heuristics.js `handleContentReport`.
  switch (message?.type) {
    case 'nullecho:heuristics:state':
      heuristics.getState().then(sendResponse);
      return true;
    case 'nullecho:heuristics:stats':
      heuristics.stats().then(sendResponse);
      return true;
    case 'nullecho:heuristics:setStatus':
      heuristics.setDomainStatus(message.domain, message.status)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: String(e.message) }));
      return true;
    case 'nullecho:heuristics:reset':
      heuristics.reset().then(() => sendResponse({ ok: true }));
      return true;
    case GPC_MSG.SET_ENABLED:
      globalThis.NullechoGPC.setEnabled(message.enabled).then(() => sendResponse({ ok: true }));
      return true;
    case GPC_MSG.SET_SITE_EXCEPTION:
      globalThis.NullechoGPC.setSiteException(message.host, message.excepted)
        .then(() => sendResponse({ ok: true }));
      return true;
  }

  // ── §2 ──
  if (SHELL_TYPES.has(message?.type)) {
    handleShell(message, sender)
      .then(sendResponse)
      .catch((err) => {
        console.error('[nullecho] message handler failed', message?.type, err);
        sendResponse({ ok: false, error: String(err?.message ?? err) });
      });
    return true;
  }

  return false;
});

async function handleShell(msg, sender) {
  await ready();
  switch (msg.type) {
    case MSG.GET_PERSONA:      return onGetPersona(sender);
    case MSG.FP_DETECTED:      return onFpDetected(msg, sender);
    case MSG.SHIM_STATUS:      return onShimStatus(msg, sender);
    case MSG.GET_SITE_REPORT:  return onGetSiteReport(msg);
    case MSG.GET_OVERVIEW:     return onGetOverview();
    case MSG.ROTATE_SALT:      return onRotateSalt();
    case MSG.SET_SITE_ENABLED: return onSetSiteEnabled(msg);
    case MSG.SET_SETTINGS:     return onSetSettings(msg);
    case MSG.CLEAR_STATS:      return onClearStats(msg);
    case MSG.SET_BOT_MANAGER_OVERRIDE: return onSetBotManagerOverride(msg);
    default:                   return { ok: false, error: 'unknown message type' };
  }
}

/**
 * The frame is asking "who am I on this site?".
 *
 * The origin comes from `sender` — the browser's own account of where the content
 * script is running. We never read an origin out of the message body.
 */
function onGetPersona(sender) {
  const site = senderSiteKey(sender);
  if (!site) return { ok: false, error: 'unsupported scheme' };

  const enabled = !allowlist.has(site);
  // D59: the site's own responses carried a bot-manager cookie and the user has
  // not overridden it → the device layer stands down here; blocking and GPC do not.
  const botManager = enabled && botManagerStandsDown(site);
  const persona = personaFor(identity.salt, site);

  const s = siteStats(site);
  s.lastSeen = Date.now();
  s.personaId = persona.id;
  scheduleFlush();

  // The tab's top document and whether it got a device profile — the one fact the
  // D59 race fallback needs (`lateFlagReload`). The browser's own frame id and tab.
  if (sender?.frameId === 0 && Number.isInteger(sender?.tab?.id)) {
    noteTopDocument(sender.tab.id, { site, at: Date.now(), active: enabled && !botManager });
  }

  return {
    ok: true,
    site,
    enabled,
    // Global toggle minus any per-site GPC exception the user added. The ~50
    // shipped breakage hosts never get here — the gpc.js content script is
    // excluded from them in the manifest.
    gpc: settings.gpc && !globalThis.NullechoGPC.isExceptedSync(site),
    loudFailures: settings.loudFailures,
    fpStandDown: botManager ? FP_STAND_DOWN.BOT_MANAGER : null,
    // Only this origin's persona. The salt itself never crosses this boundary.
    persona: enabled && !botManager ? persona : null,
  };
}

function onFpDetected(msg, sender) {
  const site = senderSiteKey(sender);
  if (!site) return { ok: false };
  const s = siteStats(site);
  const n = Number.isFinite(msg.count) ? msg.count : 1;
  const apiName = String(msg.api ?? 'unknown').slice(0, 48);
  s.fp += n;
  s.fpByApi[apiName] = (s.fpByApi[apiName] || 0) + n;
  s.lastSeen = Date.now();
  scheduleFlush();
  return { ok: true };
}

function onShimStatus(msg, sender) {
  const site = senderSiteKey(sender);
  if (!site) return { ok: false };
  const s = siteStats(site);

  // `nonce-exposed` is STICKY, and deliberately not stored in `lastShimStatus`.
  //
  // The loader reports it the instant a MAIN-world script's boot event arrives
  // late, which is milliseconds BEFORE that script reports its own (usually
  // healthy) outcome. In a last-writer-wins slot the warning would be recorded and
  // then immediately erased — a report that exists in the code and never reaches
  // the user, which is worse than no report at all because it looks like it works.
  //
  // What it means: the page-world script lost the document_start race, so the
  // handshake nonce may have been observed by page script, AND the shim probably
  // lost the fingerprint race on this page too. One race governs both.
  if (msg.reason === 'nonce-exposed') {
    s.nonceExposedAt = Date.now();
    scheduleFlush();
    return { ok: true };
  }

  // A sub-frame that never booted is COUNTED, not shown as the page's status (D48).
  // `lastShimStatus` drives the popup's "did not start on this page" line, which
  // must describe the document the user is looking at; an ad frame that failed
  // to answer is a different fact. `sender.frameId` is the browser's own word on
  // which frame sent this (0 = top); the message's `top` is the fallback for a
  // sender that carries none.
  const fromSubFrame = typeof sender?.frameId === 'number' ? sender.frameId !== 0 : msg.top === false;
  if (msg.reason === 'shim-never-booted' && fromSubFrame) {
    s.subFrameMisses = (s.subFrameMisses | 0) + 1;
    scheduleFlush();
    return { ok: true };
  }

  s.lastShimStatus = {
    upgraded: !!msg.upgraded,
    lockedToFallback: !!msg.lockedToFallback,
    reason: msg.reason ? String(msg.reason).slice(0, 120) : null,
    at: Date.now(),
  };
  if (Array.isArray(msg.failures)) {
    const have = Array.isArray(s.patchFailures) ? s.patchFailures : [];
    for (const f of msg.failures) {
      if (typeof f !== 'string' || !f || have.includes(f) || have.length >= 8) continue;
      have.push(f.slice(0, 80));
    }
    s.patchFailures = have;
  }
  scheduleFlush();
  return { ok: true };
}

async function onGetSiteReport(msg) {
  const site = siteKeyFor(msg.url) || String(msg.site ?? '');
  if (!site) {
    return { ok: true, site: null, reason: 'Nullecho only runs on http and https pages.' };
  }
  const s = stats[site] ?? blankSite();
  const persona = personaFor(identity.salt, site);
  const live = Number.isInteger(msg.tabId) ? await blockedOnPage(msg.tabId) : null;

  const byCount = (t) => Object.entries(t ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([domain, count]) => ({ domain, count }));

  const trackers = byCount(s.trackers);

  // GPC per site, not per install. `isEnabledForSite` is false when the ruleset
  // is off OR the site is excepted, so the two cases are separated here — "you
  // switched it off" and "this site breaks with it on" are different sentences
  // and get different remedies.
  let gpcSent = false;
  try { gpcSent = await globalThis.NullechoGPC.isEnabledForSite(site); }
  catch (e) { warn('gpc.isEnabledForSite')(e); }

  // "You turned it off here" and "it ships off here because the site breaks"
  // are different sentences with different remedies, and only one of them is a
  // switch the user can flip back. The popup needs to know which (G1 / G4).
  let gpcUserExcepted = false;
  try { gpcUserExcepted = await globalThis.NullechoGPC.isUserExcepted(site); }
  catch (e) { warn('gpc.isUserExcepted')(e); }

  return {
    ok: true,
    site,
    enabled: !allowlist.has(site),
    persona,
    /** D59: null, or why (and whether) the device layer stands down on this site. */
    botManager: botManagerReport(site),
    settings,
    gpc: {
      sent: gpcSent,
      /** Signal is on globally but suppressed here specifically. */
      excepted: !!settings.gpc && !gpcSent,
      /** …and the user is the one who suppressed it, so they can undo it. */
      userExcepted: gpcUserExcepted,
    },
    strictFingerprinting: await strictFingerprintingEnabled(),
    /**
     * owner → how many of the user's own sites that company was also present on.
     * Company names and counts only; no origins cross this boundary. Feeds the
     * report's LOCAL-only reach finding, which `siteShareCard()` strips.
     */
    crossSiteReach: reachByOwner(buildLinkageGraph(stats)),
    identity: publicIdentity(),
    stats: {
      blocked: s.blocked,
      fp: s.fp,
      fpByApi: s.fpByApi,
      byCategory: s.byCategory,
      lastShimStatus: s.lastShimStatus,
      patchFailures: Array.isArray(s.patchFailures) ? s.patchFailures : [],
      nonceExposedAt: s.nonceExposedAt ?? 0,
      trackers,
      // Requests allowed through with their cookies removed. Reported separately
      // from `blocked` because they were not blocked.
      cookieStripped: s.cookieStripped ?? 0,
      cookieTrackers: byCount(s.cookieTrackers),
      // True when we have real per-request URLs (unpacked Chrome / dev builds).
      trackerListComplete: trackers.length > 0,
    },
    live,
    /**
     * Where the lifetime per-site counters come from in this build (D55):
     * 'debug' = onRuleMatchedDebug (unpacked Chrome/Edge, cookie strips included);
     * 'webRequest' = attributed browser block reports (every packed build; no
     * cookie strips, which the browser does not report).
     */
    lifetimeSource: HAS_DEBUG_MATCHES ? 'debug' : 'webRequest',
  };
}

function publicIdentity() {
  // A short, non-reversible tag so the user can see that "New identity" changed
  // something, without ever rendering the salt itself.
  const tag = hashString(`nullecho-identity-tag::${identity.salt}`)
    .toString(16).padStart(8, '0').slice(0, 6).toUpperCase();
  return { tag, rotatedAt: identity.rotatedAt };
}

/**
 * Distinct tracker domains per site, biggest first, capped.
 *
 * The options page builds the cross-site graph itself from these, rather than
 * receiving a pre-built graph: `linkage.js` is then the code that actually runs
 * in the page, so a design review of the rendered page is a review of the real
 * module and not of a fixture shaped like its output.
 *
 * The cap bounds the message — MAX_SITES × MAX_TRACKERS_PER_SITE is 30,000
 * strings worst case — and costs nothing that matters: a company past a site's
 * 25th busiest tracker domain is essentially always present via a busier one.
 */
const OVERVIEW_TRACKERS_PER_SITE = 25;

function onGetOverview() {
  const sites = Object.entries(stats)
    .map(([site, s]) => ({
      site,
      blocked: s.blocked,
      fp: s.fp,
      lastSeen: s.lastSeen,
      enabled: !allowlist.has(site),
      persona: summarisePersona(personaFor(identity.salt, site)),
      trackers: Object.entries(s.trackers ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, OVERVIEW_TRACKERS_PER_SITE)
        .map(([domain]) => domain),
    }))
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));

  return {
    ok: true,
    settings,
    allowlist: [...allowlist].sort(),
    /** D59: every site a bot manager made the device layer stand down on, newest first. */
    botManagerSites: Object.keys(botSites)
      .map((site) => ({ site, ...botManagerReport(site) }))
      .sort((a, b) => (b.at || 0) - (a.at || 0)),
    identity: publicIdentity(),
    sites,
    /**
     * The personas this machine can actually be shown, not the whole table.
     * Since D12 selection is constrained to the host's OS family, so listing
     * all 16 would promise a variety the user does not get — the options page
     * would be making a claim the code contradicts (THREAT-MODEL.md, copy
     * rules). `personasForFamily()` is the same function selection uses.
     */
    hostFamily: hostFamily(),
    pool: personasForFamily(hostFamily()).map((p) => ({
      id: p.id,
      platform: p.platform,
      os: p.os,
      weight: p.weight,
      gpu: p.gpu.renderer,
      cores: p.cores,
      memory: p.memory,
      screen: `${p.screen.width}×${p.screen.height} @${p.screen.dpr}x`,
    })),
    /**
     * D54 — did the most recent page the shim reported from say Firefox's
     * resistFingerprinting is on? Read from the persisted per-site statuses, so it
     * survives the worker being suspended.
     */
    resistFingerprinting: latestShimReason() === 'resist-fingerprinting',
    lifetimeSource: HAS_DEBUG_MATCHES ? 'debug' : 'webRequest',
    totals: {
      blocked: Object.values(stats).reduce((a, s) => a + (s.blocked || 0), 0),
      fp: Object.values(stats).reduce((a, s) => a + (s.fp || 0), 0),
      sites: Object.keys(stats).length,
    },
  };
}

/** The reason in the newest `lastShimStatus` across every site, or null. */
function latestShimReason() {
  let best = null;
  for (const s of Object.values(stats)) {
    const st = s?.lastShimStatus;
    if (st && (!best || (st.at ?? 0) > (best.at ?? 0))) best = st;
  }
  return best?.reason ?? null;
}

function summarisePersona(p) {
  return {
    id: p.id,
    platform: p.platform,
    os: p.os,
    gpu: p.gpu.renderer,
    cores: p.cores,
    memory: p.memory,
  };
}

async function onRotateSalt() {
  identity = { salt: newSalt(), rotatedAt: Date.now() };
  await api.storage.local.set({ identity });
  // Personas are pure functions of (salt, site), so nothing else needs clearing.
  // Per-site *counters* are history, not identity — we keep them.
  return { ok: true, identity: publicIdentity() };
}

async function onSetSiteEnabled(msg) {
  const site = siteKeyFor(msg.url) || String(msg.site ?? '');
  if (!site) return { ok: false, error: 'no site' };
  if (msg.enabled) allowlist.delete(site);
  else allowlist.add(site);
  await api.storage.local.set({ allowlist: [...allowlist] });
  await syncAllowlistRules().catch(warn('syncAllowlistRules'));
  return { ok: true, site, enabled: !allowlist.has(site) };
}

async function onSetSettings(msg) {
  const patch = msg.patch ?? {};
  const gpcChanged = 'gpc' in patch && patch.gpc !== settings.gpc;

  settings = {
    ...settings,
    ...patch,
    categories: { ...settings.categories, ...(patch.categories ?? {}) },
  };
  await api.storage.local.set({ settings });
  await applyRulesets().catch(warn('applyRulesets'));
  invalidateBlockMatcher();   // the enabled rulesets may have changed (D55)

  // GPC is owned by gpc.js — header rule, JS property and per-site exceptions
  // move together, so route the toggle through it rather than flipping the
  // ruleset here.
  if (gpcChanged) {
    await globalThis.NullechoGPC.setEnabled(settings.gpc).catch(warn('NullechoGPC.setEnabled'));
  }

  await scheduleAutoRotate();
  return { ok: true, settings };
}

async function onSetBotManagerOverride(msg) {
  const site = siteKeyFor(msg.url) || String(msg.site ?? '');
  const entry = site ? botSites[site] : null;
  if (!entry) return { ok: false, error: 'not a bot-manager site' };
  entry.override = msg.override === true;
  await api.storage.local.set({ [BOT_MANAGER_STORAGE_KEY]: botSites });
  return { ok: true, site, ...botManagerReport(site) };
}

async function onClearStats(msg) {
  if (msg.site) delete stats[msg.site];
  else stats = {};
  await flushNow();
  // D59: the bot-manager list is a list of sites you loaded too, so "Clear site
  // history" clears it — overrides included. Nothing is lost that protects you: a
  // site's own next response flags it again, before its handshake.
  if (msg.site) delete botSites[msg.site];
  else botSites = {};
  await api.storage.local.set({ [BOT_MANAGER_STORAGE_KEY]: botSites });
  return { ok: true };
}

// ── automatic salt rotation ─────────────────────────────────────────────────

const ROTATE_ALARM = 'nullecho:auto-rotate';

async function scheduleAutoRotate() {
  if (!api.alarms) return;
  await api.alarms.clear(ROTATE_ALARM);
  if (!settings?.autoRotateDays) return;
  // Check hourly; rotate when the interval has actually elapsed. Cheaper and more
  // robust than one long alarm across browser restarts.
  api.alarms.create(ROTATE_ALARM, { periodInMinutes: 60 });
}

api.alarms?.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ROTATE_ALARM) return;
  await ready();
  const days = settings.autoRotateDays;
  if (!days) return;
  if (Date.now() - identity.rotatedAt >= days * 86400000) await onRotateSalt();
});

// ═══════════════════════════════════════════════════════════════════════════
// Lifecycle — one listener, both lanes
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await setStrictFingerprinting(false).catch(warn('setStrictFingerprinting'));
  }
  // Dynamic rules outlive our storage across updates; make sure the two agree.
  await heuristics.reconcile().catch(warn('heuristics.reconcile'));

  await ready();
  await scheduleAutoRotate();

  if (details.reason === 'install') {
    // A first-run page is the only honest place to state the non-goals up front
    // (THREAT-MODEL.md "Copy rules"). Opening options is the least-annoying form.
    api.runtime.openOptionsPage?.();
  }
});

api.runtime.onStartup?.addListener(() => { ready().then(scheduleAutoRotate); });

// Kick initialisation immediately so the first content-script message finds the
// worker warm rather than paying a cold start on top of the handshake.
ready();

// ═══════════════════════════════════════════════════════════════════════════
// §3 — price disclosure notice
// ═══════════════════════════════════════════════════════════════════════════
//
// A third lane, kept whole and at the end of the file rather than threaded
// through §2, because it shares nothing with the shell: its own listener, its
// own storage key, its own vocabulary. `handleShell` never sees these messages.
//
// The `import`s below are declarations, so they are hoisted and evaluated with
// the rest of this module's imports; they sit here to keep the lane in one
// readable piece. `pricing.js` has no exports — it is also a classic content
// script — so it arrives on `globalThis`, exactly as `gpc.js` does.
//
// What this block may and may not do:
//   · The site and the URL come from `sender` — the browser's own account of
//     where the content script is running — and NEVER from the message body,
//     the same rule `onGetPersona`/`onFpDetected` follow. A content script does
//     not get to say which site it is.
//   · One storage key, `PRICING_STORAGE_KEY`, listed in `docs/PRIVACY-POLICY.md`.
//     Nothing here transmits anything; there is no egress API in the shipped
//     tree and `manifest.test.js` fails the build if one appears.
//   · Nothing reaches a PAGE console (D33). A storage failure goes to the
//     worker's own `warn`, which no page can see, and it never carries the
//     observed text or the price — a log line about a price is a log line about
//     a person. The content script itself has no console call at all.

import './pricing.js';
import { PRICING_MSG, PRICING_STORAGE_KEY } from './protocol.js';

/** Observations live on the device only. Read lazily; the popup is the only reader. */
async function pricingList() {
  try {
    const got = await api.storage.local.get([PRICING_STORAGE_KEY]);
    const list = got?.[PRICING_STORAGE_KEY];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/** The single writer. One key, one call site — so "one key" stays checkable. */
async function savePricingList(list) {
  try { await api.storage.local.set({ [PRICING_STORAGE_KEY]: list }); }
  catch (e) { warn('pricing.store')(e); }
}

async function onPricingObserved(msg, sender) {
  const site = senderSiteKey(sender);
  if (!site) return { ok: false };

  const P = globalThis.NullechoPricing;
  const entry = P.observation({
    siteKey: site,
    url: sender?.url ?? '',
    level: String(msg?.level ?? ''),
    price: msg?.price ?? null,
    currency: msg?.currency ?? null,
    context: String(msg?.context ?? ''),
  });
  // A level this build does not know about is not stored. The content script and
  // this worker ship together, so the only way to get one is tampering.
  if (!Object.prototype.hasOwnProperty.call(P.SENTENCES, entry.level)) return { ok: false };
  if (!entry.url) return { ok: false };

  await savePricingList(P.pushReceipt(await pricingList(), entry));
  return { ok: true };
}

/**
 * The popup asks once per open. Returns the most recent observation for the
 * site or `null` — and `null` is the answer for almost every site, which is the
 * point: a notice that appeared on every page would be noise.
 */
async function onPricingForSite(msg) {
  const site = String(msg?.site ?? '');
  if (!site) return { ok: true, observation: null };
  const list = await pricingList();
  let best = null;
  for (const e of list) {
    if (e?.siteKey !== site) continue;
    if (!best || (e.timestamp ?? 0) >= (best.timestamp ?? 0)) best = e;
  }
  return { ok: true, observation: best };
}

/** How many observations are stored — the options page shows it next to its clear button. */
async function onPricingCount() {
  return { ok: true, count: (await pricingList()).length };
}

/** The user's own delete. Whole list, or one site. Called by the options page's "Clear saved price notices". */
async function onPricingForget(msg) {
  const site = msg?.site ? String(msg.site) : null;
  await savePricingList(site ? (await pricingList()).filter((e) => e?.siteKey !== site) : []);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let work = null;
  switch (message?.type) {
    case PRICING_MSG.OBSERVED:     work = onPricingObserved(message, sender); break;
    case PRICING_MSG.GET_FOR_SITE: work = onPricingForSite(message); break;
    case PRICING_MSG.FORGET:       work = onPricingForget(message); break;
    case PRICING_MSG.COUNT:        work = onPricingCount(); break;
    default: return false;
  }
  work.then(sendResponse).catch(() => sendResponse({ ok: false }));
  return true;
});
