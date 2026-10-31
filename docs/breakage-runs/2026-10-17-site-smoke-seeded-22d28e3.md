# Nullecho pre-release site smoke — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `8c269acb8e098e0d257733b13165e465b9ea11d4042142c32463f0257bd11195`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `22d28e3` (ext/ and harness/ clean)
- **Runtime:** 1414s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** yes — no chrome-extension:// target
- **ON browser really ON:** yes — chrome-extension://miadogabifgkfdhonoopldnjmdflebdj/src/background.js
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:52389` serving `harness/fixtures/third-party-embeds.html`

## Seeded learned state — and the positive control that proves it was live

Written from the extension's service worker into `chrome.storage.local["nullecho:heuristics:v1"]` (key read from the loaded heuristics.js), then the extension (`miadogabifgkfdhonoopldnjmdflebdj`) was **reloaded** via CDP `Extensions.loadUnpacked` on the same path — the reload arrow / an update — so the shipped `install()` + `onInstalled` ran the shipped `reconcile()`. The harness wrote no DNR rule.

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
| enforcement + recorder: a fetch from http://127.0.0.1:52389 to www.linkedin.com matched learned rule 1050002 and the recorder saw it (fetch loaded; 1 hit(s)) | ✅ |

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

## Shopping lab — the breakage lab for `rules/personalization.json`

35 pages × 1 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://miadogabifgkfdhonoopldnjmdflebdj/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 29 | gymshark.com product | Dynamic Yield (consent-gated), mParticle | **NOT-OURS** | 26.00 = 26.00 | 26.00 = 26.00 | — = — | ✗ / ✗ | 60 / 60 | — | 0 | 0 |
| 30 | jetblue.com home (Dynamic Yield content) | Dynamic Yield (render hosts: cookie-strip only) | **PASS** | — = — | — = — | — = — | · / · | · / · | 6000×3 | 3 | 0 |
| 31 | llbean.com product | Dynamic Yield | **NOT-OURS** | 150.00 = 150.00 | 150.00 = 150.00 | — = — | ✗ / ✗ | 138 / 138 | 6000×10 | 10 | 2 |
| 32 | harborfreight.com product | Dynamic Yield (collection + render) | **NOT-OURS** | 59.99 = 59.99 | 59.99 = 59.99 | — = — | ✗ / ✗ | W / W | 6000×30 | 30 | 3 |
| 33 | gap.com product | Rokt/mParticle, Granify, Attentive, Bluecore | **NOT-OURS** | 89.95 = 89.95 | 89.95 = 89.95 | — = — | ✗ / ✗ | 8 / 8 | — | 0 | 1 |
| 34 | staples.com product | Bloomreach, Rokt, Attentive | **PASS** | 49.99 = 49.99 | 49.99 = 49.99 | — = — | ✗ / ✓ | 9 / 8 | — | 0 | 1 |
| 35 | sephora.com product | Rokt/mParticle, Bluecore, Constructor beacon | **PASS** | 16.00/25.00 = 16.00/25.00 | — = — | — = — | ✓ / ✓ | 6 / 6 | 6200×7 | 3 | 1 |
| 36 | officedepot.com product | Bloomreach | **NOT-OURS** | 48.99 = 48.99 | 48.99 = 48.99 | — = — | ✗ / ✗ | 0 / 0 | — | 0 | 3 |
| 37 | allbirds.com product | Attentive | **PASS** | 100.00 = 100.00 | — = — | — = — | ✗ / ✓ | 88 / 89 | 6300×3 | 2 | 1 |
| 38 | target.com product | Attentive | **NOT-OURS** | — = — | 119.99 = 119.99 | — = — | ✗ / ✗ | 0 / 0 | — | 0 | 1 |
| 39 | petsmart.com product | Granify | **NOT-OURS** | 16.98/24.99 = 16.98/24.99 | 24.99 = 24.99 | — = — | ✗ / ✗ | 40 / 40 | 6500×2 | 1 | 3 |
| 40 | jcpenney.com product | Attentive, Constructor | **NOT-OURS** | 29.59 = 29.59 | — = — | — = — | ✗ / ✗ | 72 / 60 | — | 0 | 1 |
| 41 | bathandbodyworks.com product | Attentive, Monetate (not blocked), Einstein recs (not blocked) | **NOT-OURS** | **— → 24.95** | — = — | — = — | ✗ / ✗ | W / W | — | 0 | 3 |
| 42 | instacart.com home | Rokt | **PASS** | — = — | — = — | — = — | · / · | · / · | — | 0 | 0 |
| 43 | drsquatch.com product (Klaviyo) | Klaviyo, Constructor beacon | **PASS** | 7.00/55.00 = 7.00/55.00 | 7.00 = 7.00 | — = — | ✓ / ✓ | 24 / 24 | 6950×10 | 5 | 3 |
| 44 | beardbrand.com product (Klaviyo) | Klaviyo | **PASS** | 29.00/39.00 = 29.00/39.00 | 29.00 = 29.00 | 26.10 = 26.10 | ✓ / ✓ | 25 / 25 | 6950×8 | 4 | 0 |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems | **NOT-OURS** | 3.20/8.00 = 3.20/8.00 | — = — | — = — | ✗ / ✗ | 221 / 221 | 6900×15 6950×10 6952×2 | 16 | 0 |
| 46 | colourpop.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems, Attentive, Nosto | **PASS** | 24.00 = 24.00 | — = — | — = — | ✗ / ✓ | 51 / 54 | 6300×4 6704×1 6900×17 6950×9 | 17 | 3 |
| 47 | rothys.com product (Intelligems) | Intelligems, Attentive, Constructor | **NOT-OURS** | 109.00/125.00 = 109.00/125.00 | 109.00 = 109.00 | — = — | ✗ / ✗ | 2 / 2 | 6300×1 6900×3 | 4 | 3 |
| 48 | brooklinen.com product | Dynamic Yield, Attentive | **PASS** | 127.20/159.00 = 127.20/159.00 | 159.00 = 159.00 | 159.00 = 159.00 | ✓ / ✓ | 179 / 179 | 6300×1 | 1 | 2 |
| 49 | walmart.com product | — | **FAIL** | **149.99 → 173.99** | **149.99 → 173.99** | — = — | ✓ / ✓ | W / W | — | 0 | 2 |
| 50 | bestbuy.com product | — | **ERROR** |  =  |  =  |  =  | · / · |  /  | — | — | 0 |
| 51 | ikea.com product | — | **NOT-OURS** | 16.99 = 16.99 | — = — | — = — | ✗ / ✗ | 32 / 32 | — | 0 | 1 |
| 52 | nike.com product | — | **NOT-OURS** | 115.00 = 115.00 | 115.00 = 115.00 | — = — | ✗ / ✗ | 144 / 144 | — | 0 | 0 |
| 53 | zappos.com product | — | **NOT-OURS** | 37.50/60.00/65.00/70.00/75.00/80.00/99.95 = 37.50/60.00/65.00/70.00/75.00/80.00/99.95 | — = — | — = — | ✗ / ✗ | 110 / 110 | — | 0 | 0 |
| 54 | ulta.com product | — | **NOT-OURS** | 13.99 = 13.99 | 13.99 = 13.99 | — = — | ✗ / ✗ | 74 / 73 | — | 0 | 1 |
| 55 | apple.com Buy iPad (many offers) | — | **PASS** | 449.00/549.00/599.00/699.00/749.00/899.00 = 449.00/549.00/599.00/699.00/749.00/899.00 | — = — | — = — | · / · | · / · | — | 0 | 0 |
| 56 | dell.com product | — | **PASS** | 799.99 = 799.99 | — = — | — = — | · / · | · / · | — | 0 | 1 |
| 57 | awaytravel.com product | — | **NOT-OURS** | 295.00 = 295.00 | — = — | — = — | ✗ / ✗ | · / · | — | 0 | 0 |
| 58 | costco.com bath towels | — | **PASS** | — = — | 26.99 = 26.99 | — = — | · / · | 25 / 25 | — | 0 | 4 |
| 59 | lowes.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 0 |
| 60 | homedepot.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | 0 | 1 |
| 61 | kohls.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 0 |
| 62 | macys.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 1 |
| 63 | price positive control (fixture, client-side price test) | fixture price-test script | **PASS** | 15.00 = 15.00 | 15.00 = 15.00 | — = — | ✓ / ✓ | · / · | — | 0 | 0 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 16 NOT-OURS, 13 PASS, 1 FAIL, 1 ERROR, 4 BLOCKED

### Every price difference in every pair — including noise

- 49. walmart.com product: r1: DECLARED PRICE DIFFERS: OFF 149.99 vs ON 173.99
- 49. walmart.com product: r1: RENDERED PRICE DIFFERS: OFF 149.99 vs ON 173.99

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 50. bestbuy.com product: r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **29. gymshark.com product** (1 blocked-resource line(s))
- **30. jetblue.com home (Dynamic Yield content)** (1 blocked-resource line(s))
- **31. llbean.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Uncaught (in promise) Error: timeout`
- **32. harborfreight.com product** (1 blocked-resource line(s)):
  - `console: Response not successful: Received status code #`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **33. gap.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **34. staples.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **35. sephora.com product** (1 blocked-resource line(s)):
  - `console: #-10-17 11:51:42,# [URL: /product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P#] [template: Product/ProductPage] [wrapComponentRender.js] [component`
