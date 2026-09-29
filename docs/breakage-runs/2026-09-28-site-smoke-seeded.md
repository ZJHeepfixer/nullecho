# Nullecho pre-release site smoke — SEEDED learned state — 2026-09-28

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.0-chrome.zip`, sha256 `2e8f86563ea1b58c673c93e2cf729ff664ce95ea4b055de9f90c514ee1f2922d`, 243.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Runtime:** 392s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** yes — no chrome-extension:// target
- **ON browser really ON:** yes — chrome-extension://mpfppclnmhnbejgapjoeblggppmpkhba/src/background.js
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:54265` serving `harness/fixtures/third-party-embeds.html`

## Seeded learned state — and the positive control that proves it was live

Written from the extension's service worker into `chrome.storage.local["nullecho:heuristics:v1"]` (key read from the loaded heuristics.js), then the extension (`mpfppclnmhnbejgapjoeblggppmpkhba`) was **reloaded** via CDP `Extensions.loadUnpacked` on the same path — the reload arrow / an update — so the shipped `install()` + `onInstalled` ran the shipped `reconcile()`. The harness wrote no DNR rule.

Seeded, each as `{status: 'blocked', ruleId: <heuristic block range>, sites: 3 distinct, source: 'learned'}`: `google.com`, `youtube.com`, `facebook.com`, `microsoft.com`, `live.com`, `microsoftonline.com`, `apple.com`, `cloudflare.com`, `amazon.com`, `twitter.com`, `x.com`, `linkedin.com`.

| Positive-control assertion | Result |
|---|---|
| no learned-range rule existed before the reload (found 0) — so every rule below was written by the extension's reconcile(), not left over | ✅ |
| the reloaded extension still has its static blocking rulesets on (["gpc","ads","analytics","social","fingerprinting","ua-mac"]) — the seeded ON pass is the whole extension plus the learned rules, not a lesser one | ✅ |
| google.com: a live learned rule covers it (id 1050000, modifyHeaders) | ✅ |
| google.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050000) | ✅ |
| youtube.com: a live learned rule covers it (id 1050001, modifyHeaders) | ✅ |
| youtube.com: stored record is promoted and points at that live rule (status cookieblocked, ruleId 1050001) | ✅ |
| facebook.com: a live learned rule covers it (id 1000002, block) | ✅ |
| facebook.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000002) | ✅ |
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
| twitter.com: a live learned rule covers it (id 1000009, block) | ✅ |
| twitter.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000009) | ✅ |
| x.com: a live learned rule covers it (id 1000010, block) | ✅ |
| x.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000010) | ✅ |
| linkedin.com: a live learned rule covers it (id 1000011, block) | ✅ |
| linkedin.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000011) | ✅ |
| enforcement + recorder: a fetch from http://127.0.0.1:54265 to www.linkedin.com matched learned rule 1000011 and the recorder saw it (fetch failed: Failed to fetch; 1 hit(s)) | ✅ |

**Learned-range dynamic rules live after the reload** (`getDynamicRules()` from the new worker, 12 rules):

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

<details><summary>Raw JSON</summary>

```json
[
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "excludedRequestDomains": [
    "graph.facebook.com"
   ],
   "requestDomains": [
    "facebook.com"
   ]
  },
  "id": 1000002,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
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
   "requestDomains": [
    "amazon.com"
   ]
  },
  "id": 1000008,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "requestDomains": [
    "twitter.com"
   ]
  },
  "id": 1000009,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "requestDomains": [
    "x.com"
   ]
  },
  "id": 1000010,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "requestDomains": [
    "linkedin.com"
   ]
  },
  "id": 1000011,
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
   "excludedRequestDomains": [
    "accounts.google.com",
    "apis.google.com",
    "www.google.com"
   ],
   "requestDomains": [
    "google.com"
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
   "requestDomains": [
    "youtube.com"
   ]
  },
  "id": 1050001,
  "priority": 1
 }
]
```
</details>

