# Nullecho for Safari — container app

Safari web extensions ship inside an app. This is that app for iPhone, iPad and Mac: one native
SwiftUI screen that says what the extension does and does not do in Safari, how to turn it on,
and (on macOS) whether it is on, plus an optional tip jar. It opens no network connections of its
own: its two links are handed to the system browser, and a tip is handled by the App Store's own
purchase service through StoreKit 2 (`App/TipJar.swift`). The extension itself lives in
`safari/extension/` + `ext/` and is assembled by `safari/tools/build-extension.mjs`; this project
never holds a copy of it.

## Build (no signing, fresh clone)

```sh
# iOS (Simulator)
xcodebuild -project safari/xcode/Nullecho.xcodeproj -scheme "Nullecho (iOS)" \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/nullecho-dd CODE_SIGNING_ALLOWED=NO build

# macOS
xcodebuild -project safari/xcode/Nullecho.xcodeproj -scheme "Nullecho (macOS)" \
  -derivedDataPath /tmp/nullecho-dd CODE_SIGNING_ALLOWED=NO build
```

Requirements: Xcode 27 and Node.js on the machine (the build phase looks in `PATH`, then the usual
Homebrew / nvm / volta / fnm / `~/.local/bin` locations; set `NODE_BINARY=/path/to/node` to be
explicit). Without node the build fails with a message saying so; it never silently ships an
app with no extension inside.

## How the pieces fit

| Piece | What it does |
|---|---|
| `App/` | SwiftUI app, compiled into both app targets (`#if os(...)` where the platforms differ). `EmbeddedExtension.swift` reads the embedded extension's manifest and rule files so the screen describes the build it actually contains. `SafariExtensionStatus.swift` (macOS only) wraps `SFSafariExtensionManager` / `SFSafariApplication`. `TipJar.swift` is the only file that imports StoreKit: the three consumable product ids, the model (products, one transient outcome, the `Transaction.updates` listener) and the "Support the project" section. |
| `Nullecho.storekit` | Xcode StoreKit configuration with the same three consumables, prices as working values. Attached to both shared schemes' Run action and copied into the test bundles for `SKTestSession`. Never uploaded anywhere; App Store Connect is the owner's step (`../TIP-JAR.md`). |
| `Tests/` | `TipJarTests.swift`, an XCTest bundle hosted in the app on both platforms (`Nullecho Tests (iOS)`, `Nullecho Tests (macOS)`), driving the real model under `SKTestSession`. |
| `UITests/` | `TipJarUITests.swift` (`Nullecho UI Tests (iOS)`): launches the app, taps a tier, screenshots the system purchase sheet and the thank-you. |
| `Extension/` | The extension's native side: Apple's inert `SafariWebExtensionHandler` and its privacy manifest. The web extension files are **not** here. |
| `Scripts/embed-extension.sh` | Build phase in both extension targets, before Copy Bundle Resources: runs `node safari/tools/build-extension.mjs`, then copies the contents of `dist/safari/extension/` into the extension bundle's resources root (where Safari expects `manifest.json`). A folder reference would nest the folder; per-file references would miss anything added later. |
| `Scripts/stamp-version.sh` | Last build phase in all four targets: writes the extension manifest's `version` into the built bundle's `CFBundleShortVersionString`. `MARKETING_VERSION` in the project is the sentinel `0.0.0`; if a built app ever shows it, this phase did not run. `CURRENT_PROJECT_VERSION` (the build number) is still a plain build setting: pass `CURRENT_PROJECT_VERSION=n` to `xcodebuild` or bump it in the project per upload. |
| `Config/*.plist` | The partial Info.plists (`GENERATE_INFOPLIST_FILE = YES` fills in the rest). Both app plists set `ITSAppUsesNonExemptEncryption = NO`. |
| `Nullecho.xcodeproj` | Generated once with `xcrun safari-web-extension-packager … --swift --bundle-identifier org.nullecho.app`, then rewritten: file-system-synchronized groups (`App/`, `Extension/`), the two script phases, aligned deployment targets, macOS sandbox without the network-client entitlement, no `DEVELOPMENT_TEAM`. |

`ENABLE_USER_SCRIPT_SANDBOXING` is off project-wide because the two script phases read `ext/` and
`dist/` and write into the built bundle. There are no other build-phase scripts; `Scripts/test-tipjar.sh`
is a developer convenience, not a build phase.

## Decisions the owner still makes

- **Bundle identifiers.** `org.nullecho.app` (app, same on iOS and macOS so one App Store record
  can carry both) and `org.nullecho.app.extension` are working values. Change them in the
  project only; the app discovers the extension's identifier from the embedded `.appex` at run time,
  so nothing else needs editing. The extension id must stay prefixed by the app id.
