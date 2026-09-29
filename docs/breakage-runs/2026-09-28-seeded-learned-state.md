# Seeded learned-state smoke — first runs, 2026-09-28 (the D50 release gate)

**Why.** On 2026-09-28 reCAPTCHA vanished from every third-party page in the owner's Chrome. The heuristic learner had
promoted `google.com` and its block rule's `requestDomains` covered `www.google.com/recaptcha/` and Google sign-in (D50).
Every automated check was green because every automated run started from a fresh profile, with no learned state. The
learner is the one layer whose behaviour changes with use, so the smoke now also runs with a **seeded** learned state:
`harness/site-smoke.mjs --seeded` (`npm run smoke:seeded` from `ext/`).

Generated reports, same date — all three ran on `b42beb4` (D50, before D51) plus this branch's then-uncommitted harness; file names carry that commit since the rebase onto `73b511b`:

| Run | Build under test | Report | Exit |
|---|---|---|---|
| Seeded, current code | store zip from `ext/tools/package.mjs` (0.9.0, D50 included) | `2026-09-28-site-smoke-seeded-b42beb4.md` / `.json` | **0** |
| Seeded, **negative control** | the same zip, `src/heuristics.js` + `src/allowlist.js` swapped for `b42beb4^` (= `c0bedeb`, pre-D50), temp dir only | `2026-09-28-site-smoke-seeded-control-c0bedeb-b42beb4.md` / `.json` | **1** |
| Default (fresh profile), current code | store zip | `2026-09-28-site-smoke-b42beb4.md` / `.json` (D51 committed its own `2026-09-28-site-smoke.md`, kept as is) | 0 |

Chrome for Testing 149.0.7827.22, headless, Puppeteer 25.1.0, Node 22.22.3. Every measured tab `visibilityState: visible`.

## How the seed gets in — and the proof it is live

