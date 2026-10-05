# Tip jar — decided 2026-10-05, not built yet

**Decision (owner, 2026-10-05, relayed by the Nullecho director).** The Safari app is free. It carries an
optional tip jar, "Support the project". It is built only after the core (tracker blocking + Global Privacy
Control) is verified on Mac, iPhone and iPad; see `VERIFY-*.md`.

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

## Open items to settle in the tip-jar build (unverified today)

- Whether StoreKit 2 on macOS works inside the app's current sandbox, which has **no outgoing-network
  entitlement** (`ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO`; see `xcode/README.md`). StoreKit talks to the
  system's App Store daemon over XPC, so it is expected to, but it must be measured, and if the entitlement has to
  be added the "this app opens no network connections" sentence in the app changes with it.
- Whether a StoreKit 2 purchase obliges any App Privacy declaration (the purchase history Apple shows the
  developer is Apple's collection; the on-device transaction is not sent anywhere by us). To be checked against
  Apple's App Privacy Details before the label is confirmed.
- The exact thank-you: one line in the app, nothing persistent beyond `Transaction.currentEntitlements` (empty
  for consumables), no badge, no counter.
