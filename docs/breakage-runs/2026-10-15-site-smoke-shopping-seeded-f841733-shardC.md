# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-15

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `51891fb26acc0b10e6d02fdc270b4c8ff2597e1f1f51880de778f5a9cc31a8bd`, 263.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `f841733` (ext/ and harness/ clean)
- **Runtime:** 772s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:54950` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

12 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://oagpclkpnggacckkkkenbmndcacikmpb/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 49 | walmart.com product | — | **NOT-OURS** | 149.99 = 149.99 | 149.99 = 149.99 | — = — | ✗ / ✗ | W / W | — | 0 | 1 |
| 50 | bestbuy.com product | — | **PASS** | 249.31 = 249.31 | — = — | — = — | ✓ / ✓ | 2 / 2 | — | 0 | 5 |
| 51 | ikea.com product | — | **NOT-OURS** | 16.99 = 16.99 | — = — | — = — | ✗✗✗ / ✗✗✗ | 32/32/32 / 32/32/32 | — | 0, 0, 0 | 0 |
| 52 | nike.com product | — | **NOT-OURS** | 115.00 = 115.00 | 115.00 = 115.00 | — = — | ✗✗✗ / ✗✗✗ | 143/143/131 / 143/143/131 | — | 0, 0, 0 | 0 |
| 53 | zappos.com product | — | **NOT-OURS** | 37.50/60.00/65.00/70.00/75.00/80.00 = 37.50/60.00/65.00/70.00/75.00/80.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 104/104/104 / 104/104/104 | — | 0, 0, 0 | 0 |
| 54 | ulta.com product | — | **NOT-OURS** | 13.99 = 13.99 | 13.99 = 13.99 | — = — | ✗✗✗ / ✗✗✗ | 72/71/71 / 71/70/71 | — | 0, 0, 0 | 1 |
| 55 | apple.com Buy iPad (many offers) | — | **PASS** | 449.00/549.00/599.00/699.00/749.00/899.00 = 449.00/549.00/599.00/699.00/749.00/899.00 | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 56 | dell.com product | — | **PASS** | 799.99 = 799.99 | — = — | — = — | · / · | · / · | — | 0, 0, 0 | 1 |
| 57 | awaytravel.com product | — | **PASS** | 295.00 = 295.00 | — = — | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6900×33 6950×10 | 6, 11, 11 | 0 |
| 58 | costco.com bath towels | — | **PASS** | — = — | 26.99 = 26.99 | — = — | ··· / ··· | 25/25/25 / 25/25/25 | — | 0, 0, 0 | 4 |
| 61 | kohls.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 1 |
| 62 | macys.com search | — | **NOT-OURS** | — = — | — = — | — = — | · / · | · / · | — | 0, 0 | 1 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 6 NOT-OURS, 5 PASS, 1 BLOCKED

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 50. bestbuy.com product: r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro
- 50. bestbuy.com product: r3: not compared — OFF net::ERR_QUIC_PROTOCOL_ERROR at https://www.bestbuy.com/prod, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **49. walmart.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **50. bestbuy.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: #-10-15T23:29:11.#Z logLevel=ERROR, runtime=Browser, renderer=client, referrer=, requestPath=/product/apple-airpods-pro-2-wireless-active-noise-cancell`
  - `uncaught: Failed to fetch`
  - `console: #-10-15T23:29:31.#Z logLevel=ERROR, runtime=Browser, renderer=client, referrer=, requestPath="/site/searchpage.jsp?id=pcat#&st=usb+c+cable", sid=#f9c-2`
  - `console: #-10-15T23:29:42.#Z logLevel=ERROR, runtime=Browser, renderer=client, referrer=, requestPath="/site/searchpage.jsp?id=pcat#&st=usb+c+cable", sid=#f9c-2`
- **51. ikea.com product** (1 blocked-resource line(s))
- **52. nike.com product** (1 blocked-resource line(s))
- **53. zappos.com product** (1 blocked-resource line(s))
- **54. ulta.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **56. dell.com product** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **57. awaytravel.com product** (1 blocked-resource line(s))
- **58. costco.com bath towels** (1 blocked-resource line(s)):
  - `console: Error fetching Criteo Data for viewCategory on desktop: Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error loading search page adset Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error loading search page data Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
  - `console: Error fetching Criteo Data for viewSearchResults on desktop: Error: Failed to fetch data from https://d.us.criteo.com/delivery/retailmedia`
- **61. kohls.com search** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **62. macys.com search** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`

### Every pair

#### 49. walmart.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121`

- r1 **OFF** — http 200 · declared 149.99  (microdata) · rendered 149.99 ("Now $149.99") · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 149.99  (microdata) · rendered 149.99 ("Now $149.99") · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm 
- r2 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm  · personalization matches 0
- r3 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm 
- r3 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm  · personalization matches 0

#### 50. bestbuy.com product — **PASS** — minority differences: r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro \| r3: not compared — OFF net::ERR_QUIC_PROTOCOL_ERROR at https://www.bestbuy.com/prod, ON net::ERR_HTTP2_PROTOCOL_ERROR at https

`https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-earbuds-with-hearing-aid-feature-white/JJGCQ88C8X`

