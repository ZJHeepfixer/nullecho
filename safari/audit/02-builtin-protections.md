# Safari 27 built-in privacy protections — what Apple already does

Audit date: 2026-10-01. Purpose: establish, with evidence, what Safari 27 does for
privacy *without* Nullecho, so the Safari port neither rebuilds nor takes credit for
it. Every claim below is tagged **MEASURED** (we ran it, raw output is quoted or
summarised from the server log) or **DOCS** (Apple/WebKit publication, URL + date).
Anything we could not measure is marked **unverified** and listed under
"Owner steps" at the end.

## 0. Environment and method

| Item | Value |
|---|---|
| macOS | 26.6 (25G5043d), Safari **27.0** (`Version/27.0 Safari/605.1.15`), default (non-private) browsing only |
| iPadOS | iOS Simulator runtime **27.0 (24A434)**, iPad Air 11-inch (M4), Safari `Version/27.0`; default browsing, "All Browsing" AFP, and a Private tab |
| Xcode | 27.0 (27A266a) |
| Server | `python3` `http.server`, bound to `127.0.0.1:47201`, every response `Cache-Control: no-store`; logs method, raw request-target (incl. query) and **all** request headers per request; accepts POSTed probe results |
| Probe page | reports `navigator.globalPrivacyControl`, `'globalPrivacyControl' in navigator`, `document.visibilityState` (run **INVALID** unless `visible` at start and end), UA, a same-origin `fetch()`, an `<img>` subresource, a CORS fetch to `https://httpbin.org/headers` whose JSON is POSTed back, five known-tracker `<script>` loads (GA, GTM, Facebook pixel, Hotjar, Segment) with onload/onerror, four `no-cors` tracker fetches, canvas (`toDataURL` + `getImageData`), WebGL (`readPixels` + `toDataURL`), WebAudio (`OfflineAudioContext` → `getChannelData`) each read **twice** in-page, screen/window metrics, `hardwareConcurrency`, fonts (30-font width probe), storage quota, `speechSynthesis.getVoices().length` |
| Sites | `127.0.0.1:47201` and `localhost:47201` are different sites on the same server, so a cross-site comparison needs no second port |
| macOS opens used | 4 of the 6 allowed (`open -a Safari …`); no Safari/System setting was touched |
| iPad | setting changed inside the simulator only: Settings › Apps › Safari › Advanced › *Advanced Tracking and Fingerprinting Protection* set to **All Browsing** for three runs, then **restored to "Private Browsing"** (verified by screenshot) |

Self-checks that prove each check can fail (server log, verbatim fields):

```
GET /ping?selfcheck=plain                                   UA=curl/8.7.1  Sec-GPC=None
GET /ping?selfcheck=gpc        (curl -H 'Sec-GPC: 1')       UA=curl/8.7.1  Sec-GPC=1
GET /landing?label=curl&gclid=G1&fbclid=F1&msclkid=M1&utm_source=US1&keep=K1   (query logged in full)
GET /probe.html  →  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
```

A control run of the same probe in a Chromium-based browser pane produced byte-identical
canvas/WebGL/audio hashes on two reads, all five tracker scripts loaded (Segment's test
URL is a real 404, so "error" for `cdn.segment.com` is expected everywhere), and the
httpbin echo worked — i.e. the probe itself does not introduce differences.

Summary of runs (all `VALID` unless noted):

| Label | Platform | Mode | Site |
|---|---|---|---|
| mac-default-1 / -2-localhost / -3-reload | macOS Safari 27.0 | default | 127.0.0.1 / localhost / 127.0.0.1 again (run 3 started `hidden` → INVALID by protocol; values identical anyway) |
| mac-open-url-default | macOS | default | URL with tracking params handed to Safari by another app |
| ipad-default-1 / -2-localhost / -3-reload | iPadOS 27.0 sim | default (AFP = Private Browsing) | as above |
| ipad-afp-all-1 / -2-localhost / -3-reload | iPadOS 27.0 sim | AFP = **All Browsing** | as above |
| ipad-afp-all-same / -cross / (httpbin) | iPadOS 27.0 sim | AFP = All Browsing | link clicks |
| ipad-private-1 (+ same-site link click) | iPadOS 27.0 sim | **Private tab** | 127.0.0.1 |

## 1. Summary table

