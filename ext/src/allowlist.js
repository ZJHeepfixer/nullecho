/**
 * Nullecho — never-block allowlist
 * ────────────────────────────
 * Anti-tracking that breaks sites gets uninstalled, and an uninstalled
 * extension protects no one (ARCHITECTURE.md, "Compatibility posture").
 *
 * This file is the single source of truth for that posture. It is consumed by:
 *   - ext/rules/validate.mjs   — fails the build if a static rule would hit one
 *   - ext/src/heuristics.js    — the passive learner may never promote one
 *
 * Two tiers, because "don't block" and "don't track" are different asks:
 *
 *   NEVER_BLOCK        Blocking this denies the user the site. Fonts, captchas,
 *                      script CDNs, SSO, payments, bot-defence gates. We do not
 *                      block these and we do not strip their cookies either —
 *                      several of them authenticate with cookies.
 *
 *   COOKIE_BLOCK_ONLY  Needed for a visible site feature (embedded video, live
 *                      chat, maps) but tracks while providing it. Privacy
 *                      Badger calls this the yellowlist. Under MV3 the
 *                      equivalent action is a dynamic `modifyHeaders` rule that
 *                      strips Cookie / Set-Cookie, which heuristics.js applies
 *                      instead of a block.
 */

/** Blocking any of these denies access to the site itself. */
export const NEVER_BLOCK = [
  // ── Web fonts ──────────────────────────────────────────────────────────
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'p.typekit.net',
  'fonts.net',

  // ── CAPTCHA / human-verification. Blocking these locks the user out. ───
  'recaptcha.net',
  'www.recaptcha.net',
  'hcaptcha.com',
  'newassets.hcaptcha.com',
  'challenges.cloudflare.com',
  'arkoselabs.com',
  'funcaptcha.com',

  // ── Bot-defence / WAF gates. These sit in front of the whole site. ─────
  // They do fingerprint, and EasyPrivacy carries rules for some of them —
  // but it also carries a long tail of @@ exceptions for login and checkout
  // (Venmo, MoneyGram, Garena SSO, Monster). A tracker you cannot block
  // without locking the user out is not a tracker we block.
  'datadome.co',
  'perimeterx.net',
  'px-cloud.net',
  'px-cdn.net',
  'kount.com',
  'kaptcha.com',
  'incapsula.com',
  'imperva.com',

  // ── Script / asset CDNs. Blocking these blanks the page. ───────────────
  'cdn.jsdelivr.net',
  'jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'code.jquery.com',
  'esm.sh',
  'cdn.skypack.dev',
  'jspm.io',
  'gstatic.com',
  'googleapis.com',

  // ── Identity / SSO. Blocking these breaks sign-in. ────────────────────
  'accounts.google.com',
  'apis.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'auth0.com',
  'okta.com',
  'oktacdn.com',
  'onelogin.com',
  'duosecurity.com',
  'graph.facebook.com',
  'connect.facebook.net/en_US/sdk.js',

  // ── Payments. Blocking these loses the user money, not just a page. ───
  'js.stripe.com',
  'stripe.com',
  'stripe.network',
  'paypal.com',
  'paypalobjects.com',
  'braintreegateway.com',
  'braintree-api.com',
  'adyen.com',
  'squareup.com',
  'squarecdn.com',
  'klarna.com',
  'affirm.com',

  // ── Deliberate non-targets, documented in ext/rules/README.md ─────────
  // Crash/error reporting: no cross-site identity, and blocking it only
  // stops the site owner from fixing bugs.
  'sentry.io',
  'bugsnag.com',
  'newrelic.com',
  'nr-data.net',
  'go-mpulse.net',
  // Cookieless analytics: no cross-site profile to degrade.
  'plausible.io',
  'simpleanalytics.com',
  'matomo.cloud',
  'usefathom.com',
  'cloudflareinsights.com',
  // Marketing platforms that also render the site's own forms and chat.
  'hubspot.com',
  'hsforms.com',
  'hsforms.net',
  'klaviyo.com',
];

/** Tracks, but provides a visible feature. Strip cookies; do not block. */
export const COOKIE_BLOCK_ONLY = [
  'youtube.com',
  'youtube-nocookie.com',
  'ytimg.com',
  'vimeo.com',
  'vimeocdn.com',
  'jwplayer.com',
  'brightcove.net',
  'soundcloud.com',
  'spotify.com',
  'maps.googleapis.com',
  'maps.google.com',
  'openstreetmap.org',
  'intercom.io',
  'intercomcdn.com',
  'zendesk.com',
  'zdassets.com',
  'tawk.to',
  'crisp.chat',
  'livechatinc.com',
  'disqus.com',
  'disquscdn.com',
  'gravatar.com',
  'giphy.com',
  'imgur.com',
];

const NEVER_BLOCK_SET = new Set(NEVER_BLOCK.map((d) => d.toLowerCase()));
const COOKIE_BLOCK_SET = new Set(COOKIE_BLOCK_ONLY.map((d) => d.toLowerCase()));

/** True if `host` is, or is a subdomain of, any entry in `set`. */
function matches(set, host) {
  if (!host) return false;
  const h = host.toLowerCase().replace(/\.$/, '');
  if (set.has(h)) return true;
  for (const entry of set) {
    if (entry.includes('/')) continue; // path-scoped entries are checked by URL
    if (h.endsWith(`.${entry}`)) return true;
  }
  return false;
}

export const isNeverBlock = (host) => matches(NEVER_BLOCK_SET, host);
export const isCookieBlockOnly = (host) => matches(COOKIE_BLOCK_SET, host);
