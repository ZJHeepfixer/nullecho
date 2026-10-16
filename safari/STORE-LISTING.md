# Nullecho for Safari — App Store listing (version 0.9.2, first Safari release)

Prepared 2026-10-15 for App Store Connect, field by field, in the order App Store Connect asks for them. Every
limit quoted below was read on Apple's pages on **2026-10-15** (URLs in §0); anything Apple's pages did not
settle is marked **unverified**. Every claim in the copy is mapped to the in-app sentence or audit section that
supports it in §9, and the copy was checked against the banned phrases in `docs/THREAT-MODEL.md` and the tip-jar
wording rules in `audit/05-tip-jar-rules.md` §5 (no "protects you from fingerprinting", "stops", "blocks all",
"anonymous", "lower prices", "donate" or any cause wording). The product name is always "Nullecho"; "nah." is
a slogan, never the name (`brand/BRAND.md`).

Character counts are given next to each field. They were measured with Python on the exact strings below
(`len()` for characters, UTF-8 `len()` for bytes where Apple states a byte limit).

Things only the owner can decide are marked **OWNER**. Nothing here was entered into App Store Connect.

---

## 0. Apple pages this listing relies on (all fetched 2026-10-15)

| Topic | Page | What it settles |
|---|---|---|
| Name, subtitle, privacy policy URL, categories, age rating as app-level properties | https://developer.apple.com/help/app-store-connect/reference/app-information | Name "at least two characters and no more than 30 characters"; subtitle "can't be longer than 30 characters"; privacy policy URL "Required for iOS and macOS apps"; bundle ID must match Xcode and cannot change after a build is uploaded; SKU letters/numbers/hyphens/periods/underscores, not editable later |
| Promotional text, description, keywords, URLs, copyright, What's New, review notes | https://developer.apple.com/help/app-store-connect/reference/platform-version-information | Promotional text "can't be longer than 170 characters"; description "Limited to 4000 characters", plain text, no HTML; keywords "up to 100 bytes", each keyword "greater than two characters", do not repeat the app or company name, no other apps' or companies' names; support URL required and must lead to real contact information; marketing URL optional; copyright required, "year followed by the owner", © added automatically; What's New "Limited to 4000 characters", **"Required for all versions after the first, and not available for the first version"**; App Review notes "up to 4000 bytes"; sign-in information required only if the app needs a login |
| Screenshots | https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications | At least one screenshot, up to 10 per device size, `.jpeg`/`.jpg`/`.png`, "Images can't include alpha channels or transparencies." Required sizes: iPhone "At least one screenshot for iPhone with Dynamic Island (medium display)" (1179×2556 or 1206×2622); iPad "At least one screenshot for iPad 13-inch display" (2064×2752 or 2048×2732); Mac "Required for Mac apps", one of 1280×800, 1440×900, 2560×1600, 2880×1800. The large-display iPhone sizes (1260×2736, 1290×2796, 1320×2868) are accepted but no longer the required set. "If your app's user interface is consistent across multiple device sizes and localizations, you only need to provide screenshots for the highest required resolution." |
| In-app purchase fields | https://developer.apple.com/help/app-store-connect/reference/in-app-purchase-information/ | Reference name ≤ 64; product ID ≤ 100, not editable or reusable after saving; display name 2–30; description ≤ 45; review notes ≤ 4000; review screenshot required, review-only; "You need separate identifiers for In-App Purchases in your iOS apps and your macOS apps" (only relevant if the Mac build gets its own app record) |
| App Privacy answers | https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy | "No, we do not collect data from this app" ends the questionnaire; answers are app-level across platforms; "You're responsible for keeping your responses accurate and up to date." |
| App privacy definitions | https://developer.apple.com/app-store/app-privacy-details/ (read in `audit/05-tip-jar-rules.md` §1, fetched 2026-10-07) | "Collect" = transmitting off the device; on-device processing is not collection; "You are not responsible for disclosing data collected by Apple." |
| Age ratings | https://developer.apple.com/help/app-store-connect/reference/age-ratings and https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating | Tiers 4+, 9+, 13+, 16+, 18+ (plus Unrated, not publishable); content items answered NONE / INFREQUENT / FREQUENT, capability items Yes/No; "An age rating is a required app information property." |
| Age-rating timing | https://developer.apple.com/news/upcoming-requirements/ | "Since January 31, 2026": all ratings were moved to the new system and the updated questions must be answered to submit updates. **No September 2026 age-rating item appears on Apple's pages as of 2026-10-15**; the brief's "September 2026 changes" could not be found and is treated as unverified. |
| Categories | https://developer.apple.com/app-store/categories/ | Utilities: "Apps that enable the user to solve a problem or complete a specific task." **Safari Extensions** is a listed category: "Apps that offer extensions to help enhance and customize the web browsing experience on Safari", examples "content bookmarkers, password managers, adblockers, savings finders". Platform availability of that category is not stated on the page. |
| Pricing | https://developer.apple.com/help/app-store-connect/manage-app-pricing/set-a-price | Without the Paid Apps Agreement "you can only offer your app for free"; the agreement is required "In order to offer paid content on the App Store"; roles Account Holder, Admin, App Manager |
| Availability | https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store | "All Countries or Regions" = all 175, including ones added later; or "Specific Countries or Regions"; availability must be set before submitting for review |
| EU Digital Services Act | https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements and the upcoming-requirements page | Trader status must be declared; for an individual trader, an address or P.O. box, phone number and email are published on the EU product page; "Since February 17, 2025" apps without trader status are removed from the App Store in the EU |
| Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ (page carries no revision date; Apple's latest revision notice is the news item of 2026-06-08) | 2.3.1 "Don't include any hidden, dormant, or undocumented features in your app"; 2.3.3 "Screenshots should show the app in use"; 2.3.7 "App names must be limited to 30 characters", keywords must accurately describe the app; 3.1.1 "Apps may use in-app purchase currencies to enable customers to 'tip' the developer"; 4.4.2 Safari extensions must run on the current Safari and "should not claim access to more websites than strictly necessary" (quoted in `audit/03-packaging.md` §4); 5.1.1(i) privacy policy link in the metadata "and within the app in an easily accessible manner" |
| Export compliance | https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption (read in `audit/03-packaging.md` §5, fetched 2026-10-01) | `ITSAppUsesNonExemptEncryption = NO` removes the per-upload questionnaire |

---

## 1. App record (App Information)

| Field | Value | Notes |
|---|---|---|
| **Name** | `Nullecho` | 8 characters (limit 30). Not "Nullecho for Safari": "for <Platform>" names have drawn 2.3.7 rejections (`audit/03-packaging.md` §4). The in-app heading "Nullecho for Safari" is fine; the store name is the product name. |
| **Subtitle** | `Block known trackers in Safari` | 30 characters (limit 30). "Known" is load-bearing: the extension blocks requests to domains on its bundled lists, nothing more. Alternative if a shorter line is wanted: `Tracker blocker for Safari` (26). |
| **Bundle ID** | `org.nullecho.app` | From `safari/xcode/Nullecho.xcodeproj` (app) with `org.nullecho.app.extension` for the extension. **OWNER**: the project README calls these working values; they must be final before the first upload because the bundle ID "Cannot be changed after you upload a build." The same ID on iOS and macOS lets one app record carry both (universal purchase). |
| **SKU** | `nullecho-safari` | Suggested. Letters, numbers and hyphens only; not visible to customers; cannot be changed after the app is added. |
| **Primary language** | English (U.S.) | Store text below uses US spellings ("honored", "license") per the director's call of 2026-10-15; the in-app copy stays British. The owner can switch to English (U.K.) in his chat. |
| **Primary category** | Utilities | Apple's definition ("solve a problem or complete a specific task", examples include web browsing) covers a tracker blocker, and it is the category the brief chose. **OWNER, recommended alternative:** Apple's category page also lists **Safari Extensions** ("adblockers" are its example); if App Store Connect offers it for this record, it is the closest fit. The page does not say which platforms get it (unverified). |
| **Secondary category** | Productivity (optional) | Or Utilities if Safari Extensions becomes primary. Secondary is optional in practice; the categories page says you "can assign two categories" and does not call the second required (unverified wording). |
| **Content rights** | **Yes / Yes** (director, 2026-10-15 evening, HOLD lifted after the licence-hygiene pass): *Does your app contain, show, or access third-party content?* **Yes.** *Do you have all necessary rights to that content, or are you otherwise permitted to use it?* **Yes.** | Basis in §2.10: PR #15 removed from the Safari build the 14 entries whose only published source was DuckDuckGo (CC BY-NC-SA) or a verbatim AdGuard GPL-only pattern; what ships is Nullecho's own selection, checked against GPL / CC BY-SA lists, credited in the app (Acknowledgements) with NOTICE and the licence texts bundled (PR #14). The Review Notes paragraph is in §8. |
| **Age rating** | 4+ (all answers None / No; §6) | Set once at app level. |
| **Privacy Policy URL** | `https://nullecho.org/privacy/` | Required. The page carries a section "The Safari app (iPhone, iPad and Mac)" since 2026-10-15 (PR #10, live; verified with curl): what the extension and app store (nothing), the no-network app, the tip jar handled by Apple, the "Data Not Collected" label, and how to delete. |
| **Privacy choices URL** | leave empty | Optional; there is nothing to choose. |
| **License agreement** | Apple's standard EULA | No custom agreement. |

---

## 2. Version 0.9.2 — App Store page (iOS; the macOS version of the same record reuses every text field)

Version string `0.9.2` comes from `ext/manifest.json` through `Scripts/stamp-version.sh`; build number is
`CURRENT_PROJECT_VERSION` (currently 1). The simulator build the screenshots were taken from still reads
`0.9.1` in its "Extension version" row (see §7).

### 2.1 Promotional text (165 characters; limit 170)

```
Trackers: “Can we follow you around the internet?” Nullecho: Nah. Blocks known trackers in Safari, sends Global Privacy Control where you allow it, collects nothing.
```

Alternative without the slogan (160 characters):

```
Blocks requests to known trackers in Safari and sends Global Privacy Control on the sites you allow. Free, open source, no account, no server, collects nothing.
```

### 2.2 Description (3280 characters; limit 4000; plain text, line breaks only)

```
Nullecho is a Safari extension that blocks requests to known trackers on every site you visit and sends Global Privacy Control on the sites you allow. It is free, open source, and collects nothing.

Trackers: “Can we follow you around the internet?”
Nullecho: Nah.

WHAT IT DOES

• Blocks requests to known trackers. Ad, analytics, social-pixel and fingerprinting-vendor domains, chosen and cross-checked against public tracker research (sources credited in the open-source code). Blocking applies on every site as soon as the extension is on, before any website permission is granted. The app shows the number of block rules, counted from the rule files inside it.

• Sends Global Privacy Control on the sites you allow. GPC asks a site not to sell or share your data. It is legally meaningful in some US states and honored inconsistently. It is a request, not a block, and nobody can see from a browser whether a site complied.

• Leaves anti-fraud device checks alone. The checks banks and shops run at sign-in and checkout are not blocked, because blocking them can break sign-in and checkout.

WHAT IT DOES NOT DO IN SAFARI

• Safari attaches the GPC header to image and script requests only, never to the page itself, and only on sites where you have allowed Nullecho. A site’s own scripts still see the signal (navigator.globalPrivacyControl is true). This is a Safari limit, not a setting.

• No fingerprint disguise. The Safari version does not change what a site can read about your device. The per-site device profile Nullecho offers in other browsers is not part of this extension.

• Does not hide your IP address. Nullecho does not route your traffic anywhere. On Apple devices, hiding your IP address is the job of iCloud Private Relay, part of iCloud+.

• Safari’s own protections stay as they are. Nullecho adds to them and cannot switch them off.

COLLECTS NOTHING

No account, no sign-in, no analytics, no crash reports, no server. The app opens no network connections of its own: its two links are handed to your browser, and a tip is handled by the App Store’s own purchase service, not by this app. The rule lists are bundled with the extension; nothing is downloaded.

WHY IT ASKS FOR ACCESS TO ALL WEBSITES

Blocking needs no website permission. The privacy signal does: Safari lets an extension add the GPC header and set the signal only on sites you have allowed. To send it everywhere, allow Nullecho on all websites. To turn it off for one site, set that site to Deny; blocking stays on everywhere until you turn the extension off. Nothing you allow leaves your device, because there is nowhere for it to go.

TURN IT ON

iPhone and iPad: Settings, Apps, Safari, Extensions, Nullecho. Turn on Allow Extension; tracker blocking starts right away. To send Global Privacy Control as well, set All Websites to Allow.

Mac: in Safari’s Settings, open the Extensions tab and tick Nullecho. To send Global Privacy Control as well, also allow Nullecho on every website.

OPEN SOURCE

Nullecho is open source under the MIT license. Source code, issues and the rule lists: https://github.com/ZJHeepfixer/nullecho

SUPPORT THE PROJECT

Nullecho is free. The app has an optional tip jar: nothing unlocks, and every feature works identically before and after a tip.
```

### 2.3 Keywords (98 bytes; limit 100 bytes; comma-separated, no spaces after commas, name not repeated)

```
tracker,blocker,privacy,gpc,global,control,do not sell,opt out,trackers,analytics,safari,extension
```

Notes: every keyword is longer than two characters as Apple requires; "Nullecho" is not repeated; no other
company's or app's name appears. "safari" names the platform the extension runs on, which 2.3.7 allows when
it "accurately describe[s] your app" (**OWNER**: drop it if you prefer zero third-party marks in keywords; the
subtitle already carries "Safari"). Deliberately absent: "adblock" / "ad blocker" (the lists block ad-network
domains but the extension is not a general ad blocker), "fingerprinting" (the Safari build has no fingerprint
defence), "anonymous", "VPN".

### 2.4 URLs

| Field | Value | Notes |
|---|---|---|
| Support URL | `https://nullecho.org/` | Required. Apple: must "lead to real contact information". **OWNER**: confirm the page shows a contact route (email or the issues link). |
| Marketing URL | `https://nullecho.org/` | Optional. |
| Privacy Policy URL | `https://nullecho.org/privacy/` | App-level (§1). |

### 2.5 Copyright (required; year then owner; © is added by Apple)

```
2026 Jason Luker
```

Matches the repository `LICENSE` ("Copyright (c) 2026 Jason Luker") and the Apple developer account (director's call, 2026-10-15; the owner can change it in his chat).

### 2.6 What's New in this Version (269 characters; limit 4000)

Apple's page says this field is "not available for the first version". If App Store Connect shows it anyway
(unverified), or for the first update, use:

```
First release of Nullecho for Safari on iPhone, iPad and Mac. Blocks requests to known trackers on every site, sends Global Privacy Control on the sites you allow, and collects nothing: no account, no analytics, no server. Includes an optional tip jar; nothing unlocks.
```

### 2.7 Version release

Manual release after approval (recommended, so the Mac and iOS versions can go live together). No phased
release needed for a first version.

### 2.8 App Review Information

| Field | Value |
|---|---|
| Sign-in required | **No**. Demo account: not applicable (there is no account, sign-in or server anywhere in the app or the extension). |
| Contact first name / last name / phone / email | **OWNER** (not written here: the repository is public). Phone must be in international format with `+` and country code. |
| Notes | §8, verbatim. |
| Attachment | Optional: Xcode's "Generate Privacy Report" output for the archive (an empty report), as `audit/03-packaging.md` §5 suggests. |

### 2.9 Export compliance

`ITSAppUsesNonExemptEncryption = NO` is already set in `safari/xcode/Config/iOS-App-Info.plist` and
`macOS-App-Info.plist` (verified in the files and in the built app's `Info.plist`). With the key present App
Store Connect asks no export question at upload. The app implements no cryptography and opens no network
connections of its own.

### 2.10 Content rights (version level)

**Answer: Yes, Yes.** *Does your app contain, show, or access third-party content?* Yes. *Do you have all necessary
rights to that content, or are you otherwise permitted to use it?* Yes. HOLD lifted by the director on 2026-10-15
(evening) once the licence-hygiene pass landed: PR #15 (`safari/extension/rules-exclude.json`) keeps the 8
DuckDuckGo-only hosts, the 3 DuckDuckGo-only path rules and the 3 verbatim AdGuard GPL-only path rules out of the
Safari build, and PR #14 put the credit in the app ("What it does" ▸ Acknowledgements) with `NOTICE.txt`, the MIT
licence and the GPL-3.0 text bundled. "Yes" to the first question, not "No": some remaining patterns match EasyPrivacy
verbatim, so "No" would be the answer that is hard to defend later (H-LICENSE-REVIEW §7.2). Apple's exact UI wording
was taken from its reference page, not the live form (unverified).

Review Notes paragraph (H-LICENSE-REVIEW §7.2; it is the third paragraph of §8 and the answer to any Guideline 5.2 question):

> Nullecho bundles its own list of tracker domain names and URL patterns. Entries were checked against EasyPrivacy/EasyList (GPL-3.0-or-later or CC BY-SA 3.0-or-later) and AdGuard filters (GPL-3.0). Both licences permit redistribution, including commercial, with attribution. Credits and licence texts are in the app under What it does, Acknowledgements, Full credits and licence texts (NOTICE, the MIT licence and the GPL-3.0 text ship inside the app). The app does not access any third-party service at runtime.

---

## 3. Pricing and availability

| Field | Value | Notes |
|---|---|---|
| Price | **Free** (no price schedule) | Free apps need no agreement; the **tip jar does**: the Paid Apps Agreement must be Active before the in-app purchases can be tested in the sandbox or sold (`audit/05-tip-jar-rules.md` §3 citing Apple's IAP overview page). Also Business ▸ Agreements: tax forms and banking. |
| Availability | **All Countries or Regions** (175 as of 2026-10-15) | **OWNER'S DECISION, not made here:** the owner's other apps exclude the 27 EU territories for Digital Services Act reasons. With "All Countries or Regions", Apple requires a trader-status declaration, and an individual trader's address (or P.O. box), phone number and email are published on the EU product page; without trader status the app is removed from EU storefronts (Apple, since 2025-02-17). Selling tips through IAP in the EU is what makes trader status likely. To exclude the EU, choose "Specific Countries or Regions" and clear the 27 EU member states. |
| Pre-order | No | |
| Distribution on Mac | Same record (universal purchase) if the bundle IDs stay shared; `audit/03-packaging.md` §4 and `TIP-JAR.md` assume this. | **OWNER** confirms before creating the record; it changes whether one or two sets of IAP product IDs are needed. |
| Tax category | App Store software (default) | Nothing is sold except tips through IAP. |

---

## 4. App Privacy (nutrition label)

**Answer: "No, we do not collect data from this app"** → label **Data Not Collected**. One answer covers iOS,
iPadOS and macOS (answers are app-level).

Why this is true (from `audit/05-tip-jar-rules.md` §1 and `audit/03-packaging.md` §5):

- Apple defines "collect" as transmitting data off the device for longer than servicing the request; data
  "processed only on device is not 'collected'".
- The extension has no network endpoint of its own; its rule lists are bundled; the container app opens no
  network connections of its own (macOS sandbox without the network-client entitlement, measured in
  `audit/04-storekit-sandbox.md`), has no analytics or crash-reporting SDK, and no third-party SDK at all.
- The tip jar reads the StoreKit transaction on device (`id`, `productID`, `revocationDate`) and stores and
  sends nothing; no `appAccountToken` is set; the purchase itself is handled by the App Store, and "You are
  not responsible for disclosing data collected by Apple."
- `App/PrivacyInfo.xcprivacy` matches: `NSPrivacyTracking = false`, empty tracking domains, empty collected
  data types, empty accessed API types.

What would change the answer (keep this list with the label): a receipt or verification server, App Store
Server Notifications, any analytics or crash reporter, storing an `appAccountToken`, or a remote rule-list
download.

Optional extra: Accessibility Nutrition Labels exist on product pages as an optional declaration; not
required for submission as far as Apple's upcoming-requirements page shows (unverified beyond that page).

---

## 5. In-app purchases (four consumables; Monetization ▸ In-App Purchases)

Product IDs, reference names, display names and descriptions are the ones in `safari/xcode/Nullecho.storekit`
and `App/TipJar.swift` (they must match; `safari/tools/check-container.mjs` asserts it). Product IDs are
immutable once created, so **OWNER** confirms them first. Prices are the owner's decision of 2026-10-14
(`TIP-JAR.md`); whether the US storefront has price points at exactly 1.00 / 2.00 / 3.00 / 5.00 USD was not
verified here (Apple's pricing page says 800 price points exist but was not read for the list).

| Type | Product ID (≤ 100) | Reference name (≤ 64, internal) | Display name (2–30) | Description (≤ 45) | Price (USD) |
|---|---|---|---|---|---|
| Consumable | `org.nullecho.tip.small` | Small tip | `Small tip` (9) | `Thanks to the people who build Nullecho.` (40) | 1.00 |
| Consumable | `org.nullecho.tip.medium` | Medium tip | `Medium tip` (10) | `More thanks to the people who build Nullecho.` (45) | 2.00 |
| Consumable | `org.nullecho.tip.large` | Large tip | `Large tip` (9) | `Big thanks to the people who build Nullecho.` (44) | 3.00 |
| Consumable | `org.nullecho.tip.xlarge` | Extra-large tip | `Extra-large tip` (15) | `Huge thanks to the people who build Nullecho.` (45) | 5.00 |

Per product, also:

- **Availability**: same territories as the app.
- **Family Sharing**: off (consumables cannot be shared; the `.storekit` file has `familyShareable: false`).
- **Review screenshot** (required, review-only): `safari/store/iphone-63-4-support.png` (or the iPad shot
  `ipad-13-3-limits.png`); both show the four tiers with their prices in the real app.
- **Review notes** (≤ 4000): "Optional tip in a free app. Nothing is unlocked or changed by the purchase; the
  only effect is a one-line thank-you that disappears when the app quits. No account, no server, no restore
  (consumable). See the app's review notes."
- **Submission**: the first consumable of an app must be submitted with an app version: Monetization ▸
  In-App Purchases ▸ the item ▸ Add for Review ▸ add to the 0.9.2 submission (`audit/05-tip-jar-rules.md` §3,
  step 8). All four should ride with this version so App Review sees the section complete (2.1(b)).
- No promotional images (the tips are not promoted on the App Store).

---

## 6. Age rating questionnaire (all None / No → 4+)

Apple's current categories (reference page, 2026-10-15). Answer each as below; the calculated rating is **4+**
("No objectionable material").

| Section | Item | Answer |
|---|---|---|
| Mature themes | Mature or suggestive themes | None |
| | Profanity or crude humor | None |
| | Horror or fear themes | None |
| Violence | Cartoon or fantasy violence | None |
| | Realistic violence | None |
| | Prolonged graphic or sadistic violence | None |
| | Guns or other weapons | None |
| Sexuality or nudity | Sexual content or nudity | None |
| | Graphic sexual content and nudity | None |
| Medical or wellness | Medical or treatment information | None |
| | Health and wellness topics | None |
| | Alcohol, tobacco or drug use or references | None |
| Chance-based activities | Gambling | No |
| | Simulated gambling | None |
| | Contests | None |
| | Loot boxes | No |
| Capabilities | Unrestricted web access | **No** — the app has no web view; its two links open the system browser. The extension runs inside Safari, which is the user's browser, not a browsing capability of this app. |
| | User-generated content | No |
| | Social media | No |
| | Messaging and chat | No |
| | Advertising | No |
| In-app controls | Parental controls | No |
| | Age assurance | No |
| Additional information | Age category / override | Not Applicable (not Made for Kids, no override) |
| | Age suitability URL | leave empty |

Apple's upcoming-requirements page dates the current questionnaire to **January 31, 2026**; no September 2026
age-rating change appears on Apple's pages as of 2026-10-15 (see §0). If App Store Connect shows questions not
listed above, the answer for this app is None / No throughout.

---

## 7. Screenshots (`safari/store/`)

All captured 2026-10-15 from the **0.9.2** build, real app, no frames or overlays (Review Guideline 2.3.3), no
alpha channel. iPhone and iPad shots are produced by a test in the repo —
`safari/xcode/UITests/StoreScreenshotTests.swift` (run on its own with `-only-testing`, attachments exported with
`xcrun xcresulttool export attachments`) — on iOS 27.0 (24A434) simulators in light appearance with the status
bar set to 9:41 (`xcrun simctl status_bar <udid> override --time 9:41 --batteryState charged --batteryLevel 100
--wifiBars 3 --cellularBars 4`) and the StoreKit test configuration planted by a prior `xcodebuild test` run
of `TipJarTests/testProductsLoadSortedByPriceWithDisplayPrices` on that simulator, so the tip section shows prices.

| File | Size | Device / class | Shows |
|---|---|---|---|
| `iphone-63-1-top.png` | 1206×2622 | iPhone 17 Pro = "iPhone with Dynamic Island (medium display)", the required iPhone class | Name, description, "Extension version 0.9.2", "Turn it on in Safari" steps |
| `iphone-63-2-what-it-does.png` | 1206×2622 | same | "What it does": blocking, GPC, Safari's limits, "186 block rules on" (200 before PR #15's 14 exclusions), the collapsed "Acknowledgements" row |
| `iphone-63-3-limits.png` | 1206×2622 | same | "What it does not do in Safari" and "Collects nothing" |
| `iphone-63-4-support.png` | 1206×2622 | same | "If a site misbehaves" and "Support the project" with the four tips at $1.00 / $2.00 / $3.00 / $5.00 |
| `ipad-13-1-top.png` | 2064×2752 | iPad Pro 13-inch (M5) = the required iPad 13-inch class | as iPhone 1 |
| `ipad-13-2-what-it-does.png` | 2064×2752 | same | as iPhone 2 |
| `ipad-13-3-limits.png` | 2064×2752 | same | "What it does not do in Safari", "If a site misbehaves", "Support the project" with the four tips, "More": the 13-inch page ends here, so there is no fourth iPad shot (the test skips a frame identical to the previous one) |
| `mac-1-top-2880x1800.jpg` | 2880×1800 (window 1120×1520 at 2×, centred on a flat dark background), JPEG so no alpha | Mac, the **signed** Release archive app (the unsigned Debug app cannot ask Safari and shows "Safari did not answer"); **dark appearance** — the Mac's system appearance; with light mode forced per-app the window could not be imaged | Top of the window: name, "Extension version 0.9.2", the live status card "Nullecho is off in Safari — Nothing is blocked until you turn it on" (the real state of the build machine), "What it does" |

Upload order per device: iPhone 1 → 4, iPad 1 → 3. Apple's current requirements (§0): one iPhone medium-display set and one iPad
13-inch set are required for iOS; a Mac set is required for the Mac version; the large-display iPhone sizes
are accepted but not required, so none are provided. A light-mode Mac shot needs the Mac's appearance switched
(owner's setting); dark is acceptable to Apple and is what ships unless the owner wants it changed.

The in-app "What it does" text visible in shots 2 no longer names any third-party list (since the licence
review: the blocking row says the entries were "checked against the published tracker lists credited under
Acknowledgements below", and a collapsed "Acknowledgements" row follows "Rule lists in this build"); the store
*text* names none either (director's rule). The sets were re-shot after that change, and again from main 7753ed7 after PR #15's exclusions changed the
counted row to "186 block rules on" (the app counts the rule files it ships). If the copy or the lists change again,
re-run the screenshot test.

## 8. Notes for App Review (2443 characters, 2447 bytes with the optional paragraph; limit 4000 bytes)

The first paragraph is `safari/TIP-JAR.md` "Review notes", verbatim. The second adds the two sentences the brief
asked for (enabling the extension; no account). The third is the Content Rights basis (§2.10). The fourth is optional
and pre-empts 4.4.2 as `audit/03-packaging.md` §6 recommends.

```
Nullecho is a free Safari web extension with no accounts, no sign-in and no server. This version adds an optional tip jar, "Support the project", at the bottom of the app's single screen (scroll down past "What it does not do in Safari" and "If a site misbehaves"). It offers four consumable in-app purchases — Small tip, Medium tip, Large tip, Extra-large tip — through StoreKit. A tip unlocks nothing and changes no feature: the only thing that happens after a purchase is a one-line thank-you, which disappears when the app quits. Every feature of the app and the extension works identically before and after a tip, so there is nothing to restore and no restore button. The app stores no record of a purchase (no UserDefaults, no file, no keychain item, no appAccountToken) and sends nothing to any server of ours; the privacy label remains "Data Not Collected" (the purchase itself is handled by the App Store's purchase service). To test: scroll to "Support the project", tap any price, complete the purchase with a Sandbox account, and observe the thank-you line and that nothing else changes. If Screen Time or a management profile disallows purchases on the review device, the section is hidden entirely, by design.

To enable the extension on the review device: on iPhone or iPad open Settings, Apps, Safari, Extensions, Nullecho and turn on Allow Extension (tracker blocking starts at once; set All Websites to Allow to also see the Global Privacy Control signal); on Mac open Safari's Settings, Extensions, tick Nullecho, and allow it on every website. There is no account and no sign-in anywhere in the app or the extension, so no demo credentials exist.

Nullecho bundles its own list of tracker domain names and URL patterns. Entries were checked against EasyPrivacy/EasyList (GPL-3.0-or-later or CC BY-SA 3.0-or-later) and AdGuard filters (GPL-3.0). Both licences permit redistribution, including commercial, with attribution. Credits and licence texts are in the app under What it does, Acknowledgements, Full credits and licence texts (NOTICE, the MIT licence and the GPL-3.0 text ship inside the app). The app does not access any third-party service at runtime.

Optional fourth paragraph: The extension requests access to all websites because Global Privacy Control is a per-request header and a per-page signal that Safari only lets an extension apply on sites the user has allowed; blocking works without it, and nothing is sent to us from any site.
```

(When pasting, delete the words "Optional fourth paragraph:" or the whole fourth paragraph. The third paragraph is the
Content Rights basis, H-LICENSE-REVIEW §7.2, approved by the director 2026-10-15.)

---

## 9. Consistency check: every listing claim and what supports it

| Listing claim | Supported by |
|---|---|
| "blocks requests to known trackers on every site" / "Blocking applies on every site as soon as the extension is on, before any website permission is granted" | In-app: "Blocks requests to known trackers … Applies on every site as soon as the extension is on, before any website permission is granted." (`ContentView.swift`, WhatItDoesSection). Measured: `CAPABILITY-AUDIT.md` verdict table and §3.1; `VERIFY-IPHONE.md` (6/6 blocked with no website access). |
| The store text names no third-party list (director's rule); the in-app blocking row says "from Nullecho's own list; every entry was checked against the published tracker lists credited under Acknowledgements below" | In-app Acknowledgements row (EasyPrivacy, EasyList, AdGuard, with licences) and the bundled `NOTICE.txt` (PR #14); the 14 entries whose only source was DuckDuckGo or a verbatim AdGuard GPL pattern are excluded from the Safari build (PR #15, `rules-exclude.json`). |
| "The app shows the number of block rules, counted from the rule files inside it" | In-app row "Rule lists in this build … block rules on" with footer "Counted from the rule files inside this app, not typed in." (`EmbeddedExtension.swift`). No number is stated in the listing because it is read from the build. |
| "sends Global Privacy Control on the sites you allow" / "legally meaningful in some US states and honoured inconsistently" / "a request, not a block" / "nobody can see from a browser whether a site complied" | In-app: "Sends Global Privacy Control on the sites you allow … Legally meaningful in some US states, honoured inconsistently. It is a request, not a block, and nobody can see from a browser whether a site complied." `ext/src/gpc.js` HONEST LIMITS block. |
| "Safari attaches the GPC header to image and script requests only, never to the page itself, and only on sites where you have allowed Nullecho. A site's own scripts still see the signal" | In-app "About Safari's limits" (same words). Measured: `CAPABILITY-AUDIT.md` §2 (`modifyHeaders` image/script only) and §3.1–3.2; `VERIFY-IPHONE.md` / `VERIFY-MACOS.md` (`Sec-GPC` on image and script, absent on document, fetch, XHR; `navigator.globalPrivacyControl === true`). |
| "Leaves anti-fraud device checks alone … not blocked" | Safari popup (`safari/extension/popup/popup.html`): "Anti-fraud device checks: Not blocked. The checks banks and shops run at sign-in and checkout are left alone, because blocking them can break sign-in and checkout." |
| "No fingerprint disguise … The per-site device profile Nullecho offers in other browsers is not part of this extension" (the in-app sentence says "in Chrome"; the listing names no other browser, per the project rule) | In-app LimitsSection, same words; `CAPABILITY-AUDIT.md` verdict ("Fingerprint persona: No"). |
| "Does not hide your IP address … iCloud Private Relay, part of iCloud+" | In-app LimitsSection, same words; `docs/THREAT-MODEL.md` ("nothing about your IP"); `CAPABILITY-AUDIT.md` §1 copy rule. |
| "Safari's own protections stay as they are. Nullecho adds to them and cannot switch them off." | In-app LimitsSection footer, same words. |
| "No account, no sign-in, no analytics, no crash reports, no server. The app opens no network connections of its own: its two links are handed to your browser, and a tip is handled by the App Store's own purchase service" | In-app "Collects nothing" (same words); `audit/04-storekit-sandbox.md` (no network-client entitlement, StoreKit traffic in the system agent); `TIP-JAR.md` rule 3. |
| "The rule lists are bundled with the extension; nothing is downloaded" | `safari/extension/manifest.json` static `rule_resources`; `audit/03-packaging.md` §4 row 2.5.1/2.5.2 ("Static rule lists bundled; no remote code"). |
| "Blocking needs no website permission. The privacy signal does … only on sites you have allowed" / "To turn it off for one site, set that site to Deny; blocking stays on everywhere until you turn the extension off" | In-app setup step 3 and "If a site misbehaves": "Denying a site stops the privacy signal there. Tracker blocking is not per-site: it stays on everywhere until you turn the extension off."; `CAPABILITY-AUDIT.md` §3.1; `audit/03-packaging.md` §6. |
| "Nothing you allow leaves your device, because there is nowhere for it to go" | In-app header: "It collects nothing: there is no server to send anything to." |
| Turn-it-on steps (iPhone/iPad and Mac) | In-app IOSSetupSection steps 1–3 and MacSetupSection footer; Settings strings measured in `VERIFY-IPHONE.md`. |
| "open source under the MIT licence" + GitHub link | In-app LinksSection footer and `ExternalLink.sourceCode`; `LICENSE`. |
| "Nullecho is free. The app has an optional tip jar: nothing unlocks, and every feature works identically before and after a tip" | In-app SupportSection: "Nothing unlocks; this is a thank-you to the people who build Nullecho."; `TIP-JAR.md` rules 1 and 5; `audit/05-tip-jar-rules.md` §0 item 3. No "donate" anywhere (3.2.1(vi)/3.2.2(iv)). |
| Slogan line "Trackers: 'Can we follow you around the internet?' Nullecho: Nah." | `brand/BRAND.md` slogan, used as a line, not as the name; it makes no claim of blocking all tracking or of prices. |
| Subtitle "Block known trackers in Safari" | Same support as the first row; "known" keeps it inside the measured claim. |
| Privacy label "Data Not Collected" | §4 above; `audit/05-tip-jar-rules.md` §1.3. |
| Age rating 4+ | §6; the app has no web view, no UGC, no ads. |
| Export compliance NO | `Config/iOS-App-Info.plist`, `Config/macOS-App-Info.plist`, built app `Info.plist`. |

Phrases checked as absent from every field (script run on the final strings): "protects you from fingerprinting",
"prevents fingerprinting", "blocks fingerprinting", "anonymous", "untraceable", "invisible", "stops",
"blocks all", "lower price", "donate/donation", "charity", "fundraiser", "surveillance".

---

## 10. Open items and unverified points (for the owner)

1. ~~Bundle IDs and product IDs are working values~~ — confirmed by the owner 2026-10-09/14 (org.nullecho.app; tips small/medium/large/xlarge).
1b. ~~Content Rights answer on HOLD pending the director's license review~~ — lifted 2026-10-15 (evening) after PR #14 + #15; answer Yes / Yes with the §8 third paragraph (§2.10).
2. ~~Privacy policy page needs its Safari paragraph~~ — done 2026-10-15 (PR #10, live at https://nullecho.org/privacy/).
3. **EU availability and trader status** are the owner's call (§3).
4. **Price points** 1.00 / 2.00 / 3.00 / 5.00 USD: existence on the US storefront not verified here.
5. **"What's New" on a first version**: Apple's page says the field is not available; kept here for the
   first update.
6. **Category**: Utilities per the brief; "Safari Extensions" exists as a category and is the closer fit if App
   Store Connect offers it for this record (platform availability unverified).
7. **September 2026 age-rating changes**: not found on Apple's pages; the live questionnaire dates from
   January 31, 2026.
8. ~~Screenshot source build reads 0.9.1~~ — re-shot from the 0.9.2 build 2026-10-15 (§7). The Mac shot is dark and shows the extension off (the build machine's real state); a light one needs the owner's appearance setting.
9. **Support URL contact information**: Apple wants real contact details reachable from the support page.
10. **Required iPhone screenshot class** is the medium display (1206×2622); that set is provided. No large-display set.

---

## 11. Pushing this listing through the App Store Connect API

The machine-readable copy of this document is `safari/store/listing.json`; `safari/tools/asc-listing.mjs` pushes it.
`safari/test/listing.test.mjs` keeps the two in step (every text in the JSON must appear verbatim here; limits;
screenshot sizes and no alpha; the offline plan runs). Edit this markdown first, then the JSON.

```
node safari/tools/asc-listing.mjs --plan              # what would be sent, plus read-only lookups (record, categories)
node safari/tools/asc-listing.mjs --plan --offline    # the same with no network
node safari/tools/asc-listing.mjs --apply             # idempotent PATCHes; never deletes; stops at the first error
```

Credentials come from the environment only (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`; optional
`ASC_REVIEW_CONTACT_JSON` for the owner's review contact, which is never stored in the repo). The tool refuses to
run `--apply` until `GET /v1/apps` finds `org.nullecho.app`, i.e. after the owner's script A has created the record;
it never creates the record, the in-app purchases or the agreements.

What `--apply` does, in order: content rights (`USES_THIRD_PARTY_CONTENT`); categories on the in-flight app info;
subtitle + privacy-policy URL; per platform (IOS, MAC_OS) the version (0.9.2, MANUAL, copyright), its en-US text
(description, keywords, promotional text, support and marketing URLs; What's New omitted on a first version), the
age-rating declaration (§6; attributes the API does not know are dropped on its word and reported), the review
details (§8 notes, `demoAccountRequired: false`, contact from the environment if present), and the screenshot sets
(reserve, upload parts, commit with MD5, assert order, poll to COMPLETE; a file already uploaded under the same name
is re-used; nothing is deleted); then price Free; then it reads the four in-app purchases back and reports their
state.

Proven shapes (the owner's other apps shipped with them, `~/ios-signing/oh-auto-setup-listing.js`,
`oh-auto-upload-screens.mjs`, `oh-set-app-price.js`): JWT, appInfos/categories, appInfoLocalizations,
appStoreVersions, appStoreVersionLocalizations, ageRatingDeclarations with the retry, appStoreReviewDetails,
appScreenshotSets/appScreenshots, appPriceSchedules. Verified read-only on 2026-10-15: `UTILITIES` and
`PRODUCTIVITY` exist for IOS and MAC_OS; no record for `org.nullecho.app` yet. **Unverified until the first
`--apply`:** the screenshot display-type names for the 2026 size classes (`APP_IPHONE_61` for 1206×2622,
`APP_IPAD_PRO_3GEN_129` for 2064×2752, `APP_DESKTOP` for 2880×1800; the API rejects a wrong set or size at
reservation and the tool reports it) and adding a `MAC_OS` version to a record created for iOS (the tool POSTs one
if none exists). The Mac screenshot set is marked `stale` in the JSON and skipped until the Mac shot is re-captured.

Left in App Store Connect for the owner: availability (§3, EU trader status), App Privacy (§4, no API used here),
Paid Apps agreement, tax and banking, the review contact if not supplied by environment, and the submit click.
