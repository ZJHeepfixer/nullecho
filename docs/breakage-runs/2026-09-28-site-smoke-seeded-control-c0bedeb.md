# Nullecho pre-release site smoke — SEEDED learned state — ⚠ NEGATIVE CONTROL — 2026-09-28

> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The store zip below was unpacked and its `src/heuristics.js` + `src/allowlist.js` were replaced with `b42beb4^` (`c0bedeb`)'s copies (sha256 heuristics `d361701e876b9f57…`, allowlist `4efc4998f42203a6…`). It exists to prove the seeded rows FAIL on the code that broke reCAPTCHA; its FAILs are the point.

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.0-chrome.zip`, sha256 `874df529f4374413744c1e3595a7d88f26c37c718d529f4d4d1b8e6555bfc845`, 243.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Runtime:** 712s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** yes — no chrome-extension:// target
- **ON browser really ON:** yes — chrome-extension://eiidmpdjhkmjbhnalcejcemifkdgobda/src/background.js
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:55133` serving `harness/fixtures/third-party-embeds.html`

## Seeded learned state — and the positive control that proves it was live

Written from the extension's service worker into `chrome.storage.local["nullecho:heuristics:v1"]` (key read from the loaded heuristics.js), then the extension (`eiidmpdjhkmjbhnalcejcemifkdgobda`) was **reloaded** via CDP `Extensions.loadUnpacked` on the same path — the reload arrow / an update — so the shipped `install()` + `onInstalled` ran the shipped `reconcile()`. The harness wrote no DNR rule.

Seeded, each as `{status: 'blocked', ruleId: <heuristic block range>, sites: 3 distinct, source: 'learned'}`: `google.com`, `youtube.com`, `facebook.com`, `microsoft.com`, `live.com`, `microsoftonline.com`, `apple.com`, `cloudflare.com`, `amazon.com`, `twitter.com`, `x.com`, `linkedin.com`.

| Positive-control assertion | Result |
|---|---|
| no learned-range rule existed before the reload (found 0) — so every rule below was written by the extension's reconcile(), not left over | ✅ |
| the reloaded extension still has its static blocking rulesets on (["gpc","ads","analytics","social","fingerprinting","ua-mac"]) — the seeded ON pass is the whole extension plus the learned rules, not a lesser one | ✅ |
| google.com: a live learned rule covers it (id 1000000, block) | ✅ |
| google.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000000) | ✅ |
| youtube.com: a live learned rule covers it (id 1000001, block) | ✅ |
| youtube.com: stored record is promoted and points at that live rule (status blocked, ruleId 1000001) | ✅ |
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
| enforcement + recorder: a fetch from http://127.0.0.1:55133 to www.linkedin.com matched learned rule 1000011 and the recorder saw it (fetch failed: Failed to fetch; 1 hit(s)) | ✅ |

**Learned-range dynamic rules live after the reload** (`getDynamicRules()` from the new worker, 12 rules):

```
1000000 block requestDomains=[google.com] excluded=[] thirdParty
1000001 block requestDomains=[youtube.com] excluded=[] thirdParty
1000002 block requestDomains=[facebook.com] excluded=[] thirdParty
1000003 block requestDomains=[microsoft.com] excluded=[] thirdParty
1000004 block requestDomains=[live.com] excluded=[] thirdParty
1000005 block requestDomains=[microsoftonline.com] excluded=[] thirdParty
1000006 block requestDomains=[apple.com] excluded=[] thirdParty
1000007 block requestDomains=[cloudflare.com] excluded=[] thirdParty
1000008 block requestDomains=[amazon.com] excluded=[] thirdParty
1000009 block requestDomains=[twitter.com] excluded=[] thirdParty
1000010 block requestDomains=[x.com] excluded=[] thirdParty
1000011 block requestDomains=[linkedin.com] excluded=[] thirdParty
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
   "requestDomains": [
    "google.com"
   ]
  },
  "id": 1000000,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
   "requestDomains": [
    "youtube.com"
   ]
  },
  "id": 1000001,
  "priority": 1
 },
 {
  "action": {
   "type": "block"
  },
  "condition": {
   "domainType": "thirdParty",
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
 }
]
```
</details>