- **36. officedepot.com product** (1 blocked-resource line(s)):
  - `uncaught: Failed to fetch`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error getting ECID: Error: Timeout waiting for condition`
- **37. allbirds.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **38. target.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **39. petsmart.com product** (1 blocked-resource line(s)):
  - `console: [OPTIMIZELY] - ERROR #-10-17T18:54:05.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [OPTIMIZELY] - ERROR #-10-17T18:54:35.#Z OPTIMIZELY: Optimizely object is not valid. Failing decideAll.`
- **40. jcpenney.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **41. bathandbodyworks.com product** (1 blocked-resource line(s)):
  - `console: Failed to load resource: the server responded with a status of # ()`
  - `uncaught: TRPCClientError: Unable to transform response from server`
  - `uncaught: Cannot read properties of undefined (reading 'view')`
- **43. drsquatch.com product (Klaviyo)** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://alocdn.com/c/9rgi64bf/a/xtarget/p.json' from origin 'https://www.drsquatch.com' has been blocked by CORS policy: No 'Access`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `uncaught: Unhandled Promise Rejection: Failed to fetch`
- **44. beardbrand.com product (Klaviyo)** (1 blocked-resource line(s))
- **45. puravidabracelets.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s))
- **46. colourpop.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `uncaught: Failed to fetch r.fetch (https://colourpop.com/web-pixels@9f5e#wb#ap#c42m93b2bec3/web-pixel-#@#d5a2ef62c#e49fd58dba0/sandbox/worker.modern.js:1:#)`
  - `console: Error in createApiClient Previous request aborted`
