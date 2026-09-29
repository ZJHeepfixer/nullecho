# Nullecho pre-release site smoke — SEEDED learned state — 2026-09-28

> **Director's note (0.9.1 gate).** This is the SECOND seeded run on 626558f: exit 0, 21 PASS, 6 NOT-OURS, 1 BLOCKED.
> The first run (same commit, minutes earlier, not kept) exited 1 on one VOID — row 8, `net::ERR_NETWORK_CHANGED` while the
> owner's laptop rejoined his home network after travel — with the same six NOT-OURS. The six (rows 7, 10, 20, 21, 23, 24:
> Google Maps page, chartjs sample, Google Sign-In on reddit/pinterest, both Maps embeds) FAIL with the extension OFF in both
> runs and show **0 learned-rule matches** ON; all six PASSED in the agent's run on 956882e earlier the same night, on another
> network. So they are environmental on this connection (Google degrading automated Chrome for Testing after a day of runs, or
> the network), not Nullecho — and the same rows are being confirmed by eye in the owner's real Chrome with Nullecho ON.


Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.1-chrome.zip`, sha256 `c4903cb56adbcbe4db2e38d965948ce4d7e0dfa51792f891432d6b7c79441ecd`, 247.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `626558f` (ext/ and harness/ clean)
- **Runtime:** 619s
- **`ext/_metadata/` present:** ⚠ YES — investigate, must never be committed
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** yes — no chrome-extension:// target
- **ON browser really ON:** yes — chrome-extension://dfibdnmhpkfkjjjnllednebmdblplflb/src/background.js
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:55735` serving `harness/fixtures/third-party-embeds.html`

## Seeded learned state — and the positive control that proves it was live

Written from the extension's service worker into `chrome.storage.local["nullecho:heuristics:v1"]` (key read from the loaded heuristics.js), then the extension (`dfibdnmhpkfkjjjnllednebmdblplflb`) was **reloaded** via CDP `Extensions.loadUnpacked` on the same path — the reload arrow / an update — so the shipped `install()` + `onInstalled` ran the shipped `reconcile()`. The harness wrote no DNR rule.

Seeded, each as `{status: 'blocked', ruleId: <heuristic block range>, sites: 3 distinct, source: 'learned'}`: `google.com`, `youtube.com`, `facebook.com`, `microsoft.com`, `live.com`, `microsoftonline.com`, `apple.com`, `cloudflare.com`, `amazon.com`, `twitter.com`, `x.com`, `linkedin.com`.