Stored records after the reload: `{"amazon.com":{"status":"blocked","ruleId":1000008,"source":"learned"},"apple.com":{"status":"blocked","ruleId":1000006,"source":"learned"},"cloudflare.com":{"status":"blocked","ruleId":1000007,"source":"learned"},"facebook.com":{"status":"blocked","ruleId":1000002,"source":"learned"},"google.com":{"status":"blocked","ruleId":1000000,"source":"learned"},"linkedin.com":{"status":"blocked","ruleId":1000011,"source":"learned"},"live.com":{"status":"blocked","ruleId":1000004,"source":"learned"},"microsoft.com":{"status":"blocked","ruleId":1000003,"source":"learned"},"microsoftonline.com":{"status":"blocked","ruleId":1000005,"source":"learned"},"twitter.com":{"status":"blocked","ruleId":1000009,"source":"learned"},"x.com":{"status":"blocked","ruleId":1000010,"source":"learned"},"youtube.com":{"status":"blocked","ruleId":1000001,"source":"learned"}}`

Worker console during the reload: 
  > warn: [nullecho] heuristics.reconcile failed: Error: Rule with id 1000008 does not have a unique ID.

Match recorder (`onRuleMatchedDebug` in the worker): `installed`.

**⚠ Findings from the reload (these make a seeded run red):**
- worker console during the reload: warn: [nullecho] heuristics.reconcile failed: Error: Rule with id 1000008 does not have a unique ID.
- retry browser: worker console during the reload: warn: [nullecho] heuristics.reconcile failed: Error: Rule with id 1000008 does not have a unique ID.

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
| 2 | open.spotify.com | PASS | PASS | **FAIL** | PROTECTED HOST BLOCKED by a learned rule (1): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfCVLAUAAA |
| 3 | google.com/recaptcha/api2/demo | PASS | PASS | **PASS** |  |
| 4 | accounts.hcaptcha.com/demo | PASS | PASS | **PASS** |  |
| 5 | demo.turnstile.workers.dev | FAIL | PASS | **FAIL** | 3 learned-rule block(s): learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css \ |
| 6 | amazon.com (search "usb c cable") | PASS | PASS | **PASS** |  |
| 7 | google.com/maps | PASS | PASS | **PASS** |  |
| 8 | openstreetmap.org | PASS | PASS | **PASS** |  |
| 9 | youtube.com/watch?v=jNQXAC9IVRw | PASS | PASS | **FAIL** | PROTECTED HOST BLOCKED by a learned rule (10): learned rule 1000000 (google.com) BLOCKED sub_frame https://accounts.google.com/ServiceLogin?service=youtube&uile |
| 10 | chartjs.org vertical bar sample | PASS | PASS | **PASS** |  |
| 11 | nytimes.com | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — nytimes.com — |
| 12 | squoosh.app | PASS | PASS | **PASS** |  |
| 13 | irs.gov site search "form 1040" | PASS | PASS | **PASS** |  |
| 14 | reddit.com/r/technology | PASS | PASS | **FAIL** | PROTECTED HOST BLOCKED by a learned rule (2): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAA |
| 15 | reCAPTCHA v2 on patrickhlauke.github.io | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js |
| 16 | reCAPTCHA v2 on ascendpartner.com signup | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js |
| 17 | reCAPTCHA Enterprise (invisible) on reddit.com/login | FAIL | PASS | **FAIL** | 2 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLN |
| 18 | Cloudflare Turnstile on peet.ws | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha |
| 19 | hCaptcha on democaptcha.com | PASS | PASS | **PASS** |  |
| 20 | Google Sign-In button on reddit.com/login | FAIL | PASS | **FAIL** | 2 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLN |
| 21 | Google Sign-In button on pinterest.com/login | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client?hl=en |
| 22 | YouTube iframe embed (fixture) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000001 (youtube.com) BLOCKED sub_frame https://www.youtube.com/embed/jNQXAC9IVRw |
| 23 | Google Maps embed, www.google.com/maps/embed (fixture) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED sub_frame https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2 |
| 24 | Google Maps embed via maps.google.com (fixture) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED sub_frame https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed |
| 25 | Google Calendar public embed (fixture) | FAIL | PASS | **FAIL** | 1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED sub_frame https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar. |
| 26 | Facebook JS SDK + Page plugin (fixture) | FAIL | PASS | **POLICY-BLOCKED** | 1 learned-rule block(s): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fsta |
| 27 | X / Twitter embedded post (fixture) | FAIL | PASS | **POLICY-BLOCKED** | 1 learned-rule block(s): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js |

**Totals:** 10 PASS, 14 FAIL, 1 BLOCKED, 2 POLICY-BLOCKED

## D50 invariant over all traffic — learned BLOCKs on protected hosts: 28

Every learned-rule block recorded in any row, checked against the current NEVER_BLOCK + COOKIE_BLOCK_ONLY lists (path-scoped entries by host+path). Any hit is a FAIL for its row even if the row's own check passed.