- **47. rothys.com product (Intelligems)** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Cannot read properties of undefined (reading 'init')`
  - `uncaught: Unhandled Promise Rejection: igData does not exist. Intelligems may not have loaded.`
- **48. brooklinen.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Access to fetch at 'https://server.telemetry.services.yofi.ai/v3/sessions' from origin 'https://www.brooklinen.com' has been blocked by CORS policy: No`
- **49. walmart.com product** (1 blocked-resource line(s)):
  - `uncaught: undefined is not iterable (cannot read property Symbol(Symbol.iterator)) Array.from (<anonymous>) https://www.walmart.com/ip/AirPods-Pro-2nd-generatio`
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **51. ikea.com product** (1 blocked-resource line(s)):
  - `console: Error: Failed to read store opening status: Error: getCurrentStoreStatus requires the store picker to be enabled`
- **52. nike.com product** (1 blocked-resource line(s))
- **53. zappos.com product** (1 blocked-resource line(s))
- **54. ulta.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **56. dell.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **57. awaytravel.com product** (1 blocked-resource line(s))
- **58. costco.com bath towels** (1 blocked-resource line(s)):
  - `console: Error fetching Criteo Data for viewCategory on desktop: Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error loading search page adset Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error loading search page data Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error fetching Criteo Data for viewSearchResults on desktop: Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
- **60. homedepot.com search** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **62. macys.com search** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`

