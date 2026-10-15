# Nullecho for Safari — tip-jar rules audit (A5): Apple requirements a StoreKit 2 consumable tip jar must satisfy

Date: 2026-10-07. Scope: the tip jar decided in `safari/TIP-JAR.md` (free app; optional consumable in-app
purchases, about three tiers; nothing gated; no accounts, analytics or receipt server; privacy label planned
as "Data Not Collected"). Nothing was built, no code or project file was changed, no App Store Connect or
Apple account was touched. This file is evidence for the build, not the build.

Evidence rule: every Apple statement below is quoted (at most 15 words per quotation), with its URL and the
date fetched (all **2026-10-07** unless noted) and any date the page itself carries. Where Apple's text does not
settle a point, the point is marked **unverified** and the reasoning that fills the gap is labelled as ours.
Apple's documentation pages are JavaScript-rendered; their text was read from Apple's own JSON data endpoints
(`developer.apple.com/tutorials/data/documentation/...`) or from the rendered page, never from third parties.

Versions in force on the fetch date: App Review Guidelines (page undated; Apple's news item of **June 8, 2026**
is the latest revision notice, https://developer.apple.com/news/?id=a233fmpw); Human Interface Guidelines
"Apple In-App Purchase" page, change log **September 17, 2026** ("Rebranded as Apple In-App Purchase");
App Privacy Details page (undated, © 2026); App Store Connect Help pages (undated). Nullecho's targets, read
from `safari/xcode`: `IPHONEOS_DEPLOYMENT_TARGET = 18.4`, `MACOSX_DEPLOYMENT_TARGET = 15.4`, container app in
SwiftUI (`App/NullechoApp.swift`, `App/ContentView.swift`), `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO`.

---

## 0. Hard requirements, ranked (what the build must satisfy)

1. **Tips go through In-App Purchase; nothing else.** Guideline 3.1.1: "Apps may use in-app purchase
   currencies to enable customers to "tip" the developer". 3.1.3's exceptions do not apply to a tip (none of
   reader, multiplatform, enterprise, person-to-person, physical goods, companion, ad-management), and apps
   "cannot, within the app, encourage users to use a purchasing method other than in-app purchase". No
   Ko-fi/PayPal/GitHub Sponsors link in the app. (The 3.1.1(a) US-storefront link allowance exists but is a
   purchase-link entitlement regime; using it for a tip jar adds review surface for no benefit — our reading.)
   https://developer.apple.com/app-store/review/guidelines/#in-app-purchase
2. **Never "donate", "charity", "fundraiser", or any cause wording.** 3.2.1(vi): "Approved nonprofits may
   fundraise directly within their own apps or third-party apps" — and only they; 3.2.2(iv) lists as
   unacceptable "collecting funds within the app for charities and fundraisers", adding such apps "may only
   collect funds outside of the app, such as via Safari or SMS". The HIG's own tip assigns donations to a
   different technology: "Use Apple In-App Purchase to sell virtual goods in your app" versus Apple Pay
   "and for donations." A tip for the developer's own work is neither a charity nor a donation; the copy
   must say so plainly. https://developer.apple.com/app-store/review/guidelines/#other-business-model-issues ;
   https://developer.apple.com/design/human-interface-guidelines/in-app-purchase
3. **Nothing may be "unlocked", and the review notes must describe the tip jar specifically.** 2.3.1(a):
   "Don't include any hidden, dormant, or undocumented features in your app" and new features "must be
   described with specificity in the Notes for Review". The thank-you is the only post-tip change; say so
   in the notes. https://developer.apple.com/app-store/review/guidelines/#accurate-metadata
4. **The IAPs must be reviewable in the submitted build.** 2.1(b): "make sure they are complete,
   up-to-date, visible to the reviewer and functional"; if any configured item cannot be found, explain in
   review notes. The products must be attached to the version submission (section 3 below).
   https://developer.apple.com/app-store/review/guidelines/#app-completeness
5. **Restore button: not required for a consumable-only tip jar** (section 2.3 below). 3.1.1's wording is
   conditional: "you should make sure you have a restore mechanism for any restorable in-app purchases".
6. **Privacy label stays "Data Not Collected"** as long as the app's own code sends nothing anywhere
   (section 1 below). The decisive Apple sentence: "You are not responsible for disclosing data collected by
   Apple." https://developer.apple.com/app-store/app-privacy-details/
