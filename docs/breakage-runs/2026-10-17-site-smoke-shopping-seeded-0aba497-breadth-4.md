# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `b31a4a7f033dfdb66e95daa9f1aba29ba6b58aa38680e84f2c249f81dcd851f9`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `0aba497` (ext/ and harness/ clean)
- **Runtime:** 2809s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:50894` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

33 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://dbpmklhnfgjfijlhnlkjkdheddfgfmkk/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 32 | harborfreight.com product | Dynamic Yield (collection + render) | **NOT-OURS** | **— → 59.99** | **— → 59.99** | — = — | ✗ / ✗ | W / W | 6000×18 | 18 | 1 |
| 36 | officedepot.com product | Bloomreach | **NOT-OURS** | 48.99 = 48.99 | 48.99 = 48.99 | — = — | ✗ / ✗ | 0 / 0 | — | 0 | 3 |
| 40 | jcpenney.com product | Attentive, Constructor | **NOT-OURS** | 29.59 = 29.59 | — = — | — = — | ✗✗✗ / ✗✗✗ | 60/72/72 / 60/60/60 | — | 0, 0, 0 | 1 |
| 44 | beardbrand.com product (Klaviyo) | Klaviyo | **PASS** | 29.00/39.00 = 29.00/39.00 | 29.00 = 29.00 | 26.10 = 26.10 | ✓✓✓ / ✓✓✓ | 25/25/25 / 25/25/25 | 6950×24 | 4, 4, 4 | 6 |
| 48 | brooklinen.com product | Dynamic Yield, Attentive | **PASS** | 127.20/159.00 = 127.20/159.00 | 159.00 = 159.00 | **—/159.00 → 159.00/—** | ✗✗✓ / ✓✗✗ | 221/221/231 / 179/195/188 | — | 0, 0, 0 | 4 |
| 52 | nike.com product | — | **NOT-OURS** | 115.00 = 115.00 | 115.00 = 115.00 | — = — | ✗✗✗ / ✗✗✗ | 95/138/145 / 0/138/145 | — | 0, 0, 0 | 0 |
| 56 | dell.com product | — | **FAIL** | 799.99 = 799.99 | — = — | — = — | · / · | · / · | — | 0 | 2 |
| 60 | homedepot.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | 0, 0, 0 | 1 |
| 64 | aritzia.com product | Dynamic Yield, Attentive | **NOT-OURS** | 118.00 = 118.00 | 118.00 = 118.00 | — = — | ✗✗✗ / ✗✗✗ | 24/24/24 / 24/24/24 | 6000×46 | 10, 6, 12 | 2 |
| 68 | bonobos.com product | Attentive | **NOT-OURS** | 99.00 = 99.00 | 99.00 = 99.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6300×4 | 2, 1, 1 | 2 |
| 72 | jcrew.com product | Bluecore | **NOT-OURS** | 39.50 = 39.50 | 39.50 = 39.50 | — = — | ✗✗✗ / ✗✗✗ | 34/34/34 / 34/34/34 | — | 0, 0, 0 | 2 |
| 76 | us.princesspolly.com product | Intelligems, Klaviyo | **NOT-OURS** | 55.00 = 55.00 | 55.00 = 55.00 | — = — | ✗✗✗ / ✗✗✗ | 220/220/225 / 220/220/225 | 6700×9 6900×13 6950×54 | 15, 6, 6 | 5 |
| 80 | trueclassictees.com product | Intelligems, Klaviyo | **PASS** | 109.99 = 109.99 | 54.99 = 54.99 | —/109.99 = —/109.99 | ✓✓✓ / ✓✓✓ | 24/98/24 / 98/98/98 | 6200×9 6900×17 6950×30 | 8, 7, 7 | 8 |
| 84 | fentybeauty.com product | Klaviyo | **PASS** | 38.00/39.00 = 38.00/39.00 | 38.00 = 38.00 | **38.00 → 38.00/—** | ✓✓✓ / ✓✓✓ | 38/38/38 / 38/38/38 | 6300×8 6950×50 | 2, 0, 1 | 6 |
| 88 | morphe.com product | Rebuy, Intelligems, Klaviyo | **PASS** | 49.00 = 49.00 | 49.00 = 49.00 | 49.00 = 49.00 | ✓✓✓ / ✓✓✓ | 36/36/34 / 37/37/8 | 6900×6 6950×45 | 11, 5, 5 | 2 |
| 92 | aloyoga.com product | Bloomreach, Attentive | **PASS** | 88.00 = 88.00 | 88.00 = 88.00 | — = — | ✓✗✗ / ✗✗✗ | 29/28/29 / 29/29/29 | 6300×5 | 1, 1, 1 | 1 |
| 96 | blendjet.com product | Klaviyo | **NOT-OURS** | 59.95/64.95 = 59.95/64.95 | 59.95 = 59.95 | — = — | ✗✗✗ / ✗✗✗ | 12/12/12 / 12/12/12 | 6950×18 | 3, 3, 3 | 0 |
| 100 | brumate.com product | Intelligems, Klaviyo | **PASS** | 149.99 = 149.99 | — = — | — = — | ✓✓✓ / ✓✗✓ | ·/·/· / ·/·/· | 6900×3 6950×4 | 5, 1, 1 | 2 |
| 104 | deathwishcoffee.com product | Rebuy, Klaviyo | **PASS** | 10.00 = 10.00 | 10.00 = 10.00 | 10.00 = 10.00 | ✓✓✓ / ✓✓✓ | 9/9/9 / 9/9/9 | 6715×19 6950×30 | 9, 9, 8 | 5 |
| 108 | graza.co product | Klaviyo | **NOT-OURS** | 25.00 = 25.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 11/11/11 / 11/11/11 | 6950×30 | 5, 5, 5 | 0 |
| 112 | kizik.com product | Klaviyo | **PASS** | 139.95 = 139.95 | 139.95 = 139.95 | **139.95 → —/139.95** | ✓✓✓ / ✓✓✓ | 40/40/40 / 40/40/40 | 6950×36 6952×6 | 4, 4, 4 | 0 |
| 116 | monos.com product | Klaviyo | **NOT-OURS** | 97500.00 = 97500.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 23/63/63 / 63/63/63 | 6700×6 6950×45 6952×12 | 5, 5, 5 | 1 |
| 120 | drinkolipop.com product | Rebuy, Intelligems, Klaviyo | **PASS** | 71.98 = 71.98 | 53.99 = 53.99 | 53.99 = 53.99 | ✓✓✓ / ✓✓✓ | 54/54/47 / 54/54/54 | 6715×15 6900×3 6950×24 | 7, 7, 7 | 3 |
| 124 | yourparade.com product | Klaviyo | **PASS** | 36.00 = 36.00 | 36.00 = 36.00 | 36.00/32.40/30.60 = 36.00/32.40/30.60 | ✓✓✓ / ✓✓✓ | 24/24/24 / 19/19/19 | 6950×18 | 3, 3, 3 | 0 |
| 128 | setactive.co product | Attentive, Black Crow, Rebuy, Klaviyo | **PASS** | 56.00 = 56.00 | 56.00 = 56.00 | 56.00 = 56.00 | ✓✓✓ / ✓✓✓ | 51/51/51 / 47/51/51 | 6300×6 6715×12 6950×24 | 5, 7, 7 | 4 |
| 132 | tentree.com product | Attentive, Rebuy, Klaviyo | **PASS** | 31.50 = 31.50 | 31.50 = 31.50 | **31.50/— → 31.50** | ✓✓✗ / ✓✓✓ | 1/1/1 / 1/1/1 | 6300×10 6950×30 | 8, 7, 7 | 0 |
| 136 | gamestop.com product | Salesforce | **PASS** | 59.99 = 59.99 | 59.99 = 59.99 | — = — | ✓✓✓ / ✓✓✓ | 34/34/34 / 35/35/35 | — | 0, 0, 0 | 0 |
| 140 | samsung.com product | — | **NOT-OURS** | 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 = 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 | 332.50 = 332.50 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 144 | joybird.com product | — | **PASS** | 1499.00/1616.00/1652.00/1706.00 = 1499.00/1616.00/1652.00/1706.00 | 799.00/94.00 = 799.00/94.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6700×2 | 0, 0, 0 | 0 |
| 148 | 1800petmeds.com product | — | **NOT-OURS** | — = — | 79.99 = 79.99 | — = — | ✗✗✗ / ✗✗✗ | 65/65/65 / 65/65/65 | 6601×4 | 1, 1, 1 | 0 |
| 152 | converse.com product | Attentive, Salesforce | **NOT-OURS** | 95.00 = 95.00 | 95.00 = 95.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6300×1 6601×3 | 2, 1, 1 | 2 |
| 156 | vans.com product | Bloomreach, Bluecore | **NOT-OURS** | 75.00 = 75.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 16/16/16 / 16/16/16 | 6101×2 | 0, 1, 1 | 2 |
| 160 | roguefitness.com product | — | **PASS** | 945.00/1845.00/2760.00/4600.00/9200.00 = 945.00/1845.00/2760.00/4600.00/9200.00 | 86.00 = 86.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 15 NOT-OURS, 16 PASS, 1 FAIL, 1 BLOCKED

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 36. officedepot.com product: r2: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com
- 36. officedepot.com product: r3: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com
- 48. brooklinen.com product: r3: add-to-cart worked OFF, not ON
- 52. nike.com product: r1: search: 95 product links OFF, 0 ON
- 92. aloyoga.com product: r1: add-to-cart worked OFF, not ON
- 100. brumate.com product: r2: add-to-cart worked OFF, not ON

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **32. harborfreight.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **36. officedepot.com product** (1 blocked-resource line(s)):
  - `uncaught: Failed to fetch`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error getting ECID: Error: Timeout waiting for condition`
