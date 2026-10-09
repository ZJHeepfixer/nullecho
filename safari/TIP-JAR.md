# Tip jar — decided 2026-10-05, built 2026-10-07

**Decision (owner, 2026-10-05, relayed by the Nullecho director).** The Safari app is free. It carries an
optional tip jar, "Support the project". It is built only after the core (tracker blocking + Global Privacy
Control) is verified on Mac, iPhone and iPad; see `VERIFY-*.md`.

**Built 2026-10-07** in `xcode/App/TipJar.swift` (model + section, the only file importing StoreKit),
`xcode/Nullecho.storekit`, hosted XCTest bundles for iOS and macOS, an iOS UI test, and seven new
`check-container.mjs` assertions. What was verified and what was not: [`VERIFY-TIP-JAR.md`](VERIFY-TIP-JAR.md).

## Review notes (paste into App Store Connect)

> Nullecho is a free Safari web extension with no accounts, no sign-in and no server. This version adds an
> optional tip jar, "Support the project", at the bottom of the app's single screen (scroll down past "What it
> does not do in Safari" and "If a site misbehaves"). It offers three consumable in-app purchases — Small tip,
> Medium tip, Large tip — through StoreKit. A tip unlocks nothing and changes no feature: the only thing that
> happens after a purchase is a one-line thank-you, which disappears when the app quits. Every feature of the
> app and the extension works identically before and after a tip, so there is nothing to restore and no
> restore button. The app stores no record of a purchase (no UserDefaults, no file, no keychain item, no
> appAccountToken) and sends nothing to any server of ours; the privacy label remains "Data Not Collected"
> (the purchase itself is handled by the App Store's purchase service). To test: scroll to "Support the
> project", tap any price, complete the purchase with a Sandbox account, and observe the thank-you line and
> that nothing else changes. If Screen Time or a management profile disallows purchases on the review device,
> the section is hidden entirely, by design.

## Rules the build must keep

1. **Nothing is gated behind a tip.** Every feature works identically before and after. The only thing that
   changes after a tip is a thank-you.
2. **StoreKit 2, consumable in-app purchases**, about three tiers (working example $1.99 / $4.99 / $9.99; the
   final tiers and product ids are the owner's call). Apple's App Review Guideline 3.1.1 allows tipping through
   IAP; a tip jar that used any other payment method would not pass.
3. **No accounts, no analytics, no receipt server.** Transactions are verified on-device with StoreKit 2's
   `VerificationResult`, finished, and forgotten. No identifier leaves the device for Nullecho's benefit; the
   App Store's own handling of the purchase is Apple's, not ours.
4. **The privacy label stays "Data Not Collected"** unless the tip-jar implementation is found to collect
   something, in which case the label changes to match. Open item below.
5. **The copy stays honest**: "Support the project" / "Nothing unlocks; this is a thank-you to the people who
   build Nullecho." Never "donate" (Apple reserves that wording for registered non-profits), never a promise of
   features, never a nag.

## Owner's actions (never the agent's)

- App Store Connect: create the app record if not yet created, then the consumable products (one per tier),
  their localized display names and prices, and attach them to the version.
- Agreements, Tax, and Banking: the Paid Apps agreement must be active before any IAP can be tested on
  TestFlight or sold.
- App Store Small Business Program enrollment (15 % commission instead of 30 %), if eligible and wanted.
- Signing (team selection in Xcode) for any on-device or TestFlight test.

The build hand-off will include exact click-by-click steps for each of these.

## How it will be verified without real money

- A `.storekit` configuration file in `safari/xcode/` carrying the same product ids; the schemes run with it,
  so the purchase sheet, success, cancellation, failure, interrupted purchase and "Ask to Buy" paths are driven in
  the Simulator and on the Mac with Xcode's StoreKit testing environment and the Transaction Manager.
- Checks that can fail: a test that a tip changes no stored setting and no code path other than the thank-you;
  `safari/tools/check-container.mjs` extended so that the product ids in the `.storekit` file and in code match,
  the tip-jar strings contain no gating or non-profit wording, and the privacy manifest still declares what the
  code does.
- Sandbox testing with a Sandbox Apple Account on a device is the owner's step, after TestFlight.

## The two open questions, answered 2026-10-07

Evidence in [`audit/04-storekit-sandbox.md`](audit/04-storekit-sandbox.md) and
[`audit/05-tip-jar-rules.md`](audit/05-tip-jar-rules.md).

1. **StoreKit 2 works without the outgoing-network entitlement.** Measured with an ad-hoc-signed probe app
   sandboxed exactly like Nullecho's Mac app (`app-sandbox` on, no `network.client`): `Product.products(for:)`
   returned all three consumables with prices, `purchase()` succeeded `.verified`, `finish()` worked, while a
   plain `URLSession` request in the same process failed with the sandbox's DNS denial (the control build with
   the entitlement made the same request succeed). The app process never networks for StoreKit: the system's
   `storekitagent` accepted the probe's XPC connection and made the App Store requests itself, and the sandbox
   profile grants the StoreKit services to every sandboxed app unconditionally. The measurement used Xcode's
   StoreKit test environment; the production path is argued from the same structure and Apple's "The StoreKit
   framework connects to the App Store on your app's behalf", not measured (that needs a signed build and a
   sandbox Apple Account: the owner's step, after TestFlight). **Decision:** keep
   `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO`; change the app's sentence to "This app opens no network
   connections of its own; the two links below are handed to your browser, and a tip is handled by the App
   Store's own purchase service, not by this app."
2. **The privacy label stays "Data Not Collected".** Apple: "You are not responsible for disclosing data
   collected by Apple." and data "processed only on device is not 'collected'". Reading the on-device
   `Transaction` (ids, environment; `appAccountToken` never set) and transmitting nothing creates no duty. What
   would change it: a receipt server, App Store Server Notifications / Server API, analytics, or storing an
   `appAccountToken`.

Design points that follow (from `audit/05`): tips only through IAP (3.1.1); never "donate", "donation",
"charity", "fundraiser" (3.2.1(vi), 3.2.2(iv)); nothing unlocked (2.3.1(a)); no restore button for consumables;
SwiftUI `PurchaseAction` / `ProductView`; `Transaction.updates` listener at launch; `finish()` after the thank-you;
a `.pending` (Ask to Buy) thank-you comes from the listener, possibly next launch; hide the jar when
`AppStore.canMakePayments` is false; sort products by price; `displayPrice` only; `.unverified` gets no thank-you.
Product ids are immutable once created in App Store Connect; the working ids `org.nullecho.tip.small` /
`.medium` / `.large` are the owner's to confirm or rename before he creates them.

## Settled by the build (2026-10-07)

- The thank-you line: "Thank you. Nothing has changed, and that’s the point." Shown after a verified tip,
  gone when the app quits. Ask to Buy shows "Waiting for approval." until the listener thanks.
- Automated tests run on the iOS Simulator (hosted unit tests + a UI test) and on macOS (hosted unit tests);
  `purchase()` from inside the app, Ask to Buy approval via `SKTestSession`, simulated failures and simulated
  verification failures. Results, mutation evidence and the rig's measured quirk (`xcodebuild` does not push
  the scheme's StoreKit configuration; the first test process on an erased Simulator is still in the sandbox
  environment) are in [`VERIFY-TIP-JAR.md`](VERIFY-TIP-JAR.md).

## Still open

- The production purchase path (real App Store servers, Sandbox Apple Account, TestFlight) is the owner's
  step after signing; nothing here measures it.
- `SKTestSession.buyProduct(identifier:)` (an outside purchase) still cannot be exercised on macOS for the
  reason in `audit/04` §3.4; the macOS listener path is covered only by Ask to Buy approval from the session,
  where that works, and by the iOS tests otherwise.
