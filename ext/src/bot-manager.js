/**
 * Nullecho — bot-manager stand-down (DECISIONS.md D59).
 * ═══════════════════════════════════════════════════
 * Pure functions; the service worker (`background.js`) owns the state, the
 * listener and the storage. Imported there and by the tests, nowhere else.
 *
 * THE PROBLEM, MEASURED (2026-10-17, research/bot-manager-2026-10/). tesla.com is
 * fronted by Akamai Bot Manager. Its first document is Akamai's sensor page; the
 * request that follows it is answered 403 "Access Denied" by `AkamaiGHost` when
 * the persona shim is in the page and 200 when it is not. Client-hint removal,
 * the Sec-GPC header, gpc.js and every block rule were each switched off in turn
 * and the denial stayed; only removing the shim cleared it. The sensor judged the
 * JavaScript environment the shim patches.
 *
 * And a denial is not a one-page cost: measured, the very next load of the site
 * — with the shim already stood down — is 403 on its FIRST document, before any
 * sensor runs (the session's cookies are now marked). So the stand-down is only
 * worth anything if it is in place BEFORE the sensor runs on the first visit,
 * which means it has to be decided from the first document's own response.
 *
 * THE RULE (D59). A site whose own response sets a bot-manager cookie from the
 * table below gets the device layer stood down: the shim restores every
 * descriptor it installed, exactly as for an allowlisted site. Tracker blocking
 * and Global Privacy Control stay ON — the allowlist turns those off too, this
 * does not.
 *
 * THE COST, MEASURED THE SAME DAY. The rule is per vendor, and most sites behind
 * Akamai Bot Manager do NOT refuse the shim: eleven sites set `_abck`/`bm_sz`; of
 * the nine that could be compared, eight (homedepot, lowes, bestbuy, united, macys,
 * delta, zara, sephora) loaded with the shim exactly as without it and only
 * tesla.com refused (adidas and kohls walled the rig either way). One load per
 * variant per site: a sample, not a census. Nothing in a first response tells the
 * two kinds apart — tesla's cookie set is not unique to it (macys sets `bm_sc`
 * too) — and a refusal cannot be waited for, because it outlives the stand-down.
 * So the device layer stands down on all of them; the settings page's per-site
 * override is the way back.
 *
 * WHAT COUNTS AS THE SITE'S OWN RESPONSE (`topLevelHit`): a TOP-LEVEL DOCUMENT —
 * `main_frame`, frame 0, in a tab — and nothing else. Its site is the top-level
 * site by definition. Every Akamai site measured set the trigger cookies on a
 * top-level document (the first one, or zara's second), so nothing is lost by
 * stopping there, and two attacks are closed by it:
 *   · a third party — a frame, a script, a fetch to another host — can never flip
 *     the flag, for the page it is embedded in or for its own host;
 *   · nor can a tracker the site serves from its OWN domain (CNAME cloaking:
 *     `metrics.site.example` → a tracking vendor). Its responses are first-party
 *     by registrable domain, and if they counted, one `Set-Cookie: _abck` from such
 *     an endpoint would take the device profile off every site the vendor serves —
 *     the cross-site join restored, by the party it exists to stop. A top-level
 *     document is served by the site itself.
 * What remains, stated: a site can switch the profile off for ITSELF by sending
 * the cookie name on its own pages. It cannot do so for any other site.
 * No URL-only signal is read — the request URL is used for its registrable
 * domain only, the host the browser actually contacted (review A5).
 *
 * WHAT IS STORED: the site's registrable domain, the vendor and cookie NAME that
 * matched, when, and the user's override. Never a cookie value.
 */

import { registrableDomain } from './suffixes.js';

/**
 * Vendors whose sensor is MEASURED to reject the persona shim, and the cookie
 * names that identify them in a site's own response. A vendor goes in only with a
 * measurement behind it (D59: "measure before adding any") — see
 * research/bot-manager-2026-10/ for the ones tried and why they are not here.
 *
 * Akamai: tesla.com's first document sets `_abck`, `bm_sz`, `bm_s`, `bm_sc` and
 * `bm_so` (measured, webRequest `onHeadersReceived` with `extraHeaders`).
 * `_abck` is the sensor's own cookie — it carries the verdict — and `bm_sz` is
 * set with it on every Akamai Bot Manager site measured. `ak_bmsc` is Akamai's
 * edge-only cookie: tesla.com does not set it and it says nothing about whether
 * a sensor runs, so it is not a trigger.
 */
export const BOT_MANAGERS = Object.freeze([
  Object.freeze({
    vendor: 'akamai',
    label: 'Akamai Bot Manager',
    cookies: Object.freeze(['_abck', 'bm_sz']),
  }),
]);

/** Bound on stored sites, as for the stats table. The oldest non-overridden entries go first. */
export const MAX_BOT_MANAGER_SITES = 500;

