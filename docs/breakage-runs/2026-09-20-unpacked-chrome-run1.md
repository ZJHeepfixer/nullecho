# Nullecho breakage-testing run — 2026-09-20

- **Chrome version:** 151.0.0.0 (from UA: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari`)
- **Extension:** Nullecho, loaded **unpacked** (`chrome-extension://deiobinibjcmbfpnbepohnjkcodgnkoh/`)
- **Pass type:** **ON-only.** The extension could not be toggled off (`chrome://extensions` not reachable from this driver). Any breakage below needs an OFF retest by the owner before it can be attributed to Nullecho with certainty.
- **Driven via:** claude-in-chrome MCP, in a dedicated tab, in the user's real everyday Chrome profile.
- **Logged-out assumption:** **did NOT hold for Amazon or Google** — see Findings, item 1.

## Results table

| # | Site | Tier | Result | What I did | Persona (gpc / cores / mem / renderer) | Console lines | Notes |
|---|------|------|--------|------------|------------------------------------------|----------------|-------|
| 1 | example.com | CONTROL | **PASS** | Loaded, probed | `true` / 8 / 16 / "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" | clean | Persona differs from real machine (12/64/M2 Max) on every field, as expected |
| 2 | open.spotify.com | C.15 GPC exception | **PASS** | Loaded home page logged out, probed | `undefined` (key absent from probe result = GPC not set) / 10 / 32 / "Apple M1 Pro" | clean | GPC correctly absent (shipped exception); persona still present and differs from real machine; page rendered a normal logged-out home feed (tracks/artists/albums) |
| 3 | google.com/recaptcha/api2/demo | reCAPTCHA v2 render | **PASS**, with a notable console finding | Confirmed widget iframe rendered (2 recaptcha iframes found), screenshotted, did NOT click | `true` / 8 / 16 / "Apple M2" | **`[Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.`** (WARNING) | Widget visually confirmed (screenshot). See Findings #2 |
| 4 | accounts.hcaptcha.com/demo | hCaptcha render | **PASS** | Confirmed widget iframe rendered (2 hcaptcha iframes), screenshotted, did NOT click | `true` / 8 / 8 / "Apple M1" | clean | Widget visually confirmed |
| 5 | demo.turnstile.workers.dev | Cloudflare Turnstile render | **PASS** | Page exists (did not 404), confirmed widget rendered ("For testing only" test widget visible), did NOT interact | `true` / 8 / 8 / "Apple M1" | clean | |
| 6 | amazon.com | A.6 (intended logged out) | **PASS**, with findings | Searched "usb c cable", opened first non-sponsored result (Amazon Basics USB-C cable), added to cart, confirmed via cart page + header count (16→17), then removed the item to restore the account | `true` / 8 / 8 / "Apple M2" | **Nullecho WARNING** (fallback persona, same text as #3, fresh timestamp) + **9× `TypeError: Failed to fetch`** from Amazon's own ad script (`m.media-amazon.com/.../d-bEFPyYKlCs9kU.js`, APE-SafeFrame) | See Findings #1 (not actually logged out) and #3 (fetch failures, #4 (silent add-to-cart clicks) |
| 7 | google.com/maps | B.8 WebGL | **FAIL** (interaction), tiles render | Waited for load, dismissed "Ask Maps" promo, tried scroll-zoom (×2 in, ×2 out), the +/- zoom buttons, double-click-to-zoom, and the Satellite-layer thumbnail switcher | `true` / 8 / 16 / "Apple M2" | **`[Nullecho] The page shim could NOT patch: offscreenCanvas.getImageData. That API is UNPROTECTED on this page. A silently-unpatched API is the worst outcome — please report this.`** (ERROR, ×2–4 depending on read timing) | See Findings #5 — base tiles render fine (roads/labels visible), no "can't load Google Maps" banner, but **every interaction method produced zero effect**: 7 consecutive internal `batchexecute` requests all carried the identical unchanged `@35.5753189,-117.6669505,14z` viewport |
| 8 | openstreetmap.org | Map control comparison | **PASS** | Waited for load, dismissed welcome dialog, scroll-zoom, and the "Zoom In" +button | `true` / 8 / 16 / "Apple M2" | clean (verified via clear+reload) | Zoom-In button worked correctly (visible re-render, labels enlarged) — used as a working control against the Maps failure above |
| 9 | youtube.com/watch?v=jNQXAC9IVRw | B.9 | **FAIL** (reproducible) | Loaded video page, checked `video.currentTime`/`readyState` at 0s, 5s, 13s; repeated on a full second navigation | `true` / 8 / 16 / "Apple M2" | **`[Nullecho] The page-world shim did not answer on this document. Fingerprinting APIs are NOT patched here. If you see this on a normal page, please report it — a silent miss is the failure mode this project most wants to avoid.`** (ERROR) | See Findings #6. `readyState` stuck at `0` (HAVE_NOTHING), `currentTime` stuck at `0`, on BOTH of two independent navigations, 13+ seconds each. Zero `videoplayback` network requests ever fired. YouTube's own client-side QoE beacon self-reported buffer health `0.000` at ~50s |
| 10 | reddit.com/r/technology/ | Reddit logged out | **SKIPPED** | Navigation was refused | — | — | `navigate` and standalone tool both returned: *"This site is not allowed due to safety restrictions."* — a policy block in the claude-in-chrome driver itself, unrelated to Nullecho. Could not test |
| 11 | chartjs.org (vertical bar sample) | Canvas | **PASS** | Loaded, confirmed canvas exists and `getContext('2d')` succeeds | `true` / 8 / 8 / "Apple M1" | clean (after reload — see note) | First load showed the same "page-world shim did not answer" ERROR as #9/#13 below, but an immediate reload of the identical URL was clean, AND the chart rendered correctly even on the first (errored) load — no functional impact observed. See Findings #6 |
| 12 | nytimes.com | B.14 paywall | **PASS** | Loaded home page, opened the top headline article | `true` / 8 / 8 / "Apple M1" | clean (only an unrelated `Statsig` multi-instance warning from Datadog RUM, doesn't match watch list) | Article gate showed **"This story is free to read. Log in to continue."** with an email field / Google sign-in — normal NYT behavior for a logged-out reader, NOT a bypassed paywall. Did not enter anything or attempt login |
| 13 | squoosh.app | WASM + workers | **PASS** | Loaded to home screen ("Drop OR Paste"), did not upload anything | `true` / 8 / 8 / "Apple M2" | clean (after reload — see note) | Same transient "page-world shim did not answer" ERROR on first load only, gone on reload, no functional impact (app UI fully rendered, "Ready to work offline" banner shown) |
| 14 | irs.gov | A.7 gov portal | **PASS** | Site search for "form 1040", confirmed results | `true` / 8 / 8 / "Apple M1" | clean (after reload) | Search results rendered correctly (About Form 1040, PDF, Instructions, Schedules) |

**Totals:** 12 PASS, 2 FAIL (Google Maps interaction, YouTube playback), 1 SKIPPED (Reddit, tool policy block), 0 INCONCLUSIVE.

## Findings

All of the following are ON-only observations. None have been confirmed against an extension-OFF baseline.

1. **Amazon and Google were NOT logged out, contrary to the run's stated precondition.** The Chrome profile driven here already had an active Amazon session ("Hello, Jason", 16 items already in a real cart, address "Ridgecrest 93555") and an active Google session (an avatar was visible on Google Maps). This is a fact about the test environment, not a Nullecho defect, but it means the Amazon test ran against a real account with a real pre-existing cart rather than a clean guest session. I cleaned up after myself (removed the added cable, cart returned to 16 items / $466.51 subtotal) but flagging this prominently since it changes what the test actually exercised.

2. **Verbatim Nullecho console warning — reCAPTCHA demo (and again, fresh, on Amazon's product page):**
   > `[Nullecho] This page read a fingerprinting API before the salted persona arrived, so it is seeing the un-rotated fallback persona. Cross-site linkage is still broken; "New identity" will not change what THIS page saw.`
   This is the extension's own self-reported race condition: a page's script read a fingerprint-relevant API before the persona salt was applied. It fired with independent, non-duplicate timestamps on two unrelated origins (google.com recaptcha page and amazon.com product page), so this is a real, repeatable pattern, not a one-off.

3. **9× `Uncaught (in promise) TypeError: Failed to fetch`** from Amazon's own ad-serving script (`https://m.media-amazon.com/images/S/sash/d-bEFPyYKlCs9kU.js?csm_attribution=APE-SafeFrame`), immediately after the successful add-to-cart action. I cannot confirm whether this is Nullecho blocking a fetch to some ad/tracking domain or an unrelated Amazon ad-network hiccup — flagging as ambiguous, worth an OFF-comparison.

4. **The first two attempts to click Amazon's "Add to Cart" button silently did nothing** (button ref from the `find` tool, clicked twice across a page reload): no confirmation UI, no cart-count change, and — critically — **zero matching network request** in the request log for either attempt. A third attempt using a raw pixel-coordinate click on the same visual button worked immediately (confirmation banner, cart count 16→17, add-to-cart network activity visible). This could be an artifact of my own driving tooling (stale accessibility-tree refs) rather than a page/extension defect — no Nullecho console activity coincided with either failed click — but noting it since it's a real observed discrepancy.

5. **Google Maps: base tiles render, but the map is completely non-interactive.** Scroll-wheel zoom (×2 in, ×2 out), the on-screen +/− buttons, double-click-to-zoom, and the Satellite-layer quick-switch thumbnail were all tried; none changed the visible map in any screenshot, and the internal `https://www.google.com/maps/_/MapsWizUi/data/batchexecute` calls captured over the whole sequence (7 of them, across `rpcids=PDqRpc/EvxQ3b/T4jwAf`) all carried the byte-identical `source-path=%2Fmaps%2F%4035.5753189%2C-117.6669505%2C14z` — meaning the viewport genuinely never changed server-side either, not just visually. On the same page load, Nullecho logged:
   > `[Nullecho] The page shim could NOT patch: offscreenCanvas.getImageData. That API is UNPROTECTED on this page. A silently-unpatched API is the worst outcome — please report this.`
   I want to be careful here: I cannot prove this error *caused* the interaction failure — I only have a strong correlation (same page, same load) plus a clean control (OpenStreetMap's own Zoom-In button worked correctly in the same session, on the same probe pattern, moments later). No "can't load Google Maps" banner or visible WebGL error appeared; the failure is silent from the user's perspective — you'd just think the +/− buttons and scroll wheel stopped working.

6. **YouTube: video playback never starts, reproducibly, across two independent page loads.** `video.readyState` stayed at `0` (HAVE_NOTHING) and `video.currentTime` stayed at `0` for 13+ seconds each time; zero `videoplayback` requests were ever issued; YouTube's own internal QoE beacon self-reported `bh=...:0.000` (buffer health zero) after ~50 seconds of elapsed page time. Both loads logged:
   > `[Nullecho] The page-world shim did not answer on this document. Fingerprinting APIs are NOT patched here. If you see this on a normal page, please report it — a silent miss is the failure mode this project most wants to avoid.`
   The **same exact error text** also appeared once each on Chart.js's and Squoosh's *first* load after a navigation, but on both of those an immediate reload of the identical URL was clean, and — importantly — **neither of those sites showed any functional impact** even on the errored first load (Chart.js's canvas still rendered correctly; Squoosh's UI still loaded fully). YouTube is different: the error recurred on both attempts (not just first-load), and it correlates with a total, reproducible functional failure. This is the strongest single finding in this run and the one most worth an OFF-retest.

## Persona consistency

Every protected origin showed non-real values on every field checked (real machine: 12 cores / 64 GB / Apple M2 Max). Per-origin persona was **stable across repeat visits** (e.g., `google.com` showed the identical `8 / 16 / Apple M2` tuple on both the reCAPTCHA page and, later, Google Maps).

Personas were **not fully unique per origin** — several distinct origins shared identical `(cores, mem, renderer)` tuples. Observed tuples:

| Origin | cores | mem (GB) | renderer |
|---|---|---|---|
| example.com | 8 | 16 | Apple M2 |
| google.com (recaptcha + maps) | 8 | 16 | Apple M2 |
| www.openstreetmap.org | 8 | 16 | Apple M2 |
| www.youtube.com | 8 | 16 | Apple M2 |
| open.spotify.com | 10 | 32 | Apple M1 Pro |
| www.amazon.com | 8 | 8 | Apple M2 |
| squoosh.app | 8 | 8 | Apple M2 |
| accounts.hcaptcha.com | 8 | 8 | Apple M1 |
| demo.turnstile.workers.dev | 8 | 8 | Apple M1 |
| www.chartjs.org | 8 | 8 | Apple M1 |
| www.nytimes.com | 8 | 8 | Apple M1 |
| www.irs.gov | 8 | 8 | Apple M1 |

Cores were 8 for every origin except Spotify (10). Only three distinct `(mem, renderer)` combinations appeared across the 12 tested origins (`16/M2`, `8/M2`, `8/M1`), plus Spotify's unique `32/M1 Pro`. This reads as a small, discrete persona pool being assigned per-origin rather than fully independent randomization per field — consistent with the project's stated "randomize by PERSONA not attribute" design (per prior project notes), so I'm reporting it as a factual observation rather than a defect. Whether the pool is large enough to resist cross-site correlation by an attacker profiling many origins is outside the scope of this pass.

## Owner-only, not run

Not tested (login-gated, out of scope for this pass): bank sites, Google SSO / Gmail, real checkout flows, Google Docs, Figma, and any other account-gated destination.

## Caveats

- **This is an ON-only pass.** The extension could not be disabled from this driver (`chrome://extensions` unreachable). Findings #2, #3, #5, and #6 above are correlations with Nullecho console activity, not proven causation — they need an OFF retest to confirm attribution before being treated as confirmed regressions.
- Reddit (site 10) could not be tested at all — blocked by the claude-in-chrome driver's own safety policy, unrelated to Nullecho.
- Amazon and Google sessions were unexpectedly already authenticated (see Finding #1); the Amazon cart test ran against a real account and was cleaned up afterward.

---

## Director verification (same night) — both FAILs are NOT ours

Method: `harness/site-bisect.mjs` (new), which loads temp copies of `ext/` into Chrome for Testing with one
subsystem removed per variant and runs one page check under each, extension-OFF control included. The
protocol's OFF pass, automated. Puppeteer from `/Users/jasonluker/bodybuilding`, CfT 149, fresh profile per run.

### YouTube (finding #6) — a hidden tab, not the extension

| variant | video after ~10 s | tab |
|---|---|---|
| off | plays, readyState 4, 19 s buffered | visible |
| full (as committed) | readyState 0, nothing buffered | **hidden** |
| no-block / no-ua / no-gpc / no-shim / no-content / no-rules / no-webrequest / no-feedback | readyState 0 | hidden |
| no-bg (worker removed) | plays | visible |
| bg-empty (worker file emptied) | plays | visible |
| **bg-no-options** (full extension, first-run options tab suppressed) | **plays, readyState 4, 19 s buffered, persona active (8 cores)** | visible |

Every failing variant had one thing in common: the extension's `onInstalled` handler opened the options page in
a new tab **in front of** the YouTube tab (a fresh profile is a first install every run). YouTube does not fetch
media for a hidden document. With that one tab suppressed the complete, unmodified extension plays the video.
In Jason's Chrome the same thing happened for a different reason: the agent's tab lived in the Claude tab-group
window, which reported `document.visibilityState === 'hidden'` (occluded/unfocused window) on every probe.
Verdict: **PASS for Nullecho; the measurement was wrong.** Real-Chrome confirmation with the tab in front is
owed and trivial (bring the window forward, the video starts).

### Google Maps (finding #5) — same artifact

Original run (test tab hidden behind the options tab): `off` PASS (zoom 12 → 14.42), every extension variant
"hung" (`Input.dispatchMouseEvent timed out`). A hidden tab gets no `requestAnimationFrame`, and Maps' zoom is an
rAF-driven animation that never completes, so the URL/viewport never changes and input dispatch times out.
Rerun with the harness closing extension pages and calling `page.bringToFront()` before measuring:

| variant | zoom | tab |
|---|---|---|
| off | 12 → 14.42 PASS | visible |
| **full** | **12 → 14.42 PASS** | visible |
| no-shim | 12 → 14.42 PASS | visible |

Verdict: **PASS for Nullecho.** OpenStreetMap "worked" in the same hidden tab only because Leaflet updates the
DOM synchronously on wheel input; it is not a valid control for an rAF-driven app.

### What IS real from this run (protection quality, not breakage — follow-ups)

1. **`offscreenCanvas.getImageData` "could NOT patch" on Google Maps** (visible and hidden alike, every load).
   `fail()` fires at *runtime* from inside the wrapper's `try`, not only at install; the wrapper returns the
   original pixels, so the page is unaffected but the API is unprotected on that page. Needs the thrown error
   captured (`state.failures[].error` carries the stack) and a fix.
2. **`shim did not answer` (D30 boot check)** on YouTube every load and on the *first* load of Chart.js /
   Squoosh / IRS. The persona was still present (cores 8), so the MAIN-world shim ran; it is the loader's
   handshake that timed out — consistent with a cold service worker (fresh install in the harness; an idle MV3
   worker in Jason's Chrome). Protection is the fallback persona, not none. Measure the worker wake-up time
   against `BOOT_CHECK_MS = 3000` and fix the race or the message.
3. **"read a fingerprinting API before the salted persona arrived"** on reCAPTCHA + Amazon: the known R3b race,
   reported honestly by design (linkage still broken). No action beyond #2.
4. Amazon: 9× `Failed to fetch` from Amazon's own ad script after add-to-cart (page fully functional). Expected
   consequence of blocking an ad endpoint; confirm which rule and leave it.
5. Reddit could not be driven at all — the claude-in-chrome driver refuses the site. Owner-only.

### Method lessons (added to BREAKAGE-TESTING.md)

- **A hidden tab is not a test environment.** Assert `document.visibilityState === 'visible'` before every
  breakage measurement, in the harness and in a driven real browser alike.
- The extension's first-run options page hides the test tab in any fresh-profile harness. `site-bisect.mjs`
  closes extension pages and fronts the test page; `unpacked-chrome.mjs` should do the same.
