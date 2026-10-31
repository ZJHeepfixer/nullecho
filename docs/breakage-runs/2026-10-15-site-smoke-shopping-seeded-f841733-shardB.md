# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-15

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `e363e12ef9f50ae314b32420de0d9855659ef88a73a234ab5d980088cb675257`, 263.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `f841733` (ext/ and harness/ clean)
- **Runtime:** 910s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:53684` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

11 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://nolhiiljfihcocfllikkofmcfeidobga/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 40 | jcpenney.com product | Attentive, Constructor | **NOT-OURS** | 29.59 = 29.59 | — = — | — = — | ✗✗✗ / ✗✗✗ | 60/72/72 / 60/60/60 | — | 0, 0, 0 | 1 |
| 41 | bathandbodyworks.com product | Attentive, Monetate (not blocked), Einstein recs (not blocked) | **NOT-OURS** | 24.95 = 24.95 | — = — | — = — | ✗ / ✗ | W / W | — | 0 | 1 |
| 42 | instacart.com home | Rokt | **PASS** | — = — | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 43 | drsquatch.com product (Klaviyo) | Klaviyo, Constructor beacon | **PASS** | 7.00/55.00 = 7.00/55.00 | 7.00 = 7.00 | — = — | ✓✓✓ / ✓✓✓ | 24/24/24 / 24/24/24 | 6950×30 | 5, 5, 5 | 3 |
| 44 | beardbrand.com product (Klaviyo) | Klaviyo | **PASS** | 29.00/39.00 = 29.00/39.00 | 29.00 = 29.00 | 26.10 = 26.10 | ✓✓✓ / ✓✓✓ | 25/25/25 / 25/25/25 | 6950×24 | 4, 4, 4 | 0 |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems | **PASS** | 3.20/8.00 = 3.20/8.00 | — = — | 8.00 = 8.00 | ✓✓✓ / ✓✓✓ | 220/220/220 / 220/222/220 | 6900×18 6950×30 6952×6 | 16, 7, 7 | 0 |
| 46 | colourpop.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems, Attentive, Nosto | **PASS** | 24.00 = 24.00 | — = — | 24.00 = 24.00 | ✓✓✓ / ✓✓✓ | 54/54/54 / 54/54/54 | 6300×10 6704×3 6900×12 6950×18 | 12, 5, 5 | 1 |
| 47 | rothys.com product (Intelligems) | Intelligems, Attentive, Constructor | **NOT-OURS** | 109.00/125.00 = 109.00/125.00 | 109.00 = 109.00 | — = — | ✗✗✗ / ✗✗✗ | 2/2/2 / 2/2/2 | 6300×1 6900×3 | 4, 0, 0 | 3 |
| 48 | brooklinen.com product | Dynamic Yield, Attentive | **PASS** | 127.20/159.00 = 127.20/159.00 | 159.00/318.00 = 159.00/318.00 | 159.00 = 159.00 | ✓✓✓ / ✓✓✓ | 234/233/234 / 233/233/234 | 6300×1 | 1, 0, 0 | 1 |
| 59 | lowes.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 0 |
| 60 | homedepot.com search | — | **NOT-OURS** | — = — | — = — | — = — | ··· / ··· | ·/·/· / ·/·/· | — | 0, 0, 0 | 1 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 4 NOT-OURS, 6 PASS, 1 BLOCKED

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

_None._

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **40. jcpenney.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **41. bathandbodyworks.com product** (1 blocked-resource line(s)):
  - `uncaught: Cannot read properties of undefined (reading 'view')`
- **43. drsquatch.com product (Klaviyo)** (1 blocked-resource line(s)):
  - `console: Access to fetch at 'https://alocdn.com/c/9rgi64bf/a/xtarget/p.json' from origin 'https://www.drsquatch.com' has been blocked by CORS policy: No 'Access`
  - `console: Failed to load resource: net::ERR_FAILED`
  - `uncaught: Unhandled Promise Rejection: Failed to fetch`
- **44. beardbrand.com product (Klaviyo)** (1 blocked-resource line(s))
- **45. puravidabracelets.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s))
- **46. colourpop.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **47. rothys.com product (Intelligems)** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Cannot read properties of undefined (reading 'init')`
  - `uncaught: Unhandled Promise Rejection: igData does not exist. Intelligems may not have loaded.`
- **48. brooklinen.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **60. homedepot.com search** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`

### Every pair

#### 40. jcpenney.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.jcpenney.com/p/worthington-womens-modern-perfect-trouser/ppr5008151662`

- r1 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links
- r1 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 72 links
- r2 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 72 links
- r3 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 41. bathandbodyworks.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.bathandbodyworks.com/p/champagne-toast-3-wick-candle-028029548`

- r1 **OFF** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 307 · BLOCKED: challenge page (HTTP 200): "Press & Hold" — Access to this page has been denied — Press & Hold to confirm you are a huma
- r2 **ON** — http 307 · BLOCKED: challenge page (HTTP 200): "Press & Hold" — Access to this page has been denied — Press & Hold to confirm you are a huma · personalization matches 0
- r3 **OFF** — http 307 · BLOCKED: challenge page (HTTP 200): "Press & Hold" — Access to this page has been denied — Press & Hold to confirm you are a huma
- r3 **ON** — http 307 · BLOCKED: challenge page (HTTP 200): "Press & Hold" — Access to this page has been denied — Press & Hold to confirm you are a huma · personalization matches 0

#### 42. instacart.com home — **PASS**

`https://www.instacart.com/`