In every ON browser, before any site: the harness writes the learner's own record into
`chrome.storage.local["nullecho:heuristics:v1"]` from the extension's service worker — `google.com, youtube.com,
facebook.com, microsoft.com, live.com, microsoftonline.com, apple.com, cloudflare.com, amazon.com, twitter.com, x.com,
linkedin.com`, each `{status: 'blocked', ruleId: 1000000+i, three sites, source: 'learned'}` — then reloads the extension
with CDP `Extensions.loadUnpacked` on the same path (same id, new worker), so the shipped `install()` and `onInstalled`
run the shipped `reconcile()`. **The harness never writes a DNR rule.** Positive control, read back from the new worker
(the run aborts with exit 3 if any line fails):

Current code — `getDynamicRules()` after the reload (12 rules, none existed before it):

```
1000002 block requestDomains=[facebook.com] excluded=[graph.facebook.com] thirdParty
1000003 block requestDomains=[microsoft.com] excluded=[] thirdParty
1000004 block requestDomains=[live.com] excluded=[login.live.com] thirdParty
1000005 block requestDomains=[microsoftonline.com] excluded=[login.microsoftonline.com] thirdParty
1000006 block requestDomains=[apple.com] excluded=[appleid.apple.com] thirdParty
1000007 block requestDomains=[cloudflare.com] excluded=[cdnjs.cloudflare.com,challenges.cloudflare.com] thirdParty
1000008 block requestDomains=[amazon.com] excluded=[] thirdParty
1000009 block requestDomains=[twitter.com] excluded=[] thirdParty
1000010 block requestDomains=[x.com] excluded=[] thirdParty
1000011 block requestDomains=[linkedin.com] excluded=[] thirdParty
1050000 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[google.com] excluded=[accounts.google.com,apis.google.com,www.google.com] thirdParty
1050001 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[youtube.com] excluded=[] thirdParty
```

D50 visible in the dump: `google.com` and `youtube.com` were migrated from the seeded `blocked` to cookie-strips in the
cookie range, and every block carries its protected hosts as `excludedRequestDomains`. The pre-D50 control's dump is the
same twelve domains as twelve bare `block` rules at 1000000–1000011 with no exclusions — the owner's rule, verbatim, for
`google.com`.

Also asserted before any row: stored records point at the live rules; static rulesets `ads, analytics, social,
fingerprinting` still on after the reload; a `no-cors` fetch from the fixture page to `www.linkedin.com` fails and the
`onRuleMatchedDebug` recorder attributes it to rule 1000011 — so the rules are enforced on page traffic and the per-row
attribution is not blind. 27/27 ✅ on current code, and in the control.

## Results — current code vs the pre-D50 control

ON = seeded, OFF = no extension. "Blocked by" = the learned rule the worker's `onRuleMatchedDebug` recorded for that
row, and the host it blocked — never an HTTP status.

| # | Row | Current | Pre-D50 control | Blocked by (control) |
|---|---|---|---|---|
| 1 | example.com | PASS | PASS | — |
| 2 | open.spotify.com | PASS | **FAIL** ¹ | google.com → www.google.com/recaptcha/enterprise.js |
| 3 | google.com/recaptcha/api2/demo (first-party) | PASS | PASS | — (a thirdParty rule cannot touch it: why the old smoke was blind) |
| 4 | accounts.hcaptcha.com/demo | PASS | PASS | — |
| 5 | demo.turnstile.workers.dev | PASS | **FAIL** | cloudflare.com → cdnjs.cloudflare.com, challenges.cloudflare.com |
| 6–8 | amazon.com, google.com/maps, openstreetmap.org | PASS | PASS | — |
| 9 | youtube.com/watch | PASS | **FAIL** ¹ | google.com → accounts.google.com/ServiceLogin, www.google.com (10 blocks) |
| 10 | chartjs.org | PASS | PASS | — |
| 11 | nytimes.com | BLOCKED | BLOCKED | bot wall (403), both passes |
| 12–13 | squoosh.app, irs.gov | PASS | PASS | — |
| 14 | reddit.com/r/technology | PASS | **FAIL** ¹ | google.com → reCAPTCHA Enterprise + accounts.google.com/gsi/client |
| 15 | reCAPTCHA v2, patrickhlauke.github.io | PASS | **FAIL** | google.com → www.google.com/recaptcha/api.js |
| 16 | reCAPTCHA v2, ascendpartner.com signup | PASS | **FAIL** | google.com → www.google.com/recaptcha/api.js |
| 17 | reCAPTCHA Enterprise (invisible), reddit.com/login | PASS | **FAIL** | google.com → www.google.com/recaptcha/enterprise.js |
| 18 | Cloudflare Turnstile, peet.ws | PASS | **FAIL** | cloudflare.com → challenges.cloudflare.com/turnstile/v0/api.js |
| 19 | hCaptcha, democaptcha.com | PASS | PASS | — (control row: no seeded domain covers hcaptcha.com) |
| 20 | Google Sign-In, reddit.com/login | PASS | **FAIL** | google.com → accounts.google.com/gsi/client |
| 21 | Google Sign-In, pinterest.com/login | PASS | **FAIL** | google.com → accounts.google.com/gsi/client |
| 22 | YouTube iframe embed (fixture) | PASS | **FAIL** ² | youtube.com → www.youtube.com/embed (sub_frame) |
| 23 | Google Maps embed, www.google.com (fixture) | PASS | **FAIL** | google.com → www.google.com/maps/embed (sub_frame) |
| 24 | Google Maps embed via maps.google.com (fixture) | PASS | **FAIL** | google.com → maps.google.com (sub_frame) |
| 25 | Google Calendar embed (fixture) | PASS | **FAIL** | google.com → calendar.google.com (sub_frame) |
| 26 | Facebook SDK + Page plugin (fixture) | POLICY-BLOCKED | POLICY-BLOCKED | facebook.com → www.facebook.com/…/plugins/page.php |
| 27 | Embedded X post (fixture) | POLICY-BLOCKED | POLICY-BLOCKED | twitter.com → platform.twitter.com/widgets.js |

**Current: 24 PASS, 1 BLOCKED, 2 POLICY-BLOCKED, 0 FAIL; learned blocks on protected hosts: 0; worker console clean.**
**Control: 14 FAIL (every one attributed to a learned rule); learned blocks on protected hosts: 28; the worker console
shows the D50 reload race** — `[nullecho] heuristics.reconcile failed: Error: Rule with id 1000008 does not have a
unique ID.` (from `onInstalled`'s reconcile, so the reload does run both callers). On current code the same rows pass
while the rules are demonstrably live: rows 22/24/25 record the google.com / youtube.com cookie-strip matching the embed,
rows 26/27 record facebook.com / twitter.com blocks, and rows 15–21/23 record **no** match — the carve-outs, not an
absent rule.

¹ The row's own functional check passed in the control; it FAILs on the **D50 invariant over all traffic** — a learned
BLOCK matched a NEVER_BLOCK / COOKIE_BLOCK_ONLY host. Without that check the control would have shown the pre-D50
learner silently taking reCAPTCHA Enterprise off Spotify and Google's sign-in frame off YouTube as PASS.
² Seed artifact, stated plainly: the pre-D50 learner itself would have written `youtube.com` as `cookieblocked` (it was
already yellowlisted). This row shows D50's reconcile migration of a `blocked` yellowlisted record, not the carve-out.

## Attacks on the harness itself

- **Positive control can fail:** a scratch copy seeding under a wrong storage key → exit 3 before any row, 24 ✗ lines
  ("a live learned rule covers it — NONE"). Not committed; the sed is `s/return m[1];/return m[1] + ':SABOTAGED';/`.
- **No check passes without its widget:** every third-party check run on the fixture with no embed (`?e=none`) → 13/13 FAIL.
- **OFF was OFF, ON was ON:** OFF browsers had no `chrome-extension://` target; ON browsers had Nullecho's worker, and
  example.com ON showed GPC true + persona cores ≠ host cores after the reload.
