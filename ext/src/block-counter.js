/**
 * Nullecho — counting what Nullecho blocked, in a store-installed build. 0.9.2, D55.
 * ══════════════════════════════════════════════════════════════════════════
 * Until 0.9.2 every blocked request was recorded from `declarativeNetRequest.
 * onRuleMatchedDebug`, which Chrome and Edge give to UNPACKED builds only and
 * Firefox does not implement at all. In every store install the popup's
 * headline therefore read "0 requests blocked", the per-site report and the
 * cross-site map were empty, and the options page totalled zeros.
 *
 * What a packed build CAN see, measured 2026-10-14:
 *   · Chrome 149: `webRequest.onErrorOccurred` fires for every request a DNR
 *     block rule cancels, with `error: "net::ERR_BLOCKED_BY_CLIENT"`.
 *   · Firefox 156: the same event, with `error: "NS_ERROR_ABORT"` — DNR's
 *     `applyBlock()` cancels with exactly that code. A page aborting its own
 *     fetch reports `NS_BINDING_ABORTED`, which is not counted.
 * Neither says WHICH extension cancelled the request, and Firefox's
 * `testMatchOutcome` needs a pref no user sets. So a request counts as
 * Nullecho's block when BOTH hold: the engine reported an extension block,
 * and one of Nullecho's own block rules covers it (this file's matcher, run
 * over the rules Nullecho ships and the ones its learner added). The matcher
 * only ever ATTRIBUTES a block the browser already reported; it can never turn
 * an allowed request into a count. What it can get wrong is stated in D55.
 *
 * Pure: no extension API here. `background.js` feeds it rules and events.
 */

import { registrableDomain } from './suffixes.js';

/** The error string each engine gives `webRequest` for a request an extension's rule cancelled (measured). */
export const EXTENSION_BLOCK_ERRORS = new Set(['net::ERR_BLOCKED_BY_CLIENT', 'NS_ERROR_ABORT']);

/** Host of a URL, lower-case, or '' for anything without one. */
export function hostOf(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'ws:' || u.protocol === 'wss:'
      ? u.hostname.toLowerCase().replace(/\.$/, '')
      : '';
  } catch { return ''; }
}

/** `host` is `domain` or a subdomain of it — DNR's `requestDomains` / `initiatorDomains` semantics. */
export function hostIsUnder(host, domain) {
  const d = String(domain).toLowerCase();
  return host === d || host.endsWith(`.${d}`);
}

const anyUnder = (host, list) => Array.isArray(list) && list.some((d) => hostIsUnder(host, d));

/**
 * DNR `urlFilter` → RegExp, for the subset of the syntax Nullecho's rules use
 * and its documented anchors: `||` (domain anchor), a leading/trailing `|`, `*`
 * (any run) and `^` (a separator: anything but a letter, digit, `_ - . %`, or
 * the end). Case-insensitive, as DNR is by default.
 */
export function compileUrlFilter(filter) {
  let f = String(filter);
  let head = '';
  let tail = '';
  if (f.startsWith('||')) { head = '^[a-z][a-z0-9+.-]*://(?:[^/?#]*\\.)?'; f = f.slice(2); }
  else if (f.startsWith('|')) { head = '^'; f = f.slice(1); }
  if (f.endsWith('|')) { tail = '$'; f = f.slice(0, -1); }
  let body = '';
  for (const ch of f) {
    if (ch === '*') body += '.*';
    else if (ch === '^') body += '(?:[^a-z0-9_\\-.%]|$)';
    else body += ch.replace(/[.+?${}()|[\]\\/]/g, '\\$&');
  }
  return new RegExp(head + body + tail, 'i');
}

/** webRequest resource type → DNR resource type (Firefox has a few of its own). */
const DNR_TYPE = { beacon: 'ping', imageset: 'image', object_subrequest: 'object', xslt: 'other', web_manifest: 'other', speculative: 'other' };
export const dnrType = (t) => DNR_TYPE[t] ?? (t || 'other');

