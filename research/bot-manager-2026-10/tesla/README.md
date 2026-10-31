# tesla.com under Akamai Bot Manager: what in Nullecho's Chrome build trips it (2026-10-17)

**Owner's report (2026-10-17):** "nullecho will not allow me to go to https://www.tesla.com/" — Chrome on macOS,
Web Store build; with the extension off the site loads; Safari is fine. Flipping the popup's per-site switch to
Off on tesla.com (the existing `allowlist`, on which the shim stands down) fixed it for him the same day.

**Finding.** Akamai Bot Manager denies the page because of the persona shim (`shim-loader.js` + `shim.js`).
Nothing else the Chrome build does matters to it: the client-hint header removals, the `Sec-GPC` header on
navigations, the `gpc.js` signal and the block rules were each switched off in turn and the denial stayed;
switching off only the shim let the page through. Zero requests were blocked by Nullecho's rules in any run.

## Method

- **Browser:** Chrome for Testing 149 (puppeteer's), **headful**, launched with
  `--disable-blink-features=AutomationControlled` and without `--enable-automation`
  (`ignoreDefaultArgs: ['--enable-automation', '--disable-extensions']`), fresh profile per run. This matters:
  launched the usual way (headless or headful with the automation flags) Akamai answers 403 to the plain browser
  too (`navigator.webdriver` true), so control and extension runs cannot be told apart. Earlier that same day four
  such runs all read "Access Denied"; they are not in this folder.
- **Extension:** `ext/` at main `58ac41d` (0.9.2), loaded unpacked, and five scratch COPIES of it that each
  differ in exactly one respect (`rig/make-variants.mjs`). `ext/` itself was never edited.
- **Runner:** `rig/run-tesla.mjs`: one navigation to `https://www.tesla.com/`, `networkidle2` + 5 s, CDP
  network events for every document response (status, `Server`, `Set-Cookie` names when the extra-info event
  arrived), the first navigation's request headers, loading failures, the cookie jar after load, the page title
  and text, a screenshot. A no-extension control ran first and again last, so a denial cannot be blamed on the
  IP being poisoned by the earlier denials.
- **Verdict:** page title "Access Denied" = DENIED; the Tesla home page = OK.

## Results (`logs/*.json`, `screenshots/chrome-*.png`)

| run | extension | verdict | document responses | blocked by DNR | `navigator.globalPrivacyControl` | `Sec-GPC` on the navigation |
|---|---|---|---|---|---|---|
| `control-first` | none | **OK** | 200 → 200 | 0 | null | no |
| `full-ext` | ext | **DENIED** | 200 → 403 AkamaiGHost | 0 | true | yes |
| `no-ua` | no-ua | **DENIED** | 200 → 403 AkamaiGHost | 0 | true | yes |
| `no-gpc-nav` | no-gpc-nav | **DENIED** | 200 → 403 AkamaiGHost | 0 | true | no |
| `no-gpc-js` | no-gpc-js | **DENIED** | 200 → 403 AkamaiGHost | 0 | true | yes |
| `no-gpc-all` | no-gpc-all | **DENIED** | 200 → 403 AkamaiGHost | 0 | true | no |
| `no-shim` | no-shim | **OK** | 200 → 200 | 0 | true | yes |
| `control-last` | none | **OK** | 200 → 200 | 0 | null | no |

Shape of a denial: the first document response is **200** (Akamai's sensor-bearing page; its `Set-Cookie` names
when captured: `_abck`, `bm_sz`, `bm_s`, `bm_sc`, `bm_so`), the bounce request that follows is answered
**403 `Server: AkamaiGHost`** with the "Access Denied … Reference #18.…" page. In an OK run the bounce is 200.
The cookie jar after every run holds the Bot Manager set `_abck, bm_sz, bm_s, bm_sc, bm_so, bm_lso`, extension
or not: the cookies are set either way, the verdict differs. The same eight runs were done once before this
recorded set with identical verdicts (console only).

Two incidental observations: the `Sec-GPC` header is on the navigation request itself in Chrome (rule 5000's
`resourceTypes` includes `main_frame`), and with `gpc.js` removed `navigator.globalPrivacyControl` still reads
`true` while the shim is present (`no-gpc-js`, `no-gpc-all`), so the shim exposes the property as well.

## Safari, for contrast (`screenshots/safari-*.png`)

Real Safari on the iOS 27.0 Simulator with the Safari build from main (no shim, 186 block rules): tesla.com loads
with the extension off, on with website access at Ask (blocking only), and on with All Websites = Allow
(blocking + `Sec-GPC` on image/script + the JS signal). The owner confirmed Safari fine on his Mac.

## What this does not say

- Which patched surface Akamai's sensor keys on (native-function tampering, canvas/audio noise, hardware values,
  the GPC property, …): the shim was removed whole. A finer bisect would patch one surface at a time.
- Whether the Web Store build the owner has (0.9.1 or 0.9.2) differs from main's `ext/` here in a way that
  matters; the shim is in both.
- Anything about other Bot Manager customers; tesla.com is the one site measured. Akamai fronts many retail,
  airline and bank sites, so this is a class.

## Reproduce

```
node research/bot-manager-2026-10/tesla/rig/make-variants.mjs ext /tmp/variants
NULLECHO_PUPPETEER_DIR=<dir whose node_modules holds puppeteer> \
  node research/bot-manager-2026-10/tesla/rig/run-tesla.mjs /tmp/out \
  control-first=none full-ext=ext no-shim=/tmp/variants/no-shim control-last=none
rm -rf ext/_metadata   # Chrome writes it into the unpacked dir
```