7. **Transaction listener at launch, `finish()` after the thank-you, `.pending` handled** (section 4).
8. **HIG copy rules**: "Use simple, succinct product names and descriptions."; "Display the total billing
   price for each in-app purchase you offer, regardless of type."; "Display your store only when people can
   make payments."; "Use the default confirmation sheet." (section 5).

---

## 1. App Privacy Details (the label)

### 1.1 Apple's definitions (App Privacy Details, https://developer.apple.com/app-store/app-privacy-details/)

- Collection: "“Collect” refers to transmitting data off the device" … "for a period longer than what is
  necessary to service the transmitted request" (one sentence; split to respect the quotation limit).
- On-device processing: "Data that is processed only on device is not “collected”" and need not be disclosed;
  anything derived and sent off device is considered separately.
- Apple's own collection: "You are not responsible for disclosing data collected by Apple."
- Apple services you draw on: "If you collect data about your app from Apple frameworks or services" you
  should indicate what you collect and how you use it (the page names MapKit, CloudKit, App Analytics).
- Data type "Purchase History" (category Purchases): "An account’s or individual’s purchases or purchase
  tendencies". Identifiers: "User ID" (account-level IDs) and "Device ID".
- Optional disclosure: a data type is optional only if it meets *all* of: not used for tracking; not used
  for advertising/marketing/"Other Purposes"; collected only infrequently, outside primary functionality and
  optionally; and entered by the user in a form that shows their name alongside. Irrelevant here: the
  exemption presupposes collection, and the tip jar collects nothing.
- Maintenance: "You're responsible for keeping your responses accurate and up to date."; answers can be
  changed at any time without an app update.

### 1.2 What the on-device transaction exposes (StoreKit 2, all fetched 2026-10-07)

- `Transaction` is a JWS the App Store signs; StoreKit verifies it on device: "If StoreKit returns a
  transaction as verified, the transaction is valid for the device."
  https://developer.apple.com/documentation/storekit/transaction
- `id: UInt64` — "The unique identifier for the transaction."
  https://developer.apple.com/documentation/storekit/transaction/id
- `originalID: UInt64` — "identical to id except when the user restores a purchase or renews".
  https://developer.apple.com/documentation/storekit/transaction/originalid
- `appAccountToken: UUID?` — "A UUID that associates the transaction with a user on your own service."
  It is only present if the app passed one at purchase time; Nullecho passes none.
  https://developer.apple.com/documentation/storekit/transaction/appaccounttoken
- `environment: AppStore.Environment` (iOS 16+/macOS 13+) — "The server environment that generates and
  signs the transaction." https://developer.apple.com/documentation/storekit/transaction/environment

Reading these values in the app and sending them nowhere is on-device processing under 1.1.

### 1.3 Conclusion

