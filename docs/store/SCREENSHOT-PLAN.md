# Nullecho — Chrome Web Store screenshot plan

This is a plan, not a delivery: no image files are produced by this document. Every shot below names
the exact page/state, the exact capture size, whether any text overlay is recommended, and the exact
method to produce it. Follow the project's own standing rule before calling any of these "done":
**grep proves source, only rendering proves what users see** — every shot listed here must actually be
captured from a live, loaded install and eyeballed, not assumed correct because the underlying feature
has passing tests.

Chrome Web Store image requirements (confirmed against the live category/listing pages, 2026-09-22):

| Asset | Spec | Required? |
|---|---|---|
| Store icon | 128×128 PNG | Required |
| Screenshots | 1280×800 **or** 640×400 (pick one size and use it for all five — do not mix) | At least 1, up to 5 |
| Small promotional tile | 440×280 | Optional, but un-tiled listings rank below tiled ones |
| Marquee | 1400×560 | Optional, not planned here (not needed at this stage) |

**Recommendation: capture at 1280×800.** It's the larger of the two accepted sizes, downscales cleanly
if Chrome ever needs a smaller thumbnail, and gives the popup's persona table and the options page's
prose room to stay legible without shrinking type.

---

## Icon check — do this before anything else

`ext/icons/icon-128.png` exists and is a valid 128×128 8-bit RGBA PNG (confirmed by `file`). Chrome's
own guidance is 96×96 artwork centered on the 128×128 canvas with roughly 16px of transparent padding
on each side, so the icon doesn't touch the tile edges the way other stores' icons do.

**Checked directly while writing this plan** (Python/Pillow, scanning for the bounding box of
non-transparent pixels): the artwork's opaque bounding box is **0,0 to 127,127 — the full canvas, zero
transparent padding on any side.** This does not match Chrome's convention. It is not a submission
blocker (Chrome does not reject on this), but it will look visually inconsistent next to other
listings in the "Privacy & Security" category, most of which do pad. **Recommend Jason look at
`ext/icons/icon-128.png` at full size before submitting** and decide whether to re-export with
padding — a five-minute fix if the source art exists in a vector or larger raster form, otherwise a
known, accepted cosmetic gap to submit with and fix in a point release.

16×16, 32×32, and 48×48 icons also exist at `ext/icons/` and are wired into both `action.default_icon`
and the top-level `icons` map in `ext/manifest.json` — nothing missing there.

---

## The popup's per-tab data problem — read this before shooting screenshots 1 and 2

`ext/popup/popup.js:40` resolves "the current site" with:

```js
const [tab] = await api.tabs.query({ active: true, currentWindow: true });
```

That's correct when the popup runs as a **real browser-action popup** — Chrome does not count the
popup surface itself as a tab, so the query genuinely returns whichever page the user was looking at
when they clicked the toolbar icon. But `popup.js:27` also has:

```js
const LIVE = !!api?.runtime?.id;
```

which is true for *any* page loaded from `chrome-extension://<id>/...`, popup or not. So if
`popup/popup.html` is opened as an ordinary tab (e.g. by navigating Puppeteer to
`chrome-extension://<id>/popup/popup.html`), `LIVE` is still true, real `chrome.tabs.query` runs, and
because the popup page is now itself the active tab in its window, the query returns *the popup's own
page* — not the news or shopping site you wanted it reporting on. The popup then either shows zeros or
falls into its own inert state ("Nullecho only runs on regular web pages"), neither of which is the
screenshot you want.

**Consequence for this plan:** screenshots 1 and 2 (both popup shots, both needing live per-site data)
should be captured by **a human clicking the real toolbar icon**, not by automated tab navigation to
the popup's URL. Screenshots 3–5 have no such dependency and are fully automatable.

---

## Screenshot 1 — Popup on an ordinary site, blocking + persona visible

**Shows:** the toolbar popup, opened normally (real click, real floating popup surface), on a
content-heavy ordinary page — a news homepage is the best choice because it reliably loads several
trackers Nullecho's rulesets recognize. Visible in frame: the blocked-request count (`#stat-blocked`),
the fingerprint-reads count (`#stat-fp`), and the "What this site sees" persona card (`#persona` —
system, graphics, CPU/RAM, display).

**Size:** 1280×800 (the popup itself renders much smaller; capture the full browser window at this
resolution so the popup shows in its real context — toolbar, tab strip, the site behind it — the way
a user actually sees it, then Chrome will scale it to fit the listing tile). If cropping to just the
popup chrome, crop is fine, but keep the aspect and don't stretch.

