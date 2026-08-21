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
 *   SET_COOKIE   high-entropy Set-Cookie from a third party
 *   SUPERCOOKIE  localStorage / IndexedDB identifier  (reported by the shim)
 *   CANVAS       canvas or WebGL readback              (reported by the shim)
 *   ID_PARAM     identifier-bearing query parameter — link decoration
 *
 * The first two are observed here. The middle two arrive as messages from the
 * layer-2 fingerprint shim, which is the only code that can see them. The last
 * is derived from the URL.
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
  SUPERCOOKIE: 4,
  CANVAS: 8,
  ID_PARAM: 16,
};
export { SIGNAL };

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
// Chrome exposes no Public Suffix List to extensions, and shipping the real
// one is ~230KB of data this layer does not need to be exact about. This is a
// pragmatic subset covering the suffixes that actually appear in tracking:
// the common two-label ccTLDs, plus the app-hosting suffixes where treating
// the whole platform as one party would be badly wrong (every *.vercel.app is
// a different publisher). Getting an entry wrong over- or under-merges two
// domains; the three-site rule keeps the blast radius small either way.

const MULTI_LABEL_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk', 'ltd.uk', 'plc.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz', 'ac.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
  'com.mx', 'gob.mx', 'com.ar', 'com.co', 'com.pe', 'com.ve', 'com.ec', 'com.uy',
  'com.tr', 'com.tw', 'com.hk', 'com.sg', 'com.my', 'com.ph', 'com.vn',
  'com.sa', 'com.eg', 'com.pk', 'com.bd', 'com.ng',
  'co.za', 'co.kr', 'co.il', 'co.id', 'co.th',
  'com.pl', 'com.ua', 'com.ru', 'com.es', 'org.es', 'gob.es',
  // Platform suffixes: each subdomain is a separate party.
  'github.io', 'gitlab.io', 'pages.dev', 'workers.dev', 'r2.dev',
  'vercel.app', 'netlify.app', 'herokuapp.com', 'firebaseapp.com', 'web.app',
  'appspot.com', 'cloudfront.net', 'azurewebsites.net', 'azureedge.net',
  's3.amazonaws.com', 'fly.dev', 'onrender.com', 'glitch.me', 'repl.co',
  'surge.sh', 'blogspot.com', 'neocities.org', 'translate.goog',
]);

/** Registrable domain (eTLD+1) for a hostname. */
export function registrableDomain(hostname) {
  if (!hostname) return '';
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return host; // IP literal
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  const lastThree = parts.slice(-3).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastThree)) return parts.slice(-4).join('.');
  if (MULTI_LABEL_SUFFIXES.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

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

// ── identifier-bearing query parameters ───────────────────────────────────
//
// Link decoration: the first party hands the third party an identifier in the
// URL, so the third party can link the visit without a cookie at all.

const ID_PARAMS = new Set([
  'uid', 'uuid', 'guid', 'userid', 'user_id', 'visitorid', 'visitor_id', 'vid',
  'cid', 'clientid', 'client_id', 'sid', 'sessionid', 'session_id',
  'deviceid', 'device_id', 'aid', 'anonymousid', 'anonymous_id',
  'fbclid', '_fbp', '_fbc', 'gclid', 'dclid', 'wbraid', 'gbraid', 'gbraid',
  'msclkid', 'ttclid', 'twclid', 'li_fat_id', 'igshid', 'yclid', 'rdt_cid',
  'epik', 'irclickid', 'sc_cid', 'wickedid', 'mc_eid', 'mkt_tok',
  '_ga', '_gl', 'ajs_user_id', 'ajs_anonymous_id',
  '__hstc', '__hssc', '_hsenc', 'hsa_cam', 'vero_id',
  'oly_anon_id', 'oly_enc_id', 'ml_subscriber', 's_kwcid', '_openstat',
]);

function hasIdentifierParam(url) {
  let search;
  try {
    search = new URL(url).searchParams;
  } catch {
    return false;
  }
  for (const [key, value] of search) {
    if (ID_PARAMS.has(key.toLowerCase()) && isIdentifierValue(value)) return true;
  }
  return false;
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

/** Load persisted state. Safe to call repeatedly; only hydrates once. */
export function ready() {
  if (state) return Promise.resolve(state);
  if (!hydrating) {
    hydrating = chrome.storage.local.get(STORAGE_KEY).then((stored) => {
      const saved = stored[STORAGE_KEY];
      state = saved && saved.version === 1
        ? { version: 1, domains: Object.assign(Object.create(null), saved.domains) }
        : emptyState();
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

const strikeCount = (rec) => Object.values(rec.sites).filter((mask) => mask !== 0).length;

// ── the core: record one observation ──────────────────────────────────────

/**
 * Record that `trackerHost` showed `signal` while embedded on `siteHost`.
 * Returns the new status if the domain was promoted, otherwise null.
 */
export async function recordSignal(trackerHost, siteHost, signal) {
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

function onBeforeRequest(details) {
  const ctx = isObservable(details);
  if (!ctx) return;
  if (hasIdentifierParam(details.url)) {
    void recordSignal(ctx.tracker, ctx.site, SIGNAL.ID_PARAM);
  }
}

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
  const pairs = setCookies.map((h) => {
    const first = String(h.value).split(';')[0];
    const i = first.indexOf('=');
    return i === -1 ? [first.trim(), ''] : [first.slice(0, i).trim(), first.slice(i + 1).trim()];
  });
  if (hasIdentifyingCookie(pairs)) {
    void recordSignal(ctx.tracker, ctx.site, SIGNAL.SET_COOKIE);
  }
}

/**
 * Signals only the page can see, forwarded by the layer-2 fingerprint shim.
 *
 * Expected message:
 *   { type: 'nullecho:signal', signal: 'canvas' | 'supercookie', scriptUrl }
 *
 * `scriptUrl` is the script that performed the read — the shim recovers it
 * from the call stack. Without it a canvas read cannot be attributed to a
 * third party and is dropped rather than blamed on the page.
 */
export function handleContentReport(message, sender) {
  if (message?.type !== 'nullecho:signal') return false;
  const site = hostOf(sender?.origin || sender?.tab?.url || sender?.url || '');
  const tracker = hostOf(message.scriptUrl || '');
  if (!site || !tracker) return false;
  const signal = message.signal === 'canvas' ? SIGNAL.CANVAS
    : message.signal === 'supercookie' ? SIGNAL.SUPERCOOKIE
      : null;
  if (signal === null) return false;
  void recordSignal(tracker, site, signal);
  return true;
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

  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter);
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