| Positive-control assertion | Result |
|---|---|
| no learned-range rule existed before the reload (found 0) — so every rule below was written by the extension's reconcile(), not left over | ✅ |
| the reloaded extension still has its static blocking rulesets on (["gpc","ads","analytics","social","fingerprinting","ua-mac"]) — the seeded ON pass is the whole extension plus the learned rules, not a lesser one | ✅ |
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
| enforcement + recorder: a fetch from http://127.0.0.1:55735 to www.linkedin.com matched learned rule 1050002 and the recorder saw it (fetch loaded; 1 hit(s)) | ✅ |

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
| 1 | example.com | PASS | PASS | **PASS** |  |
| 2 | open.spotify.com | PASS | PASS | **PASS** |  |
| 3 | google.com/recaptcha/api2/demo | PASS | PASS | **PASS** |  |
| 4 | accounts.hcaptcha.com/demo | PASS | PASS | **PASS** |  |
| 5 | demo.turnstile.workers.dev | PASS | PASS | **PASS** |  |
| 6 | amazon.com (search "usb c cable") | PASS | PASS | **PASS** |  |
| 7 | google.com/maps | FAIL | FAIL | **NOT-OURS** | fails with extension OFF too — off: timeout after 45000ms: maps |
| 8 | openstreetmap.org | PASS | PASS | **PASS** |  |
| 9 | youtube.com/watch?v=jNQXAC9IVRw | PASS | PASS | **PASS** |  |
| 10 | chartjs.org vertical bar sample | FAIL | FAIL | **NOT-OURS** | fails with extension OFF too — off: functional check failed |
| 11 | nytimes.com | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — nytimes.com — |
| 12 | squoosh.app | PASS | PASS | **PASS** |  |
| 13 | irs.gov site search "form 1040" | PASS | PASS | **PASS** |  |
| 14 | reddit.com/r/technology | PASS | PASS | **PASS** |  |
| 15 | reCAPTCHA v2 on patrickhlauke.github.io | PASS | PASS | **PASS** |  |
| 16 | reCAPTCHA v2 on ascendpartner.com signup | PASS | PASS | **PASS** |  |
| 17 | reCAPTCHA Enterprise (invisible) on reddit.com/login | PASS | PASS | **PASS** |  |
| 18 | Cloudflare Turnstile on peet.ws | PASS | PASS | **PASS** |  |
| 19 | hCaptcha on democaptcha.com | PASS | PASS | **PASS** |  |
| 20 | Google Sign-In button on reddit.com/login | FAIL | FAIL | **NOT-OURS** | fails with extension OFF too — off: functional check failed |
| 21 | Google Sign-In button on pinterest.com/login | FAIL | FAIL | **NOT-OURS** | fails with extension OFF too — off: functional check failed |
| 22 | YouTube iframe embed (fixture) | PASS | PASS | **PASS** |  |
| 23 | Google Maps embed, www.google.com/maps/embed (fixture) | FAIL | FAIL | **NOT-OURS** | fails with extension OFF too — off: functional check failed |
| 24 | Google Maps embed via maps.google.com (fixture) | FAIL | FAIL | **NOT-OURS** | fails with extension OFF too — off: functional check failed |
| 25 | Google Calendar public embed (fixture) | PASS | PASS | **PASS** |  |
| 26 | Facebook JS SDK + Page plugin (fixture) | PASS | PASS | **PASS** |  |
| 27 | X / Twitter embedded post (fixture) | PASS | PASS | **PASS** |  |
| 28 | microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com) | PASS | PASS | **PASS** |  |

**Totals:** 21 PASS, 6 NOT-OURS, 1 BLOCKED

## D50 invariant over all traffic — learned BLOCKs on protected hosts: 0

Every learned-rule block recorded in any row, checked against the current NEVER_BLOCK + COOKIE_BLOCK_ONLY lists (path-scoped entries by host+path). Any hit is a FAIL for its row even if the row's own check passed.

_None._

## Per-site detail

### 1. example.com — **PASS**

- URL: `https://example.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"title":"Example Domain"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"title":"Example Domain"}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 2. open.spotify.com — **PASS**

- URL: `https://open.spotify.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=undefined cores=8 mem=16`, detail: `{"bodyLen":1039}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"bodyLen":1039}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.googletagmanager.com/gtm.js?id=GTM-PZHN3VD`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 3. google.com/recaptcha/api2/demo — **PASS**

- URL: `https://www.google.com/recaptcha/api2/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"box":{"w":304,"h":78}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":304,"h":78}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 4. accounts.hcaptcha.com/demo — **PASS**

- URL: `https://accounts.hcaptcha.com/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"box":{"w":302,"h":76}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":302,"h":76}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 5. demo.turnstile.workers.dev — **PASS**

- URL: `https://demo.turnstile.workers.dev/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"box":{"w":300,"h":71,"via":"widget-children"}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":300,"h":71,"via":"widget-children"}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 6. amazon.com (search "usb c cable") — **PASS**

- URL: `https://www.amazon.com/s?k=usb+c+cable`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"resultCount":22}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"resultCount":16}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (3): `script https://www.googletagservices.com/dcm/dcmads.js`, `fetch https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?_=1607460946161`, `document https://s.amazon-adsystem.com/iu3?d=amazon.com&slot=navFooter&a2=0101025dd4a7413283499f6f9f9be1a0b07796fa83623504536a3e3ac6c2aca5b3a7&old_oo=0&ts=1790656933212&s=AfDzHOsyYS2dNI4Ab3sD2G6PRIM5JEGcE6bGh3`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 7. google.com/maps — **NOT-OURS**

fails with extension OFF too — off: timeout after 45000ms: maps