**Text overlay:** none needed — the popup's own labels ("requests blocked", "fingerprint reads seen")
already read clearly at this size. If a one-line caption is added underneath in the image (not
required), use: *"See what's blocked on every page, in real numbers."*

**How to produce:**
1. Load `ext/` unpacked in a real, non-headless Chrome (or Chrome for Testing) profile — the same
   `puppeteer.launch({ headless: false, args: ['--load-extension=<path to ext/>', ...] })` pattern
   `harness/unpacked-chrome.mjs` already uses (see its header comment for the exact args and the
   `_metadata/` cleanup trap), or just load it by hand via `chrome://extensions` → Developer mode →
   Load unpacked, which is simpler for a one-off screenshot and avoids Puppeteer entirely.
2. Navigate to a real news site so several trackers actually load and get blocked (the count needs to
   be non-zero and honest — do not fabricate it).
3. Wait a couple of seconds for the page's own trackers to fire and DNR to register the blocks.
4. Click the Nullecho toolbar icon for real (mouse click, not a URL navigation) so the popup opens as
   an actual browser-action popup with the real active tab behind it.
5. Screenshot the window (macOS: Cmd+Shift+4, drag to select; or Cmd+Shift+5 for a timed capture so
   the popup doesn't close when the screenshot tool steals focus — the timed/5-second-delay mode is
   the reliable one, since a plain click-drag capture can dismiss the popup by changing window focus).
6. Crop/scale to 1280×800 in Preview or any image tool. Do not upscale a smaller capture — recapture
   at a larger window/display scale instead if the raw shot is under 1280 px wide.

---

## Screenshot 2 — Popup with the price-disclosure panel

**Shows:** the same popup, on a page where the price-disclosure notice has fired —
`#pricing-panel` visible with its headline, quoted sentence, price, and the "Copy receipt" action.

**Size:** 1280×800, same capture convention as Screenshot 1.

**Text overlay:** none, or *"Nullecho recognizes the price-disclosure sentence New York law now
requires, and keeps a local copy of what the page showed."* Keep it to one line if used at all.

**The hard part, and the recommended fix:** finding a live retailer page that both carries the exact
NY §349-a disclosure sentence *and* a machine-readable price *and* is reachable without a login is
unreliable — `research/NY-349A-COMPLIANCE-SWEEP.md` records that most real checkout flows require a
logged-in, NY-geolocated session to reach the page where this would even render, and general retailers
are not reliably in compliance yet in the pages a scanner can reach anonymously. **Do not spend time
hunting a live page for a store screenshot.** Instead, build one local fixture HTML file containing the
exact NY disclosure sentence (quoted correctly, not paraphrased — check
`ext/src/pricing.js`/`pricing-scan.js` or `research/NY-349A-COMPLIANCE-SWEEP.md` for the exact string
the detector matches) plus a `application/ld+json` `Product`/`Offer` block with a price, serve it over
`http://` or `https://` (not `file://` — the content script's `matches` list is `http://*/*` and
`https://*/*`, so a `file://` page will not trigger the scan at all), and open the popup on that page
the same way as Screenshot 1. This is more reliable than chasing a live site and doesn't misrepresent
any real retailer.

