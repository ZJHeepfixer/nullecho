# Safari API support audit — what Nullecho's WebExtension APIs actually do in Safari 27

Status: measured on **iOS 27.0 Simulator** (Safari 27.0); **macOS Safari 27.0 is docs-only** (probe built, owner step pending).
Date: 2026-10-01/02. Facts only: every claim below points to a measurement (run id + log key) or a URL.

## 0. TL;DR for the Safari plan

1. **The webRequest "learner" cannot work in Safari.** `webRequest` events fire (also on iOS, contrary to Apple's compatibility page), but the `Cookie` request header is never present in `requestHeaders`, `Set-Cookie` is absent from `onHeadersReceived` (it appears only in `onCompleted`), `extraHeaders` is silently ignored, and `details.initiator` / `details.documentUrl` are never set — so `heuristics.js` `isObservable()` would return `false` for every request even before the cookie check. Measured: runs `perm-*`, 860 events, 0 with `Cookie`, 0 with `initiator`. Apple's doc: "`webRequest.HTTPHeaders`: `cookies` not supported" and "`opt_extraInfoSpec` not supported" (§7, source A2).
2. **`modifyHeaders` is far weaker than on Chrome.** It needs the `declarativeNetRequestWithHostAccess` permission (Nullecho's manifest does not declare it — with Nullecho's exact permission set **no header was ever modified**, run `perm-a`), it needs the user to grant website access, and even then Safari applied it **only to subresource loads such as images and scripts** — never to `main_frame`/`sub_frame` navigations and never to `fetch()`/XHR (run `v2b-a`: `Sec-GPC: 1` on `/gpc/x.gif`, `/gpc/x.js`; absent on `/page`, `/frame`, `/gpc/echo`, `/gpc/x.xhr`). `remove Cookie` and `remove Set-Cookie` did nothing even on image loads (run `v2b-a`, keys `c9_strip_img`, `c10_set_rsi_stripped_img` → `rsi` cookie was stored). The learner's "cookieblocked" tier and the GPC header on documents therefore have no DNR implementation in Safari.
3. **`block` works without any website access, and D50/D52's conditions work — with two Safari-specific traps.** With the extension merely enabled and "All Websites: Ask" (nothing granted), every block rule acted (run `noperm2-a`). `requestDomains`, `excludedRequestDomains`, `domainType: "thirdParty"`, `excludedInitiatorDomains`, `initiatorDomains`, `urlFilter` `||domain^`, `resourceTypes` all behaved. Traps: (a) WebKit compiles each `excludedRequestDomains` entry into a content-blocker `ignore-following-rules` rule, so **an exclusion on one rule also exempts that host from every rule sorted after it** — measured: the `keep.a.<suffix>` exclusion on a block rule removed `Sec-GPC` from that host (`gpc_keepa_bleed_img` = None while `gpc_b_img` = 1) and a later dynamic block rule stopped applying to the excluded host (`bleed_keepe_dyn2` reached the server from third-party pages). Because Safari orders rules priority → action type (allow > allowAllRequests > block > upgradeScheme > redirect > modifyHeaders), every learned block rule's carve-out silently punches a hole in `gpc.json` rule 5000. (b) `initiatorDomains` / `excludedInitiatorDomains` compile to a regex that requires `host/` with no port; they matched in this rig only with a port-suffixed twin (`initdp_b`, `dl_g_img`). Real sites have no port, so this is a rig limitation, but it means the port-less form is **unverified live** here (source W2).

## 1. Environment

| Item | Value |
|---|---|
| Host | macOS 26.6, Xcode 27.0 (27A266a), `xcrun safari-web-extension-converter` from that Xcode |
| macOS Safari | 27.0 (21625.1.24.18.4) — **not driven** (needs owner to allow unsigned extensions) |
| iOS | Simulator runtime iOS 27.0 (24A434), device type iPhone 18 Pro Max (a dedicated device created for this audit, named `A1-API-Probe`) |
| iOS Safari UA (from server log) | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1` |
| Probe | own MV3 extension `NullechoProbe` (not Nullecho), converted with `--copy-resources --no-open --no-prompt --force`, built with `xcodebuild … -sdk iphonesimulator … CODE_SIGNING_ALLOWED=NO` |
| Fixture server | python3 `http.server` bound to the loopback interface, port 47101, `Cache-Control: no-store`, logs method/host/path/all headers/body of every request to `requests.jsonl`; `POST /report` appends to `reports.jsonl` |

Converter output, verbatim (identical for all four conversions):

```
Warning: The following keys in your manifest.json are not supported by your current version of Safari. If these are critical to your extension, you should review your code to see if you need to make changes to support Safari:
	match_origin_as_fallback
	match_about_blank
	type
	world
```

Measured reality contradicts that warning for all four keys (§5): `type: "module"` service worker started and imported a module, `world: "MAIN"` ran in the page world, `match_about_blank` and `match_origin_as_fallback` injected into `about:blank`, `about:srcdoc`, `blob:` and `data:` frames.

## 2. Method

- Hosts. Public wildcard DNS `*.lvh.me` (resolves to loopback; **not** on the Public Suffix List, so `a.lvh.me` and `c.lvh.me` are the *same site* `lvh.me`), plus `localhost` and the IPv4 loopback literal as genuinely distinct sites. Roles: `a.` = first-party page + parent domain, `keep.a.`/`other.a.` = subdomains, `b.` neutral, `c.`/`keep.c.` = thirdParty target, `d.`/`sub.d.`/`notd.` = `||domain^` test, `e.`/`keep.e.`/`g.`/`keep.g.` = learned-rule twins, `gpcx.` = GPC exclusion. iOS Simulator Safari resolved all of them (server log `k=sim_*`).
- Every fixture request carries `?run=<id>&k=<key>&from=<page host>`, so a key missing from `requests.jsonl` means **blocked**; a key present shows the exact headers the server received. Each check has a positive and a control (e.g. `/sb/` vs `/sc/`, `keep.a` vs `other.a`, first-party vs third-party page, ruleset enabled vs disabled). `curl -H 'Sec-GPC: 1' -H 'Cookie: curlcookie=1'` was logged first to prove the logger shows those headers when present (`k=curl_control`).
- The page reports `document.visibilityState`; all runs cited below reported `visible` (`page` report of each run).
- Static rulesets: `rs_block` (rules 1 `/sb/`, 7 `/pf/x.json`, 8 `/usr/`), `rs_gpc` (rule 5000 = Nullecho's gpc.json shape incl. its 13-entry `resourceTypes` list, `excludedRequestDomains: [gpcx]`, `excludedInitiatorDomains`), `rs_cond` (3 = block `requestDomains:[a]` + `excludedRequestDomains:[keep.a]` + `/erd/`; 4 = block `requestDomains:[c]` + `domainType:thirdParty` + `excludedInitiatorDomains:[localhost, localhost:47101]` + `/tp/`; 5 = `initiatorDomains:[a]` + `/initd/`; 11 = `initiatorDomains:[a:47101]` + `/initdp/`; 6 = `||d.<suffix>^` images only), `rs_off` (disabled by default, rule 10 `/off/`). Dynamic rules 9001 (remove `Cookie` on `/strip/`), 9002 (remove `Set-Cookie` on `/setcookie-stripped`), 9003 (block `/dyn/`), 9004 (Nullecho's exact learned-block shape: `requestDomains:[e]`, `domainType:thirdParty`, `excludedRequestDomains:[keep.e]`, `excludedInitiatorDomains:[localhost]`, no urlFilter/resourceTypes), 9005 (Nullecho's exact cookie-strip shape on `f`), 9007 (= 9004 on `g` with `localhost:47101`), 9008 (block `/dyn2/`, added later by command).
- Runs: `noperm2-a` (extension enabled, **no** website access), `perm-a|c|ip|lh` (v1 manifest = Nullecho's permission set, all websites allowed), `v2-a`, `v2b-a|ip|lh` (v2 = v1 + `declarativeNetRequestWithHostAccess`), `v2c-toggle-a` (after `updateEnabledRulesets`). Server log: 1416 requests; probe reports: 408.

## 3. Capability table

Legend: **S** supported (measured), **P** partial, **U** unsupported, **?** unverified. iOS = measured in the Simulator unless noted. macOS = documentation only (D = docs, W = WebKit source).

| Capability | iOS 27 (measured) | macOS 27 (docs) | Evidence |
|---|---|---|---|
| `background.service_worker` + `"type":"module"` | **S** — env `service_worker`, `import` of `./bgmod.js` worked (`modOk`), `importScripts` is a function | S (D: 15.4 added `service_worker`; 16.4 "modules in background service workers") | report `start`, instance `lpq1o2rq` |
| Worker suspension / restart | **S** (it happens) — new instance 30 s after boot; `starts` 1→2→3; `storage.session` survived the restart (`firstInstance` kept) and was reset on reinstall; alarms restarted it | D: "all background pages are nonpersistent" on iOS; 17.6 fixed pages stopping "after about 30 seconds" | reports `start`/`storage`/`alarm` |
| `declarativeNetRequest` static rulesets | **S** — `getEnabledRulesets()` → `["rs_cond","rs_gpc","rs_block"]`; all 13 resourceTypes of gpc.json accepted | S (D) | report `dnr-info` |
| `updateEnabledRulesets` | **S** — disabling `rs_block` let `/sb/`,`/pf/x.json`,`/usr/` through, enabling `rs_off` blocked `/off/`; restored afterwards | S (D) | run `v2c-toggle-a`, cmd 2/3 |
| `updateStaticRules` / `getDisabledRuleIds` / `getAvailableStaticRuleCount` | **U** — `typeof` = `undefined`; calling throws `TypeError: d.getDisabledRuleIds is not a function` | U (not in WebKit IDL, W1) | report `dnr-info` |
| `updateDynamicRules` / `getDynamicRules` | **S** — 9001…9008 all accepted, incl. Nullecho's exact learned shapes | S (D) | report `dyn-setup` |
| `getSessionRules`/`updateSessionRules`, `isRegexSupported` | **S** (present; `isRegexSupported` → `{isSupported:true}`) | S (D) | `dnr-info` |
| `block` | **S** — static + dynamic; works for `image`, `xmlhttprequest` (fetch and XHR), `script`, `other` | S (D) | all runs |
| `block` **without website access** | **S** — identical blocking with "All Websites: Ask" and nothing granted | W: no permission gate on block in `ContentExtensionsBackend` | run `noperm2-a` |
| `modifyHeaders` set `Sec-GPC` with Nullecho's permissions (`declarativeNetRequest` only) | **U** — never applied, even with all websites allowed | D: "Safari requires the `declarativeNetRequestWithHostAccess` permission for `modifyHeaders`" | runs `perm-*`: `GPC=None` on all 137 rows |
| `modifyHeaders` set `Sec-GPC` with `declarativeNetRequestWithHostAccess` + access | **P** — applied to `image` and `script` loads only; not to `main_frame`, `sub_frame`, `fetch`, XHR | D: requires host access; W: applied via `applyResultsToRequest` on subresource path | run `v2b-a` |
| `modifyHeaders` without website access | **U** — nothing modified | D: "Safari requires user permission to add, remove, or append headers"; W3 gate | run `noperm2-a` |
| `modifyHeaders` remove `Cookie` (request) | **U** — image to `/strip/x.gif` still carried `Cookie` while the same request got `Sec-GPC: 1` | ? (D says header ops need permission; no doc on Cookie) | `v2b-a` `c9_strip_img` |
| `modifyHeaders` remove `Set-Cookie` (response) | **U** — `rsi` cookie set by `/setcookie-stripped/x.gif` was stored and sent on the next request | ? | `v2b-a` `c10…`, `c11…`, `c13_document_cookie` |
| `requestDomains` (matches subdomains) | **S** — `a` and `other.a` blocked | S (D: 16.4; 17.2 subdomain fix) | `erd_parent`, `erd_other_sub` absent |
| `excludedRequestDomains` | **S** for its own rule — `keep.a` allowed under rule 3 | S (W2) | `erd_keep_excluded` present |
| …but bleeds into later rules | **measured bleed** — see §4.5 | W2/W4 (`ignore-following-rules` semantics) | `gpc_keepa_bleed_img`, `bleed_keepe_dyn2` |
| `domainType: "thirdParty"` | **S** — rule 4 and 9004 blocked only from the loopback-IP page; not from `c` (first party) and not from `a` (same site `lvh.me`) | S (D lists `domainType`) | runs `perm-ip` vs `perm-c`/`perm-a` |
| `excludedInitiatorDomains` | **P** — mechanism works (`unless-frame-url`) but only matched with `localhost:47101`; `localhost` alone did not exempt the localhost page | W2: regex `^[^:]+://+([^:/]+\.)?host/.*` | `dl_g_img` present vs `dl_e_img` absent in `perm-lh`/`v2b-lh` |
| `initiatorDomains` | **P** — same port caveat: rule 11 (`a:47101`) blocked from `a`, rule 5 (`a`) did not | W2 | `initdp_b` absent, `initd_b` present in `perm-a` |
| `urlFilter` `\|\|domain^` and paths | **S** — `d`, `sub.d` blocked, `notd` allowed; `/pf/x.json` blocked, `/pf/y.json` allowed | S (D: 15.4 fixed `*`, `\|`, `\|\|`, `^`) | `uf_*`, `pf_*` |
| `resourceTypes` | **S** — image-only rule 6 let the script through; `xmlhttprequest` covers fetch and XHR | D: `csp_report`, `object` unsupported (silently dropped per W2) | `uf_d_script_ctrl` present |
| Constants | `MAX_NUMBER_OF_STATIC_RULESETS` = 100, `MAX_NUMBER_OF_ENABLED_STATIC_RULESETS` = 50, `MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES` = 30000; **absent**: `MAX_NUMBER_OF_DYNAMIC_RULES`, `GUARANTEED_MINIMUM_STATIC_RULES`, `MAX_NUMBER_OF_DISABLED_STATIC_RULES`, `MAX_NUMBER_OF_REGEX_RULES`, `DYNAMIC_RULESET_ID`, `SESSION_RULESET_ID` | same values in WebKit source (W5) | `dnr-info` |
| `getMatchedRules` | **P** — returns `{rulesMatchedInfo:[{request:{url},tabId,timeStamp}]}` (203 entries) **without** `rule.ruleId`/`rulesetId` | D: supported; 16.4 "fixed result to match other browsers" | cmd 4 |
| `onRuleMatchedDebug` | **U** — absent | W1: behind `DNR_ON_RULE_MATCHED_DEBUG` | `dnr-info` |
| `testMatchOutcome` | **U** — `undefined` | U (not in IDL, W1) | report `tmo` |
| `setExtensionActionOptions({displayActionCountAsBadgeText:true})` | **S** (resolves; badge not visually verified) | S (D: 16.4) | `dnr-info` |
| `webRequest.onBeforeSendHeaders` / `onHeadersReceived` | **S on iOS** (events fire; 144 `onBeforeSendHeaders`, 142 `onHeadersReceived`) — Apple's page says "Not supported in iOS" | D: supported on macOS, non-blocking | report `wr` |
| `extraHeaders` | accepted without error; **no effect** | D: "`opt_extraInfoSpec` not supported" (18.4 notes say `extraInfoSpec` honored for perf) | `wrReg` |
| `Cookie` visible in `requestHeaders` | **U** — 0 of 860 events; server received `Cookie: rc=…; rs=…; vis=…` on the same requests | D: "`webRequest.HTTPHeaders`: `cookies` not supported" | `c5_keep_echo` |
| `Set-Cookie` visible in `responseHeaders` | **P** — absent in `onHeadersReceived`, **present in `onCompleted`** (`rs=perm-a; Path=/`) | ? | `c2_set_rs_stripped` |
| `details.initiator` / `documentUrl` | **U** — never set (0 of 860) | W6 IDL declares `initiator` | `wr` |
| webRequest on blocked loads | no event at all for DNR-blocked requests | — | `sb_img` |
| webRequest with non-persistent background on iOS | **S** — events delivered to the service worker | D (26.0): "Fixed a non-fatal `webRequest` error for non-persistent background content" | `wr` |
| Content script `run_at: document_start` | **S** — ran at `readyState=loading`, `document.scripts.length=0`, `body=false`; page's first inline script saw the marker | S | `first.csStartAttr` |
| `world: "MAIN"` | **S** — page saw `window.__probeMainWorld`; that script had no `browser.runtime.id`; the ISOLATED one did | ? (D silent; converter warns) | `first.mainWorld`, `cs` reports |
| `all_frames` | **S** — cross-origin `/frame` got both scripts | S | `cs` href `/frame` |
| `match_about_blank` | **S** — `about:blank`, `about:srcdoc` | D: 18.4 added | `cs` reports |
| `match_origin_as_fallback` | **S** — `data:` and `blob:` frames | D: 18.4 added | `cs` reports |
| Content scripts without website access | **U** — none ran in `noperm2-a` | D: per-site permission model | `first.csStartAttr: null` |
| `storage.local` / `storage.session` | **S** / **S** (`setAccessLevel` is a function); quotas 10 MB / 10 MB in WebKit (W5); Apple page says local limit 5 MB | D: `storage.session` 16.4+; `setAccessLevel` 17.1 | `storage` report |
| `alarms` | **S** — `periodInMinutes: 0.5` fired every 30 s (27 fires), `delayInMinutes: 0.25` fired at +30 s; WebKit minimum interval 30 s (W5) | S | `alarm` reports |
| `runtime.onMessage` / `sendMessage` | **S** — 77 messages; `sender` has `tabId`, `frameId`, `url`, `origin`, `id`, `documentId`; replies received by content scripts | S | `msg`, `msg-reply` |
| `runtime.getURL` + fetch of own resource | **S** — `safari-web-extension://<uuid>/probe.txt` → file content | S | `start` |
| `scripting.executeScript({func})` | **S** — result `{title, href}` with `frameId`, `documentId`; page saw the injected attribute | D: `injectImmediately` unsupported | `exec`, `exec_marker` |
| `userScripts` | **U** — `typeof browser.userScripts === 'undefined'` | U | `start` |
| Namespaces | both `browser` and `chrome` are objects in the worker | D | `start` |

## 4. Details and raw observations

### 4.1 Background

- `runtime.getManifest().background` = `{"type":"module","service_worker":"bg.js"}`; `self instanceof ServiceWorkerGlobalScope` = true; top-level `import` worked. `runtime.id` = `org.nullecho.probe.Extension (None)`.
- Lifecycle timeline (UTC): boot instance `lpq1o2rq` 22:15:44; alarm at 22:16:14 handled by a **new** instance `x6b0ppq5` (`starts` 2, `storage.session` still held `firstInstance: lpq1o2rq`); after the v2 reinstall a fresh instance `zitxmhcj` with `sessStarts` reset to 1. One instance later ran for >5 min while a 1.5 s poll loop kept it busy. Conclusion: the worker is terminated after ~30 s of idleness and restarted by alarms/messages; in-memory state is lost, `storage.session` is not.
- Reports reached the server from the worker by `fetch()` to `http://localhost:47101` (no CORS issue for a simple `text/plain` POST; `GET /cmd` with CORS headers was readable too).
- iOS cannot load a persistent background: WebKit refuses (`InvalidBackgroundPersistence`, W7) — and Apple: "In iOS, you need to set the `persistent` attribute to `false`. With manifest version 3, all background pages are nonpersistent." (A2)

### 4.2 declarativeNetRequest — what Safari does with a rule

WebKit does not run DNR natively; it **translates each rule into WebKit content-blocker JSON** (`_WKWebExtensionDeclarativeNetRequestRule.mm`, W2) and compiles one rule list per extension:

- Action map: `allow`/`allowAllRequests` → `ignore-following-rules`, `block` → `block`, `modifyHeaders` → `modify-headers`, `redirect` → `redirect`, `upgradeScheme` → `make-https`.
- `urlFilter` → regex: `||` → `^[^:]+://+([^:/]+\.)?`, `*` → `.*`, `^` → `[^a-zA-Z0-9_.%-]`, `|` anchors.
- `requestDomains:[d]` without `urlFilter` → `||d` (regex `^[^:]+://+([^:/]+\.)?d` with **no trailing boundary**, so `d.evil.example` also matches); with a path filter → `||d*/erd/`.
- `excludedRequestDomains:[x]` → **one extra `ignore-following-rules` rule per entry**, whose url-filter is the bare domain string treated as a Chrome urlFilter (an unanchored substring regex) and which inherits the parent rule's `resourceTypes`/`domainType`. Content-blocker semantics (W4, `ContentExtensionsBackend.cpp`): matched actions are iterated in list order and iteration **stops at the first `ignore-following-rules`** — every later rule is skipped for that URL.
- `initiatorDomains` → `if-frame-url: ["^[^:]+://+([^:/]+\.)?host/.*"]`, `excludedInitiatorDomains` → `unless-frame-url` (same regex). The regex needs a `/` right after the host, so an initiator with an explicit port never matches (why this rig needed `localhost:47101` twins).
- `domainType` → `load-type: ["third-party"]` (third-party relative to the top document's registrable domain; `a.lvh.me`→`c.lvh.me` is first-party because `lvh.me` is the registrable domain).
- Unknown `resourceTypes` entries (`csp_report`, `object`) are removed silently; `main_frame`→`top-document`, `sub_frame`→`child-document`, `xmlhttprequest`→`fetch`, `stylesheet`→`style-sheet`.
- Rule order in the compiled list: by `priority` descending, then action type (allow > allowAllRequests > block > upgradeScheme > redirect > modifyHeaders), then declaration order (`compare:` in W2). All static rulesets and the dynamic/session rules are merged into **one** list.
- `modifyHeaders` header names are checked against a fixed list; `cookie`, `set-cookie` and `sec-gpc` are on it (W2 `isHeaderNameValid`), so the rules compile — they just do not act (see 4.4).

### 4.3 Measured blocking (run `noperm2-a`, extension enabled, no site access; identical in `perm-*`/`v2b-*`)

Absent from the server log (blocked): `sb_img`, `sb_fetch`, `sb_xhr`, `pf_hit`, `usr`, `dyn`, `erd_parent`, `erd_parent_fetch`, `erd_other_sub`, `uf_d_img`, `uf_subd_img`, `initdp_b`, `bleed_*_sb`, `bleed_keepe_dyn`.
Present (controls): `sc_img_ctrl`, `sc_fetch_ctrl`, `pf_ctrl`, `off`, `erd_keep_excluded`, `erd_b_ctrl`, `uf_notd_img_ctrl`, `uf_d_script_ctrl`, `tp_b_ctrl`, `dl_b_ctrl`, `initd_b`.
From the loopback-IP page (`perm-ip`, `v2b-ip`): `tp_c_fetch`, `tp_c_img`, `tp_keepc_img`, `dl_e_img`, `dl_e_fetch`, `dl_g_img` **absent** (third-party block, including Nullecho's exact 9004 shape); `dl_keepe_img`, `dl_keepg_img`, `erd_keep_excluded` present (exclusions). From `c` (first party) and `a` (same site) all `tp_*`/`dl_e_*` present. From `localhost`: `tp_c_*` present (rule 4 carries `localhost:47101`), `dl_g_img` present (9007 carries `localhost:47101`), `dl_e_*` **absent** (9004 carries only `localhost`).
`xcrun simctl openurl` to `http://a.lvh.me:47101/…` produced an `https://` `main_frame` attempt first in `webRequest` (HTTPS-first), then the `http://` load; the page itself was never blocked by any rule.

### 4.4 Measured header modification

- v1 manifest (Nullecho's permissions), all websites allowed: no `Sec-GPC` on any of 137 logged rows across `perm-a|c|ip|lh`.
- v2 manifest (+`declarativeNetRequestWithHostAccess`), all websites allowed, run `v2b-a` (server log, `GPC=` column): `/page` None, `/frame` None, `/gpc/echo` (fetch) None, `/gpc/x.xhr` None, `/sc/x.json` (fetch) None, `/gpc/x.gif` **1**, `/gpc/x.js` **1**, `/sc/x.gif` **1**, every other `.gif` **1** except the excluded hosts (`gpcx`: None — its own exclusion; `keep.a`: None — bleed from rule 3; `keep.e`: 1 from `a` (same site, 9004's third-party trigger did not fire) but None from the loopback-IP and `localhost` pages — bleed from 9004).
- Cookie removal: `c8_keep_img` and `c9_strip_img` both logged `Cookie: rc=…; rs=…; vis=…` (and `GPC=1`), so rule 9001 matched but did not remove the header. `getMatchedRules` listed `/strip/echo` and `/setcookie-stripped` as matched.
- Set-Cookie removal: after `/setcookie-stripped/x.gif?name=rsi` the next image request carried `rsi=v2b-a` and `document.cookie` contained `rsi` → rule 9002 did not strip the response header. Same for the fetch variant (`rs` cookie stored in every run).
- Why (code reading, W3/W4): `ModifyHeadersAction` has only `applyToRequest`; response-header entries are parsed and stored but nothing applies them. Request modifications are applied in `CachedResourceLoader::requestResource` / `ResourceLoader::willSendRequestInternal` to the `ResourceRequest`; the `Cookie` header is attached later by the network layer, so removing it from the request has no effect. Document loads are only *checked* at response time in `DocumentLoader` (block), never header-modified. Why fetch/XHR did not receive `Sec-GPC` is **unverified** at code level; measured only.
- Gate (W3, `WebExtensionController::updateWebsitePoliciesForNavigation`): active actions (`modify-headers`, `redirect`) are allowed per page only for extensions holding `declarativeNetRequestWithHostAccess`, and only for the extension's currently granted host patterns. Apple (A3): "Safari requires the `declarativeNetRequestWithHostAccess` permission for `modifyHeaders` or `redirect`. Safari requires user permission to add, remove, or append headers."

### 4.5 Exclusion bleed, measured

| Probe | Page host | Result | Reading |
|---|---|---|---|
| `gpc_keepa_bleed_img` (`keep.a…/gpc/x.gif`) | `a`, loopback IP, `localhost` | `GPC=None` (control `gpc_b_img` = 1) | rule 3's `excludedRequestDomains:[keep.a]` exempted `keep.a` from the modifyHeaders rule 5000, which sorts after all block rules |
| `erd_keep_excluded` | all | present, `GPC=None` | same |
| `bleed_keepe_dyn2` (`keep.e…/dyn2/x.json`, rule 9008 declared after 9004) | loopback IP, `localhost` | **reached the server** (control `dyn2_b_ctrl` blocked) | 9004's exclusion exempted `keep.e` from a later block rule when 9004's `third-party` trigger matched |
| same | `a` (same site as `keep.e`) | blocked | the ignore rule inherits `load-type: third-party`, so no bleed when first-party |
| `bleed_keepa_sb`, `bleed_gpcx_sb`, `bleed_decoy_query` | all | blocked | rule 1 (`/sb/`) sorts **before** rule 3, so no bleed backwards; the decoy host in a query string did not exempt anything in this ordering |

Consequence for Nullecho: every learned rule's `excludedRequestDomains` (D50 carve-outs such as `www.google.com`, `accounts.google.com`) also removes those hosts from `gpc.json` rule 5000 and from any later-sorted block rule; `gpc.json`'s own 50 exclusions sort last and therefore bleed into nothing. Only measured for this probe's rule set; the exact merge order between static rulesets is dictionary order in WebKit (W8) and should be treated as unspecified.

### 4.6 Website access and the iOS enable flow

- Nothing of the extension acts until it is **enabled** in Settings → Apps → Safari → Extensions (the first run, `noperm-a`, before enabling: 51/51 requests reached the server, no scripts).
- Enabled + "All Websites: Ask", no origin granted (`noperm2-a`): DNR **block** rules act; content scripts do not run; `modifyHeaders` does not act; `webRequest` events still fire for the tab (the gate in `hasPermissionToSendWebRequestEvent` requires `tab->extensionHasPermission()` except for main-frame navigations — measured events in this state were not separately counted).
- "All Websites: Allow" wrote `GrantedPermissionOrigins: {"*://*/*"}` to Safari's `Library/Safari/WebExtensions/Extensions.plist` in the Safari container; content scripts and `executeScript` then worked.
- Simulator quirk (reproducible twice): toggling "Allow Extension" while Safari was running was undone within seconds — Safari rewrote `Extensions.plist` from its stale in-memory state (log: `Skipping unload of … not in _enabledExtensions (count=0)`, then `writeExtensionsStateToStorage`). Terminating MobileSafari first, then toggling, stuck.

### 4.7 webRequest (run `perm-a`, 214 events; all runs 860)

- Events present: `onBeforeRequest`, `onBeforeSendHeaders`, `onSendHeaders`, `onHeadersReceived`, `onResponseStarted`, `onCompleted`, `onErrorOccurred`, `onBeforeRedirect`, `onAuthRequired` (keys of `browser.webRequest`); `OnBeforeSendHeadersOptions`/`OnHeadersReceivedOptions` enums absent (so Nullecho's feature-detect correctly skips `extraHeaders`; passing it anyway does not throw).
- `details` keys actually delivered: `frameId`, `method`, `requestId`, `tabId`, `type`, `url` (+ `requestHeaders`/`responseHeaders`/`statusCode` where asked). `initiator`, `documentUrl`, `originUrl`: never.
- Request header names ever seen: `Accept`, `Cache-Control`, `Pragma`, `Referer`, `Sec-Fetch-Dest/Mode/Site`, `Upgrade-Insecure-Requests`, `User-Agent`. **Never `Cookie`**, while the server log for the same `/keep/echo` request shows `Cookie: rc=perm-a; rs=perm-a; vis=perm-a`.
- Response headers in `onHeadersReceived` for `/setcookie-stripped`: `Pragma, Content-Type, Access-Control-*, Expires, Date, Content-Length, Cache-Control, Server` — no `Set-Cookie`; the same request's `onCompleted` listed `Set-Cookie` with value `rs=perm-a; Path=/`.
- `type` values seen: `xmlhttprequest` (fetch and XHR), `image`, `script`, `main_frame` — the cross-origin `<iframe>` document was reported as `main_frame` with a non-zero `frameId`, never `sub_frame`.
- WebKit source (W6): `convertHeaderFieldsToWebExtensionFormat` carries `// FIXME: <rdar://problem/58967376> Add cookies.`

### 4.8 Content scripts (run `perm-a`)

Page's first inline script (top of `<head>`) saw `data-cs-start = "…|loading|scripts=0|body=false"`, `data-cs-main = "…|loading|scripts=0"`, `window.__probeMainWorld = {readyState:"loading", scripts:0}`. Content-script reports: ISOLATED (`runtime.id` present) and MAIN (`privilegedApi: "none"`) in the top document, in `http://b…/frame`, `about:blank`, `about:srcdoc`, `blob:`, `data:` frames; `window.name` carried the run id in each. Note: `typeof browser === "object"` in the *page* world is normal Safari behaviour (page-to-extension messaging), not evidence of injection.

### 4.9 Other

- `getMatchedRules({})` after traffic: 203 entries, each `{request:{url}, tabId, timeStamp}` and **no** `rule` object; it included requests matched only by the modifyHeaders rule (e.g. `/page.js`) — so counts are "rules acted" not "blocked", and ruleset attribution is impossible, but URLs are present (unlike Chrome's packed builds).
- Alarm cadence (UTC): 22:16:14, :44, 22:17:14, :44 … every 30 s with 0–300 ms lateness, one 1.2 s outlier; `once` (0.25 min) fired at +30 s.
- `storage.local` round trip and persistence across restarts and reinstall: `starts` 1→2→3→4 (the last increment from a command).

## 5. What this means for Nullecho's code (file:line, current `ext/`)

- `heuristics.js:615 firstPartyOf()` → always `''` in Safari (no `initiator`/`documentUrl`) → `isObservable()` false → zero strikes ever; and `heuristics.js:645/655` cookie checks would see no `Cookie`/`Set-Cookie` in those events anyway (`Set-Cookie` only in `onCompleted`, which the learner does not listen to). The learner needs a Safari-specific design (e.g. `onCompleted` + `tabs.get(tabId).url` for the first party), and even then it can see Set-Cookie only.
- `background.js:130 updateStaticRules` and `:146 getDisabledRuleIds` → `TypeError` in Safari (`setStrictFingerprinting` must be guarded; `strictFingerprintingEnabled` already catches).
- `background.js:486 request.initiator || request.documentUrl` and `protocol.js:387 rule.ruleId` → `getMatchedRules` entries carry neither; `onRuleMatchedDebug` is absent.
- `manifest.json` lacks `declarativeNetRequestWithHostAccess` → `rules/gpc.json`, `ua-*.json` and the learner's cookie-strip rules do nothing in Safari as shipped; with the permission, `Sec-GPC` reaches images/scripts/fonts-type subresources only, never the document request; cookie stripping has no DNR implementation in Safari.
- D50/D52 semantics (`heuristics.js:426-434`): `requestDomains`+`domainType`+`excludedRequestDomains`+`excludedInitiatorDomains` all compile and act, but each carve-out also exempts the carved host from rule 5000 and from any later-sorted block (4.5).
- `background.js:899 alarms.create(…, {periodInMinutes: 60})` fine; the worker will be restarted for it.

## 6. Not measured / unverified, and what unblocks it

| Item | Status | To unblock |
|---|---|---|
| Everything on **macOS Safari 27** | unverified — needs owner step | see §7 |
| `initiatorDomains`/`excludedInitiatorDomains` with a **port-less** initiator (real-world form) | unverified live (regex analysis W2 says it works; only the `host:port` twin was measurable because the fixture must use a port; binding port 80 was refused in this environment) | run the probe against any port-80/443 origin, e.g. the macOS run below with a local reverse proxy, or deploy the fixture behind HTTPS |
| Why `fetch`/XHR never receive `modifyHeaders` | measured only | WebKit code path not pinned down |
| `webRequest` event delivery to the worker **before** a site is granted (count) | not isolated | re-run `noperm2-a` and filter `wr` by run id |
| `setExtensionActionOptions` badge rendering | API resolved; badge not inspected | look at the iOS toolbar button |
| `onRuleMatchedDebug` in a development build | not applicable (absent in release WebKit) | — |
| Third-party **cookie** visibility (ITP) | not tested: Safari blocks third-party cookies by default (Settings showed "Prevent Cross-Site Tracking" on), so the learner's `Cookie` signal would not exist even if the header were visible | — |
| `.localhost` same-site semantics (dynamic rule 9006) | not measured (`testMatchOutcome` absent) | not needed for the plan |

## 7. Owner steps — macOS Safari 27 probe (nothing here was done by the agent)

Built artefacts (unsigned, ad-hoc "linker-signed"), under the agent scratch directory `…/scratchpad/a1-api/`:
- v2 macOS app (with `declarativeNetRequestWithHostAccess`): `dd-mac2/Build/Products/Debug/NullechoProbe.app`
- v1 macOS app (Nullecho's exact permission set): `dd-mac/Build/Products/Debug/NullechoProbe.app`
- probe sources: `probe/` (v2) and `probe-v1-nohostaccess/`; Xcode projects `proj2/`, `proj/`
- fixture: `server.py`, `page.js`, `hosts.json`, `analyze.py`, `cmd.py`; logs `requests.jsonl`, `reports.jsonl`

1. Start the fixture: `cd …/scratchpad/a1-api && lsof -i :47101 && python3 server.py 47101 hosts.json` (leave it running).
2. `open dd-mac2/Build/Products/Debug/NullechoProbe.app` once (if Gatekeeper refuses, right-click → Open). Quit it.
3. Safari → Settings → Advanced → tick "Show features for web developers". Settings → Developer → tick "Allow unsigned extensions" (Safari asks for your password; this resets when Safari quits — Apple doc A4).
4. Settings → Extensions → tick **NullechoProbe**. When asked, choose **Always Allow on Every Website** (or Settings → Websites → NullechoProbe → "Other websites: Allow").
5. Load, one at a time, waiting ~20 s each with the tab in front: `http://a.lvh.me:47101/page?run=mac-a&exec=1`, then the same path on `localhost:47101` (`run=mac-lh`) and on the loopback-IP host from `hosts.json` key `IP` (`run=mac-ip`).
6. Read results: `python3 analyze.py mac-a`, `… mac-ip`, `… mac-lh`, and `python3 analyze.py --bg 20` for the worker's `start`/`dnr-info`/`wr` reports. Expectation from the docs: same DNR/webRequest picture as iOS (webRequest is officially supported on macOS), `Sec-GPC` on images/scripts only.
7. For the "no website access" case: Settings → Websites → NullechoProbe → set "Other websites" to **Ask**, reload the `a.lvh.me` page with `run=mac-noperm`, analyze; blocks should persist, content scripts and headers should not.
8. Afterwards untick "Allow unsigned extensions" (or just quit Safari) and stop the server (Ctrl-C).

## 8. Sources

Apple documentation (fetched 2026-10-01 via the pages' JSON data; quotes verbatim):
- A1 Safari release notes 15.4 / 16.4 / 17.0–17.6 / 18.0–18.6 / 26.0–26.4 / 27.0 — `https://developer.apple.com/documentation/safari-release-notes/` (e.g. `safari-16_4-release-notes`, `safari-18_4-release-notes`, `safari-27-release-notes`). Key lines: 15.4 "Added support for `service_worker` background scripts"; 16.4 "Added support for modules in background service workers", "Added support for the `modifyHeaders` action type", "Added support for `requestDomains`", "`browser.storage.session`", "`declarativeNetRequest.setExtensionActionOptions`"; 17.1 "`storage.session.setAccessLevel` … `TRUSTED_CONTEXTS` by default"; 17.2 "Fixed behavior of `domains`, `requestDomains`, `excludedDomains`, and `excludedRequestDomains` … to match subdomains by default"; 17.6 "background pages would stop responding after about 30 seconds"; 18.4 "Added support for `match_about_blank` and `match_origin_as_fallback`", "Fixed `webRequest` event listeners to honor `extraInfoSpec`", "Fixed CORS for Web Extension pages to respect granted per-site permissions"; 26.0 "Fixed processing of `declarativeNetRequest` rules so that higher numbers are treated as higher priority", "Fixed a non-fatal `webRequest` error for non-persistent background content", "Fixed CSS `display: none` … after an `ignore-following-rules` action"; 27.0 "Fixed an issue where web extension service worker registration database files accumulated on each Safari launch".
- A2 "Assessing your Safari web extension's browser compatibility" — `https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility`: "`background`: In iOS, you need to set the `persistent` attribute to `false`. With manifest version 3, all background pages are nonpersistent."; "`storage.session`: Supported in Safari 16.4 or later."; "`webRequest`: Not supported in iOS. `BlockingResponse` not supported. Blocking requests not supported. `opt_extraInfoSpec` not supported for any of the events."; "`webRequest.HTTPHeaders`: `cookies` not supported."; "`scripting.executeScript`: `injectImmediately` not supported."
- A3 "Blocking content with your Safari web extension" — `https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension`: "Safari requires the `declarativeNetRequestWithHostAccess` permission for `modifyHeaders` or `redirect`. Safari requires user permission to add, remove, or append headers."; "`RuleCondition`: Safari supports `domainType`, `excludedResourceTypes`, `isUrlFilterCaseSensitive`, `regexFilter`, and `resourceTypes.`"; "Rule APIs: Safari supports `getEnabledRulesets()`, `isRegexSupported(),` `updateEnabledRulesets()`, `MAX_NUMBER_OF_STATIC_RULESETS`, `updateDynamicRules()`, `getDynamicRules()`, `updateSessionRules()`, `getSessionRules()`, and `getMatchedRules()`."
- A4 "Running your Safari web extension" — `https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension` (unsigned-extension steps; "The “Allow unsigned extensions” setting for Safari resets when you quit Safari").
- A5 "Managing Safari web extension permissions" — `https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions`.
- A6 WWDC26 session 216 "Create web extensions for Safari" — `https://developer.apple.com/videos/play/wwdc2026/216/`: background pages and service workers — "Safari supports both, so it's really your preference!"

WebKit source (GitHub `WebKit/WebKit`, branch `main` at commit `b9d19a6029b4`, 2026-10-02):
- W1 `Source/WebKit/WebProcess/Extensions/Interfaces/WebExtensionAPIDeclarativeNetRequest.idl` (API surface: no `updateStaticRules`, `getDisabledRuleIds`, `getAvailableStaticRuleCount`, `testMatchOutcome`; `onRuleMatchedDebug` conditional on `DNR_ON_RULE_MATCHED_DEBUG`; three constants).
- W2 `Source/WebKit/UIProcess/Extensions/Cocoa/_WKWebExtensionDeclarativeNetRequestRule.mm` (rule translation, header allow-list, `compare:`), `…/_WKWebExtensionDeclarativeNetRequestTranslator.mm` (sort + merge).
- W3 `Source/WebKit/UIProcess/Extensions/Cocoa/WebExtensionControllerCocoa.mm` `updateWebsitePoliciesForNavigation` (host-access gate), bug `https://bugs.webkit.org/show_bug.cgi?id=272763` "declarativeNetRequest redirect and modifyHeaders rules don't work" (fixed 2024-04-18).
- W4 `Source/WebCore/contentextensions/ContentExtensionsBackend.cpp` (`IgnoreFollowingRules` break; `allowsActiveContentRuleListActionsForURL` for modify-headers/redirect; `applyResultsToRequest`), `ContentExtensionActions.{h,cpp}` (`ModifyHeadersAction::applyToRequest` only), `Source/WebCore/loader/cache/CachedResourceLoader.cpp`, `DocumentLoader.cpp`, `ResourceLoader.cpp`.
- W5 `Source/WebKit/Shared/Extensions/WebExtensionConstants.h`: `webExtensionMinimumAlarmInterval = 30_s`, `…MaximumNumberOfStaticRulesets = 100`, `…MaximumNumberOfEnabledRulesets = 50`, `…MaximumNumberOfDynamicAndSessionRules = 30000`, `webExtensionStorageAreaLocalQuotaBytes = 10 MiB`, `…SessionQuotaBytes = 10 MiB`.
- W6 `Source/WebKit/WebProcess/Extensions/API/Cocoa/WebExtensionAPIWebRequestCocoa.mm` ("FIXME: … Add cookies."), `…/Interfaces/WebExtensionAPIWebRequest.idl`.
- W7 `Source/WebKit/UIProcess/Extensions/Cocoa/WebExtensionContextCocoa.mm` (`Cannot load persistent background content on this platform` under `PLATFORM(IOS)`; `hasPermissionToSendWebRequestEvent`; `loadDeclarativeNetRequestRules`).
- W8 same file, `loadDeclarativeNetRequestRules` → `compileDeclarativeNetRequestRules` (static rulesets and dynamic rules merged into one `NSDictionary` before translation).

Secondary: MDN `declarativeNetRequest` compatibility notes (same statement about `declarativeNetRequestWithHostAccess` in Safari); Apple Developer Forums thread 760969 (unanswered report of `modifyHeaders` not applying on macOS 17.1).

Not consulted for verdicts: anything measured here overrides MDN tables where they differ.
