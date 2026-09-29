# Nullecho pre-release site smoke — 2026-09-28

Tests **the packaged Chrome build**, not the source tree: `ext/tools/package.mjs` → `nullecho-0.9.0-chrome.zip`, sha256 `11bb2ee1e88b253093cc4ea51377af8ec994b08a9ad8ffbc663395b072e461ec`, 247.0 KB.

- **Chrome:** Chrome/149.0.7827.22
- **Puppeteer:** 25.1.0
- **Node:** v22.22.3
- **UA used (both passes):** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.22 Safari/537.36`
- **Runtime:** 277s
- **`ext/_metadata/` present:** NO (verified)
- **Mode:** OFF pass then ON pass, side by side

## Self-test — attacking our own checks before trusting a PASS

| Check | Deliberately broken how | Expected | Actual | Result |
|---|---|---|---|---|
| youtube playback | navigated but never pressed play | check should report FAIL | FAILED (correct) | ✅ |
| maps zoom | ran the same wheel-zoom check on example.com (no map) | check should report FAIL | FAILED (correct) | ✅ |

Detail: youtube {"from":0,"currentTime":0,"readyState":0,"buffered":0,"paused":false,"skipPlay":false}; maps {"ok":false,"error":"timeout after 15000ms: maps self-test"}

## Results

| # | Site | ON | OFF | Verdict | Notes |
|---|---|---|---|---|---|
| 1 | example.com | PASS | PASS | **PASS** |  |
| 2 | open.spotify.com | PASS | PASS | **PASS** |  |
| 3 | google.com/recaptcha/api2/demo | PASS | PASS | **PASS** |  |
| 4 | accounts.hcaptcha.com/demo | PASS | PASS | **PASS** |  |
| 5 | demo.turnstile.workers.dev | PASS | PASS | **PASS** |  |
| 6 | amazon.com (search "usb c cable") | PASS | PASS | **PASS** |  |
| 7 | google.com/maps | PASS | PASS | **PASS** |  |
| 8 | openstreetmap.org | PASS | PASS | **PASS** |  |
| 9 | youtube.com/watch?v=jNQXAC9IVRw | PASS | PASS | **PASS** |  |
| 10 | chartjs.org vertical bar sample | PASS | PASS | **PASS** |  |
| 11 | nytimes.com | BLOCKED | BLOCKED | **BLOCKED** | HTTP 403 — nytimes.com — |
| 12 | squoosh.app | PASS | PASS | **PASS** |  |
| 13 | irs.gov site search "form 1040" | PASS | PASS | **PASS** |  |
| 14 | reddit.com/r/technology | PASS | PASS | **PASS** |  |

**Totals:** 13 PASS, 1 BLOCKED

## Per-site detail

### 1. example.com — **PASS**

- URL: `https://example.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"title":"Example Domain"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"title":"Example Domain"}`

### 2. open.spotify.com — **PASS**

- URL: `https://open.spotify.com/`
- **ON** — http 200, visibility `visible`, probes: `gpc=undefined cores=8 mem=8`, detail: `{"bodyLen":462}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"bodyLen":2370}`

### 3. google.com/recaptcha/api2/demo — **PASS**

- URL: `https://www.google.com/recaptcha/api2/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"box":{"w":304,"h":78}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":304,"h":78}}`

### 4. accounts.hcaptcha.com/demo — **PASS**

- URL: `https://accounts.hcaptcha.com/demo`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"box":{"w":302,"h":76}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":302,"h":76}}`

### 5. demo.turnstile.workers.dev — **PASS**

- URL: `https://demo.turnstile.workers.dev/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"box":{"w":300,"h":71,"via":"widget-children"}}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"box":{"w":300,"h":71,"via":"widget-children"}}`

### 6. amazon.com (search "usb c cable") — **PASS**

- URL: `https://www.amazon.com/s?k=usb+c+cable`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"resultCount":22}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"resultCount":16}`

### 7. google.com/maps — **PASS**

- URL: `https://www.google.com/maps/@35.6225,-117.6709,12z`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"zoomBefore":12,"zoomAfter":14.42,"canvases":3}`

### 8. openstreetmap.org — **PASS**

- URL: `https://www.openstreetmap.org/#map=12/35.6225/-117.6709`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"total":24,"loaded":24}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"total":24,"loaded":24}`

### 9. youtube.com/watch?v=jNQXAC9IVRw — **PASS**

- URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"from":4.476209,"currentTime":13.478923,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"from":1.545167,"currentTime":10.547982,"readyState":4,"buffered":19,"paused":false,"skipPlay":false}`

### 10. chartjs.org vertical bar sample — **PASS**

- URL: `https://www.chartjs.org/docs/latest/samples/bar/vertical.html`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=8`, detail: `{"w":800,"h":400,"nonTransparentPixels":44089}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"w":800,"h":400,"nonTransparentPixels":52490}`

### 11. nytimes.com — **BLOCKED**

HTTP 403 — nytimes.com —

- URL: `https://www.nytimes.com/`
- **ON** — http 403, visibility `null`, probes: `gpc=true cores=8 mem=8`, detail: `{}`
- **OFF** — http 403, visibility `null`, probes: `gpc=undefined cores=12 mem=32`, detail: `{}`

### 12. squoosh.app — **PASS**

- URL: `https://squoosh.app/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"textSample":"Drop OR Paste\n\nOr try one of these:\n\n2.8MB\n2.9MB\n1.6MB\n13KB\nSmall\n\nSmaller images mean faster load times. Squoosh can re"}`

### 13. irs.gov site search "form 1040" — **PASS**

- URL: `https://www.irs.gov/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=8 mem=16`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"url":"https://www.irs.gov/site-index-search?search=form+1040&field_pup_historical_1=1&field_pup_historical=1","resultCount":10,"has1040":true}`

### 14. reddit.com/r/technology — **PASS**

- URL: `https://www.reddit.com/r/technology/`
- **ON** — http 200, visibility `visible`, probes: `gpc=true cores=10 mem=32`, detail: `{"postCount":56}`
- **OFF** — http 200, visibility `visible`, probes: `gpc=undefined cores=12 mem=32`, detail: `{"postCount":56}`

## Every Nullecho console line seen this run (verbatim)

_None captured this run._