| Protection | macOS 27 default | iPadOS 27 default | Private Browsing | What it covers | Evidence |
|---|---|---|---|---|---|
| **Global Privacy Control** (`Sec-GPC`, `navigator.globalPrivacyControl`) | **Not sent.** Property exists but is `false` | **Not sent.** Property absent | **Not sent** (iPad measured; macOS unverified) | — | MEASURED: 57 requests from Safari engines, 0 with `Sec-GPC`; httpbin saw none in 11 runs. DOCS: WebKit added GPC as an opt-in *embedder API* in 2026, default NO (§2) |
| **ITP** (3rd-party cookie blocking, partitioned storage, 7-day script-storage cap, CNAME/IP-cloak cookie cap, bounce-tracking classification, referrer trimming) | On ("Prevent cross-site tracking") | On ("Prevent Cross-Site Tracking" toggle ON) | On | Cookies/storage/referrer — **does not block tracker requests** | DOCS webkit.org/tracking-prevention; MEASURED: all 5 tracker scripts + 4 tracker beacons loaded in default browsing on both platforms (§3) |
| **Advanced Tracking and Fingerprinting Protection** (noise on canvas/WebGL/audio readback, screen metrics clamped, known-tracker request blocking, link param stripping) | Off in regular browsing (default = Private Browsing only) — inferred from measurements, setting itself not readable | **Default = "Private Browsing"** (read in Settings) | **On by default** | Noise + metrics + tracker blocking + link stripping | MEASURED on iPad: identical hashes in default mode across site/reload; different per site *and* per reload with AFP=All Browsing and in a Private tab (§4) |
| **Safari 26+ "known fingerprinting scripts" protection** (part of ITP, list-based) | On | On | On | Only scripts on Apple's `FINGERPRINTING_SCRIPTS` list (217 entries observed) | DOCS webkit.org Safari 26.0 post; list observed in simulator cache (§4.3). Not measurable with our own (unlisted) script |
| **Link Tracking Protection** | **Not applied** to a URL opened from another app (full query arrived) | Not measured in default mode (needs a tap) | **Applied** (Private tab and AFP=All Browsing): `gclid fbclid msclkid dclid twclid igshid mc_eid yclid __hssc _hsenc vero_id oly_enc_id` removed; `ttclid _ga wbraid gbraid utm_*` kept | Same-site and cross-site link clicks alike | MEASURED (§5); Apple's downloaded `QUERY_PARAM` list observed (§5.2) |
| **Known-tracker request blocking** (Private Browsing / AFP All Browsing) | n/a | n/a | **unverified** — trackers loaded in the simulator, but the simulator had no compiled `TrackingResourceRequestContentBlocker` rule list | Requests to DuckDuckGo∩EasyPrivacy trackers | DOCS Private Browsing 2.0 + Safari 17 release notes; MEASURED only in a simulator that lacked the block list (§4.4) |
| **iCloud Private Relay** | Not active on this Mac for Safari (egress identical to a direct request) | Not applicable in simulator (no iCloud account) | same | Safari traffic + DNS + insecure HTTP from apps; needs iCloud+ | DOCS Apple overview PDF / support doc; MEASURED same/different only (§6) |
| **Hide IP Address** (from trackers) | not readable | **"Off"** in the simulator's Settings | — | Known trackers via relay (iCloud+ extends to all sites) | MEASURED (Settings screenshot) / DOCS Apple iPhone guide (§6) |

## 2. Global Privacy Control — the headline result

### 2.1 Measured

Every request Safari made to our server and every CORS request it made to
`https://httpbin.org/headers` was inspected for `Sec-GPC`.

```
requests from Safari engines (macOS + iPad), all modes:  57   with Sec-GPC: 0
runs whose httpbin echo contained a Sec-GPC header:       0 of 11
```

Representative log lines (UA truncated; `Version/27.0 Safari/605.1.15` on every line):

```
16:29:27 GET  /probe.html?label=mac-default-1                  Sec-GPC=None   (navigation)
16:29:27 GET  /ping?from=probe&label=mac-default-1             Sec-GPC=None   (fetch subresource)
16:29:27 GET  /img.gif?from=img&label=mac-default-1&r=…        Sec-GPC=None   (image subresource)
16:29:30 POST /result                                          Sec-GPC=None
16:29:36 GET  /probe.html?label=ipad-default-1                 Sec-GPC=None
16:47:27 GET  /probe.html?label=ipad-private-1                 Sec-GPC=None   (Private tab)
```

Header names Safari *did* send (union over all Safari requests): `Accept, Accept-Encoding,
Accept-Language, Cache-Control, Connection, Content-Length, Content-Type, Cookie, Host,
Origin, Pragma, Priority, Referer, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site,
Upgrade-Insecure-Requests, User-Agent`. No `Sec-GPC`, no `DNT`.

JavaScript surface (probe POSTs, `VALID=true`, `visibilityState` = visible):

| | `'globalPrivacyControl' in navigator` | `navigator.globalPrivacyControl` | `navigator.doNotTrack` |
|---|---|---|---|
| macOS Safari 27.0, default | **true** | **false** (`typeof` boolean) | `null` |
| iPadOS 27.0 Safari, default | **false** | `undefined` | `null` |
| iPadOS 27.0 Safari, AFP = All Browsing | false | `undefined` | `null` |
| iPadOS 27.0 Safari, Private tab | false | `undefined` | `null` |

The macOS/iOS difference is explained by WebKit's own history (below): before
2026-07-23 the attribute was always present and returned the preference (default
false); after that commit it is only exposed when the embedder opts in. Both states
mean the same thing: **Safari 27 has not opted in.**

Cache check: every probe response carried `Cache-Control: no-store`; each run used a
distinct `?label=` and the `<img>` URL carried a random parameter; the server log shows
the matching requests, so nothing above came from cache.

### 2.2 Docs

