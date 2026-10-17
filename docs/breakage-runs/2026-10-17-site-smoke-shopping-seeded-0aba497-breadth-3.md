# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `4b902017aadb3d56457ea017e26d3277046a9e0de9f2b42415b8d3c02a6703cf`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `0aba497` (ext/ and harness/ clean)
- **Runtime:** 2845s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:50350` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

34 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://icelpgghgghdalcpfkjddcbahhpohgoi/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 31 | llbean.com product | Dynamic Yield | **NOT-OURS** | 150.00 = 150.00 | 150.00 = 150.00 | — = — | ✗✗✗ / ✗✗✗ | 138/138/138 / 138/138/138 | 6000×10 | 10, 0, 0 | 2 |
| 35 | sephora.com product | Rokt/mParticle, Bluecore, Constructor beacon | **PASS** | 16.00/25.00 = 16.00/25.00 | — = — | — = — | ✓ / ✓ | 6 / 6 | 6200×7 | 3 | 0 |
| 39 | petsmart.com product | Granify | **PASS** | 16.98/24.99 = 16.98/24.99 | 24.99 = 24.99 | — = — | ✓✗✗ / ✗✗✗ | 40/40/40 / 40/40/40 | 6500×6 | 1, 1, 1 | 5 |
| 43 | drsquatch.com product (Klaviyo) | Klaviyo, Constructor beacon | **PASS** | 7.00/55.00 = 7.00/55.00 | 7.00 = 7.00 | — = — | ✓✓✓ / ✓✓✓ | 24/24/24 / 24/24/24 | 6950×30 | 5, 5, 5 | 3 |
| 47 | rothys.com product (Intelligems) | Intelligems, Attentive, Constructor | **NOT-OURS** | 109.00/125.00 = 109.00/125.00 | 109.00 = 109.00 | — = — | ✗✗✗ / ✗✗✗ | 2/2/2 / 2/2/2 | 6300×1 6900×27 | 16, 0, 0 | 3 |
| 51 | ikea.com product | — | **NOT-OURS** | 16.99 = 16.99 | — = — | — = — | ✗✗✗ / ✗✗✗ | 32/32/32 / 32/32/32 | — | 0, 0, 0 | 0 |
| 55 | apple.com Buy iPad (many offers) | — | **PASS** | 449.00/549.00/599.00/699.00/749.00/899.00 = 449.00/549.00/599.00/699.00/749.00/899.00 | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | — | 0, 0, 0 | 1 |
| 59 | lowes.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 0 |
| 63 | price positive control (fixture, client-side price test) | fixture price-test script | **PASS** | 15.00 = 15.00 | 15.00 = 15.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 67 | bananarepublic.gap.com product | Rokt, Attentive, Granify, Bluecore | **NOT-OURS** | 65.00 = 65.00 | 98.00 = 98.00 | — = — | ✗✗✗ / ✗✗✗ | 8/8/8 / 8/8/8 | 6200×12 6300×2 6500×2 6710×12 | 0, 11, 9 | 2 |
| 71 | fashionnova.com product | Attentive, Wunderkind, Klaviyo | **NOT-OURS** | 44.99 = 44.99 | 44.99 = 44.99 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6300×1 6950×15 | 6, 5, 5 | 0 |
| 75 | outdoorvoices.com product | Wunderkind, Klaviyo | **NOT-OURS** | 39.99 = 39.99 | 39.99 = 39.99 | — = — | ✗✗✗ / ✗✗✗ | 37/37/37 / 28/28/37 | 6950×24 | 4, 4, 4 | 1 |
| 79 | tecovas.com product | Attentive, Wunderkind | **PASS** | 295.00/335.00/415.00 = 295.00/335.00/415.00 | 415.00 = 415.00 | — = — | ✗✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6300×1 6400×3 | 2, 0, 0 | 1 |
| 83 | elfcosmetics.com product | — | **PASS** | 9.00 = 9.00 | — = — | — = — | ✗✓✓ / ✗✓✓ | 10/10/10 / 10/10/10 | — | 0, 0, 0 | 0 |
| 87 | maccosmetics.com product | — | **PASS** | 25.00 = 25.00 | 25.00 = 25.00 | **25.00 → 25.00/—** | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 1 |
| 91 | jcpenney.com product | — | **NOT-OURS** | 3.59 = 3.59 | — = — | — = — | ✗✗✗ / ✗✗✗ | 60/60/60 / 60/60/60 | — | 0, 0, 0 | 1 |
| 95 | beistravel.com product | Attentive, Klaviyo | **PASS** | 78.00 = 78.00 | 78.00 = 78.00 | —/78.00 = —/78.00 | ✗✓✓ / ✗✓✓ | 38/39/39 / 38/39/39 | 6300×7 6950×30 | 7, 6, 6 | 0 |
| 99 | brightland.co product | Rebuy, Klaviyo | **PASS** | 98.00 = 98.00 | 83.30 = 83.30 | 83.30 = 83.30 | ✓✓✓ / ✓✓✓ | 25/25/25 / 25/25/25 | 6715×8 6950×30 | 5, 7, 7 | 2 |
| 103 | cupshe.com product | — | **PASS** | 46.00 = 46.00 | 46.00 = 46.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 107 | glowrecipe.com product | Wunderkind, Convert, Klaviyo | **PASS** | 38.00 = 38.00 | 38.00 = 38.00 | 38.00 = 38.00 | ✓✓✓ / ✓✓✓ | 55/56/56 / 55/56/56 | 6400×6 6800×8 6950×10 | 8, 8, 2 | 0 |
| 111 | jonesroadbeauty.com product | Intelligems, Klaviyo | **PASS** | 88.00 = 88.00 | 166.00 = 166.00 | **—/88.00 → —** | ✗✗✓ / ✗✗✗ | 82/82/85 / 74/74/74 | 6900×24 6950×30 | 17, 5, 5 | 0 |
| 115 | manscaped.com product | Dynamic Yield, Attentive, Klaviyo | **PASS** | 109.99 = 109.99 | — = — | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6950×4 | 4, 0, 0 | 7 |
| 119 | nativecos.com product | Attentive, Rebuy, AB Tasty | **FAIL** | 39.00/42.00 = 39.00/42.00 | 56.00 = 56.00 | **—/39.00/15.60 → 39.00/15.60/19.50** | ✗✓✓ / ✓✓✓ | 20/22/25 / 22/25/25 | 6300×3 6715×24 6801×25 | 7, 9, 10 | 2 |
| 123 | parachutehome.com product | Attentive, Rebuy, Intelligems, Klaviyo | **PASS** | 59.00/69.00 = 59.00/69.00 | 59.00 = 59.00 | — = — | ✓✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6300×4 6715×2 6900×9 6950×15 | 17, 6, 6 | 3 |
| 127 | ritual.com product | Klaviyo | **PASS** | 128.00 = 128.00 | 74.25 = 74.25 | **— → 37.13/43.31/45.38** | ✗✗✗ / ✓✓✓ | 17/17/17 / 23/23/23 | 6950×30 | 5, 5, 5 | 1 |
| 131 | summerfridays.com product | Attentive, Intelligems | **FAIL** | 315.00 = 315.00 | 315.00 = 315.00 | **315.00/210.00/— → 315.00/210.00/163.00** | ✓✓✗ / ✓✓✓ | 51/51/51 / 51/51/53 | 6300×6 6900×6 | 1, 1, 1 | 3 |
| 135 | bhphotovideo.com product | — | **PASS** | 12.05 = 12.05 | 12.05 = 12.05 | — = — | ✓✗✗ / ✓✗✗ | 56/56/56 / 56/56/56 | — | 0, 0, 0 | 1 |
| 139 | newegg.com product | Attentive | **PASS** | — = — | 174.98 = 174.98 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 143 | castlery.com product | Dynamic Yield, Klaviyo | **PASS** | 499.00 = 499.00 | 44.00 = 44.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6000×35 6950×12 | 13, 20, 14 | 0 |
| 147 | truevalue.com product | — | **PASS** | 44.99 = 44.99 | 44.99 = 44.99 | — = — | ✓✓✓ / ✓✓✓ | 27/27/27 / 10/10/10 | — | 0, 0, 0 | 1 |
| 151 | walgreens.com product | — | **NOT-OURS** | — = — | 129.99 = 129.99 | — = — | ✗✗✗ / ✗✗✗ | 31/31/31 / 31/31/31 | — | 0, 0, 0 | 1 |
| 155 | us.puma.com product | Bloomreach, AB Tasty | **NOT-OURS** | 16.99/18.00/24.00 = 16.99/18.00/24.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 24/24/24 / 24/24/24 | 6102×6 6801×12 | 3, 3, 3 | 2 |
| 159 | rhone.com product | Dynamic Yield | **NOT-OURS** | 44.40/51.80/59.20/74.00/80.00 = 44.40/51.80/59.20/74.00/80.00 | 74.00 = 74.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 12 |
| 163 | tenthousand.cc product | Intelligems, Klaviyo | **NOT-OURS** | 88.00 = 88.00 | 88.00 = 88.00 | — = — | ✗✗✗ / ✗✗✗ | 19/19/19 / 19/19/19 | 6950×35 6952×6 | 5, 7, 7 | 4 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 11 NOT-OURS, 20 PASS, 1 BLOCKED, 2 FAIL

### Every price difference in every pair — including noise

- 119. nativecos.com product: r2: CART PRICE DIFFERS: OFF 39.00 vs ON 15.60
- 119. nativecos.com product: r3: CART PRICE DIFFERS: OFF 15.60 vs ON 19.50

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 39. petsmart.com product: r1: add-to-cart worked OFF, not ON
- 111. jonesroadbeauty.com product: r3: add-to-cart worked OFF, not ON
- 123. parachutehome.com product: r1: add-to-cart worked OFF, not ON

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **31. llbean.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Uncaught (in promise) Error: timeout`
- **35. sephora.com product** (1 blocked-resource line(s))
- **39. petsmart.com product** (1 blocked-resource line(s)):
  - `console: [OPTIMIZELY] - ERROR #-10-17T16:53:53.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:10:56.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:11:25.#Z OPTIMIZELY: Optimizely object is not valid. Failing decideAll.`
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:26:20.#Z DatafileManager: Error fetching datafile: Request error`
- **43. drsquatch.com product (Klaviyo)** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://alocdn.com/c/9rgi64bf/a/xtarget/p.json' from origin 'https://www.drsquatch.com' has been blocked by CORS policy: No 'Access`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `uncaught: Unhandled Promise Rejection: Failed to fetch`
- **47. rothys.com product (Intelligems)** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Cannot read properties of undefined (reading 'init')`
  - `uncaught: Unhandled Promise Rejection: igData does not exist. Intelligems may not have loaded.`
- **51. ikea.com product** (1 blocked-resource line(s))
- **55. apple.com Buy iPad (many offers)** (0 blocked-resource line(s)):
  - `console: JSONError: Received non-JSON response from JSON API with error.message: Unexpected end of JSON input, response.status: #, response.type: basic, respons`