- 2. open.spotify.com: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfCVLAUAAAAALFwwRnnCJ12DalriUGbj8FW_J39 — protected by NEVER_BLOCK: www.google.com/recaptcha/
- 5. demo.turnstile.workers.dev: learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css — protected by NEVER_BLOCK: cdnjs.cloudflare.com
- 5. demo.turnstile.workers.dev: learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.9.1/font/bootstrap-icons.min.css — protected by NEVER_BLOCK: cdnjs.cloudflare.com
- 5. demo.turnstile.workers.dev: learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js — protected by NEVER_BLOCK: challenges.cloudflare.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED sub_frame https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3D%252Fsignin_passive%26feature — protected by NEVER_BLOCK: accounts.google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3Dview%3Butuid%3D4QobU6STFB0P71PMvOGN5A%3Bu — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/lvz?evtid=ACd6Ktz5L69b96SWlD5AVeJ6jvyrKeiEVMdtkBh8UaeTIaIfOxm9NhCgu4-gkfLQDeo0m-t02J-JXBGNwe2lsuPsDPawzMgnyg&req_ts=1790651162&pg=MainAppBootstrap%3AWatch&az=1&sigh=AB9vU422n9p56-j_uWnvDFMQv — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3Dview%3Butuid%3D4QobU6STFB0P71PMvOGN5A%3Bu — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/lvz?evtid=ACd6KtxrM2UyHYZzby6log1eBosD6RBWzzgLviGEAtQSSmNFsGZiv7H22ekAizU0EsRjNswD8BuqEKV_LU6QlipiFo1LuuD4WQ&req_ts=1790651164&pg=MainAppBootstrap%3AWatch&az=1&sigh=AB9vU40oPfiEkHcM0H0-oVNdG — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js — protected by COOKIE_BLOCK_ONLY: google.com
- 9. youtube.com/watch?v=jNQXAC9IVRw: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js — protected by COOKIE_BLOCK_ONLY: google.com
- 14. reddit.com/r/technology: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ — protected by NEVER_BLOCK: www.google.com/recaptcha/
- 14. reddit.com/r/technology: learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client — protected by NEVER_BLOCK: accounts.google.com
- 15. reCAPTCHA v2 on patrickhlauke.github.io: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js — protected by NEVER_BLOCK: www.google.com/recaptcha/
- 16. reCAPTCHA v2 on ascendpartner.com signup: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js — protected by NEVER_BLOCK: www.google.com/recaptcha/
- 17. reCAPTCHA Enterprise (invisible) on reddit.com/login: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ — protected by NEVER_BLOCK: www.google.com/recaptcha/
- 17. reCAPTCHA Enterprise (invisible) on reddit.com/login: learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client — protected by NEVER_BLOCK: accounts.google.com
- 18. Cloudflare Turnstile on peet.ws: learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha — protected by NEVER_BLOCK: challenges.cloudflare.com
- 20. Google Sign-In button on reddit.com/login: learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ — protected by NEVER_BLOCK: www.google.com/recaptcha/
- 20. Google Sign-In button on reddit.com/login: learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client — protected by NEVER_BLOCK: accounts.google.com
- 21. Google Sign-In button on pinterest.com/login: learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client?hl=en — protected by NEVER_BLOCK: accounts.google.com
- 22. YouTube iframe embed (fixture): learned rule 1000001 (youtube.com) BLOCKED sub_frame https://www.youtube.com/embed/jNQXAC9IVRw — protected by COOKIE_BLOCK_ONLY: youtube.com
- 23. Google Maps embed, www.google.com/maps/embed (fixture): learned rule 1000000 (google.com) BLOCKED sub_frame https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000 — protected by COOKIE_BLOCK_ONLY: google.com
- 24. Google Maps embed via maps.google.com (fixture): learned rule 1000000 (google.com) BLOCKED sub_frame https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed — protected by COOKIE_BLOCK_ONLY: google.com
- 25. Google Calendar public embed (fixture): learned rule 1000000 (google.com) BLOCKED sub_frame https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles — protected by COOKIE_BLOCK_ONLY: google.com

## Per-site detail

### 1. example.com — **PASS**

- URL: `https://example.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"title":"Example Domain"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"title":"Example Domain"}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 2. open.spotify.com — **FAIL**

PROTECTED HOST BLOCKED by a learned rule (1): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfCVLAUAAAAALFwwRnnCJ12DalriUGbj8FW_J39 — protected by NEVER_BLOCK: www.google.com/recaptcha/

- URL: `https://open.spotify.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=undefined cores=8 mem=16`, detail: `{"bodyLen":2370}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"bodyLen":2370}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.google.com/recaptcha/enterprise.js?render=6LfCVLAUAAAAALFwwRnnCJ12DalriUGbj8FW_J39`, `script https://www.googletagmanager.com/gtm.js?id=GTM-PZHN3VD`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfCVLAUAAAAALFwwRnnCJ12DalriUGbj8FW_J39