- **40. jcpenney.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **44. beardbrand.com product (Klaviyo)** (1 blocked-resource line(s)):
  - `console: ❌ [WAIT-FOR-UTILS] Growi cookie utilities not loaded after 5 retries (#ms total)`
  - `console: ❌ [WAIT-FOR-UTILS] All window properties: [array Array]`
  - `console: ❌ [WAIT-FOR-UTILS] Check if cookie-utils.js is loading correctly`
  - `console: Access to fetch at 'https://alocdn.com/c/9rgi64bf/a/xtarget/p.json' from origin 'https://www.beardbrand.com' has been blocked by CORS policy: No 'Acces`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `uncaught: Failed to fetch (alocdn.com)`
- **48. brooklinen.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Access to fetch at 'https://shop.app/checkout/#/cn/hWNI57WftzYZrNc1UQJmWiTo/en-us/shoppay`
  - `console: Error: Checkout URL Failed: TypeError: Failed to fetch`
  - `console: Access to fetch at 'https://pcap.services.yofi.ai/v3/pc`
- **52. nike.com product** (1 blocked-resource line(s))
- **56. dell.com product** (0 blocked-resource line(s)):
  - `console: Failed to load resource: the server responded with a status of # ()`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **60. homedepot.com search** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **64. aritzia.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Loading the script 'https://d#oaghhl3bjt.cloudfront.net/main.#aa35fc#ec.js' violates the following Content Security Policy directive: "script-src https`
- **68. bonobos.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Uncaught (in promise) TypeError: affirm.ui.refresh is not a function`
- **72. jcrew.com product** (0 blocked-resource line(s)):
  - `console: [object Object]`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **76. us.princesspolly.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [RR] Error in fetch hijack: TypeError: Failed to fetch`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `uncaught: Failed to fetch`
  - `console: Framing 'https://www.google.com/' violates the following report-only Content Security Policy directive: "frame-ancestors 'self'". The violation has bee`
- **80. trueclassictees.com product** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://pcap.services.yofi.ai/v3/pc`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `console: [Canal Rokt Web Pixel]: mParticle send failed (page_viewed): TypeError: Failed to fetch`
  - `console: [Canal Rokt Web Pixel]: mParticle send failed (product_viewed): TypeError: Failed to fetch`
  - `console: TypeError: Failed to fetch`
  - `console: [Canal Rokt Web Pixel]: mParticle send failed (product_added_to_cart): TypeError: Failed to fetch`
  - `uncaught: Failed to fetch r.fetch (https://www.trueclassictees.com/cdn/wpm/s9f5e#wb#ap#c42m93b2bec3m.js:1:#)`
- **84. fentybeauty.com product** (1 blocked-resource line(s)):
  - `console: [ChatWidget] Failed to fetch prompt options: Error: Blocked fetch request to URL: https://agenticapplications.googleapis.com/v1/sales/express:generateP`
  - `uncaught: Uncaught TypeError: _._DumpException is not a function`
  - `console: Could not update session metadata with cart info: Error: Blocked fetch request to URL: https://agenticapplications.googleapis.com/v1/sales/express:exec`
  - `uncaught: Uncaught SyntaxError: Identifier 'clearpay_placement_attrs' has already been declared`
  - `uncaught: InvalidStateError: Failed to execute 'setRequestHeader' on 'XMLHttpRequest': The object's state must be OPENED. ra.createRequest (https://js.klarna.co`
  - `uncaught: Uncaught (in promise) Error: Blocked fetch request to URL: https://skosm.klarna.com/app-blocks/v1/store`
- **88. morphe.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **92. aloyoga.com product** (1 blocked-resource line(s)):
  - `uncaught: Unhandled Promise Rejection: timed out for: function(){return Boolean(window.sierra)}`
- **96. blendjet.com product** (1 blocked-resource line(s))
- **100. brumate.com product** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://kryo-gear.myshopify.com/cart.js' from origin 'https://www.brumate.com' has been blocked by CORS policy: No 'Access-Control-`
  - `console: Failed to load resource: net::ERR_FAILED`
