# Nullecho pre-release site smoke — SEEDED learned state — ⚠ NEGATIVE CONTROL — 2026-09-28

> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The store zip below was unpacked and its `src/heuristics.js` + `src/allowlist.js` were replaced with `73b511b` (`73b511b`)'s copies (sha256 heuristics `59fba0765248b119…`, allowlist `6f29dae68e9522c6…`). It exists to prove the seeded rows FAIL on the code that broke reCAPTCHA; its FAILs are the point.

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.0-chrome.zip`, sha256 `0a5a58d6111aaaf48f1e1ad042c2229e9e96532c87b9f0337c8d828fd3d60ad4`, 247.5 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `956882e` (ext/ and harness/ clean)
- **Runtime:** 165s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** yes — no chrome-extension:// target
- **ON browser really ON:** yes — chrome-extension://fhbcbioeogchnaignkhebbobgapfbblg/src/background.js
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:63169` serving `harness/fixtures/third-party-embeds.html`

## Seeded learned state — and the positive control that proves it was live

Written from the extension's service worker into `chrome.storage.local["nullecho:heuristics:v1"]` (key read from the loaded heuristics.js), then the extension (`fhbcbioeogchnaignkhebbobgapfbblg`) was **reloaded** via CDP `Extensions.loadUnpacked` on the same path — the reload arrow / an update — so the shipped `install()` + `onInstalled` ran the shipped `reconcile()`. The harness wrote no DNR rule.

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
| enforcement + recorder: a fetch from http://127.0.0.1:63169 to www.linkedin.com matched learned rule 1000011 and the recorder saw it (fetch failed: Failed to fetch; 1 hit(s)) | ✅ |

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
| tp-msft-signin-handoff | ran on the fixture page with NO embed (`?e=none`) | check should report FAIL | FAILED (correct) | ✅ |

Detail: youtube {"from":0,"currentTime":0,"readyState":0,"buffered":0,"paused":false,"skipPlay":false}; maps {"ok":false,"error":"timeout after 15000ms: maps self-test"}

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 26 | Facebook JS SDK + Page plugin (fixture) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fsta |
| 27 | X / Twitter embedded post (fixture) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js |
| 28 | microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000003 (microsoft.com) BLOCKED sub_frame https://www.microsoft.com/cascadeauth/account/signin-oidc |

**Totals:** 3 FAIL

## D50 invariant over all traffic — learned BLOCKs on protected hosts: 2

Every learned-rule block recorded in any row, checked against the current NEVER_BLOCK + COOKIE_BLOCK_ONLY lists (path-scoped entries by host+path). Any hit is a FAIL for its row even if the row's own check passed.

- 26. Facebook JS SDK + Page plugin (fixture): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df982bb8b938eeaa7a%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin% — protected by COOKIE_BLOCK_ONLY: facebook.com
- 27. X / Twitter embedded post (fixture): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js — protected by COOKIE_BLOCK_ONLY: twitter.com

## Per-site detail

### 26. Facebook JS SDK + Page plugin (fixture) — **FAIL**

1 learned-rule block(s): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df982bb8b938eeaa7a%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%

- URL: `http://127.0.0.1:63169/third-party-embeds.html?e=facebook`
- Protected service under test: facebook.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790653273841,"ruleId":1000002,"type":"sub_frame","url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df860c3618986122ed%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%","initiator":"http://127.0.0.1:63169"}],"recorderRestarted":false},"blockedByClient":["document https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df860c3618986122ed%26domain%3D127.0.0.1%26is_canv"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df1ae5070","box":{"w":340,"h":500},"content":{"ok":true,"text":"Facebook 154,701,146 followers Follow Page Share Facebook 6 "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df982bb8b938eeaa7a%26domain%3D127.0.0.1%26is_canv`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Df982bb8b938eeaa7a%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%

### 27. X / Twitter embedded post (fixture) — **FAIL**

1 learned-rule block(s): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js

- URL: `http://127.0.0.1:63169/third-party-embeds.html?e=tweet`
- Protected service under test: twitter.com / x.com (COOKIE_BLOCK_ONLY since D52 — was a POLICY row until then)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"post":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"post":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790653292399,"ruleId":1000009,"type":"script","url":"https://platform.twitter.com/widgets.js","initiator":"http://127.0.0.1:63169"}],"recorderRestarted":false},"blockedByClient":["script https://platform.twitter.com/widgets.js"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://platform.twitter.com/widgets.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js

### 28. microsoft.com silent sign-in hand-off (login.live.com → www.microsoft.com) — **FAIL**

1 learned-rule block(s): learned rule 1000003 (microsoft.com) BLOCKED sub_frame https://www.microsoft.com/cascadeauth/account/signin-oidc

- URL: `https://www.microsoft.com/en-us`
- Protected service under test: www.microsoft.com receiving its own login hand-off — excludedInitiatorDomains (same company, D52)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"handoff":{"method":"POST","status":null,"failed":"net::ERR_BLOCKED_BY_CLIENT"},"landed":false,"errorFrames":1,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → net::ERR_BLOCKED_BY_CLIENT"]}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"handoff":{"method":"POST","status":null,"failed":"net::ERR_BLOCKED_BY_CLIENT"},"landed":false,"errorFrames":1,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → net::ERR_BLOCKED_BY_CLIENT"]},"error":null,"learnedHits":{"hits":[{"t":1790653312967,"ruleId":1000003,"type":"sub_frame","url":"https://www.microsoft.com/cascadeauth/account/signin-oidc","initiator":"https://login.live.com"}],"recorderRestarted":false},"blockedByClient":["script https://www.clarity.ms/tag/rcwvv0hsnp","document https://www.microsoft.com/cascadeauth/account/signin-oidc"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"handoff":{"method":"POST","status":302,"failed":null},"landed":true,"errorFrames":0,"chain":["GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=default → 302","GET https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=10fa57ef-4895- → 302","GET https://login.live.com/oauth20_authorize.srf?client_id=10fa57ef-4895-4ab2-872c-8c3613d4f7f → 200","POST https://www.microsoft.com/cascadeauth/account/signin-oidc → 302","GET https://www.microsoft.com/cascadeauth/store/account/silentauth?auth=None → 200"]}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.clarity.ms/tag/rcwvv0hsnp`, `document https://www.microsoft.com/cascadeauth/account/signin-oidc`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000003 (microsoft.com) BLOCKED sub_frame https://www.microsoft.com/cascadeauth/account/signin-oidc

## Every Nullecho console line seen this run (verbatim)

_None captured this run._
