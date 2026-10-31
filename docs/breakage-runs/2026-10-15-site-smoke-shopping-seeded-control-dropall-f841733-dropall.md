# Nullecho pre-release site smoke — SHOPPING LAB (2 rounds) — SEEDED learned state — ⚠ NEGATIVE CONTROL — 2026-10-15

> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The unpacked store zip's `rules/personalization.json` was rewritten in the temp dir with EVERY personalization rule removed (0.9.2 blocking) (sha256 packaged `5b145e54e1b30724…` → control `37517e5f3dc66819…`). Its FAILs, or its lower counts, are the point.

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `b850d4a50f2c6dc262d6f053b78bc433c7d0d59c59d1729da8e3324fa54a938e`, 263.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `f841733` (ext/ and harness/ clean)
- **Runtime:** 525s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:64197` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

8 pages × 2 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://pebnjfdfchkehgpanncgiknedfchhjdc/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 35 | sephora.com product | Rokt/mParticle, Bluecore, Constructor beacon | **PASS** | 16.00/25.00 = 16.00/25.00 | — = — | — = — | ✓ / ✓ | 6 / 6 | — | 0 | 3 |
| 37 | allbirds.com product | Attentive | **PASS** | 100.00 = 100.00 | — = — | 100.00 = 100.00 | ✓✓ / ✓✓ | 90/89 / 89/89 | — | 0, 0 | 1 |
| 38 | target.com product | Attentive | **NOT-OURS** | — = — | — = — | — = — | ✓✗ / ✓✗ | 0/0 / 0/0 | — | 0, 0 | 1 |
| 41 | bathandbodyworks.com product | Attentive, Monetate (not blocked), Einstein recs (not blocked) | **NOT-OURS** | 24.95 = 24.95 | — = — | — = — | ✗ / ✗ | W / W | — | 0 | 1 |
| 43 | drsquatch.com product (Klaviyo) | Klaviyo, Constructor beacon | **PASS** | 7.00/55.00 = 7.00/55.00 | 7.00 = 7.00 | — = — | ✓✓ / ✓✓ | 24/24 / 24/24 | — | 0, 0 | 3 |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems | **PASS** | 3.20/8.00 = 3.20/8.00 | — = — | 8.00 = 8.00 | ✓✓ / ✓✓ | 220/220 / 222/222 | — | 0, 0 | 0 |
| 46 | colourpop.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems, Attentive, Nosto | **PASS** | 24.00 = 24.00 | — = — | 24.00 = 24.00 | ✓✓ / ✓✓ | 54/54 / 54/54 | — | 0, 0 | 1 |
| 47 | rothys.com product (Intelligems) | Intelligems, Attentive, Constructor | **NOT-OURS** | 109.00/125.00 = 109.00/125.00 | 109.00 = 109.00 | — = — | ✗✗ / ✗✗ | 2/2 / 2/2 | — | 0, 0 | 4 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 5 PASS, 3 NOT-OURS

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

_None._

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **35. sephora.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: #-10-15 16:40:16,# [URL: /product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P#] [template: Product/ProductPage] [wrapComponentRender.js] [component`
  - `console: #-10-15 16:40:17,# [URL: /product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P#] [template: Product/ProductPage] [wrapComponentRender.js] [component`
- **37. allbirds.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **38. target.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **41. bathandbodyworks.com product** (1 blocked-resource line(s)):
  - `uncaught: Cannot read properties of undefined (reading 'view')`
- **43. drsquatch.com product (Klaviyo)** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://alocdn.com/c/9rgi64bf/a/xtarget/p.json' from origin 'https://www.drsquatch.com' has been blocked by CORS policy: No 'Access`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `uncaught: Unhandled Promise Rejection: Failed to fetch`
- **45. puravidabracelets.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s))
- **46. colourpop.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **47. rothys.com product (Intelligems)** (1 blocked-resource line(s)):
  - `uncaught: Unhandled Promise Rejection: Cannot access 'getCookie' before initialization SegmentClient.getOmetriaIdFromCookie (https://rothys.com/cdn/shop/t/#/ass`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Cannot read properties of undefined (reading 'init')`
  - `uncaught: Unhandled Promise Rejection: igData does not exist. Intelligems may not have loaded.`

### Every pair

#### 35. sephora.com product — **PASS**

`https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799?skuId=2837425`

- r1 **OFF** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links
- r1 **ON** — http 200 · declared 16.00/25.00 USD (json-ld-set(2)) · cart ✓ "added to cart/bag" message appeared · search 6 links · personalization matches 0 · tab tally (url) total 6, personalization 0
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti
- r2 **ON** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.sephora.com/product/mac-cosmeti · personalization matches 0

#### 37. allbirds.com product — **PASS**

`https://www.allbirds.com/products/mens-tree-runners`