### 3. google.com/recaptcha/api2/demo — **PASS**

- URL: `https://www.google.com/recaptcha/api2/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"box":{"w":304,"h":78}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":304,"h":78}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 4. accounts.hcaptcha.com/demo — **PASS**

- URL: `https://accounts.hcaptcha.com/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"box":{"w":302,"h":76}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":302,"h":76}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 5. demo.turnstile.workers.dev — **FAIL**

3 learned-rule block(s): learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css | learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.9.1/font/bootstrap-icons.min.css | learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js

- URL: `https://demo.turnstile.workers.dev/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"box":null}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"box":null},"error":null,"learnedHits":{"hits":[{"t":1790651136407,"ruleId":1000007,"type":"stylesheet","url":"https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css","initiator":"https://demo.turnstile.workers.dev"},{"t":1790651136407,"ruleId":1000007,"type":"stylesheet","url":"https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.9.1/font/bootstrap-icons.min.css","initiator":"https://demo.turnstile.workers.dev"},{"t":1790651136416,"ruleId":1000007,"type":"script","url":"https://challenges.cloudflare.com/turnstile/v0/api.js","initiator":"https://demo.turnstile.workers.dev"}],"recorderRestarted":false},"blockedByClient":["stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css","stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.9.1/font/bootstrap-icons.min.css","script https://challenges.cloudflare.com/turnstile/v0/api.js"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":300,"h":71,"via":"widget-children"}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (3): `stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css`, `stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.9.1/font/bootstrap-icons.min.css`, `script https://challenges.cloudflare.com/turnstile/v0/api.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 3 block, 0 cookie-strip
  - learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.2.1/css/bootstrap.min.css
  - learned rule 1000007 (cloudflare.com) BLOCKED stylesheet https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.9.1/font/bootstrap-icons.min.css
  - learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js

### 6. amazon.com (search "usb c cable") — **PASS**

- URL: `https://www.amazon.com/s?k=usb+c+cable`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"resultCount":22}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"resultCount":22}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (6): `script https://www.googletagservices.com/dcm/dcmads.js`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR3ATlPOk4Au7Uego-z6NfFVyQIUyuoh9nmHSr5PDNd8f8qsiFc8X5RtothKO2O4d5p98yyf0ugKbRl56F2Eb40zjQ6iUSBlUOxwhEwrxRt0h5Gcs4JgqLDeybbr-G9TSaGW`, `fetch https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?_=1607460946161`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR1MXg9Ku2waXYs4LwyHAYHlgXeMImb59nmHSr5PCNd8f8qsiG80X5Q5IjDyfg7ZizLV4xX7HtTv-Oz1SHmEb_0_jLqiJTh5dPRkuEwvxRNcj4GUmwaQ2DxS-brT5GtXVZke`, `fetch https://aes.us-east.ono.axp.amazon-adsystem.com/x/px?t=atf&bi=v1_CGrnR1MXg9Ku2waXYs4LwyHAYHlgXeMImb59nmHSr5PCNd8f8qsiEcgX5SVKvWjul6sr3ZBNsHTJvhyxTF9CIFcbt07jXKiUSRlVPhwrFgv-Rdgs7G4m6Jw1LTa7bLz_HNPcY06`, `document https://s.amazon-adsystem.com/iu3?d=amazon.com&slot=navFooter&a2=0101b2cab4cafbbb4d7a16c38c55ec4a8df983db2d4bafdcdaf242d17bcf0ef99339&old_oo=0&ts=1790651141594&s=AW6_Z-Xysrp3005gQc_uSY8_5VpYphmDNErUk_`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 7. google.com/maps — **PASS**

- URL: `https://www.google.com/maps/@35.6225,-117.6709,12z`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `image https://tpc.googlesyndication.com/simgad/12443843956218829127?w=40&h=40`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 8. openstreetmap.org — **PASS**

- URL: `https://www.openstreetmap.org/#map=12/35.6225/-117.6709`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"total":24,"loaded":24}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"total":24,"loaded":24}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 9. youtube.com/watch?v=jNQXAC9IVRw — **FAIL**

