# Bot managers and the persona shim: the D59 measurements (2026-10-17)

The tesla.com finding that started this is in [`tesla/`](tesla/README.md): Akamai Bot Manager answers 403
"Access Denied" with the persona shim in the page and 200 without it; nothing else in the extension
mattered. This folder holds what was measured to build **D59** (docs/DECISIONS.md) and to check it.

**Rig, everywhere below:** headful Chrome for Testing 149 (puppeteer's), `--disable-blink-features=AutomationControlled`,
puppeteer `ignoreDefaultArgs: ['--enable-automation', '--disable-extensions']`, so `navigator.webdriver` is false; a fresh
profile per run; one residential IP; `rig/probe-site.mjs` for every page load (document responses with `Set-Cookie`
**names**, loading failures, blocks, cookie-jar names, the page's title/text, `document.visibilityState`, cores /
memory / WebGL renderer / GPC, and the extension service worker's own record of the visit). Cookie values are never
written, except the single verdict field of Akamai's `_abck` (`0` / `-1`), recorded as `abckStatus`.

## 1. Reproduced first

`control-first` none → OK · `full-ext` main `ceadf46` → **DENIED** (200 → 403 AkamaiGHost) · `no-shim` → OK ·
`control-last` none → OK. Same verdicts as `tesla/`.

## 2. Does the flag beat the handshake on the FIRST visit? (`timing/`)

`rig/probe-ext/` is a 20-line probe extension: `onHeadersReceived` with and without `extraHeaders`, and an
ISOLATED-world content script at `document_start` that messages the worker, all timestamped in the worker.

| run | main_frame response event | content-script message | ahead by |
|---|---|---|---|
| warm worker, first document | t = 1 ms | t = 15 ms | **14 ms** |
| warm worker, the bounce | 2235 ms | 2247 ms | 12 ms |
| worker stopped before the navigation (target gone, confirmed) | t = 0 (it is what wakes the worker) | t = 0, delivered after | **first, same ms** |
| cold, the bounce | 2466 ms | 2473 ms | 7 ms |

Two more facts from the same logs: **Chrome shows `Set-Cookie` only with `extraHeaders`** (the plain listener saw no
cookie on any response), and tesla.com's first document sets `_abck, bm_s, bm_sc, bm_so, bm_sz` — not `ak_bmsc`.
The sensor script's own first-party responses set `_abck` again at 118 ms and on each POST.

## 3. Can a refusal be waited for instead? No. (`recovery/deny-then-allowlist.json`)

Visit 1 with the shim: DENIED. Then the site was switched off (allowlist: the shim stands down) and visit 2 made in
the same profile: **403 on the first document**, no sensor page served at all. A denial marks the session, so a
stand-down that waits for one comes too late; it has to be decided from the first response, before the sensor runs.

## 4. Which bot managers break with the shim? (`survey/`, `rig/survey.mjs`)

Shim ON = the extension as on main (`ceadf46`); shim OFF = the same copy with `shim-loader.js` + `shim.js` removed
(`tesla/rig/make-variants.mjs no-shim`; blocking and GPC kept). One load each, fresh profiles, 6 s between runs,
8 s between sites. A wall on both sides is the rig's or the IP's, not the shim's. The vendor is read from the
cookies the site set, not from the guess in `sites.json`.

| vendor (by its cookies) | sites | shim ON vs OFF |
|---|---|---|
| **Akamai Bot Manager** (`_abck`, `bm_sz`) | tesla.com | **DENIED vs OK** (§1, and `tesla/`) |
| | homedepot, lowes, bestbuy, united, macys, delta, zara, sephora | OK vs OK (8) |
| | adidas (403 bounce), kohls (403 first document) | walled both ways |
| Akamai, `ak_bmsc` only | walmart, nike | OK vs OK |
| HUMAN / PerimeterX (`_px*`) | zillow, walmart, fiverr, homedepot | OK vs OK |
| | wayfair | "Press & Hold" both ways |
| DataDome (`datadome`) | tripadvisor, leboncoin, vinted, pokemoncenter | OK vs OK |
| | hermes (captcha), footlocker (429) | walled both ways |
| | allegro.pl | OK vs **captcha with the shim OFF** — the opposite direction |
| Kasada (`KP_UIDz`) | kick.com, ticketmaster, costco | OK vs OK |
| | realestate.com.au, wizzair (429) | walled both ways |
| Imperva (`incap_ses_*`, `visid_incap_*`, `reese84`) | pokemoncenter, smythstoys | OK vs OK |
| Cloudflare (`__cf_bm`, `cf_clearance`) | medium, discord, indeed, glassdoor, canva, stockx, vinted, kick | OK vs OK |

(hyatt.com 429'd both ways with cookies of none of the six; canadagoose and ssense showed no bot-manager cookie.)

**Result.** Only Akamai has a measured shim-caused breakage, so D59 names only Akamai. **But within Akamai, 1 of 9
comparable sites broke**: eight sites that set the same trigger cookies on their first document load with the shim
exactly as without it. Nothing in a first response separates tesla.com from them (`bm_sc`, tesla's most distinctive
cookie, is on macys too), and §3 rules out waiting. So the per-vendor stand-down costs those eight their device
profile with no measured gain there. This is a sample — home pages only, one load per variant — not a census; a
site whose home page passes may still refuse at sign-in or checkout, which this did not test.

## 5. The D59 build, measured (`gate/`, `attacks/`, `ui/`)

All from the packaged store zip (`node ext/tools/package.mjs`, unzipped), non-automation rig, `visibilityState: visible`.

| check | result |
|---|---|
| tesla.com, 3 fresh profiles (`gate/zip-run{1,2,3}`; again on the final commit's zip, whose only difference is two comments: `gate/final-run{1,2,3}`) | **3 / 3 OK, twice**, 200 → 200; shim status `bot-manager` from the first document on; `navigator.globalPrivacyControl` true; real cores 12 and the real GPU (M2 Max); flag `akamai/_abck` |
| control site, en.wikipedia.org (`gate/control-site-wikipedia`) | shim `upgraded`, persona `macos-chrome-m2-air`: page reads **8 cores, 16 GB, "Apple M2"** = the persona table's values, where this Mac has 12 cores and an M2 Max |
| own.test — the site's own first document sets `_abck` (`attacks/own-test`) | flagged 14 ms before the shim's status arrived; real device; GPC true; its two listed tracker requests (google-analytics, connect.facebook.net) **blocked** — blocking stays on |
| ATTACK: top.test embeds a cross-site frame, a third-party script and fetches, every one answering `Set-Cookie: _abck, bm_sz`; the frame also calls back to top.test's host (`attacks/top-test`, `rig/attack-server.mjs`) | **nothing flagged** (`botManagerSites` never written); top.test keeps its persona (`macos-chrome-m1`: 8 cores, "Apple M1") |
| ATTACK: detection removed (`no-detect`: empty trigger list) | tesla.com **DENIED** again, shim `upgraded` |
| ATTACK: the lost race (`late-main`: every hit recorded 400 ms late) | visit 1: one reload (`reloadedAt` set), then OK; visit 2: one document, no reload |
| ATTACK: a CNAME-cloaked tracker — cname.test's top document loads a script and fetches from `metrics.cname.test`, first-party by registrable domain, both answering `Set-Cookie: _abck, bm_sz` (`attacks/cname-test`) | **nothing flagged**; cname.test keeps its persona. (A first draft also read the top document's own sub-requests; this attack is why it no longer does — every Akamai site measured sets the cookies on a top-level document anyway.) |
| ATTACK: "Use my device profile here anyway" (`attack-override`) | v1 stood down, OK · override on → v2 shim `upgraded`, persona `macos-chrome-m1-pro` (10 cores, "Apple M1 Pro"), page loaded · override off → **v3 DENIED on the first document** — the refusal landed on the visit AFTER the profile was used and outlasted switching back, which is what the warning now says |
| UI (`ui/`, `rig/ui-render.mjs`) | popup on tesla.com: the D59 sentence as an alert, "your own device (not disguised here)", every row "as your browser reports it — not changed"; on wikipedia: no alert, the persona; settings card in light and dark; the override button shows the warning, a dismissal changes nothing, acceptance sets `override: true` |

## Reproduce

```
node ext/tools/package.mjs && mkdir /tmp/zip && unzip -q dist/nullecho-0.9.3-chrome.zip -d /tmp/zip
NULLECHO_PUPPETEER_DIR=<dir> node research/bot-manager-2026-10/rig/probe-site.mjs /tmp/out https://www.tesla.com/ run1=/tmp/zip
node research/bot-manager-2026-10/rig/make-attack-variants.mjs /tmp/zip /tmp/attack
node research/bot-manager-2026-10/rig/attack-server.mjs 4959 &
NULLECHO_PUPPETEER_DIR=<dir> node research/bot-manager-2026-10/rig/probe-site.mjs --settle 6000 \
  --chrome-arg "--host-resolver-rules=MAP top.test 127.0.0.1, MAP third.test 127.0.0.1, MAP own.test 127.0.0.1, MAP cname.test 127.0.0.1, MAP metrics.cname.test 127.0.0.1" \
  /tmp/out http://top.test:4959/ top-test=/tmp/zip
NULLECHO_PUPPETEER_DIR=<dir> node research/bot-manager-2026-10/rig/survey.mjs /tmp/survey <shim-on ext> <shim-off ext> [vendor …]
```

## What this does not cover

Firefox and Edge in a real browser (Firefox: `web-ext lint` only — its webRequest shows `Set-Cookie` without
`extraHeaders`, which the unit tests cover, unmeasured live); sign-in, cart and checkout on any site; more than one
load per variant per surveyed site; any IP but one; which patched surface Akamai's sensor keys on.