/**
 * The facts about one finished request a rule condition can test.
 * `initiator` (Chrome) or `originUrl` / `documentUrl` (Firefox) is the document
 * that made it; a top-level navigation has none.
 */
export function requestFacts(d) {
  const url = String(d?.url ?? '');
  const initiatorUrl = d?.initiator || d?.documentUrl || d?.originUrl || '';
  return {
    url,
    host: hostOf(url),
    initiatorHost: hostOf(initiatorUrl),
    type: dnrType(d?.type),
    tabId: Number.isInteger(d?.tabId) ? d.tabId : -1,
    initiatorUrl,
  };
}

/** Does one BLOCK rule's condition cover this request? Unknown condition keys fail closed (no match). */
const KNOWN_CONDITION_KEYS = new Set(['requestDomains', 'excludedRequestDomains', 'urlFilter', 'domainType',
  'initiatorDomains', 'excludedInitiatorDomains', 'resourceTypes', 'excludedResourceTypes', 'isUrlFilterCaseSensitive']);

export function ruleCovers(rule, req, compiled = null) {
  const c = rule?.condition ?? {};
  for (const k of Object.keys(c)) if (!KNOWN_CONDITION_KEYS.has(k)) return false;
  if (!req.host) return false;
  if (c.requestDomains && !anyUnder(req.host, c.requestDomains)) return false;
  if (c.excludedRequestDomains && anyUnder(req.host, c.excludedRequestDomains)) return false;
  if (c.initiatorDomains && !anyUnder(req.initiatorHost, c.initiatorDomains)) return false;
  if (c.excludedInitiatorDomains && req.initiatorHost && anyUnder(req.initiatorHost, c.excludedInitiatorDomains)) return false;
  if (c.resourceTypes && !c.resourceTypes.includes(req.type)) return false;
  if (c.excludedResourceTypes && c.excludedResourceTypes.includes(req.type)) return false;
  if (c.domainType) {
    // DNR's first/third party is by registrable domain; a request with no
    // initiator (a navigation) is first-party.
    const third = !!req.initiatorHost && registrableDomain(req.host) !== registrableDomain(req.initiatorHost);
    if ((c.domainType === 'thirdParty') !== third) return false;
  }
  if (c.urlFilter) {
    const re = compiled ?? compileUrlFilter(c.urlFilter);
    if (!re.test(req.url)) return false;
  }
  return true;
}

/**
 * Nullecho's own block rules, compiled once. `rulesets` is `[{ id, rules }]` for
 * the static rulesets that are ENABLED, and `dynamic` the extension's dynamic
 * rules; only `block` actions are kept. `match()` returns the rule the way DNR
 * reports a match — `{ ruleId, rulesetId }` — so `classifyMatchedRule()` sorts
 * it exactly as it sorts the browser's own reports.
 */
export function buildMatcher({ rulesets = [], dynamic = [] } = {}) {
  const entries = [];
  const add = (rule, rulesetId) => {
    if (rule?.action?.type !== 'block') return;
    entries.push({ rule, rulesetId, re: rule.condition?.urlFilter ? compileUrlFilter(rule.condition.urlFilter) : null });
  };
  for (const rs of rulesets) for (const r of rs.rules ?? []) add(r, rs.id);
  for (const r of dynamic) add(r, '_dynamic');
  return {
    size: entries.length,
    match(req) {
      for (const e of entries) {
        if (ruleCovers(e.rule, req, e.re)) return { ruleId: e.rule.id, rulesetId: e.rulesetId };
      }
      return null;
    },
  };
}

/**
 * Per-tab tally of requests blocked on the page now open in that tab. A new
 * top-level navigation in the tab starts a new page and a new count.
 */
export function tabTally(total = 0, byCategory = {}) {
  return { total, byCategory: { ...byCategory } };
}