- WebKit **implemented** GPC in 2026, as an embedder-controlled, per-navigation setting
  that is **off by default** (DOCS, WebKit repository, `github.com/WebKit/WebKit`):
  - 2026-05-15 `Add support for GPC` (bug 313856) — imports the W3C `gpc/` web-platform tests, adds `NavigatorGlobalPrivacyControl` and the `Sec-GPC` header name.
  - 2026-06-04 `Add WKWebpagePreferences SPI to enable Global Privacy Control per-navigation` (bug 316225): "When set … enabling both navigator.globalPrivacyControl and the Sec-GPC request header for the main frame, subframes, and subresources."
  - 2026-06-17 `Promote Global Privacy Control SPI to API` (bug 317360).
  - 2026-07-23 `Expose navigator.globalPrivacyControl only when enabled through the WKWebpagePreferences API` (bug 319630): "navigator.globalPrivacyControl is not surfaced unless the embedder opts in, and is surfaced as true/false when it does."
  - Current public header `Source/WebKit/UIProcess/API/Cocoa/WKWebpagePreferences.h`: `@property (nonatomic) BOOL globalPrivacyControlEnabled WK_API_AVAILABLE(macos(27.0), ios(27.0), visionos(27.0));` with the doc comment "The default value is NO. When enabled, both navigator.globalPrivacyControl and the Sec-GPC: 1 request header are active for the main frame, its subframes, and their subresources."
  - `Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml`: `GlobalPrivacyControlEnabled: type: std::optional<bool>, status: embedder, defaultValue: std::nullopt`.
- Apple's Safari 27 release notes (developer.apple.com/documentation/safari-release-notes/safari-27-release-notes, Safari 27.0 released 2026-09-14) list under **Web API › New Features**: "Added `WKWebView` API to enable or disable sending the Global Privacy Control (GPC) HTTP header for outgoing requests." The WebKit post "WebKit Features for Safari 27.0" (webkit.org/blog/18325, 2026-09-17) describes the same thing in its WKWebView section only. **Neither document mentions a Safari user setting for GPC.**
- Apple's Safari User Guide for macOS 27 lists these privacy controls and no GPC/"do not sell" option: *Prevent cross-site tracking*, *Hide IP address*, *Use advanced tracking and fingerprinting protection* ("Use advanced privacy tracking for Private Browsing or all browsing"), *Allow privacy-preserving measurement of ad effectiveness*, *Block all cookies* (support.apple.com/guide/safari/advanced-ibrw1075/mac and …/prevent-cross-site-tracking-sfri40732/mac, "macOS 27 Golden Gate" selected).
- iPadOS 27.0 Settings › Apps › Safari (MEASURED, screenshots): Privacy & Security = *Prevent Cross-Site Tracking* (ON), *Hide IP Address* (Off), *Require Passcode to Unlock Private Browsing* (off), *Fraudulent Website Warning* (ON), *Not Secure Connection Warning* (off), *Highlights in Reader* (ON); Advanced › Privacy = *Advanced Tracking and Fingerprinting Protection* (**Private Browsing**), *Block All Cookies* (off), *Privacy Preserving Ad Measurement* (ON), *Check for Apple Pay* (ON). **No Global Privacy Control item anywhere.**
- globalprivacycontrol.org lists Brave, DuckDuckGo and Firefox as browsers with native GPC; Safari is not listed (fetched 2026-10-01).
- The GPC spec is a W3C Working Draft dated 2026-09-24 (w3.org/TR/gpc/).
- California **AB 566** ("Opt Me Out Act", chaptered 2025-10-08): "A business shall not develop or maintain a browser that does not include functionality configurable by a consumer that enables the browser to send an opt-out preference signal"; "This section shall become operative on January 1, 2027." (leginfo.legislature.ca.gov, bill 202520260AB566.) The WebKit API above is the plumbing Apple would need for that; **no Apple announcement of a Safari GPC setting was found** (searches of WWDC 2026 coverage, Safari 27 release notes, WebKit blog; "unverified" that one exists in a later 27.x beta).
- Brave's iOS browser removed its own GPC JavaScript injection on 2026-09-10 because "WebKit also adds the navigator.globalPrivacyControl when the globalPrivacyControlEnabled … is enabled" (github.com/brave/brave-core/pull/39785) — confirming third parties use the new embedder API; Safari itself does not.

**Conclusion (GPC):** On Safari 27.0 macOS and iPadOS, in default browsing and (iPad) Private
Browsing, Safari does **not** send `Sec-GPC` on navigations, fetches, images or POSTs,
and exposes no true `navigator.globalPrivacyControl`. There is no user setting. The
engine support exists but only a host app can turn it on — which is exactly what a
Safari Web Extension cannot do.

## 3. Intelligent Tracking Prevention (what ITP does today)

DOCS — webkit.org/tracking-prevention (WebKit's consolidated ITP page, undated, fetched
2026-10-01), unless noted:

- "ITP by default blocks all third-party cookies. There are no exceptions to this blocking."
- "Third-party LocalStorage and IndexedDB are partitioned per first-party website and also made ephemeral"; "HTTP cache entries for third-party content is partitioned per first-party website." SessionStorage partitioned per first-party site since Safari 16.1 and blob URLs since 17.2 (webkit.org/blog/15697, 2024-07-16; Safari 17.2 release notes "Added support for blob partitioning").
- 7-day cap: ITP "deletes all cookies created in JavaScript and all other script-writeable storage after 7 days of no user interaction with the website" (IndexedDB, LocalStorage, media keys, SessionStorage, Service Worker registrations).
- CNAME / IP cloaking: ITP "detects third-party CNAME cloaking and third-party IP address cloaking requests and caps the expiry of any cookies set in the HTTP response to 7 days."
- Bounce tracking: ITP counts "top frame redirects" and classifies domains; link decoration: "caps the expiry of cookies created in JavaScript on the landing webpage to 24 hours".
- Referrer: "All third-party referrers are downgraded to their origins by default."
- Do Not Track was removed ("ironically was used as a fingerprinting vector"); the page does not mention GPC.
- Known-tracker classification is behavioural (ITP machine-classifies domains on-device); the *lists* used for blocking/noise come from Apple's WebPrivacy service (§4.3), sourced per Apple from "data from DuckDuckGo and from the EasyPrivacy filtering rules from EasyList", requiring an entry to be flagged by **both** (webkit.org/blog/15697).
- Safari 26.2 added CHIPS (Cookies Having Independent Partitioned State) (Safari 26.2 release notes, Privacy › New Features).

**Does ITP block tracker requests?** No. The page describes cookie, storage and referrer
restrictions only; request blocking is a separate, list-based feature that Apple ships
**only in Private Browsing or with AFP set to All Browsing** (Safari 17.0 release notes,
Private Browsing › New Features: "Added blocking for known trackers and fingerprinting";
"Added console log messages when blocking requests to known trackers").

MEASURED, default browsing, macOS and iPad (identical outcome):

```
tracker_scripts:  google-analytics.com loaded, googletagmanager.com loaded,
                  connect.facebook.net loaded, static.hotjar.com loaded, cdn.segment.com error (real 404)
tracker_fetch (no-cors): google-analytics.com/collect, facebook.com/tr, bat.bing.com, sb.scorecardresearch.com
                  → all resolved (opaque); a blocked request rejects instead
cross-site Referer sent to httpbin: "http://127.0.0.1:47201/"   (origin only)
document.cookie set and read back: "probe=1" (first-party; unaffected)
```

So in Safari 27 default browsing the requests to every tracker we tried **left the
device**. ITP will stop their third-party cookies from working; it will not stop the
request, the IP exposure, or the fingerprint collected by the script.

## 4. Advanced (Tracking and) Fingerprinting Protection

### 4.1 Docs

- Private Browsing 2.0 (webkit.org/blog/15697, 2024-07-16; Safari 17.0/17.2/17.5): Private Browsing adds link tracking protection, **known-tracker request blocking** ("blocking trackers' network requests from leaving the user's device in the first place", including CNAME- and IP-cloaked trackers), fingerprinting noise ("Canvas/WebGL: noise injection on painted pixels"; "Web Audio: noise applied to samples via AudioBuffer.getChannelData()"; "Screen/Window metrics: fixed to standardized values"), and disables website-access extensions by default. "All of the new privacy protections in Private Browsing are also available in regular browsing" via the "advanced tracking and fingerprinting protection in all browsing" setting.
- Apple Safari User Guide (macOS 27, "Browse privately"): "When you use Private Browsing, 'Use advanced tracking and fingerprinting protection' is turned on by default. This setting blocks connections to data collection companies that use advanced fingerprinting techniques … and known tracking parameters are removed from all URLs. You can turn this setting on for all browsing."
- Safari 26.0 (webkit.org/blog/17333, 2025-09-15; also the WWDC25 beta post 2025-06-09): "Safari 26.0 now prevents known fingerprinting scripts from reliably accessing web APIs that may reveal device characteristics, such as screen dimensions, hardware concurrency, the list of voices available through the SpeechSynthesis API, Pay payment capabilities, web audio readback, 2D canvas and more. Safari additionally prevents these scripts from setting long-lived script-written storage such as cookies or LocalStorage. And lastly, Safari prevents known fingerprinting scripts from reading state that could be used for navigational tracking, such as query parameters and document.referrer." Safari 26 release notes: "Privacy › New Features: Added support for preventing fingerprinting for known tracking scripts." Neither says this is tied to the AFP setting; an independent write-up (lapcatsoftware.com/articles/2025/9/4.html, 2025-09-29) quotes an Apple engineer saying it is "part of Intelligent Tracking Prevention" — i.e. on in all browsing, but **only for scripts on Apple's list**, which matches our measurements (our own script saw no noise in default mode).
- Setting names/defaults: macOS "Use advanced tracking and fingerprinting protection" (Settings › Advanced), options Private Browsing / all browsing; iPadOS "Advanced Tracking and Fingerprinting Protection" with **Off / Private Browsing / All Browsing**, default **Private Browsing** (MEASURED on iPadOS 27.0; Apple docs do not print the default).

### 4.2 Measured — fingerprint surfaces

