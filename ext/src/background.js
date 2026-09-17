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
import {
  MSG,
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

heuristics.install();

void globalThis.NullechoGPC.init();

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
async function strictFingerprintingRuleIds() {
  if (strictFpRuleIds) return strictFpRuleIds;
  try {
    const res = await fetch(chrome.runtime.getURL('rules/fingerprinting.json'));
    const rules = await res.json();
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
 *          lastShimStatus, nonceExposedAt }
 * @type {Record<string, any> | null}
 */
let stats = null;

let readyPromise = null;

function ready() {
  if (!readyPromise) readyPromise = init();
  return readyPromise;
}

async function init() {
  const got = await api.storage.local.get(['identity', 'settings', 'allowlist', 'stats']);

  identity = got.identity ?? { salt: newSalt(), rotatedAt: Date.now() };
  settings = { ...DEFAULT_SETTINGS, ...(got.settings ?? {}) };
  settings.categories = { ...DEFAULT_SETTINGS.categories, ...(got.settings?.categories ?? {}) };
  allowlist = new Set(got.allowlist ?? []);
  stats = got.stats ?? {};

  if (!got.identity) await api.storage.local.set({ identity });

  await Promise.all([
    applyRulesets().catch(warn('applyRulesets')),
    applyUaRuleset().catch(warn('applyUaRuleset')),
    syncAllowlistRules().catch(warn('syncAllowlistRules')),
  ]);
}

const warn = (where) => (err) => console.warn(`[nullecho] ${where} failed:`, err);

// ── DNR: the host family's User-Agent / Client-Hint ruleset ─────────────────
//
// The shim pins `navigator.userAgent` / `userAgentData` to the persona, but a
// header the browser writes contradicts it on every request unless it is
// rewritten too (REVIEW-2026-09-16 B2). Personas are per-origin, and the persona
// for an origin is only known after that origin's handshake — which is AFTER its
// first `main_frame` request has gone out. What is known before any request is
// the host's OS family (D12), and every persona this machine can be shown — the
// pre-handshake fallback included — belongs to it. So the header is rewritten at
// FAMILY level by one of three static rulesets, and this picks the right one.
//
// Static ruleset enablement persists across browser sessions and is reset only
// by an extension update, and `init()` runs at every worker start, so the window
// in which real headers go out is the few milliseconds of the first worker start
// after install/update — no worse than the state before the rulesets existed.
// See DECISIONS.md D19 for the residuals this leaves.

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
     * When a MAIN-world script last booted after page script had already run, as
     * measured by `shim-loader.js` from the ISOLATED world. Sticky, because the
     * shim's own (healthy-looking) status arrives right afterwards and would
     * otherwise overwrite it. 0 = never seen on this site.
     */
    nonceExposedAt: 0,
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
 *     5 100 –     5 399  static per-family UA / Client-Hint rulesets (ua-win/mac/linux)
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
// Chrome: `onRuleMatchedDebug` gives us the request URL *and* the ruleset id, but
// it only fires for UNPACKED extensions. In a packed build the popup falls back
// to `getMatchedRules()`, which gives counts + ruleset ids but no URLs — so the
// tracker *list* degrades to a per-category breakdown. The popup labels which of
// the two it is showing rather than silently implying it has the full list.
//
// BOTH APIs report every rule that ACTED on a request, not just blocking ones,
// and neither reports the action type. Feeding them straight into a counter
// called "requests blocked" therefore counts the wrong things — most of all
// `gpc.json` rule 5000, which sets Sec-GPC on nearly every request, and the
// allowlist's `allowAllRequests` rules, which fire exactly where Nullecho blocked
// nothing. `classifyMatchedRule()` in protocol.js sorts a match into blocked /
// stripped / ignored by rule id; every path into these counters goes through it.
//
// Firefox: `webRequest` is available (the heuristics layer already uses it), so
// precise per-request attribution is possible there. Wiring that into these
// counters is a v0.2 item; the shape of `recordBlocked()` is already right for it.

/** Bump a domain's count in a per-site table, respecting the table's size cap. */
function bumpTracker(table, domain) {
  // Table full: keep counting the domains we already know about, drop new ones.
  if (table[domain] === undefined && Object.keys(table).length >= MAX_TRACKERS_PER_SITE) return;
  table[domain] = (table[domain] || 0) + 1;
}

/** A request Nullecho cancelled. This is what the popup's "requests blocked" counts. */
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

if (api.declarativeNetRequest?.onRuleMatchedDebug) {
  api.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    await ready();
    recordMatch(info.rule, info.request);
  });
}

/** Live per-tab matched rules, used by the popup. Packed-build fallback path. */
async function matchedRulesForTab(tabId) {
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
    return { total, byCategory, stripped };
  } catch {
    // Quota exhausted, unsupported, or no host access for the tab.
    return null;
  }
}

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
    case 'nullecho:gpc:setEnabled':
      globalThis.NullechoGPC.setEnabled(message.enabled).then(() => sendResponse({ ok: true }));
      return true;
    case 'nullecho:gpc:setSiteException':
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
  const frameUrl = sender?.url || sender?.origin || '';
  const site = siteKeyFor(frameUrl);
  if (!site) return { ok: false, error: 'unsupported scheme' };

  const enabled = !allowlist.has(site);
  const persona = personaFor(identity.salt, site);

  const s = siteStats(site);
  s.lastSeen = Date.now();
  s.personaId = persona.id;
  scheduleFlush();

  return {
    ok: true,
    site,
    enabled,
    // Global toggle minus any per-site GPC exception the user added. The ~50
    // shipped breakage hosts never get here — the gpc.js content script is
    // excluded from them in the manifest.
    gpc: settings.gpc && !globalThis.NullechoGPC.isExceptedSync(site),
    loudFailures: settings.loudFailures,
    // Only this origin's persona. The salt itself never crosses this boundary.
    persona: enabled ? persona : null,
  };
}

function onFpDetected(msg, sender) {
  const site = siteKeyFor(sender?.url || sender?.origin || '');
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
  const site = siteKeyFor(sender?.url || sender?.origin || '');
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

  s.lastShimStatus = {
    upgraded: !!msg.upgraded,
    lockedToFallback: !!msg.lockedToFallback,
    reason: msg.reason ? String(msg.reason).slice(0, 120) : null,
    at: Date.now(),
  };
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
  const live = Number.isInteger(msg.tabId) ? await matchedRulesForTab(msg.tabId) : null;

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

  return {
    ok: true,
    site,
    enabled: !allowlist.has(site),
    persona,
    settings,
    gpc: {
      sent: gpcSent,
      /** Signal is on globally but suppressed here specifically. */
      excepted: !!settings.gpc && !gpcSent,
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
    totals: {
      blocked: Object.values(stats).reduce((a, s) => a + (s.blocked || 0), 0),
      fp: Object.values(stats).reduce((a, s) => a + (s.fp || 0), 0),
      sites: Object.keys(stats).length,
    },
  };
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

  // GPC is owned by gpc.js — header rule, JS property and per-site exceptions
  // move together, so route the toggle through it rather than flipping the
  // ruleset here.
  if (gpcChanged) {
    await globalThis.NullechoGPC.setEnabled(settings.gpc).catch(warn('NullechoGPC.setEnabled'));
  }

  await scheduleAutoRotate();
  return { ok: true, settings };
}

async function onClearStats(msg) {
  if (msg.site) delete stats[msg.site];
  else stats = {};
  await flushNow();
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
