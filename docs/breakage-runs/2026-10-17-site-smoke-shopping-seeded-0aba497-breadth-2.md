# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `bda1fa6e67c4ca3edcb7c1c8bf80c2cd84764190494d47ab424af34a745ce326`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `0aba497` (ext/ and harness/ clean)
- **Runtime:** 2993s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:49500` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

34 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://efgofnbfohilclbfeohblnoofoohcpde/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 30 | jetblue.com home (Dynamic Yield content) | Dynamic Yield (render hosts: cookie-strip only) | **PASS** | — = — | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | 6000×10 | 3, 4, 3 | 0 |
| 34 | staples.com product | Bloomreach, Rokt, Attentive | **PASS** | 49.99 = 49.99 | 49.99 = 49.99 | — = — | ✗✓✗ / ✓✗✗ | 8/8/8 / 8/8/8 | — | 0, 0, 0 | 1 |
| 38 | target.com product | Attentive | **NOT-OURS** | — = — | 119.99/— = 119.99/— | — = — | ✗✗✗ / ✗✗✗ | 0/0/0 / 0/0/0 | — | 0, 0, 0 | 1 |
| 42 | instacart.com home | Rokt | **PASS** | — = — | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 46 | colourpop.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems, Attentive, Nosto | **PASS** | 24.00 = 24.00 | — = — | **—/24.00 → 24.00** | ✗✓✓ / ✓✓✓ | 51/54/54 / 54/54/54 | 6300×10 6704×3 6900×19 6950×21 | 17, 5, 5 | 2 |
| 50 | bestbuy.com product | — | **ERROR** |  =  |  =  |  =  | · / · |  /  | — | 0 | 15 |
| 54 | ulta.com product | — | **NOT-OURS** | 13.99 = 13.99 | 13.99 = 13.99 | — = — | ✗✗✗ / ✗✗✗ | 72/73/78 / 71/75/75 | — | 0, 0, 0 | 1 |
| 58 | costco.com bath towels | — | **PASS** | — = — | 26.99 = 26.99 | — = — | ··· / ··· | 25/25/25 / 25/25/25 | — | 0, 0, 0 | 4 |
| 62 | macys.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | 0 | 2 |
| 66 | athleta.gap.com product | Rokt, Attentive, Granify, Bluecore | **NOT-OURS** | 53.40 = 53.40 | 89.00 = 89.00 | — = — | ✗✗✗ / ✗✗✗ | 8/8/8 / 8/8/8 | 6200×12 6300×2 6500×2 6710×12 | 0, 2, 9 | 2 |
| 70 | everlane.com product | Bloomreach, Attentive, Intelligems, Klaviyo | **NOT-OURS** | 34.00 = 34.00 | 34.00 = 34.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6300×7 6900×6 6950×15 | 14, 7, 7 | 6 |
| 74 | oldnavy.gap.com product | Rokt, Attentive, Granify, Bluecore | **NOT-OURS** | 24.99 = 24.99 | 24.99 = 24.99 | — = — | ✗✗✗ / ✗✗✗ | 8/8/8 / 8/8/8 | 6200×18 6300×4 6500×4 6710×23 | 11, 9, 9 | 2 |
| 78 | skims.com product | Dynamic Yield, Attentive, Coveo, Klaviyo | **NOT-OURS** | 64.00 = 64.00 | 64.00 = 64.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6000×22 | 10, 6, 6 | 1 |
| 82 | vuoriclothing.com product | AB Tasty, Klaviyo | **NOT-OURS** | 88.00 = 88.00 | 88.00 = 88.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6801×4 6950×12 6952×6 | 10, 6, 6 | 1 |
| 86 | kyliecosmetics.com product | Attentive, Klaviyo | **NOT-OURS** | 66.00 = 66.00 | 66.00 = 66.00 | — = — | ✗✗✗ / ✗✗✗ | 32/32/32 / 32/31/32 | 6300×7 6950×24 | 6, 5, 5 | 0 |
| 90 | rarebeauty.com product | Attentive, Convert, Klaviyo | **PASS** | 32.00 = 32.00 | 45.00 = 45.00 | **—/32.00 → 32.00** | ✗✓✓ / ✓✓✓ | 187/194/194 / 194/160/160 | 6300×13 6800×6 6950×12 | 7, 7, 7 | 1 |
| 94 | baggu.com product | Klaviyo | **NOT-OURS** | 58.00 = 58.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 98 | bombas.com product | Attentive | **PASS** | 74.00 = 74.00 | 74.00 = 74.00 | — = — | ✗✓✓ / ✗✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 12 |
| 102 | comfrt.com product | Rokt, Attentive, Black Crow | **PASS** | 39.00 = 39.00 | 39.00 = 39.00 | 39.00 = 39.00 | ✓✓✓ / ✓✓✓ | 33/33/33 / 33/33/33 | — | 0, 0, 0 | 0 |
| 106 | ghostlifestyle.com product | Intelligems, Klaviyo | **NOT-OURS** | 54.99 = 54.99 | — = — | — = — | ✗✗✗ / ✗✗✗ | 25/25/25 / 25/25/25 | 6900×9 6950×24 | 13, 4, 4 | 1 |
| 110 | iliabeauty.com product | Attentive, Intelligems, Klaviyo | **NOT-OURS** | 25.00 = 25.00 | 25.00 = 25.00 | — = — | ✗✗✗ / ✗✗✗ | 115/111/115 / 125/125/125 | 6300×6 6950×30 | 6, 6, 6 | 1 |
| 114 | liquiddeath.com product | Rebuy, Klaviyo | **PASS** | 159.00 = 159.00 | 159.00 = 159.00 | —/159.00 = —/159.00 | ✗✓✓ / ✗✓✓ | 31/32/28 / 31/32/23 | 6950×45 6952×3 | 7, 5, 5 | 1 |
| 118 | nativecos.com product | Attentive, Rebuy, AB Tasty | **FAIL** | 39.00/42.00 = 39.00/42.00 | 56.00 = 56.00 | **—/39.00/15.60 → 39.00/15.60/19.50** | ✗✓✓ / ✓✓✓ | 19/22/17 / 21/24/16 | 6300×3 6715×28 6801×29 | 9, 9, 13 | 2 |
| 122 | owalalife.com product | Klaviyo | **PASS** | — = — | 39.99 = 39.99 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6950×18 | 6, 6, 6 | 0 |
| 126 | ridge.com product | Intelligems, Klaviyo | **NOT-OURS** | 119.00/257.00 = 119.00/257.00 | 119.00 = 119.00 | — = — | ✗✗✗ / ✗✗✗ | 23/23/23 / 23/23/23 | 6950×30 | 5, 5, 5 | 4 |
| 130 | stanley1913.com product | Klaviyo | **PASS** | 40.00 = 40.00 | 40.00 = 40.00 | 40.00/— = 40.00/— | ✓✓✗ / ✓✓✗ | 37/37/37 / 37/37/37 | 6700×6 6950×30 6952×3 | 5, 5, 5 | 5 |
| 134 | anker.com product | Attentive, Klaviyo | **PASS** | 39.99 = 39.99 | 39.99 = 39.99 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6300×3 6950×9 | 4, 4, 4 | 2 |
| 138 | logitech.com product | Salesforce | **NOT-OURS** | — = — | 99.99 = 99.99 | — = — | ✗ / ✗ | · / · | 6600×6 | 1, 1, 1 | 0 |
| 142 | burrow.com product | Intelligems | **PASS** | 689.00/862.00/1149.00 = 689.00/862.00/1149.00 | — = — | — = — | ✗✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6900×3 | 1, 1, 1 | 1 |
| 146 | gopuff.com product | — | **NOT-OURS** | 11.99 = 11.99 | 11.99 = 11.99 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 1 |
| 150 | iherb.com product | Bloomreach | **PASS** | 6.42 = 6.42 | 6.42 = 6.42 | — = — | ✗✗✗ / ✓✓✗ | 48/48/48 / 48/48/48 | — | 0, 0, 0 | 2 |
| 154 | footlocker.com product | Granify, Bluecore | **NOT-OURS** | 9.99/14.95 = 9.99/14.95 | 14.95 = 14.95 | — = — | ✗✗✗ / ✗✗✗ | 49/49/49 / 49/49/49 | 6500×6 | 1, 1, 1 | 0 |
| 158 | gymshark.com product | — | **NOT-OURS** | 20.00 = 20.00 | 20.00 = 20.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 162 | sportsmans.com product | Listrak | **NOT-OURS** | 16.99 = 16.99 | 16.99 = 16.99 | — = — | ✗✗✗ / ✗✗✗ | 42/42/42 / 42/42/42 | 6713×6 6714×9 | 3, 3, 3 | 0 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 14 PASS, 17 NOT-OURS, 1 ERROR, 1 BLOCKED, 1 FAIL

### Every price difference in every pair — including noise

- 118. nativecos.com product: r2: CART PRICE DIFFERS: OFF 39.00 vs ON 15.60
- 118. nativecos.com product: r3: CART PRICE DIFFERS: OFF 15.60 vs ON 19.50

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 34. staples.com product: r2: add-to-cart worked OFF, not ON
- 50. bestbuy.com product: r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro
- 50. bestbuy.com product: r2: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro
- 50. bestbuy.com product: r3: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro
- 138. logitech.com product: r2: not compared — OFF Navigation timeout of 30000 ms exceeded
- 138. logitech.com product: r3: not compared — OFF Navigation timeout of 30000 ms exceeded

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **30. jetblue.com home (Dynamic Yield content)** (1 blocked-resource line(s))
- **34. staples.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **38. target.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **46. colourpop.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `uncaught: Failed to fetch r.fetch (https://colourpop.com/web-pixels@9f5e#wb#ap#c42m93b2bec3/web-pixel-#@#d5a2ef62c#e49fd58dba0/sandbox/worker.modern.js:1:#)`
- **50. bestbuy.com product** (1 blocked-resource line(s)):
  - `console: getting logger for env: 2 logLevel: warn`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Minified React error ##; visit https://react.dev/errors/# for the full message or use the non-minified dev environment for full errors and additional `
  - `uncaught: n.toLowerCase is not a function`
  - `console: Error: PortalContext not found. Is <PortalProvider> an ancestor of this component?`
  - `uncaught: 'load' is not a valid analyticsQ action type`
  - `uncaught: Failed to fetch`
  - `uncaught: 'pageLoad' is not a valid analyticsQ action type`
- **54. ulta.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **58. costco.com bath towels** (1 blocked-resource line(s)):
  - `console: Error fetching Criteo Data for viewCategory on desktop: Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error loading search page adset Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error loading search page data Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error fetching Criteo Data for viewSearchResults on desktop: Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
- **62. macys.com search** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error fetching GECX token for session ID: FetchError: [POST] "/search/v1/conversation/get-token/public": # `
- **66. athleta.gap.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error sending event to mParticle servers. TypeError: Failed to fetch`
- **70. everlane.com product** (1 blocked-resource line(s)):
  - `uncaught: Failed to fetch r.fetch (https://www.everlane.com/cdn/wpm/s9f5e#wb#ap#c42m93b2bec3m.js:1:#) https://www.everlane.com/web-pixels/strict/app/web-pixel-#`
  - `console: TypeError: Failed to fetch`
  - `uncaught: Failed to fetch window2.fetch (https://www.everlane.com/cdn/shopifycloud/storefront/assets/shop_events_listener-4e26a9ce.js:1:#)`
  - `uncaught: Uncaught (in promise) TypeError: Failed to fetch`
  - `console: Failed to load resource: net::ERR_CONNECTION_RESET`
  - `console: Error fetching product stitching data: TypeError: Failed to fetch`
- **74. oldnavy.gap.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error sending event to mParticle servers. TypeError: Failed to fetch`
- **78. skims.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **82. vuoriclothing.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **86. kyliecosmetics.com product** (1 blocked-resource line(s))
- **90. rarebeauty.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **94. baggu.com product** (1 blocked-resource line(s))
- **98. bombas.com product** (1 blocked-resource line(s)):
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:00:35.#Z PollingDatafileManager: Error fetching datafile: `
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:00:36.#Z PollingDatafileManager: Error fetching datafile: `
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:00:39.#Z PollingDatafileManager: Error fetching datafile: `
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:00:43.#Z PollingDatafileManager: Error fetching datafile: `
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:00:51.#Z PollingDatafileManager: Error fetching datafile: `
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:17:15.#Z PollingDatafileManager: Error fetching datafile: `
  - `console: [OPTIMIZELY] - ERROR #-10-17T17:17:16.#Z PollingDatafileManager: Error fetching datafile: `
- **102. comfrt.com product** (1 blocked-resource line(s))
- **106. ghostlifestyle.com product** (1 blocked-resource line(s)):
  - `console: TypeError: Failed to fetch`
- **110. iliabeauty.com product** (1 blocked-resource line(s)):
  - `console: TypeError: Failed to fetch`
- **114. liquiddeath.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **118. nativecos.com product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `uncaught: Failed to fetch`
- **122. owalalife.com product** (1 blocked-resource line(s))
- **126. ridge.com product** (1 blocked-resource line(s)):
  - `console: ❌ [WAIT-FOR-UTILS] Growi cookie utilities not loaded after 5 retries (#ms total)`
  - `console: ❌ [WAIT-FOR-UTILS] All window properties: [array Array]`
  - `console: ❌ [WAIT-FOR-UTILS] Check if cookie-utils.js is loading correctly`
  - `console: Failed to load resource: net::ERR_NAME_NOT_RESOLVED`
- **130. stanley1913.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: TypeError: Failed to fetch dynamically imported module: https://order.buywithprime.amazon.com/static/storefront-host/logger.browser.js`
  - `uncaught: Failed to fetch dynamically imported module: https://order.buywithprime.amazon.com/static/storefront-host/logger.browser.js`
  - `uncaught: Failed to fetch dynamically imported module: https://order.buywithprime.amazon.com/static/storefront-host/clickstream.browser.js`
  - `uncaught: Uncaught (in promise) AbortError: signal is aborted without reason`
- **134. anker.com product** (1 blocked-resource line(s)):
  - `console: [EW] #-10-17T17:05:26.#Z ERROR: EW quote rejected: `
  - `console: [EW] #-10-17T17:21:41.#Z ERROR: EW quote rejected: `
- **138. logitech.com product** (1 blocked-resource line(s))
- **142. burrow.com product** (1 blocked-resource line(s)):
  - `console: Failed to fetch (cdn.segment.com)`
- **146. gopuff.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] The page shim could NOT patch: canvas.getImageData. That API is UNPROTECTED on this page. A silently-unpatched API is the worst outcome — pl`
- **150. iherb.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
  - `console: Error in getThumbStatusData: [object Object]`
- **154. footlocker.com product** (1 blocked-resource line(s))
- **158. gymshark.com product** (1 blocked-resource line(s))
- **162. sportsmans.com product** (1 blocked-resource line(s))

### Every pair

#### 30. jetblue.com home (Dynamic Yield content) — **PASS**

`https://www.jetblue.com/`

- r1 **OFF** — http 200 · vendor-rendered elements 4
- r1 **ON** — http 200 · vendor-rendered elements 4 · personalization matches 3 [6000 async-px.dynamicyield.com] · tab tally (url) total 5, personalization 3
- r2 **OFF** — http 200 · vendor-rendered elements 4
- r2 **ON** — http 200 · vendor-rendered elements 4 · personalization matches 4 [6000 async-px.dynamicyield.com] · tab tally (url) total 6, personalization 4
- r3 **OFF** — http 200 · vendor-rendered elements 4
- r3 **ON** — http 200 · vendor-rendered elements 4 · personalization matches 3 [6000 async-px.dynamicyield.com] · tab tally (url) total 5, personalization 3

#### 34. staples.com product — **PASS** — minority differences: r2: add-to-cart worked OFF, not ON

`https://www.staples.com/hammermill-copy-plus-8-5-x-11-copy-paper-20-lbs-92-brightness-5000-sheets-carton-105007/product_122374`

- r1 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1 · search 8 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1 · search 8 links
- r2 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✗ no visible, enabled add-to-cart control · search 8 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✗ no visible, enabled add-to-cart control · search 8 links
- r3 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✗ no visible, enabled add-to-cart control · search 8 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 38. target.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links

`https://www.target.com/p/delilah-home-100-organic-cotton-bath-towel-collection/-/A-93159262?preselect=93048164`

- r1 **OFF** — http 200 · rendered 119.99 ("$119.99") · cart ✗ no evidence · search 0 links
- r1 **ON** — http 200 · rendered 119.99 ("$119.99") · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · cart ✗ no evidence · search 0 links
- r2 **ON** — http 200 · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r3 **OFF** — http 200 · cart ✗ no evidence · search 0 links
- r3 **ON** — http 200 · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 42. instacart.com home — **PASS**

`https://www.instacart.com/`

- r1 **OFF** — http 200
- r1 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200
- r2 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200
- r3 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 46. colourpop.com product (Klaviyo, Intelligems) — **PASS**

`https://colourpop.com/products/eeveelution-shadow-palette`

- r1 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✗ no evidence · search 51 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r1 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 31 [6300 cdn.attn.tv, 6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6704 connect.nosto.com] · tab tally (url) total 24, personalization 17
- r2 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r2 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 11 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6900 api.intelligems.io, 6704 connect.nosto.com] · tab tally (url) total 15, personalization 5
- r3 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r3 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 11 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6900 api.intelligems.io, 6704 connect.nosto.com] · tab tally (url) total 15, personalization 5

