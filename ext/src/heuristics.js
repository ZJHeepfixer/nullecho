/**
 * Nullecho — passive heuristic tracker detection
 * ───────────────────────────────────────────
 * A blocklist only knows the trackers someone already wrote down. This layer
 * catches the rest by watching behaviour, using EFF's Privacy Badger heuristic:
 *
 *   a third-party domain that exhibits tracking behaviour on **3 or more
 *   distinct first-party sites** is a tracker, whoever it is.
 *
 * Three strikes matters. One site setting a third-party cookie is a widget.
 * The same domain doing it across three unrelated sites is cross-site
 * identity — the thing ARCHITECTURE.md names as the actual threat.
 *
 * ─── The MV3 constraint, and why the code is shaped this way ───────────────
 *
 * Manifest V3 removed blocking `webRequest`: `onBeforeRequest` can no longer
 * return `{cancel: true}`. So this module is split in two, and must stay split:
 *
 *   OBSERVE  non-blocking `webRequest` listeners. They see headers and URLs
 *            and can do nothing about them. `extraHeaders` is required to see
 *            Cookie / Set-Cookie at all.
 *   BLOCK    `chrome.declarativeNetRequest.updateDynamicRules()`. Promotion
 *            writes a dynamic rule; the block takes effect on the *next*
 *            request, not the one that triggered it. That one-request lag is
 *            inherent to MV3 and is not a bug to be fixed.
 *
 * Firefox retains blocking webRequest and could act on the triggering request
 * itself (ARCHITECTURE.md, layer 1). That belongs in the Firefox build, not
 * here — this file targets Chrome's capability floor.
 *
 * ─── Signals ───────────────────────────────────────────────────────────────
 *
 *   COOKIE       high-entropy Cookie header sent to a third party
 *   SET_COOKIE   high-entropy, cross-site-capable Set-Cookie from a third party
 *                (`SameSite=None`, not `Partitioned` — anything else the browser
 *                would not store or send cross-site, so it cannot track)
 *
 * Both are things the THIRD PARTY did. That is the bar for a strike, and it is
 * why three earlier signals are gone (2026-09-16, REVIEW-2026-09-16 A5 + C3;
 * DECISIONS.md D20):
 *
 *   ID_PARAM     an identifier-bearing query parameter on the request URL. The
 *                URL is chosen by the EMBEDDING PAGE, so three attacker pages
 *                each loading `victim.example/x?gclid=…` earned any domain a
 *                block rule. The network layer cannot tell a parameter the
 *                third party originated from one the first party pasted in,
 *                so the source is retired, not tightened.
 *   CANVAS /     "reported by the shim" — but the shim's report carries no
 *   SUPERCOOKIE  script attribution (it is `{api, count}`), so nothing ever
 *                reached this layer; the path was dead code. Attributing an
 *                unattributed read to some third party on the page would be
 *                ID_PARAM's problem through a different door.
 *
 * Their bit values stay reserved so a state record written by an earlier build
 * is read correctly; `ready()` scrubs them out, and they never count.
 *
 * ─── Outcomes ──────────────────────────────────────────────────────────────
 *
 *   blocked         dynamic DNR block rule
 *   cookieblocked   dynamic DNR rule stripping Cookie / Set-Cookie, for
 *                   domains on the COOKIE_BLOCK_ONLY yellowlist — they carry a
 *                   visible feature (embedded video, live chat) and blocking
 *                   them outright would break the page
 *   allowed         user override; never acted on again
 *
 * Nothing on NEVER_BLOCK can ever be promoted. A learner that teaches itself
 * to block Stripe or reCAPTCHA is worse than no learner.
 */

import { isNeverBlock, isCookieBlockOnly } from './allowlist.js';
import { DYNAMIC_RULE_RANGES } from './protocol.js';

// ── tuning ────────────────────────────────────────────────────────────────

/** EFF's three-strike bar: distinct first-party sites, not request count. */
export const STRIKE_THRESHOLD = 3;

/**
 * Bits of estimated entropy above which a cookie value is treated as an
 * identifier rather than a setting. ~33 bits is about eight hex characters —
 * enough to name a person, too much to be a locale or a boolean.
 */
const IDENTIFIER_ENTROPY_BITS = 33;

const SIGNAL = {
  COOKIE: 1,
  SET_COOKIE: 2,
};
export { SIGNAL };

/**
 * Bits that used to be signals. Reserved — never reassign them — so a persisted
 * bitmask from an earlier build cannot be misread as a live signal.
 */