- **67. bananarepublic.gap.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error sending event to mParticle servers. TypeError: Failed to fetch`
- **71. fashionnova.com product** (1 blocked-resource line(s))
- **75. outdoorvoices.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **79. tecovas.com product** (1 blocked-resource line(s)):
  - `console: Failed to load resource: net::ERR_FAILED`
- **83. elfcosmetics.com product** (1 blocked-resource line(s))
- **87. maccosmetics.com product** (1 blocked-resource line(s)):
  - `console: utag failed to load after 10 seconds, queue not processed`
- **91. jcpenney.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **95. beistravel.com product** (1 blocked-resource line(s))
- **99. brightland.co product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `console: Error initializing managers TypeError: Failed to fetch`
- **103. cupshe.com product** (1 blocked-resource line(s))
- **107. glowrecipe.com product** (1 blocked-resource line(s))
- **111. jonesroadbeauty.com product** (1 blocked-resource line(s))
- **115. manscaped.com product** (1 blocked-resource line(s)):
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Reddit-Pixel___2bgsqMe8O1SswVuwdOh3F3mHX2q`
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Facebook-Pixel___2M4Kgad9tTcCaVSmQSx8a2Xxs`
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Google-Tag-Manager___2prYGp6JtnkKttRH8aGg3`
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Criteo___2x8hompF9zHQ83RWtbI4S7yRIIo" - A `
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Bing-Ads___2Yr3dSOqtvhJmXfjsdKKlwKjxlF" - `
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Google-Ads___2VwEUWm1p5DPUSOgj46CJSNswVK" `
  - `console: %c RS SDK %c DeviceModeDestinationsPlugin:: Failed to get the ready status from integration for destination "Google-Ads___2VwDwpJUc0SLMclbaytbMXIfb6V" `
- **119. nativecos.com product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `uncaught: Failed to fetch`
- **123. parachutehome.com product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `uncaught: Uncaught (in promise) Error: Unauthorized`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **127. ritual.com product** (1 blocked-resource line(s)):
  - `uncaught: Cannot read properties of undefined (reading 'init')`
- **131. summerfridays.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `uncaught: Failed to fetch r.fetch (https://summerfridays.com/cdn/wpm/s9f5e#wb#ap#c42m93b2bec3m.js:1:#)`
- **135. bhphotovideo.com product** (1 blocked-resource line(s)):
  - `uncaught: Uncaught (in promise) Error: There has been a problem with your fetch operation Privacy Test translation on Cookie Modal: TypeError: Failed to fetch`