- **104. deathwishcoffee.com product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `uncaught: Failed to fetch`
  - `console: TypeError: Failed to fetch`
  - `uncaught: Failed to fetch https://www.deathwishcoffee.com/cdn/wpm/b9f5e#wb#ap#c42m93b2bec3m.js:1:#`
  - `uncaught: Uncaught (in promise) TypeError: Failed to fetch`
- **108. graza.co product** (1 blocked-resource line(s))
- **112. kizik.com product** (1 blocked-resource line(s))
- **116. monos.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **120. drinkolipop.com product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `console: TypeError: Failed to fetch`
  - `uncaught: Failed to fetch r.fetch (https://drinkolipop.com/web-pixels@9f5e#wb#ap#c42m93b2bec3/web-pixel-#@#d5a2ef62c#e49fd58dba0/sandbox/worker.modern.js:1:#)`
- **124. yourparade.com product** (1 blocked-resource line(s))
- **128. setactive.co product** (1 blocked-resource line(s)):
  - `console: TypeError: Failed to fetch`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `console: Access to fetch at 'https://server.telemetry.services.yofi.ai/v3/journeies/jid-ca74aee5-#e-50a2-ae16-eab#e46e/sessions/jid-ca74aee5-#e-50a2-ae16-eab#e4`
- **132. tentree.com product** (1 blocked-resource line(s))
- **136. gamestop.com product** (1 blocked-resource line(s))
- **140. samsung.com product** (1 blocked-resource line(s))
- **144. joybird.com product** (1 blocked-resource line(s))
- **148. 1800petmeds.com product** (1 blocked-resource line(s))
- **152. converse.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] The page shim could NOT patch: canvas.getImageData. That API is UNPROTECTED on this page. A silently-unpatched API is the worst outcome — pl`
  - `uncaught: Cannot read properties of undefined (reading 'getInstance')`
- **156. vans.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
  - `console: Error initializing Optimizely client: Error: onReady timeout expired after # ms`
- **160. roguefitness.com product** (1 blocked-resource line(s))

### Every pair

#### 32. harborfreight.com product — **NOT-OURS** — fails with the extension OFF too — off: no declared or rendered price read; add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.harborfreight.com/20v-cordless-12-in-drilldriver-kit-with-2-ah-battery-and-charger-73216.html`

- r1 **OFF** — http 200 · cart ✗ no visible, enabled add-to-cart control · search WALLED
- r1 **ON** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("59 dollars and 99 cents $59 . 99") · cart ✗ no evidence · search WALLED · personalization matches 18 [6000 async-px.dynamicyield.com] · tab tally (url) total 18, personalization 18
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied —
- r2 **ON** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied — · personalization matches 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied —
- r3 **ON** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied — · personalization matches 0

#### 36. officedepot.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links

`https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/`

- r1 **OFF** — http 200 · declared 48.99 USD (json-ld) · rendered 48.99 ("$48.99") · cart ✗ no evidence · search 0 links
- r1 **ON** — http 200 · declared 48.99 USD (json-ld) · rendered 48.99 ("$48.99") · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 29, personalization 0
- r2 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/
- r2 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/ · personalization matches 0
- r3 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/
- r3 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/ · personalization matches 0

#### 40. jcpenney.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.jcpenney.com/p/worthington-womens-modern-perfect-trouser/ppr5008151662`

- r1 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links
- r1 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 72 links
- r2 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 304 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 72 links
- r3 **ON** — http 304 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 44. beardbrand.com product (Klaviyo) — **PASS**

`https://www.beardbrand.com/products/tree-ranger-beard-oil`

- r1 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r1 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 8, personalization 4
- r2 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r2 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 4
- r3 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r3 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4711 reviews)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 9, personalization 4

#### 48. brooklinen.com product — **PASS** — minority differences: r3: add-to-cart worked OFF, not ON

`https://www.brooklinen.com/products/classic-core-sheet-set?variant=41405018112090`

- r1 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✗ no evidence · search 221 links
- r1 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 0→1 total 159.00 · search 179 links · personalization matches 0 · tab tally (url) total 6, personalization 0
- r2 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✗ no evidence · search 221 links
- r2 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✗ no visible, enabled add-to-cart control · search 195 links · personalization matches 0 · tab tally (url) total 10, personalization 0
- r3 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 0→1 total 159.00 · search 231 links
- r3 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✗ no evidence · search 188 links · personalization matches 0 · tab tally (url) total 32, personalization 0

#### 52. nike.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111`

- r1 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 95 links
- r1 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 138 links
- r2 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 138 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 145 links
- r3 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 145 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 56. dell.com product — **FAIL** — bot wall ON only in 2/3 pair(s)

`https://www.dell.com/en-us/shop/laptop-computers/spd/xps13dx13260`

- r1 **OFF** — http 200 · declared 799.99 USD (json-ld)
- r1 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.dell.com/en-us/shop/laptop-comp · personalization matches 0
- r2 **OFF** — http 200 · declared 799.99 USD (json-ld)
- r2 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 799.99 USD (json-ld)
- r3 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.dell.com/en-us/shop/laptop-comp · personalization matches 0

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
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Error Page — #1 Home Improvement Retailer
Oops!! Something went wrong. Please refresh page
Refresh
How doers 
- r2 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Error Page — #1 Home Improvement Retailer
Oops!! Something went wrong. Please refresh page
Refresh
How doers 
- r3 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 64. aritzia.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.aritzia.com/us/en/product/softspoke%E2%84%A2-dear-wrap-sweater/110759.html?color=37818`

- r1 **OFF** — http 200 · declared 118.00 USD (json-ld) · rendered 118.00 ("$118") · cart ✗ no evidence · search 24 links
- r1 **ON** — http 200 · declared 118.00 USD (json-ld) · rendered 118.00 ("$118") · cart ✗ no evidence · search 24 links · personalization matches 16 [6000 async-px.dynamicyield.com] · tab tally (url) total 12, personalization 10
- r2 **OFF** — http 200 · declared 118.00 USD (json-ld) · rendered 118.00 ("$118") · cart ✗ no evidence · search 24 links
- r2 **ON** — http 200 · declared 118.00 USD (json-ld) · rendered 118.00 ("$118") · cart ✗ no evidence · search 24 links · personalization matches 12 [6000 async-px.dynamicyield.com] · tab tally (url) total 9, personalization 6
- r3 **OFF** — http 200 · declared 118.00 USD (json-ld) · rendered 118.00 ("$118") · cart ✗ no evidence · search 24 links
- r3 **ON** — http 200 · declared 118.00 USD (json-ld) · rendered 118.00 ("$118") · cart ✗ no evidence · search 24 links · personalization matches 18 [6000 async-px.dynamicyield.com] · tab tally (url) total 15, personalization 12

#### 68. bonobos.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://bonobos.com/products/stretch-washed-chino-deep-navy-0`

