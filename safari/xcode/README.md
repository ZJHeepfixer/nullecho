# Nullecho for Safari — container app

Safari web extensions ship inside an app. This is that app for iPhone, iPad and Mac: one native
SwiftUI screen that says what the extension does and does not do in Safari, how to turn it on,
and (on macOS) whether it is on. It opens no network connections; its two links are handed to the
system browser. The extension itself lives in `safari/extension/` + `ext/` and is assembled by
`safari/tools/build-extension.mjs`; this project never holds a copy of it.

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
| `App/` | SwiftUI app, compiled into both app targets (`#if os(...)` where the platforms differ). `EmbeddedExtension.swift` reads the embedded extension's manifest and rule files so the screen describes the build it actually contains. `SafariExtensionStatus.swift` (macOS only) wraps `SFSafariExtensionManager` / `SFSafariApplication`. |
| `Extension/` | The extension's native side: Apple's inert `SafariWebExtensionHandler` and its privacy manifest. The web extension files are **not** here. |
| `Scripts/embed-extension.sh` | Build phase in both extension targets, before Copy Bundle Resources: runs `node safari/tools/build-extension.mjs`, then copies the contents of `dist/safari/extension/` into the extension bundle's resources root (where Safari expects `manifest.json`). A folder reference would nest the folder; per-file references would miss anything added later. |
| `Scripts/stamp-version.sh` | Last build phase in all four targets: writes the extension manifest's `version` into the built bundle's `CFBundleShortVersionString`. `MARKETING_VERSION` in the project is the sentinel `0.0.0`; if a built app ever shows it, this phase did not run. `CURRENT_PROJECT_VERSION` (the build number) is still a plain build setting: pass `CURRENT_PROJECT_VERSION=n` to `xcodebuild` or bump it in the project per upload. |
| `Config/*.plist` | The partial Info.plists (`GENERATE_INFOPLIST_FILE = YES` fills in the rest). Both app plists set `ITSAppUsesNonExemptEncryption = NO`. |
| `Nullecho.xcodeproj` | Generated once with `xcrun safari-web-extension-packager … --swift --bundle-identifier org.nullecho.app`, then rewritten: file-system-synchronized groups (`App/`, `Extension/`), the two script phases, aligned deployment targets, macOS sandbox without the network-client entitlement, no `DEVELOPMENT_TEAM`. |

`ENABLE_USER_SCRIPT_SANDBOXING` is off project-wide because the two script phases read `ext/` and
`dist/` and write into the built bundle. There are no other scripts.

## Decisions the owner still makes

- **Bundle identifiers.** `org.nullecho.app` (app, same on iOS and macOS so one App Store record
  can carry both) and `org.nullecho.app.extension` are working values. Change them in the
  project only; the app discovers the extension's identifier from the embedded `.appex` at run time,
  so nothing else needs editing. The extension id must stay prefixed by the app id.
- **Signing.** Automatic signing with no team in the repo. In Xcode pick the team on each of the
  four targets, or pass `DEVELOPMENT_TEAM=XXXXXXXXXX` to `xcodebuild`. Never commit a team id.
- **App icon.** `App/Assets.xcassets/AppIcon.appiconset` holds what the packager produced from
  `ext/icons/icon-128.png`, including a 1024-px upscale. Fine for development; replace with a real
  1024-px (ideally vector) asset before submission.
- **Minimum OS.** iOS 18.4 for app and extension (Safari 18.4 is the floor the manifest needs:
  `match_origin_as_fallback`, MAIN-world content scripts). macOS 15.4 for both, which is the
  macOS release that ships Safari 18.4; Safari 18.4 also exists for Sonoma and Ventura, so the
  Mac floor could be lowered to 14.0 if reaching those users matters more than guaranteeing the
  Safari version. Keep app and extension equal either way.

## Checks

```sh
node safari/tools/check-container.mjs              # static assertions on this project
node safari/tools/check-container.mjs --self-test  # proves each assertion fails on a mutated copy
```