#### 50. bestbuy.com product — **ERROR** — no pair finished on both sides — r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro \| r2: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERR

`https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-earbuds-with-hearing-aid-feature-white/JJGCQ88C8X`

- r1 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea
- r1 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea · personalization matches 0
- r2 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea
- r2 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea · personalization matches 0
- r3 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea
- r3 **ON** — http 200 · declared 249.69 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.bestbuy.com/cart/api/v1/addToCart; "added to cart/bag" message appeared; cart badge 0→1 · search 5 links · personalization matches 0 · tab tally (url) total 13, personalization 0

#### 54. ulta.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ulta.com/p/lash-sensational-sky-high-mascara-pimprod2020260?sku=2574523`

- r1 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 72 links
- r1 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 71 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 73 links
- r2 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 75 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 78 links
- r3 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 75 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 58. costco.com bath towels — **PASS**

`https://www.costco.com/bath-towels.html`

- r1 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r1 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r2 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r3 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 62. macys.com search — **BLOCKED** — challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe this is an error, try updating your browser and refreshing the page. If the problem continues, call us at 1‑800‑289‑8229 for assistance. Reference: 0.

`https://www.macys.com/shop/featured/towel`

- r1 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe 
- r1 **ON** — http 200 · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — Skip to main content Ask Macy's I’m an AI-powered 
- r2 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — Skip to main content Ask Macy's Sign In See more o · personalization matches 0
- r3 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — Skip to main content Ask Macy's I’m an AI-powered 
- r3 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — Skip to main content Ask Macy's Sign In See more o · personalization matches 0

