# Nullecho — blocking rulesets

MV3 `declarativeNetRequest` static rulesets. `manifest.json` has no comments, so
this file is the comment: what is in each list, where the domains came from, and
— more importantly — **what was deliberately left out and why**.

Validate with `node rules/validate.mjs` (or `npm run validate` from `ext/`).
That check is not optional: a single malformed rule makes Chrome silently reject
the *entire* ruleset, and the user is left believing they are protected.

---

## Rule ID ranges

Chrome only requires ids to be unique *within* a ruleset. Nullecho makes them unique
**globally**, so a rule id is a stable name for one tracker across the whole
extension — which is what lets the UI map "blocked" back to a vendor, and lets
`updateStaticRules({disableRuleIds})` allowlist a single tracker without turning
off a whole category.

| Range | Owner | Rules | Kind |
|---|---|---|---|
| `1000–1999` | `ads.json` | 81 | static |
| `2000–2999` | `analytics.json` | 35 | static |
| `3000–3999` | `social.json` | 41 | static |
| `4000–4499` | `fingerprinting.json` — tier A, cross-site device ID | 9 (`4000–4008`) | static |
| `4500–4699` | `fingerprinting.json` — tier B, anti-fraud device ID | 8 (`4500–4507`) | static |
| `4700–4799` | `fingerprinting.json` — tier C, first-party exceptions | 1 | static |
| `5000–5099` | `gpc.json` | 1 | static |
| `900000–999999` | per-site allowlist (`protocol.js` `ALLOW_RULE_ID_BASE`) | — | dynamic |
| `1000000–1049999` | heuristics: learned blocks | — | dynamic |
| `1050000–1099999` | heuristics: learned cookie-blocks | — | dynamic |
| `1100000–1100999` | GPC per-site exceptions | — | dynamic |

**176 static rules, 176 unique ids.** Verified, not assumed — `validate.mjs`
fails on a duplicate, an out-of-range id, or an id that lands in a range
reserved for runtime rules.

### Conventions

- **`resourceTypes` is omitted on block rules, on purpose.** With both
  `resourceTypes` and `excludedResourceTypes` absent, DNR matches every resource
  type *except* `main_frame`. That is exactly right: block the tracker's
  subresources, never break a user who clicks a link to `taboola.com`.
  `validate.mjs` rejects any block rule that opts `main_frame` back in.
- **`domainType: "thirdParty"`** is set on rules targeting a domain the user may
  also visit as a site — `facebook.com`, `twitter.com`, `linkedin.com`,
  `pinterest.com`, `reddit.com`, `tiktok.com`. Without it, Nullecho would break
  those sites for their own users.
- **Path-scoped `urlFilter` rules over host blocks** wherever a host serves both
  tracking and site function. `licdn.com` is LinkedIn's asset CDN, so only
  `licdn.com/*li.lms-analytics/` is blocked. `pinimg.com` is Pinterest's image
  CDN, so only `s.pinimg.com/ct/`. `t.co` is the link shortener, so only
  `t.co/i/adsct`.
- **One rule per tracker**, not one batched rule per category. 176 rules is
  nothing against Chrome's 30,000-rule budget, and the attribution is worth far
  more than the bytes.

---

## Where the domains came from

Every entry had to appear in at least one of these, checked programmatically —
nothing was written from memory:

| Source | Fetched | Used for |
|---|---|---|
| **DuckDuckGo Tracker Radar** (`extension-tds.json`, v6) | 2026-08-20 | Ownership, prevalence, category, and DDG's own default action. 1,030 tracker entries. The prevalence figure is why the ad list is ordered the way it is. |
| **EasyPrivacy** (`easylist.to/easylist/easyprivacy.txt`) | 2026-08-20 | Confirmation of tracker hosts, and — more usefully — its `@@` exception rules, which are a field-tested record of what blocking *breaks*. |
| **AdGuard Tracking Protection** (filter 3, uBO build) | 2026-08-20 | Third opinion, and the source for several path-scoped rules (`licdn.com/*li.lms-analytics/`, `facebook.com/privacy_sandbox/pixel/`, `analytics.twitter.com/*adsct`). |

Inclusion rule: **DDG default action is `block`, OR the domain appears as a
`||domain^` rule in EasyPrivacy, OR in AdGuard.** Roughly 30 candidate domains
failed that bar and were dropped rather than guessed at — including
`moatads.com`, `serving-sys.com`, `vwo.com`, `pendo.io`, `appsflyer.com`,
`adjust.com`, `triplelift.com`, `themediagrid.com`, `spotxchange.com`,
`snap.licdn.com`, `an.facebook.com` and `atlassolutions.com`. A blocklist of
plausible-sounding wrong domains is worse than a shorter correct one.

