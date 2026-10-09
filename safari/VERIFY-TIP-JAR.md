# Tip jar — what was built and what was verified (2026-10-07/08)

Branch `safari-tip-jar`. Build host: Xcode 27.0 (27A266a), macOS 26.6; Simulator runtime iOS 27.0 (24A434),
device NE-E-TipJar-iPhone = iPhone 17 Pro. Everything below ran under **Xcode's StoreKit test environment**
(`xcode/Nullecho.storekit`), never against the App Store and never with money. The production purchase path is
the owner's step after signing (TestFlight + a Sandbox Apple Account); nothing here measures it.

## Built

| Piece | What |
|---|---|
| `xcode/App/TipJar.swift` | `TipJar` model (`@Observable`): `Product.products(for:)` sorted by price; `AppStore.canMakePayments` gate; `Transaction.updates` listener started in `init` (the app creates one jar at launch); `tip(_:using:)` takes the SwiftUI `PurchaseAction`; `.success(.verified)` → thanked then `finish()`; `.unverified` → nothing, not finished; `.pending` → "Waiting for approval."; `.userCancelled` → nothing; revoked (refund) → finished, not thanked. No persistence of any kind. `SupportSection` + `TipRow` views (name = `displayName`, button = `displayPrice`, VoiceOver label carries both). |
| `xcode/App/ContentView.swift`, `NullechoApp.swift` | Section placed after "If a site misbehaves", before "More"; hidden entirely when purchases are disallowed. "Collects nothing" now reads: "This app opens no network connections of its own; the two links below are handed to your browser, and a tip is handled by the App Store's own purchase service, not by this app." (the measured truth, `audit/04`). |
| `xcode/Nullecho.storekit` | Three consumables `org.nullecho.tip.small` / `.medium` / `.large`, USD 1.99 / 4.99 / 9.99 (working values), names ≤ 30 chars, descriptions ≤ 45. Attached to both shared schemes' Run action (the Test action inherits it). |
| `xcode/Tests/TipJarTests.swift` | 8 hosted XCTests using `SKTestSession` (iOS and macOS test bundles; see the macOS note under Not verified). |
| `xcode/UITests/TipJarUITests.swift` | 3 XCUITests: the purchase-sheet flow with screenshots; a failed-transaction negative; outside purchase → listener thanks → relaunch shows no phantom thank-you. |
| `tools/check-container.mjs` | 6 new assertions (18 total): product ids match between code and `.storekit` (three consumables); both schemes attach the file; no banned words (donate/charity/fundraiser/cause/unlock/upgrade/premium/pro/remove ads) in app copy or product strings; no persistence API; `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO` still; the new network sentence present and the old absolute one gone. `--self-test`: 35 mutations, each caught by exactly the intended check. |
| `TIP-JAR.md` | Review-notes paragraph for App Store Connect; the settled thank-you line. |

`ENABLE_OUTGOING_NETWORK_CONNECTIONS` stays `NO`; the privacy label stays "Data Not Collected" (`audit/05` §1).

## Automated tests (iPhone 17 Pro simulator, iOS 27.0)

`xcodebuild test -scheme "Nullecho (iOS)" -only-testing:"Nullecho Tests (iOS)" CODE_SIGNING_ALLOWED=NO`, real code,
2026-10-08: **8 tests, 0 failures** (`testAskToBuyIsPendingThenThankedByTheListener`, `testCancelledTipLeavesNoTrace`,
`testFailedTipLeavesNoTrace`, `testModelHoldsOnlyTransientState`, `testProductsLoadSortedByPriceWithDisplayPrices`,
`testTipLeavesDefaultsAndContainerUntouched`, `testUnverifiedTipIsNeitherThankedNorFinished`,
`testVerifiedTipOfEachTierIsThankedAndFinished`). Also 50/50 extension tests (`node --test 'safari/test/*.test.mjs'`).

### Mutations: each applied to `TipJar.swift`, run against the test meant to catch it, then reverted

| Mutation | Test | Result |
|---|---|---|
| thank on `.unverified` | `testUnverifiedTipIsNeitherThankedNorFinished` | **FAILED** (2 assertions): `XCTAssertEqual failed: ("thanked") is not equal to ("none") - an unverified transaction must not be thanked` |
| thank on `.pending` instead of "waiting" | `testAskToBuyIsPendingThenThankedByTheListener` | **FAILED**: `("thanked") is not equal to ("waitingForApproval") - Ask to Buy must show the waiting line, not a thank-you` |
| sort products by price descending | `testProductsLoadSortedByPriceWithDisplayPrices` | **FAILED** (2): ids out of order; `("[9.99, 4.99, 1.99]") is not equal to ("[1.99, 4.99, 9.99]")` |
| add a stored field (`tipCount`) | `testModelHoldsOnlyTransientState` | **FAILED**: the model's stored properties are no longer exactly `products`, `outcome`, `listener` |
| hard-code "$1.99" in the button | `check-container.mjs tipjar-prices` | **caught** by the static check (self-test) |
| remove `finish()` | all of the above and the relaunch UI test | **NOT caught — see the honest limit below** |

### The honest limit: `finish()` is not observable in Xcode's test environment

Measured 2026-10-08 against a build with `finish()` removed:

- `Transaction.unfinished` came back **empty** 0.3 s, 15 s, 42 s and 355 s after each purchase (three tiers).
- `Transaction.all` (which excludes finished consumables) came back **empty** too.
- After an outside purchase (`SKTestSession.buyProduct`) and a relaunch, the transaction was **not** re-delivered
  on `Transaction.updates` within ~40 s, so no phantom thank-you appeared on the broken build either.

So no automated test here can tell a finished consumable from an unfinished one. `finish()` is covered by
code review (`TipJar.receive`, one path, called for every verified transaction) and by the owner's sandbox pass,
where the symptom of a missing `finish()` would be the thank-you reappearing on every launch. The two listings
stay in the tests as regression guards for what they do see.

Rig notes (measured): `xcodebuild test` does not push the scheme's StoreKit configuration into the Simulator; the
`SKTestSession` inside the tests plants it and the daemon keeps it per bundle id, so the first test process on a
fresh Simulator talks to the sandbox store and fails to load products (`Scripts/test-tipjar.sh` primes once).
Under heavy host load the test environment also produced sporadic `StoreKitInternalError.unknown` on
`finish()`/`purchase()` (one tier of one run); re-runs were clean. Collect diagnostics with
`-collect-test-diagnostics never`, or a failed run spends ten minutes in `simctl diagnose`.

## Rendered (iOS 27.0 Simulator, XCUITest-driven; all under `verify/2026-10-08/`)

| Device | Appearance / size | State | Screenshot |
|---|---|---|---|
| iPhone 17 Pro | light | tiers, then the thank-you after an outside purchase reached the listener | `tipjar-iphone-thanks-from-listener.png` |
| iPhone 17 Pro | light | after relaunch: tiers present, no thank-you | `tipjar-iphone-after-relaunch.png` |
| iPhone 17 Pro | dark | section before a tip | `tipjar-iphone-dark-section.png` |
| iPhone 17 Pro | dark | thank-you after a tip | `tipjar-iphone-dark-thanks.png` |
| iPad Pro 11" (M5) | light | section, with the updated "Collects nothing" sentence above it | `tipjar-ipad-light-section.png` |
| iPad Pro 11" (M5) | light | thank-you after a tip | `tipjar-ipad-light-thanks.png` |
| iPad Pro 11" (M5) | dark | thank-you after a tip | `tipjar-ipad-dark-thanks.png` |
| iPad Pro 11" (M5) | light | **negative**: `failTransactionsEnabled`, after tapping a tier — no thank-you, 0 purchases | `tipjar-ipad-failed-purchase-no-thanks.png` |
| iPad Pro 11" (M5) | light, accessibility-large text | section: name stacked above the price button | `tipjar-ipad-accessibility-large-section.png` |
| iPad Pro 11" (M5) | light, accessibility-large text | the test environment's own purchase sheet ("Xcode … For testing purposes only") over the section | `tipjar-ipad-accessibility-large-purchase-sheet.png` |

Two things about the sheet. In most runs it did not appear at all: an earlier `SKTestSession` had set `disableDialogs = true`
and the Simulator's StoreKit daemon keeps that per bundle id, so a tap purchased silently and the test logged
"purchase completed without a sheet". In the one run where the sheet did appear, XCUITest found its Purchase button
on SpringBoard but the purchase did not complete within the test's 30 s window, so **confirming Apple's sheet by
automation is unverified**; the thank-you path itself is proven by the silent-purchase runs and the listener run.
The owner's TestFlight pass uses the real sheet.

## Not verified

- The production purchase path (App Store servers, Sandbox Apple Account, TestFlight): owner's step.
- `finish()` (see the limit above).
- macOS: the app and its test bundle build. Hosted unit tests on the Mac (ad-hoc signed, 2026-10-08): the four
  tests that need no purchase pass (products load sorted with prices; cancelled and failed tips leave no trace;
  the model holds only transient state); the four that complete a purchase fail because `purchase()` returns no
  transaction in this rig (`StoreKitError.unknown`; the same Launch Services limit `audit/04` §3.4 hit for an
  unregistered local app). Fully unsigned (`CODE_SIGNING_ALLOWED=NO`) the Mac test environment returns no
  products at all. So the macOS purchase and thank-you path is **unverified here**; the owner's TestFlight pass
  on the Mac is the measurement.
- Ask to Buy on a real family account; refunds (the revoked path is unit-tested only).

## Owner's next steps

1. Confirm or rename the three product ids and the price tiers (`TipJar.productIDs`, `Nullecho.storekit`).
   Ids are immutable once created in App Store Connect.
2. App Store Connect, in Apple's menu labels (`audit/05-tip-jar-rules.md` §3): Business ▸ Agreements ▸ Paid
   Apps ▸ View and Agree; Tax Forms; Bank Accounts (the agreement must be Active before any sandbox or TestFlight
   purchase works). Then Apps ▸ Nullecho ▸ Monetization ▸ In-App Purchases ▸ + ▸ Consumable, three times
   (reference name, product id, price, display name, description, review screenshot, review notes), and attach
   them to the version. Users and Access ▸ Sandbox ▸ + for a Sandbox Apple Account. Consider the Small Business
   Program before the first sale.
3. TestFlight on Mac and iPhone: make one small tip with the Sandbox account, see the thank-you, quit and
   relaunch, confirm the thank-you does not come back on its own.