- **139. newegg.com product** (1 blocked-resource line(s))
- **143. castlery.com product** (1 blocked-resource line(s))
- **147. truevalue.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **151. walgreens.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **155. us.puma.com product** (1 blocked-resource line(s)):
  - `uncaught: Uncaught (in promise) geoloc service failure`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **159. rhone.com product** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://dl.rhone.com/collections from origin 'https://www.rhone.com' has been blocked by CORS policy: No 'Access-C`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `console: TypeError: Failed to fetch`
  - `console: Access to fetch at 'https://dl.rhone.com/collections from origin 'https://www.rhone.com' has been blocked by CORS policy: No 'Ac`
  - `console: Access to fetch at 'https://dl.rhone.com/collections from origin 'https://www.rhone.com' has been blocked by CORS policy: No 'Acces`
  - `console: Access to fetch at 'https://dl.rhone.com/collections from origin 'https://www.rhone.com' has been blocked by CORS policy: No 'Access-Con`
  - `console: Access to fetch at 'https://dl.rhone.com/collections from origin 'https://www.rhone.com' has been blocked by CORS polic`
  - `console: Access to fetch at 'https://dl.rhone.com/collections from origin 'https://www.rhone.com' has been blocked by CORS policy: No `
- **163. tenthousand.cc product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `uncaught: Uncaught (in promise) Error: Unauthorized`
  - `console: Unveild: error in intercepting window.fetch TypeError: Failed to fetch`
  - `uncaught: condition rejected ()=>!!document.body`

### Every pair

#### 31. llbean.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.llbean.com/llb/shop/129613`

- r1 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links
- r1 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links · personalization matches 10 [6000 async-px.dynamicyield.com] · tab tally (url) total 11, personalization 10
- r2 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links
- r2 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links
- r3 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 138 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 35. sephora.com product — **PASS**

`https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799?skuId=2837425`

- r1 **OFF** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links
- r1 **ON** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links · personalization matches 7 [6200 apps.rokt-api.com] · tab tally (url) total 10, personalization 3
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti
- r2 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti · personalization matches 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti
- r3 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti · personalization matches 0

#### 39. petsmart.com product — **PASS** — minority differences: r1: add-to-cart worked OFF, not ON

`https://www.petsmart.com/dog/food/dry-food/pedigree-grilled-steak-and-vegetable-flavor-dry-dog-food-70826.html`

- r1 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✓ same-site cart request 200 POST https://www.petsmart.com/api/cwea/v2/carts/items; "added to cart/bag" message appeared · search 40 links
- r1 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no visible, enabled add-to-cart control · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1
- r2 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links
- r2 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1
- r3 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links
- r3 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1

#### 43. drsquatch.com product (Klaviyo) — **PASS**

`https://www.drsquatch.com/products/mountain-meadow`

- r1 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r1 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 20, personalization 5
- r2 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r2 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 20, personalization 5
- r3 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r3 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 21, personalization 5

#### 47. rothys.com product (Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://rothys.com/products/womens-pointed-toe-flat-black`

