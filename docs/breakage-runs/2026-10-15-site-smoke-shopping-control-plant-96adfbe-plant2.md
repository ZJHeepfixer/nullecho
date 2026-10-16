# Nullecho pre-release site smoke — SHOPPING LAB (1 rounds) — ⚠ NEGATIVE CONTROL — 2026-10-15

> **⚠ CONTROL RUN — NOT THE STORE PACKAGE.** The unpacked store zip's `rules/personalization.json` was rewritten in the temp dir with a planted block rule (id 6999) on `algolia.net, algolianet.com, ac.cnstrc.com, redsky.target.com` (sha256 packaged `5b145e54e1b30724…` → control `7dbe3f41e3e2b604…`). Its FAILs, or its lower counts, are the point.

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `b7fd34e48dcfda05ffa0b8e01bc92c76b011d250c77753c636b35d6f135ab187`, 263.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `96adfbe` (ext/ and harness/ clean)
- **Runtime:** 227s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side
- **OFF browser really OFF:** ⚠ NO: null

## Shopping lab — the breakage lab for `rules/personalization.json`

3 pages × 1 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://bmhbpbfhmlfgcojlbngdocpanofoeoaj/src/background.js; personalization match recorder: `installed`

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 29 | gymshark.com product | Dynamic Yield (consent-gated), mParticle | **FAIL** | 26.00 = 26.00 | 26.00 = 26.00 | — = — | ✗✓ / ✗✗ | 60/60 / 0/0 | 6999×44 | 4, 8 | 1 |
| 38 | target.com product | Attentive | **NOT-OURS** | — = — | — = — | — = — | ✗ / ✗ | 0 / 0 | 6999×7 | 4 | 1 |
| 40 | jcpenney.com product | Attentive, Constructor | **FAIL** | 29.59 = 29.59 | — = — | — = — | ✗✗ / ✗✗ | 60/72 / 0/0 | 6999×12 | 2, 2 | 2 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 2 FAIL, 1 NOT-OURS

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

- 29. gymshark.com product: r1: search: 60 product links OFF, 0 ON
- 29. gymshark.com product: r2: add-to-cart worked OFF, not ON
- 29. gymshark.com product: r2: search: 60 product links OFF, 0 ON
- 40. jcpenney.com product: r1: search: 60 product links OFF, 0 ON
- 40. jcpenney.com product: r2: search: 72 product links OFF, 0 ON

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

- **29. gymshark.com product** (1 blocked-resource line(s)):
  - `uncaught: Object`
- **38. target.com product** (1 blocked-resource line(s)):
  - `console: [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site,`
- **40. jcpenney.com product** (1 blocked-resource line(s)):
  - `console: Blocked script execution in 'about:blank' because the document's frame is sandboxed and the 'allow-scripts' permission is not set.`
  - `console: [object Object]`

### Every pair

#### 29. gymshark.com product — **FAIL** — r1: search: 60 product links OFF, 0 ON \| r2: add-to-cart worked OFF, not ON \| r2: search: 60 product links OFF, 0 ON

`https://www.gymshark.com/products/gymshark-arrival-5-shorts-black-ss22`

- r1 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 60 links
- r1 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 0 links · personalization matches 20 [6999 2deaes0cuo-dsn.algolia.net, 6999 2deaes0cuo-3.algolianet.com, 6999 2deaes0cuo-2.algolianet.com, 6999 2deaes0cuo-1.algolianet.com] · tab tally (url) total 6, personalization 4
- r2 **OFF** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✓ cart badge 0→1 (picked XS) · search 60 links
- r2 **ON** — http 200 · declared 26.00 USD (json-ld) · rendered 26.00 ("$26") · cart ✗ no evidence (picked XS) · search 0 links · personalization matches 24 [6999 2deaes0cuo-dsn.algolia.net, 6999 2deaes0cuo-3.algolianet.com, 6999 2deaes0cuo-2.algolianet.com, 6999 2deaes0cuo-1.algolianet.com] · tab tally (url) total 10, personalization 8

#### 38. target.com product — **NOT-OURS** — fails with the extension OFF too — off: no declared or rendered price read; add-to-cart not confirmed (no cart evidence); search listed 0 product links

`https://www.target.com/p/delilah-home-100-organic-cotton-bath-towel-collection/-/A-93159262?preselect=93048164`

- r1 **OFF** — http 200 · cart ✗ no evidence · search 0 links
- r1 **ON** — http 200 · cart ✗ no evidence · search 0 links · personalization matches 7 [6999 redsky.target.com] · tab tally (url) total 6, personalization 4

#### 40. jcpenney.com product — **FAIL** — r1: search: 60 product links OFF, 0 ON \| r2: search: 72 product links OFF, 0 ON

`https://www.jcpenney.com/p/worthington-womens-modern-perfect-trouser/ppr5008151662`

- r1 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 60 links
- r1 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 0 links · personalization matches 6 [6999 ac.cnstrc.com] · tab tally (url) total 5, personalization 2
- r2 **OFF** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 72 links
- r2 **ON** — http 200 · declared 29.59 USD (json-ld) · cart ✗ no evidence · search 0 links · personalization matches 6 [6999 ac.cnstrc.com] · tab tally (url) total 4, personalization 2

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 29 | gymshark.com product | FAIL | FAIL | **FAIL** | r1: search: 60 product links OFF, 0 ON \| r2: add-to-cart worked OFF, not ON \| r2: search: 60 product links OFF, 0 ON |
| 38 | target.com product | FAIL | FAIL | **NOT-OURS** | fails with the extension OFF too — off: no declared or rendered price read; add-to-cart not confirmed (no cart evidence); search listed 0 product links |
| 40 | jcpenney.com product | FAIL | FAIL | **FAIL** | r1: search: 60 product links OFF, 0 ON \| r2: search: 72 product links OFF, 0 ON |

**Totals:** 2 FAIL, 1 NOT-OURS

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
- target.com product (ON): [Nullecho] Could not reach the extension service worker (%s). This page is running on the FALLBACK persona: still consistent, still different per site, but not rotated by your session identity. unsupported scheme
- jcpenney.com product (ON): [Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.