Stored records after the reload: `{"amazon.com":{"status":"blocked","ruleId":1000008,"source":"learned"},"apple.com":{"status":"blocked","ruleId":1000006,"source":"learned"},"cloudflare.com":{"status":"blocked","ruleId":1000007,"source":"learned"},"facebook.com":{"status":"blocked","ruleId":1000002,"source":"learned"},"google.com":{"status":"cookieblocked","ruleId":1050000,"source":"learned"},"linkedin.com":{"status":"blocked","ruleId":1000011,"source":"learned"},"live.com":{"status":"blocked","ruleId":1000004,"source":"learned"},"microsoft.com":{"status":"blocked","ruleId":1000003,"source":"learned"},"microsoftonline.com":{"status":"blocked","ruleId":1000005,"source":"learned"},"twitter.com":{"status":"blocked","ruleId":1000009,"source":"learned"},"x.com":{"status":"blocked","ruleId":1000010,"source":"learned"},"youtube.com":{"status":"cookieblocked","ruleId":1050001,"source":"learned"}}`

Worker console during the reload: _empty_

Match recorder (`onRuleMatchedDebug` in the worker): `installed`.

Retry browser seeded the same way: positive control ✅ all (27/27), 12 learned rules live.

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
| 7 | google.com/maps | PASS | PASS | **PASS** |  |
| 8 | openstreetmap.org | PASS | PASS | **PASS** |  |
| 9 | youtube.com/watch?v=jNQXAC9IVRw | PASS | PASS | **PASS** |  |
| 10 | chartjs.org vertical bar sample | PASS | PASS | **PASS** |  |
| 11 | nytimes.com | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — nytimes.com — |
| 12 | squoosh.app | PASS | PASS | **PASS** |  |
| 13 | irs.gov site search "form 1040" | PASS | PASS | **PASS** |  |
| 14 | reddit.com/r/technology | PASS | PASS | **PASS** |  |
| 15 | reCAPTCHA v2 on patrickhlauke.github.io | PASS | PASS | **PASS** |  |
| 16 | reCAPTCHA v2 on ascendpartner.com signup | PASS | PASS | **PASS** |  |
| 17 | reCAPTCHA Enterprise (invisible) on reddit.com/login | PASS | PASS | **PASS** |  |
| 18 | Cloudflare Turnstile on peet.ws | PASS | PASS | **PASS** |  |
| 19 | hCaptcha on democaptcha.com | PASS | PASS | **PASS** |  |
| 20 | Google Sign-In button on reddit.com/login | PASS | PASS | **PASS** |  |
| 21 | Google Sign-In button on pinterest.com/login | PASS | PASS | **PASS** |  |
| 22 | YouTube iframe embed (fixture) | PASS | PASS | **PASS** |  |
| 23 | Google Maps embed, www.google.com/maps/embed (fixture) | PASS | PASS | **PASS** |  |
| 24 | Google Maps embed via maps.google.com (fixture) | PASS | PASS | **PASS** |  |
| 25 | Google Calendar public embed (fixture) | PASS | PASS | **PASS** |  |
| 26 | Facebook JS SDK + Page plugin (fixture) | FAIL | PASS | **POLICY-BLOCKED** | 1 learned-rule block(s): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fsta |
| 27 | X / Twitter embedded post (fixture) | FAIL | PASS | **POLICY-BLOCKED** | 1 learned-rule block(s): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js |

**Totals:** 24 PASS, 1 BLOCKED, 2 POLICY-BLOCKED

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
- **ON** — http 200, visibility `visible`, probes: `gpc=undefined cores=8 mem=8`, detail: `{"bodyLen":2370}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"bodyLen":2370}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.googletagmanager.com/gtm.js?id=GTM-PZHN3VD`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 3. google.com/recaptcha/api2/demo — **PASS**

- URL: `https://www.google.com/recaptcha/api2/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"box":{"w":304,"h":78}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":304,"h":78}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 4. accounts.hcaptcha.com/demo — **PASS**

- URL: `https://accounts.hcaptcha.com/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"box":{"w":302,"h":76}}`
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
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (5): `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR3FtrNe7uwqNQccomRLgelQmQqobjq59nmHSr5O4F7Ye8qsiFc8X5T8bvC-ou6ZmxKtZynzi6gSfJAd7LEcb40zjQ6iUSBlUOxwhEwrxRt0h5Gcs4JgqLDeybbr-G9TSaGW`, `fetch https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?_=1607460946161`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR2sf--yh5THyYM012RzKXCokT-YJvr59nmHSr5O4F7Ye8qsiHcgX5TAe2i2W2LUW4YUb3U_17wywSAglKWEbt07jXKiUSRlVPhwrFgv-Rdgs7G4m6Jw1LTa7bLz_HNPcY06`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR2sf--yh5THyYM012RzKXCokT-YJvr59nmHSr5O4F7Ye8qsiEsgX5RlHxTiFmYcV2M9iy0eSsRqrfCRBW3Ebt07jXKiUSRlVPhwrFgv-Rdgs7G4m6Jw1LTa7bLz_HNPcY06`, `document https://s.amazon-adsystem.com/iu3?d=amazon.com&slot=navFooter&a2=010196458c8bf347bc069a77e49522b0d4cb4749826f380cb792c7a23ef3a05ce4b3&old_oo=0&ts=1790650769021&s=AR2b4A5-4hQFkZplOryzGkpcoyfhMuT6ICLxyy`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 7. google.com/maps — **PASS**