### Every pair

#### 29. gymshark.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22`

- r1 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links
- r1 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 30. jetblue.com home (Dynamic Yield content) — **PASS**

`https://www.jetblue.com/`

- r1 **OFF** — http 200 · vendor-rendered elements 4
- r1 **ON** — http 200 · vendor-rendered elements 4 · personalization matches 3 [6000 async-px.dynamicyield.com] · tab tally (url) total 5, personalization 3

#### 31. llbean.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.llbean.com/llb/shop/129613`

- r1 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links
- r1 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links · personalization matches 10 [6000 async-px.dynamicyield.com] · tab tally (url) total 11, personalization 10

#### 32. harborfreight.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.harborfreight.com/20v-cordless-12-in-drilldriver-kit-with-2-ah-battery-and-charger-73216.html`

- r1 **OFF** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("59 dollars and 99 cents $59 . 99") · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("59 dollars and 99 cents $59 . 99") · cart ✗ no evidence · search WALLED · personalization matches 30 [6000 async-px.dynamicyield.com] · tab tally (url) total 32, personalization 30

#### 33. gap.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.gap.com/browse/product.do?pid=403540002&vid=REGULAR`

- r1 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 12, personalization 0

#### 34. staples.com product — **PASS**

`https://www.staples.com/hammermill-copy-plus-8-5-x-11-copy-paper-20-lbs-92-brightness-5000-sheets-carton-105007/product_122374`

- r1 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✗ no evidence · search 9 links
- r1 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1 · search 8 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 35. sephora.com product — **PASS**

`https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799?skuId=2837425`

- r1 **OFF** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links
- r1 **ON** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links · personalization matches 7 [6200 apps.rokt-api.com] · tab tally (url) total 9, personalization 3

#### 36. officedepot.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links

`https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/`

- r1 **OFF** — http 200 · declared 48.99 USD (json-ld) · rendered 48.99 ("$48.99") · cart ✗ no evidence · search 0 links
- r1 **ON** — http 200 · declared 48.99 USD (json-ld) · rendered 48.99 ("$48.99") · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 29, personalization 0

#### 37. allbirds.com product — **PASS**

`https://www.allbirds.com/products/mens-tree-runners`

- r1 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✗ no evidence (picked 8) · search 88 links
- r1 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 89 links · personalization matches 3 [6300 cdn.attn.tv] · tab tally (url) total 6, personalization 2

#### 38. target.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links

`https://www.target.com/p/delilah-home-100-organic-cotton-bath-towel-collection/-/A-93159262?preselect=93048164`

- r1 **OFF** — http 200 · rendered 119.99 ("$119.99 reg $190.00 $70.01 off") · cart ✗ no evidence · search 0 links
- r1 **ON** — http 200 · rendered 119.99 ("$119.99") · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 39. petsmart.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.petsmart.com/dog/food/dry-food/pedigree-grilled-steak-and-vegetable-flavor-dry-dog-food-70826.html`

- r1 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links
- r1 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1

#### 40. jcpenney.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.jcpenney.com/p/worthington-womens-modern-perfect-trouser/ppr5008151662`

- r1 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 72 links
- r1 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 41. bathandbodyworks.com product — **NOT-OURS** — fails with the extension OFF too — off: no declared or rendered price read; add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.bathandbodyworks.com/p/champagne-toast-3-wick-candle-028029548`

- r1 **OFF** — http 200 · cart ✗ no visible, enabled add-to-cart control · search WALLED
- r1 **ON** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 42. instacart.com home — **PASS**

`https://www.instacart.com/`

- r1 **OFF** — http 200
- r1 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 43. drsquatch.com product (Klaviyo) — **PASS**

`https://www.drsquatch.com/products/mountain-meadow`

- r1 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r1 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 20, personalization 5

#### 44. beardbrand.com product (Klaviyo) — **PASS**

`https://www.beardbrand.com/products/tree-ranger-beard-oil`

- r1 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r1 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 6, personalization 4

#### 45. puravidabracelets.com product (Klaviyo, Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.puravidabracelets.com/products/solid-original?variant=40140395479126`

