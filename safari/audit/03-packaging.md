# Nullecho for Safari — packaging, distribution, App Review and privacy-label audit (A3)

Date: 2026-10-01. Environment used for every command below: Xcode 27.0 (27A266a), Safari 27.0
(`/Applications/Safari.app` `CFBundleShortVersionString`), macOS 26.6 (build 25G5043d, Darwin 25.6.0).
Scope: phase 1 as defined by the owner — Global Privacy Control (`Sec-GPC` via DNR `modifyHeaders` +
`navigator.globalPrivacyControl` via `ext/src/gpc.js`) and static-list tracker blocking, Mac + iPhone/iPad,
no persona shim. Nothing in `ext/` was modified; nothing was installed in a simulator; no settings, signing
identities or accounts were touched. All scratch artefacts live outside the repo (paths in the appendix).

Evidence rule used here: every claim is either (a) a command run on this machine with its output reproduced,
(b) an Apple/WebKit page cited by URL with the date it was fetched (2026-10-01) and any date the page carries,
or (c) marked **unverified**. Because of quoting limits, guideline and documentation text is paraphrased with
section numbers and links rather than reproduced; exactly one short direct quotation appears (section 4).

---

## 0. Findings that change the plan (ranked)

1. **`Sec-GPC` is accepted by Safari's DNR `modifyHeaders` validator — but only with an extra permission and
   only on sites the user has granted.** WebKit keeps an allow-list of header names for `modifyHeaders`
   (`acceptedHeaderNames` in `Source/WebKit/UIProcess/Extensions/Cocoa/_WKWebExtensionDeclarativeNetRequestRule.mm`;
   `sec-gpc` is on it, compared case-insensitively; present at least since commit `aa49cd4d`, 2024-06-13, and on
   `main` as of commit `09e9de94`, 2026-09-09). A 2023 report (w3c/webextensions#372, radar FB12074761) that Safari
   rejected `Sec-GPC` as "not recognized" predates that. Safari additionally requires the
   `declarativeNetRequestWithHostAccess` permission for `modifyHeaders` and applies it only to domains with granted
   website permission (WebKit blog, Safari 16.4, 2023-03-27). **Nullecho's manifest lacks that permission** → the
   Safari manifest must add it. Runtime behaviour on this machine was **not** exercised (no Safari run).
2. **The converter's "unsupported keys" list is stale; do not treat it as the compatibility oracle.** It flagged
   `match_origin_as_fallback` / `match_about_blank` (added in Safari 18.4 per WebKit's own release notes),
   `world` (parsed by WebKit's manifest loader; MDN BCD says Safari 18) and `type` (BCD: `background.type` since
   16.4). Conversely it stayed silent on things that *do* break the port: `declarativeNetRequest.updateStaticRules`
   and `getDisabledRuleIds` (called in `ext/src/background.js`) are not implemented in Safari (BCD), and the
   `webRequest` observer cannot see `Cookie` headers in Safari (Apple compatibility page), which removes the data
   source of `ext/src/heuristics.js`.
3. **Both generated targets compile unsigned** (macOS app+appex, iOS simulator app+appex) with the stock Xcode 27
   template; no source edits were needed. Shared bundle ID across the iOS and macOS app targets already matches
   App Store Connect's universal-purchase requirement.
4. **Distribution outside the Mac App Store is now a real option**: Safari 18.4+ accepts Developer ID-signed and
   notarized web extensions (WebKit blog 2025-03-31; Apple engineer on the developer forums, April 2025). That is
   the "not one gatekeeper" path for macOS. iPhone/iPad remain App Store (or TestFlight) only.
5. **App Store Connect's Safari Web Extension Packager** builds the container app on Apple's Xcode Cloud from an
   uploaded ZIP of the extension files. It is convenient but opaque (the native binary is built server-side and
   counts against the 25 Xcode Cloud hours/month); for a reproducible open-source build keep the generated Xcode
   project in-repo and build it with `xcodebuild` from a tag.
6. **Privacy label = "Data Not Collected"**, legitimately: Apple defines "collect" as transmitting off-device; the
   extension and the template container transmit nothing. A privacy-policy URL is still mandatory (App Store
   Connect) and the policy must also be reachable inside the app (Guideline 5.1.1(i)) — the generated container
   page has no such link, so one line of HTML must be added. No `PrivacyInfo.xcprivacy` is generated; the template
   uses no required-reason API, so it is not mandatory, but adding an empty-declaration manifest is cheap and safe.
7. **Review risk ranking**: 4.4.2 (host-access scope / honest claims) > 4.2 (instruction-only container) > 2.3.1 /
   2.3.7 (privacy-tool marketing, "for Safari" naming) > 5.1.1(i) (policy link in-app) > 2.4.1 (iPad behaviour)
   > 2.1 (placeholder template text). No published 4.2 rejection of a Safari-extension container app was found.

---

## 1. Converter output

### 1.1 Tool identity

```
$ xcrun --find safari-web-extension-converter
/Applications/Xcode.app/Contents/Developer/usr/bin/safari-web-extension-converter
$ xcrun safari-web-extension-converter --help        # exit status 64
This tool will package your Web Extension into an app that can be built and run in Safari and distributed through the App Store. It will generate a default Xcode project based on the manifest.json file.

Usage: safari-web-extension-packager [options] [path/to/web-extension]

Options:
    --project-location    The location to put the created Xcode project.
    --rebuild-project     The location of an existing Safari Web Extension Xcode project to rebuild with different options or platforms.
    --app-name            The name of the generated app.
    --bundle-identifier   The bundle identifier for the generated app.
    --swift               Use Swift in the generated app.
    --objc                Use Objective-C in the generated app.
    --ios-only            Create an iOS only project.
    --macos-only          Create a macOS only project.

Additional flags:
    --copy-resources   Copy the extension files to the generated project. If not specified, the project will reference the original extension files.
    --no-open          Do not open the generated Xcode project when complete.
    --no-prompt        Do not show the confirmation prompt.
    --force            Force overwriting the output directory if it exists.
    --help             Print the help text.
```

Apple renamed the tool to `safari-web-extension-packager`; in this Xcode the old name is a symlink to the new binary
(`ls -la /Applications/Xcode.app/Contents/Developer/usr/bin/ | grep safari-web` →
`safari-web-extension-converter -> safari-web-extension-packager`; Apple, "Packaging a web extension for Safari",
note on the page; fetched 2026-10-01:
https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari). The same page
documents each flag and states that without `--copy-resources` the project *references* the original files, so
edits flow both ways.

### 1.2 Inputs

The file sets were produced by the repo's own packager and copied into the scratch directory; the repo was not
touched (`git status` clean before and after; SHA-256 of the staged manifests equals the repo files).

```
$ node ext/tools/package.mjs --list            → 35 files (manifest.json, version 0.9.1)
$ node ext/tools/package.mjs --firefox --list  → 35 files (manifest.firefox.json, version 0.9.1)
   (Firefox set staged with manifest.firefox.json renamed to manifest.json, as the zip mode does)
```

### 1.3 Warnings — verbatim

Run 1, Chrome set, `--copy-resources`:

```
$ xcrun safari-web-extension-converter <scratch>/src-chrome --project-location <scratch>/proj-chrome \
    --app-name Nullecho --bundle-identifier org.nullecho.safari --swift --copy-resources --no-open --no-prompt --force
Xcode Project Location: <scratch>/proj-chrome
App Name: Nullecho
App Bundle Identifier: org.nullecho.safari
Platform: All
Language: Swift
Warning: The following keys in your manifest.json are not supported by your current version of Safari. If these are critical to your extension, you should review your code to see if you need to make changes to support Safari:
	match_origin_as_fallback
	type
	open_in_tab
	world
```

Run 2, Firefox set, `--copy-resources`:

```
Warning: The following keys in your manifest.json are not supported by your current version of Safari. If these are critical to your extension, you should review your code to see if you need to make changes to support Safari:
	match_about_blank
	type
	open_in_tab
	world
Warning: Persistent background pages are not supported on iOS and iPadOS. You will need to make changes to support a non-persistent background page.
```

Run 3, Chrome set, no `--copy-resources` (reference mode): identical warnings to run 1.

The bundle identifier `org.nullecho.safari` is a placeholder chosen for the test; the owner picks the real one.
Nothing else was reported: no warning for `minimum_chrome_version`, `homepage_url`, `declarativeNetRequestFeedback`,
`webRequest`, `host_permissions: <all_urls>`, `exclude_matches`, `browser_specific_settings.gecko`, or the
`content_security_policy` block.

### 1.4 Warnings versus reality

| Key flagged | What the evidence says | Source |
|---|---|---|
| `match_origin_as_fallback`, `match_about_blank` | Supported since Safari 18.4 (manifest + `scripting`). Converter list is stale. | WebKit blog "WebKit Features in Safari 18.4", 2025-03-31, Web Extensions section: https://webkit.org/blog/16574/webkit-features-in-safari-18-4/ ; MDN BCD `manifest.content_scripts.match_origin_as_fallback` safari=18.4, `match_about_blank` safari=18.4 |
| `world` (content_scripts) | WebKit's manifest parser reads `world` and maps `MAIN` to `WebExtensionContentWorldType::Main` (`Source/WebKit/UIProcess/Extensions/WebExtension.cpp`, constants at lines 92–101, mapping at ~1514–1519, `main` fetched 2026-10-01). BCD: safari=18. **Runtime behaviour not exercised here.** | https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebKit/UIProcess/Extensions/WebExtension.cpp ; https://github.com/mdn/browser-compat-data (webextensions/manifest/content_scripts.json) |
| `type` (`background.type: "module"`) | BCD: `manifest.background.type` safari=16.4; `background.service_worker` safari=15.4. WebKit parser defines `backgroundPageTypeKey = "type"` / `"module"` (same file, lines 120–121). | as above (webextensions/manifest/background.json) |
| `open_in_tab` | BCD: partial — Safari always opens options pages in a tab. Harmless. | webextensions/manifest/options_ui.json |
| Firefox "persistent background pages" | Triggered by `background.scripts` without `persistent:false`; Apple's compatibility page says MV3 background pages are always non-persistent and iOS needs `persistent:false` for MV2-style keys. Use the Chrome-style `service_worker` manifest as the Safari base. | https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility |

Things the converter did **not** warn about that matter for the port (all from MDN BCD `webextensions/*` JSON
fetched 2026-10-01 unless noted):

* `declarativeNetRequest.updateStaticRules` — safari=false; `getDisabledRuleIds` — safari=false. Both are called
  in `ext/src/background.js` (grep: `chrome.declarativeNetRequest.updateStaticRules`, `getDisabledRuleIds`), for
  the UA rulesets that are out of phase-1 scope anyway. Guard or remove in the Safari build.
* `declarativeNetRequest.onRuleMatchedDebug` — safari=false (Chrome: unpacked only). `getMatchedRules` — safari=15.4;
  `declarativeNetRequestFeedback` permission — safari=15.4. The popup's packed-build fallback path is the one Safari
  will take.
* `webRequest`: Apple's compatibility page says `webRequest` is not supported on iOS, blocking is not supported,
  and `webRequest.HTTPHeaders` does not expose `cookies`. BCD disagrees on iOS (api.webRequest safari_ios=18; the
  `onBeforeSendHeaders`/`onHeadersReceived` events safari=18.4 / safari_ios=18.4). Either way the Cookie/Set-Cookie
  observation that `ext/src/heuristics.js` relies on is documented as unavailable → the heuristic learner has no
  input on Safari. **Unverified at runtime.**
* `declarativeNetRequestWithHostAccess` (safari=16) is required for `modifyHeaders` (see §0.1 and §7).
* `RuleCondition.excludedRequestDomains` — safari=16.4 (used by `rules/gpc.json`); `requestDomains` 16.4;
  `initiatorDomains`/`excludedInitiatorDomains` — safari=26; `excludedRequestMethods`/`requestMethods` — 26.
* `storage.session` — safari=16.4 (used in `background.js`). `alarms`, `storage.local`, `runtime.getURL` — 14/15.
* `browser_specific_settings.safari` with `strict_min_version` / `strict_max_version` — safari=14 (useful to pin a
  floor; §8). `homepage_url` — supported but not displayed in Safari's Extensions settings.
* `permissions.request` note (BCD): requesting `<all_urls>` makes Safari prompt per visited website via the toolbar
  access popover (macOS) or banner (iOS); content scripts are not applied until the user grants access.

Apple's compatibility page (fetched 2026-10-01) also states: both `chrome.*` and `browser.*` namespaces work;
callbacks and Promises both work; unsupported manifest keys are generally ignored; `update_url` is not supported
(updates come from the App Store); `storage` local limit is 5 MB unless `unlimitedStorage`.

### 1.5 The generated Xcode project (run 1)

```
$ xcodebuild -list -project proj-chrome/Nullecho/Nullecho.xcodeproj
    Targets:  Nullecho (iOS)   Nullecho (macOS)   Nullecho Extension (iOS)   Nullecho Extension (macOS)
    Schemes:  Nullecho (iOS)   Nullecho (macOS)
```

Layout (`proj-chrome/Nullecho/`):

```
Nullecho.xcodeproj/
Shared (App)/        ViewController.swift, Assets.xcassets (AppIcon: mac 16…512 @1x/@2x + universal 1024, LargeIcon = icon-128.png),
                     Resources/Base.lproj/Main.html, Resources/Icon.png, Resources/Script.js, Resources/Style.css
Shared (Extension)/  SafariWebExtensionHandler.swift, Resources/{manifest.json, icons/, options/, popup/, rules/, src/}
iOS (App)/           AppDelegate.swift, SceneDelegate.swift, Info.plist, Base.lproj/{LaunchScreen,Main}.storyboard
iOS (Extension)/     Info.plist
macOS (App)/         AppDelegate.swift, Info.plist, Base.lproj/Main.storyboard
macOS (Extension)/   Info.plist
```

**Where the web extension lives.** With `--copy-resources` the 35 files are copied byte-for-byte into
`Shared (Extension)/Resources/` (`diff -rq` against the staged source: identical; manifest SHA-256 identical) and
added to both extension targets as *folder references* (`lastKnownFileType = folder`, paths `Resources/options`,
`Resources/popup`, `Resources/icons`, `Resources/rules`, `Resources/src`, plus the `manifest.json` file). Folder
references mean new files inside those folders ship without editing the project. In reference mode (run 3) the
`Shared (Extension)/Resources` folder is not created; the pbxproj points at the original tree with paths relative to
the `.xcodeproj` (e.g. `path = "../../../src-chrome/options"`), which is what makes a repo-relative layout possible
(§8).

**Container app, out of the box.** One `ViewController` shared by both platforms loads `Main.html` in a `WKWebView`
and calls `show('ios')` / `show('mac')`:

* iOS: a single sentence telling the user the extension can be turned on in Settings, plus the icon. No button, no
  link, nothing else.
* macOS: the page asks `SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier:)` and shows "currently
  on/off" text (wording switches from "Preferences" to "Settings" on macOS 13+), and a button that calls
  `SFSafariApplication.showPreferencesForExtension(withIdentifier:)` and then `NSApp.terminate(_:)`.
  `applicationShouldTerminateAfterLastWindowClosed` returns true.
* The extension's native side is `SafariWebExtensionHandler: NSExtensionRequestHandling`, which echoes any
  `browser.runtime.sendNativeMessage` payload back (`SFExtensionMessageKey`, `SFExtensionProfileKey`) and logs it
  with `os_log`. Nullecho does not use native messaging, so this can stay inert.
* The template stamps the macOS account's full name into every Swift file header (`// Created by …`). Strip those
  headers before anything is committed to the public repository.

**Info.plist keys.** Both app `Info.plist`s carry `SFSafariWebExtensionConverterVersion = 27.0`; the iOS app adds a
`UIApplicationSceneManifest`. Both extension `Info.plist`s carry
`NSExtension { NSExtensionPointIdentifier = com.apple.Safari.web-extension; NSExtensionPrincipalClass =
$(PRODUCT_MODULE_NAME).SafariWebExtensionHandler }`. Everything else is synthesized (`GENERATE_INFOPLIST_FILE = YES`
with `INFOPLIST_KEY_*` build settings: display names, iPhone + iPad orientation sets, `NSPrincipalClass`).

**Entitlements and signing settings.** No `.entitlements` files are generated. macOS targets set
`ENABLE_APP_SANDBOX = YES`, `ENABLE_HARDENED_RUNTIME = YES`, `ENABLE_USER_SELECTED_FILES = readonly` (Xcode
synthesizes the entitlements at signing time; the Mac App Store requires the sandbox entitlement — Apple,
"Configuring the macOS App Sandbox", fetched 2026-10-01:
https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox). iOS targets have no sandbox
settings (always sandboxed). `CODE_SIGN_STYLE = Automatic`, no `DEVELOPMENT_TEAM`, `SWIFT_VERSION = 5.0`,
`MARKETING_VERSION = 1.0`, `CURRENT_PROJECT_VERSION = 1` — the manifest's `0.9.1` is **not** propagated.
`TARGETED_DEVICE_FAMILY = "1,2"` (iPhone + iPad).

**Bundle identifiers.** App: `org.nullecho.safari` on *both* the iOS and macOS app targets; extension:
`org.nullecho.safari.Extension` on both. `ViewController.swift` hard-codes
`extensionBundleIdentifier = "org.nullecho.safari.Extension"`; if the ID is changed later this constant must change
too (an Apple engineer identified exactly this mismatch as the cause of an extension "missing" on App Review's Mac:
https://developer.apple.com/forums/thread/661604, 2020–2021).

**Minimum OS versions set by the template.** macOS 12.0 for app and extension (`LSMinimumSystemVersion` in both
built plists); iOS **17.0** for the app but **15.0** for the extension (`MinimumOSVersion` in the built plists).
Apple's troubleshooting page says app and extension deployment targets should match
(https://developer.apple.com/documentation/safariservices/troubleshooting-your-safari-web-extension). For phase 1
the floor should be the Safari version the manifest actually needs (18 for `world`, 18.4 if
`match_origin_as_fallback` is kept — iOS 18.4; on macOS Safari 18.4 also runs on the two previous macOS releases).

**Not generated:** `PrivacyInfo.xcprivacy` (none in sources or products), any privacy-policy link in `Main.html`,
`ITSAppUsesNonExemptEncryption`.

### 1.6 Unsigned builds

```
$ xcodebuild -project Nullecho.xcodeproj -scheme "Nullecho (macOS)" -configuration Debug \
    -derivedDataPath <scratch>/dd-macos CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
** BUILD SUCCEEDED **
$ xcodebuild -project Nullecho.xcodeproj -scheme "Nullecho (iOS)" -configuration Debug -sdk iphonesimulator \
    -destination "generic/platform=iOS Simulator" -derivedDataPath <scratch>/dd-ios \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
** BUILD SUCCEEDED **
```

Only diagnostics: two `appintentsmetadataprocessor … warning: Metadata extraction skipped, no AppIntents.framework
dependency found` per build. Products:

* macOS: `dd-macos/Build/Products/Debug/Nullecho.app` with `Contents/PlugIns/Nullecho Extension.appex/Contents/
  Resources/{icons,manifest.json,options,popup,rules,src}`; `codesign -dv` reports `Signature=adhoc`,
  `flags=0x20002(adhoc,linker-signed)`; `codesign -d --entitlements -` prints no entitlements (expected when
  signing is disabled). The app was **not** launched.
* iOS simulator: `dd-ios/Build/Products/Debug-iphonesimulator/Nullecho.app` with
  `PlugIns/Nullecho Extension.appex/{manifest.json,icons,options,popup,rules,src}`; `MinimumOSVersion 17.0`,
  `UIDeviceFamily [1,2]`, `DTPlatformVersion 27.0`. Not installed anywhere.

The Firefox-variant project (run 2) was not built separately: it differs only in the manifest's `background` and
`browser_specific_settings` keys, which do not affect the native build.

---

## 2. Distribution paths

Primary source unless noted: Apple, "Distributing your Safari web extension" (undated page, fetched 2026-10-01):
https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension — it lists macOS
app, visionOS app, iOS app and Mac Catalyst app as containers; says unsigned macOS extensions can be used for
development/beta but App Store distribution needs signing; iOS/visionOS unsigned only in the Simulator; suggests
selling the platforms together as one product; and has an explicit section on Developer ID + notarization outside
the Mac App Store.

| Path | Status / requirements | Fit for Nullecho |
|---|---|---|
| **Mac App Store + iOS App Store as one record (universal purchase)** | App Store Connect "Add platforms": a macOS version added to an iOS app record uses the same App ID, SKU and bundle ID, built from a separate Xcode target; separate existing records cannot be merged (https://developer.apple.com/help/app-store-connect/create-an-app-record/add-platforms/, fetched 2026-10-01). The generated project already shares `org.nullecho.safari` across the two app targets. Mac App Store additionally requires App Sandbox (template sets it). | Recommended for the store listing: one product page, one review queue. |
| **TestFlight (Mac + iOS)** | Supports iOS, iPadOS, macOS, tvOS, visionOS, watchOS; up to 100 internal testers (App Store Connect users) and 10,000 external; builds expire after 90 days; the first build sent to an external group goes through Beta App Review; Mac testers use the TestFlight app, builds from Xcode 13+ (https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/, fetched 2026-10-01). | Pre-release soak with real users on iPhone/iPad; internal testing needs no review. |
| **Developer ID + notarization, outside the Mac App Store (macOS only)** | Apple's distribution page allows it. WebKit: Safari 18.4 on macOS supports Developer ID-signed and notarized Safari Web Extensions (https://webkit.org/blog/16574/webkit-features-in-safari-18-4/, 2025-03-31). An Apple engineer told a developer on Safari 18.3 to update to 18.4 for exactly this (https://developer.apple.com/forums/thread/782005, April 2025). Notarization requirements: Developer ID Application certificate, hardened runtime, secure timestamp, no `get-task-allow`; the Organizer "Direct Distribution" flow or `notarytool` (https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution; https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases, both fetched 2026-10-01). On Safari ≤ 18.3 such a build is treated as unsigned. An older forum statement that web extensions require the Mac App Store (thread 661604, 2020) is superseded. | The GitHub-release path for macOS, consistent with `docs/PRELAUNCH-HARDENING.md` step 6. Users on Safari 27 (this machine) are well past 18.4. |
| **App Store Connect "Safari Web Extension Packager"** | Apple doc (fetched 2026-10-01): https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect — create an app record (platforms macOS, iOS or both; the iOS app also serves iPadOS and visionOS), open the **Xcode Cloud** tab, click Upload under Safari Web Extension Packager, upload the full extension contents including the manifest; status on the Builds page; multiple builds may be uploaded; packaging compute time is deducted from the 25 Xcode Cloud hours/month of the membership; then TestFlight and/or submit. WebKit 26.0 notes (2025-09-15) describe it as using Xcode Cloud to produce a signed app + extension bundle for macOS, iOS, iPadOS and visionOS (https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). WWDC26 session 216 demonstrates the flow and says packaging completes in minutes (https://developer.apple.com/videos/play/wwdc2026/216/). Documented limits: none beyond the above. Observed in the wild: a developer hit "Embedded binary's bundle identifier is not prefixed with the parent app's bundle identifier" and icon validation errors before getting it to work (https://developer.apple.com/forums/thread/802966, October 2025). **Unverified:** whether the generated container can carry a custom in-app privacy-policy link, custom text, or a custom 1024-px icon; what it does with manifest keys it dislikes beyond "reported exceptions". | Workable fallback for a maintainer without a Mac. For an open-source project that wants a build anyone can reproduce it is the wrong primary path: the native container is compiled by Apple from a template the project does not hold, so only the uploaded ZIP is auditable. Keep the Xcode project in-repo and build it from a tagged commit; the ZIP the packager would consume is the same artefact `package.mjs --safari` produces (§8), so both routes stay open. |
| Ad-hoc / registered devices (iOS) | Apple's distribution page allows a signed ad-hoc copy for testers; devices must be registered; Developer Mode on device. | Not needed; TestFlight internal testing is simpler. |
| "Copy App" unsigned macOS export | Apple's distribution page: for macOS beta testing, export without signing and have testers enable unsigned extensions. | Only for people willing to flip the developer switch every launch (§3). |

---

## 3. Easiest way for the owner to try a local build

None of these were performed here; they are the steps the owner would take. Nothing below requires giving anyone a
password; Safari's own authentication prompt appears in option A.

**A. No signing at all — Safari's temporary extension (macOS only, fastest).**
Source: Apple, "Running your Safari web extension" (fetched 2026-10-01):
https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension ; the same flow is shown
in WWDC26 session 216.
1. Produce the Safari resource folder or ZIP (today: the staged `src-chrome`-style copy with a Safari manifest;
   tomorrow: `package.mjs --safari`, §8).
2. Safari ▸ Settings ▸ Advanced ▸ enable "Show features for web developers".
3. Settings ▸ Developer ▸ tick "Allow unsigned extensions" (Safari asks for authentication). Apple's page states this
   setting resets when Safari quits.
4. Settings ▸ Developer ▸ "Add Temporary Extension…" ▸ pick the folder or ZIP. Safari switches to the Extensions
   tab and lists it under Temporary, with reload / show-in-Finder / uninstall controls.
5. Grant website access when the toolbar badge appears (§6). Apple's page: temporary extensions are removed after
   24 hours or when Safari quits.
Requires: Safari 26+ (the Developer-tab flow is documented for Safari 17+; the temporary-extension button is
documented on the current page and demonstrated for Safari 26/27). No Xcode project, no certificates. Not available
on iPhone/iPad.

**B. Signed development build through Xcode with his existing team (Mac + iPhone/iPad, best for daily work).**
Sources: Apple "Running your Safari web extension" (above); Apple "Distributing your app to registered devices"
(automatic signing / Register Device): https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices.
1. Generate the project once (`xcrun safari-web-extension-packager <folder> --project-location safari/xcode
   --app-name Nullecho --bundle-identifier <his real reverse-DNS id> --swift`), or open the one in scratch.
2. In Xcode, select the project ▸ each of the four targets ▸ Signing & Capabilities ▸ "Automatically manage
   signing" on ▸ pick his team. (His Apple Developer account must already be listed in Xcode ▸ Settings ▸
   Accounts; adding it is his action, not the agent's.)
3. Scheme "Nullecho (macOS)" ▸ Product ▸ Run. The container window opens; click the button to open Safari's
   Extensions settings; tick Nullecho. Because the build is signed with a development certificate, "Allow unsigned
   extensions" is not needed (Apple's page: Safari ignores *unsigned* extensions by default).
4. For iPhone/iPad: connect the device, choose it as run destination, Product ▸ Run (Xcode registers the device if
   needed; Developer Mode must be on). Then Safari ▸ page menu ▸ Manage Extensions, or Settings ▸ Apps ▸ Safari ▸
   Extensions (Apple's page still writes "Settings ▸ Safari ▸ Extensions"; the "Apps" level is the iOS 18+ layout,
   reported by secondary sources — **unverified** on iOS 27 here).
5. Rebuild = Product ▸ Build (macOS) / Run (iOS); Safari picks up the new appex.
Requires: Apple Developer Program membership for on-device iOS testing (Apple's page: simulators work without it).

**C. TestFlight (closest to what users get; needed for any iPhone tester other than himself).**
Sources: TestFlight overview and Xcode distribution pages cited in §2.
1. Create the App Store Connect record (iOS + macOS platforms, his bundle ID).
2. Product ▸ Archive for the iOS scheme and for the macOS scheme; Organizer ▸ Distribute App ▸ "TestFlight
   Internal Only" ▸ upload. Answer the export-compliance question once or set `ITSAppUsesNonExemptEncryption = NO`
   (§5).
3. In App Store Connect ▸ TestFlight, add himself (and up to 99 other team users) as internal testers — no Beta App
   Review for internal groups. Install the TestFlight app on the Mac and iPhone and accept the build.
4. Builds expire after 90 days; external groups trigger Beta App Review on their first build.

**D. Developer ID + notarization (macOS release outside the store, Safari 18.4+).**
1. Archive the macOS scheme ▸ Distribute App ▸ "Direct Distribution" ▸ notarize ▸ export the `.app`.
2. Run the app once; Nullecho appears in Safari ▸ Settings ▸ Extensions and can be enabled without any developer
   switch (WebKit 18.4 notes; forum 782005).
3. Publish the notarized `.app` (zip or dmg) on GitHub Releases next to the Chrome/Firefox zips.

Recommendation: A today (zero setup, verifies the manifest and GPC behaviour in Safari 27), B for development,
C before launch, D plus the App Store record for release.

---

## 4. App Store Review Guidelines that bear on this app

Page: https://developer.apple.com/app-store/review/guidelines/ (fetched 2026-10-01; the page shows no "last
updated" date; Apple's news post of 2026-06-08 lists the most recent revisions — Introduction, 1.2, 4.3(a), 4.3(b),
4.5.3: https://developer.apple.com/news/?id=a233fmpw). Text below is paraphrased with section numbers; read the
clauses at the link. One direct quotation, from 4.4.2: "Safari extensions should not claim access to more websites
than strictly necessary" (Apple, App Store Review Guidelines §4.4.2).

| Clause | What it requires (paraphrase) | Nullecho exposure | Risk |
|---|---|---|---|
| 4.4 Extensions | Apps hosting extensions must follow the Safari web extensions documentation and should include some functionality such as help screens and settings interfaces where possible. | The template container is a help screen; adding status + settings link + policy link satisfies the letter. | Medium |
| 4.4.2 Safari extensions | Must run on the current Safari for the relevant OS; may not interfere with system/Safari UI; must never include malicious or misleading content or code (violation = removal from the Developer Program); should not claim more website access than strictly necessary. | `<all_urls>` is needed because GPC is a per-request header and blocking is global; say so in the review notes and listing. Keep every claim provable. | **High** (it is the clause written for this exact app type) |
| 4.2 Minimum functionality, 4.2.2 | Apps must offer more than a repackaged website; shouldn't be mainly marketing material or a collection of links. | A single instruction page is thin. Apple's own packager (CLI and App Store Connect) ships exactly this page, and the store has an "Extensions" category for such apps (https://developer.apple.com/safari/extensions/submission), which is the strongest evidence that an instruction-only container passes — but no written Apple exemption exists and I found no public 4.2 decision either way for an extension container. | Medium |
| 2.3.1 Accurate metadata | No hidden features; describe changes specifically in Notes for Review; misleading marketing (Apple's example: iOS virus scanners) is grounds for removal and account termination. | Privacy-tool copy is the classic trigger. Use the repo's existing copy rules ("asks sites not to sell…", never "stops tracking"). | Medium |
| 2.3.7 Metadata | Unique name, accurate keywords, no trademarked terms to game search, no unverifiable product claims in subtitles. | "Nullecho" alone is safest; "… for Safari" is common on the store but a 2024 case shows "for <Platform>" names can draw a 2.3.7 (https://developer.apple.com/forums/thread/768704). | Low–Medium |
| 5.1.1(i) Privacy policies | Policy link in App Store Connect metadata **and** inside the app, easily accessible; the policy must say what is collected (if anything), how, uses, third-party sharing, retention/deletion, consent withdrawal. | Add a link to https://nullecho.org/privacy/ in `Main.html`; extend the policy with an Apple/Safari paragraph (§5). | Medium (easy fix) |
| 5.1.1(ii)–(iv), 5.1.2 | Consent for any collection; data minimisation; respect permission settings; no sharing without permission. | Nothing is collected; permission minimisation is argued in `ext/PERMISSIONS.md`. | Low |
| 2.4.1 Hardware compatibility | iPhone apps should run on iPad whenever possible. | The template is a universal (iPhone + iPad) app; the WKWebView page must look intentional on iPad. Secondary reports say reviewers often test on iPad; Apple's own statement to that effect was not found — **unverified**. | Low–Medium |
| 2.1 App completeness | Final build, no placeholder text, working URLs, tested on device; explain anything non-obvious in review notes. | Replace the template sentences; state in review notes how to enable the extension and grant access. | Low |
| 2.5.1 / 2.5.2 | Public APIs only, current OS; no downloading/executing code that changes functionality. | Static rule lists bundled; no remote code; `update_url` unsupported anyway. | Low |
| 4.3 Spam (revised 2026-06-08) | New examples of low-value/duplicate submissions. | Not a template clone; one listing. | Low |

Real-world reports found (secondary sources; none is a 4.2 rejection of an extension container):

* Malwarebytes Browser Guard for Safari, July 2021: rejected on the grounds that such software is only accepted
  from reputable companies; approved on appeal within days (https://mjtsai.com/blog/2021/07/30/safari-extension-rejected-because-developer-not-reputable/).
* Reddit Enhancement Suite, 2021: first rejection over use of the word "reddit" (resolved by sending the licence),
  second over a missing icon size (https://medium.com/@honestbleeps/what-apple-gives-you-for-100-as-a-safari-extension-developer-and-why-reddit-enhancement-suite-6e2d829c2e52).
* "Protego for Reddit", Nov 2024: 2.3.7 for "for Reddit" in the name; outcome not recorded in the thread
  (https://developer.apple.com/forums/thread/768704).
* Extension not visible on the reviewer's Mac, 2020–21: cause was a bundle-ID change not mirrored in
  `ViewController` (https://developer.apple.com/forums/thread/661604).
* An iPhone-only app rejected for misbehaving on iPad, July 2023 (https://developer.apple.com/forums/thread/734752) —
  general, not extension-specific.

Not found despite targeted searches: any published rejection of a Safari-extension container under 4.2/4.2.2.
Treat that as absence of evidence, not evidence of absence.

---

## 5. Privacy nutrition label, policy, privacy manifest, export compliance

**What to declare.** Apple's App Privacy Details page defines "collect" as transmitting data off the device so that
the developer or partners can access it beyond servicing the request, and says data processed only on-device is not
collected and need not be disclosed (https://developer.apple.com/app-store/app-privacy-details/, fetched
2026-10-01). App Store Connect lets you answer "No, we do not collect data from this app" only when neither you nor
third parties collect anything, after which no further questions are asked; answers are app-level and must hold on
every platform (https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy,
fetched 2026-10-01). Nullecho's extension has no network endpoint (the repo's privacy page and
`ext/src/manifest.test.js` enforce that only two bundled-file `fetch(chrome.runtime.getURL(...))` calls exist), and
the template container makes no network calls. Declaration: **Data Not Collected** on both platforms. Keep it true:
no analytics SDK, no crash reporter, no update pings in the container.

**Privacy policy URL — still mandatory.** App Store Connect: a privacy policy URL is required for the iOS platform
(same help page; the App Privacy Details page lists Privacy Policy as required and Privacy Choices as optional).
Guideline 5.1.1(i) additionally wants it reachable inside the app. Existing asset: `ext/manifest.json`
`homepage_url` = https://nullecho.org ; the policy is `site/privacy/index.html`, live at
https://nullecho.org/privacy/ (HTTP 200 on 2026-10-01, title "Nullecho — privacy policy", effective 2026-09-19;
`/privacy` without slash also 200). Gaps to close before submission: the policy speaks of Chrome and Firefox
deleting `storage.local` on uninstall — add that on Apple platforms the data lives in the extension's container and
is removed when the app is deleted; state that the container app itself collects nothing; keep the "website is hosted
by someone else who keeps server logs" paragraph (it is the honest part Apple's reviewers like to see). Put the link
in `Main.html` on both platforms.

**Privacy manifest (`PrivacyInfo.xcprivacy`).** Apple's rules (all fetched 2026-10-01):
privacy manifests describe collected data types and required-reason API use
(https://developer.apple.com/documentation/bundleresources/privacy-manifest-files); since 2024-05-01 App Store
Connect rejects apps that use a required-reason API without declaring a reason
(https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api); since
2025-02-12 listed third-party SDKs must ship valid manifests, and invalid manifests are rejected
(https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk).
The generated container links only Apple frameworks (WebKit, SafariServices, UIKit/AppKit), contains no third-party
SDK, and its Swift sources (read in full) use none of the required-reason API categories (no `UserDefaults`, file
timestamps, boot time, disk space or keyboard APIs). The extension's JavaScript `storage.local` is a WebExtension API
implemented by Safari, not a required-reason API call in the app's code. Therefore a manifest is **not mandated**;
recommendation: add one to each app target anyway with `NSPrivacyTracking = false`, empty `NSPrivacyTrackingDomains`,
empty `NSPrivacyCollectedDataTypes`, empty `NSPrivacyAccessedAPITypes` — valid, matches the label, and Xcode's
"Generate Privacy Report" on the archive then shows an empty report to attach to the review notes. Location is
handled by Xcode (iOS: bundle root; macOS: `Contents/Resources`). Re-check the moment any native code is added.

**Export compliance.** Apple: set `ITSAppUsesNonExemptEncryption` to `NO` when the app uses no encryption or only
exempt encryption such as OS-provided HTTPS; the key removes the per-upload questionnaire
(https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations and
https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption;
App Store Connect's export-compliance overview says to put it in Info.plist for the no-documentation case:
https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance). Nullecho
implements no cryptography and opens no connections → `NO` in both app Info.plists (build setting
`INFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO`).

**Age rating.** Apple's news feed states that from September 2026 answers to the age-rating questionnaire are
required for new apps and updates (reported via search results; **unverified** against the primary page).

---

## 6. Safari's permission UX for `<all_urls>` and what it means for copy

Primary: Apple, "Managing Safari web extension permissions" (fetched 2026-10-01):
https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions. Paraphrased:
when the user visits a page the extension has not been granted, Safari badges the extension's toolbar item; on
macOS the user clicks it and chooses to allow for one use, for the day, or for all websites, or to deny; on iOS the
user opens the More (page) menu, selects the extension and picks an option. Later management: macOS Safari ▸
Settings ▸ Extensions (summary) and the Websites tab per extension with Ask / Allow / Deny; iOS Settings ▸ Safari ▸
Extensions ▸ extension ▸ per-site Ask / Allow / Deny. Since Safari 17 a grant applies across profiles and private
browsing. Apple asks developers to prefer `activeTab`, host patterns or `optional_permissions`, and to use
`<all_urls>` only when there is no other option.

MDN BCD notes (webextensions/api/permissions.json, `permissions.request`, Safari): requesting `<all_urls>` grants
the right to request specific origins and makes Safari prompt automatically for every visited website through the
toolbar access popover (macOS) or the banner (iOS); `manifest.content_scripts` note: content scripts are not applied
until the user grants access.

Exact dialog strings: Apple's user-facing guides fetched (Mac: https://support.apple.com/en-us/HT202447, updated
2026-09-14) only describe "Edit Websites" with allow/deny/ask; the button labels "Allow for One Day", "Always Allow
on This Website", "Always Allow on Every Website…" and the sensitive-information warning appear only in third-party
support pages (e.g. 1Password, Okta, iDownloadBlog) — **unverified wording**; I could not locate them in Safari 27's
localized resources on this Mac.

Consequences for Nullecho (all follow from the sources above plus §0.1):

* Blocking via DNR works as soon as the extension is enabled (no per-site grant needed for `block` rules — the
  `declarativeNetRequest` permission suffices; this is also how Chrome behaves).
* The `Sec-GPC` header is only added on sites the user has granted (WebKit 16.4 note on `modifyHeaders`), and the
  MAIN-world `gpc.js` content script only runs on granted sites (BCD note). A GPC signal that is sent to some sites
  is still honest, but the onboarding must say plainly: to send GPC everywhere, choose "always allow on every
  website" (macOS: Safari ▸ Settings ▸ Extensions ▸ Nullecho; iOS: Settings ▸ (Apps ▸) Safari ▸ Extensions ▸
  Nullecho ▸ Other Websites ▸ Allow), and why: GPC is a per-request header, nothing leaves the device.
* Store listing and review notes should pre-empt 4.4.2: "requests access to all websites because it sends the GPC
  header on every request and blocks listed trackers; it has no server and sends nothing to us."
* iOS has no toolbar button; the popup lives behind the page menu. The container app's text must show that path.
* The popup's per-site counts come from `getMatchedRules` (Safari 15.4+), never from `onRuleMatchedDebug`.

---

## 7. Content Blocker extension vs. Safari web extension + DNR (docs level)

How Safari runs DNR today (WebKit `main`, fetched 2026-10-01): extension DNR rules are translated to WebKit's
content-rule-list JSON by `_WKWebExtensionDeclarativeNetRequestTranslator.mm` /
`-[_WKWebExtensionDeclarativeNetRequestRule ruleInWebKitFormat]` — `allow` and `allowAllRequests` →
`ignore-following-rules`, `block` → `block`, `modifyHeaders` → `modify-headers`, `redirect` → `redirect`,
`upgradeScheme` → `make-https`; conditions become `url-filter`, `if-domain`/`unless-domain`, `load-type`,
`resource-type`, `if-top-url`, `load-context`; each `excludedRequestDomains` entry becomes an extra
`ignore-following-rules` rule — and compiled with `API::ContentRuleListStore::compileContentRuleListFile(...,
CSSSelectorsAllowed::No)` (`WebExtensionContextCocoa.mm`, ~line 3555). In other words both extension types end up in
the same compiled content-rule engine.

| Aspect | Safari web extension + `declarativeNetRequest` | Native Content Blocker (`SFContentBlockerRequestHandler`, `WKContentRuleList` JSON) |
|---|---|---|
| Can set request headers (`Sec-GPC`) | Yes: `modifyHeaders` (Safari 16.4+), header must be on WebKit's allow-list (`sec-gpc` is), needs `declarativeNetRequestWithHostAccess` and granted website access (https://webkit.org/blog/13966/webkit-features-in-safari-16-4/, 2023-03-27; WebKit source above). | No. Apple's documented action types are `block`, `block-cookies`, `css-display-none`, `ignore-previous-rules`, `make-https` (https://developer.apple.com/documentation/safariservices/creating-a-content-blocker, fetched 2026-10-01). WebCore's parser also knows `modify-headers`/`redirect`/`ignore-following-rules`, but they are not in the Content Blocker documentation — **unverified/unsupported** for that extension type. |
| Can set `navigator.globalPrivacyControl` | Yes, content script (`world: MAIN`, Safari 18+ per BCD). Safari does not expose the property natively (BCD api.Navigator.globalPrivacyControl safari=false; WebKit bug 317873, 2026-06, is about hiding it when a feature flag is off — **unverified** whether a flag exists). | No JavaScript at all (Apple: content blockers have no knowledge of history or visited sites). |
| What the user sees | Enable in Extensions settings **plus** per-site access prompts for `<all_urls>` (§6), including a strong wording about reading page content. | Enable toggle only; no website-access prompt, because the blocker never sees page content or URLs. |
| Rule limits | Static: up to 100 rulesets, 50 enabled (`WebExtensionConstants.h`, WebKit `main`); dynamic+session 30,000 on `main` (Safari 16.4 shipped 5,000 — version of the increase **unverified**); the compiled list is bounded by WebCore's `maxRuleCount = 150000` (`ContentExtensionParser.cpp`). Nullecho's five phase-1 lists total 176 rules (+~50 generated exclusions). | 150,000 rules per blocker (same WebCore constant; AdGuard's KB documents the 50k→150k change — secondary). Multiple blocker extensions can be shipped in one app. |
| Performance | Compiled bytecode; a `WKContentRuleList` per extension; no JS on the request path. | Same engine; Apple: rules compiled, Safari never consults the app during loads. |
| Stats / feedback | `declarativeNetRequestFeedback` + `getMatchedRules` (15.4+) for counts. | None. |
| iOS / iPadOS | Yes (iOS 15+). | Yes (iOS 9+; `SFContentBlockerManager` platforms: iOS 9, macOS 10.12, visionOS 1). |
| Review surface | One extension target per platform; 4.4.2 host-access justification required. | Additional target per platform; no host permissions to justify. |

Verdict for phase 1: the two GPC halves are only possible as a web extension, so the web extension is mandatory.
Tracker blocking can live in the same DNR rulesets at no extra permission cost (block rules don't need site grants).
A separate Content Blocker target would give users a "blocking only, zero website access" mode and a cleaner privacy
story for that half, at the price of a second extension to review and maintain and no per-site counts. Reasonable as
a phase-2 option, not as phase-1 scope.

---

## 8. Proposal: a `--safari` target in `ext/tools/package.mjs` (not implemented here)

What the script already does (read in full): picks `manifest.firefox.json` or `manifest.json`, derives the file set
by closing over everything the manifest references (background worker, content scripts, popup/options HTML and
their assets, icons, rule resources, `runtime.getURL(...)` strings), refuses tests/tools/READMEs, and in zip mode
stages into `dist/.stage-*`, writes `dist/nullecho-<version>-<chrome|firefox>.zip` with the chosen manifest renamed
to `manifest.json`, lists the zip, then deletes the stage. `dist/` is gitignored.

Proposed change, kept orthogonal to the existing two outputs:

1. Add `const SAFARI = argv.includes('--safari')` next to `FIREFOX`; `manifestFile = SAFARI ? 'manifest.safari.json'
   : FIREFOX ? 'manifest.firefox.json' : 'manifest.json'`; zip name suffix `safari`. `--list` keeps working and
   becomes the audit of what the Safari manifest actually reaches (the closure automatically drops `shim.js`,
   `shim-loader.js`, `pricing*.js`, `personas.js`, `linux-ground-truth.js` and the `ua-*.json` files the moment the
   Safari manifest stops naming them — no allowlist needed).
2. For `--safari` only, additionally leave the staged tree at `dist/safari/` (e.g. `--keep-stage` implied by
   `--safari`), because every Apple entry point wants a *folder or ZIP*: `xcrun safari-web-extension-packager
   dist/safari …`, Safari ▸ Developer ▸ "Add Temporary Extension…", and the App Store Connect packager (ZIP). The
   zip root stays the extension root exactly as for the other stores.
3. Keep the Xcode project in the repo at `safari/xcode/` generated **once** in reference mode (no
   `--copy-resources`), pointing at `dist/safari` — reference mode stores project-relative paths
   (`../../../src-chrome/options` in run 3), so from `safari/xcode/Nullecho/Nullecho.xcodeproj` the references become
   `../../../dist/safari/...`. Build order is then `node ext/tools/package.mjs --safari && xcodebuild …`. Source of
   truth remains `ext/`; the project never holds a second copy. (Alternative: `--copy-resources` into a gitignored
   `safari/xcode/Nullecho/Shared (Extension)/Resources`; same effect, one more path to document.)
4. Version plumbing: the template's `MARKETING_VERSION = 1.0` / `CURRENT_PROJECT_VERSION = 1` ignore the manifest.
   Have the Safari step print the manifest version and build with
   `xcodebuild … MARKETING_VERSION=<manifest.version> CURRENT_PROJECT_VERSION=<n>` (or `agvtool`), so App Store
   versions track `manifest.safari.json`.
5. `manifest.safari.json` — start from `manifest.json` (service-worker form, not the Firefox `scripts` form, which
   triggers the iOS persistent-page warning) and change:
   * remove `minimum_chrome_version` (ignored by Safari anyway); add
     `browser_specific_settings: { safari: { strict_min_version: "18.4" } }` (floor for `match_origin_as_fallback`
     and the webRequest events; use "18" if `match_origin_as_fallback` is dropped) — Safari honours
     `strict_min_version` per BCD;
   * `permissions`: keep `declarativeNetRequest`, `declarativeNetRequestFeedback`, `storage`, `alarms`; **add**
     `declarativeNetRequestWithHostAccess` (required for `modifyHeaders`, i.e. for `rules/gpc.json`); **drop**
     `webRequest` (out of phase-1 scope, cookie headers invisible in Safari, iOS support contested) — note
     `background.js` statically imports `heuristics.js`, so dropping the permission is a packaging change but the
     import is a code change the Safari build must make (otherwise the file still ships and the listener registration
     must be guarded);
   * `host_permissions: ["<all_urls>"]` stays (GPC needs every site; see §6 for the copy that must accompany it);
   * `declarative_net_request.rule_resources`: keep `ads`, `analytics`, `social`, `fingerprinting`, `gpc`; drop
     `ua-win`/`ua-mac`/`ua-linux` — and remove or guard the `updateStaticRules` / `getDisabledRuleIds` calls in
     `background.js`, which Safari does not implement;
   * `content_scripts`: keep only the `src/gpc.js` entry (`world: "MAIN"`, `run_at: document_start`,
     `all_frames: true`, the `exclude_matches` list); delete the `shim-loader.js`, `shim.js` and `pricing*.js`
     entries. `gpc.js`'s own header says the `navigator` property has been installed by `shim.js` since D46 with
     `gpc.js` as fallback — on Safari the fallback becomes the only installer, so its masking/ordering caveats
     (documented in the file) apply unchanged;
   * `background`: keep `service_worker` + `type: "module"` (BCD: 15.4 / 16.4) despite the converter's stale warning;
   * `options_ui.open_in_tab`, `homepage_url`, `content_security_policy.extension_pages`, `icons`, `action`: unchanged
     (Safari opens options in a tab regardless; `homepage_url` is accepted but not shown);
   * icons: the packager derives the app icon from `icons/icon-128.png` and upsamples it to the 1024-px App Store
     icon — supply a real 1024-px asset in `safari/xcode/.../AppIcon.appiconset` (whether App Store Connect rejects an
     upscaled icon is **unverified**; forum 802966 mentions icon validation errors with the web packager).
6. Container-app additions that belong in `safari/xcode/` (not in `ext/`): a privacy-policy link and a two-line
   "what it does / honest limits" paragraph in `Main.html` (5.1.1(i), 4.4, 2.3.1); `ITSAppUsesNonExemptEncryption =
   NO`; an empty-declaration `PrivacyInfo.xcprivacy` per app target; matching deployment targets; stripped
   `// Created by` headers.
7. CI: `npm run package:safari` → `xcodebuild -scheme "Nullecho (macOS)" CODE_SIGNING_ALLOWED=NO build` and
   `-scheme "Nullecho (iOS)" -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' …` exactly as in §1.6
   proves the project still compiles on every PR without any signing material in CI.

Chrome and Firefox outputs are untouched by all of the above: the only shared code path is the manifest-driven
closure, which is what makes the three outputs consistent.

---

## Appendix A — evidence index (all fetched 2026-10-01)

Apple documentation: packaging a web extension (https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari);
running (https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension);
distributing (https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension);
App Store Connect packager (https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect);
browser compatibility (https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility);
permissions (https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions);
troubleshooting (https://developer.apple.com/documentation/safariservices/troubleshooting-your-safari-web-extension);
content blockers (https://developer.apple.com/documentation/safariservices/creating-a-content-blocker);
`SFContentBlockerManager` (https://developer.apple.com/documentation/safariservices/sfcontentblockermanager);
`showPreferencesForExtension` (https://developer.apple.com/documentation/safariservices/sfsafariapplication/showpreferencesforextension(withidentifier:completionhandler:));
privacy manifests (three pages under https://developer.apple.com/documentation/bundleresources/privacy-manifest-files);
encryption export (https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations);
notarization (https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution);
Xcode distribution (https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases);
App Sandbox (https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox);
App Review Guidelines (https://developer.apple.com/app-store/review/guidelines/); guideline-update news 2026-06-08
(https://developer.apple.com/news/?id=a233fmpw); App Privacy Details (https://developer.apple.com/app-store/app-privacy-details/);
App Store Connect Help: add platforms, manage app privacy, export compliance, TestFlight overview (URLs in §2/§5);
Safari extensions submission page (https://developer.apple.com/safari/extensions/submission);
WWDC26 session 216 (https://developer.apple.com/videos/play/wwdc2026/216/).

WebKit: release notes 16.4 (2023-03-27), 18.0 (2024-09-16), 18.4 (2025-03-31), 26.0 (2025-09-15), 27.0
(2026-09-17: https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ — Web Extensions section lists
`runtime.getDocumentId()`, exception reporting, user-gesture propagation, `windows.create` `tabId`; nothing about DNR
or `world`); sources on `main`: `_WKWebExtensionDeclarativeNetRequestRule.mm` (allow-list at lines ~611–695,
`sec-gpc` at line 674; last commits 2026-09-09, 2026-07-01), `_WKWebExtensionDeclarativeNetRequestTranslator.mm`,
`WebExtensionContextCocoa.mm`, `WebExtension.cpp`, `Shared/Extensions/WebExtensionConstants.h`,
`WebCore/contentextensions/ContentExtensionParser.cpp`; bugs 290922 (custom header names, NEW, acknowledged
2025-06-13), 315806, 317873.

Secondary (used only where marked): w3c/webextensions#372; Apple developer forums 661604, 733791, 760969, 768704,
782005, 802966, 806726, 734752; mjtsai.com 2021-07-30; victorwynne.com 2025-09-15; stefanvd.net 2026-02-01;
lapcatsoftware.com 2026-01-05; iDownloadBlog 2023-10-04; Okta and 1Password support pages; AdGuard KB.

MDN browser-compat-data (`main`, raw JSON): webextensions/api/{declarativeNetRequest,webRequest,scripting,
permissions,storage,alarms,runtime}.json, webextensions/manifest/{content_scripts,background,options_ui,permissions,
host_permissions,declarative_net_request,browser_specific_settings,homepage_url,content_security_policy,
web_accessible_resources}.json, api/Navigator.json.

## Appendix B — scratch artefacts (outside the repo)

`<scratch>` = the agent session's scratchpad directory (a per-session folder under the system temp area, not in the
repo), subfolder `a3-packaging/` — `src-chrome/`, `src-firefox/` (staged inputs), `proj-chrome/`, `proj-firefox/`,
`proj-chrome-ref/` (generated projects), `converter-*.log`, `build-macos.log`, `build-ios.log`, `dd-macos/`,
`dd-ios/` (DerivedData), `bcd/` (compat JSON + `summary.txt`), `webkit/` (fetched sources), `docs/` (fetched
Apple/WebKit text). These are disposable; everything load-bearing is reproduced above.

## Appendix C — explicitly unverified

Runtime behaviour of `Sec-GPC` injection and `world: MAIN` in Safari 27 (no Safari run); `webRequest` on iOS;
exact permission-dialog strings; App Store Connect packager limits beyond Apple's page; whether App Review tests on
iPad as policy; the Safari version in which the dynamic-rule limit rose from 5,000 to 30,000; the September-2026
age-rating gate.