- URL: `https://www.google.com/maps/@35.6225,-117.6709,12z`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{}`, error: `timeout after 45000ms: maps`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{}`, error: `timeout after 45000ms: maps`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{},"error":"timeout after 45000ms: maps"})
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 8. openstreetmap.org — **PASS**

- URL: `https://www.openstreetmap.org/#map=12/35.6225/-117.6709`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"total":24,"loaded":24}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"total":24,"loaded":24}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 9. youtube.com/watch?v=jNQXAC9IVRw — **PASS**

- URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"from":1.423261,"currentTime":10.425172,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"from":1.405735,"currentTime":10.40897,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `fetch https://googleads.g.doubleclick.net/pagead/viewthroughconversion/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 10. chartjs.org vertical bar sample — **NOT-OURS**

fails with extension OFF too — off: functional check failed

- URL: `https://www.chartjs.org/docs/latest/samples/bar/vertical.html`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"w":800,"h":400,"nonTransparentPixels":0}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"w":800,"h":400,"nonTransparentPixels":0}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"w":800,"h":400,"nonTransparentPixels":0},"error":null})
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.google-analytics.com/analytics.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 11. nytimes.com — **BLOCKED**

HTTP 403 — nytimes.com —

- URL: `https://www.nytimes.com/`
- **ON** — http 403, visibility `null`, probes: `gpc=true cores=8 mem=8`, detail: `{}`
- **OFF** — http 403, visibility `null`, probes: `gpc=undefined cores=12 mem=32`, detail: `{}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 12. squoosh.app — **PASS**

- URL: `https://squoosh.app/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.google-analytics.com/analytics.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 13. irs.gov site search "form 1040" — **PASS**

- URL: `https://www.irs.gov/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.googletagmanager.com/gtm.js?id=GTM-KV978ZL`, `script https://www.googletagmanager.com/gtm.js?id=GTM-KV978ZL`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 14. reddit.com/r/technology — **PASS**

- URL: `https://www.reddit.com/r/technology/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"postCount":8}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"postCount":6}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.googletagmanager.com/gtag/js?id=AW-788729857`, `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 15. reCAPTCHA v2 on patrickhlauke.github.io — **PASS**

- URL: `https://patrickhlauke.github.io/recaptcha/`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=kemdRjW","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=kemdRjW","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 16. reCAPTCHA v2 on ascendpartner.com signup — **PASS**

- URL: `https://www.ascendpartner.com/affiliate/registration?usertype=2`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=kemdRjWFxNj","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=kemdRjWFxNj","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 17. reCAPTCHA Enterprise (invisible) on reddit.com/login — **PASS**

- URL: `https://www.reddit.com/login/`
- Protected service under test: www.google.com/recaptcha/enterprise (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=kemdRjWFxNjgs","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=kemdRjWFxNjgs","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 18. Cloudflare Turnstile on peet.ws — **PASS**

- URL: `https://peet.ws/turnstile-test/non-interactive.html`
- Protected service under test: challenges.cloudflare.com (NEVER_BLOCK) under a learned cloudflare.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/nf7cl/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/qctr2/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 19. hCaptcha on democaptcha.com — **PASS**

- URL: `https://democaptcha.com/demo-form-eng/hcaptcha.html`
- Protected service under test: hcaptcha.com (NEVER_BLOCK; no seeded domain covers it — a CONTROL row: it must pass in every mode)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/b9ca2a6602c2bf69741b771db488f3001ea35b08/static/hcaptcha.html#frame=checkbox&id=097pgss4smik&host=democaptcha.com&sent","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/b9ca2a6602c2bf69741b771db488f3001ea35b08/static/hcaptcha.html#frame=checkbox&id=09jl51p0z7iq&host=democaptcha.com&sent","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 20. Google Sign-In button on reddit.com/login — **NOT-OURS**

fails with extension OFF too — off: functional check failed

- URL: `https://www.reddit.com/login/`
- Protected service under test: accounts.google.com (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"ready":true},"button":{"ok":false,"found":false,"errorFrames":0}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"ready":true},"button":{"ok":false,"found":false,"errorFrames":0}},"error":null})
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 21. Google Sign-In button on pinterest.com/login — **NOT-OURS**

fails with extension OFF too — off: functional check failed

