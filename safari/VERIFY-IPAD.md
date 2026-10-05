# Nullecho for Safari — iPad verification (done 2026-10-05)

Build under test: branch `safari` at `276f806`, container app built unsigned with
`xcodebuild -scheme "Nullecho (iOS)" -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO`, extension folder from
`node safari/tools/build-extension.mjs` (14 files, version 0.9.1). Installed with `xcrun simctl install` on an
**iPad Pro 11-inch (M5)** simulator, **iPadOS 27.0 (24A434)**, Safari `Version/27.0`. The extension was enabled
and its website permission changed in the Simulator's own Settings app, by tapping, exactly as a user would; the
state was read back from Safari's `Library/Safari/WebExtensions/Extensions.plist` after every change.

Ground truth is the server log of `safari/tools/verify-server.py` (loopback, port 47301; every request with every
header), not anything the browser reported. The logger was shown to record `Sec-GPC` when a request carries it
(`curl -H 'Sec-GPC: 1'`) before any Safari run. Every page reported `document.visibilityState === "visible"`;
a hidden-tab run would have been discarded. Full `--summary` output for every run:
[`verify/2026-10-05/verify-server-summaries.txt`](verify/2026-10-05/verify-server-summaries.txt).

Note on the user agent: iPadOS Safari sends a desktop-class UA (`Macintosh; Intel Mac OS X 10_15_7 … Version/27.0
Safari/605.1.15`) by default, so the iPad's rows in the log look like a Mac's. They are the iPad's: every `ipad-*`
URL was opened only with `xcrun simctl openurl` on this device, and the Mac's Safari was not opened during the run.

## Three states, in the order a new user meets them

| State (Settings ▸ Apps ▸ Safari ▸ Extensions ▸ Nullecho) | Run id | Tracker blocking | GPC header on image/script | GPC JavaScript signal |
|---|---|---|---|---|
| **Allow Extension ON, Other Websites = Ask** (nothing granted) | `ipad-noaccess` | **6/6 trackers blocked, 3/3 controls loaded** | absent (expected: needs website access) | absent (`typeof` undefined; expected) |
| **Allow Extension ON, Other Websites = Allow** | `ipad-on` | **6/6 blocked, 3/3 loaded** | **`Sec-GPC: 1`** on same-site image, third-party image and script; absent on fetch, XHR and the document (Safari's limit, as the audit measured) | **`true`** in the top frame from its first inline script, after forged page-script handshakes, in a cross-origin iframe, a srcdoc iframe, an about:blank iframe (at load and 500 ms later) and a same-tick child realm; getter named `get globalPrivacyControl` |
| **Allow Extension OFF** (negative control) | `ipad-off` | **0/6 blocked: all six trackers loaded** | absent | absent |

`ipad-on`: 15/15 checks PASS. `ipad-noaccess` and `ipad-off`: every GPC check reads the opposite, which is what
proves the checks can fail. Blocking without website access is the behaviour the audit predicted (DNR `block`
is not gated by site permission in Safari); it is what lets the container app say "tracker blocking starts on
every site right away".

Screenshots (Simulator, light appearance, each taken after the page printed its verdict):

- [`ipad-blocking-proof-on-no-access.png`](verify/2026-10-05/ipad-blocking-proof-on-no-access.png) — on, no access: six `blocked`, three `loaded`, `navigator.globalPrivacyControl` undefined
- [`ipad-blocking-proof-on.png`](verify/2026-10-05/ipad-blocking-proof-on.png) — on, access: six `blocked`, three `loaded`, `navigator.globalPrivacyControl: true`; the Nullecho button is visible in the address bar
- [`ipad-blocking-proof-off.png`](verify/2026-10-05/ipad-blocking-proof-off.png) — off: "BLOCKING IS NOT HAPPENING", all six trackers `loaded`
- [`ipad-container-app-light.png`](verify/2026-10-05/ipad-container-app-light.png) — the container app on iPad, light appearance, "200 block rules on"

`harness/blocking-proof.html` prefixes every verdict with "NOT AUTHORITATIVE … Detected: unknown" in Safari because
its browser gate only knows Chrome; the rows and the sentence "All 6 tracker requests were cancelled and all 3
control requests loaded" are the measurement. (Reported to the Chrome lane; the page is not changed here.)

## Settings strings seen on iPadOS 27.0

Settings ▸ **Apps** ▸ **Safari** ▸ **Extensions** ▸ "Allow these extensions" ▸ **Nullecho** ▸ **Allow Extension**,
**Allow in Private Browsing**; Permissions ▸ **Other Websites** (when one site is already listed) or **All Websites**
▸ **Ask / Deny / Allow**. The container app's instructions use these words.

## Simulator quirks met (not user-facing)

- A toggle in Settings only took when Safari had been terminated first (`xcrun simctl terminate <udid>
  com.apple.mobilesafari`), as the audit found; and a synthetic tap on the switch needed a ~0.15 s press, a plain
  tap did nothing. Read `Extensions.plist` to know the real state rather than trusting the screen.
- The Simulator keeps the extension's enabled state and website grants across an app reinstall.

## Not covered here

Real iPad hardware (same engine; the Simulator is what we have); Private Browsing (the extension is off there by
default per Safari's policy and "Allow in Private Browsing" was left off); macOS, see
[`VERIFY-MACOS.md`](VERIFY-MACOS.md).