**The label can stay "Data Not Collected."** Grounds: (a) the app's code transmits nothing; the only network
activity is StoreKit's own exchange with the App Store, which is Apple's processing, and "You are not
responsible for disclosing data collected by Apple."; (b) the transaction is read on device only, which is
"not “collected”". Apple publishes no sentence specific to "StoreKit purchases and the nutrition label" that we
could find (searched Apple's forums and documentation; **unverified** that none exists), so the conclusion
rests on the definitions above, not on an Apple ruling about tip jars.

**What would change it** (our mapping of Apple's definitions, marked as inference):
- A receipt/verification server, an **App Store Server Notifications** endpoint, or polling the App Store
  Server API: per-transaction records about an individual's purchases would then be retained on Nullecho's
  server. Apple's "If you collect data about your app from Apple frameworks or services" sentence then
  applies; the matching type would be Purchases → Purchase History, plus Identifiers if any user/device ID
  or `appAccountToken` is stored. **Unverified**: Apple does not spell out this exact mapping.
- Any analytics or crash reporting SDK (third-party partners count as yours).
- Setting `appAccountToken` and keeping it anywhere off device.
- Not a change: App Store Connect Sales and Trends / payments reports. They are aggregated and not an
  "account's or individual's purchases"; **unverified** as an explicit Apple statement, offered as our reading.

Keep the app's privacy manifest consistent with the label (no `NSPrivacyCollectedDataTypes`); StoreKit is an
Apple framework and needs no third-party manifest entry. (`TIP-JAR.md` already requires the manifest check.)

---

## 2. Review Guidelines for tipping (fetched 2026-10-07; latest revision notice June 8, 2026)

### 2.1 What applies

- **3.1.1** opens with the IAP mandate for unlocking features and then allows tipping outright: "Apps may use
  in-app purchase currencies to enable customers to "tip" the developer". Same section: "you should make sure
  you have a restore mechanism for any restorable in-app purchases".
- **2.1(b)** (reviewability), **2.3.1(a)** (no hidden features; specific review notes) — quoted in section 0.
- **3.2.1(vi) / 3.2.2(iv)** — only "Approved nonprofits may fundraise directly within their own apps or
  third-party apps"; otherwise "collecting funds within the app for charities and fundraisers" is
  unacceptable. Hence the wording rule: a tip is support for the developers, never a donation to a cause.

### 2.2 What does not apply (and must not be leaned on)

- **3.1.1(a)** external purchase links (entitlement-based outside the US storefront; US storefront allows
  calls to action without entitlement): irrelevant to a tip through IAP and a needless review risk.
- **3.1.3(a)–(g)**: reader, multiplatform, enterprise, person-to-person, physical goods, free companion,
  advertising-management apps. None describes a tip to the developer.
- Guideline 3.2.2(vi) is "Intentionally omitted." in the current text; (vii) concerns rank manipulation. The
  charity rule lives in **3.2.2(iv)**, not (vi)/(vii) as the question assumed.

### 2.3 Restore Purchases for a consumable-only tip jar — not required

- 3.1.1 conditions the requirement on "any restorable in-app purchases" (quoted above). Apple's IAP overview
  page repeats the conditional: a restore mechanism "for any restorable Apple In‑App Purchases".
  https://developer.apple.com/in-app-purchase/
- StoreKit 2 has no restorable state for consumables: "Consumable Apple In-App Purchases also don't appear in
  the current entitlements." https://developer.apple.com/documentation/storekit/transaction/currententitlements
  By default "the transaction information excludes finished consumables (unless refunded or revoked)" from
  `Transaction.all` (opt in with `SKIncludeConsumableInAppPurchaseHistory`).
  https://developer.apple.com/documentation/storekit/transaction/all
- `AppStore.sync()`: "In regular operations, there's no need to call sync()."; "There's no need for users to
  ask your app to restore transactions"; and if offered at all, "Call this function only in response to an
  explicit user action". https://developer.apple.com/documentation/storekit/appstore/sync()
- The HIG lists "A way for existing subscribers to sign in or restore purchases" only among the required items
  of a *subscription* sign-up screen. https://developer.apple.com/design/human-interface-guidelines/in-app-purchase
- **Unverified**: a current Apple sentence literally reading "consumables cannot be restored". The legacy
  In-App Purchase Programming Guide's product table (archived library) now redirects to current docs and
  could not be fetched. The conclusion stands on the conditional wording plus the StoreKit 2 behaviour above.

Design consequence: no Restore button, and nothing to restore. Do not add a "Restore" affordance for show —
it would call `sync()` and "displays a system prompt that asks users to authenticate".

---

## 3. App Store Connect setup, in order (owner's clicks; paths as Apple's Help pages print them)

Prerequisite roles are quoted from each page. All fetched 2026-10-07.

1. **Paid Apps Agreement** — role: Account Holder. "Select Business at the top of the page." → Agreements tab →
   "find the Paid Apps row, then click View and Agree to Terms" → Agree.
   https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements
   Note: the section the question calls "Agreements, Tax, and Banking" is now labelled **Business**.
2. **Tax forms** — role: Account Holder, Admin or Finance. Business → Agreements tab → Tax Forms section.
   "All developers must complete a US tax form to comply with the Paid Apps Agreement."
   https://developer.apple.com/help/app-store-connect/manage-tax-information/provide-tax-information/
3. **Banking** — same roles. Business → Agreements tab → Bank Accounts → Add Bank Account. "in order to add
   banking information, you'll first need to sign a Paid Apps Agreement"; tax forms must be in before banking
   is processed. https://developer.apple.com/help/app-store-connect/manage-banking-information/enter-banking-information
4. **Agreement must be Active before any testing with real products.** Overview page: "The agreement must be
   Active to test In-App Purchases in the sandbox environment." And "TestFlight uses the sandbox environment
   for Apple In-App Purchases." (Xcode's local StoreKit testing needs none of this; section 4.)
   https://developer.apple.com/help/app-store-connect/configure-in-app-purchase-settings/overview-for-configuring-in-app-purchases ;
   https://developer.apple.com/documentation/storekit/testing-at-all-stages-of-development-with-xcode-and-the-sandbox
5. **Create each consumable** — role: Account Holder, Admin, App Manager, Developer or Marketing. Apps → the
   app → sidebar **Monetization → In-App Purchases** → (+) → **Consumable** → reference name + product ID →
   Create. Sandbox lag: "up to 1 hour for changes you make to product metadata to appear".
   https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-consumable-or-non-consumable-in-app-purchases
   Field limits (reference page): Reference Name ≤ 64 chars (internal only); Product ID ≤ 100 chars, letters,
   numbers, hyphens, periods, underscores, and "The product ID isn't editable after you save the In-App
   Purchase." — nor reusable after deletion; Display Name 2–30 chars; Description ≤ 45 chars; Review Notes
   ≤ 4000 chars; App Review Screenshot "used for review only and isn't displayed on the App Store" (once
   uploaded it can be replaced, not removed). Also: "You need separate identifiers for In-App Purchases in
   your iOS apps and your macOS apps." — **owner to confirm** whether Nullecho's Mac and iOS builds share one
   App Store Connect app record (one product-id set) or are two records (two sets).
   https://developer.apple.com/help/app-store-connect/reference/in-app-purchase-information/
   **Unverified**: whether App Store Connect blocks submission until the review screenshot is uploaded; the
   reference page describes the field but does not say "required".
6. **Price and availability** per product (price schedule / availability pages under the same Monetization
   section; not separately fetched). The app shows `displayPrice`, never a hard-coded figure (section 4).
7. **Status names today**: "Prepare for Submission" ("created, but you haven't yet submitted it for review")
   and "Ready for Review" ("added to a submission, but you haven't sent the submission to App Review"). The
   older names "Missing Metadata" / "Ready to Submit" no longer appear on Apple's statuses page.
   https://www.developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-statuses
8. **Attach to the version and submit** — first IAP of a type: "In-App Purchase of each type must be submitted
   with a new app version". Path: Monetization → In-App Purchases → the item → **Add for Review** → add to an
   existing submission or **Create New Submission** → choose platform and app version → **Submit for Review**.
   After the first consumable is approved, further consumables can be submitted without a version.
   https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase
9. **Sandbox Apple Accounts** (device testing) — role: Account Holder, Admin, App Manager or Developer.
   **Users and Access → Sandbox → (+)** (first time: Create Test Accounts) → name, email, password, country →
   Create. The email "must not already be registered as an Apple Account"; up to 10,000 accounts. Sign in on
   the device via the Sandbox sign-in in Settings, not the main Apple Account. To simulate an interrupted
   purchase in sandbox: Users and Access → Sandbox → Testers → the account → "Interrupt Purchases for This
   Tester". https://developer.apple.com/help/app-store-connect/test-in-app-purchases/create-a-sandbox-apple-account/ ;
   https://developer.apple.com/documentation/storekit/testing-an-interrupted-purchase
10. **App Store Small Business Program** — "reduced commission rate of 15% on paid apps and Apple In-App
    Purchases"; eligibility: "made up to 1 million USD in proceeds in the prior calendar year" or
    "as well as developers new to the App Store". Enrol as Account Holder after you "Review and accept the
    latest Paid Apps agreement" (and list Associated Developer Accounts if any); enrolment is via the program
    page's enrolment link. Timing: proceeds are "adjusted fifteen (15) days after the end of the fiscal
    calendar month" in which enrolment is approved — so enrolment need not precede the first sale to be
    valid, but sales before approval are at 30 %. Enrol before the tip-jar version ships.
    https://developer.apple.com/app-store/small-business-program/

---

## 4. StoreKit 2 implementation requirements that shape the design (fetched 2026-10-07)

Minimum OS: every API below is iOS 15+/macOS 12+ unless noted; Nullecho's iOS 18.4 / macOS 15.4 targets
clear all of them, including the newer ones.

- **Listener at launch.** `Transaction.updates`: "Create a Task to iterate through transactions as soon as
  your app launches."; "Without the Task to listen for these transactions, your app may miss them."
  Unfinished transactions are delivered there once at launch ("the updates listener receives them once,
  immediately after the app launches"); `Transaction.unfinished` lists them at any time. A same-device
  purchase returns through `PurchaseResult.success`, not `updates`.
  https://developer.apple.com/documentation/storekit/transaction/updates ;
  https://developer.apple.com/documentation/storekit/transaction/unfinished
- **`finish()` after delivery.** "Call finish() to complete a transaction after you deliver the purchased
  content" — for a tip, after the thank-you is shown; an unfinished tip would resurface at next launch.
  https://developer.apple.com/documentation/storekit/transaction/finish()
- **Purchase results.** `.success(VerificationResult<Transaction>)`; `.userCancelled` — "The user canceled the
  purchase." (show nothing, no retry nag); `.pending` — "The purchase is pending, and requires action from
  the customer." (Ask to Buy / SCA): "If the transaction completes, it's available through
  Transaction.updates." — so the thank-you for a pending tip must be shown from the listener, possibly at a
  later launch. https://developer.apple.com/documentation/storekit/product/purchaseresult
- **`.unverified`** — "The associated value failed StoreKit automatic verification checks."; Apple's sample
  says "Handle unverified transactions based on your business model." For a tip jar: show no thank-you and
  do not finish? **Unverified** which choice Apple prefers; our rule: thank only `.verified`, and finish
  unverified ones only if they keep reappearing (nothing is at stake). https://developer.apple.com/documentation/storekit/verificationresult
- **No persisted supporter state.** "Consumable Apple In-App Purchases also don't appear in the current
  entitlements." and finished consumables are excluded from `Transaction.all` by default. With no storage of
  our own, a tip leaves no trace in the app after the thank-you — which is the decided behaviour.
- **Product fetch and order.** `Product.products(for:)`: invalid ids are silently dropped — "the App Store
  excludes them from the return value"; duplicates ignored. Result order relative to the input is **not
  documented** (unverified) — sort by `price` in the app.
  https://developer.apple.com/documentation/storekit/product/products(for:)
- **Prices.** `displayPrice`: "Use this string to display the price, formatted for the locale." (storefront
  decides the locale). Never hard-code "$1.99". https://developer.apple.com/documentation/storekit/product/displayprice
- **Hide the jar when purchases are blocked.** `AppStore.canMakePayments`: if false, "a person can't authorize
  payments, so don't offer Apple In-App Purchases" (Screen Time restrictions, MDM). Matches the HIG rule.
  https://developer.apple.com/documentation/storekit/appstore/canmakepayments
- **macOS and the purchase sheet (verified).** `purchase(options:)` docs route by UI framework: "Use
  PurchaseAction for apps that use SwiftUI on any platform"; "Use purchase(confirmIn:options:) for apps that
  run on macOS and use AppKit." The AppKit overload `purchase(confirmIn window: NSWindow, options:)` is
  **macOS 15.2+** ("The window to show purchase confirmation UI in proximity to."). Nullecho's container app
  is SwiftUI, so the applicable API is `@Environment(\.purchase)` (`PurchaseAction`, iOS 17+/macOS 14+), which
  "presents the confirmation sheet in proximity to the scene in which the view displays". Alternatively
  `ProductView(id:)` (iOS 17+/macOS 14+) renders name, description, price and purchase button and runs the
  flow itself; the HIG notes StoreKit views need no further purchase call. Either satisfies "Use the default
  confirmation sheet."
  https://developer.apple.com/documentation/storekit/product/purchase(options:) ;
  https://developer.apple.com/documentation/storekit/product/purchase(confirmin:options:)-8eai6 ;
  https://developer.apple.com/documentation/storekit/purchaseaction ;
  https://developer.apple.com/documentation/storekit/productview
- **Sandbox Ask to Buy from code**: `Product.PurchaseOption.simulatesAskToBuyInSandbox(true)` (sandbox only).

### 4.1 Testing without money

- **StoreKit configuration file** (`.storekit`): a local environment "without requiring a connection to App
  Store servers"; local product data never uploads to App Store Connect. Enable per scheme: Edit Scheme →
  Run → Options → StoreKit Configuration. Needs no agreement or App Store Connect record (the comparison
  table marks Xcode "No", sandbox and TestFlight "Yes" for App Store Connect setup). Developer Mode is needed
  on iOS 16+ devices. https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode
- **Test conditions** (select the `.storekit` file → **Editor** menu): Enable Ask to Buy; Enable Interrupted
  Purchases; Simulate StoreKit failures (plus billing-retry for subscriptions).
- **Transaction Manager**: **Debug → StoreKit → Manage Transactions** (or the debug-bar purchases button):
  create a purchase, approve/decline Ask to Buy, resolve an interrupted purchase, refund, delete (to re-test
  one-time paths), inspect. https://developer.apple.com/documentation/xcode/testing-in-app-purchases-with-storekit-transaction-manager-in-code
  (Apple's slug really ends in "-in-code".)
- **Automated tests**: `SKTestSession(configurationFileNamed:)` from the StoreKitTest framework (iOS 14+/
  macOS 11+): `askToBuyEnabled` ("Enabling this property causes all purchases to require approval until you
  disable it."), `interruptedPurchasesEnabled`, `failTransactionsEnabled`, `disableDialogs`,
  `clearTransactions()`, `approveAskToBuyTransaction(identifier:)` / decline, `storefront`, `locale`.
  "All SKTestSession instances control the same test environment." — run such tests serially.
  https://developer.apple.com/documentation/storekittest/sktestsession
- Scenario coverage per Apple's table: Xcode and sandbox both cover refunds, interrupted purchases, failed
  payment authorisation and Ask to Buy deferral; only Xcode forces StoreKit errors and resolves Ask to Buy in
  place; only sandbox exercises real storefront price tiers.
- `Transaction.environment` distinguishes `.xcode` / `.sandbox` / `.production` if the thank-you test needs it.

Open item carried over from `TIP-JAR.md`, still **unverified** by any Apple text found: whether StoreKit 2
works with `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO` on macOS (StoreKit's traffic is brokered by system
daemons, not the app's sockets). Measure it in the build; if the entitlement must change, the sentence in
`ContentView.swift` ("This app opens no network connections") changes with it.

---

## 5. Copy constraints

Apple's text gives no banned-word list for tipping UIs; the constraints are the ones derivable from the
guidelines and the HIG (fetched 2026-10-07; HIG change log September 17, 2026):

- **Do not say** donate / donation / charity / fundraiser / cause / "for a good cause" (3.2.1(vi), 3.2.2(iv);
  HIG assigns donations to Apple Pay). **Do not imply** anything is unlocked, upgraded, removed (ads) or
  prioritised (2.3.1(a); 3.1.1's unlock sentence would then apply to the "feature"). **Do not nag**: the HIG
  says "Let people experience your app before making a purchase."; its only prompting guidance is about
  subscriptions and ties prompts to relevant moments.
- **Do**: "Use simple, succinct product names and descriptions." — Display Name 2–30 chars, Description
  ≤ 45 chars (App Store Connect limits), e.g. names that do not truncate. Show `displayPrice` for every tier:
  "Display the total billing price for each in-app purchase you offer, regardless of type." Hide or explain
  the jar when `canMakePayments` is false: "Display your store only when people can make payments." Keep
  Apple's sheet: "Use the default confirmation sheet." / "Don't modify or replicate this sheet." Match the
  app's own style ("Design an integrated shopping experience.").
- Consumable semantics in the HIG's words: "After purchase, consumable content depletes as people use it,
  and people can purchase it again." — a repeat tip is normal; the UI need not prevent it.
- The decided strings — "Support the project" / "Nothing unlocks; this is a thank-you to the people who build
  Nullecho." — satisfy every rule above. Review notes should state: free app; three consumable tips; no
  feature change; no accounts; label unchanged.

---

## 6. Unverified / not found (so nobody treats them as settled)

- An Apple sentence specific to StoreKit purchases and the privacy label (none found; conclusion rests on the
  definitions in section 1.1). The Purchase History / Identifiers mapping for a hypothetical receipt server
  is our inference.
- A current Apple sentence literally stating consumables are not restorable (legacy guide unreachable).
- Whether App Store Connect blocks submission without a review screenshot.
- `Product.products(for:)` return order.
- Apple's preferred handling of `.unverified` for a product with nothing at stake.
- StoreKit 2 under `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO` on macOS.
- Whether Nullecho's Mac and iOS builds are one App Store Connect record (affects product-id sets).
- Exact revision date printed on the Review Guidelines page (the page carries none; Apple's June 8, 2026 news
  item is the latest revision notice found).
