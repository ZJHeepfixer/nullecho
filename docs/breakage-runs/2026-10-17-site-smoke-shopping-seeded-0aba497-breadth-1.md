# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — SEEDED learned state — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `68deb662ed54af3d508a4f3893a711087f20bd0bbb25d7a79da2e9e8abf07c69`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `0aba497` (ext/ and harness/ clean)
- **Runtime:** 2960s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side — ON browsers SEEDED with learned state (below) before any site; third-party rows included
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:65443` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

34 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip, seeded with the learned state above) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://pjkbjefheobfmolijkhkeaeniabfnhkp/src/background.js; personalization match recorder: `installed`
- ON browser seeded: positive control ✅ (27/27), 12 learned rules live

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 29 | gymshark.com product | Dynamic Yield (consent-gated), mParticle | **NOT-OURS** | 26.00 = 26.00 | 26.00 = 26.00 | — = — | ✗✗✗ / ✗✗✗ | 60/60/60 / 60/60/60 | — | 0, 0, 0 | 0 |
| 33 | gap.com product | Rokt/mParticle, Granify, Attentive, Bluecore | **NOT-OURS** | 89.95 = 89.95 | 89.95 = 89.95 | — = — | ✗✗✗ / ✗✗✗ | 8/8/8 / 8/8/8 | 6200×11 6300×2 6500×2 6710×11 | 0, 11, 7 | 3 |
| 37 | allbirds.com product | Attentive | **PASS** | 100.00 = 100.00 | — = — | **—/100.00 → 100.00** | ✗✓✓ / ✓✓✓ | 87/88/89 / 89/88/89 | 6300×7 | 2, 1, 1 | 1 |
| 41 | bathandbodyworks.com product | Attentive, Monetate (not blocked), Einstein recs (not blocked) | **NOT-OURS** | 24.95 = 24.95 | — = — | — = — | ✗ / ✗ | W / W | — | 0 | 1 |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | Klaviyo, Intelligems | **NOT-OURS** | 3.20/8.00 = 3.20/8.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 221/221/221 / 221/221/221 | 6900×18 6950×30 6952×8 | 16, 7, 7 | 0 |
| 49 | walmart.com product | — | **FAIL** | **169.99 → 149.99** | **169.99 → 149.99** | — = — | ✗ / ✗ | W / W | — | 0 | 1 |
| 53 | zappos.com product | — | **NOT-OURS** | 37.50/60.00/65.00/70.00/75.00/80.00 = 37.50/60.00/65.00/70.00/75.00/80.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 110/110/110 / 110/110/110 | — | 0, 0, 0 | 0 |
| 57 | awaytravel.com product | — | **NOT-OURS** | 295.00 = 295.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6900×15 6950×5 | 9, 5, 0 | 0 |
| 61 | kohls.com search | — | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | — | 1 |
| 65 | asos.com product | — | **NOT-OURS** | 19.99 = 19.99 | 19.99 = 19.99 | — = — | ✗✗✗ / ✗✗✗ | 72/72/72 / 72/72/72 | — | 0, 0, 0 | 4 |
| 69 | cutsclothing.com product | Intelligems, Klaviyo | **NOT-OURS** | 98.00 = 98.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6900×3 6950×12 | 5, 5, 5 | 1 |
| 73 | nordstrom.com product | — | **PASS** | 18.00 = 18.00 | — = — | — = — | ✓✓✓ / ✓✓✓ | 71/71/71 / 71/71/71 | — | 0, 0, 0 | 0 |
| 77 | quince.com product | Attentive | **NOT-OURS** | — = — | 0.00 = 0.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6300×3 | 1, 1, 1 | 1 |
| 81 | untuckit.com product | — | **FAIL** | 99.50 = 99.50 | **99.50 → 99.50/199.00** | **— → 99.50** | ✗✗✗ / ✓✓✓ | 36/36/36 / 40/40/40 | — | 0, 0, 0 | 0 |
| 85 | glossier.com product | Klaviyo | **PASS** | 20.00 = 20.00 | 20.00 = 20.00 | 20.00 = 20.00 | ✓✓✓ / ✓✓✓ | 246/242/246 / 242/242/242 | 6950×24 | 4, 4, 4 | 2 |
| 89 | olaplex.com product | Klaviyo | **NOT-OURS** | 58.00 = 58.00 | 34.00 = 34.00 | — = — | ✗✗✗ / ✗✗✗ | 26/26/26 / 26/26/26 | 6950×30 6952×12 | 7, 7, 7 | 0 |
| 93 | analuisa.com product | Intelligems | **PASS** | 375.00 = 375.00 | 375.00 = 375.00 | — = — | ✓✗✓ / ✗✓✓ | ·/·/· / ·/·/· | 6700×2 6900×1 | 1, 0, 0 | 0 |
| 97 | bollandbranch.com product | AB Tasty | **PASS** | 49.00 = 49.00 | 49.00 = 49.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6801×6 | 2, 2, 2 | 2 |
| 101 | carawayhome.com product | Intelligems, Klaviyo | **NOT-OURS** | 445.00/595.00/675.00/775.00 = 445.00/595.00/675.00/775.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | 6900×3 6950×15 | 6, 6, 6 | 0 |
| 105 | eatfishwife.com product | Black Crow, Intelligems, Klaviyo | **NOT-OURS** | 45.00 = 45.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 31/31/31 / 31/31/31 | 6950×24 | 4, 4, 4 | 0 |
| 109 | huel.com product | — | **NOT-OURS** | 42.65/46.65 = 42.65/46.65 | 32.00 = 32.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 113 | kotn.com product | — | **NOT-OURS** | 79.00 = 79.00 | 79.00 = 79.00 | — = — | ✗✗✗ / ✗✗✗ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |
| 117 | mvmt.com product | — | **NOT-OURS** | 144.00 = 144.00 | 144.00 = 144.00 | — = — | ✗✗✗ / ✗✗✗ | 23/23/23 / 23/23/23 | — | 0, 0, 0 | 1 |
| 121 | fromourplace.com product | Attentive, Klaviyo | **NOT-OURS** | 499.95/549.95 = 499.95/549.95 | 499.95 = 499.95 | — = — | ✗✗✗ / ✗✗✗ | 67/67/67 / 67/67/67 | 6300×10 6950×24 | 7, 6, 6 | 1 |
| 125 | rhoback.com product | Intelligems, Klaviyo | **NOT-OURS** | 58.00 = 58.00 | — = — | — = — | ✗✗✗ / ✗✗✗ | 49/49/49 / 49/49/49 | 6900×9 6950×24 | 5, 5, 5 | 0 |
| 129 | snowehome.com product | Wunderkind, Klaviyo | **NOT-OURS** | 25.20 = 25.20 | 35.00 = 35.00 | — = — | ✗✗✗ / ✗✗✗ | 32/32/32 / 32/32/32 | 6400×6 6950×24 6952×10 | 7, 7, 7 | 0 |
| 133 | thursdayboots.com product | Klaviyo | **PASS** | 235.00 = 235.00 | 235.00 = 235.00 | 235.00 = 235.00 | ✓✓✓ / ✓✓✓ | 33/33/33 / 33/33/33 | 6950×3 | 3, 0, 0 | 0 |
| 137 | hp.com product | Dynamic Yield, Attentive | **PASS** | 849.99 = 849.99 | 710.00 = 710.00 | — = — | ✓✓✗ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 2 |
| 141 | article.com product | — | **PASS** | 1799.00 = 1799.00 | 1799.00 = 1799.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | 6700×3 | 0, 0, 0 | 0 |
| 145 | ruggable.com product | Klaviyo | **PASS** | 19.00 = 19.00 | 19.00/38.00 = 19.00/38.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 4 |
| 149 | wildone.com product | Rebuy, Intelligems, Klaviyo | **PASS** | 45.00 = 45.00 | 50.00 = 50.00 | 45.00 = 45.00 | ✓✓✓ / ✓✓✓ | 47/47/47 / 47/47/47 | 6715×15 6900×3 6950×18 | 6, 6, 6 | 3 |
| 153 | famousfootwear.com product | Attentive, Coveo, Bluecore | **BLOCKED** |  =  |  =  |  =  | · / · |  /  | — | 0, 0, 0 | 8 |
| 157 | academy.com product | — | **PASS** | 149.99 = 149.99 | 149.99 = 149.99 | — = — | ✓✗✗ / ✗✓✗ | W/W/W / W/W/W | — | 0, 0, 0 | 1 |
| 161 | scheels.com product | Klaviyo | **PASS** | 29.99 = 29.99 | — = — | — = — | ✗✗✗ / ✓✓✓ | 22/22/23 / 22/23/22 | — | 0, 0, 0 | 1 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 18 NOT-OURS, 12 PASS, 2 FAIL, 2 BLOCKED

### Every price difference in every pair — including noise

- 49. walmart.com product: r1: DECLARED PRICE DIFFERS: OFF 169.99 vs ON 149.99
- 49. walmart.com product: r1: RENDERED PRICE DIFFERS: OFF 169.99 vs ON 149.99
- 81. untuckit.com product: r3: RENDERED PRICE DIFFERS: OFF 99.50 vs ON 199.00

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 93. analuisa.com product: r1: add-to-cart worked OFF, not ON
- 157. academy.com product: r1: add-to-cart worked OFF, not ON

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **29. gymshark.com product** (1 blocked-resource line(s))
- **33. gap.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error sending event to mParticle servers. TypeError: Failed to fetch`
  - `console: Failed to load resource: net::ERR_CONNECTION_RESET`