export const RETIRED_SIGNAL_BITS = {
  SUPERCOOKIE: 4, // 2026-09-16 — never reachable (C3)
  CANVAS: 8,      // 2026-09-16 — never reachable (C3)
  ID_PARAM: 16,   // 2026-09-16 — attacker-forgeable (A5)
};

/** The only bits that count toward the three strikes. */
const PROMOTING_MASK = Object.values(SIGNAL).reduce((a, b) => a | b, 0);

const SIGNAL_NAMES = Object.fromEntries(Object.entries(SIGNAL).map(([k, v]) => [v, k]));

const STORAGE_KEY = 'nullecho:heuristics:v1';
const FLUSH_DELAY_MS = 3000;

/**
 * Reserved runtime id ranges. Derived from `protocol.js` rather than repeated
 * here: the popup's blocked-request counter reads the same ranges to tell a
 * heuristic block from a cookie-strip from an allow rule, so two copies drifting
 * apart would silently miscount. `rules/validate.mjs` enforces the declaration.
 */
const [BLOCK_RULE_BASE, BLOCK_RULE_MAX] = DYNAMIC_RULE_RANGES.heuristicBlock;
const BLOCK_RULE_LIMIT = BLOCK_RULE_MAX - BLOCK_RULE_BASE + 1;
const [COOKIE_RULE_BASE, COOKIE_RULE_MAX] = DYNAMIC_RULE_RANGES.heuristicCookie;
const COOKIE_RULE_LIMIT = COOKIE_RULE_MAX - COOKIE_RULE_BASE + 1;

/**
 * Chrome's dynamic-rule budget. Block rules are "safe" and draw on the large
 * pool; `modifyHeaders` rules are "unsafe" and capped far lower. Cookie-blocks
 * are therefore the scarce resource, and the cap is enforced, not assumed.
 */
const MAX_BLOCK_RULES = 4000;
const MAX_COOKIE_RULES = 1000;

// ── eTLD+1 ────────────────────────────────────────────────────────────────
//
// The registrable-domain key comes from the ONE suffix table shared with the
// shim (src/suffixes.js, D23). Re-exported so background.js keeps its import.
import { registrableDomain } from './suffixes.js';
export { registrableDomain };

/** Hostname from a URL string, or '' if it is not a normal web URL. */
function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.hostname;
  } catch {
    return '';
  }
}

// ── same-entity grouping ──────────────────────────────────────────────────
//
// A site loading its own CDN is not a third party in any meaningful sense.
// Counting it would hand out strikes for ordinary architecture.

const ENTITY_GROUPS = [
  ['google.com', 'googleapis.com', 'gstatic.com', 'googlevideo.com', 'youtube.com', 'ytimg.com', 'withgoogle.com', 'google-analytics.com', 'googletagmanager.com'],
  ['facebook.com', 'facebook.net', 'fbcdn.net', 'fbsbx.com', 'instagram.com', 'whatsapp.com', 'messenger.com'],
  ['amazon.com', 'amazonaws.com', 'media-amazon.com', 'ssl-images-amazon.com', 'amazon-adsystem.com'],
  ['microsoft.com', 'live.com', 'msn.com', 'bing.com', 'office.com', 'sharepoint.com', 'windows.net'],
  ['apple.com', 'icloud.com', 'cdn-apple.com', 'mzstatic.com'],
  ['twitter.com', 'x.com', 'twimg.com', 't.co'],
  ['linkedin.com', 'licdn.com'],
  ['shopify.com', 'shopifycdn.com', 'myshopify.com'],
  ['wordpress.com', 'wp.com', 'gravatar.com', 'automattic.com'],
  ['cloudflare.com', 'cloudflareinsights.com'],
  ['tiktok.com', 'tiktokcdn.com', 'tiktokv.com', 'byteoversea.com'],
];

const ENTITY_OF = new Map();
ENTITY_GROUPS.forEach((group, i) => group.forEach((d) => ENTITY_OF.set(d, i)));

const sameEntity = (a, b) =>
  a === b || (ENTITY_OF.has(a) && ENTITY_OF.get(a) === ENTITY_OF.get(b));

// ── entropy ───────────────────────────────────────────────────────────────

/**
 * Rough entropy estimate for a cookie or parameter value: alphabet size
 * inferred from the character classes present, times length. Deliberately
 * crude — the three-site rule is the real gate, this only filters out obvious
 * settings ("true", "en_US", "1").
 */
