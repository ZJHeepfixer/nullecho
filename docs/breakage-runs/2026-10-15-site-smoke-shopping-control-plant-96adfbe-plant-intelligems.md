# Nullecho pre-release site smoke — SHOPPING LAB (2 rounds) — ⚠ NEGATIVE CONTROL — 2026-10-15

> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The unpacked store zip's `rules/personalization.json` was rewritten in the temp dir with a planted block rule (id 6999) on `cdn.intelligems.io` (sha256 packaged `5b145e54e1b30724…` → control `c3858783d653719a…`). Its FAILs, or its lower counts, are the point.

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `76af0fa7d8404381e3e1119c35f48abe865d8dfa5ada3bc134282e75439a6ec1`, 263.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `96adfbe` (ext/ and harness/ clean)
- **Runtime:** 292s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side
- **OFF browser really OFF:** ⚠ NO: null

## Shopping lab — the breakage lab for `rules/personalization.json`

4 pages × 2 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://eidlpadgdffnhpgcmnlhflcmicaeleoe/src/background.js; personalization match recorder: `installed`

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems | **PASS** | 3.20/8.00 = 3.20/8.00 | — = — | 8.00 = 8.00 | ✓✓ / ✓✓ | 220/220 / 220/220 | 6950×20 6952×4 6999×4 | 8, 8 | 0 |
| 46 | colourpop.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems, Attentive, Nosto | **PASS** | 24.00 = 24.00 | — = — | 24.00 = 24.00 | ✓✓ / ✓✓ | 54/54 / 54/54 | 6300×7 6704×2 6950×12 6999×4 | 7, 6 | 1 |
| 47 | rothys.com product (Intelligems) | Intelligems, Attentive, Constructor | **NOT-OURS** | 109.00/125.00 = 109.00/125.00 | 109.00 = 109.00 | — = — | ✗✗ / ✗✗ | 2/2 / 2/2 | 6300×1 6999×5 | 2, 2 | 4 |
| 57 | awaytravel.com product | — | **PASS** | 295.00 = 295.00 | — = — | — = — | ✓✓ / ✓✓ | ·/· / ·/· | 6950×5 6999×3 | 2, 6 | 0 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 3 PASS, 1 NOT-OURS

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

_None._

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **45. puravidabracelets.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s))
- **46. colourpop.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **47. rothys.com product (Intelligems)** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: checkStateAllowList is not a function`
  - `uncaught: Unhandled Promise Rejection: igData does not exist. Intelligems may not have loaded.`
  - `uncaught: Cannot read properties of undefined (reading 'init')`
- **57. awaytravel.com product** (1 blocked-resource line(s))

### Every pair

#### 45. puravidabracelets.com product (Klaviyo, Intelligems) — **PASS**

`https://www.puravidabracelets.com/products/solid-original?variant=40140395479126`

- r1 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 0→1 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r1 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 0→1 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 14 [6999 cdn.intelligems.io, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 14, personalization 8
- r2 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 1→2 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r2 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 1→2 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 14 [6999 cdn.intelligems.io, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 15, personalization 8

#### 46. colourpop.com product (Klaviyo, Intelligems) — **PASS**

`https://colourpop.com/products/eeveelution-shadow-palette`

- r1 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r1 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 13 [6999 cdn.intelligems.io, 6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6704 connect.nosto.com] · tab tally (url) total 13, personalization 7
- r2 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r2 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 12 [6999 cdn.intelligems.io, 6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com, 6704 connect.nosto.com] · tab tally (url) total 13, personalization 6

#### 47. rothys.com product (Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://rothys.com/products/womens-pointed-toe-flat-black`

- r1 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r1 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 3 [6999 cdn.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 17, personalization 2
- r2 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r2 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 3 [6999 cdn.intelligems.io] · tab tally (url) total 11, personalization 2

#### 57. awaytravel.com product — **PASS**

`https://www.awaytravel.com/suitcases/bigger-carry-on`

- r1 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js
- r1 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js · personalization matches 2 [6999 cdn.intelligems.io] · tab tally (url) total 6, personalization 2
- r2 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js
- r2 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✓ same-site cart request 200 POST https://www.awaytravel.com/cart/add.js · personalization matches 6 [6999 cdn.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 9, personalization 6

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | PASS | PASS | **PASS** |  |
| 46 | colourpop.com product (Klaviyo, Intelligems) | PASS | PASS | **PASS** |  |
| 47 | rothys.com product (Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 57 | awaytravel.com product | PASS | PASS | **PASS** |  |

**Totals:** 3 PASS, 1 NOT-OURS

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- puravidabracelets.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- colourpop.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- colourpop.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