- r1 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r1 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 28 [6900 api.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 42, personalization 16
- r2 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r2 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 0 · tab tally (url) total 13, personalization 0
- r3 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r3 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 0 · tab tally (url) total 13, personalization 0

#### 51. ikea.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ikea.com/us/en/p/lack-side-table-white-30449908/`

- r1 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r1 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 22, personalization 0
- r2 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r2 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 27, personalization 0
- r3 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r3 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 20, personalization 0

#### 55. apple.com Buy iPad (many offers) — **PASS**

`https://www.apple.com/shop/buy-ipad/ipad`

- r1 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r1 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r2 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r3 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 59. lowes.com search — **BLOCKED** — HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this server.

Reference #18.140ed217.1792256189.2f178004

https://errors.edgesuite.net/18.140ed217.1792256189.2f178004

`https://www.lowes.com/search?searchTerm=hammer`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv
- r1 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv · personalization matches 0
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv
- r2 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv · personalization matches 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv
- r3 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this serv · personalization matches 0

#### 63. price positive control (fixture, client-side price test) — **PASS**

`null`

- r1 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r1 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r2 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r3 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 67. bananarepublic.gap.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://bananarepublic.gap.com/browse/product.do?pid=1180176022&vid=REGULAR&searchText=shirt`

- r1 **OFF** — http 200 · declared 65.00 USD (json-ld) · rendered 98.00 ("$98.00 $65.00") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 65.00 USD (json-ld) · rendered 98.00 ("$98.00 $65.00") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 65.00 USD (json-ld) · rendered 98.00 ("$98.00 $65.00") · cart ✗ no evidence · search 8 links
- r2 **ON** — http 200 · declared 65.00 USD (json-ld) · rendered 98.00 ("$98.00 $65.00") · cart ✗ no evidence · search 8 links · personalization matches 15 [6500 cdn.granify.com, 6300 cdn.attn.tv, 6710 onsitestats.bluecore.com, 6200 apps.rokt-api.com] · tab tally (url) total 28, personalization 11
- r3 **OFF** — http 200 · declared 65.00 USD (json-ld) · rendered 98.00 ("$98.00 $65.00") · cart ✗ no evidence · search 8 links
- r3 **ON** — http 200 · declared 65.00 USD (json-ld) · rendered 98.00 ("$98.00 $65.00") · cart ✗ no evidence · search 8 links · personalization matches 13 [6500 cdn.granify.com, 6300 cdn.attn.tv, 6200 apps.rokt-api.com, 6710 onsitestats.bluecore.com] · tab tally (url) total 26, personalization 9

#### 71. fashionnova.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.fashionnova.com/products/fairy-hotmother-4-piece-costume-set?color=blue-combo`

- r1 **OFF** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99") · cart ✗ no evidence · personalization matches 6 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 6
- r2 **OFF** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99") · cart ✗ no evidence
- r2 **ON** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99") · cart ✗ no evidence · personalization matches 5 [6950 static-tracking.klaviyo.com] · tab tally (url) total 6, personalization 5
- r3 **OFF** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99") · cart ✗ no evidence · personalization matches 5 [6950 static-tracking.klaviyo.com] · tab tally (url) total 6, personalization 5

#### 75. outdoorvoices.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.outdoorvoices.com/products/m-thinkfast-mesh-muscle-tank-black?variant=42326858039374`

- r1 **OFF** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("Sale price $39.99 Regular price $58") · cart ✗ no evidence · search 37 links
- r1 **ON** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("Sale price $39.99 Regular price $58") · cart ✗ no evidence · search 28 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 9, personalization 4
- r2 **OFF** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("Sale price $39.99 Regular price $58") · cart ✗ no evidence · search 37 links
- r2 **ON** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("Sale price $39.99 Regular price $58") · cart ✗ no evidence · search 28 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 4
- r3 **OFF** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("Sale price $39.99 Regular price $58") · cart ✗ no evidence · search 37 links
- r3 **ON** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("Sale price $39.99 Regular price $58") · cart ✗ no evidence · search 37 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 4

#### 79. tecovas.com product — **PASS**

`https://www.tecovas.com/products/tecovas-x-krewe-stl-ii`

- r1 **OFF** — http 200 · declared 295.00/335.00/415.00 USD (json-ld-set(3)) · rendered 415.00 ("Price: $415") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 295.00/335.00/415.00 USD (json-ld-set(3)) · rendered 415.00 ("Price: $415") · cart ✓ same-site cart request 200 POST https://www.tecovas.com/api/cart.data; "added to cart/bag" message appeared; cart badge 0→1 · personalization matches 2 [6400 tag.wknd.ai, 6300 cdn.attn.tv] · tab tally (url) total 4, personalization 2
- r2 **OFF** — http 200 · declared 295.00/335.00/415.00 USD (json-ld-set(3)) · rendered 415.00 ("Price: $415") · cart ✓ same-site cart request 200 POST https://www.tecovas.com/api/cart.data; "added to cart/bag" message appeared; cart badge 0→1
- r2 **ON** — http 200 · declared 295.00/335.00/415.00 USD (json-ld-set(3)) · rendered 415.00 ("Price: $415") · cart ✓ same-site cart request 200 POST https://www.tecovas.com/api/cart.data; "added to cart/bag" message appeared; cart badge 1→2 · personalization matches 1 [6400 tag.wknd.ai] · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 295.00/335.00/415.00 USD (json-ld-set(3)) · rendered 415.00 ("Price: $415") · cart ✓ same-site cart request 200 POST https://www.tecovas.com/api/cart.data; "added to cart/bag" message appeared; cart badge 1→2
- r3 **ON** — http 200 · declared 295.00/335.00/415.00 USD (json-ld-set(3)) · rendered 415.00 ("Price: $415") · cart ✓ same-site cart request 200 POST https://www.tecovas.com/api/cart.data; "added to cart/bag" message appeared; cart badge 2→3 · personalization matches 1 [6400 tag.wknd.ai] · tab tally (url) total 1, personalization 0

#### 83. elfcosmetics.com product — **PASS**

`https://www.elfcosmetics.com/products/glow-reviver-melting-lip-balm?Color=Birthday+Cake`

- r1 **OFF** — http 200 · declared 9.00 USD (json-ld) · cart ✗ no evidence · search 10 links
- r1 **ON** — http 200 · declared 9.00 USD (json-ld) · cart ✗ no evidence · search 10 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 9.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.elfcosmetics.com/cart.data · search 10 links
- r2 **ON** — http 200 · declared 9.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.elfcosmetics.com/cart.data; cart badge 0→1 · search 10 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 9.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.elfcosmetics.com/cart.data · search 10 links
- r3 **ON** — http 200 · declared 9.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.elfcosmetics.com/cart.data · search 10 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 87. maccosmetics.com product — **PASS**

`https://www.maccosmetics.com/product/13854/123863/products/makeup/lips/lipstick/macximal-silky-matte-lipstick`

- r1 **OFF** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("REGULAR PRICE $25.00 0.12 oz") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.maccosmetics.com/cart/add total 25.00
- r1 **ON** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("REGULAR PRICE $25.00 0.12 oz") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.maccosmetics.com/cart/add total 25.00 · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("REGULAR PRICE $25.00 0.12 oz") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.maccosmetics.com/apps/talonone-proxy/api/public/cart/compute total 25.00
- r2 **ON** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("REGULAR PRICE $25.00 0.12 oz") · cart ✓ same-site cart request 200 POST https://www.maccosmetics.com/cart/update.js · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("REGULAR PRICE $25.00 0.12 oz") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.maccosmetics.com/apps/talonone-proxy/api/public/cart/compute total 25.00
- r3 **ON** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("REGULAR PRICE $25.00 0.12 oz") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.maccosmetics.com/apps/talonone-proxy/api/public/cart/compute total 25.00 · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 91. jcpenney.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.jcpenney.com/p/mixit-cozy-womens-2-pair-crew-socks/ppr5008323563?pTmplType=regular&searchTerm=socks`

- r1 **OFF** — http 200 · declared 3.59 USD (json-ld) · cart ✗ no evidence · search 60 links
- r1 **ON** — http 200 · declared 3.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 3.59 USD (json-ld) · cart ✗ no evidence · search 60 links
- r2 **ON** — http 200 · declared 3.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 304 · declared 3.59 USD (json-ld) · cart ✗ no evidence · search 60 links
- r3 **ON** — http 304 · declared 3.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 95. beistravel.com product — **PASS**

`https://beistravel.com/products/the-air-pouch-set-in-black`

- r1 **OFF** — http 200 · declared 78.00 USD (json-ld) · rendered 78.00 ("Regular price $78") · cart ✗ no evidence · search 38 links
- r1 **ON** — http 200 · declared 78.00 USD (json-ld) · rendered 78.00 ("Regular price $78") · cart ✗ no evidence · search 38 links · personalization matches 13 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 17, personalization 7
- r2 **OFF** — http 200 · declared 78.00 USD (json-ld) · rendered 78.00 ("Regular price $78") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://beistravel.com/cart/add.js total 78.00 · search 39 links
- r2 **ON** — http 200 · declared 78.00 USD (json-ld) · rendered 78.00 ("Regular price $78") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://beistravel.com/cart/add.js total 78.00 · search 39 links · personalization matches 12 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 15, personalization 6
- r3 **OFF** — http 200 · declared 78.00 USD (json-ld) · rendered 78.00 ("Regular price $78") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://beistravel.com/cart/add.js total 78.00 · search 39 links
- r3 **ON** — http 200 · declared 78.00 USD (json-ld) · rendered 78.00 ("$78.00") · cart ✓ Shopify /cart.js item_count 1→2 total 78.00 · search 39 links · personalization matches 12 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 15, personalization 6

#### 99. brightland.co product — **PASS**

`https://brightland.co/products/the-pizza-night-set`

- r1 **OFF** — http 200 · declared 98.00 USD (json-ld) · rendered 83.30 ("The Pizza Night Set Sale price $83.30 REGULAR PRIC") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://brightland.co/cart/add.js total 83.30 · search 25 links
- r1 **ON** — http 200 · declared 98.00 USD (json-ld) · rendered 83.30 ("The Pizza Night Set Sale price $83.30 REGULAR PRIC") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://brightland.co/cart/add.js total 83.30 · search 25 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com] · tab tally (url) total 11, personalization 5
- r2 **OFF** — http 200 · declared 98.00 USD (json-ld) · rendered 83.30 ("The Pizza Night Set Sale price $83.30 REGULAR PRIC") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://brightland.co/cart/add.js total 83.30 · search 25 links
- r2 **ON** — http 200 · declared 98.00 USD (json-ld) · rendered 83.30 ("The Pizza Night Set Sale price $83.30 REGULAR PRIC") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://brightland.co/cart/add.js total 83.30 · search 25 links · personalization matches 13 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com] · tab tally (url) total 13, personalization 7
- r3 **OFF** — http 200 · declared 98.00 USD (json-ld) · rendered 83.30 ("The Pizza Night Set Sale price $83.30 REGULAR PRIC") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://brightland.co/cart/add.js total 83.30 · search 25 links
- r3 **ON** — http 200 · declared 98.00 USD (json-ld) · rendered 83.30 ("The Pizza Night Set Sale price $83.30 REGULAR PRIC") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://brightland.co/cart/add.js total 83.30 · search 25 links · personalization matches 13 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com] · tab tally (url) total 13, personalization 7

#### 103. cupshe.com product — **PASS**

`https://www.cupshe.com/products/fall-charm-plaid-maxi-dress-CAA05E6K032RE`

- r1 **OFF** — http 200 · declared 46.00 USD (json-ld) · rendered 46.00 ("New Fall Charm Plaid Maxi Dress $46.00") · cart ✓ same-site cart request 200 POST https://bff-scfs.cupshe.com/bff-scfs/cart/addSku; "added to cart/bag" message appeared; cart badge 0→1
- r1 **ON** — http 200 · declared 46.00 USD (json-ld) · rendered 46.00 ("New Fall Charm Plaid Maxi Dress $46.00") · cart ✓ same-site cart request 200 POST https://bff-scfs.cupshe.com/bff-scfs/cart/addSku; "added to cart/bag" message appeared; cart badge 0→1 · personalization matches 0 · tab tally (url) total 5, personalization 0
- r2 **OFF** — http 200 · declared 46.00 USD (json-ld) · rendered 46.00 ("New Fall Charm Plaid Maxi Dress $46.00") · cart ✓ same-site cart request 200 POST https://bff-scfs.cupshe.com/bff-scfs/cart/queryCartNum; "added to cart/bag" message appeared; cart badge 1→2
- r2 **ON** — http 200 · declared 46.00 USD (json-ld) · rendered 46.00 ("New Fall Charm Plaid Maxi Dress $46.00") · cart ✓ same-site cart request 200 POST https://bff-scfs.cupshe.com/bff-scfs/cart/queryCartNum; "added to cart/bag" message appeared; cart badge 1→2 · personalization matches 0 · tab tally (url) total 5, personalization 0
- r3 **OFF** — http 200 · declared 46.00 USD (json-ld) · rendered 46.00 ("New Fall Charm Plaid Maxi Dress $46.00") · cart ✓ same-site cart request 200 POST https://bff-scfs.cupshe.com/bff-scfs/cart/queryCartNum; "added to cart/bag" message appeared; cart badge 2→3
- r3 **ON** — http 200 · declared 46.00 USD (json-ld) · rendered 46.00 ("New Fall Charm Plaid Maxi Dress $46.00") · cart ✓ same-site cart request 200 POST https://bff-scfs.cupshe.com/bff-scfs/cart/queryCartNum; "added to cart/bag" message appeared; cart badge 2→3 · personalization matches 0 · tab tally (url) total 5, personalization 0

#### 107. glowrecipe.com product — **PASS**

`https://www.glowrecipe.com/products/glow-recipe-x-buldak-glass-balm-lip-duo`

- r1 **OFF** — http 200 · declared 38.00 USD (json-ld) · rendered 38.00 ("$38") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.glowrecipe.com/cart/add.js; cart badge 0→1 total 38.00 · search 55 links
- r1 **ON** — http 200 · declared 38.00 USD (json-ld) · rendered 38.00 ("$38") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.glowrecipe.com/cart/add.js; cart badge 0→1 total 38.00 · search 55 links · personalization matches 10 [6800 cdn-4.convertexperiments.com, 6400 tag.wknd.ai, 6950 static-tracking.klaviyo.com] · tab tally (url) total 18, personalization 8
- r2 **OFF** — http 200 · declared 38.00 USD (json-ld) · rendered 38.00 ("$38") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.glowrecipe.com/cart/update.js; cart badge 1→2 total 38.00 · search 56 links
- r2 **ON** — http 200 · declared 38.00 USD (json-ld) · rendered 38.00 ("$38") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.glowrecipe.com/cart/add.js; cart badge 1→2 total 38.00 · search 56 links · personalization matches 10 [6800 cdn-4.convertexperiments.com, 6400 tag.wknd.ai, 6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 8
- r3 **OFF** — http 200 · declared 38.00 USD (json-ld) · rendered 38.00 ("$38") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.glowrecipe.com/cart/add.js; cart badge 2→3 total 38.00 · search 56 links
- r3 **ON** — http 200 · declared 38.00 USD (json-ld) · rendered 38.00 ("$38") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.glowrecipe.com/cart/add.js; cart badge 2→3 total 38.00 · search 56 links · personalization matches 4 [6800 cdn-4.convertexperiments.com, 6400 tag.wknd.ai] · tab tally (url) total 9, personalization 2

#### 111. jonesroadbeauty.com product — **PASS** — minority differences: r3: add-to-cart worked OFF, not ON

`https://www.jonesroadbeauty.com/products/the-bobbi-kit-6?variant=46563510911126`

- r1 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 166.00 ("$166 $88") · cart ✗ no evidence · search 82 links
- r1 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 166.00 ("$166 $88") · cart ✗ no evidence · search 74 links · personalization matches 34 [6950 static-tracking.klaviyo.com, 6900 api.intelligems.io] · tab tally (url) total 46, personalization 17
- r2 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 166.00 ("$166 $88") · cart ✗ no evidence · search 82 links
- r2 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 166.00 ("$166 $88") · cart ✗ no evidence · search 74 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 32, personalization 5
- r3 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 166.00 ("$166 $88") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.jonesroadbeauty.com/cart/update.js; cart badge 0→1 total 88.00 · search 85 links
- r3 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 166.00 ("$166 $88") · cart ✗ no evidence · search 74 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 24, personalization 5

#### 115. manscaped.com product — **PASS**

`https://www.manscaped.com/products/lawn-mower-gen6`

- r1 **OFF** — http 200 · declared 109.99 USD (json-ld) · cart ✓ "added to cart/bag" message appeared; cart badge 0→2
- r1 **ON** — http 200 · declared 109.99 USD (json-ld) · cart ✓ "added to cart/bag" message appeared; cart badge 0→2 · personalization matches 4 [6950 static-tracking.klaviyo.com] · tab tally (url) total 15, personalization 4
- r2 **OFF** — http 200 · declared 109.99 USD (json-ld) · cart ✓ "added to cart/bag" message appeared; cart badge 2→3
- r2 **ON** — http 200 · declared 109.99 USD (json-ld) · cart ✓ "added to cart/bag" message appeared; cart badge 2→3 · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 109.99 USD (json-ld) · cart ✓ "added to cart/bag" message appeared; cart badge 3→4
- r3 **ON** — http 200 · declared 109.99 USD (json-ld) · cart ✓ "added to cart/bag" message appeared; cart badge 3→4 · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 119. nativecos.com product — **FAIL** — ON read a price OFF never read: 19.50 — r2: CART PRICE DIFFERS: OFF 39.00 vs ON 15.60 \| r3: CART PRICE DIFFERS: OFF 15.60 vs ON 19.50

`https://www.nativecos.com/products/starter-set?variant=67614907170990`

- r1 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✗ no evidence · search 20 links
- r1 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.nativecos.com/cart/add.js total 39.00 · search 22 links · personalization matches 16 [6801 dcinfos-cache.abtasty.com, 6300 cdn.attn.tv, 6715 rebuyengine.com, 6801 ariane.abtasty.com] · tab tally (url) total 12, personalization 7
- r2 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; "added to cart/bag" message appeared; cart badge 0→1 total 39.00 · search 22 links
- r2 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 4→5; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 4→5 total 15.60 · search 25 links · personalization matches 18 [6801 dcinfos-cache.abtasty.com, 6801 ariane.abtasty.com, 6300 cdn.attn.tv, 6715 rebuyengine.com] · tab tally (url) total 13, personalization 9
- r3 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 4→5; same-site cart request 200 POST https://www.nativecos.com/cart/add.js total 15.60 · search 25 links
- r3 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 5→6; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 5→6 total 19.50 · search 25 links · personalization matches 18 [6801 ariane.abtasty.com, 6300 cdn.attn.tv, 6801 dcinfos-cache.abtasty.com, 6715 rebuyengine.com] · tab tally (url) total 15, personalization 10

#### 123. parachutehome.com product — **PASS** — minority differences: r1: add-to-cart worked OFF, not ON

`https://parachutehome.com/products/brushed-cotton-pillowcase-set-bone?_rdiscovery-handle=brushed-cotton-pillowcase-set-bone&_rdiscovery-smart-search-feature=Quick%20View&_rdiscovery-search-term=`

- r1 **OFF** — http 200 · declared 59.00/69.00 USD (json-ld-set(2)) · rendered 59.00 ("$59") · cart ✓ same-site cart request 200 POST https://parachutehome.com/cart/update.js
- r1 **ON** — http 200 · declared 59.00/69.00 USD (json-ld-set(2)) · rendered 59.00 ("$59") · cart ✗ no evidence · personalization matches 18 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6300 cdn.attn.tv] · tab tally (url) total 23, personalization 17
- r2 **OFF** — http 200 · declared 59.00/69.00 USD (json-ld-set(2)) · rendered 59.00 ("$59") · cart ✗ no evidence
- r2 **ON** — http 200 · declared 59.00/69.00 USD (json-ld-set(2)) · rendered 59.00 ("$59") · cart ✗ no evidence · personalization matches 6 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 15, personalization 6
- r3 **OFF** — http 200 · declared 59.00/69.00 USD (json-ld-set(2)) · rendered 59.00 ("$59") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 59.00/69.00 USD (json-ld-set(2)) · rendered 59.00 ("$59") · cart ✗ no evidence · personalization matches 6 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 15, personalization 6

#### 127. ritual.com product — **PASS**

`https://ritual.com/products/postpartum-support-starter-set`

- r1 **OFF** — http 200 · declared 128.00 USD (json-ld) · rendered 74.25 ("Sale price $74.25 Regular price $124 (total value)") · cart ✗ no evidence · search 17 links
- r1 **ON** — http 200 · declared 128.00 USD (json-ld) · rendered 74.25 ("Sale price $74.25 Regular price $124 (total value)") · cart ✓ Shopify /cart.js item_count 0→2; same-site cart request 200 POST https://ritual.com/cart/add.js total 37.13 · search 23 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 5
- r2 **OFF** — http 200 · declared 128.00 USD (json-ld) · rendered 74.25 ("Sale price $74.25 Regular price $124 (total value)") · cart ✗ no evidence · search 17 links
- r2 **ON** — http 200 · declared 128.00 USD (json-ld) · rendered 74.25 ("Sale price $74.25 Regular price $124 (total value)") · cart ✓ Shopify /cart.js item_count 2→4; same-site cart request 200 POST https://ritual.com/cart/add.js total 43.31 · search 23 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 12, personalization 5
- r3 **OFF** — http 200 · declared 128.00 USD (json-ld) · rendered 74.25 ("Sale price $74.25 Regular price $124 (total value)") · cart ✗ no evidence · search 17 links
- r3 **ON** — http 200 · declared 128.00 USD (json-ld) · rendered 74.25 ("Sale price $74.25 Regular price $124 (total value)") · cart ✓ Shopify /cart.js item_count 4→6; same-site cart request 200 POST https://ritual.com/cart/add.js total 45.38 · search 23 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 12, personalization 5

#### 131. summerfridays.com product — **FAIL** — ON read a price OFF never read: 163.00 — 

`https://www.summerfridays.com/products/the-lip-butter-balm-vault`

- r1 **OFF** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://summerfridays.com/cart/update.js; cart badge 0→1 total 315.00 · search 51 links
- r1 **ON** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://summerfridays.com/cart/add.js total 315.00 · search 51 links · personalization matches 5 [6300 cdn.attn.tv, 6900 api.intelligems.io] · tab tally (url) total 5, personalization 1
- r2 **OFF** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://summerfridays.com/cart/update.js; "added to cart/bag" message appeared; cart badge 2→3 total 210.00 · search 51 links
- r2 **ON** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://summerfridays.com/cart/update.js total 210.00 · search 51 links · personalization matches 3 [6300 cdn.attn.tv, 6900 api.intelligems.io] · tab tally (url) total 5, personalization 1
- r3 **OFF** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✗ no evidence · search 51 links
- r3 **ON** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 3→4; same-site cart request 200 POST https://summerfridays.com/cart/update.js total 163.00 · search 53 links · personalization matches 4 [6300 cdn.attn.tv, 6900 api.intelligems.io] · tab tally (url) total 5, personalization 1

#### 135. bhphotovideo.com product — **PASS**

`https://www.bhphotovideo.com/c/product/1762222-REG/belkin_cab014bt2mbk_100w_usb_c_to_usb_c.html`

- r1 **OFF** — http 200 · declared 12.05 USD (json-ld) · rendered 12.05 ("$12.05") · cart ✓ same-site cart request 200 POST https://www.bhphotovideo.com/api/cart/add; "added to cart/bag" message appeared · search 56 links
- r1 **ON** — http 200 · declared 12.05 USD (json-ld) · rendered 12.05 ("$12.05") · cart ✓ same-site cart request 200 POST https://www.bhphotovideo.com/api/cart/add; "added to cart/bag" message appeared · search 56 links · personalization matches 0 · tab tally (url) total 8, personalization 0
- r2 **OFF** — http 200 · declared 12.05 USD (json-ld) · rendered 12.05 ("$12.05") · cart ✗ no visible, enabled add-to-cart control · search 56 links
- r2 **ON** — http 200 · declared 12.05 USD (json-ld) · rendered 12.05 ("$12.05") · cart ✗ no visible, enabled add-to-cart control · search 56 links · personalization matches 0 · tab tally (url) total 8, personalization 0
- r3 **OFF** — http 200 · declared 12.05 USD (json-ld) · rendered 12.05 ("$12.05") · cart ✗ no visible, enabled add-to-cart control · search 56 links
- r3 **ON** — http 200 · declared 12.05 USD (json-ld) · rendered 12.05 ("$12.05") · cart ✗ no visible, enabled add-to-cart control · search 56 links · personalization matches 0 · tab tally (url) total 8, personalization 0

#### 139. newegg.com product — **PASS**

`https://www.newegg.com/p/pl?N=4812&cm_sp=Head_Navigation-_-Under_Search_Bar-_-Combo+deals`

- r1 **OFF** — http 200 · rendered 174.98 ("$ 174 .98") · cart ✓ "added to cart/bag" message appeared; cart badge 0→2
- r1 **ON** — http 200 · rendered 174.98 ("$ 174 .98") · cart ✓ "added to cart/bag" message appeared; cart badge 0→2 · personalization matches 0 · tab tally (url) total 5, personalization 0
- r2 **OFF** — http 200 · rendered 174.98 ("$ 174 .98") · cart ✓ "added to cart/bag" message appeared; cart badge 2→4
- r2 **ON** — http 200 · rendered 174.98 ("$ 174 .98") · cart ✓ "added to cart/bag" message appeared; cart badge 2→4 · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · rendered 174.98 ("$ 174 .98") · cart ✓ "added to cart/bag" message appeared
- r3 **ON** — http 200 · rendered 174.98 ("$ 174 .98") · cart ✓ "added to cart/bag" message appeared; cart badge 4→6 · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 143. castlery.com product — **PASS**

`https://www.castlery.com/us/products/owen-ii-ottoman`

- r1 **OFF** — http 200 · declared 499.00 USD (json-ld) · rendered 44.00 ("$44") · cart ✓ same-site cart request 200 POST https://apigw-us-prod.castlery.com/api/v1/cart/line-items
- r1 **ON** — http 200 · declared 499.00 USD (json-ld) · rendered 44.00 ("$44") · cart ✓ same-site cart request 200 POST https://apigw-us-prod.castlery.com/api/v1/cart/line-items · personalization matches 13 [6000 async-px.dynamicyield.com, 6950 static-tracking.klaviyo.com] · tab tally (url) total 32, personalization 13
- r2 **OFF** — http 200 · declared 499.00 USD (json-ld) · rendered 44.00 ("$44") · cart ✓ same-site cart request 200 POST https://apigw-us-prod.castlery.com/api/v1/cart/line-items
- r2 **ON** — http 200 · declared 499.00 USD (json-ld) · rendered 44.00 ("$44") · cart ✓ same-site cart request 200 POST https://apigw-us-prod.castlery.com/api/v1/cart/line-items · personalization matches 20 [6950 static-tracking.klaviyo.com, 6000 async-px.dynamicyield.com] · tab tally (url) total 37, personalization 20
- r3 **OFF** — http 200 · declared 499.00 USD (json-ld) · rendered 44.00 ("$44") · cart ✓ same-site cart request 200 POST https://apigw-us-prod.castlery.com/api/v1/cart/line-items
- r3 **ON** — http 200 · declared 499.00 USD (json-ld) · rendered 44.00 ("$44") · cart ✓ same-site cart request 200 POST https://apigw-us-prod.castlery.com/api/v1/cart/line-items · personalization matches 14 [6950 static-tracking.klaviyo.com, 6000 async-px.dynamicyield.com] · tab tally (url) total 27, personalization 14

#### 147. truevalue.com product — **PASS**

`https://www.truevalue.com/product/533392/first-alert-sm210l-10-year-battery-photoelectric-smoke-alarm-with-safety-path-light-533392/`

- r1 **OFF** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99 In-store price may vary. Not all products a") · cart ✓ same-site cart request 200 POST https://www.truevalue.com/api/graphql; "added to cart/bag" message appeared; cart badge 0→1 · search 27 links
- r1 **ON** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99 In-store price may vary. Not all products a") · cart ✓ same-site cart request 200 POST https://www.truevalue.com/api/graphql; "added to cart/bag" message appeared; cart badge 0→1 · search 10 links · personalization matches 0 · tab tally (url) total 5, personalization 0
- r2 **OFF** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99 In-store price may vary. Not all products a") · cart ✓ same-site cart request 200 POST https://www.truevalue.com/api/graphql; "added to cart/bag" message appeared; cart badge 1→2 · search 27 links
- r2 **ON** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99 In-store price may vary. Not all products a") · cart ✓ same-site cart request 200 POST https://www.truevalue.com/api/graphql; cart badge 1→2 · search 10 links · personalization matches 0 · tab tally (url) total 5, personalization 0
- r3 **OFF** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99 In-store price may vary. Not all products a") · cart ✓ same-site cart request 200 POST https://www.truevalue.com/api/graphql; "added to cart/bag" message appeared; cart badge 2→3 · search 27 links
- r3 **ON** — http 200 · declared 44.99 USD (json-ld) · rendered 44.99 ("$44.99 In-store price may vary. Not all products a") · cart ✓ same-site cart request 200 POST https://www.truevalue.com/api/graphql; "added to cart/bag" message appeared; cart badge 2→3 · search 10 links · personalization matches 0 · tab tally (url) total 5, personalization 0

#### 151. walgreens.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.walgreens.com/store/c/productlist/N=20007800`

- r1 **OFF** — http 200 · rendered 129.99 ("Previous price was $129.99 Current sale price is $") · cart ✗ no evidence · search 31 links
- r1 **ON** — http 200 · rendered 129.99 ("Previous price was $129.99 Current sale price is $") · cart ✗ no evidence · search 31 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · rendered 129.99 ("Previous price was $129.99 Current sale price is $") · cart ✗ no evidence · search 31 links
- r2 **ON** — http 200 · rendered 129.99 ("Previous price was $129.99 Current sale price is $") · cart ✗ no evidence · search 31 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · rendered 129.99 ("Previous price was $129.99 Current sale price is $") · cart ✗ no evidence · search 31 links
- r3 **ON** — http 200 · rendered 129.99 ("Previous price was $129.99 Current sale price is $") · cart ✗ no evidence · search 31 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 155. us.puma.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://us.puma.com/us/en/pd/mens-half-terry-quarter-length-socks-6-pairs/942729?search=true&swatch=01`

- r1 **OFF** — http 200 · declared 16.99/18.00/24.00 USD (json-ld-set(3)) · cart ✗ no evidence · search 24 links
- r1 **ON** — http 200 · declared 16.99/18.00/24.00 USD (json-ld-set(3)) · cart ✗ no evidence · search 24 links · personalization matches 6 [6801 dcinfos-cache.abtasty.com, 6102 cdn.brcdn.com] · tab tally (url) total 8, personalization 3
- r2 **OFF** — http 304 · declared 16.99/18.00/24.00 USD (json-ld-set(3)) · cart ✗ no evidence · search 24 links
- r2 **ON** — http 304 · declared 16.99/18.00/24.00 USD (json-ld-set(3)) · cart ✗ no evidence · search 24 links · personalization matches 6 [6801 dcinfos-cache.abtasty.com, 6102 cdn.brcdn.com] · tab tally (url) total 8, personalization 3
- r3 **OFF** — http 304 · declared 16.99/18.00/24.00 USD (json-ld-set(3)) · cart ✗ no evidence · search 24 links
- r3 **ON** — http 304 · declared 16.99/18.00/24.00 USD (json-ld-set(3)) · cart ✗ no evidence · search 24 links · personalization matches 6 [6801 dcinfos-cache.abtasty.com, 6102 cdn.brcdn.com] · tab tally (url) total 8, personalization 3

#### 159. rhone.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.rhone.com/products/mens-7-pursuit-short-unlined/?variant=48298771415232`

- r1 **OFF** — http 200 · declared 44.40/51.80/59.20/74.00/80.00 USD (json-ld-set(5)) · rendered 74.00 ("$74 2 for 15% off or 3+ for 20% off (1004) Write a") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · declared 44.40/51.80/59.20/74.00/80.00 USD (json-ld-set(5)) · rendered 74.00 ("$74 2 for 15% off or 3+ for 20% off (1004) Write a") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 5, personalization 0
- r2 **OFF** — http 200 · declared 44.40/51.80/59.20/74.00/80.00 USD (json-ld-set(5)) · rendered 74.00 ("$74 2 for 15% off or 3+ for 20% off (1004) Write a") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 44.40/51.80/59.20/74.00/80.00 USD (json-ld-set(5)) · rendered 74.00 ("$74 2 for 15% off or 3+ for 20% off (1004) Write a") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 5, personalization 0
- r3 **OFF** — http 200 · declared 44.40/51.80/59.20/74.00/80.00 USD (json-ld-set(5)) · rendered 74.00 ("$74 2 for 15% off or 3+ for 20% off (1004) Write a") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 44.40/51.80/59.20/74.00/80.00 USD (json-ld-set(5)) · rendered 74.00 ("$74 2 for 15% off or 3+ for 20% off (1004) Write a") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 5, personalization 0

#### 163. tenthousand.cc product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.tenthousand.cc/products/go-short?variant=44151678533719`

- r1 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88") · cart ✗ no visible, enabled add-to-cart control · search 19 links
- r1 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88") · cart ✗ no visible, enabled add-to-cart control · search 19 links · personalization matches 17 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 24, personalization 5
- r2 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88") · cart ✗ no visible, enabled add-to-cart control · search 19 links
- r2 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88") · cart ✗ no visible, enabled add-to-cart control · search 19 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 26, personalization 7
- r3 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88") · cart ✗ no visible, enabled add-to-cart control · search 19 links
- r3 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88") · cart ✗ no visible, enabled add-to-cart control · search 19 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 26, personalization 7

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 31 | llbean.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 35 | sephora.com product | PASS | PASS | **PASS** |  |
| 39 | petsmart.com product | FAIL | PASS | **PASS** | minority differences: r1: add-to-cart worked OFF, not ON |
| 43 | drsquatch.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 47 | rothys.com product (Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 51 | ikea.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 55 | apple.com Buy iPad (many offers) | PASS | PASS | **PASS** |  |
| 59 | lowes.com search | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this server.

Reference #18.140ed217.1792256189.2 |
| 63 | price positive control (fixture, client-side price test) | PASS | PASS | **PASS** |  |
| 67 | bananarepublic.gap.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 71 | fashionnova.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 75 | outdoorvoices.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 79 | tecovas.com product | PASS | FAIL | **PASS** |  |
| 83 | elfcosmetics.com product | FAIL | FAIL | **PASS** |  |
| 87 | maccosmetics.com product | PASS | PASS | **PASS** |  |
| 91 | jcpenney.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 95 | beistravel.com product | FAIL | FAIL | **PASS** |  |
| 99 | brightland.co product | PASS | PASS | **PASS** |  |
| 103 | cupshe.com product | PASS | PASS | **PASS** |  |
| 107 | glowrecipe.com product | PASS | PASS | **PASS** |  |
| 111 | jonesroadbeauty.com product | FAIL | FAIL | **PASS** | minority differences: r3: add-to-cart worked OFF, not ON |
| 115 | manscaped.com product | PASS | PASS | **PASS** |  |
| 119 | nativecos.com product | PASS | FAIL | **FAIL** | ON read a price OFF never read: 19.50 — r2: CART PRICE DIFFERS: OFF 39.00 vs ON 15.60 \| r3: CART PRICE DIFFERS: OFF 15.60 vs ON 19.50 |
| 123 | parachutehome.com product | FAIL | PASS | **PASS** | minority differences: r1: add-to-cart worked OFF, not ON |
| 127 | ritual.com product | PASS | FAIL | **PASS** |  |
| 131 | summerfridays.com product | PASS | PASS | **FAIL** | ON read a price OFF never read: 163.00 —  |
| 135 | bhphotovideo.com product | PASS | PASS | **PASS** |  |
| 139 | newegg.com product | PASS | PASS | **PASS** |  |
| 143 | castlery.com product | PASS | PASS | **PASS** |  |
| 147 | truevalue.com product | PASS | PASS | **PASS** |  |
| 151 | walgreens.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 155 | us.puma.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 159 | rhone.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 163 | tenthousand.cc product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |

**Totals:** 11 NOT-OURS, 20 PASS, 1 BLOCKED, 2 FAIL

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- jcpenney.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- brightland.co product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- ritual.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