- r1 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r1 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 27 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 25, personalization 16

#### 46. colourpop.com product (Klaviyo, Intelligems) — **PASS**

`https://colourpop.com/products/eeveelution-shadow-palette`

- r1 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✗ no evidence · search 51 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r1 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 31 [6900 api.intelligems.io, 6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com, 6704 connect.nosto.com] · tab tally (url) total 24, personalization 17

#### 47. rothys.com product (Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://rothys.com/products/womens-pointed-toe-flat-black`

- r1 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r1 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 4 [6900 api.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 33, personalization 4

#### 48. brooklinen.com product — **PASS**

`https://www.brooklinen.com/products/classic-core-sheet-set?variant=41405018112090`

- r1 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 0→1 total 159.00 · search 179 links
- r1 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 0→1 total 159.00 · search 179 links · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 12, personalization 1

#### 49. walmart.com product — **FAIL** — ON read a price OFF never read: 173.99, 173.99 — r1: DECLARED PRICE DIFFERS: OFF 149.99 vs ON 173.99 \| r1: RENDERED PRICE DIFFERS: OFF 149.99 vs ON 173.99

`https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121`

- r1 **OFF** — http 200 · declared 149.99  (microdata) · rendered 149.99 ("Now $149.99") · cart ✓ cart badge 0→1 · search WALLED
- r1 **ON** — http 200 · declared 173.99  (microdata) · rendered 173.99 ("Now $173.99") · cart ✓ cart badge 0→1 · search WALLED · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm 
- r2 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm  · personalization matches 0

#### 50. bestbuy.com product — **ERROR** — no pair finished on both sides — r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro

`https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-earbuds-with-hearing-aid-feature-white/JJGCQ88C8X`

- r1 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea
- r1 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea · personalization matches 0

#### 51. ikea.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ikea.com/us/en/p/lack-side-table-white-30449908/`

- r1 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r1 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 19, personalization 0

#### 52. nike.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111`

- r1 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 144 links
- r1 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 144 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 53. zappos.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.zappos.com/p/converse-chuck-taylor-all-star-high-top-sneaker-black/product/107999/color/3`

- r1 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00/99.95 USD (json-ld-set(7)) · cart ✗ no evidence · search 110 links
- r1 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00/99.95 USD (json-ld-set(7)) · cart ✗ no evidence · search 110 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 54. ulta.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ulta.com/p/lash-sensational-sky-high-mascara-pimprod2020260?sku=2574523`

- r1 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 74 links
- r1 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 73 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 55. apple.com Buy iPad (many offers) — **PASS**

`https://www.apple.com/shop/buy-ipad/ipad`

- r1 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r1 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 56. dell.com product — **PASS**

`https://www.dell.com/en-us/shop/laptop-computers/spd/xps13dx13260`

- r1 **OFF** — http 200 · declared 799.99 USD (json-ld)
- r1 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 57. awaytravel.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.awaytravel.com/suitcases/bigger-carry-on`

- r1 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence
- r1 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 5, personalization 0

#### 58. costco.com bath towels — **PASS**

`https://www.costco.com/bath-towels.html`

- r1 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r1 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 59. lowes.com search — **BLOCKED** — HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this server.

Reference #18.a0ed217.1792263865.6d8c3035

https://errors.edgesuite.net/18.a0ed217.1792263865.6d8c3035

`https://www.lowes.com/search?searchTerm=hammer`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv
- r1 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv · personalization matches 0

#### 60. homedepot.com search — **BLOCKED** — HTTP 403 — Error Page — #1 Home Improvement Retailer
Oops!! Something went wrong. Please refresh page
Refresh
How doers get more done™
Need Help? Visit our Customer Service Center

`https://www.homedepot.com/s/hammer`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Error Page — #1 Home Improvement Retailer
Oops!! Something went wrong. Please refresh page
Refresh
How doers 
- r1 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 61. kohls.com search — **BLOCKED** — HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this server.

Reference #18.210ed217.1792263894.5718f898

https://errors.edgesuite.net/18.210ed217.1792263894.5718f898

`https://www.kohls.com/search.jsp?search=towel`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this 
- r1 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this  · personalization matches 0

#### 62. macys.com search — **BLOCKED** — challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe this is an error, try updating your browser and refreshing the page. If the problem continues, call us at 1‑800‑289‑8229 for assistance. Reference: 0.

`https://www.macys.com/shop/featured/towel`

- r1 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe 
- r1 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe  · personalization matches 0

#### 63. price positive control (fixture, client-side price test) — **PASS**

`null`

- r1 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r1 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0

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
| 26 | Facebook JS SDK + Page plugin (fixture) | PASS | PASS | **PASS** |  |
| 27 | X / Twitter embedded post (fixture) | PASS | PASS | **PASS** |  |
| 28 | microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com) | PASS | PASS | **PASS** |  |
| 29 | gymshark.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 30 | jetblue.com home (Dynamic Yield content) | PASS | PASS | **PASS** |  |
| 31 | llbean.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 32 | harborfreight.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 33 | gap.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 34 | staples.com product | PASS | FAIL | **PASS** |  |
| 35 | sephora.com product | PASS | PASS | **PASS** |  |
| 36 | officedepot.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links |
| 37 | allbirds.com product | PASS | FAIL | **PASS** |  |
| 38 | target.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links |
| 39 | petsmart.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 40 | jcpenney.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 41 | bathandbodyworks.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: no declared or rendered price read; add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 42 | instacart.com home | PASS | PASS | **PASS** |  |
| 43 | drsquatch.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 44 | beardbrand.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 46 | colourpop.com product (Klaviyo, Intelligems) | PASS | FAIL | **PASS** |  |
| 47 | rothys.com product (Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 48 | brooklinen.com product | PASS | PASS | **PASS** |  |
| 49 | walmart.com product | PASS | PASS | **FAIL** | ON read a price OFF never read: 173.99, 173.99 — r1: DECLARED PRICE DIFFERS: OFF 149.99 vs ON 173.99 \| r1: RENDERED PRICE DIFFERS: OFF 149.99 vs ON 173.99 |
| 50 | bestbuy.com product | FAIL | FAIL | **ERROR** | no pair finished on both sides — r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https: |
| 51 | ikea.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 52 | nike.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 53 | zappos.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 54 | ulta.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 55 | apple.com Buy iPad (many offers) | PASS | PASS | **PASS** |  |
| 56 | dell.com product | PASS | PASS | **PASS** |  |
| 57 | awaytravel.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 58 | costco.com bath towels | PASS | PASS | **PASS** |  |
| 59 | lowes.com search | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this server.

Reference #18.a0ed217.1792263865.6d |
| 60 | homedepot.com search | FAIL | BLOCKED | **BLOCKED** | HTTP 403 — Error Page — #1 Home Improvement Retailer
Oops!! Something went wrong. Please refresh page
Refresh
How doers get more done™
Need Help? Visit our Cust |
| 61 | kohls.com search | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this server.

Reference #18.210ed217.17922638 |
| 62 | macys.com search | BLOCKED | BLOCKED | **BLOCKED** | challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe this is an error, try updating your brow |
| 63 | price positive control (fixture, client-side price test) | PASS | PASS | **PASS** |  |

**Totals:** 40 PASS, 5 BLOCKED, 16 NOT-OURS, 1 FAIL, 1 ERROR

## D50 invariant over all traffic — learned BLOCKs on protected hosts: 0

Every learned-rule block recorded in any row, checked against the current NEVER_BLOCK + COOKIE_BLOCK_ONLY lists (path-scoped entries by host+path). Any hit is a FAIL for its row even if the row's own check passed.

_None._

## Per-site detail

### 1. example.com — **PASS**

- URL: `https://example.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"title":"Example Domain"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"title":"Example Domain"}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 2. open.spotify.com — **PASS**

- URL: `https://open.spotify.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=undefined cores=8 mem=16`, detail: `{"bodyLen":2436}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"bodyLen":2436}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.googletagmanager.com/gtm.js?id=GTM-PZHN3VD`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 3. google.com/recaptcha/api2/demo — **PASS**

- URL: `https://www.google.com/recaptcha/api2/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"box":{"w":304,"h":78}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":304,"h":78}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

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
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"resultCount":22}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"resultCount":22}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (5): `fetch https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?_=1607460946161`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR3Ey-7KW8zj1aP832TnVfFthbv8Wtph9nmHSr5PWWuEf6KsiH8gX5TxdrBO3qPgd2sx6nyLhhS68UwRAOVcbt07jTqiUSBlVOBwhGwf9Qtwl5mcs6Jw0LTa7bbz7HtDUaEa`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnRwwdgc_z_1G5AMUj8yP_UC5ybrQIsb59nmHSr5PWWuEf6KsiH8gX5SNuxhS-jqgr7poMhGbsvhudWzdTPWEbt07jTqiUSRlVPhwrFgv-Rdgs7G4m6Jw1LTa7bLz_HNPcY06`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnRwwdgc_z_1G5AMUj8yP_UC5ybrQIsb59nmHSr5PWWuEf6KsiFMgX5X5CuyCo2rU__c8bwHPBtAiuTg4gOFcbt07jTqiUSRlVPhwrFgv-Rdgs7G4m6Jw1LTa7bLz_HNPcY06`, `document https://s.amazon-adsystem.com/iu3?d=amazon.com&slot=navFooter&a2=0101a9a99c11dc467dcddd4e846ca192e50abe8f223828cd07e277fa85db9acc58fa&old_oo=0&ts=1792262783163&s=AYgt5Nb4lm2nU382eOuONRfll2C3EY3tzOI-3J`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 7. google.com/maps — **PASS**

- URL: `https://www.google.com/maps/@35.6225,-117.6709,12z`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://tpc.googlesyndication.com/simgad/12443843956218829127?w=40&h=40`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 8. openstreetmap.org — **PASS**

- URL: `https://www.openstreetmap.org/#map=12/35.6225/-117.6709`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"total":24,"loaded":24}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"total":24,"loaded":24}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 9. youtube.com/watch?v=jNQXAC9IVRw — **PASS**

- URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"from":1.54975,"currentTime":10.552226,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"from":1.55316,"currentTime":10.556031,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (6): `script https://static.doubleclick.net/instream/ad_status.js`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://static.doubleclick.net/instream/ad_status.js`, `fetch https://googleads.g.doubleclick.net/pagead/viewthroughconversion/962985656/?backend=innertube&cname=1&cver=2_20261016&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20261016%3Bptype%3Df_view%3Btype%3`, `xhr https://googleads.g.doubleclick.net/pagead/id`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 10. chartjs.org vertical bar sample — **PASS**

- URL: `https://www.chartjs.org/docs/latest/samples/bar/vertical.html`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"w":800,"h":400,"nonTransparentPixels":78049}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"w":800,"h":400,"nonTransparentPixels":53781}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.google-analytics.com/analytics.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 11. nytimes.com — **BLOCKED**

HTTP 403 — nytimes.com —

- URL: `https://www.nytimes.com/`
- **ON** — http 403, visibility `null`, probes: `gpc=true cores=10 mem=32`, detail: `{}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"home":true,"articleHref":"https://www.nytimes.com/interactive/2025/movies/best-movies-21st-century.html","httpStatus":403}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 12. squoosh.app — **PASS**

- URL: `https://squoosh.app/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`
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
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"postCount":54}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"postCount":54}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.googletagmanager.com/gtag/js?id=AW-788729857`, `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 15. reCAPTCHA v2 on patrickhlauke.github.io — **PASS**