export function estimateEntropyBits(value) {
  if (!value) return 0;
  let alphabet = 0;
  if (/[a-z]/.test(value)) alphabet += 26;
  if (/[A-Z]/.test(value)) alphabet += 26;
  if (/[0-9]/.test(value)) alphabet += 10;
  if (/[^A-Za-z0-9]/.test(value)) alphabet += 20;
  if (alphabet < 2) alphabet = 2;
  return Math.log2(alphabet) * value.length;
}

/**
 * Cookies that are high-entropy but not identifiers: consent records, CSRF
 * tokens, and bot-management cookies. `__cf_bm` in particular rides along on
 * a large share of all third-party requests — counting it would give every
 * domain on the web three strikes within a minute.
 */
const NON_IDENTIFYING_COOKIES = new Set([
  '__cf_bm', 'cf_clearance', '__cfruid', '__cfwaitingroom', '_cfuvid',
  'csrftoken', 'csrf_token', 'xsrf-token', '_csrf', 'x-csrf-token',
  'euconsent-v2', 'optanonconsent', 'optanonalertboxclosed', 'cookieconsent',
  'usprivacy', 'addtl_consent', 'cmpconsent',
  'aws-waf-token', 'incap_ses', 'visid_incap', 'awsalb', 'awsalbcors',
]);

const isIdentifierValue = (v) => estimateEntropyBits(v) >= IDENTIFIER_ENTROPY_BITS;

/** Parse a Cookie request header into [name, value] pairs. */
function parseCookieHeader(value) {
  return String(value).split(';').map((part) => {
    const i = part.indexOf('=');
    return i === -1 ? [part.trim(), ''] : [part.slice(0, i).trim(), part.slice(i + 1).trim()];
  });
}

function hasIdentifyingCookie(pairs) {
  return pairs.some(([name, value]) =>
    !NON_IDENTIFYING_COOKIES.has(name.toLowerCase()) && isIdentifierValue(value));
}

/**
 * Parse one Set-Cookie header into its name/value pair and lower-cased attribute
 * map. `{ name, value, attrs }`; attribute values are lower-cased strings, or ''
 * for flag attributes (`Secure`, `Partitioned`).
 */
export function parseSetCookie(header) {
  const [first, ...rest] = String(header).split(';');
  const i = first.indexOf('=');
  const name = (i === -1 ? first : first.slice(0, i)).trim();
  const value = (i === -1 ? '' : first.slice(i + 1)).trim();
  const attrs = Object.create(null);
  for (const part of rest) {
    const j = part.indexOf('=');
    const k = (j === -1 ? part : part.slice(0, j)).trim().toLowerCase();
    if (k) attrs[k] = j === -1 ? '' : part.slice(j + 1).trim().toLowerCase();
  }
  return { name, value, attrs };
}

/**
 * Could this cookie, set from a THIRD-PARTY response, ever be sent back
 * cross-site? Chrome (80+) stores a cookie from a cross-site response only when
 * it says `SameSite=None`, and a `Partitioned` (CHIPS) cookie is keyed to the
 * top-level site and so cannot join two sites. Everything else — a PHP session
 * cookie on an image, a load-balancer affinity cookie — is dropped by the
 * browser before it could identify anyone, and counting it would (a) mark
 * ordinary servers as trackers and (b) hand an attacker a strike source: embed
 * any site with a session cookie on three pages and it is blocked.
 *
 * Firefox does not default to Lax, but its Total Cookie Protection partitions
 * third-party cookies regardless, and every tracker that wants to work in
 * Chrome already sets `SameSite=None`. Requiring it costs no coverage.
 */
export function isCrossSiteCapable(attrs) {
  return attrs.samesite === 'none' && !('partitioned' in attrs);
}

// ── state ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DomainRecord
 * @property {Record<string, number>} sites  first-party eTLD+1 -> signal bitmask
 * @property {'observing'|'blocked'|'cookieblocked'|'allowed'} status
 * @property {number|null} ruleId
 * @property {number} firstSeen
 * @property {number} lastSeen
 */

let state = null;              // { version, domains: Record<string, DomainRecord> }
let hydrating = null;
let flushTimer = null;
const seenPairs = new Set();   // "tracker|site|signal" — cheap in-memory dedupe

function emptyState() {
  return { version: 1, domains: Object.create(null) };
}