PROTECTED HOST BLOCKED by a learned rule (10): learned rule 1000000 (google.com) BLOCKED sub_frame https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3D%252Fsignin_passive%26feature — protected by NEVER_BLOCK: accounts.google.com | learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js — protected by COOKIE_BLOCK_ONLY: google.com

- URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"from":0.000129,"currentTime":8.940125,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"from":1.389739,"currentTime":10.392244,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (15): `script https://static.doubleclick.net/instream/ad_status.js`, `document https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3D%252Fsign`, `script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js`, `image https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3Dview%3Butuid%3D4QobU6`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js`, `xhr https://googleads.g.doubleclick.net/pagead/id`, `image https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3Dview%3Butuid%3D4QobU6` …
- **ON learned-rule matches** (`onRuleMatchedDebug`): 10 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED sub_frame https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&continue=https%3A%2F%2Fwww.youtube.com%2Fsignin%3Faction_handle_signin%3Dtrue%26app%3Ddesktop%26hl%3Den%26next%3D%252Fsignin_passive%26feature
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js
  - learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3Dview%3Butuid%3D4QobU6STFB0P71PMvOGN5A%3Bu
  - learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/lvz?evtid=ACd6Ktz5L69b96SWlD5AVeJ6jvyrKeiEVMdtkBh8UaeTIaIfOxm9NhCgu4-gkfLQDeo0m-t02J-JXBGNwe2lsuPsDPawzMgnyg&req_ts=1790651162&pg=MainAppBootstrap%3AWatch&az=1&sigh=AB9vU422n9p56-j_uWnvDFMQv
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js
  - learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/1p-user-list/962985656/?backend=innertube&cname=1&cver=2_20260925&data=backend%3Dinnertube%3Bcname%3D1%3Bcver%3D2_20260925%3Bptype%3Df_view%3Btype%3Dview%3Butuid%3D4QobU6STFB0P71PMvOGN5A%3Bu
  - learned rule 1000000 (google.com) BLOCKED image https://www.google.com/pagead/lvz?evtid=ACd6KtxrM2UyHYZzby6log1eBosD6RBWzzgLviGEAtQSSmNFsGZiv7H22ekAizU0EsRjNswD8BuqEKV_LU6QlipiFo1LuuD4WQ&req_ts=1790651164&pg=MainAppBootstrap%3AWatch&az=1&sigh=AB9vU40oPfiEkHcM0H0-oVNdG
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/js/th/3sGYGc4hYgVHYZEI2lPZZTlOvxH6DVRbT7JLSrTea7w.js
- Nullecho/console lines:
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
  > ON: [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.

### 10. chartjs.org vertical bar sample — **PASS**

- URL: `https://www.chartjs.org/docs/latest/samples/bar/vertical.html`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"w":800,"h":400,"nonTransparentPixels":50535}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"w":800,"h":400,"nonTransparentPixels":52768}`
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
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (2): `script https://www.googletagmanager.com/gtm.js?id=GTM-KV978ZL`, `script https://www.googletagmanager.com/gtm.js?id=GTM-KV978ZL`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 14. reddit.com/r/technology — **FAIL**

PROTECTED HOST BLOCKED by a learned rule (2): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ — protected by NEVER_BLOCK: www.google.com/recaptcha/ | learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client — protected by NEVER_BLOCK: accounts.google.com

- URL: `https://www.reddit.com/r/technology/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"postCount":56}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"postCount":56}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (4): `script https://www.googletagmanager.com/gtag/js?id=AW-788729857`, `image https://id.rlcdn.com/472486.gif`, `script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ`, `script https://accounts.google.com/gsi/client`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 2 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ
  - learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client

### 15. reCAPTCHA v2 on patrickhlauke.github.io — **FAIL**

1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js