- URL: `https://www.pinterest.com/login/`
- Protected service under test: accounts.google.com (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"ready":true},"button":{"ok":false,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=382px&logo_alignment=left&click_listener=()%3D%3E%7BI","box":{"w":0,"h":0},"content":{"ok":true,"text":"Continue with Google"},"errorFrames":0}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":false,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=382px&logo_alignment=left&click_listener=()%3D%3E%7BI","box":{"w":0,"h":0},"content":{"ok":true,"text":"Continue with Google"},"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"ready":true},"button":{"ok":false,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=382px&logo_alignment=left&click_listener=()%3D%3E%7BI","box":{"w":0,"h":0},"content":{"ok":true,"text":"Continue with Google"},"errorFrames":0}},"error":null})
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 22. YouTube iframe embed (fixture) — **PASS**

- URL: `http://127.0.0.1:55735/third-party-embeds.html?e=youtube`
- Protected service under test: youtube.com (COOKIE_BLOCK_ONLY — cookie-strip, never block)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.63M subscribers Watch on"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.63M subscribers Watch on"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://static.doubleclick.net/instream/ad_status.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: www.youtube.com

### 23. Google Maps embed, www.google.com/maps/embed (fixture) — **NOT-OURS**

fails with extension OFF too — off: functional check failed

- URL: `http://127.0.0.1:55735/third-party-embeds.html?e=maps`
- Protected service under test: www.google.com (carved out of a learned google.com, D50)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"map":{"ok":false,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":false,"images":1,"text":""},"errorFrames":0}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":false,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":false,"images":1,"text":""},"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"map":{"ok":false,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":false,"images":1,"text":""},"errorFrames":0}},"error":null})
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 24. Google Maps embed via maps.google.com (fixture) — **NOT-OURS**

fails with extension OFF too — off: functional check failed

- URL: `http://127.0.0.1:55735/third-party-embeds.html?e=maps-legacy`
- Protected service under test: maps.google.com (COOKIE_BLOCK_ONLY) → www.google.com/maps/embed
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"map":{"ok":false,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":false,"images":1,"text":""},"errorFrames":0}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":false,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":false,"images":1,"text":""},"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"map":{"ok":false,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":false,"images":1,"text":""},"errorFrames":0}},"error":null})
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: maps.google.com

### 25. Google Calendar public embed (fixture) — **PASS**

- URL: `http://127.0.0.1:55735/third-party-embeds.html?e=calendar`
- Protected service under test: calendar.google.com — google.com is COOKIE_BLOCK_ONLY since D50
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1713,"title":"Holidays in United States","text":"Today Monday, September 28 Previous month Next month Septemb"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1713,"title":"Holidays in United States","text":"Today Monday, September 28 Previous month Next month Septemb"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: calendar.google.com

### 26. Facebook JS SDK + Page plugin (fixture) — **PASS**

- URL: `http://127.0.0.1:55735/third-party-embeds.html?e=facebook`
- Protected service under test: facebook.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfe34b808","box":{"w":340,"h":500},"content":{"ok":true,"text":"Facebook 154,702,359 followers Follow Page Share Facebook 7 "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df54a822e","box":{"w":340,"h":500},"content":{"ok":true,"text":"Facebook 154,702,359 followers Follow Page Share Facebook 7 "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 27. X / Twitter embedded post (fixture) — **PASS**

- URL: `http://127.0.0.1:55735/third-party-embeds.html?e=tweet`
- Protected service under test: twitter.com / x.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 2 cookie-strip
  - cookie-stripped hosts: platform.twitter.com

### 28. microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com) — **PASS**

- URL: `https://www.microsoft.com/en-us`
- Protected service under test: www.microsoft.com receiving its own login hand-off — excludedInitiatorDomains (same company, D52)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"handoff":{"method":"POST","status":302,"failed":null},"landed":true,"errorFrames":0,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → 302","GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=None → 200"]}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"handoff":{"method":"POST","status":302,"failed":null},"landed":true,"errorFrames":0,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → 302","GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=None → 200"]}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.clarity.ms/tag/rcwvv0hsnp`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

## Every Nullecho console line seen this run (verbatim)

_None captured this run._