**How to produce:** same steps as Screenshot 1, but navigate to the local fixture page first and give
the two-pass scan (`document_idle`, then +3s — see `ext/src/pricing-scan.js`'s header comment) time to
complete before opening the popup.

---

## Screenshot 3 — Options page, blocking categories + Global Privacy Control, light mode

**Shows:** `ext/options/options.html`'s blocking-category toggles and the GPC section, in light color
scheme (per the standing project rule to always test/show `colorScheme: light` — a past dark-only
capture once made an entire settings panel unreadable).

**Size:** 1280×800.

**Text overlay:** none, or *"Turn any category off, per site or everywhere. Global Privacy Control
sent automatically."*

**How to produce (fully automatable, no per-tab data dependency):**
1. Reuse `harness/unpacked-chrome.mjs`'s launch pattern directly: it already does
   `puppeteer.launch({ args: ['--load-extension=<ext>', '--disable-extensions-except=<ext>', ...] })`
   against Chrome for Testing. Add a small `screenshot` mode to that script, or just write a five-line
   standalone script using the same `launch()`/`serviceWorker()` helpers it exports the pattern for.
2. Get the extension's assigned id from the service worker target's URL (`t.url()` starts
   `chrome-extension://<id>/...`) — unpacked loads get a random id each run since `manifest.json` has
   no `"key"` field, so the id must be read back at runtime, never hardcoded.
3. `page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])` — force light mode
   explicitly rather than relying on the OS/profile default, so this shot is reproducible regardless of
   who captures it or what machine they're on.
4. `page.setViewport({ width: 1280, height: 800 })`, then
   `page.goto('chrome-extension://<id>/options/options.html')`.
5. Scroll to the blocking-categories + GPC section (`options.html`'s toggle cards near the top of the
   page — check current section ids, they may have shifted since this plan was written) and
   `page.screenshot({ path: ... })`. No real active tab or site data is involved anywhere in this
   page, so this is safe to fully automate and re-run.

---

## Screenshot 4 — Options page, "What Nullecho can't do"

**Shows:** the honesty section (`#limits` in `options.html`, "What Nullecho can't do" — sites can tell
it's installed, Firefox/Brave are stronger, your IP and TLS fingerprint aren't touched, etc.). This is
a deliberate, distinctive screenshot choice: most competing privacy extensions never publish a limits
list at all, and this repo's whole credibility argument rests on saying what it doesn't do as loudly as
what it does. It doubles as a truth-in-advertising defense for the review — a reviewer who reads this
screenshot sees the same disclosures this listing's description makes.

**Size:** 1280×800, light mode, same rule as Screenshot 3.

**Text overlay:** none, or *"Every limit, on the settings page, not in a footnote."*

**How to produce:** identical automated method to Screenshot 3 — same script, scrolled to `#limits`
instead. No per-tab dependency.

---

## Screenshot 5 — nullecho.org/prove-it, the fingerprint check

**Shows:** the "prove it yourself" page (`site/prove-it/index.html`) with a check already run — the
"Your browser fingerprint" hero number and the results table populated (post-click state, not the
empty pre-click page). This is the page the review-notes-for-reviewer text in
`CHROME-WEB-STORE-LISTING.md` specifically tells the Chrome reviewer to visit, so having it as a
listing screenshot keeps the store page and the review instructions pointing at the same evidence.

**Size:** 1280×800.

**Text overlay:** none, or *"Don't trust a green shield — measure it yourself, on this page, with
protection off and on."*

**How to produce:** this one needs no extension automation at all, since it's a normal webpage.
1. Load `ext/` unpacked in the same profile (protection *on* makes the more interesting screenshot —
   it shows a different, internally-consistent profile rather than the raw real one).
2. Navigate to `https://nullecho.org/prove-it/` (or `http://localhost:4886/site/prove-it/` against a
   local checkout if capturing before the live site has a given change deployed — but if the two
   differ, capture from the live URL, since that's what a reviewer or installer will actually see).
3. Click "Show me my fingerprint," wait for `#out` to become visible and `#rows`/`#verdict` to
   populate.
4. `page.setViewport({width:1280, height:800})` before or after — either order works since this is a
   plain page reflow, not an extension surface with load-order sensitivities — then screenshot.

---

## Optional: 440×280 small promotional tile

Not required, but the dashboard ranks listings with one above listings without. **Simplest honest
option:** a crop/re-layout of Screenshot 1 (popup + blocked count) at 440×280, or a plain wordmark card
(Nullecho name + the one-line summary from `CHROME-WEB-STORE-LISTING.md`) on a flat background — no
photography, no stock imagery, nothing implying a feature that isn't in the five screenshots above.
Build this last, after the five screenshots exist, by cropping whichever one reads most clearly at the
smaller size — the persona/blocked-count popup (Screenshot 1) is the best candidate since its two
numbers are legible even shrunk.

---

## Summary table

| # | Page/state | Size | Overlay | Method |
|---|---|---|---|---|
| 1 | Popup, ordinary news site, blocking + persona | 1280×800 | none / 1-line | Manual real click (active-tab data) |
| 2 | Popup, price-disclosure panel | 1280×800 | none / 1-line | Manual real click, local fixture page |
| 3 | Options — categories + GPC, light mode | 1280×800 | none / 1-line | Automated, `unpacked-chrome.mjs` pattern |
| 4 | Options — "What Nullecho can't do" | 1280×800 | none / 1-line | Automated, same pattern |
| 5 | nullecho.org/prove-it, post-check | 1280×800 | none / 1-line | Automated, plain page load |

No images are attached to this plan. Capture all five, eyeball each one rendered (not just generated)
before uploading, and confirm the small promo tile and the 128×128 icon padding question before
submission.