- **Flakiness is not a verdict:** ON-only failures retried in a freshly seeded browser; OFF failures retried in a fresh OFF
  browser before anything can be NOT-OURS (Calendar OFF read an empty body once in an earlier control run; YouTube playback
  OFF failed once in today's default run and passed on the retry). A network drop is VOID, never a PASS/FAIL, and a VOID retry keeps the first attempt (an earlier control
  run lost five rows' retries to `ERR_INTERNET_DISCONNECTED` — that run was discarded and redone).
- **Checks read APIs after the widget frame, not at settle time:** the first cut read `window.FB` 3.5 s in and reported an
  SDK "missing" that rendered a second later.
- **nytimes misclassification fixed:** OFF got the homepage and a 403 on the article, ON a 403 on the homepage — the same
  wall, previously scored "blocked ON only" = FAIL. Both are now BLOCKED.

## Findings about the extension (not fixed — evidence only; 1 and 3 were fixed on main by D52, see the update below)

1. **POLICY (owner decision): a learned block on `facebook.com` or `twitter.com` removes that provider's embeds from every
   third-party site.** Rows 26/27: rule 1000002 blocks the Page plugin sub_frame, rule 1000009 blocks
   `platform.twitter.com/widgets.js`, on current code. The static `social.json` deliberately blocks only Facebook's pixel
   endpoints and leaves plugins alone, so the learned rule removes more than the curated list chose to. The same live rule
   shapes predict it — **not render-verified** — for Apple Music / Podcasts embeds (`embed.music.apple.com` under
   `apple.com`, only `appleid.apple.com` carved), OneDrive / Office Online embeds (`live.com`, only `login.live.com`
   carved) and LinkedIn post embeds. D50's reasoning for putting `google.com` on COOKIE_BLOCK_ONLY ("Maps, Forms, Docs,
   Calendar and Translate embeds are visible features") applies to them. No stable public Facebook **Login** page was
   found (the XFBML login button needs a real app id), so FB sign-in itself was not measured; `FB.login()`'s popup is a
   top-level navigation, which learned rules do not touch (next item).
2. **Top-level navigations are unaffected by learned rules (measured, good news).** With all twelve seeded, a link click
   from example.com to amazon / linkedin / facebook / apple / microsoft / x / google / youtube loaded all eight on the
   current code, and the seven captured on the pre-D50 code (amazon's line was cut from that output) — scratch script,
   not a gate row. DNR's `thirdParty` does not catch a main frame.
3. **A learned `microsoft.com` rule blocks microsoft.com's OWN silent sign-in callback** (current code). On
   www.microsoft.com with only `microsoft.com` seeded, the worker recorded rule 1000000 blocking the sub_frame
   `https://www.microsoft.com/cascadeauth/account/signin-oidc`, initiator `https://login.live.com`; with an unrelated seed
   the request is not blocked. The carve-outs protect requests **to** identity hosts, not the IdP's post **back** to a
   relying party whose own domain was learned — the same shape can hit any site whose login returns cross-site into an
   iframe. User-visible impact (likely: shown signed-out until the user clicks Sign in, which is top-level) **not
   verified**. Scratch script, not a gate row.

## Not verified

Branded Chrome with a real signed-in profile (Google sees signals there CfT does not — still owner step 3); reCAPTCHA /
Turnstile / hCaptcha **solving** (render only); the learner **earning** these promotions from traffic (seeded directly);
the `onInstalled` reason string (only that it fired); Google Forms (no stable public form — Calendar stands in); the
Facebook Login button.

---

## Update — rebased onto D51 + D52 (`f5a906d`), reruns on `956882e`

Branch rebased onto `main` `f5a906d` (D51 real browser version `41f4b69`, owner verification `73b511b`, D52 `f5a906d`).
D52 acted on findings 1 and 3: facebook.com / instagram.com / twitter.com / x.com / linkedin.com / tiktok.com joined
COOKIE_BLOCK_ONLY, and every learned rule now carries its company's other domains (`ENTITY_GROUPS`) as
`excludedInitiatorDomains`. On this branch: rows 26/27 lost `policy: true` and now gate; **row 28** checks
microsoft.com's own silent sign-in hand-off — deterministic signed out (4/4 fresh profiles OFF: microsoftonline → live →
`POST /cascadeauth/account/signin-oidc` from login.live.com → 302 → `silentauth` frame); PASS needs a real server
response to the POST **and** the frame landing back on www.microsoft.com. Report names now carry the commit tested.

| Run (code `956882e`, Chrome for Testing 149.0.7827.22) | Report | Result | Exit |
|---|---|---|---|
| `npm test` / `node rules/validate.mjs` | — | 510/510 / all rulesets valid | 0 / 0 |
| Default smoke | `2026-09-28-site-smoke-956882e.md` | 13 PASS, nytimes BLOCKED; D51 identity ON = OFF | **0** |
| Seeded smoke | `2026-09-28-site-smoke-seeded-956882e.md` | **27 PASS**, nytimes BLOCKED; positive control 27/27; 0 protected-host blocks; worker console clean; no rule drift; no retries | **0** |
| Seeded, pre-D52 learner (`--learner-from 73b511b`, rows 26–28 only) | `2026-09-28-site-smoke-seeded-control-73b511b-956882e.md` | **3 FAIL**: 1000002 facebook.com → page.php sub_frame; 1000009 twitter.com → widgets.js; 1000003 microsoft.com → signin-oidc sub_frame, initiator `https://login.live.com` (POST `net::ERR_BLOCKED_BY_CLIENT`, frame on chrome-error) | 1 |

The pre-D50 control (`--learner-from 'b42beb4^'`) was not rerun: the rebase did not touch the seeding or swap path.

Rule dump after the reload on `956882e` (D52 visible — social platforms now cookie-strips, initiator exclusions):

```
1000003 block microsoft.com       excluded=[]                        excludedInitiators=[live.com,msn.com,bing.com,office.com,sharepoint.com,windows.net]
1000004 block live.com            excluded=[login.live.com]          excludedInitiators=[microsoft.com,msn.com,bing.com,office.com,sharepoint.com,windows.net]
1000005 block microsoftonline.com excluded=[login.microsoftonline.com]  (no company group → no initiator exclusions)
1000006 block apple.com           excluded=[appleid.apple.com]       excludedInitiators=[icloud.com,cdn-apple.com,mzstatic.com]
1000007 block cloudflare.com      excluded=[cdnjs…,challenges…]      excludedInitiators=[cloudflareinsights.com]
1000008 block amazon.com          excluded=[]                        excludedInitiators=[amazonaws.com,media-amazon.com,ssl-images-amazon.com,amazon-adsystem.com]
1050000-1050005 strip  facebook.com, google.com, linkedin.com, twitter.com, x.com, youtube.com (each with its company's initiators excluded)
```

On `956882e` the seeded rules are live and matching where rows pass: cookie-strips recorded on www.youtube.com (22),
maps.google.com (24), calendar.google.com (25), platform.twitter.com (27).

**New, predicted from that dump, not rendered:** `microsoftonline.com` belongs to no company group, so neither the
microsoft.com nor the live.com rule excludes it as an initiator. A `login.microsoftonline.com` form-post back into a
learned microsoft.com or live.com host — the work/school-account version of row 28 — is still blocked. Needs a signed-in
work account to render; the rule shape alone shows it.

**About D51's identity check in this harness:** it passes in both runs, but the harness sets the page User-Agent with
`page.setUserAgent(ua)` and no metadata (to drop "HeadlessChrome"), so the page's `userAgentData.brands` and
`getHighEntropyValues()` are **empty in both passes** — ON = OFF compares the UA override with itself and empty with
empty. It still catches a shim that invents a UA or brands (pre-D51 would differ), but it does not show the real brands
passing through. `harness/unpacked-chrome.mjs`'s version gate (no override) is the one that checks real values.
