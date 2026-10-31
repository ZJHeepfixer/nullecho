# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-15

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `4564fe011dcacfd60bc7215d0c186b52a6a8e55d903305aca8b011fbbd14744f`, 263.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `f841733` (ext/ and harness/ clean)
- **Runtime:** 877s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:53383` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

11 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://najdopikehepnbohklceiegajcafjaim/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 29 | gymshark.com product | Dynamic Yield (consent-gated), mParticle | **PASS** | 26.00 = 26.00 | 26.00 = 26.00 | — = — | ✓✓✓ / ✓✓✓ | 60/60/60 / 60/60/60 | — | 0, 0, 0 | 0 |
| 30 | jetblue.com home (Dynamic Yield content) | Dynamic Yield (render hosts: cookie-strip only) | **PASS** | — = — | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | 6000×6 | 2, 2, 2 | 0 |
| 31 | llbean.com product | Dynamic Yield | **NOT-OURS** | 150.00 = 150.00 | 150.00 = 150.00 | — = — | ✗✗✗ / ✗✗✗ | 141/141/141 / 141/141/141 | 6000×3 | 3, 0, 0 | 2 |
| 32 | harborfreight.com product | Dynamic Yield (collection + render) | **NOT-OURS** | 59.99 = 59.99 | 59.99 = 59.99 | — = — | ✗ / ✗ | W / W | 6000×27 | 27 | 2 |
| 33 | gap.com product | Rokt/mParticle, Granify, Attentive, Bluecore | **NOT-OURS** | 89.95 = 89.95 | 89.95 = 89.95 | — = — | ✗✗✗ / ✗✗✗ | 8/8/8 / 8/8/8 | — | 0, 0, 0 | 1 |
| 34 | staples.com product | Bloomreach, Rokt, Attentive | **PASS** | 49.99 = 49.99 | 49.99 = 49.99 | — = — | ✓✓✓ / ✓✓✓ | 8/8/8 / 8/8/9 | — | 0, 0, 0 | 1 |
| 35 | sephora.com product | Rokt/mParticle, Bluecore, Constructor beacon | **PASS** | 16.00/25.00 = 16.00/25.00 | — = — | — = — | ✓ / ✓ | 6 / 6 | 6200×12 | 4 | 3 |
| 36 | officedepot.com product | Bloomreach | **NOT-OURS** | 48.99 = 48.99 | 48.99 = 48.99 | — = — | ✗ / ✗ | 0 / 0 | — | 0 | 3 |
| 37 | allbirds.com product | Attentive | **PASS** | 100.00 = 100.00 | — = — | 100.00 = 100.00 | ✓✓✓ / ✓✓✓ | 89/90/89 / 89/90/90 | 6300×7 | 2, 1, 1 | 1 |
| 38 | target.com product | Attentive | **INCONCLUSIVE** | — = — | **119.99/— → —** | — = — | ✓✗✗ / ✓✓✗ | 0/0/0 / 0/0/0 | — | 0, 0, 0 | 1 |
| 39 | petsmart.com product | Granify | **PASS** | 16.98/24.99 = 16.98/24.99 | 24.99 = 24.99 | — = — | ✓✗✓ / ✓✗✓ | 40/40/40 / 40/40/40 | 6500×6 | 1, 1, 1 | 9 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 6 PASS, 4 NOT-OURS, 1 INCONCLUSIVE

### Every price difference in every pair — including noise

- 38. target.com product: r1: rendered price 119.99 OFF, none ON

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 36. officedepot.com product: r2: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com
- 36. officedepot.com product: r3: not compared — OFF net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com, ON net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **29. gymshark.com product** (1 blocked-resource line(s))
- **30. jetblue.com home (Dynamic Yield content)** (1 blocked-resource line(s))
- **31. llbean.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Uncaught (in promise) Error: timeout`
- **32. harborfreight.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **33. gap.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **34. staples.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **35. sephora.com product** (1 blocked-resource line(s)):
  - `console: [New Auth Flow] Fetch interception error for https://apps.rokt-api.com/webevents/v3/JS/us2-6a2d0e4dc6b9e#a2f#a1/events TypeError: Failed to fetch`
  - `console: Error sending event to mParticle servers. TypeError: Failed to fetch`
  - `console: #-10-15 16:25:57,# [URL: /product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P#] [template: Product/ProductPage] [wrapComponentRender.js] [component`