---

## `social.json` — the Meta Pixel is the point

DECISIONS.md **D5**: Meta retired "Your activity off Meta technologies"
(announced 2026-06-09, US rollout July 2026). Businesses keep transmitting
through Pixel and CAPI regardless of what the user sets in their account. The
highest-value lever inside Meta's own UI is gone, so the network layer is now
the only real one. This is the most thorough block in the extension.

**Blocked** (13 rules): `fbevents.js` (the pixel library), `connect.facebook.net/signals/`
(pixel config *and* `openbridge3.js`, the browser-side CAPI bridge),
`facebook.com/tr` (the pixel's data endpoint), `privacy_sandbox/pixel/`,
`sem_mpixel/`, `adnw_request`, `brandlift.php`, `ai.php`, `xti.php`,
`impression.php`, `fbsbx.com/paid_ads_pixel/`, plus `analytics.facebook.com`,
`pixel.facebook.com` and `atdmt.com` (Atlas, Meta-owned).

**Deliberately NOT blocked**, because these are the difference between a privacy
tool and an uninstall:

- `connect.facebook.net/<locale>/sdk.js` and `all.js` — Facebook Login and the
  social plugins. "Continue with Facebook" must keep working.
- `graph.facebook.com` — the Login SDK's API endpoint.
- `fbcdn.net` — image and video CDN.

The pixel is a cleanly separable surface from the SDK, which is what makes this
possible. DuckDuckGo reaches the same conclusion by a different route: it marks
`facebook.net` as `ignore` by default and blocks individual paths.

**What we cannot reach:** Meta's **Conversions API Gateway** runs on
customer-owned subdomains (`capig.<customer>.com` and similar), and CAPI proper
is server-to-server — the browser is not involved at all. No extension can block
either. The UI must not imply Nullecho stops Meta tracking; it stops the *browser
half* of it.

---

## `fingerprinting.json` — three tiers, and one honest warning

**Tier A (`4000–4499`) — fingerprinting as a product.** FingerprintJS Pro's
entire delivery surface (`fpjs.io`, `fpcdn.io`, `fpjscdn.net`, `openfpcdn.io`,
`fpnpmcdn.net`, `fptls.com` through `fptls4.com`), plus `bluecava.com`,
`adscore.com`, and `stape.io` (server-side GTM sold explicitly as first-party
cloaking). Low breakage risk — these sell a visitor ID, not a site feature.

**Tier B (`4500–4699`) — anti-fraud device ID.** ThreatMetrix
(`online-metrix.net`), Iovation (`iovation.com`, `iesnare.com`), Sift, Forter,
Signifyd, SEON, Ravelin, `beacon.riskified.com`.

> These are real fingerprinters **and** they sit inside bank sign-in and
> checkout. EasyPrivacy ships `@@` exceptions for `mpsnare.iesnare.com` on
> citi.com, usbank.com, westernunion.com, skype.com and a dozen more, and for
> `ci-mpsnare.iovation.com` on equifax.ca. That is not speculation about
> breakage — it is a record of breakage that already happened to someone.

**Tier B therefore ships disabled.** `background.js` calls
`updateStaticRules({disableRuleIds: 4500..4699})` on first install, and the UI
exposes it as an explicit opt-in ("may break bank sign-in and checkout"). The
contiguous id range exists precisely so this toggle is one call.

**Tier C (`4700`)** is a single `allow` rule at priority 100, scoped to the tier
B vendors and to the ~20 first-party domains EasyPrivacy documents as breaking.
It is scoped by `requestDomains`, so it can never unblock anything else.

### Fingerprinters we refuse to block

DataDome, PerimeterX/HUMAN, Arkose Labs, FunCaptcha, Kount, Imperva/Incapsula.
All of them fingerprint. All of them also sit *in front of the site as an access
gate* — block them and the user does not get a degraded page, they get no page.
EasyPrivacy blocks DataDome and then carries exceptions for Venmo, MoneyGram,
Garena SSO, Monster and TheFork; that pattern is the tell. These are on the
never-block list in `src/allowlist.js`, which means the heuristic layer cannot
learn its way into blocking them either.

---

## Never blocked, in any ruleset

`src/allowlist.js` is the single source of truth, shared by `validate.mjs` (which
fails the build) and `heuristics.js` (which will not promote them): 69 never-block
entries and 24 cookie-block-only entries.

**`NEVER_BLOCK`** — blocking it denies the user the site:

- **Fonts** — `fonts.googleapis.com`, `fonts.gstatic.com`, Typekit
- **CAPTCHA** — reCAPTCHA (`recaptcha.net`, `gstatic.com`), hCaptcha,
  Cloudflare Turnstile, Arkose
- **Script CDNs** — jsDelivr, unpkg, cdnjs, `ajax.googleapis.com`, code.jquery,
  esm.sh, Skypack, JSPM
- **SSO** — Google, Microsoft, Apple, Auth0, Okta, OneLogin, Duo,
  `graph.facebook.com`
- **Payments** — Stripe, PayPal, Braintree, Adyen, Square, Klarna, Affirm
- **Bot-defence gates** — see above

**`COOKIE_BLOCK_ONLY`** — the Privacy Badger yellowlist. Tracks, but carries a
visible feature, so the heuristic layer strips its cookies (a dynamic
`modifyHeaders` rule) instead of blocking it: YouTube, Vimeo, SoundCloud,
Spotify, Google Maps, Intercom, Zendesk, Disqus, Gravatar, Imgur.

### Judgement calls worth arguing with

These are *deliberate* exclusions, not oversights. Each one is a case where
blocking is defensible but we decided the privacy gain did not justify the cost:

| Not blocked | Why |
|---|---|
| Sentry, Bugsnag | Crash reporting. No cross-site identity. Blocking it only stops the site owner fixing bugs. |
| New Relic, Akamai mPulse | RUM/APM. Session-scoped performance data, no cross-site profile. |
| Cloudflare Insights, Plausible, Simple Analytics, Matomo Cloud, Fathom | Cookieless, first-party-scoped analytics. There is no cross-site profile here to degrade, and blocking the privacy-respecting option punishes the sites that chose it. DDG blocks `cloudflareinsights.com` by default (22% prevalence); we disagree, and this row is the argument. |
| HubSpot (`hubspot.com`, `hsforms.*`), Klaviyo | Render the site's own forms, CTAs and chat. `hs-analytics.net` **is** blocked — that is the tracking half, cleanly separable. |
| `yandex.ru`, `bing.com`, `reddit.com`, `tiktok.com`, `facebook.com` as hosts | Search engines and destination sites. Only their tracking hosts and paths are blocked (`mc.yandex.ru`, `bat.bing.com`, `alb.reddit.com`, `analytics.tiktok.com`, `facebook.com/tr`). |
| `t.co` as a host | It is the link shortener. Blocking it breaks every link in every embedded tweet. Only `t.co/i/adsct` is blocked. |

And two we **did** include despite real risk, flagged so the first bug report is
not a surprise: **Optimizely** and **VWO** (`visualwebsiteoptimizer.com`).
Experimentation platforms can gate rendering behind an anti-flicker snippet, so
blocking them can cause a flash or a layout shift. Both are DDG default-block and
both build cross-visit profiles, so they stay — but they are the most likely
source of "the page looked weird" reports in `analytics.json`.

---

## `gpc.json` — one rule, two enforcement points

A single `modifyHeaders` rule (id 5000) setting `Sec-GPC: 1` on every resource
type **including `main_frame`** — the top-level navigation is where a site
actually looks for the signal.

Its `excludedRequestDomains` / `excludedInitiatorDomains` carry 50 hosts that
*break* when GPC is present rather than honouring it, seeded from EasyPrivacy's
dedicated `! GPC` section. USAA, for example, answers with "Enable Cookies.
Please enable cookies in your browser to access USAA."

**Those sites break on the JS property, not the header** — which is why the same
list also appears as `exclude_matches` on the `src/gpc.js` content script, in
**both** `manifest.json` and `manifest.firefox.json`. Half a signal is worse than
none, so `validate.mjs` compares all three lists, per manifest and per host, and
fails on any drift. See the header comment in `src/gpc.js` for the honest limits
on what GPC actually achieves.

---

## Maintenance

1. Edit the JSON directly — it is the source of truth, not a build artifact.
2. Keep the new id inside the file's range.
3. Justify it against one of the three sources above; if it is in none of them,
   do not add it.
4. Check it against `src/allowlist.js` before assuming it is safe to block.
5. `npm run validate` and `npm test`. Both must pass.

Blocklists rot — vendors move hosts and get acquired. The three sources are all
regenerable; re-run the inclusion check rather than trusting this file's age.