- URL: `https://www.google.com/maps/@35.6225,-117.6709,12z`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://tpc.googlesyndication.com/simgad/12443843956218829127?w=40&h=40`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 8. openstreetmap.org — **PASS**

- URL: `https://www.openstreetmap.org/#map=12/35.6225/-117.6709`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"total":24,"loaded":24}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"total":24,"loaded":24}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 9. youtube.com/watch?v=jNQXAC9IVRw — **PASS**

- URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"from":1.50448,"currentTime":10.506243,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"from":1.564708,"currentTime":10.567702,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (5): `xhr https://googleads.g.doubleclick.net/pagead/id`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://static.doubleclick.net/instream/ad_status.js`, `fetch https://googleads.g.doubleclick.net/pagead/viewthroughconversion/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3`, `xhr https://googleads.g.doubleclick.net/pagead/id`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 10. chartjs.org vertical bar sample — **PASS**

- URL: `https://www.chartjs.org/docs/latest/samples/bar/vertical.html`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"w":800,"h":400,"nonTransparentPixels":55550}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"w":800,"h":400,"nonTransparentPixels":59825}`
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
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.google-analytics.com/analytics.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 13. irs.gov site search "form 1040" — **PASS**

- URL: `https://www.irs.gov/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.googletagmanager.com/gtm.js?id=GTM-KV978ZL`, `script https://www.googletagmanager.com/gtm.js?id=GTM-KV978ZL`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 14. reddit.com/r/technology — **PASS**

- URL: `https://www.reddit.com/r/technology/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"postCount":56}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"postCount":56}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (3): `script https://www.googletagmanager.com/gtag/js?id=AW-788729857`, `script https://www.googletagmanager.com/gtag/js?id=G-54605C74F5`, `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 15. reCAPTCHA v2 on patrickhlauke.github.io — **PASS**

- URL: `https://patrickhlauke.github.io/recaptcha/`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=kemdRjW","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=kemdRjW","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 16. reCAPTCHA v2 on ascendpartner.com signup — **PASS**

- URL: `https://www.ascendpartner.com/affiliate/registration?usertype=2`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=kemdRjWFxNj","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=kemdRjWFxNj","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 17. reCAPTCHA Enterprise (invisible) on reddit.com/login — **PASS**