/**
 * The race fallback (see `lateFlagReload`): only a document this young is reloaded.
 * Past it the user is reading or typing, and a reload would cost more than the
 * next navigation's stand-down saves.
 */
export const LATE_RELOAD_WINDOW_MS = 10_000;

/** http(s) only, eTLD+1 — the same key the persona and the allowlist use. */
export function siteOf(url) {
  if (!url || typeof url !== 'string') return '';
  let u;
  try { u = new URL(url); } catch { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  return registrableDomain(u.hostname);
}

/**
 * Cookie NAMES from a webRequest `responseHeaders` array. Firefox may fold several
 * Set-Cookie lines into one header separated by newlines; Chrome sends one per
 * header (and only with `extraHeaders`).
 */
export function setCookieNames(responseHeaders) {
  const out = [];
  if (!Array.isArray(responseHeaders)) return out;
  for (const h of responseHeaders) {
    if (!h || typeof h.name !== 'string' || h.name.toLowerCase() !== 'set-cookie') continue;
    for (const line of String(h.value ?? '').split('\n')) {
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const name = line.slice(0, eq).trim();
      if (name) out.push(name);
    }
  }
  return out;
}

/** The first vendor whose trigger cookie is among `names`, or null. */
export function vendorFor(names) {
  const set = new Set(names);
  for (const bm of BOT_MANAGERS) {
    for (const cookie of bm.cookies) {
      if (set.has(cookie)) return { vendor: bm.vendor, label: bm.label, cookie };
    }
  }
  return null;
}

/** Display name for a stored vendor id. */
export function vendorLabel(vendor) {
  return BOT_MANAGERS.find((b) => b.vendor === vendor)?.label ?? String(vendor ?? '');
}

/**
 * Is this response a top-level document, and does it carry a bot-manager cookie?
 * Returns `{ site, vendor, label, cookie }` or null.
 *
 * `details` is a webRequest `onHeadersReceived` event. Every field read here is
 * the browser's own account of the request — none is page-controlled except the
 * URL, and of the URL only its host is used.
 */
export function topLevelHit(details) {
  if (!details || typeof details !== 'object') return null;
  if (!Number.isInteger(details.tabId) || details.tabId < 0) return null;   // not a tab: extension, worker
  if (details.frameId !== 0) return null;                                    // a sub-frame, or its document
  // A top-level document only — not even the top document's own first-party
  // requests: see "WHAT COUNTS" above (CNAME-cloaked trackers).
  if (details.type !== 'main_frame') return null;
  const site = siteOf(details.url);
  if (!site) return null;
  const hit = vendorFor(setCookieNames(details.responseHeaders));
  return hit ? { site, ...hit } : null;
}

/**
 * The race fallback. The handshake normally lands AFTER the main_frame response
 * that flags a site (measured 2026-10-17: the response event reaches the worker
 * 12-14 ms before the loader's GET_PERSONA when it is running, and first, in the
 * same millisecond, when the event has to wake it) — but nothing in the
 * platform promises that order. When the flag lands after the document that
 * response created already took a device profile, reload that tab ONCE.
 *
 * @param {object} p
 * @param {object|null} p.entry   the site's stored record, AFTER this flag was set
 * @param {boolean} p.isNew       this event created the record (the only transition that may reload)
 * @param {{site:string, at:number, active:boolean}|undefined} p.topDoc  the tab's last top-frame handshake
 * @param {string} p.site
 * @param {number} p.responseAt   when the response arrived (webRequest `timeStamp`)
 * @param {number} p.now
 * @returns {boolean} reload the tab now
 *
 * No loop by construction: a record is created once; `reloadedAt` is written on
 * it before the reload is issued; and the reloaded document's handshake is a
 * stood-down one, which can never satisfy `active`.
 */
export function lateFlagReload({ entry, isNew, topDoc, site, responseAt, now }) {
  if (!isNew || !entry || entry.override || entry.reloadedAt) return false;
  if (!topDoc || topDoc.site !== site || !topDoc.active) return false;
  if (now - topDoc.at > LATE_RELOAD_WINDOW_MS) return false;
  // The hit is about the document its response creates. Only a handshake that
  // came AFTER the response can belong to that document; an older one is the
  // previous page, and the new document's own handshake will see the flag.
  return topDoc.at >= responseAt;
}

/**
 * Keep the table bounded: drop the oldest non-overridden entries. Overrides are
 * the user's own decisions and are kept while anything else can go; `keep` is the
 * entry being added, which must not be the one that goes.
 */
export function prune(table, max = MAX_BOT_MANAGER_SITES, keep = null) {
  const keys = Object.keys(table);
  if (keys.length <= max) return table;
  const drop = keys
    .filter((k) => !table[k]?.override && k !== keep)
    .sort((a, b) => (table[a]?.at || 0) - (table[b]?.at || 0))
    .slice(0, keys.length - max);
  for (const k of drop) delete table[k];
  return table;
}