#### 66. athleta.gap.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://athleta.gap.com/browse/product.do?pid=1190608032&vid=REGULAR&searchText=leggings`

- r1 **OFF** — http 200 · declared 53.40 USD (json-ld) · rendered 89.00 ("$89 $53.40") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 53.40 USD (json-ld) · rendered 89.00 ("$89.00 $53.40") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 12, personalization 0
- r2 **OFF** — http 200 · declared 53.40 USD (json-ld) · rendered 89.00 ("$89 $53.40") · cart ✗ no evidence · search 8 links
- r2 **ON** — http 200 · declared 53.40 USD (json-ld) · rendered 89.00 ("$89.00 $53.40") · cart ✗ no evidence · search 8 links · personalization matches 15 [6500 cdn.granify.com, 6300 cdn.attn.tv, 6710 onsitestats.bluecore.com, 6200 apps.rokt-api.com] · tab tally (url) total 14, personalization 2
- r3 **OFF** — http 200 · declared 53.40 USD (json-ld) · rendered 89.00 ("$89 $53.40") · cart ✗ no evidence · search 8 links
- r3 **ON** — http 200 · declared 53.40 USD (json-ld) · rendered 89.00 ("$89.00 $53.40") · cart ✗ no evidence · search 8 links · personalization matches 13 [6500 cdn.granify.com, 6300 cdn.attn.tv, 6710 onsitestats.bluecore.com, 6200 apps.rokt-api.com] · tab tally (url) total 27, personalization 9