- **37. allbirds.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **41. bathandbodyworks.com product** (1 blocked-resource line(s)):
  - `uncaught: Cannot read properties of undefined (reading 'view')`
- **45. puravidabracelets.com product (Klaviyo, Intelligems)** (1 blocked-resource line(s))
- **49. walmart.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **53. zappos.com product** (1 blocked-resource line(s))
- **57. awaytravel.com product** (1 blocked-resource line(s))
- **61. kohls.com search** (0 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **65. asos.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Unhandled Promise Rejection: API CALL FAILED: TypeError: Failed to fetch`
  - `uncaught: Unhandled Promise Rejection: Unhandled Promise Rejection: API CALL FAILED: TypeError: Failed to fetch`
  - `uncaught: Unhandled Promise Rejection: API CALL FAILED: TypeError: Failed to fetch https://www.asos.com/assets/productpg/vendor.d2abd44ab77fd#.js:2:# async C (h`
- **69. cutsclothing.com product** (1 blocked-resource line(s)):
  - `uncaught: window.narvar is not a function`
- **73. nordstrom.com product** (1 blocked-resource line(s))
- **77. quince.com product** (1 blocked-resource line(s)):
  - `console: TypeError: Failed to fetch`
- **81. untuckit.com product** (1 blocked-resource line(s))
- **85. glossier.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
- **89. olaplex.com product** (1 blocked-resource line(s))
- **93. analuisa.com product** (1 blocked-resource line(s))
- **97. bollandbranch.com product** (1 blocked-resource line(s)):
  - `uncaught: Uncaught (in promise) geoloc service failure`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **101. carawayhome.com product** (1 blocked-resource line(s))
- **105. eatfishwife.com product** (1 blocked-resource line(s))
- **109. huel.com product** (1 blocked-resource line(s))
- **113. kotn.com product** (1 blocked-resource line(s))
- **117. mvmt.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
- **121. fromourplace.com product** (1 blocked-resource line(s)):
  - `console: Amplitude failed to load`
- **125. rhoback.com product** (1 blocked-resource line(s))
- **129. snowehome.com product** (1 blocked-resource line(s))
- **133. thursdayboots.com product** (1 blocked-resource line(s))
- **137. hp.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `uncaught: Uncaught (in promise) Error: timeout`
- **141. article.com product** (1 blocked-resource line(s))
- **145. ruggable.com product** (1 blocked-resource line(s)):
  - `console: Amplitude Logger [Error]: Failed to generate joined config: Error: No remote config received`
  - `console: TypeError: Failed to fetch`
  - `console: Amplitude Logger [Error]: Failed to fetch`
  - `console: Amplitude Logger [Error]: Event rejected due to exceeded retry count`
- **149. wildone.com product** (1 blocked-resource line(s)):
  - `console: Clarity pixel failed to start... TypeError: Failed to fetch`
  - `console: undefined : - Error: Failed to fetch [object Object]`
  - `uncaught: Failed to fetch r.fetch (https://wildone.com/web-pixels@9f5e#wb#ap#c42m93b2bec3/web-pixel-#@#d5a2ef62c#e49fd58dba0/sandbox/worker.modern.js:1:#)`
- **153. famousfootwear.com product** (1 blocked-resource line(s)):
  - `uncaught: data is not defined`
  - `uncaught: AppleID is not defined`
  - `uncaught: _satellite is not defined`
  - `uncaught: Cannot read properties of undefined (reading 'get')`
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: Error: BV's rating summary app requires a product Id.`
  - `uncaught: Uncaught (in promise) Error: The reviews container must have data-bv-product-id="<ExternalIdFromCatalog>".`
  - `console: Error: The reviews container must have data-bv-product-id="<ExternalIdFromCatalog>".`
- **157. academy.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **161. scheels.com product** (1 blocked-resource line(s)):
  - `console: Error fetching UGC counts: Error: Blocked fetch request to URL: https://cdn-ws.turnto.com/v5/sitedata/TXOE2FrZzlhkSdesite/#-C05-24/d/ugc/counts/en_US`

### Every pair

#### 29. gymshark.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22`

- r1 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links
- r1 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links
- r2 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 2, personalization 0
- r3 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links
- r3 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links · personalization matches 0 · tab tally (url) total 2, personalization 0

#### 33. gap.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.gap.com/browse/product.do?pid=403540002&vid=REGULAR`

- r1 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r1 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 0 · tab tally (url) total 12, personalization 0
- r2 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r2 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 16 [6300 cdn.attn.tv, 6500 cdn.granify.com, 6710 onsitestats.bluecore.com, 6200 apps.rokt-api.com] · tab tally (url) total 27, personalization 11
- r3 **OFF** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links
- r3 **ON** — http 200 · declared 89.95 USD (json-ld) · rendered 89.95 ("$89.95") · cart ✗ no evidence · search 8 links · personalization matches 10 [6300 cdn.attn.tv, 6710 onsitestats.bluecore.com, 6500 cdn.granify.com, 6200 apps.rokt-api.com] · tab tally (url) total 18, personalization 7

#### 37. allbirds.com product — **PASS**

`https://www.allbirds.com/products/mens-tree-runners`

- r1 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✗ no evidence (picked 8) · search 87 links
- r1 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 89 links · personalization matches 3 [6300 cdn.attn.tv] · tab tally (url) total 6, personalization 2
- r2 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 0→1 total 100.00 (picked 8) · search 88 links
- r2 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 1→2 total 100.00 (picked 8) · search 88 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 6, personalization 1
- r3 **OFF** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 1→2 total 100.00 (picked 8) · search 89 links
- r3 **ON** — http 200 · declared 100.00 USD (json-ld) · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.allbirds.com/cart/add.js; cart badge 2→3 total 100.00 (picked 8) · search 89 links · personalization matches 2 [6300 cdn.attn.tv] · tab tally (url) total 6, personalization 1

#### 41. bathandbodyworks.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.bathandbodyworks.com/p/champagne-toast-3-wick-candle-028029548`

- r1 **OFF** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 24.95 USD (json-ld) · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 2, personalization 0
- r2 **OFF** — http 307 · BLOCKED: challenge page (HTTP 200): "Access to this page has been denied" — Access to this page has been denied — Press & Hold to
- r2 **ON** — http 307 · BLOCKED: challenge page (HTTP 200): "Access to this page has been denied" — Access to this page has been denied — Press & Hold to · personalization matches 0
- r3 **OFF** — http 307 · BLOCKED: challenge page (HTTP 200): "Access to this page has been denied" — Access to this page has been denied — Press & Hold to
- r3 **ON** — http 307 · BLOCKED: challenge page (HTTP 200): "Access to this page has been denied" — Access to this page has been denied — Press & Hold to · personalization matches 0

#### 45. puravidabracelets.com product (Klaviyo, Intelligems) — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.puravidabracelets.com/products/solid-original?variant=40140395479126`

- r1 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r1 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [200 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 30 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 22, personalization 16
- r2 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r2 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 16, personalization 7
- r3 **OFF** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms]
- r3 **ON** — http 200 · declared 3.20/8.00 USD (json-ld-set(2)) · cart ✗ no evidence · search 221 links · klaviyo object, form nodes 35, form email inputs 6, definitions [304 https://static-forms.klaviyo.com/forms/api/v7/JpiXrs/full-forms] · personalization matches 12 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 15, personalization 7

#### 49. walmart.com product — **FAIL** — ON read a price OFF never read: 149.99, 149.99 — r1: DECLARED PRICE DIFFERS: OFF 169.99 vs ON 149.99 \| r1: RENDERED PRICE DIFFERS: OFF 169.99 vs ON 149.99

`https://www.walmart.com/ip/AirPods-Pro-2nd-generation-with-MagSafe-Case-USB-C/5689919121`

- r1 **OFF** — http 200 · declared 169.99  (microdata) · rendered 169.99 ("Now $169.99") · cart ✗ no evidence · search WALLED
- r1 **ON** — http 200 · declared 149.99  (microdata) · rendered 149.99 ("Now $149.99") · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm 
- r2 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm  · personalization matches 0
- r3 **OFF** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm 
- r3 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Robot or human" — Robot or human? — Robot or human? Activate and hold the button to confirm  · personalization matches 0

#### 53. zappos.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.zappos.com/p/converse-chuck-taylor-all-star-high-top-sneaker-black/product/107999/color/3`

- r1 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 110 links
- r1 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 110 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 110 links
- r2 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 110 links · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 110 links
- r3 **ON** — http 200 · declared 37.50/60.00/65.00/70.00/75.00/80.00 USD (json-ld-set(6)) · cart ✗ no evidence · search 110 links · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 57. awaytravel.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.awaytravel.com/suitcases/bigger-carry-on`

- r1 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence
- r1 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence · personalization matches 15 [6900 api.intelligems.io] · tab tally (url) total 11, personalization 9
- r2 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence
- r2 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence · personalization matches 5 [6950 static-tracking.klaviyo.com] · tab tally (url) total 10, personalization 5
- r3 **OFF** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence
- r3 **ON** — http 200 · declared 295.00 USD (json-ld) · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 61. kohls.com search — **BLOCKED** — HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this server.

Reference #18.180ed217.1792256090.209438d5

https://errors.edgesuite.net/18.180ed217.1792256090.209438d5

`https://www.kohls.com/search.jsp?search=towel`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this 
- r1 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w · personalization matches 0
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this 
- r2 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w · personalization matches 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this 
- r3 **ON** — http 200 · BLOCKED: challenge page (HTTP 200): "Access Denied" — Access Denied — Access Denied You don't have permission to access "http://w · personalization matches 0

#### 65. asos.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.asos.com/us/cotton-on/cotton-on-90s-baby-tee-in-white/prd/208039168`

- r1 **OFF** — http 200 · declared 19.99 USD (json-ld) · rendered 19.99 ("$19.99 $19.99") · cart ✗ no evidence · search 72 links
- r1 **ON** — http 200 · declared 19.99 USD (json-ld) · rendered 19.99 ("$19.99 $19.99") · cart ✗ no evidence · search 72 links · personalization matches 0 · tab tally (url) total 27, personalization 0
- r2 **OFF** — http 200 · declared 19.99 USD (json-ld) · rendered 19.99 ("$19.99 $19.99") · cart ✗ no evidence · search 72 links
- r2 **ON** — http 200 · declared 19.99 USD (json-ld) · rendered 19.99 ("$19.99 $19.99") · cart ✗ no evidence · search 72 links · personalization matches 0 · tab tally (url) total 38, personalization 0
- r3 **OFF** — http 200 · declared 19.99 USD (json-ld) · rendered 19.99 ("$19.99 $19.99") · cart ✗ no evidence · search 72 links
- r3 **ON** — http 200 · declared 19.99 USD (json-ld) · rendered 19.99 ("$19.99 $19.99") · cart ✗ no evidence · search 72 links · personalization matches 0 · tab tally (url) total 47, personalization 0

#### 69. cutsclothing.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.cutsclothing.com/products/foundation-air-relaxed-pleated-trouser-dark-graphite`

- r1 **OFF** — http 200 · declared 98.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · declared 98.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · personalization matches 5 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 16, personalization 5
- r2 **OFF** — http 200 · declared 98.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 98.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · personalization matches 5 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 18, personalization 5
- r3 **OFF** — http 200 · declared 98.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 98.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · personalization matches 5 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 18, personalization 5

#### 73. nordstrom.com product — **PASS**

`https://www.nordstrom.com/s/assorted-4-pack-everyday-rib-crew-socks/8802665?origin=keywordsearch-personalizedsort&breadcrumb=Home%2FAll+Results&color=444445Y479`

- r1 **OFF** — http 200 · declared 18.00 USD (json-ld) · cart ✓ "added to cart/bag" message appeared · search 71 links
- r1 **ON** — http 200 · declared 18.00 USD (json-ld) · cart ✓ "added to cart/bag" message appeared · search 71 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 18.00 USD (json-ld) · cart ✓ "added to cart/bag" message appeared · search 71 links
- r2 **ON** — http 200 · declared 18.00 USD (json-ld) · cart ✓ "added to cart/bag" message appeared · search 71 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 18.00 USD (json-ld) · cart ✓ "added to cart/bag" message appeared · search 71 links
- r3 **ON** — http 200 · declared 18.00 USD (json-ld) · cart ✓ "added to cart/bag" message appeared · search 71 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 77. quince.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.quince.com/shop/women/cashmere`

- r1 **OFF** — http 200 · rendered 0.00 ("$0-10 $10-25 $25-50 $50-75 $75-100 Show 5 More") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · rendered 0.00 ("$0-10 $10-25 $25-50 $50-75 $75-100 Show 5 More") · cart ✗ no visible, enabled add-to-cart control · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 15, personalization 1
- r2 **OFF** — http 200 · rendered 0.00 ("$0-10 $10-25 $25-50 $50-75 $75-100 Show 5 More") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · rendered 0.00 ("$0-10 $10-25 $25-50 $50-75 $75-100 Show 5 More") · cart ✗ no visible, enabled add-to-cart control · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 9, personalization 1
- r3 **OFF** — http 200 · rendered 0.00 ("$0-10 $10-25 $25-50 $50-75 $75-100 Show 5 More") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · rendered 0.00 ("$0-10 $10-25 $25-50 $50-75 $75-100 Show 5 More") · cart ✗ no visible, enabled add-to-cart control · personalization matches 1 [6300 cdn.attn.tv] · tab tally (url) total 9, personalization 1

#### 81. untuckit.com product — **FAIL** — ON read a price OFF never read: 199.00 — r3: RENDERED PRICE DIFFERS: OFF 99.50 vs ON 199.00

`https://www.untuckit.com/products/hemsworth-cabernet-rose?variant=44117139816526`

- r1 **OFF** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✗ no evidence · search 36 links
- r1 **ON** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; "added to cart/bag" message appeared total 99.50 · search 40 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✗ no evidence · search 36 links
- r2 **ON** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; cart badge 1→2 total 99.50 · search 40 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 200 · declared 99.50 USD (json-ld) · rendered 99.50 ("$99.50") · cart ✗ no evidence · search 36 links
- r3 **ON** — http 200 · declared 99.50 USD (json-ld) · rendered 199.00 ("$199.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.untuckit.com/cart/add.js; cart badge 2→3 total 99.50 · search 40 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 85. glossier.com product — **PASS**

`https://www.glossier.com/products/black-cherry-lip-line-balm-duo`

- r1 **OFF** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.glossier.com/cart/add.js total 20.00 · search 246 links
- r1 **ON** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://www.glossier.com/cart/update.js total 20.00 · search 242 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 15, personalization 4
- r2 **OFF** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.glossier.com/cart/add.js total 20.00 · search 242 links
- r2 **ON** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://www.glossier.com/cart/add.js total 20.00 · search 242 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 18, personalization 4
- r3 **OFF** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.glossier.com/cart/update.js total 20.00 · search 246 links
- r3 **ON** — http 200 · declared 20.00 USD (json-ld) · rendered 20.00 ("$20") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://www.glossier.com/cart/add.js total 20.00 · search 242 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 4

#### 89. olaplex.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://olaplex.com/products/olaplex-the-healthy-hair-travel-set-us`

- r1 **OFF** — http 200 · declared 58.00 USD (json-ld) · rendered 34.00 ("$34.00") · cart ✗ no evidence · search 26 links
- r1 **ON** — http 200 · declared 58.00 USD (json-ld) · rendered 34.00 ("$34.00") · cart ✗ no evidence · search 26 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 14, personalization 7
- r2 **OFF** — http 200 · declared 58.00 USD (json-ld) · rendered 34.00 ("$34.00") · cart ✗ no evidence · search 26 links
- r2 **ON** — http 200 · declared 58.00 USD (json-ld) · rendered 34.00 ("$34.00") · cart ✗ no evidence · search 26 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 14, personalization 7
- r3 **OFF** — http 200 · declared 58.00 USD (json-ld) · rendered 34.00 ("$34.00") · cart ✗ no evidence · search 26 links
- r3 **ON** — http 200 · declared 58.00 USD (json-ld) · rendered 34.00 ("$34.00") · cart ✗ no evidence · search 26 links · personalization matches 14 [6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 13, personalization 7

#### 93. analuisa.com product — **PASS** — minority differences: r1: add-to-cart worked OFF, not ON

`https://www.analuisa.com/products/solid-yellow-gold-pearl-station-necklace`

- r1 **OFF** — http 200 · declared 375.00 USD (json-ld) · rendered 375.00 ("$375") · cart ✓ same-site cart request 200 POST https://www.analuisa.com/.netlify/functions/add-to-cart; cart badge 0→1
- r1 **ON** — http 200 · declared 375.00 USD (json-ld) · rendered 375.00 ("$375") · cart ✗ no evidence · personalization matches 1 [6900 api.intelligems.io] · tab tally (url) total 9, personalization 1
- r2 **OFF** — http 304 · declared 375.00 USD (json-ld) · rendered 375.00 ("$375") · cart ✗ no evidence
- r2 **ON** — http 304 · declared 375.00 USD (json-ld) · rendered 375.00 ("$375") · cart ✓ same-site cart request 200 POST https://www.analuisa.com/.netlify/functions/add-to-cart; cart badge 0→1 · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 8, personalization 0
- r3 **OFF** — http 200 · declared 375.00 USD (json-ld) · rendered 375.00 ("$375") · cart ✓ same-site cart request 200 POST https://www.analuisa.com/.netlify/functions/add-to-cart; cart badge 1→2
- r3 **ON** — http 200 · declared 375.00 USD (json-ld) · rendered 375.00 ("$375") · cart ✓ same-site cart request 200 POST https://www.analuisa.com/.netlify/functions/add-to-cart; cart badge 1→2 · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 8, personalization 0

#### 97. bollandbranch.com product — **PASS**

`https://www.bollandbranch.com/products/signature-fitted-crib-sheet/`

- r1 **OFF** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49 20 REVIEWS") · cart ✓ same-site cart request 200 POST https://www.bollandbranch.com/cart.data; "added to cart/bag" message appeared; cart badge 0→1
- r1 **ON** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49 20 REVIEWS") · cart ✓ same-site cart request 200 POST https://www.bollandbranch.com/cart.data · personalization matches 2 [6801 dcinfos-cache.abtasty.com] · tab tally (url) total 3, personalization 2
- r2 **OFF** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49 20 REVIEWS") · cart ✓ same-site cart request 200 POST https://www.bollandbranch.com/cart.data; "added to cart/bag" message appeared; cart badge 1→2
- r2 **ON** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49 20 REVIEWS") · cart ✓ same-site cart request 200 POST https://www.bollandbranch.com/cart.data; "added to cart/bag" message appeared; cart badge 1→2 · personalization matches 2 [6801 dcinfos-cache.abtasty.com] · tab tally (url) total 4, personalization 2
- r3 **OFF** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49 SEE REVIEWS") · cart ✓ same-site cart request 200 POST https://www.bollandbranch.com/cart.data; "added to cart/bag" message appeared; cart badge 2→3
- r3 **ON** — http 200 · declared 49.00 USD (json-ld) · rendered 49.00 ("$49 20 REVIEWS") · cart ✓ same-site cart request 200 POST https://www.bollandbranch.com/cart.data; "added to cart/bag" message appeared; cart badge 2→3 · personalization matches 2 [6801 dcinfos-cache.abtasty.com] · tab tally (url) total 4, personalization 2

#### 101. carawayhome.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.carawayhome.com/products/cookware-sets`

- r1 **OFF** — http 200 · declared 445.00/595.00/675.00/775.00 USD (json-ld-set(4)) · cart ✗ no evidence
- r1 **ON** — http 200 · declared 445.00/595.00/675.00/775.00 USD (json-ld-set(4)) · cart ✗ no evidence · personalization matches 6 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 26, personalization 6
- r2 **OFF** — http 200 · declared 445.00/595.00/675.00/775.00 USD (json-ld-set(4)) · cart ✗ no evidence
- r2 **ON** — http 200 · declared 445.00/595.00/675.00/775.00 USD (json-ld-set(4)) · cart ✗ no evidence · personalization matches 6 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 28, personalization 6
- r3 **OFF** — http 200 · declared 445.00/595.00/675.00/775.00 USD (json-ld-set(4)) · cart ✗ no evidence
- r3 **ON** — http 200 · declared 445.00/595.00/675.00/775.00 USD (json-ld-set(4)) · cart ✗ no evidence · personalization matches 6 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 28, personalization 6

#### 105. eatfishwife.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://eatfishwife.com/products/the-spicy-trio-3-pack-2?variant=49258924867836`

- r1 **OFF** — http 200 · declared 45.00 USD (json-ld) · cart ✗ no evidence · search 31 links
- r1 **ON** — http 200 · declared 45.00 USD (json-ld) · cart ✗ no evidence · search 31 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 13, personalization 4
- r2 **OFF** — http 200 · declared 45.00 USD (json-ld) · cart ✗ no evidence · search 31 links
- r2 **ON** — http 200 · declared 45.00 USD (json-ld) · cart ✗ no evidence · search 31 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 12, personalization 4
- r3 **OFF** — http 304 · declared 45.00 USD (json-ld) · cart ✗ no evidence · search 31 links
- r3 **ON** — http 304 · declared 45.00 USD (json-ld) · cart ✗ no evidence · search 31 links · personalization matches 8 [6950 static-tracking.klaviyo.com] · tab tally (url) total 12, personalization 4

#### 109. huel.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://huel.com/products/huel-daily-greens-ready-to-drink`

- r1 **OFF** — http 200 · declared 42.65/46.65 USD (json-ld-set(2)) · rendered 32.00 ("$32/box") · cart ✗ no visible, enabled add-to-cart control
- r1 **ON** — http 200 · declared 42.65/46.65 USD (json-ld-set(2)) · rendered 32.00 ("$32/box") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 42.65/46.65 USD (json-ld-set(2)) · rendered 32.00 ("$32/box") · cart ✗ no visible, enabled add-to-cart control
- r2 **ON** — http 200 · declared 42.65/46.65 USD (json-ld-set(2)) · rendered 32.00 ("$32/box") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 42.65/46.65 USD (json-ld-set(2)) · rendered 32.00 ("$32/box") · cart ✗ no visible, enabled add-to-cart control
- r3 **ON** — http 200 · declared 42.65/46.65 USD (json-ld-set(2)) · rendered 32.00 ("$32/box") · cart ✗ no visible, enabled add-to-cart control · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 113. kotn.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://kotn.com/products/unisex-antifit-denim?colour=dark-wash`

- r1 **OFF** — http 200 · declared 79.00 USD (json-ld) · rendered 79.00 ("$79 $138 Final Sale") · cart ✗ no evidence
- r1 **ON** — http 200 · declared 79.00 USD (json-ld) · rendered 79.00 ("$79 $138 Final Sale") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 3, personalization 0
- r2 **OFF** — http 304 · declared 79.00 USD (json-ld) · rendered 79.00 ("$79 $138 Final Sale") · cart ✗ no evidence
- r2 **ON** — http 304 · declared 79.00 USD (json-ld) · rendered 79.00 ("$79 $138 Final Sale") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 3, personalization 0
- r3 **OFF** — http 200 · declared 79.00 USD (json-ld) · rendered 79.00 ("$79 $138 Final Sale") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 79.00 USD (json-ld) · rendered 79.00 ("$79 $138 Final Sale") · cart ✗ no evidence · personalization matches 0 · tab tally (url) total 3, personalization 0

#### 117. mvmt.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.mvmt.com/products/odyssey-ii-ceramic-fusion-grey-40mm-28000461`

- r1 **OFF** — http 200 · declared 144.00 USD (json-ld) · rendered 144.00 ("Sale price $144.00 Regular price $288.00") · cart ✗ no evidence · search 23 links
- r1 **ON** — http 200 · declared 144.00 USD (json-ld) · rendered 144.00 ("Sale price $144.00 Regular price $288.00") · cart ✗ no evidence · search 23 links · personalization matches 0 · tab tally (url) total 7, personalization 0
- r2 **OFF** — http 200 · declared 144.00 USD (json-ld) · rendered 144.00 ("Sale price $144.00 Regular price $288.00") · cart ✗ no evidence · search 23 links
- r2 **ON** — http 200 · declared 144.00 USD (json-ld) · rendered 144.00 ("Sale price $144.00 Regular price $288.00") · cart ✗ no evidence · search 23 links · personalization matches 0 · tab tally (url) total 6, personalization 0
- r3 **OFF** — http 200 · declared 144.00 USD (json-ld) · rendered 144.00 ("Sale price $144.00 Regular price $288.00") · cart ✗ no evidence · search 23 links
- r3 **ON** — http 200 · declared 144.00 USD (json-ld) · rendered 144.00 ("Sale price $144.00 Regular price $288.00") · cart ✗ no evidence · search 23 links · personalization matches 0 · tab tally (url) total 6, personalization 0

#### 121. fromourplace.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://fromourplace.com/products/titanium-pro-cookware-set?variant=67704731533506`

- r1 **OFF** — http 200 · declared 499.95/549.95 USD (json-ld-set(2)) · rendered 499.95 ("$499.95") · cart ✗ no evidence · search 67 links
- r1 **ON** — http 200 · declared 499.95/549.95 USD (json-ld-set(2)) · rendered 499.95 ("$499.95") · cart ✗ no evidence · search 67 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 18, personalization 7
- r2 **OFF** — http 200 · declared 499.95/549.95 USD (json-ld-set(2)) · rendered 499.95 ("$499.95") · cart ✗ no evidence · search 67 links
- r2 **ON** — http 200 · declared 499.95/549.95 USD (json-ld-set(2)) · rendered 499.95 ("$499.95") · cart ✗ no evidence · search 67 links · personalization matches 11 [6950 static-tracking.klaviyo.com, 6300 cdn.attn.tv] · tab tally (url) total 17, personalization 6
- r3 **OFF** — http 200 · declared 499.95/549.95 USD (json-ld-set(2)) · rendered 499.95 ("$499.95") · cart ✗ no evidence · search 67 links
- r3 **ON** — http 200 · declared 499.95/549.95 USD (json-ld-set(2)) · rendered 499.95 ("$499.95") · cart ✗ no evidence · search 67 links · personalization matches 11 [6300 cdn.attn.tv, 6950 static-tracking.klaviyo.com] · tab tally (url) total 16, personalization 6

#### 125. rhoback.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control)

`https://www.rhoback.com/products/womens-tops-vista-sports-bra-solid-fleet-navy?variant=42921398796371`

- r1 **OFF** — http 200 · declared 58.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · search 49 links
- r1 **ON** — http 200 · declared 58.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · search 49 links · personalization matches 11 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 5
- r2 **OFF** — http 200 · declared 58.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · search 49 links
- r2 **ON** — http 200 · declared 58.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · search 49 links · personalization matches 11 [6950 static-tracking.klaviyo.com, 6900 api.intelligems.io] · tab tally (url) total 7, personalization 5
- r3 **OFF** — http 200 · declared 58.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · search 49 links
- r3 **ON** — http 200 · declared 58.00 USD (json-ld) · cart ✗ no visible, enabled add-to-cart control · search 49 links · personalization matches 11 [6900 api.intelligems.io, 6950 static-tracking.klaviyo.com] · tab tally (url) total 7, personalization 5

#### 129. snowehome.com product — **NOT-OURS** — fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence)

`https://www.snowehome.com/products/bath-mat?variant=40168650324`

- r1 **OFF** — http 200 · declared 25.20 USD (microdata) · rendered 35.00 ("Quantity 1 $35 // $25.20") · cart ✗ no evidence · search 32 links
- r1 **ON** — http 200 · declared 25.20 USD (microdata) · rendered 35.00 ("Quantity 1 $35 // $25.20") · cart ✗ no evidence · search 32 links · personalization matches 12 [6400 tag.bounceexchange.com, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 16, personalization 7
- r2 **OFF** — http 200 · declared 25.20 USD (microdata) · rendered 35.00 ("Quantity 1 $35 // $25.20") · cart ✗ no evidence · search 32 links
- r2 **ON** — http 200 · declared 25.20 USD (microdata) · rendered 35.00 ("Quantity 1 $35 // $25.20") · cart ✗ no evidence · search 32 links · personalization matches 14 [6400 tag.bounceexchange.com, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 16, personalization 7
- r3 **OFF** — http 200 · declared 25.20 USD (microdata) · rendered 35.00 ("Quantity 1 $35 // $25.20") · cart ✗ no evidence · search 32 links
- r3 **ON** — http 200 · declared 25.20 USD (microdata) · rendered 35.00 ("Quantity 1 $35 // $25.20") · cart ✗ no evidence · search 32 links · personalization matches 14 [6400 tag.bounceexchange.com, 6950 static-tracking.klaviyo.com, 6952 a.klaviyo.com] · tab tally (url) total 15, personalization 7

#### 133. thursdayboots.com product — **PASS**

`https://thursdayboots.com/products/womens-arden-riding-boot-brown?variant=67705584549978`

- r1 **OFF** — http 200 · declared 235.00 USD (json-ld) · rendered 235.00 ("$235 or 4 payments of $58.75 by or") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://thursdayboots.com/cart/add.js total 235.00 · search 33 links
- r1 **ON** — http 200 · declared 235.00 USD (json-ld) · rendered 235.00 ("$235 or 4 payments of $58.75 by or") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://thursdayboots.com/cart/add.js total 235.00 · search 33 links · personalization matches 3 [6950 static-tracking.klaviyo.com] · tab tally (url) total 22, personalization 3
- r2 **OFF** — http 200 · declared 235.00 USD (json-ld) · rendered 235.00 ("$235 or 4 payments of $58.75 by or") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://thursdayboots.com/cart/add.js total 235.00 · search 33 links
- r2 **ON** — http 200 · declared 235.00 USD (json-ld) · rendered 235.00 ("$235 or 4 payments of $58.75 by or") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://thursdayboots.com/cart/add.js total 235.00 · search 33 links · personalization matches 0 · tab tally (url) total 10, personalization 0
- r3 **OFF** — http 200 · declared 235.00 USD (json-ld) · rendered 235.00 ("$235 or 4 payments of $58.75 by or") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://thursdayboots.com/cart/add.js total 235.00 · search 33 links
- r3 **ON** — http 200 · declared 235.00 USD (json-ld) · rendered 235.00 ("$235 or 4 payments of $58.75 by or") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://thursdayboots.com/cart/add.js total 235.00 · search 33 links · personalization matches 0 · tab tally (url) total 10, personalization 0

#### 137. hp.com product — **PASS**

`https://www.hp.com/us-en/shop/pdp/-hp-omnibook-7-173-inch-laptop-next-gen-ai-pc-al2b7av-1`

- r1 **OFF** — http 200 · declared 849.99 USD (json-ld) · rendered 710.00 ("Save $710 instantly MSRP $1,559.99 $849.99 45% OFF") · cart ✓ same-site cart request 200 POST https://www.hp.com/us-en/shop/HPCTORestAddToCartCmd
- r1 **ON** — http 200 · declared 849.99 USD (json-ld) · rendered 710.00 ("Save $710 instantly MSRP $1,559.99 $849.99 45% OFF") · cart ✓ same-site cart request 200 POST https://www.hp.com/us-en/shop/HPCTORestAddToCartCmd · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 849.99 USD (json-ld) · rendered 710.00 ("Save $710 instantly MSRP $1,559.99 $849.99 45% OFF") · cart ✓ same-site cart request 200 POST https://www.hp.com/us-en/shop/HPCTORestAddToCartCmd
- r2 **ON** — http 200 · declared 849.99 USD (json-ld) · rendered 710.00 ("Save $710 instantly MSRP $1,559.99 $849.99 45% OFF") · cart ✓ same-site cart request 200 POST https://www.hp.com/us-en/shop/HPCTORestAddToCartCmd · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 849.99 USD (json-ld) · rendered 710.00 ("Save $710 instantly MSRP $1,559.99 $849.99 45% OFF") · cart ✗ no evidence
- r3 **ON** — http 200 · declared 849.99 USD (json-ld) · rendered 710.00 ("Save $710 instantly MSRP $1,559.99 $849.99 45% OFF") · cart ✓ same-site cart request 200 POST https://www.hp.com/us-en/shop/HPCTORestAddToCartCmd · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 141. article.com product — **PASS**

`https://www.article.com/product/30333/timber-90-leather-sofa-charme-tan?queryID=97ec0a3f9251a92477a85fb2a6b905fd&index=production_product`

- r1 **OFF** — http 200 · declared 1799.00 USD (json-ld) · rendered 1799.00 ("Timber 90" Leather Sofa - Charme Tan $1799") · cart ✓ same-site cart request 200 POST https://www.article.com/graphql; cart badge 0→1
- r1 **ON** — http 200 · declared 1799.00 USD (json-ld) · rendered 1799.00 ("Timber 90" Leather Sofa - Charme Tan $1799") · cart ✓ same-site cart request 200 POST https://www.article.com/graphql; cart badge 0→1 · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 1799.00 USD (json-ld) · rendered 1799.00 ("Timber 90" Leather Sofa - Charme Tan $1799") · cart ✓ same-site cart request 200 POST https://www.article.com/graphql; cart badge 1→2
- r2 **ON** — http 200 · declared 1799.00 USD (json-ld) · rendered 1799.00 ("Timber 90" Leather Sofa - Charme Tan $1799") · cart ✓ same-site cart request 200 POST https://www.article.com/graphql · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 1799.00 USD (json-ld) · rendered 1799.00 ("Timber 90" Leather Sofa - Charme Tan $1799") · cart ✓ same-site cart request 200 POST https://www.article.com/graphql
- r3 **ON** — http 200 · declared 1799.00 USD (json-ld) · rendered 1799.00 ("Timber 90" Leather Sofa - Charme Tan $1799") · cart ✓ same-site cart request 200 POST https://www.article.com/graphql; cart badge 2→3 · personalization matches 1 [6700 insights.algolia.io] · tab tally (url) total 1, personalization 0

#### 145. ruggable.com product — **PASS**

`https://ruggable.com/products/spot-cleaner`

- r1 **OFF** — http 200 · declared 19.00 USD (json-ld) · rendered 19.00 ("$19.00 \| Rated 4.8 out of 5 stars, 653 Reviews (65") · cart ✓ cart badge 0→1
- r1 **ON** — http 200 · declared 19.00 USD (json-ld) · rendered 19.00 ("$19.00 \| Rated 4.8 out of 5 stars, 653 Reviews (65") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 25, personalization 0
- r2 **OFF** — http 200 · declared 19.00 USD (json-ld) · rendered 19.00 ("$19.00") · cart ✓ cart badge 1→2
- r2 **ON** — http 200 · declared 19.00 USD (json-ld) · rendered 19.00 ("$19.00") · cart ✓ cart badge 1→2 · personalization matches 0 · tab tally (url) total 26, personalization 0
- r3 **OFF** — http 200 · declared 19.00 USD (json-ld) · rendered 38.00 ("$38.00") · cart ✓ cart badge 2→3
- r3 **ON** — http 200 · declared 19.00 USD (json-ld) · rendered 38.00 ("$38.00") · cart ✓ cart badge 2→3 · personalization matches 0 · tab tally (url) total 26, personalization 0

#### 149. wildone.com product — **PASS**

`https://wildone.com/products/cat-harness-leash-collar-kit`

- r1 **OFF** — http 200 · declared 45.00 USD (json-ld) · rendered 50.00 ("Regular price $50 Sale price $45.00 Save $5.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://wildone.com/cart/add.js total 45.00 · search 47 links
- r1 **ON** — http 200 · declared 45.00 USD (json-ld) · rendered 50.00 ("Regular price $50 Sale price $45.00 Save $5.00") · cart ✓ Shopify /cart.js item_count 0→1; same-site cart request 200 POST https://wildone.com/cart/add.js; cart badge 0→1 total 45.00 · search 47 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6900 api.intelligems.io] · tab tally (url) total 14, personalization 6
- r2 **OFF** — http 200 · declared 45.00 USD (json-ld) · rendered 50.00 ("Regular price $50 Sale price $45.00 Save $5.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://wildone.com/cart/add.js total 45.00 · search 47 links
- r2 **ON** — http 200 · declared 45.00 USD (json-ld) · rendered 50.00 ("Regular price $50 Sale price $45.00 Save $5.00") · cart ✓ Shopify /cart.js item_count 1→2; same-site cart request 200 POST https://wildone.com/cart/add.js; cart badge 1→2 total 45.00 · search 47 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6900 api.intelligems.io] · tab tally (url) total 14, personalization 6
- r3 **OFF** — http 200 · declared 45.00 USD (json-ld) · rendered 50.00 ("Regular price $50 Sale price $45.00 Save $5.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://wildone.com/cart/add.js total 45.00 · search 47 links
- r3 **ON** — http 200 · declared 45.00 USD (json-ld) · rendered 50.00 ("Regular price $50 Sale price $45.00 Save $5.00") · cart ✓ Shopify /cart.js item_count 2→3; same-site cart request 200 POST https://wildone.com/cart/add.js; cart badge 2→3 total 45.00 · search 47 links · personalization matches 12 [6950 static-tracking.klaviyo.com, 6715 rebuyengine.com, 6900 api.intelligems.io] · tab tally (url) total 14, personalization 6

#### 153. famousfootwear.com product — **BLOCKED** — HTTP 403 — Challenge — Performing security verification

This website uses a security service to protect against malicious bots. This page is displayed while the website verifies you are not a bot.

Your IP: 66.218.52.176

Cloudflare Ray ID: a4c0e3b21eaa27d8

`https://www.famousfootwear.com/product/hunter-boot-womens-theezy-lined-waterproof-rain-boot-1060448/black-96796`

- r1 **OFF** — http 403 · BLOCKED: HTTP 403 — Challenge — Performing security verification

This website uses a security service to protect against malicio
- r1 **ON** — http 200 · declared 89.99/99.99 USD (json-ld-set(2)) · cart ✗ no visible, enabled add-to-cart control · search 0 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r2 **OFF** — http 403 · BLOCKED: HTTP 403 — Challenge — Performing security verification

This website uses a security service to protect against malicio
- r2 **ON** — http 200 · declared 89.99/99.99 USD (json-ld-set(2)) · cart ✗ no visible, enabled add-to-cart control · search 0 links · personalization matches 0 · tab tally (url) total 4, personalization 0
- r3 **OFF** — http 403 · BLOCKED: HTTP 403 — Challenge — Performing security verification

This website uses a security service to protect against malicio
- r3 **ON** — http 200 · declared 89.99/99.99 USD (json-ld-set(2)) · cart ✗ no visible, enabled add-to-cart control · search 0 links · personalization matches 0 · tab tally (url) total 4, personalization 0

#### 157. academy.com product — **PASS** — minority differences: r1: add-to-cart worked OFF, not ON

`https://www.academy.com/p/big-game-treestands-guardian-xlt-2-man-ladder-stand`

- r1 **OFF** — http 200 · declared 149.99 USD (json-ld) · rendered 149.99 ("Now priced $149.99 $149.99 Regularly priced $199.9") · cart ✓ same-site cart request 200 POST https://www.academy.com/api/cartitem/sku · search WALLED
- r1 **ON** — http 200 · declared 149.99 USD (json-ld) · rendered 149.99 ("Now priced $149.99 $149.99 Regularly priced $199.9") · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 1, personalization 0
- r2 **OFF** — http 200 · declared 149.99 USD (json-ld) · rendered 149.99 ("Now priced $149.99 $149.99 Regularly priced $199.9") · cart ✗ no evidence · search WALLED
- r2 **ON** — http 200 · declared 149.99 USD (json-ld) · rendered 149.99 ("Now priced $149.99 $149.99 Regularly priced $199.9") · cart ✓ same-site cart request 200 POST https://www.academy.com/api/cartitem/sku · search WALLED · personalization matches 0 · tab tally (url) total 1, personalization 0
- r3 **OFF** — http 200 · declared 149.99 USD (json-ld) · rendered 149.99 ("Now priced $149.99 $149.99 Regularly priced $199.9") · cart ✗ no evidence · search WALLED
- r3 **ON** — http 200 · declared 149.99 USD (json-ld) · rendered 149.99 ("Now priced $149.99 $149.99 Regularly priced $199.9") · cart ✗ no evidence · search WALLED · personalization matches 0 · tab tally (url) total 1, personalization 0

#### 161. scheels.com product — **PASS**

`https://www.scheels.com/p/84728009310?queryID=2bd350948ba24466`

- r1 **OFF** — http 200 · declared 29.99 USD (json-ld) · cart ✗ no evidence · search 22 links
- r1 **ON** — http 200 · declared 29.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://apihub.scheels.com/frontastic/action/cart/getCart · search 22 links · personalization matches 0 · tab tally (url) total 7, personalization 0
- r2 **OFF** — http 200 · declared 29.99 USD (json-ld) · cart ✗ no evidence · search 22 links
- r2 **ON** — http 200 · declared 29.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://apihub.scheels.com/frontastic/action/cart/getCart · search 23 links · personalization matches 0 · tab tally (url) total 5, personalization 0
- r3 **OFF** — http 200 · declared 29.99 USD (json-ld) · cart ✗ no evidence · search 23 links
- r3 **ON** — http 200 · declared 29.99 USD (json-ld) · cart ✓ same-site cart request 200 POST https://apihub.scheels.com/frontastic/action/cart/getCart · search 22 links · personalization matches 0 · tab tally (url) total 6, personalization 0

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 29 | gymshark.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 33 | gap.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 37 | allbirds.com product | PASS | FAIL | **PASS** |  |
| 41 | bathandbodyworks.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 45 | puravidabracelets.com product (Klaviyo, Intelligems) | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 49 | walmart.com product | FAIL | FAIL | **FAIL** | ON read a price OFF never read: 149.99, 149.99 — r1: DECLARED PRICE DIFFERS: OFF 169.99 vs ON 149.99 \| r1: RENDERED PRICE DIFFERS: OFF 169.99 vs ON 149.99 |
| 53 | zappos.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 57 | awaytravel.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 61 | kohls.com search | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — Access Denied — Access Denied
You don't have permission to access "http://www.kohls.com/search.jsp?" on this server.

Reference #18.180ed217.17922560 |
| 65 | asos.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 69 | cutsclothing.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 73 | nordstrom.com product | PASS | PASS | **PASS** |  |
| 77 | quince.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 81 | untuckit.com product | PASS | FAIL | **FAIL** | ON read a price OFF never read: 199.00 — r3: RENDERED PRICE DIFFERS: OFF 99.50 vs ON 199.00 |
| 85 | glossier.com product | PASS | PASS | **PASS** |  |
| 89 | olaplex.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 93 | analuisa.com product | FAIL | PASS | **PASS** | minority differences: r1: add-to-cart worked OFF, not ON |
| 97 | bollandbranch.com product | PASS | PASS | **PASS** |  |
| 101 | carawayhome.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 105 | eatfishwife.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 109 | huel.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 113 | kotn.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 117 | mvmt.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 121 | fromourplace.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 125 | rhoback.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no visible, enabled add-to-cart control) |
| 129 | snowehome.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: add-to-cart not confirmed (no cart evidence) |
| 133 | thursdayboots.com product | PASS | PASS | **PASS** |  |
| 137 | hp.com product | PASS | PASS | **PASS** |  |
| 141 | article.com product | PASS | PASS | **PASS** |  |
| 145 | ruggable.com product | PASS | PASS | **PASS** |  |
| 149 | wildone.com product | PASS | PASS | **PASS** |  |
| 153 | famousfootwear.com product | FAIL | BLOCKED | **BLOCKED** | HTTP 403 — Challenge — Performing security verification

This website uses a security service to protect against malicious bots. This page is displayed while th |
| 157 | academy.com product | FAIL | PASS | **PASS** | minority differences: r1: add-to-cart worked OFF, not ON |
| 161 | scheels.com product | PASS | FAIL | **PASS** |  |

**Totals:** 18 NOT-OURS, 12 PASS, 2 FAIL, 2 BLOCKED

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

- puravidabracelets.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- puravidabracelets.com product (Klaviyo, Intelligems) (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- walmart.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- untuckit.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- mvmt.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- snowehome.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- academy.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- scheels.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
- scheels.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