- r1 **OFF** — http 200
- r1 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200
- r2 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200
- r3 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0

#### 43. drsquatch.com product (Klaviyo) — **PASS**

`https://www.drsquatch.com/products/mountain-meadow`

- r1 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r1 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 19, personalization 5
- r2 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r2 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 20, personalization 5
- r3 **OFF** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms]
- r3 **ON** — http 200 · declared 7.00/55.00 USD (json-ld-set(2)) · rendered 7.00 ("$7.00") · cart ✓ same-site cart request 200 POST https://www.drsquatch.com/cart.data · search 24 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/pWh7nE/full-forms] · personalization matches 10 [6950 static-tracking.klaviyo.com] · tab tally (url) total 20, personalization 5

#### 44. beardbrand.com product (Klaviyo) — **PASS**

`https://www.beardbrand.com/products/tree-ranger-beard-oil`

- r1 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4710 reviews)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r1 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4710 reviews)") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 6, personalization 4
- r2 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4710 reviews)") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r2 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4710 reviews)") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 8, personalization 4
- r3 **OFF** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4710 reviews)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms]
- r3 **ON** — http 200 · declared 29.00/39.00 USD (json-ld-set(2)) · rendered 29.00 ("Product price: $29.00 (4710 reviews)") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.beardbrand.com/cart/add.js total 26.10 · search 25 links · klaviyo object, form nodes 0, form email inputs 0, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/hFArAj/full-forms] · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 9, personalization 4

#### 45. puravidabracelets.com product (Klaviyo, Intelligems) — **PASS**

`https://www.puravidabracelets.com/products/solid-original?variant=40140395479126`

- r1 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 0→1 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r1 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 0→1 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 30 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 25, personalization 16
- r2 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 1→2 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r2 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 1→2 total 8.00 · search 222 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 12 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 16, personalization 7
- r3 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 2→3 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r3 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.puravidabracelets.com/cart/add.js; cart badge 2→3 total 8.00 · search 220 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 12 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 16, personalization 7

#### 46. colourpop.com product (Klaviyo, Intelligems) — **PASS**

`https://colourpop.com/products/eeveelution-shadow-palette`

- r1 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r1 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 23 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6704 connect.nosto.com] · tab tally (url) total 19, personalization 12
- r2 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r2 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 10 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6704 connect.nosto.com] · tab tally (url) total 14, personalization 5
- r3 **OFF** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions []
- r3 **ON** — http 200 · declared 24.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://colourpop.com/cart/add.js total 24.00 · search 54 links · klaviyo object, form nodes 0, form email inputs 1, definitions [] · personalization matches 10 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv, 6704 connect.nosto.com] · tab tally (url) total 14, personalization 5

#### 47. rothys.com product (Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://rothys.com/products/womens-pointed-toe-flat-black`

- r1 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r1 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 4 [6900 api.intelligems.io, 6300 cdn.attn.tv] · tab tally (url) total 29, personalization 4
- r2 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r2 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 0 · tab tally (url) total 13, personalization 0
- r3 **OFF** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links
- r3 **ON** — http 200 · declared 109.00/125.00 USD (json-ld-set(2)) · rendered 109.00 ("$109") · cart ✗ no visible, enabled add-to-cart control · search 2 links · personalization matches 0 · tab tally (url) total 13, personalization 0

#### 48. brooklinen.com product — **PASS**

`https://www.brooklinen.com/products/classic-core-sheet-set?variant=41405018112090`

- r1 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 0→1 total 159.00 · search 234 links
- r1 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 0→1 total 159.00 · search 233 links · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 12, personalization 1
- r2 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js total 159.00 · search 233 links
- r2 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 159.00 ("$159") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js; cart badge 1→2 total 159.00 · search 233 links · personalization matches 0 · tab tally (url) total 9, personalization 0
- r3 **OFF** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 318.00 ("$318") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js total 159.00 · search 234 links
- r3 **ON** — http 200 · declared 127.20/159.00 USD (json-ld-set(2)) · rendered 318.00 ("$318") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.brooklinen.com/cart/add.js total 159.00 · search 234 links · personalization matches 0 · tab tally (url) total 9, personalization 0

#### 59. lowes.com search — **BLOCKED** — HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this server.

Reference #18.1b0ed217.1792106938.2007b021

https://errors.edgesuite.net/18.1b0ed217.1792106938.2007b021

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

#### 60. homedepot.com search — **NOT-OURS** — fails with the extension OFF too — off: no declared or rendered price read

`https://www.homedepot.com/s/hammer`

- r1 **OFF** — http 200
- r1 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200
- r2 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200
- r3 **ON** — http 200 · personalization matches 0 · tab tally (url) total 0, personalization 0

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 40 | jcpenney.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 41 | bathandbodyworks.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 42 | instacart.com home | PASS | PASS | **PASS** |  |
| 43 | drsquatch.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 44 | beardbrand.com product (Klaviyo) | PASS | PASS | **PASS** |  |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | PASS | PASS | **PASS** |  |
| 46 | colourpop.com product (Klaviyo, Intelligems) | PASS | PASS | **PASS** |  |
| 47 | rothys.com product (Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 48 | brooklinen.com product | PASS | PASS | **PASS** |  |
| 59 | lowes.com search | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.lowes.com/search?" on this server.

Reference #18.1b0ed217.1792106938.2 |
| 60 | homedepot.com search | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: no declared or rendered price read |

**Totals:** 4 NOT-OURS, 6 PASS, 1 BLOCKED

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- jcpenney.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- beardbrand.com product (Klaviyo) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