- r1 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea
- r1 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea · personalization matches 0
- r2 **OFF** — http 200 · declared 249.31 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.bestbuy.com/cart/api/v1/addToCart; "added to cart/bag" message appeared · search 2 links
- r2 **ON** — http 200 · declared 249.31 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.bestbuy.com/cart/api/v1/addToCart; "added to cart/bag" message appeared · search 2 links · personalization matches 0 · tab tally (url) total 6, personalization 0
- r3 **OFF** — http null · error: net::ERR_QUIC_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ear
- r3 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/product/apple-airpods-pro-2-wireless-active-noise-cancelling-ea · personalization matches 0

#### 51. ikea.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ikea.com/us/en/p/lack-side-table-white-30449908/`

- r1 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r1 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 20, personalization 0
- r2 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r2 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 34, personalization 0
- r3 **OFF** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links
- r3 **ON** — http 200 · declared 16.99 USD (json-ld) · cart ✗ no evidence · search 32 links · personalization matches 0 · tab tally (url) total 40, personalization 0

#### 52. nike.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.nike.com/t/air-force-1-07-mens-shoes-jBrhbr/CW2288-111`

- r1 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 143 links
- r1 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 143 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 143 links
- r2 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 143 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 131 links
- r3 **ON** — http 200 · declared 115.00 USD (json-ld) · rendered 115.00 ("$115") · cart ✗ no evidence · search 131 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 53. zappos.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.zappos.com/p/converse-chuck-taylor-all-star-high-top-sneaker-black/product/107999/color/3`

- r1 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 104 links
- r1 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 104 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 104 links
- r2 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 104 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 104 links
- r3 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 104 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 54. ulta.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.ulta.com/p/lash-sensational-sky-high-mascara-pimprod2020260?sku=2574523`

- r1 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 72 links
- r1 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 71 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 71 links
- r2 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 70 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 71 links
- r3 **ON** — http 200 · declared 13.99 USD (json-ld) · rendered 13.99 ("$13.99") · cart ✗ no evidence · search 71 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 55. apple.com Buy iPad (many offers) — **PASS**

`https://www.apple.com/shop/buy-ipad/ipad`

- r1 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r1 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r2 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6))
- r3 **ON** — http 200 · declared 449.00/549.00/599.00/699.00/749.00/899.00 USD (json-ld-set(6)) · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 56. dell.com product — **PASS**

`https://www.dell.com/en-us/shop/laptop-computers/spd/xps13dx13260`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.dell.com/en-us/shop/laptop-comp
- r1 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.dell.com/en-us/shop/laptop-comp
- r2 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 799.99 USD (json-ld)
- r3 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 57. awaytravel.com product — **PASS**

`https://www.awaytravel.com/suitcases/bigger-carry-on`

- r1 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js
- r1 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js · personalization matches 9 [6900 api.intelligems.io] · tab tally (url) total 8, personalization 6
- r2 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js
- r2 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js · personalization matches 17 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 11
- r3 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js
- r3 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js · personalization matches 17 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 11

#### 58. costco.com bath towels — **PASS**

`https://www.costco.com/bath-towels.html`

- r1 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r1 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r2 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r2 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links
- r3 **ON** — http 200 · rendered 26.99 ("$26.99 - $46.99") · search 25 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 61. kohls.com search — **BLOCKED** — challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://www.kohls.com/search.jsp?" on this server. Reference #18.2c0ed217.1792106941.1e4e1efb https://errors.edgesuite.net/18.2c0ed217.1792106941.1e4e

`https://www.kohls.com/search.jsp?search=towel`

- r1 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w
- r1 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w · personalization matches 0
- r2 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w
- r2 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w · personalization matches 0
- r3 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w
- r3 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w · personalization matches 0

#### 62. macys.com search — **NOT-OURS** — fails with the extension OFF too — off: no declared or rendered price read

`https://www.macys.com/shop/featured/towel`

- r1 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe 
- r1 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's —  · personalization matches 0
- r2 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied - Macy's — You don’t have access to this page If you believe 
- r2 **ON** — http 200 · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200
- r3 **ON** — http 200 · personalization matches 0 · tab tally (url) total 1, personalization 0

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 49 | walmart.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 50 | bestbuy.com product | FAIL | FAIL | **PASS** | minority differences: r1: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestbuy.com/pro, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.bestb |
| 51 | ikea.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 52 | nike.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 53 | zappos.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 54 | ulta.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 55 | apple.com Buy iPad (many offers) | PASS | PASS | **PASS** |  |
| 56 | dell.com product | PASS | BLOCKED | **PASS** |  |
| 57 | awaytravel.com product | PASS | PASS | **PASS** |  |
| 58 | costco.com bath towels | PASS | PASS | **PASS** |  |
| 61 | kohls.com search | BLOCKED | BLOCKED | **BLOCKED** | challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://www.kohls.com/search.jsp?" on this server |
| 62 | macys.com search | BLOCKED | BLOCKED | **NOT-OURS** | fails with the extension OFF too — off: no declared or rendered price read |

**Totals:** 6 NOT-OURS, 5 PASS, 1 BLOCKED

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- walmart.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- nike.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- nike.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- costco.com bath towels (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- costco.com bath towels (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