- URL: `https://www.reddit.com/login/`
- Protected service under test: www.google.com/recaptcha/enterprise (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=kemdRjWFxNjgs","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=kemdRjWFxNjgs","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 18. Cloudflare Turnstile on peet.ws — **PASS**

- URL: `https://peet.ws/turnstile-test/non-interactive.html`
- Protected service under test: challenges.cloudflare.com (NEVER_BLOCK) under a learned cloudflare.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/2dahl/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/aw1r3/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 19. hCaptcha on democaptcha.com — **PASS**

- URL: `https://democaptcha.com/demo-form-eng/hcaptcha.html`
- Protected service under test: hcaptcha.com (NEVER_BLOCK; no seeded domain covers it — a CONTROL row: it must pass in every mode)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/b9ca2a6602c2bf69741b771db488f3001ea35b08/static/hcaptcha.html#frame=checkbox&id=03kpn8bdx75u&host=democaptcha.com&sent","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/b9ca2a6602c2bf69741b771db488f3001ea35b08/static/hcaptcha.html#frame=checkbox&id=08tulqsrep7&host=democaptcha.com&sentr","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 20. Google Sign-In button on reddit.com/login — **PASS**

- URL: `https://www.reddit.com/login/`
- Protected service under test: accounts.google.com (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?logo_alignment=left&size=large&shape=pill&text=continue_with&theme=outline&type=standard&width=368&click_listener=functio","box":{"w":388,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?logo_alignment=left&size=large&shape=pill&text=continue_with&theme=outline&type=standard&width=368&click_listener=functio","box":{"w":388,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 21. Google Sign-In button on pinterest.com/login — **PASS**

- URL: `https://www.pinterest.com/login/`
- Protected service under test: accounts.google.com (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=382px&logo_alignment=left&click_listener=()%3D%3E%7BI","box":{"w":402,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=382px&logo_alignment=left&click_listener=()%3D%3E%7BI","box":{"w":402,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 22. YouTube iframe embed (fixture) — **PASS**

- URL: `http://127.0.0.1:54265/third-party-embeds.html?e=youtube`
- Protected service under test: youtube.com (COOKIE_BLOCK_ONLY — cookie-strip, never block)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.63M subscribers Watch on"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.63M subscribers Watch on"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://static.doubleclick.net/instream/ad_status.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: www.youtube.com

### 23. Google Maps embed, www.google.com/maps/embed (fixture) — **PASS**

- URL: `http://127.0.0.1:54265/third-party-embeds.html?e=maps`
- Protected service under test: www.google.com (carved out of a learned google.com, D50)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":true,"images":42,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":true,"images":42,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 24. Google Maps embed via maps.google.com (fixture) — **PASS**

- URL: `http://127.0.0.1:54265/third-party-embeds.html?e=maps-legacy`
- Protected service under test: maps.google.com (COOKIE_BLOCK_ONLY) → www.google.com/maps/embed
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":true,"images":39,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":true,"images":39,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: maps.google.com

### 25. Google Calendar public embed (fixture) — **PASS**

- URL: `http://127.0.0.1:54265/third-party-embeds.html?e=calendar`
- Protected service under test: calendar.google.com — google.com is COOKIE_BLOCK_ONLY since D50
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1713,"title":"Holidays in United States","text":"Today Monday, September 28 Previous month Next month Septemb"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1713,"title":"Holidays in United States","text":"Today Monday, September 28 Previous month Next month Septemb"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: calendar.google.com
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 26. Facebook JS SDK + Page plugin (fixture) — **POLICY-BLOCKED**

1 learned-rule block(s): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df264c3213f28f25c0%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%

- URL: `http://127.0.0.1:54265/third-party-embeds.html?e=facebook`
- Protected service under test: NOTHING under facebook.com except graph.facebook.com — POLICY row — **POLICY row** (a learned block here is POLICY-BLOCKED, not FAIL)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790650859504,"ruleId":1000002,"type":"sub_frame","url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df7bf3912891c95ec5%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%","initiator":"http://127.0.0.1:54265"}],"recorderRestarted":false},"blockedByClient":["document https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df7bf3912891c95ec5%26domain%3D127.0.0.1%26is_canv"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dff7d91e1","box":{"w":340,"h":500},"content":{"ok":true,"text":"Facebook 154,690,177 followers Follow Page Share Facebook 6 "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df264c3213f28f25c0%26domain%3D127.0.0.1%26is_canv`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df264c3213f28f25c0%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%

### 27. X / Twitter embedded post (fixture) — **POLICY-BLOCKED**

1 learned-rule block(s): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js

- URL: `http://127.0.0.1:54265/third-party-embeds.html?e=tweet`
- Protected service under test: NOTHING under twitter.com — POLICY row — **POLICY row** (a learned block here is POLICY-BLOCKED, not FAIL)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"post":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"post":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790650877853,"ruleId":1000009,"type":"script","url":"https://platform.twitter.com/widgets.js","initiator":"http://127.0.0.1:54265"}],"recorderRestarted":false},"blockedByClient":["script https://platform.twitter.com/widgets.js"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://platform.twitter.com/widgets.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js

## Every Nullecho console line seen this run (verbatim)

- google.com/recaptcha/api2/demo (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- amazon.com (search "usb c cable") (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- youtube.com/watch?v=jNQXAC9IVRw (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- youtube.com/watch?v=jNQXAC9IVRw (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- reCAPTCHA v2 on patrickhlauke.github.io (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- reCAPTCHA v2 on ascendpartner.com signup (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- reCAPTCHA v2 on ascendpartner.com signup (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- reCAPTCHA Enterprise (invisible) on reddit.com/login (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- Google Calendar public embed (fixture) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