/**
 * Rebuild in-memory state from what storage holds, dropping every retired signal
 * bit on the way in. A record written before 2026-09-16 may carry ID_PARAM /
 * CANVAS / SUPERCOOKIE observations; after the scrub only the bits that still
 * count remain, and a site whose only evidence was retired is forgotten.
 *
 * Deliberately NOT undone: a record that is already `blocked` stays blocked even
 * if its surviving evidence is now below the bar. A block written by the user
 * (`setDomainStatus`) is indistinguishable in storage from one the learner
 * wrote, and demoting the user's own decision would be worse than keeping a
 * learner verdict that pre-dates the rule change. The options page lets the
 * user allow it in one click; nothing had shipped when the rule changed.
 */
export function normaliseStored(saved) {
  if (!saved || saved.version !== 1 || !saved.domains) return emptyState();
  const domains = Object.create(null);
  for (const [domain, rec] of Object.entries(saved.domains)) {
    const sites = Object.create(null);
    for (const [site, mask] of Object.entries(rec.sites ?? {})) {
      const kept = (Number(mask) || 0) & PROMOTING_MASK;
      if (kept) sites[site] = kept;
    }
    domains[domain] = { ...rec, sites };
  }
  return { version: 1, domains };
}

/** Load persisted state. Safe to call repeatedly; only hydrates once. */
export function ready() {
  if (state) return Promise.resolve(state);
  if (!hydrating) {
    hydrating = chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      state = normaliseStored(stored[STORAGE_KEY]);
      return state;
    });
  }
  return hydrating;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_DELAY_MS);
}

/**
 * Persist immediately. Called directly on promotion — the service worker can
 * be torn down at any moment, and a lost promotion is a tracker that gets to
 * start its three strikes over.
 */
export async function flush() {
  if (!state) return;
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function recordFor(domain) {
  let rec = state.domains[domain];
  if (!rec) {
    rec = state.domains[domain] = {
      sites: Object.create(null),
      status: 'observing',
      ruleId: null,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    };
  }
  return rec;
}

/** Distinct first-party sites with at least one signal that still counts. */
const strikeCount = (rec) => Object.values(rec.sites).filter((mask) => (mask & PROMOTING_MASK) !== 0).length;

// ── the core: record one observation ──────────────────────────────────────

/**
 * Record that `trackerHost` showed `signal` while embedded on `siteHost`.
 * Returns the new status if the domain was promoted, otherwise null.
 *
 * `signal` must be a live SIGNAL bit. A retired bit — or anything else — is
 * dropped here rather than stored, so no caller can resurrect a strike source
 * by passing its old number.
 */
export async function recordSignal(trackerHost, siteHost, signal) {
  // Positive integer, masked to live bits. (A negative number would AND to
  // "every bit", which is why the sign is checked and not just the mask.)
  signal = Number.isInteger(signal) && signal > 0 ? signal & PROMOTING_MASK : 0;
  if (!signal) return null;
  const tracker = registrableDomain(trackerHost);
  const site = registrableDomain(siteHost);
  if (!tracker || !site) return null;
  if (sameEntity(tracker, site)) return null;      // first party in disguise
  if (isNeverBlock(trackerHost) || isNeverBlock(tracker)) return null;

  const key = `${tracker}|${site}|${signal}`;
  if (seenPairs.has(key)) return null;
  seenPairs.add(key);

  await ready();
  const rec = recordFor(tracker);
  rec.lastSeen = Date.now();
  if (rec.status === 'allowed') { scheduleFlush(); return null; }

  rec.sites[site] = (rec.sites[site] ?? 0) | signal;

  if (rec.status === 'observing' && strikeCount(rec) >= STRIKE_THRESHOLD) {
    const status = isCookieBlockOnly(tracker) ? 'cookieblocked' : 'blocked';
    const applied = await applyAction(tracker, rec, status);
    if (applied) {
      await flush();
      return status;
    }
  }
  scheduleFlush();
  return null;
}

// ── promotion: dynamic DNR rules ──────────────────────────────────────────

function countByStatus(status) {
  return Object.values(state.domains).filter((r) => r.status === status).length;
}

function allocateRuleId(base, limit) {
  const used = new Set(
    Object.values(state.domains)
      .map((r) => r.ruleId)
      .filter((id) => id !== null && id >= base && id < base + limit),
  );
  for (let id = base; id < base + limit; id++) if (!used.has(id)) return id;
  return null;
}

function ruleFor(domain, id, status) {
  const condition = { requestDomains: [domain], domainType: 'thirdParty' };
  if (status === 'blocked') {
    return { id, priority: 1, action: { type: 'block' }, condition };
  }
  // Yellowlist: keep the resource, take away the identity.
  return {
    id,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [{ header: 'Cookie', operation: 'remove' }],
      responseHeaders: [{ header: 'Set-Cookie', operation: 'remove' }],
    },
    condition,
  };
}