- URL: `https://patrickhlauke.github.io/recaptcha/`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"api":{"grecaptcha":"undefined","ready":false},"anchor":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"grecaptcha":"undefined","ready":false},"anchor":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651191797,"ruleId":1000000,"type":"script","url":"https://www.google.com/recaptcha/api.js","initiator":"https://patrickhlauke.github.io"}],"recorderRestarted":false},"blockedByClient":["script https://www.google.com/recaptcha/api.js"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6Ld2sf4SAAAAAKSgzs0Q13IZhY02Pyo31S2jgOB5&co=aHR0cHM6Ly9wYXRyaWNraGxhdWtlLmdpdGh1Yi5pbzo0NDM.&hl=en&v=kemdRjW","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA is changing its terms of service. "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.google.com/recaptcha/api.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js

### 16. reCAPTCHA v2 on ascendpartner.com signup — **FAIL**

1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js

- URL: `https://www.ascendpartner.com/affiliate/registration?usertype=2`
- Protected service under test: www.google.com/recaptcha/ (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"grecaptcha":"undefined","ready":false},"anchor":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"grecaptcha":"undefined","ready":false},"anchor":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651209671,"ruleId":1000000,"type":"script","url":"https://www.google.com/recaptcha/api.js","initiator":"https://www.ascendpartner.com"}],"recorderRestarted":false},"blockedByClient":["script https://www.google.com/recaptcha/api.js"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/api2/anchor?ar=1&k=6LeHoIoUAAAAACNO2KJkhRR-bbw9g6BzJLAJNYQL&co=aHR0cHM6Ly93d3cuYXNjZW5kcGFydG5lci5jb206NDQz&hl=en&v=kemdRjWFxNj","box":{"w":304,"h":78},"content":{"ok":true,"checkbox":true,"text":"I'm not a robot reCAPTCHA"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://www.google.com/recaptcha/api.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/api.js

### 17. reCAPTCHA Enterprise (invisible) on reddit.com/login — **FAIL**

2 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ | learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client

- URL: `https://www.reddit.com/login/`
- Protected service under test: www.google.com/recaptcha/enterprise (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"grecaptcha":"undefined","ready":false},"anchor":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"grecaptcha":"undefined","ready":false},"anchor":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651228311,"ruleId":1000000,"type":"script","url":"https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ","initiator":"https://www.reddit.com"},{"t":1790651228415,"ruleId":1000000,"type":"script","url":"https://accounts.google.com/gsi/client","initiator":"https://www.reddit.com"}],"recorderRestarted":false},"blockedByClient":["image https://id.rlcdn.com/472486.gif","script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ","script https://accounts.google.com/gsi/client"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"grecaptcha":"object","ready":true},"anchor":{"ok":true,"found":true,"url":"https://www.google.com/recaptcha/enterprise/anchor?ar=1&k=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ&co=aHR0cHM6Ly93d3cucmVkZGl0LmNvbTo0NDM.&hl=en&v=kemdRjWFxNjgs","box":{"w":256,"h":60},"content":{"ok":true,"checkbox":false,"text":"protected by reCAPTCHA"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (3): `image https://id.rlcdn.com/472486.gif`, `script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ`, `script https://accounts.google.com/gsi/client`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 2 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ
  - learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client

### 18. Cloudflare Turnstile on peet.ws — **FAIL**

1 learned-rule block(s): learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha

- URL: `https://peet.ws/turnstile-test/non-interactive.html`
- Protected service under test: challenges.cloudflare.com (NEVER_BLOCK) under a learned cloudflare.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"turnstile":"undefined","ready":false},"widget":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"turnstile":"undefined","ready":false},"widget":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651247482,"ruleId":1000007,"type":"script","url":"https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha","initiator":"https://peet.ws"}],"recorderRestarted":false},"blockedByClient":["script https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"turnstile":"object","ready":true},"widget":{"ok":true,"found":true,"url":"https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/turnstile/f/av0/rch/1pn9e/0x4AAAAAAABS7vwvV6VFfMcD/light/fbE/new/normal?lang=auto","box":{"w":300,"h":65},"content":null}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000007 (cloudflare.com) BLOCKED script https://challenges.cloudflare.com/turnstile/v0/api.js?compat=recaptcha

### 19. hCaptcha on democaptcha.com — **PASS**

- URL: `https://democaptcha.com/demo-form-eng/hcaptcha.html`
- Protected service under test: hcaptcha.com (NEVER_BLOCK; no seeded domain covers it — a CONTROL row: it must pass in every mode)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/b9ca2a6602c2bf69741b771db488f3001ea35b08/static/hcaptcha.html#frame=checkbox&id=0svkfo6zhxyb&host=democaptcha.com&sent","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"hcaptcha":"object","ready":true},"checkbox":{"ok":true,"found":true,"url":"https://newassets.hcaptcha.com/captcha/v1/b9ca2a6602c2bf69741b771db488f3001ea35b08/static/hcaptcha.html#frame=checkbox&id=0at8rk2rmx5g&host=democaptcha.com&sent","box":{"w":302,"h":76},"content":{"ok":true,"text":"I am human Privacy - Terms"}}}`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 0 block, 0 cookie-strip

### 20. Google Sign-In button on reddit.com/login — **FAIL**

2 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ | learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client

- URL: `https://www.reddit.com/login/`
- Protected service under test: accounts.google.com (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"api":{"ready":false},"button":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"ready":false},"button":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651270294,"ruleId":1000000,"type":"script","url":"https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ","initiator":"https://www.reddit.com"},{"t":1790651270391,"ruleId":1000000,"type":"script","url":"https://accounts.google.com/gsi/client","initiator":"https://www.reddit.com"}],"recorderRestarted":false},"blockedByClient":["image https://id.rlcdn.com/472486.gif","script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ","script https://accounts.google.com/gsi/client"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?logo_alignment=left&size=large&shape=pill&text=continue_with&theme=outline&type=standard&width=368&click_listener=functio","box":{"w":388,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (3): `image https://id.rlcdn.com/472486.gif`, `script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ`, `script https://accounts.google.com/gsi/client`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 2 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://www.google.com/recaptcha/enterprise.js?render=6LfirrMoAAAAAHZOipvza4kpp_VtTwLNuXVwURNQ
  - learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client

### 21. Google Sign-In button on pinterest.com/login — **FAIL**

1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client?hl=en

- URL: `https://www.pinterest.com/login/`
- Protected service under test: accounts.google.com (NEVER_BLOCK) under a learned google.com
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"api":{"ready":false},"button":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"api":{"ready":false},"button":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651289683,"ruleId":1000000,"type":"script","url":"https://accounts.google.com/gsi/client?hl=en","initiator":"https://www.pinterest.com"}],"recorderRestarted":false},"blockedByClient":["script https://accounts.google.com/gsi/client?hl=en"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"api":{"ready":true},"button":{"ok":true,"found":true,"url":"https://accounts.google.com/gsi/button?size=large&shape=rectangular&text=continue_with&theme=outline&width=382px&logo_alignment=left&click_listener=()%3D%3E%7BI","box":{"w":402,"h":44},"content":{"ok":true,"text":"Continue with Google"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://accounts.google.com/gsi/client?hl=en`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED script https://accounts.google.com/gsi/client?hl=en

### 22. YouTube iframe embed (fixture) — **FAIL**

1 learned-rule block(s): learned rule 1000001 (youtube.com) BLOCKED sub_frame https://www.youtube.com/embed/jNQXAC9IVRw

- URL: `http://127.0.0.1:55133/third-party-embeds.html?e=youtube`
- Protected service under test: youtube.com (COOKIE_BLOCK_ONLY — cookie-strip, never block)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"player":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"player":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790651308933,"ruleId":1000001,"type":"sub_frame","url":"https://www.youtube.com/embed/jNQXAC9IVRw","initiator":"http://127.0.0.1:55133"}],"recorderRestarted":false},"blockedByClient":["document https://www.youtube.com/embed/jNQXAC9IVRw"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"player":{"ok":true,"found":true,"url":"https://www.youtube.com/embed/jNQXAC9IVRw","box":{"w":564,"h":319},"content":{"ok":true,"text":"Me at the zoo jawed jawed 6.63M subscribers Watch on"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://www.youtube.com/embed/jNQXAC9IVRw`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000001 (youtube.com) BLOCKED sub_frame https://www.youtube.com/embed/jNQXAC9IVRw

### 23. Google Maps embed, www.google.com/maps/embed (fixture) — **FAIL**

1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED sub_frame https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000

- URL: `http://127.0.0.1:55133/third-party-embeds.html?e=maps`
- Protected service under test: www.google.com (carved out of a learned google.com, D50)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"map":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"map":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790651326688,"ruleId":1000000,"type":"sub_frame","url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","initiator":"http://127.0.0.1:55133"}],"recorderRestarted":false},"blockedByClient":["document https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000","box":{"w":604,"h":454},"content":{"ok":true,"images":42,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED sub_frame https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d52000!2d-117.6709!3d35.6225!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1700000000000

### 24. Google Maps embed via maps.google.com (fixture) — **FAIL**

1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED sub_frame https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed

- URL: `http://127.0.0.1:55133/third-party-embeds.html?e=maps-legacy`
- Protected service under test: maps.google.com (COOKIE_BLOCK_ONLY) → www.google.com/maps/embed
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"map":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"map":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790651344911,"ruleId":1000000,"type":"sub_frame","url":"https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed","initiator":"http://127.0.0.1:55133"}],"recorderRestarted":false},"blockedByClient":["document https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"map":{"ok":true,"found":true,"url":"https://www.google.com/maps/embed?origin=mfe&pb=!1m2!2m1!1sRidgecrest,+CA","box":{"w":604,"h":454},"content":{"ok":true,"images":39,"text":"Keyboard shortcuts Map data ©2026 Google Terms Report a map "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED sub_frame https://maps.google.com/maps?q=Ridgecrest%2C%20CA&output=embed

### 25. Google Calendar public embed (fixture) — **FAIL**

1 learned-rule block(s): learned rule 1000000 (google.com) BLOCKED sub_frame https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles

- URL: `http://127.0.0.1:55133/third-party-embeds.html?e=calendar`
- Protected service under test: calendar.google.com — google.com is COOKIE_BLOCK_ONLY since D50
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"cal":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"cal":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790651363131,"ruleId":1000000,"type":"sub_frame","url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","initiator":"http://127.0.0.1:55133"}],"recorderRestarted":false},"blockedByClient":["document https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"cal":{"ok":true,"found":true,"url":"https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles","box":{"w":804,"h":604},"content":{"ok":true,"textLen":1713,"title":"Holidays in United States","text":"Today Monday, September 28 Previous month Next month Septemb"}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000000 (google.com) BLOCKED sub_frame https://calendar.google.com/calendar/embed?src=en.usa%23holiday%40group.v.calendar.google.com&ctz=America%2FLos_Angeles

### 26. Facebook JS SDK + Page plugin (fixture) — **POLICY-BLOCKED**

1 learned-rule block(s): learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfb02575e8e68aef12%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%

- URL: `http://127.0.0.1:55133/third-party-embeds.html?e=facebook`
- Protected service under test: NOTHING under facebook.com except graph.facebook.com — POLICY row — **POLICY row** (a learned block here is POLICY-BLOCKED, not FAIL)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":false,"found":false,"errorFrames":1}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":false,"found":false,"errorFrames":1}},"error":null,"learnedHits":{"hits":[{"t":1790651381649,"ruleId":1000002,"type":"sub_frame","url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfa9244bae2ee49bce%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%","initiator":"http://127.0.0.1:55133"}],"recorderRestarted":false},"blockedByClient":["document https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfa9244bae2ee49bce%26domain%3D127.0.0.1%26is_canv"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"sdk":{"FB":"object","xfbml":true},"plugin":{"ok":true,"found":true,"url":"https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfda6d58b","box":{"w":340,"h":500},"content":{"ok":true,"text":"Facebook 154,690,177 followers Follow Page Share Facebook 6 "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `document https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfb02575e8e68aef12%26domain%3D127.0.0.1%26is_canv`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000002 (facebook.com) BLOCKED sub_frame https://www.facebook.com/v19.0/plugins/page.php?app_id=&channel=https%3A%2F%2Fstaticxx.facebook.com%2Fx%2Fconnect%2Fxd_arbiter%2F%3Fversion%3D46%23cb%3Dfb02575e8e68aef12%26domain%3D127.0.0.1%26is_canvas%3Dfalse%26origin%

### 27. X / Twitter embedded post (fixture) — **POLICY-BLOCKED**

1 learned-rule block(s): learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js

- URL: `http://127.0.0.1:55133/third-party-embeds.html?e=tweet`
- Protected service under test: NOTHING under twitter.com — POLICY row — **POLICY row** (a learned block here is POLICY-BLOCKED, not FAIL)
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"post":{"ok":false,"found":false,"errorFrames":0}}`, **retried once** (first attempt: {"ok":false,"reasons":[],"detail":{"post":{"ok":false,"found":false,"errorFrames":0}},"error":null,"learnedHits":{"hits":[{"t":1790651400043,"ruleId":1000009,"type":"script","url":"https://platform.twitter.com/widgets.js","initiator":"http://127.0.0.1:55133"}],"recorderRestarted":false},"blockedByClient":["script https://platform.twitter.com/widgets.js"]})
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"post":{"ok":true,"found":true,"url":"https://platform.twitter.com/embed/Tweet.html?dnt=false&embedId=twitter-widget-0&features=eyJ0ZndfdGltZWxpbmVfbGlzdCI6eyJidWNrZXQiOltdLCJ2ZXJzaW9uIjpudWxsfSwidG","box":{"w":550,"h":225},"content":{"ok":true,"text":"jack @jack · Follow just setting up my twttr 12:50 PM · Mar "}}}`
- **ON** `net::ERR_BLOCKED_BY_CLIENT` (1): `script https://platform.twitter.com/widgets.js`
- **ON learned-rule matches** (`onRuleMatchedDebug`): 1 block, 0 cookie-strip
  - learned rule 1000009 (twitter.com) BLOCKED script https://platform.twitter.com/widgets.js

## Every Nullecho console line seen this run (verbatim)

- google.com/recaptcha/api2/demo (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- amazon.com (search "usb c cable") (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- youtube.com/watch?v=jNQXAC9IVRw (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- youtube.com/watch?v=jNQXAC9IVRw (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