- r1 **OFF** — http 200 · declared 99.00 USD (json-ld) · rendered 99.00 ("$99") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 99.00 USD (json-ld) · rendered 99.00 ("$99") · cart ✗ no evidence · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 3, personalization 2
- r2 **OFF** — http 200 · declared 99.00 USD (json-ld) · rendered 99.00 ("$99") · cart ✗ no evidence
- r2 **ON** — http 200 · declared 99.00 USD (json-ld) · rendered 99.00 ("$99") · cart ✗ no evidence · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 3, personalization 1
- r3 **OFF** — http 200 · declared 99.00 USD (json-ld) · rendered 99.00 ("$99") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 99.00 USD (json-ld) · rendered 99.00 ("$99") · cart ✗ no evidence · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 3, personalization 1

#### 72. jcrew.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.jcrew.com/p/womens/categories/clothing/tees-and-tanks/perfect-fit-v-neck-t-shirt/CX405?display=all&fit=Classic&color_name=navy&colorProductCode=CX405`

- r1 **OFF** — http 200 · declared 39.50 USD (json-ld) · rendered 39.50 ("$39.50") · cart ✗ no evidence · search 34 links
- r1 **ON** — http 200 · declared 39.50 USD (json-ld) · rendered 39.50 ("$39.50 Navy") · cart ✗ no evidence · search 34 links · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 39.50 USD (json-ld) · rendered 39.50 ("$39.50") · cart ✗ no evidence · search 34 links
- r2 **ON** — http 200 · declared 39.50 USD (json-ld) · rendered 39.50 ("$39.50 Navy") · cart ✗ no evidence · search 34 links · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 39.50 USD (json-ld) · rendered 39.50 ("$39.50") · cart ✗ no evidence · search 34 links
- r3 **ON** — http 200 · declared 39.50 USD (json-ld) · rendered 39.50 ("$39.50 Navy") · cart ✗ no evidence · search 34 links · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 76. us.princesspolly.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://us.princesspolly.com/products/tynen-baggy-longline-sweatshorts-grey-marle?variant=47434501423188`