async function applyAction(domain, rec, status) {
  const isBlock = status === 'blocked';
  const cap = isBlock ? MAX_BLOCK_RULES : MAX_COOKIE_RULES;
  if (countByStatus(status) >= cap) {
    console.warn(`[nullecho] dynamic rule budget for "${status}" exhausted; not promoting ${domain}`);
    return false;
  }
  const id = allocateRuleId(
    isBlock ? BLOCK_RULE_BASE : COOKIE_RULE_BASE,
    isBlock ? BLOCK_RULE_LIMIT : COOKIE_RULE_LIMIT,
  );
  if (id === null) return false;

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [ruleFor(domain, id, status)],
      removeRuleIds: [id],
    });
  } catch (e) {
    console.error(`[nullecho] failed to promote ${domain}:`, e);
    return false;
  }
  rec.status = status;
  rec.ruleId = id;
  return true;
}

async function clearAction(rec) {
  if (rec.ruleId === null) return;
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [rec.ruleId] });
  } catch { /* already gone */ }
  rec.ruleId = null;
}

/**
 * Reconcile stored state against the dynamic rules Chrome actually holds.
 * Dynamic rules survive browser restarts and extension updates independently
 * of our storage, so the two can drift — a stale rule blocks something the UI
 * says is allowed, which is exactly the kind of silent divergence that makes
 * users distrust a privacy tool.
 */
export async function reconcile() {
  await ready();
  const live = await chrome.declarativeNetRequest.getDynamicRules();
  const ours = live.filter(
    (r) => (r.id >= BLOCK_RULE_BASE && r.id < BLOCK_RULE_BASE + BLOCK_RULE_LIMIT)
        || (r.id >= COOKIE_RULE_BASE && r.id < COOKIE_RULE_BASE + COOKIE_RULE_LIMIT),
  );
  const liveIds = new Set(ours.map((r) => r.id));
  const wantedIds = new Set();
  const addRules = [];

  for (const [domain, rec] of Object.entries(state.domains)) {
    if (rec.status !== 'blocked' && rec.status !== 'cookieblocked') continue;
    if (rec.ruleId === null) continue;
    wantedIds.add(rec.ruleId);
    if (!liveIds.has(rec.ruleId)) addRules.push(ruleFor(domain, rec.ruleId, rec.status));
  }

  const removeRuleIds = [...liveIds].filter((id) => !wantedIds.has(id));
  if (addRules.length || removeRuleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules, removeRuleIds });
  }
  return { added: addRules.length, removed: removeRuleIds.length };
}

// ── observation ───────────────────────────────────────────────────────────

/**
 * The first party for a request. `initiator` is the document that made it;
 * `documentUrl` covers the cases where it is absent. Requests with no
 * initiator (top-level navigation, extension-originated) are not third-party
 * by definition and are ignored.
 */
function firstPartyOf(details) {
  return hostOf(details.initiator || details.documentUrl || '');
}

function isObservable(details) {
  if (details.tabId < 0) return false;                       // not from a tab
  if (details.type === 'main_frame') return false;
  const tracker = hostOf(details.url);
  const site = firstPartyOf(details);
  if (!tracker || !site) return false;
  return { tracker, site };
}

/*
 * There is no `onBeforeRequest` observer, on purpose. Everything that listener
 * could see — the URL and its query string — is chosen by the embedding page,
 * and a strike source the page controls is a way for a page to get any third
 * party blocked (REVIEW-2026-09-16 A5). The two observers below read what the
 * THIRD PARTY sent or is being sent: a cookie it set, or a cookie the browser
 * holds for it.
 */

function onBeforeSendHeaders(details) {
  const ctx = isObservable(details);
  if (!ctx) return;
  const cookie = details.requestHeaders?.find((h) => h.name.toLowerCase() === 'cookie');
  if (!cookie?.value) return;
  if (hasIdentifyingCookie(parseCookieHeader(cookie.value))) {
    void recordSignal(ctx.tracker, ctx.site, SIGNAL.COOKIE);
  }
}