Hashes are a stable non-cryptographic digest of the readback (first 6 hex shown for the
Mac; full for the simulator). "=" means identical to the row above.

**iPadOS 27.0 simulator**

| Run | Mode | canvas `toDataURL` | canvas `getImageData` | WebGL `readPixels` sample | WebGL `toDataURL` | audio read 1 / read 2 | `screen.w×h` / `availH` / `innerH` |
|---|---|---|---|---|---|---|---|
| default-1 (127.0.0.1) | default | `0d05a25da68a69` | `086a09042a0cd4` | `11368b86c1f55c` | `0e6b9380c7bd8b` | `0412cb123d1ee2` / = | 820×1180 / 1180 / 1094 |
| default-2 (localhost) | default | = | = | = | = | = / = | 820×1180 |
| default-3 (reload) | default | = | = | = | = | = / = | 820×1180 |
| afp-all-1 (127.0.0.1) | **AFP All Browsing** | `16496998f45860` | `0c599e2ec31fbf` | `11368b86c1f55c` | `0cdacc2c776583` | `17e531baca3089` / `0bb6ad2fd11cea` | **820×1048 / 1048 / 1048** |
| afp-all-2 (localhost) | AFP All Browsing | `116302116344e1` | `0bfedf0027343e` | = | `0aa5d1e4f5dfef` | `04f93063bdeeed` / `0b6155bb6927a3` | 820×1048 |
| afp-all-3 (reload) | AFP All Browsing | `04045d86616e12` | `0f553b60961d90` | = | `12bc1b7e8a71e9` | `08593e17fc0d03` / `16457784b1dcc6` | 820×1048 |
| private-1 | **Private tab** (AFP default) | `10399a8ae8131a` | `01c8794873511d` | = | `13fdb3d80cd06d` | `15130efbb00af9` / `0ba3ef8dc415b7` | **820×1094 / 1094 / 1094** |

Reading: with AFP active (All Browsing or Private tab) the canvas and WebGL `toDataURL`
readbacks change **per site and per reload** but are **stable within a page** (two reads
equal); WebAudio changes **on every read**; `screen.height`/`availHeight` are clamped to the
window's inner height. In default browsing nothing changes across site or reload. The
WebGL `readPixels` sample (every 61st byte of a flat gradient) never changed — do not
read that as "WebGL untouched": the `toDataURL` of the same WebGL canvas did change.

Unchanged in every mode: `hardwareConcurrency` = 8 (WebKit's cap; the same Mac reports 12
to Chromium), `maxTouchPoints`, 20 of 30 probe fonts detected, `speechSynthesis.getVoices()`
= 0 at load, `colorDepth` 24, `devicePixelRatio` 2, `navigator.platform` "MacIntel",
`languages` ["en-US"], timezone.

Private-tab tells (MEASURED): `navigator.storage.estimate().quota` = 1,048,576,000 (vs
≈41 GB in default browsing); no `Cookie` header on the first request (fresh ephemeral session).

**macOS Safari 27.0, default browsing** (three runs: 127.0.0.1, localhost, 127.0.0.1 again):
canvas `0772a2…`/`104061…`, WebGL `11368b…`/`0e6b93…`, audio `18e13d…` — **identical on all
three runs and both sites**, two reads equal; screen 1512×982 reported truthfully.
Conclusion: AFP noise is **not** active in the owner's regular browsing (i.e. the setting is
at its default or off — the setting itself is in Safari's sandboxed container and was not
read).

### 4.3 Apple's lists, as actually delivered (observed, not published by Apple)

The simulator's `webprivacyd` cache (`Library/Caches/com.apple.WebPrivacy/`, written
2026-10-01 16:29 when Safari first ran) held these resources — the same data a real
device downloads; sizes in bytes:

`ALLOWED_QUERY_PARAM` 862 · `FINGERPRINTING_SCRIPTS` 4,242 · `QUERY_PARAM` 466 ·
`RESOURCE_MONITOR_URLS` 705,615 · `RESTRICTED_OPENER_DOMAINS` 89 ·
`STORAGE_ACCESS_PROMPT_QUIRKS` 339 · `STORAGE_ACCESS_USER_AGENT_STRING_QUIRKS` 204 ·
`TRACKING_DOMAINS` 30,441 · `TRACKING_SUBNETS` 269.

- `FINGERPRINTING_SCRIPTS`: 217 host entries (e.g. `bat.bing.com`, `cdn.segment.com`, `cdn.optimizely.com`, `cdn.mouseflow.com`, `c.amazon-adsystem.com`, `cdn.doubleverify.com`, `cdn.permutive.com`, `beacon.riskified.com`). This is the "known fingerprinting scripts" set of §4.1; our probe is not on it, which is why default-mode readbacks were clean.
- `TRACKING_DOMAINS`: 628 entries of the form `domain;owner;legal-name;flag` (flag 1: 452 entries, flag 2: 166), including `google-analytics.com`, `googletagmanager.com`, `facebook.net`, `connect.facebook.net`, `hotjar.com`, `segment.com`, `scorecardresearch.com`, `doubleclick.net`, `bing.com`. WebKit reads a `canBlock` property per domain (`WebPrivacyHelpers.mm`, `TrackerDomainLookupInfo`: `CanBlock::WithAdvancedPrivacyProtections`).
- `TRACKING_SUBNETS`: five CIDR ranges with owners (Google LLC, Criteo, Adobe/2o7.net) — the "network-layer / IP-range" protection third-party blogs attribute to Safari 27 (WebKit: `TrackerAddressLookupInfo`, `isKnownTrackerAddressOrDomain`).
- `QUERY_PARAM` / `ALLOWED_QUERY_PARAM`: see §5.2.