#### 70. everlane.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.everlane.com/products/mens-essential-organic-crew-uniform-white`

- r1 **OFF** — http 200 · declared 34.00 USD (json-ld) · rendered 34.00 ("Regular price $34") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 34.00 USD (json-ld) · rendered 34.00 ("Regular price $34") · cart ✗ no evidence · personalization matches 14 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 23, personalization 14
- r2 **OFF** — http 200 · declared 34.00 USD (json-ld) · rendered 34.00 ("Regular price $34") · cart ✗ no evidence
- r2 **ON** — http 200 · declared 34.00 USD (json-ld) · rendered 34.00 ("Regular price $34") · cart ✗ no evidence · personalization matches 7 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 21, personalization 7
- r3 **OFF** — http 200 · declared 34.00 USD (json-ld) · rendered 34.00 ("Regular price $34") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 34.00 USD (json-ld) · rendered 34.00 ("Regular price $34") · cart ✗ no evidence · personalization matches 7 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 21, personalization 7

#### 74. oldnavy.gap.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://oldnavy.gap.com/browse/product.do?pid=846874002&vid=REGULAR&searchText=jeans`

- r1 **OFF** — http 200 · declared 24.99 USD (json-ld) · rendered 24.99 ("$24.99 $49.99 50% off") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 24.99 USD (json-ld) · rendered 24.99 ("$24.99 $49.99") · cart ✗ no evidence · search 8 links · personalization matches 15 [6300 cdn.attn.tv, 6500 cdn.granify.com, 6710 onsitestats.bluecore.com, 6200 apps.rokt-api.com] · tab tally (url) total 22, personalization 11
- r2 **OFF** — http 200 · declared 24.99 USD (json-ld) · rendered 24.99 ("$24.99 $49.99 50% off") · cart ✗ no evidence · search 8 links
- r2 **ON** — http 200 · declared 24.99 USD (json-ld) · rendered 24.99 ("$24.99 $49.99") · cart ✗ no evidence · search 8 links · personalization matches 13 [6500 cdn.granify.com, 6300 cdn.attn.tv, 6200 apps.rokt-api.com, 6710 onsitestats.bluecore.com] · tab tally (url) total 25, personalization 9
- r3 **OFF** — http 200 · declared 24.99 USD (json-ld) · rendered 24.99 ("$24.99 $49.99 50% off") · cart ✗ no evidence · search 8 links
- r3 **ON** — http 200 · declared 24.99 USD (json-ld) · rendered 24.99 ("$24.99 $49.99") · cart ✗ no evidence · search 8 links · personalization matches 21 [6500 cdn.granify.com, 6300 cdn.attn.tv, 6200 apps.rokt-api.com, 6710 onsitestats.bluecore.com] · tab tally (url) total 28, personalization 9

#### 78. skims.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://skims.com/products/skims-ultimate-teardrop-push-up-bra-clay`

- r1 **OFF** — http 200 · declared 64.00 USD (json-ld) · rendered 64.00 ("$64") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · declared 64.00 USD (json-ld) · rendered 64.00 ("$64") · cart ✗ no visible, enabled add-to-cart control · personalization matches 10 [6000 async-px.dynamicyield.com] · tab tally (url) total 14, personalization 10
- r2 **OFF** — http 200 · declared 64.00 USD (json-ld) · rendered 64.00 ("$64") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 64.00 USD (json-ld) · rendered 64.00 ("$64") · cart ✗ no visible, enabled add-to-cart control · personalization matches 6 [6000 async-px.dynamicyield.com] · tab tally (url) total 11, personalization 6
- r3 **OFF** — http 200 · declared 64.00 USD (json-ld) · rendered 64.00 ("$64") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 64.00 USD (json-ld) · rendered 64.00 ("$64") · cart ✗ no visible, enabled add-to-cart control · personalization matches 6 [6000 async-px.dynamicyield.com] · tab tally (url) total 9, personalization 6

#### 82. vuoriclothing.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://vuoriclothing.com/products/kore-breathe-short-lined-5-sapphire`