- **36. officedepot.com product** (1 blocked-resource line(s)):
  - `uncaught: Failed to fetch`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error getting ECID: Error: Timeout waiting for condition`
- **37. allbirds.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **38. target.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **39. petsmart.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:28:19.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:28:39.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:32:23.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:32:52.#Z OPTIMIZELY: Optimizely object is not valid. Failing decideAll.`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:32:59.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:36:44.#Z DatafileManager: Error fetching datafile: Request error`
  - `console: [OPTIMIZELY] - ERROR #-10-15T23:37:14.#Z OPTIMIZELY: Optimizely object is not valid. Failing decideAll.`

### Every pair

#### 29. gymshark.com product — **PASS**

`https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22`

- r1 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 0→1 (picked XS) · search 60 links
- r1 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 0→1 (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 1→2 (picked XS) · search 60 links
- r2 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 1→2 (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 304 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 2→3 (picked XS) · search 60 links
- r3 **ON** — http 304 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 2→3 (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 30. jetblue.com home (Dynamic Yield content) — **PASS**

`https://www.jetblue.com/`

- r1 **OFF** — http 200 · vendor-rendered elements 0
- r1 **ON** — http 200 · vendor-rendered elements 0 · personalization matches 2 [6000 async-px.dynamicyield.com] · tab tally (url) total 4, personalization 2
- r2 **OFF** — http 200 · vendor-rendered elements 0
- r2 **ON** — http 200 · vendor-rendered elements 0 · personalization matches 2 [6000 async-px.dynamicyield.com] · tab tally (url) total 4, personalization 2
- r3 **OFF** — http 200 · vendor-rendered elements 0
- r3 **ON** — http 200 · vendor-rendered elements 0 · personalization matches 2 [6000 async-px.dynamicyield.com] · tab tally (url) total 4, personalization 2

#### 31. llbean.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.llbean.com/llb/shop/129613`

- r1 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 141 links
- r1 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 141 links · personalization matches 3 [6000 async-px.dynamicyield.com] · tab tally (url) total 4, personalization 3
- r2 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 141 links
- r2 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 141 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 141 links
- r3 **ON** — http 200 · declared 150.00 USD (json-ld) · rendered 150.00 ("$150.00") · cart ✗ no evidence (picked NEW) · search 141 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 32. harborfreight.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.harborfreight.com/20v-cordless-12-in-drilldriver-kit-with-2-ah-battery-and-charger-73216.html`

- r1 **OFF** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("59 dollars and 99 cents $59 . 99") · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 59.99 USD (json-ld) · rendered 59.99 ("59 dollars and 99 cents $59 . 99") · cart ✗ no evidence · search WALLED · personalization matches 27 [6000 async-px.dynamicyield.com] · tab tally (url) total 29, personalization 27
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied —
- r2 **ON** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied — · personalization matches 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied —
- r3 **ON** — http 403 · BLOCKED: HTTP 403 — Access to this page has been denied — · personalization matches 0

#### 33. gap.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.gap.com/browse/product.do?pid=403540002&vid=REGULAR`

- r1 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r2 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 7, personalization 0
- r3 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r3 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 8, personalization 0

#### 34. staples.com product — **PASS**

`https://www.staples.com/hammermill-copy-plus-8-5-x-11-copy-paper-20-lbs-92-brightness-5000-sheets-carton-105007/product_122374`

- r1 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1 · search 8 links
- r1 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→1 · search 8 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→2 · search 8 links
- r2 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→2 · search 8 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→3 · search 8 links
- r3 **ON** — http 200 · declared 49.99 USD (json-ld) · rendered 49.99 ("Final price is $49.99") · cart ✓ "added to cart/bag" message appeared; cart badge 0→3 · search 9 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 35. sephora.com product — **PASS**

`https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799?skuId=2837425`

- r1 **OFF** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links
- r1 **ON** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links · personalization matches 12 [6200 apps.rokt-api.com] · tab tally (url) total 10, personalization 4
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti
- r2 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti · personalization matches 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti
- r3 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti · personalization matches 0

#### 36. officedepot.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links

`https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/`

- r1 **OFF** — http 200 · declared 48.99 USD (json-ld) · rendered 48.99 ("$48.99") · cart ✗ no evidence · search 0 links
- r1 **ON** — http 200 · declared 48.99 USD (json-ld) · rendered 48.99 ("$48.99") · cart ✗ no evidence · search 0 links · personalization matches 0 · tab tally (url) total 29, personalization 0
- r2 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/
- r2 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/ · personalization matches 0
- r3 **OFF** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/
- r3 **ON** — http null · error: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.officedepot.com/a/products/196517/Office-Depot-Copy-And-Print-Paper/ · personalization matches 0

#### 37. allbirds.com product — **PASS**

`https://www.allbirds.com/products/mens-tree-runners`

- r1 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 89 links
- r1 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 89 links · personalization matches 3 [6300 cdn.attn.tv] · tab tally (url) total 6, personalization 2
- r2 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 1→2 total 100.00 (picked 8) · search 90 links
- r2 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 1→2 total 100.00 (picked 8) · search 90 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 5, personalization 1
- r3 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 2→3 total 100.00 (picked 8) · search 89 links
- r3 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 2→3 total 100.00 (picked 8) · search 90 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 5, personalization 1

#### 38. target.com product — **INCONCLUSIVE** — price varies with the extension OFF too (OFF —, rendered 119.99/—) — r1: rendered price 119.99 OFF, none ON

`https://www.target.com/p/delilah-home-100-organic-cotton-bath-towel-collection/-/A-93159262?preselect=93048164`

- r1 **OFF** — http 200 · rendered 119.99 ("$119.99") · cart ✓ same-site cart request 201 POST https://carts.target.com/web_checkouts/v1/cart_items; "added to cart/bag" message appeared; cart badge 0→1 · search 0 links
- r1 **ON** — http 200 · cart ✓ "added to cart/bag" message appeared · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · cart ✗ no visible, enabled add-to-cart control · search 0 links
- r2 **ON** — http 200 · cart ✓ same-site cart request 201 POST https://carts.target.com/web_checkouts/v1/cart_items; "added to cart/bag" message appeared; cart badge 0→1 · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r3 **OFF** — http 200 · cart ✗ no visible, enabled add-to-cart control · search 0 links
- r3 **ON** — http 200 · cart ✗ no visible, enabled add-to-cart control · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 39. petsmart.com product — **PASS**

`https://www.petsmart.com/dog/food/dry-food/pedigree-grilled-steak-and-vegetable-flavor-dry-dog-food-70826.html`

- r1 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✓ same-site cart request 200 POST https://www.petsmart.com/api/cwea/v2/carts/items; "added to cart/bag" message appeared · search 40 links
- r1 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✓ same-site cart request 200 POST https://www.petsmart.com/api/cwea/v2/carts/items; "added to cart/bag" message appeared · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1
- r2 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links
- r2 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✗ no evidence · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1
- r3 **OFF** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✓ "added to cart/bag" message appeared · search 40 links
- r3 **ON** — http 200 · declared 16.98/24.99 USD (json-ld-set(2)) · rendered 24.99 ("$24.99 $27.59 Open strike-through price policy") · cart ✓ "added to cart/bag" message appeared · search 40 links · personalization matches 2 [6500 cdn.granify.com] · tab tally (url) total 5, personalization 1

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 29 | gymshark.com product | PASS | PASS | **PASS** |  |
| 30 | jetblue.com home (Dynamic Yield content) | PASS | PASS | **PASS** |  |
| 31 | llbean.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 32 | harborfreight.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 33 | gap.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 34 | staples.com product | PASS | PASS | **PASS** |  |
| 35 | sephora.com product | PASS | PASS | **PASS** |  |
| 36 | officedepot.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence); search listed 0 product links |
| 37 | allbirds.com product | PASS | PASS | **PASS** |  |
| 38 | target.com product | FAIL | FAIL | **INCONCLUSIVE** | price varies with the extension OFF too (OFF —, rendered 119.99/—) — r1: rendered price 119.99 OFF, none ON |
| 39 | petsmart.com product | PASS | PASS | **PASS** |  |

**Totals:** 6 PASS, 4 NOT-OURS, 1 INCONCLUSIVE

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- harborfreight.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
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