- URL: `https://patrickhlauke.github.io/recaptcha/`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=4EDjxXf","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=4EDjxXf","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 16. reCAPTCHA v2 on ascendpartner.com signup — **PASS**

- URL: `https://www.ascendpartner.com/affiliate/registration?usertype=2`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=4EDjxXf4kns","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=4EDjxXf4kns","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 17. reCAPTCHA Enterprise (invisible) on reddit.com/login — **PASS**

- URL: `https://www.reddit.com/login/`
- Protected service under test: www.google.com/recaptcha/enterprise (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=4EDjxXf4knsx6","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=4EDjxXf4knsx6","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://id.rlcdn.com/472486.gif`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 18. Cloudflare Turnstile on peet.ws — **PASS**

- URL: `https://peet.ws/turnstile-test/non-interactive.html`
- Protected service under test: challenges.cloudflare.com (NEVER_BLOCK) under a learned cloudflare.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/kl2j8/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/5q40l/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 19. hCaptcha on democaptcha.com — **PASS**

- URL: `https://democaptcha.com/demo-form-eng/hcaptcha.html`
- Protected service under test: hcaptcha.com (NEVER_BLOCK; no seeded domain covers it — a CONTROL row: it must pass in every mode)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/86591f996c36877668d253e353e36fac021db33b/static/hcaptcha.html#frame=checkbox&id=0984rsivlxu&host=democaptcha.com&sentr","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/86591f996c36877668d253e353e36fac021db33b/static/hcaptcha.html#frame=checkbox&id=07quwe90j0mc&host=democaptcha.com&sent","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
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
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=390px&logo_alignment=left&click_listener=()%3D%3E%7Ba","box":{"w":410,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=390px&logo_alignment=left&click_listener=()%3D%3E%7Ba","box":{"w":410,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 22. YouTube iframe embed (fixture) — **PASS**

- URL: `http://127.0.0.1:52389/third-party-embeds.html?e=youtube`
- Protected service under test: youtube.com (COOKIE_BLOCK_ONLY — cookie-strip, never block)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.7M subscribers Watch on"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.7M subscribers Watch on"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://static.doubleclick.net/instream/ad_status.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: www.youtube.com

### 23. Google Maps embed, www.google.com/maps/embed (fixture) — **PASS**

- URL: `http://127.0.0.1:52389/third-party-embeds.html?e=maps`
- Protected service under test: www.google.com (carved out of a learned google.com, D50)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":true,"images":42,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":true,"images":42,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 24. Google Maps embed via maps.google.com (fixture) — **PASS**

- URL: `http://127.0.0.1:52389/third-party-embeds.html?e=maps-legacy`
- Protected service under test: maps.google.com (COOKIE_BLOCK_ONLY) → www.google.com/maps/embed
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":true,"images":39,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":true,"images":39,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: maps.google.com

### 25. Google Calendar public embed (fixture) — **PASS**

- URL: `http://127.0.0.1:52389/third-party-embeds.html?e=calendar`
- Protected service under test: calendar.google.com — google.com is COOKIE_BLOCK_ONLY since D50
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1748,"title":"Holidays in United States","text":"Today Saturday, October 17 Previous month Next month October"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1748,"title":"Holidays in United States","text":"Today Saturday, October 17 Previous month Next month October"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 1 cookie-strip
  - cookie-stripped hosts: calendar.google.com

### 26. Facebook JS SDK + Page plugin (fixture) — **PASS**

- URL: `http://127.0.0.1:52389/third-party-embeds.html?e=facebook`
- Protected service under test: facebook.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfb2799fd","box":{"w":340,"h":131},"content":{"ok":true,"text":"Facebook 154,686,889 followers Follow Page Share"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df5b4dc69","box":{"w":340,"h":331},"content":{"ok":true,"text":"Facebook 154,686,889 followers Follow Page Share"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 27. X / Twitter embedded post (fixture) — **PASS**

- URL: `http://127.0.0.1:52389/third-party-embeds.html?e=tweet`
- Protected service under test: twitter.com / x.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 2 cookie-strip
  - cookie-stripped hosts: platform.twitter.com

### 28. microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com) — **PASS**

- URL: `https://www.microsoft.com/en-us`
- Protected service under test: www.microsoft.com receiving its own login hand-off — excludedInitiatorDomains (same company, D52)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"handoff":{"method":"POST","status":302,"failed":null},"landed":true,"errorFrames":0,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → 302","GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=None → 200"]}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"handoff":{"method":"POST","status":302,"failed":null},"landed":true,"errorFrames":0,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → 302","GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=None → 200"]}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.clarity.ms/tag/rcwvv0hsnp`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

## Every Nullecho console line seen this run (verbatim)

- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- jcpenney.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- beardbrand.com product (Klaviyo) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- nike.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- nike.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- costco.com bath towels (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- costco.com bath towels (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
