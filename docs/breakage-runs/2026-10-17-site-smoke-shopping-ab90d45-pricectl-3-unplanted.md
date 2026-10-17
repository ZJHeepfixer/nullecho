# Nullecho pre-release site smoke — SHOPPING LAB (3 rounds) — 2026-10-17

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.3-chrome.zip`, sha256 `d460457505e2cdd0f3639d9cb42cc08a3537fce4ce4784bfe0ea8a53bb1e5037`, 264.6 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Code tested:** `ab90d45` (ext/ and harness/ clean)
- **Runtime:** 23s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side
- **OFF browser really OFF:** ⚠ NO: null
- **Fixture origin (the third-party embedding site):** `http://127.0.0.1:52388` serving `harness/fixtures/third-party-embeds.html`

## Shopping lab — the breakage lab for `rules/personalization.json`

1 pages × 3 round(s). Each round loads each page in an OFF browser (no extension) and an ON browser (the store zip) **at the same moment**, then: the declared price (ext/src/pricing.js: JSON-LD → microdata → meta, zeros skipped, several offers compared as a set — research/device-pricing METHOD §1.4) and the rendered price under the row's selector; add-to-cart (click, then Shopify's /cart.js count, a same-site cart request answered 2xx, an "added" message, or a cart badge going up — nothing bought, no account, no form); the row's search page; every uncaught exception and console error; and, ON only, each personalization-rule match (`onRuleMatchedDebug`) and the D55 per-tab tally.

- OFF browser really OFF: yes; ON worker: chrome-extension://nmokldbideoneoifakanbehkkehnijcj/src/background.js; personalization match recorder: `installed`

| # | Page | Vendors (map / exploration) | Verdict | Declared OFF → ON | Rendered OFF → ON | Cart total OFF → ON | Add-to-cart OFF / ON | Search links OFF / ON | Personalization rules matched ON (id×n) | Per-tab count, personalization (ON) | New ON page errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 63 | price positive control (fixture, client-side price test) | fixture price-test script | **PASS** | 15.00 = 15.00 | 15.00 = 15.00 | — = — | ✓✓✓ / ✓✓✓ | ·/·/· / ·/·/· | — | 0, 0, 0 | 0 |

✓ confirmed · ✗ not confirmed · · not attempted (one character per pair). W = the search page was walled. "—" = none read.

**Shopping totals:** 1 PASS

### Every price difference in every pair — including noise

_None: in every pair where both sides loaded, ON read the same declared, rendered and cart price as OFF._

### Every functional difference (cart, search, rendered vendor content, Klaviyo form)

_None._

### Errors seen ON and never OFF

Uncaught exceptions and console errors the page logged with the extension on and in no OFF load of the same page. `net::ERR_BLOCKED_BY_CLIENT` lines are the blocks themselves and are counted, not listed.

_None._

### Every pair

#### 63. price positive control (fixture, client-side price test) — **PASS**

`null`

- r1 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r1 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r2 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r2 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0
- r3 **OFF** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1
- r3 **ON** — http 200 · declared 15.00 USD (json-ld) · rendered 15.00 ("$15.00") · cart ✓ cart badge 0→1 · personalization matches 0 · tab tally (url) total 0, personalization 0

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 63 | price positive control (fixture, client-side price test) | PASS | PASS | **PASS** |  |

**Totals:** 1 PASS

## Per-site detail

## Every Nullecho console line seen this run (verbatim)

_None captured this run._
