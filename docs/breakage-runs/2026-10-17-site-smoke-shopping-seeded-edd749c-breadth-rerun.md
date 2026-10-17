# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `87df201d703c0752ebf88cf51cbd0e0c33a5880362f18ee7e4b5bc47792dd9c2`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `edd749c` (ext/ and harness/ clean)
- **Runtime:** 344s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:59341` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

4 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://cceihhcedlfedndbiacdkbfmjcijmacf/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 56 | dell.com product | — | **PASS** | 799.99 = 799.99 | — = — | — = — | · / · | · / · | — | 0, 0, 0 | 1 |
| 81 | untuckit.com product | — | **PASS** | 99.50 = 99.50 | 99.50 = 99.50 | — = — | ✗✗✓ / ✓✓✓ | 36/36/40 / 40/40/40 | — | 0, 0, 0 | 1 |
| 119 | nativecos.com product | Attentive, Rebuy, AB Tasty | **PASS** | 39.00/42.00 = 39.00/42.00 | — = — | — = — | ✗✓✓ / ✓✓✓ | 19/21/24 / 21/24/24 | 6300×3 6715×25 6801×25 | 7, 10, 11 | 2 |
| 131 | summerfridays.com product | Attentive, Intelligems | **PASS** | 315.00 = 315.00 | 315.00 = 315.00 | 315.00/22.00 = 315.00/22.00 | ✓✓✓ / ✓✓✓ | 51/51/53 / 51/51/53 | 6300×6 6900×36 | 6, 7, 7 | 5 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 4 PASS

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

_None._

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **56. dell.com product** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **81. untuckit.com product** (1 blocked-resource line(s)):
  - `uncaught: condition rejected ()=>!!bt()`
- **119. nativecos.com product** (1 blocked-resource line(s)):
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `uncaught: Failed to fetch`
- **131. summerfridays.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `uncaught: Failed to fetch r.fetch (https://summerfridays.com/cdn/wpm/s9f5e#wb#ap#c42m93b2bec3m.js:1:#)`
  - `console: Access to fetch at 'https://server.telemetry.services.yofi.ai/v3/tokens/upgrade' from origin 'https://summerfridays.com' has been blocked by CORS polic`
  - `console: Failed to load resource: net::ERR_FAILED`

### Every pair

#### 56. dell.com product — **PASS**

`https://www.dell.com/en-us/shop/laptop-computers/spd/xps13dx13260`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.dell.com/en-us/shop/laptop-comp
- r1 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 799.99 USD (json-ld)
- r2 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.dell.com/en-us/shop/laptop-comp
- r3 **ON** — http 200 · declared 799.99 USD (json-ld) · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 81. untuckit.com product — **PASS**

`https://www.untuckit.com/products/hemsworth-cabernet-rose?variant=44117139816526`

- r1 **OFF** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✗ no evidence · search 36 links
- r1 **ON** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; "added to cart/bag" message appeared; cart badge 0→1 total 99.50 · search 40 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✗ no evidence · search 36 links
- r2 **ON** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; cart badge 1→2 total 99.50 · search 40 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; "added to cart/bag" message appeared total 99.50 · search 40 links
- r3 **ON** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; cart badge 2→3 total 99.50 · search 40 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 119. nativecos.com product — **PASS**

`https://www.nativecos.com/products/starter-set?variant=67614907170990`

- r1 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 19 links
- r1 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.nativecos.com/cart/add.js total 39.00 · search 21 links · personalization matches 15 [6801 dcinfos-cache.abtasty.com, 6300 cdn.attn.tv, 6715 rebuyengine.com, 6801 ariane.abtasty.com] · tab tally (url) total 10, personalization 7
- r2 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.nativecos.com/cart/add.js total 39.00 · search 21 links
- r2 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 4→5; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 4→5 total 39.00 · search 24 links · personalization matches 19 [6801 ariane.abtasty.com, 6300 cdn.attn.tv, 6801 dcinfos-cache.abtasty.com, 6715 rebuyengine.com] · tab tally (url) total 15, personalization 10
- r3 **OFF** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 4→5; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 4→5 total 39.00 · search 24 links
- r3 **ON** — http 200 · declared 39.00/42.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 5→6; same-site cart request 200 POST https://www.nativecos.com/cart/add.js; cart badge 5→6 total 39.00 · search 24 links · personalization matches 19 [6300 cdn.attn.tv, 6801 ariane.abtasty.com, 6801 dcinfos-cache.abtasty.com, 6715 rebuyengine.com] · tab tally (url) total 15, personalization 11

#### 131. summerfridays.com product — **PASS**

`https://www.summerfridays.com/products/the-lip-butter-balm-vault`

- r1 **OFF** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://summerfridays.com/cart/add.js; cart badge 0→1 total 315.00 · search 51 links
- r1 **ON** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://summerfridays.com/cart/add.js; cart badge 0→1 total 315.00 · search 51 links · personalization matches 14 [6900 api.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 10, personalization 6
- r2 **OFF** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://summerfridays.com/cart/update.js; "added to cart/bag" message appeared; cart badge 2→3 total 315.00 · search 51 links
- r2 **ON** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://summerfridays.com/cart/add.js; "added to cart/bag" message appeared; cart badge 2→3 total 315.00 · search 51 links · personalization matches 12 [6900 api.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 10, personalization 7
- r3 **OFF** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 3→4; same-site cart request 200 POST https://summerfridays.com/cart/update.js; cart badge 3→4 total 22.00 · search 53 links
- r3 **ON** — http 200 · declared 315.00 USD (json-ld) · rendered 315.00 ("$315 ($477 VALUE)") · cart ✓ Shopify /cart.js item_count 3→4; same-site cart request 200 POST https://summerfridays.com/cart/update.js; cart badge 3→4 total 22.00 · search 53 links · personalization matches 16 [6900 api.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 10, personalization 7

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 56 | dell.com product | PASS | BLOCKED | **PASS** |  |
| 81 | untuckit.com product | PASS | FAIL | **PASS** |  |
| 119 | nativecos.com product | PASS | FAIL | **PASS** |  |
| 131 | summerfridays.com product | PASS | PASS | **PASS** |  |

**Totals:** 4 PASS

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- untuckit.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- untuckit.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- nativecos.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- summerfridays.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