### 4.4 Known-tracker request blocking — unverified

With AFP = All Browsing and in the Private tab, **all five tracker scripts still loaded** in the
simulator (`loaded` in 86–420 ms) and the Private start page's Privacy Report read "Safari
has not blocked any connections yet in Private Browsing" before the run. Two facts stop us
from calling that Safari's behaviour:

1. WebKit implements the block as a content-rule list obtained from WebPrivacy
   (`TrackingPreventionContentRuleListController`, resource type
   `WPResourceTypeDefaultTrackerBlockRules`; console text "Blocked connection to known
   tracker" is emitted only for a rule list whose identifier ends in
   `.TrackingResourceRequestContentBlocker`).
2. The simulator's Safari had exactly one compiled rule list,
   `ContentRuleList-com.apple.WebPrivacy.ResourceMonitorURLsRuleList`, and **no tracker-block
   rule list**, and its WebPrivacy cache had no file for that resource type.

So the measurement is inconclusive for real hardware. Apple's documentation (Private
Browsing 2.0; Safari 17.0 release notes) says the requests are blocked. See Owner steps.

## 5. Link Tracking Protection

### 5.1 Measured

Test link query (22 parameters):
`gclid fbclid msclkid dclid twclid ttclid igshid mc_eid yclid _ga wbraid gbraid utm_source utm_medium utm_campaign utm_term utm_content __hssc _hsenc vero_id oly_enc_id keep`.

| Context | What reached the server (verbatim query after `label=`) |
|---|---|
| macOS 27.0, default browsing, URL handed to Safari by another app (`open`) | **everything** — `gclid=G1&fbclid=F1&msclkid=M1&dclid=D1&twclid=T1&ttclid=TT1&igshid=I1&mc_eid=ME1&yclid=Y1&_ga=GA1&wbraid=W1&gbraid=GB1&utm_source=US1&…&__hssc=H1&_hsenc=HE1&vero_id=V1&oly_enc_id=O1&keep=K1` |
| iPadOS 27.0, AFP = All Browsing, **same-site** link tap | `ttclid=TT1&_ga=GA1&wbraid=W1&gbraid=GB1&utm_source=US1&utm_medium=UM1&utm_campaign=UC1&utm_term=UT1&utm_content=UCo1&keep=K1` |
| iPadOS 27.0, AFP = All Browsing, **cross-site** (other loopback host) link tap | identical to the row above; `Referer` = origin only; `document.referrer` empty |
| iPadOS 27.0, AFP = All Browsing, cross-site **HTTPS** link to httpbin.org/get | identical set in httpbin's `args` (read from the rendered page) |
| iPadOS 27.0, **Private tab**, same-site link tap | identical to the AFP rows |