- **Signing.** Automatic signing with no team in the repo. In Xcode pick the team on each of the
  four targets, or pass `DEVELOPMENT_TEAM=XXXXXXXXXX` to `xcodebuild`. Never commit a team id.
- **App icon.** Settled 2026-10-07 (brand option 2: the dots stay; "nah." is never on the icon). Two sources,
  both derived from `brand/` on `main`:
  - `App/AppIcon.icon` — an Icon Composer package (`icon.json` + `Assets/dots.svg`): solid `#0D1117` fill,
    one glass layer of the eight `#56C3A4` dots taken from `brand/nullecho-icon.svg`. iOS 26 / macOS 26 and
    later render this (Liquid Glass); `actool` also compiles flat renditions from it. Verified: macOS 26 draws
    the dark tile filling the squircle with glass dots (`safari/verify/2026-10-07/macos-26-app-icon-as-rendered.png`,
    rendered through `NSWorkspace`, the Dock's own path); iPadOS 27 home screen and dock
    (`ipad-home-screen-icon.png`).
  - `App/Assets.xcassets/AppIcon.appiconset` — the legacy set for iOS 18 / macOS 15: `universal-icon-1024@1x.png`
    is `brand/appstore-icon-1024.png` byte for byte (square, no alpha; Apple masks it); the ten `mac-icon-*.png`
    are rendered from `brand/nullecho-icon-macos.svg`, the master placed on Apple's macOS icon grid (824-pt
    tile at 100 pt, corner radius 185.4) so it sits like other Mac icons on macOS 15 (`macos-legacy-icns-as-rendered.png`).
  Regenerate the PNGs with `qlmanage -t -s <px> -o <dir> brand/nullecho-icon-macos.svg` (Quick Look rasterizes
  the SVG; no other rasterizer is needed). The in-app `LargeIcon` image is still `ext/icons/icon-128.png`.
- **Minimum OS.** iOS 18.4 for app and extension (Safari 18.4 is the floor the manifest needs:
  `match_origin_as_fallback`, MAIN-world content scripts). macOS 15.4 for both, which is the
  macOS release that ships Safari 18.4; Safari 18.4 also exists for Sonoma and Ventura, so the
  Mac floor could be lowered to 14.0 if reaching those users matters more than guaranteeing the
  Safari version. Keep app and extension equal either way.
- **Tip jar.** Built 2026-10-07 (`App/TipJar.swift`, verification in [`../VERIFY-TIP-JAR.md`](../VERIFY-TIP-JAR.md)):
  free app, three StoreKit 2 consumable tips, nothing gated, nothing stored. The product ids
  `org.nullecho.tip.small` / `.medium` / `.large` are working values the owner confirms before creating them
  in App Store Connect (they are immutable there); change them in `TipJar.productIDs` and `Nullecho.storekit`
  together, `check-container.mjs` asserts the match. Rules and owner steps are in [`../TIP-JAR.md`](../TIP-JAR.md).
  The app still has no network code and no outgoing-network entitlement: StoreKit's traffic is the system
  agent's, measured in `../audit/04-storekit-sandbox.md`.

## Checks

```sh
node safari/tools/check-container.mjs              # static assertions on this project
node safari/tools/check-container.mjs --self-test  # proves each assertion fails on a mutated copy
```

## Tests (StoreKit test environment, no money, no Apple account)

```sh
# iOS Simulator: unit tests hosted in the app, then the UI flow with screenshots
sh safari/xcode/Scripts/test-tipjar.sh "<simulator name or udid>" [screenshot dir]

# by hand
xcodebuild test -project safari/xcode/Nullecho.xcodeproj -scheme "Nullecho (iOS)" \
  -destination 'platform=iOS Simulator,name=<device>' -derivedDataPath /tmp/nullecho-dd \
  CODE_SIGNING_ALLOWED=NO -only-testing:"Nullecho Tests (iOS)"
xcodebuild test -project safari/xcode/Nullecho.xcodeproj -scheme "Nullecho (macOS)" \
  -derivedDataPath /tmp/nullecho-dd CODE_SIGNING_ALLOWED=NO -only-testing:"Nullecho Tests (macOS)"
```

One measured quirk of the rig: `xcodebuild` does not push the scheme's StoreKit configuration into a
Simulator; the `SKTestSession` inside the tests does, and the Simulator's StoreKit daemon keeps it for the
app's bundle id. The app's StoreKit client is created at launch, so on a freshly created or erased Simulator
the first test process still talks to the sandbox App Store and every product load fails; run the tests
once more and they pass. `Scripts/test-tipjar.sh` does the priming run for you. Details and evidence in
[`../VERIFY-TIP-JAR.md`](../VERIFY-TIP-JAR.md).