- r1 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 90 links
- r1 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 89 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 1→2 total 100.00 (picked 8) · search 89 links
- r2 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 1→2 total 100.00 (picked 8) · search 89 links · personalization matches 0 · tab tally (url) total 5, personalization 0

#### 38. target.com product — **NOT-OURS** — fails with the extension OFF too — off: no declared or rendered price read; search listed 0 product links

`https://www.target.com/p/delilah-home-100-organic-cotton-bath-towel-collection/-/A-93159262?preselect=93048164`

- r1 **OFF** — http 200 · cart ✓ same-site cart request 201 POST https://carts.target.com/web_checkouts/v1/cart_items; "added to cart/bag" message appeared; cart badge 0→1 · search 0 links
- r1 **ON** — http 200 · cart ✓ same-site cart request 201 POST https://carts.target.com/web_checkouts/v1/cart_items; "added to cart/bag" message appeared; cart badge 0→1 · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · cart ✗ no visible, enabled add-to-cart control · search 0 links
- r2 **ON** — http 200 · cart ✗ no visible, enabled add-to-cart control · search 0 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 41. bathandbodyworks.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.bathandbodyworks.com/p/champagne-toast-3-wick-candle-028029548`

- r1 **OFF** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 307 · BLOCKED: challenge page (HTTP 200): "Press & Hold" — Access to this page has been denied — Press & Hold to confirm you are a huma
- r2 **ON** — http 307 · BLOCKED: challenge page (HTTP 200): "Press & Hold" — Access to this page has been denied — Press & Hold to confirm you are a huma · personalization matches 0

#### 43. drsquatch.com product (Klaviyo) — **PASS**

`https://www.drsquatch.com/products/mountain-meadow`

- r1 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r1 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 0 · tab tally (url) total 14, personalization 0
- r2 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r2 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 0 · tab tally (url) total 14, personalization 0

#### 45. puravidabracelets.com product (Klaviyo, Intelligems) — **PASS**

`https://www.puravidabracelets.com/products/solid-original?variant=40140395479126`

- r1 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 0→1 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r1 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 0→1 total 8.00 · search 222 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 0 · tab tally (url) total 6, personalization 0
- r2 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 1→2 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r2 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 1→2 total 8.00 · search 222 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 0 · tab tally (url) total 8, personalization 0

#### 46. colourpop.com product (Klaviyo, Intelligems) — **PASS**

`https://colourpop.com/products/eeveelution-shadow-palette`

- r1 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r1 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 0 · tab tally (url) total 7, personalization 0
- r2 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r2 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 0 · tab tally (url) total 9, personalization 0

#### 47. rothys.com product (Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://rothys.com/products/womens-pointed-toe-flat-black`

- r1 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r1 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 0 · tab tally (url) total 33, personalization 0
- r2 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r2 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 0 · tab tally (url) total 13, personalization 0

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 35 | sephora.com product | PASS | PASS | **PASS** |  |
| 37 | allbirds.com product | PASS | PASS | **PASS** |  |
| 38 | target.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: no declared or rendered price read; search listed 0 product links |
| 41 | bathandbodyworks.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 43 | drsquatch.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | PASS | PASS | **PASS** |  |
| 46 | colourpop.com product (Klaviyo, Intelligems) | PASS | PASS | **PASS** |  |
| 47 | rothys.com product (Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |

**Totals:** 5 PASS, 3 NOT-OURS

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- sephora.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
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
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- puravidabracelets.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- rothys.com product (Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