- r1 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("Kore Breathe Short Lined 5" $88 48") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("Kore Breathe Short Lined 5" $88 48") · cart ✗ no visible, enabled add-to-cart control · personalization matches 10 [6801 dcinfos-cache.abtasty.com, 6801 ariane.abtasty.com, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 12, personalization 10
- r2 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("Kore Breathe Short Lined 5" $88 48") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("Kore Breathe Short Lined 5" $88 48") · cart ✗ no visible, enabled add-to-cart control · personalization matches 6 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 10, personalization 6
- r3 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("Kore Breathe Short Lined 5" $88 48") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("Kore Breathe Short Lined 5" $88 48") · cart ✗ no visible, enabled add-to-cart control · personalization matches 6 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 10, personalization 6

#### 86. kyliecosmetics.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://kyliecosmetics.com/products/cosmic-kylie-jenner-2-0-50ml-pen-spray-duo-gift-set`

- r1 **OFF** — http 200 · declared 66.00 USD (json-ld) · rendered 66.00 ("$66") · cart ✗ no evidence · search 32 links
- r1 **ON** — http 200 · declared 66.00 USD (json-ld) · rendered 66.00 ("$66") · cart ✗ no evidence · search 32 links · personalization matches 11 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 21, personalization 6
- r2 **OFF** — http 200 · declared 66.00 USD (json-ld) · rendered 66.00 ("$66") · cart ✗ no evidence · search 32 links
- r2 **ON** — http 200 · declared 66.00 USD (json-ld) · rendered 66.00 ("$66") · cart ✗ no evidence · search 31 links · personalization matches 10 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 14, personalization 5
- r3 **OFF** — http 200 · declared 66.00 USD (json-ld) · rendered 66.00 ("$66") · cart ✗ no evidence · search 32 links
- r3 **ON** — http 200 · declared 66.00 USD (json-ld) · rendered 66.00 ("$66") · cart ✗ no evidence · search 32 links · personalization matches 10 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 15, personalization 5

#### 90. rarebeauty.com product — **PASS**

`https://www.rarebeauty.com/products/rare-beauty-x-beis-lip-and-cheek-kit`

- r1 **OFF** — http 200 · declared 32.00 USD (json-ld) · rendered 45.00 ("$45 $32") · cart ✗ no evidence · search 187 links
- r1 **ON** — http 200 · declared 32.00 USD (json-ld) · rendered 45.00 ("$45 $32") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.rarebeauty.com/cart/update.js; "added to cart/bag" message appeared; cart badge 0→1 total 32.00 · search 194 links · personalization matches 13 [6800 cdn-4.convertexperiments.com, 6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 25, personalization 7
- r2 **OFF** — http 200 · declared 32.00 USD (json-ld) · rendered 45.00 ("$45 $32") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.rarebeauty.com/cart/add.js; "added to cart/bag" message appeared; cart badge 0→1 total 32.00 · search 194 links
- r2 **ON** — http 200 · declared 32.00 USD (json-ld) · rendered 45.00 ("$45 $32") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.rarebeauty.com/cart/add.js; "added to cart/bag" message appeared; cart badge 1→2 total 32.00 · search 160 links · personalization matches 9 [6800 cdn-4.convertexperiments.com, 6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 24, personalization 7
- r3 **OFF** — http 200 · declared 32.00 USD (json-ld) · rendered 45.00 ("$45 $32") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.rarebeauty.com/cart/add.js; "added to cart/bag" message appeared; cart badge 1→2 total 32.00 · search 194 links
- r3 **ON** — http 200 · declared 32.00 USD (json-ld) · rendered 45.00 ("$45 $32") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.rarebeauty.com/cart/add.js; "added to cart/bag" message appeared; cart badge 2→3 total 32.00 · search 160 links · personalization matches 9 [6800 cdn-4.convertexperiments.com, 6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 21, personalization 7

#### 94. baggu.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://baggu.com/products/nylon-duffle-bag-black-and-cream-gingham`

- r1 **OFF** — http 200 · declared 58.00  (json-ld) · cart ✗ no evidence
- r1 **ON** — http 200 · declared 58.00  (json-ld) · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 304 · declared 58.00  (json-ld) · cart ✗ no evidence
- r2 **ON** — http 304 · declared 58.00  (json-ld) · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 304 · declared 58.00  (json-ld) · cart ✗ no evidence
- r3 **ON** — http 304 · declared 58.00  (json-ld) · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 98. bombas.com product — **PASS**

`https://bombas.com/products/sesame-street-bombas-adult-ankle-sock-4-pack?variant=sesame-mix`

- r1 **OFF** — http 200 · declared 74.00 USD (json-ld) · rendered 74.00 ("$74") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 74.00 USD (json-ld) · rendered 74.00 ("$74") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 12, personalization 0
- r2 **OFF** — http 200 · declared 74.00 USD (json-ld) · rendered 74.00 ("$74") · cart ✓ "added to cart/bag" message appeared
- r2 **ON** — http 200 · declared 74.00 USD (json-ld) · rendered 74.00 ("$74") · cart ✓ "added to cart/bag" message appeared · personalization matches 0 · tab tally (url) total 15, personalization 0
- r3 **OFF** — http 200 · declared 74.00 USD (json-ld) · rendered 74.00 ("$74") · cart ✓ same-site cart request 200 POST https://shop.bombas.com/api/2026-07/graphql.json; "added to cart/bag" message appeared; cart badge 0→1
- r3 **ON** — http 200 · declared 74.00 USD (json-ld) · rendered 74.00 ("$74") · cart ✓ same-site cart request 200 POST https://shop.bombas.com/api/2026-07/graphql.json; "added to cart/bag" message appeared; cart badge 0→1 · personalization matches 0 · tab tally (url) total 18, personalization 0

#### 102. comfrt.com product — **PASS**

`https://comfrt.com/products/cabana-towel-tote?variant=46067511918636`

- r1 **OFF** — http 200 · declared 39.00 USD (json-ld) · rendered 39.00 ("$39 $90 Comp value") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://comfrt.com/cart/add.js total 39.00 · search 33 links
- r1 **ON** — http 200 · declared 39.00 USD (json-ld) · rendered 39.00 ("$39 comp value $90") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://comfrt.com/cart/add.js total 39.00 · search 33 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r2 **OFF** — http 200 · declared 39.00 USD (json-ld) · rendered 39.00 ("$39 $90 Comp value") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://comfrt.com/cart/add.js total 39.00 · search 33 links
- r2 **ON** — http 200 · declared 39.00 USD (json-ld) · rendered 39.00 ("$39 comp value $90") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://comfrt.com/cart/add.js total 39.00 · search 33 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · declared 39.00 USD (json-ld) · rendered 39.00 ("$39 $90 Comp value") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://comfrt.com/cart/add.js total 39.00 · search 33 links
- r3 **ON** — http 200 · declared 39.00 USD (json-ld) · rendered 39.00 ("$39 comp value $90") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://comfrt.com/cart/add.js total 39.00 · search 33 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 106. ghostlifestyle.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ghostlifestyle.com/products/ghost-strides-crewneck`

- r1 **OFF** — http 200 · declared 54.99 USD (json-ld) · cart ✗ no evidence · search 25 links
- r1 **ON** — http 200 · declared 54.99 USD (json-ld) · cart ✗ no evidence · search 25 links · personalization matches 17 [6950 static-tracking.klaviyo.com, 6900 api.intelligems.io] · tab tally (url) total 18, personalization 13
- r2 **OFF** — http 200 · declared 54.99 USD (json-ld) · cart ✗ no evidence · search 25 links
- r2 **ON** — http 200 · declared 54.99 USD (json-ld) · cart ✗ no evidence · search 25 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 10, personalization 4
- r3 **OFF** — http 200 · declared 54.99 USD (json-ld) · cart ✗ no evidence · search 25 links
- r3 **ON** — http 200 · declared 54.99 USD (json-ld) · cart ✗ no evidence · search 25 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 10, personalization 4

#### 110. iliabeauty.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://iliabeauty.com/products/the-mini-overglaze-lip-gloss-trio`

- r1 **OFF** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("$25 USD ($36 value)") · cart ✗ no evidence · search 115 links
- r1 **ON** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("$25 USD ($36 value)") · cart ✗ no evidence · search 125 links · personalization matches 12 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 12, personalization 6
- r2 **OFF** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("$25 USD ($36 value)") · cart ✗ no evidence · search 111 links
- r2 **ON** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("$25 USD ($36 value)") · cart ✗ no evidence · search 125 links · personalization matches 12 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 6
- r3 **OFF** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("$25 USD ($36 value)") · cart ✗ no evidence · search 115 links
- r3 **ON** — http 200 · declared 25.00 USD (json-ld) · rendered 25.00 ("$25 USD ($36 value)") · cart ✗ no evidence · search 125 links · personalization matches 12 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 6

#### 114. liquiddeath.com product — **PASS**

`https://liquiddeath.com/products/liquid-death-x-tumbler-knife-sharpener`

- r1 **OFF** — http 200 · declared 159.00 USD (json-ld) · rendered 159.00 ("$159.00") · cart ✗ no evidence · search 31 links
- r1 **ON** — http 200 · declared 159.00 USD (json-ld) · rendered 159.00 ("$159.00") · cart ✗ no evidence · search 31 links · personalization matches 18 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 12, personalization 7
- r2 **OFF** — http 200 · declared 159.00 USD (json-ld) · rendered 159.00 ("$159.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://liquiddeath.com/cart/add.js; "added to cart/bag" message appeared total 159.00 · search 32 links
- r2 **ON** — http 200 · declared 159.00 USD (json-ld) · rendered 159.00 ("$159.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://liquiddeath.com/cart/add.js; "added to cart/bag" message appeared; cart badge 0→1 total 159.00 · search 32 links · personalization matches 15 [6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 5
- r3 **OFF** — http 200 · declared 159.00 USD (json-ld) · rendered 159.00 ("$159.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://liquiddeath.com/cart/add.js; "added to cart/bag" message appeared total 159.00 · search 28 links
- r3 **ON** — http 200 · declared 159.00 USD (json-ld) · rendered 159.00 ("$159.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://liquiddeath.com/cart/update.js; "added to cart/bag" message appeared; cart badge 1→2 total 159.00 · search 23 links · personalization matches 15 [6950 static-tracking.klaviyo.com] · tab tally (url) total 9, personalization 5

#### 118. nativecos.com product — **FAIL** — ON read a price OFF never read: 19.50 — r2: CART PRICE DIFFERS: OFF 39.00 vs ON 15.60 \| r3: CART PRICE DIFFERS: OFF 15.60 vs ON 19.50

`https://www.nativecos.com/products/starter-set?variant=67614907170990`

- r1 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✗ no evidence · search 19 links
- r1 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.nativecos.com/cart/update.js total 39.00 · search 21 links · personalization matches 20 [6801 dcinfos-cache.abtasty.com, 6300 cdn.attn.tv, 6715 rebuyengine.com, 6801 ariane.abtasty.com] · tab tally (url) total 16, personalization 9
- r2 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 0→1 total 39.00 · search 22 links
- r2 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 4→5; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 4→5 total 15.60 · search 24 links · personalization matches 20 [6801 ariane.abtasty.com, 6300 cdn.attn.tv, 6801 dcinfos-cache.abtasty.com, 6715 rebuyengine.com] · tab tally (url) total 16, personalization 9
- r3 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 4→5; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 4→5 total 15.60 · search 17 links
- r3 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · rendered 56.00 ("$56.00") · cart ✓ Shopify /cart.js item_count 5→6; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 5→6 total 19.50 · search 16 links · personalization matches 20 [6801 dcinfos-cache.abtasty.com, 6300 cdn.attn.tv, 6801 ariane.abtasty.com, 6715 rebuyengine.com] · tab tally (url) total 18, personalization 13

#### 122. owalalife.com product — **PASS**

`https://owalalife.com/products/freesip`

- r1 **OFF** — http 200 · rendered 39.99 ("$39.99") · cart ✓ same-site cart request 200 POST https://owalalife.com/api/cart.data; "added to cart/bag" message appeared; cart badge 0→1
- r1 **ON** — http 200 · rendered 39.99 ("$39.99") · cart ✓ "added to cart/bag" message appeared · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 8, personalization 6
- r2 **OFF** — http 200 · rendered 39.99 ("$39.99") · cart ✓ same-site cart request 200 POST https://owalalife.com/api/cart.data
- r2 **ON** — http 200 · rendered 39.99 ("$39.99") · cart ✓ same-site cart request 200 POST https://owalalife.com/api/cart.data · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 8, personalization 6
- r3 **OFF** — http 200 · rendered 39.99 ("$39.99") · cart ✓ same-site cart request 200 POST https://owalalife.com/api/cart.data
- r3 **ON** — http 200 · rendered 39.99 ("$39.99") · cart ✓ same-site cart request 200 POST https://owalalife.com/api/cart.data; cart badge 2→3 · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 8, personalization 6

#### 126. ridge.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://ridge.com/products/vacuum-packing-set-basecamp-orange-tts?variant=67650313224266`

- r1 **OFF** — http 200 · declared 119.00/257.00 USD (json-ld-set(2)) · rendered 119.00 ("Sale price $119") · cart ✗ no evidence · search 23 links
- r1 **ON** — http 200 · declared 119.00/257.00 USD (json-ld-set(2)) · rendered 119.00 ("Sale price $119") · cart ✗ no evidence · search 23 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 14, personalization 5
- r2 **OFF** — http 200 · declared 119.00/257.00 USD (json-ld-set(2)) · rendered 119.00 ("Sale price $119") · cart ✗ no evidence · search 23 links
- r2 **ON** — http 200 · declared 119.00/257.00 USD (json-ld-set(2)) · rendered 119.00 ("Sale price $119") · cart ✗ no evidence · search 23 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 5
- r3 **OFF** — http 200 · declared 119.00/257.00 USD (json-ld-set(2)) · rendered 119.00 ("Sale price $119") · cart ✗ no evidence · search 23 links
- r3 **ON** — http 200 · declared 119.00/257.00 USD (json-ld-set(2)) · rendered 119.00 ("Sale price $119") · cart ✗ no evidence · search 23 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 5

#### 130. stanley1913.com product — **PASS**

`https://www.stanley1913.com/products/the-iceflow™-flip-straw-tumbler-30-oz-0-89-l?variant=53974939042152`

- r1 **OFF** — http 200 · declared 40.00 USD (json-ld) · rendered 40.00 ("$40.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.stanley1913.com/cart/add.js total 40.00 · search 37 links
- r1 **ON** — http 200 · declared 40.00 USD (json-ld) · rendered 40.00 ("$40.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.stanley1913.com/cart/add.js total 40.00 · search 37 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 14, personalization 5
- r2 **OFF** — http 200 · declared 40.00 USD (json-ld) · rendered 40.00 ("$40.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.stanley1913.com/cart/add.js total 40.00 · search 37 links
- r2 **ON** — http 200 · declared 40.00 USD (json-ld) · rendered 40.00 ("$40.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.stanley1913.com/cart/add.js total 40.00 · search 37 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 13, personalization 5
- r3 **OFF** — http 200 · declared 40.00 USD (json-ld) · rendered 40.00 ("$40.00") · cart ✗ no evidence · search 37 links
- r3 **ON** — http 200 · declared 40.00 USD (json-ld) · rendered 40.00 ("$40.00") · cart ✗ no evidence · search 37 links · personalization matches 15 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 13, personalization 5

#### 134. anker.com product — **PASS**

`https://www.anker.com/products/a121d-45w-smart-display-charger-dual-foldable?variant=46557402398870&ref=image_product_shelf`

- r1 **OFF** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("$39.99") · cart ✓ cart badge 0→1
- r1 **ON** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("$39.99") · cart ✓ cart badge 0→1 · personalization matches 4 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 52, personalization 4
- r2 **OFF** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("$39.99") · cart ✓ cart badge 1→2
- r2 **ON** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("$39.99") · cart ✓ cart badge 1→2 · personalization matches 4 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 43, personalization 4
- r3 **OFF** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("$39.99") · cart ✓ cart badge 2→3
- r3 **ON** — http 200 · declared 39.99 USD (json-ld) · rendered 39.99 ("$39.99") · cart ✓ cart badge 2→3 · personalization matches 4 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 47, personalization 4

#### 138. logitech.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.logitech.com/en-us/products/education`

- r1 **OFF** — http 200 · rendered 99.99 ("$99.99") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · rendered 99.99 ("$99.99") · cart ✗ no visible, enabled add-to-cart control · personalization matches 2 [6600 logitecheurope.us-6.evergage.com] · tab tally (url) total 6, personalization 1
- r2 **OFF** — http null · error: Navigation timeout of 30000 ms exceeded
- r2 **ON** — http 200 · rendered 99.99 ("$99.99") · cart ✗ no visible, enabled add-to-cart control · personalization matches 2 [6600 logitecheurope.us-6.evergage.com] · tab tally (url) total 5, personalization 1
- r3 **OFF** — http null · error: Navigation timeout of 30000 ms exceeded
- r3 **ON** — http 200 · rendered 99.99 ("$99.99") · cart ✗ no visible, enabled add-to-cart control · personalization matches 2 [6600 logitecheurope.us-6.evergage.com] · tab tally (url) total 5, personalization 1

#### 142. burrow.com product — **PASS**

`https://burrow.com/products/opera-media-console`

- r1 **OFF** — http 200 · declared 689.00/862.00/1149.00 USD (json-ld-set(3)) · cart ✗ no evidence
- r1 **ON** — http 200 · declared 689.00/862.00/1149.00 USD (json-ld-set(3)) · cart ✓ cart badge 0→1 · personalization matches 1 [6900 api.intelligems.io] · tab tally (url) total 7, personalization 1
- r2 **OFF** — http 200 · declared 689.00/862.00/1149.00 USD (json-ld-set(3)) · cart ✓ cart badge 0→1
- r2 **ON** — http 200 · declared 689.00/862.00/1149.00 USD (json-ld-set(3)) · cart ✓ cart badge 0→1 · personalization matches 1 [6900 api.intelligems.io] · tab tally (url) total 7, personalization 1
- r3 **OFF** — http 200 · declared 689.00/862.00/1149.00 USD (json-ld-set(3)) · cart ✓ cart badge 0→1
- r3 **ON** — http 200 · declared 689.00/862.00/1149.00 USD (json-ld-set(3)) · cart ✓ cart badge 0→1 · personalization matches 1 [6900 api.intelligems.io] · tab tally (url) total 7, personalization 1

#### 146. gopuff.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.gopuff.com/p/basically-12ct-large-roll-soft-toilet-paper/p63531`

- r1 **OFF** — http 203 · declared 11.99 USD (json-ld) · rendered 11.99 ("$11.99") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 203 · declared 11.99 USD (json-ld) · rendered 11.99 ("$11.99") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 11.99 USD (json-ld) · rendered 11.99 ("$11.99") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 11.99 USD (json-ld) · rendered 11.99 ("$11.99") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 11.99 USD (json-ld) · rendered 11.99 ("$11.99") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 11.99 USD (json-ld) · rendered 11.99 ("$11.99") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 150. iherb.com product — **PASS**

`https://www.iherb.com/pr/california-gold-nutrition-gold-c-usp-grade-vitamin-c-1-000-mg-60-veggie-capsules/61864`

- r1 **OFF** — http 200 · declared 6.42 USD (json-ld) · rendered 6.42 ("$6.42") · cart ✗ no evidence · search 48 links
- r1 **ON** — http 200 · declared 6.42 USD (json-ld) · rendered 6.42 ("$6.42") · cart ✓ same-site cart request 200 POST https://checkout.iherb.com/api/Carts/v3/catalog/lineItems; "added to cart/bag" message appeared; cart badge 0→1 · search 48 links · personalization matches 0 · tab tally (url) total 5, personalization 0
- r2 **OFF** — http 200 · declared 6.42 USD (json-ld) · rendered 6.42 ("$6.42") · cart ✗ no evidence · search 48 links
- r2 **ON** — http 200 · declared 6.42 USD (json-ld) · rendered 6.42 ("$6.42") · cart ✓ same-site cart request 200 POST https://checkout.iherb.com/api/Carts/v3/catalog/lineItems; "added to cart/bag" message appeared; cart badge 1→2 · search 48 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 6.42 USD (json-ld) · rendered 6.42 ("$6.42") · cart ✗ no evidence · search 48 links
- r3 **ON** — http 200 · declared 6.42 USD (json-ld) · rendered 6.42 ("$6.42") · cart ✗ no evidence · search 48 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 154. footlocker.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.footlocker.com/product/lckr-athletic-half-cushion-quarter-socks-mens/QS001WH.html`

- r1 **OFF** — http 200 · declared 9.99/14.95 USD (json-ld-set(2)) · rendered 14.95 ("This item is on sale. Price dropped from $14.95 to") · cart ✗ no evidence · search 49 links
- r1 **ON** — http 200 · declared 9.99/14.95 USD (json-ld-set(2)) · rendered 14.95 ("This item is on sale. Price dropped from $14.95 to") · cart ✗ no evidence · search 49 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 3, personalization 1
- r2 **OFF** — http 200 · declared 9.99/14.95 USD (json-ld-set(2)) · rendered 14.95 ("This item is on sale. Price dropped from $14.95 to") · cart ✗ no evidence · search 49 links
- r2 **ON** — http 200 · declared 9.99/14.95 USD (json-ld-set(2)) · rendered 14.95 ("This item is on sale. Price dropped from $14.95 to") · cart ✗ no evidence · search 49 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 3, personalization 1
- r3 **OFF** — http 200 · declared 9.99/14.95 USD (json-ld-set(2)) · rendered 14.95 ("This item is on sale. Price dropped from $14.95 to") · cart ✗ no evidence · search 49 links
- r3 **ON** — http 200 · declared 9.99/14.95 USD (json-ld-set(2)) · rendered 14.95 ("This item is on sale. Price dropped from $14.95 to") · cart ✗ no evidence · search 49 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 3, personalization 1

#### 158. gymshark.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.gymshark.com/products/gymshark-featherform-v-neck-bralette-underwear-black-ss26`

- r1 **OFF** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20 3.4 (5)") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20 3.4 (5)") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20 3.4 (5)") · cart ✗ no evidence
- r2 **ON** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20 3.4 (5)") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 2, personalization 0
- r3 **OFF** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20 3.4 (5)") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20 3.4 (5)") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 162. sportsmans.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.sportsmans.com/camping-gear-supplies/hydration/water-bottles/nalgene-sustain-32oz-wide-mouth-water-bottle/p/p263559`

- r1 **OFF** — http 200 · declared 16.99 USD (json-ld) · rendered 16.99 ("$16.99") · cart ✗ no evidence · search 42 links
- r1 **ON** — http 200 · declared 16.99 USD (json-ld) · rendered 16.99 ("$16.99") · cart ✗ no evidence · search 42 links · personalization matches 5 [6714 bl.listrakbi.com, 6713 at1.listrakbi.com] · tab tally (url) total 9, personalization 3
- r2 **OFF** — http 200 · declared 16.99 USD (json-ld) · rendered 16.99 ("$16.99") · cart ✗ no evidence · search 42 links
- r2 **ON** — http 200 · declared 16.99 USD (json-ld) · rendered 16.99 ("$16.99") · cart ✗ no evidence · search 42 links · personalization matches 5 [6714 bl.listrakbi.com, 6713 at1.listrakbi.com] · tab tally (url) total 9, personalization 3
- r3 **OFF** — http 200 · declared 16.99 USD (json-ld) · rendered 16.99 ("$16.99") · cart ✗ no evidence · search 42 links
- r3 **ON** — http 200 · declared 16.99 USD (json-ld) · rendered 16.99 ("$16.99") · cart ✗ no evidence · search 42 links · personalization matches 5 [6714 bl.listrakbi.com, 6713 at1.listrakbi.com] · tab tally (url) total 9, personalization 3

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 30 | jetblue.com home (Dynamic Yield content) | PASS | PASS | **PASS** |  |
| 34 | staples.com product | PASS | FAIL | **PASS** | minority differences: r2: add-to-cart worked OFF, not ON |
| 38 | target.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links |
| 42 | instacart.com home | PASS | PASS | **PASS** |  |
| 46 | colourpop.com product (Klaviyo, Intelligems) | PASS | FAIL | **PASS** |  |
| 50 | bestbuy.com product | FAIL | FAIL | **ERROR** | no pair finished on both sides — r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https: |
| 54 | ulta.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 58 | costco.com bath towels | PASS | PASS | **PASS** |  |
| 62 | macys.com search | FAIL | BLOCKED | **BLOCKED** | challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe this is an error, try updating your brow |
| 66 | athleta.gap.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 70 | everlane.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 74 | oldnavy.gap.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 78 | skims.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 82 | vuoriclothing.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 86 | kyliecosmetics.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 90 | rarebeauty.com product | PASS | FAIL | **PASS** |  |
| 94 | baggu.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 98 | bombas.com product | FAIL | FAIL | **PASS** |  |
| 102 | comfrt.com product | PASS | PASS | **PASS** |  |
| 106 | ghostlifestyle.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 110 | iliabeauty.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 114 | liquiddeath.com product | FAIL | FAIL | **PASS** |  |
| 118 | nativecos.com product | PASS | FAIL | **FAIL** | ON read a price OFF never read: 19.50 — r2: CART PRICE DIFFERS: OFF 39.00 vs ON 15.60 \| r3: CART PRICE DIFFERS: OFF 15.60 vs ON 19.50 |
| 122 | owalalife.com product | PASS | PASS | **PASS** |  |
| 126 | ridge.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 130 | stanley1913.com product | PASS | PASS | **PASS** |  |
| 134 | anker.com product | PASS | PASS | **PASS** |  |
| 138 | logitech.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 142 | burrow.com product | PASS | FAIL | **PASS** |  |
| 146 | gopuff.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 150 | iherb.com product | PASS | FAIL | **PASS** |  |
| 154 | footlocker.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 158 | gymshark.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 162 | sportsmans.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |

**Totals:** 14 PASS, 17 NOT-OURS, 1 ERROR, 1 BLOCKED, 1 FAIL

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- colourpop.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- costco.com bath towels (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- costco.com bath towels (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- everlane.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- liquiddeath.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- liquiddeath.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- ridge.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- stanley1913.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- stanley1913.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- gopuff.com product (ON): [Nullecho] The page shim could NOT patch: canvas.getImageData. That API is UNPROTECTED on this page. A silently-unpatched API is the worst outcome — please report this.
- iherb.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- iherb.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- iherb.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- iherb.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- iherb.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- iherb.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- footlocker.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- footlocker.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
