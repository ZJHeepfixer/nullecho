# Nullecho pre-release site smoke — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `33b0c8cc7e68f8a0f2c2106eff6fc4fc9cb55127d78db024496bed1865239807`, 289.0 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `0deb5fd` (ext/ and harness/ clean)
- **Runtime:** 92s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** yes — no chrome-extension:// target
- **ON browser really ON:** yes — chrome-extension://eljfnneclhilbjikbohjioiefjdhbdhn/src/background.js
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:65118` serving `harness/fixtures/third-party-embeds.html`

## Seeded learned state — and the positive control that proves it was live

Written from the extension's service worker into `chrome.storage.local["nullecho:heuristics:v1"]` (key read from the loaded heuristics.js), then the extension (`eljfnneclhilbjikbohjioiefjdhbdhn`) was **reloaded** via CDP `Extensions.loadUnpacked` on the same path — the reload arrow / an update — so the shipped `install()` + `onInstalled` ran the shipped `reconcile()`. The harness wrote no DNR rule.

Seeded, each as `{status: 'blocked', ruleId: <heuristic block range>, sites: 3 distinct, source: 'learned'}`: `google.com`, `youtube.com`, `facebook.com`, `microsoft.com`, `live.com`, `microsoftonline.com`, `apple.com`, `cloudflare.com`, `amazon.com`, `twitter.com`, `x.com`, `linkedin.com`.

| Positive-control assertion | Result |
|---|---|
| no learned-range rule existed before the reload (found 0) — so every rule below was written by the extension's reconcile(), not left over | ✅ |
| the reloaded extension still has its static blocking rulesets on (["gpc","ads","analytics","social","fingerprinting","personalization","ua-mac"]) — the seeded ON pass is the whole extension plus the learned rules, not a lesser one | ✅ |
| google.com: a live learned rule covers it (id 1050001, modifyHeaders) | ✅ |
| google.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050001) | ✅ |
| youtube.com: a live learned rule covers it (id 1050005, modifyHeaders) | ✅ |
| youtube.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050005) | ✅ |
| facebook.com: a live learned rule covers it (id 1050000, modifyHeaders) | ✅ |
| facebook.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050000) | ✅ |
| microsoft.com: a live learned rule covers it (id 1000003, block) | ✅ |
| microsoft.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000003) | ✅ |
| live.com: a live learned rule covers it (id 1000004, block) | ✅ |
| live.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000004) | ✅ |
| microsoftonline.com: a live learned rule covers it (id 1000005, block) | ✅ |
| microsoftonline.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000005) | ✅ |
| apple.com: a live learned rule covers it (id 1000006, block) | ✅ |
| apple.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000006) | ✅ |
| cloudflare.com: a live learned rule covers it (id 1000007, block) | ✅ |
| cloudflare.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000007) | ✅ |
| amazon.com: a live learned rule covers it (id 1000008, block) | ✅ |
| amazon.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000008) | ✅ |
| twitter.com: a live learned rule covers it (id 1050003, modifyHeaders) | ✅ |
| twitter.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050003) | ✅ |
| x.com: a live learned rule covers it (id 1050004, modifyHeaders) | ✅ |
| x.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050004) | ✅ |
| linkedin.com: a live learned rule covers it (id 1050002, modifyHeaders) | ✅ |
| linkedin.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050002) | ✅ |
| enforcement + recorder: a fetch from http://127.0.0.1:65118 to www.linkedin.com matched learned rule 1050002 and the recorder saw it (fetch loaded; 1 hit(s)) | ✅ |

**Learned-range dynamic rules live after the reload** (`getDynamicRules()` from the new worker, 12 rules):

```
1000003 block requestDomains=[microsoft.com] excluded=[] excludedInitiators=[live.com,msn.com,bing.com,office.com,sharepoint.com,windows.net,microsoftonline.com,msauth.net,msftauth.net,office365.com,microsoft365.com,outlook.com,onedrive.com,azure.com] thirdParty
1000004 block requestDomains=[live.com] excluded=[login.live.com] excludedInitiators=[microsoft.com,msn.com,bing.com,office.com,sharepoint.com,windows.net,microsoftonline.com,msauth.net,msftauth.net,office365.com,microsoft365.com,outlook.com,onedrive.com,azure.com] thirdParty
1000005 block requestDomains=[microsoftonline.com] excluded=[login.microsoftonline.com] excludedInitiators=[microsoft.com,live.com,msn.com,bing.com,office.com,sharepoint.com,windows.net,msauth.net,msftauth.net,office365.com,microsoft365.com,outlook.com,onedrive.com,azure.com] thirdParty
1000006 block requestDomains=[apple.com] excluded=[appleid.apple.com] excludedInitiators=[icloud.com,cdn-apple.com,mzstatic.com] thirdParty
1000007 block requestDomains=[cloudflare.com] excluded=[cdnjs.cloudflare.com,challenges.cloudflare.com] excludedInitiators=[cloudflareinsights.com] thirdParty
1000008 block requestDomains=[amazon.com] excluded=[] excludedInitiators=[amazonaws.com,media-amazon.com,ssl-images-amazon.com,amazon-adsystem.com] thirdParty
1050000 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[facebook.com] excluded=[graph.facebook.com] excludedInitiators=[facebook.net,fbcdn.net,fbsbx.com,instagram.com,whatsapp.com,messenger.com] thirdParty
1050001 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[google.com] excluded=[accounts.google.com,apis.google.com,www.google.com] excludedInitiators=[googleapis.com,gstatic.com,googlevideo.com,youtube.com,ytimg.com,withgoogle.com,google-analytics.com,googletagmanager.com] thirdParty
1050002 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[linkedin.com] excluded=[] excludedInitiators=[licdn.com] thirdParty
1050003 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[twitter.com] excluded=[] excludedInitiators=[x.com,twimg.com,t.co] thirdParty
1050004 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[x.com] excluded=[] excludedInitiators=[twitter.com,twimg.com,t.co] thirdParty
1050005 modifyHeaders(strip Cookie/Set-Cookie) requestDomains=[youtube.com] excluded=[] excludedInitiators=[google.com,googleapis.com,gstatic.com,googlevideo.com,ytimg.com,withgoogle.com,google-analytics.com,googletagmanager.com] thirdParty
```

<details><summary>Raw JSON</summary>

```json
[
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "live.com",
    "msn.com",
    "bing.com",
    "office.com",
    "sharepoint.com",
    "windows.net",
    "microsoftonline.com",
    "msauth.net",
    "msftauth.net",
    "office365.com",
    "microsoft365.com",
    "outlook.com",
    "onedrive.com",
    "azure.com"
   ],
   "requestDomains": [
    "microsoft.com"
   ]
  },
  "id": 1000003,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "microsoft.com",
    "msn.com",
    "bing.com",
    "office.com",
    "sharepoint.com",
    "windows.net",
    "microsoftonline.com",
    "msauth.net",
    "msftauth.net",
    "office365.com",
    "microsoft365.com",
    "outlook.com",
    "onedrive.com",
    "azure.com"
   ],
   "excludedRequestDomains": [
    "login.live.com"
   ],
   "requestDomains": [
    "live.com"
   ]
  },
  "id": 1000004,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "microsoft.com",
    "live.com",
    "msn.com",
    "bing.com",
    "office.com",
    "sharepoint.com",
    "windows.net",
    "msauth.net",
    "msftauth.net",
    "office365.com",
    "microsoft365.com",
    "outlook.com",
    "onedrive.com",
    "azure.com"
   ],
   "excludedRequestDomains": [
    "login.microsoftonline.com"
   ],
   "requestDomains": [
    "microsoftonline.com"
   ]
  },
  "id": 1000005,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "icloud.com",
    "cdn-apple.com",
    "mzstatic.com"
   ],
   "excludedRequestDomains": [
    "appleid.apple.com"
   ],
   "requestDomains": [
    "apple.com"
   ]
  },
  "id": 1000006,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "cloudflareinsights.com"
   ],
   "excludedRequestDomains": [
    "cdnjs.cloudflare.com",
    "challenges.cloudflare.com"
   ],
   "requestDomains": [
    "cloudflare.com"
   ]
  },
  "id": 1000007,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "amazonaws.com",
    "media-amazon.com",
    "ssl-images-amazon.com",
    "amazon-adsystem.com"
   ],
   "requestDomains": [
    "amazon.com"
   ]
  },
  "id": 1000008,
  "priority": 1
 },
 {
  "action": {
   "requestHeaders": [
    {
     "header": "Cookie",
     "operation": "remove"
    }
   ],
   "responseHeaders": [
    {
     "header": "Set-Cookie",
     "operation": "remove"
    }
   ],
   "type": "modifyHeaders"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "facebook.net",
    "fbcdn.net",
    "fbsbx.com",
    "instagram.com",
    "whatsapp.com",
    "messenger.com"
   ],
   "excludedRequestDomains": [
    "graph.facebook.com"
   ],
   "requestDomains": [
    "facebook.com"
   ]
  },
  "id": 1050000,
  "priority": 1
 },
 {
  "action": {
   "requestHeaders": [
    {
     "header": "Cookie",
     "operation": "remove"
    }
   ],
   "responseHeaders": [
    {
     "header": "Set-Cookie",
     "operation": "remove"
    }
   ],
   "type": "modifyHeaders"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "googleapis.com",
    "gstatic.com",
    "googlevideo.com",
    "youtube.com",
    "ytimg.com",
    "withgoogle.com",
    "google-analytics.com",
    "googletagmanager.com"
   ],
   "excludedRequestDomains": [
    "accounts.google.com",
    "apis.google.com",
    "www.google.com"
   ],
   "requestDomains": [
    "google.com"
   ]
  },
  "id": 1050001,
  "priority": 1
 },
 {
  "action": {
   "requestHeaders": [
    {
     "header": "Cookie",
     "operation": "remove"
    }
   ],
   "responseHeaders": [
    {
     "header": "Set-Cookie",
     "operation": "remove"
    }
   ],
   "type": "modifyHeaders"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "licdn.com"
   ],
   "requestDomains": [
    "linkedin.com"
   ]
  },
  "id": 1050002,
  "priority": 1
 },
 {
  "action": {
   "requestHeaders": [
    {
     "header": "Cookie",
     "operation": "remove"
    }
   ],
   "responseHeaders": [
    {
     "header": "Set-Cookie",
     "operation": "remove"
    }
   ],
   "type": "modifyHeaders"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "x.com",
    "twimg.com",
    "t.co"
   ],
   "requestDomains": [
    "twitter.com"
   ]
  },
  "id": 1050003,
  "priority": 1
 },
 {
  "action": {
   "requestHeaders": [
    {
     "header": "Cookie",
     "operation": "remove"
    }
   ],
   "responseHeaders": [
    {
     "header": "Set-Cookie",
     "operation": "remove"
    }
   ],
   "type": "modifyHeaders"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "twitter.com",
    "twimg.com",
    "t.co"
   ],
   "requestDomains": [
    "x.com"
   ]
  },
  "id": 1050004,
  "priority": 1
 },
 {
  "action": {
   "requestHeaders": [
    {
     "header": "Cookie",
     "operation": "remove"
    }
   ],
   "responseHeaders": [
    {
     "header": "Set-Cookie",
     "operation": "remove"
    }
   ],
   "type": "modifyHeaders"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedInitiatorDomains": [
    "google.com",
    "googleapis.com",
    "gstatic.com",
    "googlevideo.com",
    "ytimg.com",
    "withgoogle.com",
    "google-analytics.com",
    "googletagmanager.com"
   ],
   "requestDomains": [
    "youtube.com"
   ]
  },
  "id": 1050005,
  "priority": 1
 }
]
```
</details>

Stored records after the reload: `{"amazon.com":{"status":"blocked","ruleId":1000008,"source":"learned"},"apple.com":{"status":"blocked","ruleId":1000006,"source":"learned"},"cloudflare.com":{"status":"blocked","ruleId":1000007,"source":"learned"},"facebook.com":{"status":"cookieblocked","ruleId":1050000,"source":"learned"},"google.com":{"status":"cookieblocked","ruleId":1050001,"source":"learned"},"linkedin.com":{"status":"cookieblocked","ruleId":1050002,"source":"learned"},"live.com":{"status":"blocked","ruleId":1000004,"source":"learned"},"microsoft.com":{"status":"blocked","ruleId":1000003,"source":"learned"},"microsoftonline.com":{"status":"blocked","ruleId":1000005,"source":"learned"},"twitter.com":{"status":"cookieblocked","ruleId":1050003,"source":"learned"},"x.com":{"status":"cookieblocked","ruleId":1050004,"source":"learned"},"youtube.com":{"status":"cookieblocked","ruleId":1050005,"source":"learned"}}`

Worker console during the reload: _empty_

Match recorder (`onRuleMatchedDebug` in the worker): `installed`.

**Learned rules at the END of the ON pass vs after the reload:** 0 added, 0 removed, 0 changed.

## Self-test — attacking our own checks before trusting a PASS

| Check | Deliberately broken how | Expected | Actual | Result |
|---|---|---|---|---|
| youtube playback | navigated but never pressed play | check should report FAIL | FAILED (correct) | ✅ |
| maps zoom | ran the same wheel-zoom check on example.com (no map) | check should report FAIL | FAILED (correct) | ✅ |
| tp-recaptcha-patrickhlauke | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-recaptcha-ascendpartner | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-recaptcha-enterprise-reddit | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-turnstile-peet | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-hcaptcha-democaptcha | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-gsi-reddit | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-gsi-pinterest | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-youtube-embed | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-maps-embed | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-maps-embed-legacy | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-calendar-embed | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-facebook-sdk-plugin | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-x-embedded-post | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |
| tp-msft-signin-handoff | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |

Detail: youtube {"from":0,"currentTime":0,"readyState":0,"buffered":0,"paused":false,"skipPlay":false}; maps {"ok":false,"error":"timeout after 15000ms: maps self-test"}

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 9 | youtube.com/watch?v=jNQXAC9IVRw | PASS | PASS | **PASS** |  |

**Totals:** 1 PASS

## D50 invariant over all traffic — learned BLOCKs on protected hosts: 0

Every learned-rule block recorded in any row, checked against the current NEVER_BLOCK + COOKIE_BLOCK_ONLY lists (path-scoped entries by host+path). Any hit is a FAIL for its row even if the row's own check passed.

_None._

## Per-site detail

### 9. youtube.com/watch?v=jNQXAC9IVRw — **PASS**

- URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"from":1.593222,"currentTime":10.595931,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"from":1.562355,"currentTime":10.564924,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (6): `script https://static.doubleclick.net/instream/ad_status.js`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://static.doubleclick.net/instream/ad_status.js`, `fetch https://googleads.g.doubleclick.net/pagead/viewthroughconversion/962985656/?backend=innertube&cname=1&cver=2_20261016&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20261016%3Bptype%3Df_view%3Btype%3`, `xhr https://googleads.g.doubleclick.net/pagead/id`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

## Every Nullecho console line seen this run (verbatim)

_None captured this run._