function onHeadersReceived(details) {
  const ctx = isObservable(details);
  if (!ctx) return;
  const setCookies = (details.responseHeaders ?? [])
    .filter((h) => h.name.toLowerCase() === 'set-cookie');
  if (!setCookies.length) return;
  // Only a cookie the browser would actually keep across sites is evidence of
  // anything; see `isCrossSiteCapable`.
  const pairs = setCookies
    .map((h) => parseSetCookie(h.value))
    .filter((c) => isCrossSiteCapable(c.attrs))
    .map((c) => [c.name, c.value]);
  if (pairs.length && hasIdentifyingCookie(pairs)) {
    void recordSignal(ctx.tracker, ctx.site, SIGNAL.SET_COOKIE);
  }
}

/**
 * ⛔ CLOSED. Page-side reports are not a strike source.
 *
 * This used to wait for `{ type: 'nullecho:signal', signal, scriptUrl }` and
 * count canvas reads and storage supercookies against `scriptUrl`'s domain.
 * Nothing has ever sent that message: the shim reports `nullecho:fp-detected`
 * as `{ api, count }`, with no script attribution, because recovering the
 * calling script's URL from inside a patched getter is not something the shim
 * does (REVIEW-2026-09-16 C3). Without attribution the only options are to
 * drop the report or to blame a third party that happens to be on the page —
 * and the second is exactly the A5 defect (a page choosing who gets blocked).
 *
 * If the shim ever attributes reads to a script origin it obtained from the
 * browser rather than from the page, this is where that signal lands. Until
 * then it accepts nothing; `background.js` no longer calls it, and it stays
 * exported so the review's C3 reproduction (which calls it) keeps running.
 */
export function handleContentReport() {
  return false;
}

// ── public surface ────────────────────────────────────────────────────────

/**
 * Wire up the observers.
 *
 * MUST be called synchronously from the service worker's top level.
 * `webRequest` listeners registered inside a promise callback are missed when
 * the worker is respawned for an event, and the failure is silent — the
 * extension simply stops learning.
 */
export function install() {
  const filter = { urls: ['http://*/*', 'https://*/*'] };

  // No `onBeforeRequest`: see the note above `onBeforeSendHeaders`.
  chrome.webRequest.onBeforeSendHeaders.addListener(
    onBeforeSendHeaders, filter, ['requestHeaders', 'extraHeaders'],
  );
  chrome.webRequest.onHeadersReceived.addListener(
    onHeadersReceived, filter, ['responseHeaders', 'extraHeaders'],
  );

  // Reconcile in the background; nothing above depends on it finishing.
  void reconcile().catch((e) => console.error('[nullecho] reconcile failed:', e));
}

/** Snapshot for the UI: who was seen, on how many sites, and what happened. */
export async function getState() {
  await ready();
  return Object.entries(state.domains)
    .map(([domain, rec]) => ({
      domain,
      status: rec.status,
      strikes: strikeCount(rec),
      sites: Object.keys(rec.sites),
      signals: [...new Set(
        Object.values(rec.sites).flatMap((mask) =>
          Object.entries(SIGNAL_NAMES).filter(([bit]) => mask & Number(bit)).map(([, name]) => name)),
      )],
      firstSeen: rec.firstSeen,
      lastSeen: rec.lastSeen,
    }))
    .sort((a, b) => b.strikes - a.strikes || a.domain.localeCompare(b.domain));
}

export async function stats() {
  await ready();
  const all = Object.values(state.domains);
  return {
    observed: all.length,
    blocked: all.filter((r) => r.status === 'blocked').length,
    cookieblocked: all.filter((r) => r.status === 'cookieblocked').length,
    allowed: all.filter((r) => r.status === 'allowed').length,
  };
}

/**
 * User override from the UI. 'allowed' is sticky: the domain keeps
 * accumulating observations for display but is never promoted again.
 */
export async function setDomainStatus(domain, status) {
  await ready();
  const key = registrableDomain(domain);
  const rec = recordFor(key);
  if (rec.status === status) return;

  await clearAction(rec);
  if (status === 'blocked' || status === 'cookieblocked') {
    if (isNeverBlock(key)) throw new Error(`${key} is on the never-block list`);
    await applyAction(key, rec, status);
  } else {
    rec.status = status; // 'allowed' or 'observing'
  }
  await flush();
}

/** Forget everything the heuristic learned and drop every rule it created. */
export async function reset() {
  await ready();
  const removeRuleIds = Object.values(state.domains)
    .map((r) => r.ruleId)
    .filter((id) => id !== null);
  if (removeRuleIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
  }
  state = emptyState();
  seenPairs.clear();
  await flush();
}