Removed: `gclid fbclid msclkid dclid twclid igshid mc_eid yclid __hssc _hsenc vero_id oly_enc_id`.
Kept: `ttclid _ga wbraid gbraid utm_*` and the control `keep`. UTM parameters survive
(consistent with Apple's "preserves campaign attribution parameters"). The stripping happens
before navigation (the landing page's `location.href` already lacked them) and does not
depend on same- vs cross-site.

### 5.2 Apple's list (observed in the delivered `QUERY_PARAM` resource, 2026-10-01)

Global parameters: `__hsfp __hssc __hstc __s _hsenc _openstat dclid fbclid gclid hsCtaTracking
igsh igshid igsi mc_eid mkt_tok ml_subscriber ml_subscriber_hash msclkid oly_anon_id oly_enc_id
rb_clickid s_cid twclid vero_conv vero_id wickedid yclid ziclk`. Domain-scoped: `cn`, `cxt`, `t`
on `twitter.com` and `x.com` under `/status/`; `si` on `youtu.be`; `xmt` on `threads.net`
under `/post/`. `ALLOWED_QUERY_PARAM` whitelists specific parameters on specific sites
(e.g. OAuth-style `state`, `code`, `client_id`, `redirect_uri`, `scope` on google.com,
firefox.com, walmart.com, doordash.com, github.com). This list is delivered by Apple's
service and updated independently of Safari; the measured removals match it exactly, and
`ttclid`/`_ga`/`wbraid`/`gbraid` are absent from it.

Contexts per Apple (DOCS): Private Browsing (Safari 17.0 release notes: "Added blocking for
known tracking query parameters in links in Private Browsing"), all browsing when AFP is set to
All Browsing (Safari User Guide quote in §4.1), and links from Mail and Messages (Apple's
Safari 17 announcement; **not measured** here — those apps strip before Safari sees the URL).

## 6. iCloud Private Relay and IP hiding

DOCS — Apple, *iCloud Private Relay Overview* (PDF, December 2021) and support.apple.com/102602
(2023-08-31):

- Requires iCloud+; "built directly into the networking framework of iOS, iPadOS, and macOS, and protects traffic most susceptible to tracking: web browsing and any connections that are unencrypted. As a result, Private Relay protects all web browsing in Safari and unencrypted activity in apps."
- Two hops: the ingress proxy (Apple) sees the user's IP but not the destination; the egress proxy (a partner) "generates a temporary IP address, decrypts the name of the website you requested, and connects you to the site" — "no single party — not even Apple — can see both who you are and what sites you're visiting."
- DNS is protected with Oblivious DNS over HTTPS; Relay IPs map to the user's country/time zone ("does not provide any methods to spoof location"); local-network and cellular-service traffic bypass it; the device "will never allow direct connections to names that are on the DuckDuckGo known tracker list."
- Encrypted app traffic other than Safari is **not** covered.
- Separately, Safari's **Hide IP Address** setting hides the IP "from known trackers" without iCloud+ ("Safari automatically protects your IP address from known trackers. For eligible iCloud+ subscribers, your IP address is protected from trackers and websites" — iPhone User Guide, iOS 27). In the simulator this setting read **Off**.

MEASURED: the probe fetched `https://httpbin.org/ip` and POSTed only a hash of the answer;
the same hash was computed locally over a direct request (hash function cross-checked JS vs
Python on two fixed strings). Result: Safari on this Mac → **same** egress as a direct
request (Private Relay not in effect for Safari here); iPad simulator → same (no iCloud
account in a simulator). No address was recorded anywhere.

## 7. Safari 27 / WWDC26 items relevant to tracking, fingerprinting and extensions

From the Safari 27.0 release notes (developer.apple.com, 2026-09-14) and the WebKit post
(2026-09-17); items quoted are the only privacy-relevant ones in the documents:

- Web API: "Added `WKWebView` API to enable or disable sending the Global Privacy Control (GPC) HTTP header for outgoing requests." (host-app API, §2)
- "Fixed an issue where partitioned cookies could not be deleted via `WKHTTPCookieStore`."
- "Fixed window bar visibility properties (`toolbar.visible`, `statusbar.visible`, `menubar.visible`) to return static values per the HTML specification for privacy and interoperability."
- Networking: cookies marked `Secure` can now be set on plaintext loopback hosts.
- Web Extensions: `tabId` in `chrome.windows.create()`, `runtime.getDocumentId()`, uncaught-exception reporting, user-gesture propagation through `sendMessage()/connect()/postMessage()/executeScript()`; fixes to `declarativeNetRequest` priority/redirect handling landed earlier in 26.x ("Fixed processing of declarativeNetRequest rules so that higher numbers are treated as higher priority"; "Fixed `allowAllRequests` … a higher priority correctly overrides a lower-priority block rule"). Safari 26.0 also "Added support for the request-method content blocker trigger field."
- Not in Apple's own notes but visible in the delivered lists (§4.3): IP-range tracker matching (`TRACKING_SUBNETS`) and an expanded fingerprinting-script list. Third-party marketing blogs describing "Safari 27 IP-level blocking / CDPs flagged as fingerprinting" are describing these resources, which update out-of-band; treat version attributions in those posts as unverified.
- Nothing in the Safari 27 notes or WebKit post changes Private Browsing's extension policy (website-access extensions off by default in Private Browsing — Safari 17.0 notes, "Added support for turning on or off extensions and content blockers in Private Browsing mode").

## 8. What this leaves for Nullecho on Safari

- **GPC: real value.** Safari 27 does not send `Sec-GPC` or expose `navigator.globalPrivacyControl=true`, has no setting, and the engine's switch is a `WKWebpagePreferences` property only a host app can set. A Safari Web Extension can still add the header with `declarativeNetRequest` `modifyHeaders` (Safari's DNR rule converter already knows `sec-gpc` as a header name — `_WKWebExtensionDeclarativeNetRequestRule.mm`), but it cannot make `navigator.globalPrivacyControl` true from an extension without a page-world shim. Caveat: if Apple ships a GPC setting to satisfy AB 566 (operative 2027-01-01), this value drops to zero overnight; design for that.
- **Request blocking: real value in default browsing.** ITP restricts third-party cookies/storage but every tracker request we tried left the device in default browsing on both platforms. Apple only blocks known-tracker requests in Private Browsing or with AFP set to All Browsing — an opt-in most users never see — and even there the block list is Apple's DuckDuckGo∩EasyPrivacy intersection (628 domains observed).
- **Fingerprint persona: narrower value.** In default browsing Safari adds no noise for an unlisted script and reports true screen metrics; `hardwareConcurrency` is already capped at 8. In Private Browsing / AFP-All, Safari randomises canvas, WebGL and audio per site *and per reload* and clamps screen metrics below the JS layer — stronger than any extension can be. Nullecho's per-site-consistent persona is only additive for default-mode users, and must not fight AFP when the user turns it on (detect AFP noise and stand down, or document the overlap).
- **Link stripping: no value where Safari applies it, limited value elsewhere.** Safari's Private/AFP-All stripping covers the major click IDs but leaves `ttclid`, `_ga`, `wbraid`, `gbraid`; in default browsing nothing is stripped. If Nullecho strips in default browsing it should at least cover Apple's list plus those four.
- **Do not claim** IP protection (Private Relay/Hide IP are Apple's and need iCloud+ for full effect), cookie partitioning, the 7-day storage cap, or CNAME-cloak defences.

## 9. Owner steps (things the agent could not measure)

The server and probe live in the agent scratch directory
`…/scratchpad/a2-builtin/` (`server.py`, `probe.html`, `links.html`); start it with
`python3 server.py 47201` from that folder (`lsof -i :47201` must be empty first).

1. **macOS Private Browsing (GPC, AFP noise, tracker blocking, link stripping) — unverified, needs owner step.**
   In Safari: File › **New Private Window** (⇧⌘N); paste
   `http://127.0.0.1:47201/probe.html?label=mac-private-1`
   and press Return; when the page says `done; VALID=true … (posted)`, click the
   "same-site landing with tracking params" link. Then run
   `python3 cmp.py mac-default-1 mac-private-1` in the scratch folder and read the
   `/landing?label=mac-private-1…` line in `server.log`. Expected if Apple's docs hold:
   different canvas/audio hashes, `screen.h` = inner height, tracker scripts `error`,
   the 12 parameters above missing, still no `Sec-GPC`.
2. **Known-tracker request blocking on real hardware:** repeat step 1 (or set AFP to All
   Browsing on a real iPhone/iPad and open the probe) and confirm `tracker_scripts` show
   `error`, and that Safari's Privacy Report / Web Inspector console shows "Blocked connection
   to known tracker". The simulator lacked Apple's block rule list, so this is unproven.
3. **Current AFP setting on the Mac:** Safari › Settings › Advanced › "Use advanced tracking
   and fingerprinting protection" — note whether it is "in Private Browsing" (default) or
   "in all browsing". Measurements imply the former.
4. **Mail/Messages link stripping:** click a link carrying `gclid=…` from Mail or Messages
   and read the server log; not measured here.
5. **Private Relay:** if an iCloud+ account is active, re-run the probe and compare
   `egress_ip_hash` to the direct-request hash printed by `python3 cyrb.py` (prints only
   "SAME"/"DIFFERENT").

## 10. Sources (all fetched 2026-10-01)

- WebKit, "Tracking Prevention in WebKit" — https://webkit.org/tracking-prevention/
- WebKit, "Private Browsing 2.0" (2024-07-16) — https://webkit.org/blog/15697/private-browsing-2-0/
- WebKit, "WebKit Features in Safari 26.0" (2025-09-15) — https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- WebKit, "News from WWDC25: WebKit in Safari 26 beta" (2025-06-09) — https://webkit.org/blog/16993/
- WebKit, "WebKit Features for Safari 27.0" (2026-09-17) — https://webkit.org/blog/18325/webkit-features-for-safari-27-0/
- Apple, Safari 17 / 17.2 / 26 / 26.2 / 26.4 / 27 release notes — https://developer.apple.com/documentation/safari-release-notes/
- Apple Safari User Guide (macOS 27): Browse privately; Prevent cross-site tracking; Change Advanced settings — https://support.apple.com/guide/safari/
- Apple iPhone User Guide (iOS 27): Browse privately; Safari settings — https://support.apple.com/guide/iphone/
- Apple, "About iCloud Private Relay" (2023-08-31) — https://support.apple.com/en-us/102602; "iCloud Private Relay Overview" (Dec 2021) — https://www.apple.com/privacy/docs/iCloud_Private_Relay_Overview_Dec2021.PDF
- WebKit repository (github.com/WebKit/WebKit): commits 3784776034 (2026-05-15), 2ef16c2019 (2026-06-04), 40d6c85f57 (2026-06-17), 1e8b30a2cf (2026-06-27), c7b5fcf1c5 (2026-07-23); files `WKWebpagePreferences.h`, `UnifiedWebPreferences.yaml`, `NavigatorGlobalPrivacyControl.{idl,cpp}`, `WebPrivacyHelpers.mm`, `ContentExtensionsBackend.cpp`
- W3C, Global Privacy Control, Working Draft 2026-09-24 — https://www.w3.org/TR/gpc/
- globalprivacycontrol.org (implementations list) — https://globalprivacycontrol.org/
- California AB 566 (chaptered 2025-10-08) — https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260AB566
- brave/brave-core PR #39785 (merged 2026-09-10) — https://github.com/brave/brave-core/pull/39785
- Jeff Johnson, "Safari 26 advanced fingerprinting protection: A confusing feature" (2025-09-29) — https://lapcatsoftware.com/articles/2025/9/4.html (third-party; used only for the engineer quote)

Raw evidence (not in the repo): `server.log`, `results.jsonl`, `rn*.txt`, `apple-*.txt`,
`private-relay-overview.txt` and the simulator screenshots described above, all in the
scratch folder named in §9.
