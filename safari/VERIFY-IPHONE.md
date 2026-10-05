# Nullecho for Safari — iPhone verification (done 2026-10-05)

Same build, server and method as [`VERIFY-IPAD.md`](VERIFY-IPAD.md): branch `safari` at `276f806`, unsigned
simulator build, extension folder from `node safari/tools/build-extension.mjs` (14 files, version 0.9.1).
Device: **iPhone 17 Pro** simulator, **iOS 27.0 (24A434)**, Safari `Version/27.0` (UA `iPhone; CPU iPhone OS 18_7 …`,
Safari's frozen mobile UA). The extension started from a clean state here (never enabled on this device), so the
sequence below is exactly a first install. Each Settings change was read back from Safari's
`Library/Safari/WebExtensions/Extensions.plist`. Every page reported `visibilityState === "visible"`. Full
`--summary` output: [`verify/2026-10-05/verify-server-summaries.txt`](verify/2026-10-05/verify-server-summaries.txt).

| State (Settings ▸ Apps ▸ Safari ▸ Extensions ▸ Nullecho) | Run id | Tracker blocking | GPC header on image/script | GPC JavaScript signal |
|---|---|---|---|---|
| Fresh install, **Allow Extension ON, All Websites = Ask** | `iphone-noaccess` | **6/6 trackers blocked, 3/3 controls loaded** | absent (expected: needs website access) | absent (expected) |
| **Allow Extension ON, All Websites = Allow** | `iphone-on` | **6/6 blocked, 3/3 loaded** | **`Sec-GPC: 1`** on same-site image, third-party image and script; absent on fetch, XHR and the document | **`true`** in the top frame (first inline script and later), after forged handshakes, cross-origin iframe, srcdoc, about:blank (load and +500 ms), same-tick child realm; getter `get globalPrivacyControl` |
| **Allow Extension OFF** (negative control) | `iphone-off` | **0/6 blocked: all six trackers loaded** | absent | absent |

`iphone-on`: 15/15 checks PASS; the two other runs read the opposite on every GPC check.

Screenshots (Simulator, light appearance):

- [`iphone-blocking-proof-on-no-access.png`](verify/2026-10-05/iphone-blocking-proof-on-no-access.png)
- [`iphone-blocking-proof-on.png`](verify/2026-10-05/iphone-blocking-proof-on.png)
- [`iphone-blocking-proof-off.png`](verify/2026-10-05/iphone-blocking-proof-off.png)

Settings strings seen on iOS 27.0 (a device with no per-site answer yet): Settings ▸ **Apps** ▸ **Safari** ▸
**Extensions** ▸ **Nullecho** ▸ **Allow Extension**; Permissions ▸ "You have not allowed this extension on any
websites yet." ▸ **All Websites** ▸ **Ask / Deny / Allow**. On iPhone, Safari's **Manage Extensions** entry is in
the page menu beside the address bar (measured by the container-app build on 2026-10-02).

Not covered here: real iPhone hardware; Private Browsing; the popup's light/dark rendering was checked on
2026-10-02 on an iPhone 18 Pro Max simulator during the build (not repeated).