- r1 **OFF** — http 200 · declared 55.00 USD (json-ld) · rendered 55.00 ("USD $55.00 BUY 1, GET 1 50% OFF! CODE: BOGO50") · cart ✗ no visible, enabled add-to-cart control · search 220 links
- r1 **ON** — http 200 · declared 55.00 USD (json-ld) · rendered 55.00 ("USD $55.00 BUY 1, GET 1 50% OFF! CODE: BOGO50") · cart ✗ no visible, enabled add-to-cart control · search 220 links · personalization matches 34 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 24, personalization 15
- r2 **OFF** — http 200 · declared 55.00 USD (json-ld) · rendered 55.00 ("USD $55.00 BUY 1, GET 1 50% OFF! CODE: BOGO50") · cart ✗ no visible, enabled add-to-cart control · search 220 links
- r2 **ON** — http 200 · declared 55.00 USD (json-ld) · rendered 55.00 ("USD $55.00 BUY 1, GET 1 50% OFF! CODE: BOGO50") · cart ✗ no visible, enabled add-to-cart control · search 220 links · personalization matches 21 [6950 static-tracking.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 17, personalization 6
- r3 **OFF** — http 200 · declared 55.00 USD (json-ld) · rendered 55.00 ("USD $55.00 BUY 1, GET 1 50% OFF! CODE: BOGO50") · cart ✗ no visible, enabled add-to-cart control · search 225 links
- r3 **ON** — http 200 · declared 55.00 USD (json-ld) · rendered 55.00 ("USD $55.00 BUY 1, GET 1 50% OFF! CODE: BOGO50") · cart ✗ no visible, enabled add-to-cart control · search 225 links · personalization matches 21 [6950 static-tracking.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 19, personalization 6

#### 80. trueclassictees.com product — **PASS**

`https://trueclassictees.com/products/black-khaki-slim-chino-pants-2-pack?variant=41418815537224`

- r1 **OFF** — http 200 · declared 109.99 USD (json-ld) · rendered 54.99 ("$54.99/pair Regular price $129.98 Discounted price") · cart ✓ same-site cart request 200 POST https://www.trueclassictees.com/cart/update.js · search 24 links
- r1 **ON** — http 200 · declared 109.99 USD (json-ld) · rendered 54.99 ("$54.99/pair Regular price $129.98 Discounted price") · cart ✓ same-site cart request 200 POST https://www.trueclassictees.com/cart/update.js · search 98 links · personalization matches 26 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6200 apps.rokt-api.com] · tab tally (url) total 27, personalization 8
- r2 **OFF** — http 200 · declared 109.99 USD (json-ld) · rendered 54.99 ("$54.99/pair Regular price $129.98 Discounted price") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.trueclassictees.com/cart/add; cart badge 1→2 total 109.99 · search 98 links
- r2 **ON** — http 200 · declared 109.99 USD (json-ld) · rendered 54.99 ("$54.99/pair Regular price $129.98 Discounted price") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.trueclassictees.com/cart/add total 109.99 · search 98 links · personalization matches 15 [6950 static-tracking.klaviyo.com, 6200 apps.rokt-api.com, 6900 api.intelligems.io] · tab tally (url) total 34, personalization 7
- r3 **OFF** — http 200 · declared 109.99 USD (json-ld) · rendered 54.99 ("$54.99/pair Regular price $129.98 Discounted price") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.trueclassictees.com/cart/add; cart badge 2→3 total 109.99 · search 24 links
- r3 **ON** — http 200 · declared 109.99 USD (json-ld) · rendered 54.99 ("$54.99/pair Regular price $129.98 Discounted price") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.trueclassictees.com/cart/add total 109.99 · search 98 links · personalization matches 15 [6950 static-tracking.klaviyo.com, 6200 apps.rokt-api.com, 6900 api.intelligems.io] · tab tally (url) total 35, personalization 7

#### 84. fentybeauty.com product — **PASS**

`https://fentybeauty.com/products/sun-stalkr-instant-warmth-bronzer-desert-em`

- r1 **OFF** — http 200 · declared 38.00/39.00 USD (json-ld-set(2)) · rendered 38.00 ("Regular price $38.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://fentybeauty.com/cart/add total 38.00 · search 38 links
- r1 **ON** — http 200 · declared 38.00/39.00 USD (json-ld-set(2)) · rendered 38.00 ("Regular price $38.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://fentybeauty.com/cart/update.js total 38.00 · search 38 links · personalization matches 18 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 9, personalization 2
- r2 **OFF** — http 200 · declared 38.00/39.00 USD (json-ld-set(2)) · rendered 38.00 ("Regular price $38.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://fentybeauty.com/cart/add total 38.00 · search 38 links
- r2 **ON** — http 200 · declared 38.00/39.00 USD (json-ld-set(2)) · rendered 38.00 ("Regular price $38.00") · cart ✓ same-site cart request 200 POST https://fentybeauty.com/cart/add · search 38 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 5, personalization 0
- r3 **OFF** — http 200 · declared 38.00/39.00 USD (json-ld-set(2)) · rendered 38.00 ("Regular price $38.00") · cart ✓ Shopify /cart.js item_count 2→3 total 38.00 · search 38 links
- r3 **ON** — http 200 · declared 38.00/39.00 USD (json-ld-set(2)) · rendered 38.00 ("Regular price $38.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://fentybeauty.com/cart/add total 38.00 · search 38 links · personalization matches 38 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 10, personalization 1

#### 88. morphe.com product — **PASS**

`https://www.morphe.com/products/holiday-brush-set-duo`

- r1 **OFF** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("NEW $49.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.morphe.com/cart/add.js total 49.00 · search 36 links
- r1 **ON** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("NEW $49.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.morphe.com/cart/add.js total 49.00 · search 37 links · personalization matches 21 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 17, personalization 11
- r2 **OFF** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.morphe.com/cart/add.js total 49.00 · search 36 links
- r2 **ON** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.morphe.com/cart/add.js; cart badge 1→2 total 49.00 · search 37 links · personalization matches 15 [6950 static-tracking.klaviyo.com] · tab tally (url) total 10, personalization 5
- r3 **OFF** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.morphe.com/cart/add.js total 49.00 · search 34 links
- r3 **ON** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.morphe.com/cart/add.js total 49.00 · search 8 links · personalization matches 15 [6950 static-tracking.klaviyo.com] · tab tally (url) total 11, personalization 5

#### 92. aloyoga.com product — **PASS** — minority differences: r1: add-to-cart worked OFF, not ON

`https://www.aloyoga.com/products/w6586r-low-rise-amp-it-up-tennis-skirt-summer-romance-red?variant=50662133334375`

- r1 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88 \| (114) Review Summary") · cart ✓ same-site cart request 200 POST https://api.aloyoga.com/cart/graphql · search 29 links
- r1 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88 \| (114) Review Summary") · cart ✗ no evidence · search 29 links · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 5, personalization 1
- r2 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88 \| (114) Review Summary") · cart ✗ no evidence · search 28 links
- r2 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88 \| (114) Review Summary") · cart ✗ no evidence · search 29 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 7, personalization 1
- r3 **OFF** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88 \| (114) Review Summary") · cart ✗ no evidence · search 29 links
- r3 **ON** — http 200 · declared 88.00 USD (json-ld) · rendered 88.00 ("$88 \| (114) Review Summary") · cart ✗ no evidence · search 29 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 7, personalization 1

#### 96. blendjet.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://blendjet.com/products/best-of-blendjet-bundle?variant=41778841419842`

- r1 **OFF** — http 200 · declared 59.95/64.95 USD (json-ld-set(2)) · rendered 59.95 ("$59.95") · cart ✗ no visible, enabled add-to-cart control · search 12 links
- r1 **ON** — http 200 · declared 59.95/64.95 USD (json-ld-set(2)) · rendered 59.95 ("$59.95") · cart ✗ no visible, enabled add-to-cart control · search 12 links · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 3
- r2 **OFF** — http 200 · declared 59.95/64.95 USD (json-ld-set(2)) · rendered 59.95 ("$59.95") · cart ✗ no visible, enabled add-to-cart control · search 12 links
- r2 **ON** — http 200 · declared 59.95/64.95 USD (json-ld-set(2)) · rendered 59.95 ("$59.95") · cart ✗ no visible, enabled add-to-cart control · search 12 links · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 3
- r3 **OFF** — http 200 · declared 59.95/64.95 USD (json-ld-set(2)) · rendered 59.95 ("$59.95") · cart ✗ no visible, enabled add-to-cart control · search 12 links
- r3 **ON** — http 200 · declared 59.95/64.95 USD (json-ld-set(2)) · rendered 59.95 ("$59.95") · cart ✗ no visible, enabled add-to-cart control · search 12 links · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 3

#### 100. brumate.com product — **PASS** — minority differences: r2: add-to-cart worked OFF, not ON

`https://www.brumate.com/products/paragon-hydration-pack-cardbon`

- r1 **OFF** — http 200 · declared 149.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.brumate.com/api/cart; "added to cart/bag" message appeared
- r1 **ON** — http 200 · declared 149.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.brumate.com/api/cart; "added to cart/bag" message appeared · personalization matches 5 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 16, personalization 5
- r2 **OFF** — http 200 · declared 149.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.brumate.com/api/cart; "added to cart/bag" message appeared
- r2 **ON** — http 200 · declared 149.99 USD (json-ld) · cart ✗ no evidence · personalization matches 1 [6900 api.intelligems.io] · tab tally (url) total 12, personalization 1
- r3 **OFF** — http 200 · declared 149.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.brumate.com/api/cart; "added to cart/bag" message appeared
- r3 **ON** — http 200 · declared 149.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.brumate.com/api/cart; "added to cart/bag" message appeared · personalization matches 1 [6900 api.intelligems.io] · tab tally (url) total 12, personalization 1

#### 104. deathwishcoffee.com product — **PASS**

`https://www.deathwishcoffee.com/products/chaos-and-coffee-pet-tag-set`

- r1 **OFF** — http 200 · declared 10.00 USD (json-ld) · rendered 10.00 ("Regular price $10.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.deathwishcoffee.com/cart/add total 10.00 · search 9 links
- r1 **ON** — http 200 · declared 10.00 USD (json-ld) · rendered 10.00 ("Regular price $10.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.deathwishcoffee.com/cart/add total 10.00 · search 9 links · personalization matches 17 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com] · tab tally (url) total 20, personalization 9
- r2 **OFF** — http 200 · declared 10.00 USD (json-ld) · rendered 10.00 ("Regular price $10.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.deathwishcoffee.com/cart/add total 10.00 · search 9 links
- r2 **ON** — http 200 · declared 10.00 USD (json-ld) · rendered 10.00 ("Regular price $10.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.deathwishcoffee.com/cart/add total 10.00 · search 9 links · personalization matches 17 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com] · tab tally (url) total 20, personalization 9
- r3 **OFF** — http 200 · declared 10.00 USD (json-ld) · rendered 10.00 ("Regular price $10.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.deathwishcoffee.com/cart/add total 10.00 · search 9 links
- r3 **ON** — http 200 · declared 10.00 USD (json-ld) · rendered 10.00 ("Regular price $10.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.deathwishcoffee.com/cart/add total 10.00 · search 9 links · personalization matches 15 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com] · tab tally (url) total 19, personalization 8

#### 108. graza.co product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.graza.co/products/the-graza-tote`

- r1 **OFF** — http 200 · declared 25.00 USD (json-ld) · cart ✗ no evidence · search 11 links
- r1 **ON** — http 200 · declared 25.00 USD (json-ld) · cart ✗ no evidence · search 11 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 15, personalization 5
- r2 **OFF** — http 200 · declared 25.00 USD (json-ld) · cart ✗ no evidence · search 11 links
- r2 **ON** — http 200 · declared 25.00 USD (json-ld) · cart ✗ no evidence · search 11 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 14, personalization 5
- r3 **OFF** — http 200 · declared 25.00 USD (json-ld) · cart ✗ no evidence · search 11 links
- r3 **ON** — http 200 · declared 25.00 USD (json-ld) · cart ✗ no evidence · search 11 links · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 15, personalization 5

#### 112. kizik.com product — **PASS**

`https://kizik.com/products/womens-athens-2-bahama?variant=48706832400541`

- r1 **OFF** — http 200 · declared 139.95 USD (json-ld) · rendered 139.95 ("Sale price $139.95 - Free Shipping & Easy Returns") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://kizik.com/cart/update.js total 139.95 · search 40 links
- r1 **ON** — http 200 · declared 139.95 USD (json-ld) · rendered 139.95 ("Sale price $139.95 - Free Shipping & Easy Returns") · cart ✓ same-site cart request 200 POST https://kizik.com/cart/update.js · search 40 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 7, personalization 4
- r2 **OFF** — http 200 · declared 139.95 USD (json-ld) · rendered 139.95 ("Sale price $139.95 - Free Shipping & Easy Returns") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://kizik.com/cart/add.js total 139.95 · search 40 links
- r2 **ON** — http 200 · declared 139.95 USD (json-ld) · rendered 139.95 ("Sale price $139.95 - Free Shipping & Easy Returns") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://kizik.com/cart/add.js total 139.95 · search 40 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 10, personalization 4
- r3 **OFF** — http 200 · declared 139.95 USD (json-ld) · rendered 139.95 ("Sale price $139.95 - Free Shipping & Easy Returns") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://kizik.com/cart/add.js total 139.95 · search 40 links
- r3 **ON** — http 200 · declared 139.95 USD (json-ld) · rendered 139.95 ("Sale price $139.95 - Free Shipping & Easy Returns") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://kizik.com/cart/update.js total 139.95 · search 40 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 11, personalization 4

#### 116. monos.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://monos.com/products/milspec-heritage-g-class`

- r1 **OFF** — http 200 · declared 97500.00 USD (microdata) · cart ✗ no visible, enabled add-to-cart control · search 23 links
- r1 **ON** — http 200 · declared 97500.00 USD (microdata) · cart ✗ no visible, enabled add-to-cart control · search 63 links · personalization matches 21 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 17, personalization 5
- r2 **OFF** — http 200 · declared 97500.00 USD (microdata) · cart ✗ no visible, enabled add-to-cart control · search 63 links
- r2 **ON** — http 200 · declared 97500.00 USD (microdata) · cart ✗ no visible, enabled add-to-cart control · search 63 links · personalization matches 21 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 20, personalization 5
- r3 **OFF** — http 200 · declared 97500.00 USD (microdata) · cart ✗ no visible, enabled add-to-cart control · search 63 links
- r3 **ON** — http 200 · declared 97500.00 USD (microdata) · cart ✗ no visible, enabled add-to-cart control · search 63 links · personalization matches 21 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com, 6700 insights.algolia.io] · tab tally (url) total 20, personalization 5

#### 120. drinkolipop.com product — **PASS**

`https://drinkolipop.com/products/caramel-apple-crisp-apple-bundle`

- r1 **OFF** — http 200 · declared 71.98 USD (json-ld) · rendered 53.99 ("25% Off $53.99 $71.98") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://drinkolipop.com/cart/add.js total 53.99 · search 54 links
- r1 **ON** — http 200 · declared 71.98 USD (json-ld) · rendered 53.99 ("25% Off $53.99 $71.98") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://drinkolipop.com/cart/add.js total 53.99 · search 54 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6900 api.intelligems.io] · tab tally (url) total 14, personalization 7
- r2 **OFF** — http 200 · declared 71.98 USD (json-ld) · rendered 53.99 ("25% Off $53.99 $71.98") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://drinkolipop.com/cart/add.js total 53.99 · search 54 links
- r2 **ON** — http 200 · declared 71.98 USD (json-ld) · rendered 53.99 ("25% Off $53.99 $71.98") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://drinkolipop.com/cart/add.js total 53.99 · search 54 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6900 api.intelligems.io] · tab tally (url) total 14, personalization 7
- r3 **OFF** — http 200 · declared 71.98 USD (json-ld) · rendered 53.99 ("25% Off $53.99 $71.98") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://drinkolipop.com/cart/add.js total 53.99 · search 47 links
- r3 **ON** — http 200 · declared 71.98 USD (json-ld) · rendered 53.99 ("25% Off $53.99 $71.98") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://drinkolipop.com/cart/add.js total 53.99 · search 54 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6900 api.intelligems.io] · tab tally (url) total 14, personalization 7

#### 124. yourparade.com product — **PASS**

`https://yourparade.com/products/my-jammies-organic-kids-pajamas-copy?variant=45401137250327`

- r1 **OFF** — http 200 · declared 36.00 USD (json-ld) · rendered 36.00 ("$36.00 USD") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://paradeorganics.com/cart/add total 36.00 · search 24 links
- r1 **ON** — http 200 · declared 36.00 USD (json-ld) · rendered 36.00 ("$36.00 USD") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://paradeorganics.com/cart/add total 36.00 · search 19 links · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 8, personalization 3
- r2 **OFF** — http 200 · declared 36.00 USD (json-ld) · rendered 36.00 ("$36.00 USD") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://paradeorganics.com/cart/add total 32.40 · search 24 links
- r2 **ON** — http 200 · declared 36.00 USD (json-ld) · rendered 36.00 ("$36.00 USD") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://paradeorganics.com/cart/add total 32.40 · search 19 links · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 3
- r3 **OFF** — http 200 · declared 36.00 USD (json-ld) · rendered 36.00 ("$36.00 USD") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://paradeorganics.com/cart/add total 30.60 · search 24 links
- r3 **ON** — http 200 · declared 36.00 USD (json-ld) · rendered 36.00 ("$36.00 USD") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://paradeorganics.com/cart/add total 30.60 · search 19 links · personalization matches 6 [6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 3

#### 128. setactive.co product — **PASS**

`https://setactive.co/products/classic-cotton-daily-all-in-good-fun-classic-tee-fog-heather-grey?variant=46260316176469`

- r1 **OFF** — http 200 · declared 56.00 USD (meta) · rendered 56.00 ("Regular price $56.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://setactive.co/cart/update.js; "added to cart/bag" message appeared total 56.00 · search 51 links
- r1 **ON** — http 200 · declared 56.00 USD (meta) · rendered 56.00 ("Regular price $56.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://setactive.co/cart/add total 56.00 · search 47 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6715 rebuyengine.com] · tab tally (url) total 19, personalization 5
- r2 **OFF** — http 200 · declared 56.00 USD (meta) · rendered 56.00 ("Regular price $56.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://setactive.co/cart/add total 56.00 · search 51 links
- r2 **ON** — http 200 · declared 56.00 USD (meta) · rendered 56.00 ("Regular price $56.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://setactive.co/cart/add total 56.00 · search 51 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6715 rebuyengine.com] · tab tally (url) total 30, personalization 7
- r3 **OFF** — http 200 · declared 56.00 USD (meta) · rendered 56.00 ("Regular price $56.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://setactive.co/cart/add total 56.00 · search 51 links
- r3 **ON** — http 200 · declared 56.00 USD (meta) · rendered 56.00 ("Regular price $56.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://setactive.co/cart/add total 56.00 · search 51 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6715 rebuyengine.com] · tab tally (url) total 31, personalization 7

#### 132. tentree.com product — **PASS**

`https://www.tentree.com/products/sasquatch-peak-hat-agave-green-hammock`

- r1 **OFF** — http 200 · declared 31.50 USD (json-ld) · rendered 31.50 ("$31.50") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.tentree.com/cart/add.js total 31.50 · search 1 links
- r1 **ON** — http 200 · declared 31.50 USD (json-ld) · rendered 31.50 ("$31.50") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.tentree.com/cart/add.js total 31.50 · search 1 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 14, personalization 8
- r2 **OFF** — http 200 · declared 31.50 USD (json-ld) · rendered 31.50 ("$31.50") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.tentree.com/cart/add.js total 31.50 · search 1 links
- r2 **ON** — http 200 · declared 31.50 USD (json-ld) · rendered 31.50 ("$31.50") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.tentree.com/cart/add.js total 31.50 · search 1 links · personalization matches 13 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 13, personalization 7
- r3 **OFF** — http 200 · declared 31.50 USD (json-ld) · rendered 31.50 ("$31.50") · cart ✗ no evidence · search 1 links
- r3 **ON** — http 200 · declared 31.50 USD (json-ld) · rendered 31.50 ("$31.50") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.tentree.com/cart/add.js total 31.50 · search 1 links · personalization matches 13 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 13, personalization 7

#### 136. gamestop.com product — **PASS**

`https://www.gamestop.com/gaming-accessories/controllers/playstation-5/products/sony-dualsense-wireless-controller-for-playstation-5---midnight-black/297428.html`

- r1 **OFF** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("$59.99 $56.99 for Pros") · cart ✓ same-site cart request 200 POST https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default/Cart-AddProduct · search 34 links
- r1 **ON** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("$59.99 $56.99 for Pros") · cart ✓ same-site cart request 200 POST https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default/Cart-AddProduct · search 35 links · personalization matches 0 · tab tally (url) total 5, personalization 0
- r2 **OFF** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("$59.99 $56.99 for Pros") · cart ✓ same-site cart request 200 POST https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default/Cart-AddProduct · search 34 links
- r2 **ON** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("$59.99 $56.99 for Pros") · cart ✓ same-site cart request 200 POST https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default/Cart-AddProduct · search 35 links · personalization matches 0 · tab tally (url) total 5, personalization 0
- r3 **OFF** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("$59.99 $56.99 for Pros") · cart ✓ same-site cart request 200 POST https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default/Cart-AddProduct · search 34 links
- r3 **ON** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("$59.99 $56.99 for Pros") · cart ✓ same-site cart request 200 POST https://www.gamestop.com/on/demandware.store/Sites-gamestop-us-Site/default/Cart-AddProduct · search 35 links · personalization matches 0 · tab tally (url) total 5, personalization 0

#### 140. samsung.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.samsung.com/us/mobile-accessories/all-mobile-accessories/`

- r1 **OFF** — http 200 · declared 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 USD (json-ld-set(14)) · rendered 332.50 ("From $332.50 or $13.85/mo for 24mo Save Price: $34") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · declared 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 USD (json-ld-set(14)) · rendered 332.50 ("From $332.50 or $13.85/mo for 24mo Save Price: $34") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 USD (json-ld-set(14)) · rendered 332.50 ("From $332.50 or $13.85/mo for 24mo Save Price: $34") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 USD (json-ld-set(14)) · rendered 332.50 ("From $332.50 or $13.85/mo for 24mo Save Price: $34") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 USD (json-ld-set(14)) · rendered 332.50 ("From $332.50 or $13.85/mo for 24mo Save Price: $34") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 24.99/29.99/34.99/39.99/49.99/59.99/74.99/89.99/99.99/109.99/189.99/209.99/349.99/399.99 USD (json-ld-set(14)) · rendered 332.50 ("From $332.50 or $13.85/mo for 24mo Save Price: $34") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 144. joybird.com product — **PASS**

`https://joybird.com/sofas/lewis-sofa/?fabric=key-largo-zenith-teal`

- r1 **OFF** — http 200 · declared 1499.00/1616.00/1652.00/1706.00 USD (json-ld-set(4)) · rendered 799.00 ("$799") · cart ✓ same-site cart request 200 POST https://joybird.com/graphql
- r1 **ON** — http 200 · declared 1499.00/1616.00/1652.00/1706.00 USD (json-ld-set(4)) · rendered 799.00 ("$799") · cart ✓ same-site cart request 200 POST https://joybird.com/graphql · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 6, personalization 0
- r2 **OFF** — http 200 · declared 1499.00/1616.00/1652.00/1706.00 USD (json-ld-set(4)) · rendered 94.00 ("$94") · cart ✓ same-site cart request 200 POST https://joybird.com/graphql
- r2 **ON** — http 200 · declared 1499.00/1616.00/1652.00/1706.00 USD (json-ld-set(4)) · rendered 94.00 ("$94") · cart ✓ same-site cart request 200 POST https://joybird.com/graphql · personalization matches 0 · tab tally (url) total 6, personalization 0
- r3 **OFF** — http 200 · declared 1499.00/1616.00/1652.00/1706.00 USD (json-ld-set(4)) · rendered 799.00 ("$799") · cart ✓ same-site cart request 200 POST https://joybird.com/graphql
- r3 **ON** — http 200 · declared 1499.00/1616.00/1652.00/1706.00 USD (json-ld-set(4)) · rendered 799.00 ("$799") · cart ✓ same-site cart request 200 POST https://joybird.com/graphql · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 6, personalization 0

#### 148. 1800petmeds.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.1800petmeds.com/category/flea-and-tick.html`

- r1 **OFF** — http 200 · rendered 79.99 ("$79.99") · cart ✗ no visible, enabled add-to-cart control · search 65 links
- r1 **ON** — http 200 · rendered 79.99 ("$79.99") · cart ✗ no visible, enabled add-to-cart control · search 65 links · personalization matches 1 [6601 p.cquotient.com] · tab tally (url) total 6, personalization 1
- r2 **OFF** — http 200 · rendered 79.99 ("$79.99") · cart ✗ no visible, enabled add-to-cart control · search 65 links
- r2 **ON** — http 200 · rendered 79.99 ("$79.99") · cart ✗ no visible, enabled add-to-cart control · search 65 links · personalization matches 1 [6601 p.cquotient.com] · tab tally (url) total 6, personalization 1
- r3 **OFF** — http 200 · rendered 79.99 ("$79.99") · cart ✗ no visible, enabled add-to-cart control · search 65 links
- r3 **ON** — http 200 · rendered 79.99 ("$79.99") · cart ✗ no visible, enabled add-to-cart control · search 65 links · personalization matches 2 [6601 p.cquotient.com] · tab tally (url) total 6, personalization 1

#### 152. converse.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.converse.com/shop/p/chuck-70-canvas-unisex-high-top-shoe/162056MP.html?dwvar_162056MP_color=black%2Fblack%2Fegret&styleNo=162050C&cgid=mens-shoes`

- r1 **OFF** — http 200 · declared 95.00 USD (microdata) · rendered 95.00 ("$95.00 UNISEX HIGH TOP SHOE") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 95.00 USD (microdata) · rendered 95.00 ("$95.00 UNISEX HIGH TOP SHOE") · cart ✗ no evidence · personalization matches 2 [6601 p.cquotient.com, 6300 cdn.attn.tv] · tab tally (url) total 9, personalization 2
- r2 **OFF** — http 200 · declared 95.00 USD (microdata) · rendered 95.00 ("$95.00 UNISEX HIGH TOP SHOE") · cart ✗ no evidence
- r2 **ON** — http 200 · declared 95.00 USD (microdata) · rendered 95.00 ("$95.00 UNISEX HIGH TOP SHOE") · cart ✗ no evidence · personalization matches 1 [6601 p.cquotient.com] · tab tally (url) total 8, personalization 1
- r3 **OFF** — http 200 · declared 95.00 USD (microdata) · rendered 95.00 ("$95.00 UNISEX HIGH TOP SHOE") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 95.00 USD (microdata) · rendered 95.00 ("$95.00 UNISEX HIGH TOP SHOE") · cart ✗ no evidence · personalization matches 1 [6601 p.cquotient.com] · tab tally (url) total 8, personalization 1

#### 156. vans.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.vans.com/en-us/p/shoes/icons/old-skool-5205/old-skool-shoe-VN000D3HY28`

- r1 **OFF** — http 200 · declared 75.00 USD (json-ld) · cart ✗ no evidence · search 16 links
- r1 **ON** — http 200 · declared 75.00 USD (json-ld) · cart ✗ no evidence · search 16 links · personalization matches 0 · tab tally (url) total 20, personalization 0
- r2 **OFF** — http 200 · declared 75.00 USD (json-ld) · cart ✗ no evidence · search 16 links
- r2 **ON** — http 200 · declared 75.00 USD (json-ld) · cart ✗ no evidence · search 16 links · personalization matches 1 [6101 cdns.brsrvr.com] · tab tally (url) total 21, personalization 1
- r3 **OFF** — http 200 · declared 75.00 USD (json-ld) · cart ✗ no evidence · search 16 links
- r3 **ON** — http 200 · declared 75.00 USD (json-ld) · cart ✗ no evidence · search 16 links · personalization matches 1 [6101 cdns.brsrvr.com] · tab tally (url) total 21, personalization 1

#### 160. roguefitness.com product — **PASS**

`https://www.roguefitness.com/rogue-echo-bike`

- r1 **OFF** — http 200 · declared 945.00/1845.00/2760.00/4600.00/9200.00 USD (json-ld-set(5)) · rendered 86.00 ("$86") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1
- r1 **ON** — http 200 · declared 945.00/1845.00/2760.00/4600.00/9200.00 USD (json-ld-set(5)) · rendered 86.00 ("$86") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1 · personalization matches 0 · tab tally (url) total 16, personalization 0
- r2 **OFF** — http 304 · declared 945.00/1845.00/2760.00/4600.00/9200.00 USD (json-ld-set(5)) · rendered 86.00 ("$86") · cart ✓ "added to cart/bag" message appeared; cart badge 1→2
- r2 **ON** — http 304 · declared 945.00/1845.00/2760.00/4600.00/9200.00 USD (json-ld-set(5)) · rendered 86.00 ("$86") · cart ✓ "added to cart/bag" message appeared; cart badge 1→2 · personalization matches 0 · tab tally (url) total 14, personalization 0
- r3 **OFF** — http 304 · declared 945.00/1845.00/2760.00/4600.00/9200.00 USD (json-ld-set(5)) · rendered 86.00 ("$86") · cart ✓ "added to cart/bag" message appeared; cart badge 2→3
- r3 **ON** — http 304 · declared 945.00/1845.00/2760.00/4600.00/9200.00 USD (json-ld-set(5)) · rendered 86.00 ("$86") · cart ✓ "added to cart/bag" message appeared; cart badge 2→3 · personalization matches 0 · tab tally (url) total 14, personalization 0

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 32 | harborfreight.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: no declared or rendered price read; add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 36 | officedepot.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links |
| 40 | jcpenney.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 44 | beardbrand.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 48 | brooklinen.com product | PASS | FAIL | **PASS** | minority differences: r3: add-to-cart worked OFF, not ON |
| 52 | nike.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 56 | dell.com product | BLOCKED | PASS | **FAIL** | bot wall ON only in 2/3 pair(s) |
| 60 | homedepot.com search | FAIL | BLOCKED | **BLOCKED** | HTTP 403 — Error Page — #1 Home Improvement Retailer
Oops!! Something went wrong. Please refresh page
Refresh
How doers get more done™
Need Help? Visit our Cust |
| 64 | aritzia.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 68 | bonobos.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 72 | jcrew.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 76 | us.princesspolly.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 80 | trueclassictees.com product | PASS | PASS | **PASS** |  |
| 84 | fentybeauty.com product | PASS | PASS | **PASS** |  |
| 88 | morphe.com product | PASS | PASS | **PASS** |  |
| 92 | aloyoga.com product | FAIL | PASS | **PASS** | minority differences: r1: add-to-cart worked OFF, not ON |
| 96 | blendjet.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 100 | brumate.com product | PASS | PASS | **PASS** | minority differences: r2: add-to-cart worked OFF, not ON |
| 104 | deathwishcoffee.com product | PASS | PASS | **PASS** |  |
| 108 | graza.co product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 112 | kizik.com product | PASS | PASS | **PASS** |  |
| 116 | monos.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 120 | drinkolipop.com product | PASS | PASS | **PASS** |  |
| 124 | yourparade.com product | PASS | PASS | **PASS** |  |
| 128 | setactive.co product | PASS | PASS | **PASS** |  |
| 132 | tentree.com product | PASS | PASS | **PASS** |  |
| 136 | gamestop.com product | PASS | PASS | **PASS** |  |
| 140 | samsung.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 144 | joybird.com product | PASS | PASS | **PASS** |  |
| 148 | 1800petmeds.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 152 | converse.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 156 | vans.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 160 | roguefitness.com product | PASS | PASS | **PASS** |  |

**Totals:** 15 NOT-OURS, 16 PASS, 1 FAIL, 1 BLOCKED

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- jcpenney.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- nike.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- fentybeauty.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- aloyoga.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- graza.co product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- kizik.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- kizik.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- kizik.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- kizik.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- monos.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- monos.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- drinkolipop.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- yourparade.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- converse.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- converse.com product (ON): [Nullecho] The page shim could NOT patch: canvas.getImageData. That API is UNPROTECTED on this page. A silently-unpatched API is the worst outcome — please report this.
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- vans.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
