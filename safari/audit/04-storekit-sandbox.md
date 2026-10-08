# Nullecho for Safari — StoreKit 2 inside the no-network macOS sandbox (D)

Date: 2026-10-07. Environment: Xcode 27.0 (27A266a), macOS 26.6 (build 25G5043d, Darwin 25.6.0), iOS 27.0
Simulator runtime 24A434. No Apple Developer team was used; every build is ad-hoc signed
(`CODE_SIGN_IDENTITY=-`). Nothing in the Nullecho project was built, run or modified; the Nullecho macOS app
was never launched (launching it would register its extension with the owner's Safari). No keychain, signing
identity, System Setting, App Store sign-in or password was touched. The only thing run was a throw-away probe
app of its own (`NullechoStoreKitProbe`, bundle id `org.nullecho.probe.storekit`), built in a scratch folder
outside the repo; its sources are reproduced in appendix C.

Evidence rule: every claim is (a) a command run on this machine with its output reproduced (paths and
identifiers that would name the owner or the machine are replaced by `<scratch>`, `<user>`, `<udid>`),
(b) an Apple page cited by URL and fetched on 2026-10-07, paraphrased except for exactly one short direct
quotation (section 6), or (c) marked **unverified**.

---

## 0. Verdict

**Question.** Does StoreKit 2 work in a macOS app that is sandboxed *without* `com.apple.security.network.client`
(Xcode `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO`), which is how Nullecho's macOS app target is built?

| Path | Verdict | Basis |
|---|---|---|
| **Xcode StoreKit-testing path** (StoreKitTest `SKTestSession`, local `.storekit` configuration) | **Works, measured.** In a host process that is provably sandboxed and provably without `network.client` (a plain `URLSession` to a public host fails with the sandbox's DNS denial in 0.03 s), `Product.products(for:)` returned the three consumables with prices, `purchase()` returned `.success(.verified)`, `finish()` completed. Same result with the entitlement added (control), where the `URLSession` request succeeds instead. | Section 3 (runs 02, 03, 08 sandboxed; run 04 control) |
| **Production path** (real App Store / sandbox-account servers) | **Not measured** (no team, no App Store Connect record, no sandbox Apple Account: unverifiable here). **Strongly indicated to work, for a structural reason that is not StoreKitTest-specific**: the app process never opens a network connection for StoreKit at all. Both in the measurement and in Apple's own description, the app talks over XPC to the system's StoreKit agent (`storekitagent`, a launchd agent owned by `StoreKit.framework`), and *that* process performs the HTTP requests. The macOS App Sandbox profile allows the StoreKit Mach services to every sandboxed app unconditionally, while it gates `network-outbound` on `network.client`. In the test run the agent's HTTP request went to a loopback test server; in production the same agent would talk to Apple's servers, which the app's entitlements do not govern. | Sections 2, 3.3, 6 |
| **Nullecho's entitlement** | **Keep `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO`.** Nothing measured or documented requires `network.client` for StoreKit 2. | — |
| **Nullecho's sentence** "This app opens no network connections" | **Stays literally true for the app process** after a tip jar is added (the app still opens no socket; the sandbox still forbids it). Because a purchase visibly involves the App Store, the honest wording should say so; proposed text in section 7. | Section 7 |
| **iOS Simulator** (needed for the later tip-jar verification) | **Works, measured**, with one rig requirement: on the iOS 27 Simulator, an `SKTestSession` created in the test was *not* enough to keep `purchase()` inside the Xcode test environment — the purchase fell through to the real sandbox store and the Simulator showed an Apple Account sign-in sheet (nothing was entered; the run was aborted). With the `.storekit` file also attached to the scheme's Run action, all four tests pass, including a purchase injected from outside the app arriving on `Transaction.updates`. | Section 4 |

Attack on the result (what the measurement does and does not prove) is in section 5.

---

## 1. What is being mirrored

Nullecho's macOS app target (`safari/xcode/Nullecho.xcodeproj/project.pbxproj`, both configurations; no
`.entitlements` file exists in the project, the entitlements are synthesised from these settings):

```
ENABLE_APP_SANDBOX = YES;
ENABLE_HARDENED_RUNTIME = YES;
ENABLE_INCOMING_NETWORK_CONNECTIONS = NO;
ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO;
PRODUCT_BUNDLE_IDENTIFIER = org.nullecho.app;
```

The sentence under test, `safari/xcode/App/ContentView.swift` line 240:
"No account, no analytics, no crash reports, no server. This app opens no network connections; the two links
below are handed to your browser." `safari/tools/check-container.mjs` (`no-network` check, lines 287–305)
asserts the same statically: no `URLSession` / `URLRequest` / `NWConnection` / web-view symbols in `App/`,
`ENABLE_OUTGOING_NETWORK_CONNECTIONS` must be `NO`, and no `.entitlements` file may grant `network.client`.
`import StoreKit` and `Product.purchase` are not on its forbidden list, so a StoreKit 2 tip jar does not trip
that check as written.

The probe (`NullechoStoreKitProbe`, appendix C) copies exactly those five settings onto its macOS app target,
hosts an XCTest bundle inside that app, links `StoreKitTest.framework`, and carries `Probe.storekit` with three
consumables `org.nullecho.tip.small` / `.medium` / `.large` at 1.99 / 4.99 / 9.99 (USA storefront, `en_US`).

Build and test commands (all from the scratch folder; `<dd>` is a DerivedData folder inside it):

```sh
# sandboxed, Nullecho posture
xcodebuild test -project NullechoStoreKitProbe/NullechoStoreKitProbe.xcodeproj -scheme ProbeMac \
  -destination 'platform=macOS' CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=YES -derivedDataPath <dd>
# control: identical, plus
#   ENABLE_OUTGOING_NETWORK_CONNECTIONS=YES 'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) PROBE_CONTROL'
#   -derivedDataPath <dd-control>
# iOS Simulator (device created for this run and shut down afterwards)
xcrun simctl create "NE-D-StoreKit-iPhone" com.apple.CoreSimulator.SimDeviceType.iPhone-17 \
  com.apple.CoreSimulator.SimRuntime.iOS-27-0
xcodebuild test -project NullechoStoreKitProbe/NullechoStoreKitProbe.xcodeproj -scheme ProbeiOS \
  -destination 'platform=iOS Simulator,id=<udid>' CODE_SIGNING_ALLOWED=NO -derivedDataPath <dd-ios>
```

Ad-hoc signing with the sandbox entitlement was **not** refused: the build log shows
`Signing Identity: "Sign to Run Locally"` for the app and the test bundle, and `codesign -dv` on the product
reports `Signature=adhoc`, `TeamIdentifier=not set`, `flags=0x2(adhoc)`. (The hardened-runtime flag `0x10000`
is absent from that Debug test-host signature; hardened runtime is orthogonal to the sandbox question and was
not pursued.)

---

## 2. Static evidence

### 2.1 Entitlements of the built, sandboxed probe (`codesign -d --entitlements - <app>`)

```
[Dict]
	[Key] com.apple.security.app-sandbox                         [Bool] true
	[Key] com.apple.security.get-task-allow                      [Bool] true
	[Key] com.apple.security.temporary-exception.files.absolute-path.read-only
	[Value] [Array] [String] /
	[Key] com.apple.security.temporary-exception.mach-lookup.global-name
	[Value] [Array] [String] com.apple.testmanagerd
	                [String] com.apple.dt.testmanagerd.runner
	                [String] com.apple.coresymbolicationd
```

No `com.apple.security.network.client`, no `network.server`. The three extra keys are what Xcode injects into
any app that is a unit-test host (debugger attach, test-manager XPC, read access for symbolication); they are
not in Nullecho's build, and none of them names a StoreKit service, so they do not help StoreKit. The control
build's dump is identical plus `com.apple.security.network.client [Bool] true`.

### 2.2 The macOS App Sandbox profile allows StoreKit's XPC services to every sandboxed app

`/System/Library/Sandbox/Profiles/application.sb` (macOS 26.6; file dated Jun 10, sha256
`2e711078…089218`) and `appsandbox-common.sb` (sha256 `b9ffebd2…bcea`):

```
; application.sb line 110 — outbound networking is conditional on the entitlement:
(when (entitlement "com.apple.security.network.client") (network-client))

; appsandbox-common.sb 414–427 — what that unlocks:
(define (network-client)
  (system-network)
  (allow network-outbound (remote ip))
  (allow mach-lookup (global-name "com.apple.NetworkDiagnostic.agent" … "com.apple.nsurlsessiond")))

; application.sb line 705 — StoreKit is NOT conditional (paren depth 0, i.e. top level, verified by script):
(storekit)

; appsandbox-common.sb 721–728:
(define (storekit)
  (allow mach-lookup
         (global-name
           "com.apple.storeagent.storekit"
           "com.apple.storeagent.storekit.receiptrenewal"
           "com.apple.storekit.configuration.xpc"
           "com.apple.storekitagent"
           "com.apple.storekitservice")))

; application.sb 759–762 — and DNS is explicitly cut off without the network entitlements:
(unless (or (entitlement "com.apple.security.network.client")
            (entitlement "com.apple.security.network.server"))
  (deny network-outbound (literal "/private/var/run/mDNSResponder")))
```

The process on the other end: `/System/Library/LaunchAgents/com.apple.storekitagent.plist` runs
`/System/Library/Frameworks/StoreKit.framework/Support/storekitagent` and registers the Mach services
`com.apple.storekitagent`, `com.apple.storekit.configuration.xpc`, `com.apple.aps.storekitservice`,
`com.apple.storekitservice.sim2host`. It is a system agent; the app's sandbox profile does not apply to it.

---

## 3. Measurement on macOS

Four test methods, all hosted inside the sandboxed probe app process (every line prefixed `PROBE` is printed
by the test; `Test Case` lines are XCTest's):

- **A** reads the *running process's* entitlements with `SecTaskCopyValueForEntitlement` and
  `APP_SANDBOX_CONTAINER_ID`; asserts sandboxed and (non-control build) **no** `network.client`.
- **B** performs a plain `URLSession` GET of `https://www.apple.com/library/test/success.html`; asserts it
  **fails** when the process lacks `network.client` and **succeeds** when it has it.
- **C** `SKTestSession(configurationFileNamed: "Probe")`, `disableDialogs = true`, `clearTransactions()`;
  `Product.products(for:)` for the three ids (asserts 3, consumable, price > 0, non-empty `displayPrice`);
  `purchase()` → asserts `.success(.verified(tx))`, `tx.productID`, `tx.environment == .xcode`; `tx.finish()`;
  also records (no assertion) whether `Transaction.updates` saw the app's own purchase.
- **D** starts a `Transaction.updates` listener, injects a purchase from *outside* the app with
  `SKTestSession.buyProduct(identifier:)`, asserts the listener receives it verified.

### 3.1 Sandboxed run (run 08, final code; runs 02 and 03 gave the same A/B/C results)

```
PROBE host bundle id = org.nullecho.probe.storekit
PROBE host executable = NullechoStoreKitProbe
PROBE APP_SANDBOX_CONTAINER_ID = org.nullecho.probe.storekit
PROBE entitlement com.apple.security.app-sandbox = Optional(1)
PROBE entitlement com.apple.security.network.client = nil
PROBE entitlement com.apple.security.network.server = nil
PROBE entitlement com.apple.security.get-task-allow = Optional(1)
PROBE os = Version 26.6 (Build 25G5043d)
PROBE build flavour = NULLECHO POSTURE (expects NO network.client)
Test Case '-[ProbeMacTests.ProbeTests testA_HostProcessPosture]' passed (0.001 seconds).
PROBE URLSession GET https://www.apple.com/library/test/success.html -> FAILED: domain=NSURLErrorDomain code=-1003
  description="A server with the specified hostname could not be found."
  underlying=[kCFErrorDomainCFNetwork -1003 The operation couldn’t be completed. (kCFErrorDomainCFNetwork error -1003.)] (0.00s)
Test Case '-[ProbeMacTests.ProbeTests testB_PlainURLSessionToPublicHost]' passed (0.010 seconds).
PROBE SKTestSession ready; storefront=USA locale=en_US
PROBE Product.products(for:) returned 3 products
PROBE product id=org.nullecho.tip.small type=Consumable displayName="Small tip" displayPrice=$1.99 price=1.99
PROBE product id=org.nullecho.tip.medium type=Consumable displayName="Medium tip" displayPrice=$4.99 price=4.99
PROBE product id=org.nullecho.tip.large type=Consumable displayName="Large tip" displayPrice=$9.99 price=9.99
PROBE purchase -> .success(.verified): txid=0 product=org.nullecho.tip.small type=Consumable environment=Xcode storefront=USA revoked=false
PROBE transaction 0 finished
PROBE SKTestSession.allTransactions() count=1 states=["org.nullecho.tip.small:1"]
PROBE Transaction.updates during this app's own purchase(): not delivered within 3s
Test Case '-[ProbeMacTests.ProbeTests testC_StoreKit2ProductsAndPurchase]' passed (4.086 seconds).
PROBE testD preloaded 3 products
PROBE SKTestSession.buyProduct(identifier:) THREW: unknown domain=StoreKit.StoreKitError code=2 userInfo=[:]
… error: -[ProbeMacTests.ProbeTests testD_TransactionUpdatesFromOutsideThisApp] : failed: caught error: "unknown"
Test Case '-[ProbeMacTests.ProbeTests testD_TransactionUpdatesFromOutsideThisApp]' failed (0.709 seconds).
	 Executed 4 tests, with 2 failures (2 unexpected) in 4.806 (4.808) seconds
```

A, B, C pass; D is a StoreKitTest-on-macOS limitation, identical in the control run (3.2), discussed in 3.4.

Unified log captured during the same run (`log stream`, process `NullechoStoreKitProbe`, pid 73184):

```
kernel (Sandbox) Sandbox: NullechoStoreKitProbe(73184) deny(1) mach-lookup com.apple.dnssd.service
kernel (Sandbox) Sandbox: NullechoStoreKitProbe(73184) deny(1) network-outbound /private/var/run/mDNSResponder
NullechoStoreKitProbe [com.apple.network:] nw_resolver_can_use_dns_xpc_block_invoke Sandbox does not allow access to com.apple.dnssd.service
NullechoStoreKitProbe [com.apple.network:connection] nw_resolver_create_dns_service_locked [C1.1.1] DNSServiceCreateDelegateConnection failed: ServiceNotRunning(-65563)
NullechoStoreKitProbe [com.apple.CFNetwork:Default] Connection 1: failed to connect 10:-72000, reason -1
```

So the `-1003` is the sandbox refusing DNS, exactly the profile rule quoted in 2.2: the "no network" posture is
real, not nominal. Mach services the same process *did* activate (counted from the `com.apple.xpc:connection`
"activating connection" lines): `com.apple.storekitagent` ×8, `com.apple.storekit.configuration.xpc` ×1, and
**no** sandbox denial for either. The only denials in all sandboxed runs were `com.apple.dnssd.service`,
`/private/var/run/mDNSResponder` (the URLSession test), `com.apple.AppSSO.service-xpc` and
`com.apple.usymptomsd` (unrelated system chatter at launch).

### 3.2 Control run (run 04: `ENABLE_OUTGOING_NETWORK_CONNECTIONS=YES`, `PROBE_CONTROL` flag)

```
PROBE entitlement com.apple.security.app-sandbox = Optional(1)
PROBE entitlement com.apple.security.network.client = Optional(1)
PROBE build flavour = CONTROL (expects network.client present)
Test Case '-[ProbeMacTests.ProbeTests testA_HostProcessPosture]' passed (0.001 seconds).
PROBE URLSession GET https://www.apple.com/library/test/success.html -> SUCCEEDED: HTTP 200, 68 bytes (0.65s)
Test Case '-[ProbeMacTests.ProbeTests testB_PlainURLSessionToPublicHost]' passed (0.662 seconds).
PROBE Product.products(for:) returned 3 products
PROBE purchase -> .success(.verified): txid=0 product=org.nullecho.tip.small type=Consumable environment=Xcode storefront=USA revoked=false
Test Case '-[ProbeMacTests.ProbeTests testC_StoreKit2ProductsAndPurchase]' passed (0.640 seconds).
PROBE SKTestSession.buyProduct(identifier:) THREW: unknown domain=StoreKit.StoreKitError code=2 userInfo=[:]
Test Case '-[ProbeMacTests.ProbeTests testD_TransactionUpdatesFromOutsideThisApp]' failed (0.542 seconds).
```

Log for this pid: `activating connection … name=com.apple.dnssd.service` (allowed now), no Sandbox denials,
and the same `com.apple.storekitagent` ×8 / `com.apple.storekit.configuration.xpc` ×1. The entitlement flips
the `URLSession` result and changes nothing about StoreKit — which is the point of the control.

### 3.3 What the system agent did meanwhile (daemon side, `log show`, process `storekitagent`, run 02)

```
storekitagent Accepting new connection NullechoStoreKitProbe[56064]
storekitagent [com.apple.storekit:General] [StoreKitServiceConnection(56064)]: -[StoreKitServiceConnection xcodeTestServerPortWithReplyBlock:]
storekitagent [com.apple.storekit:Default] Saving Octane configuration for org.nullecho.probe.storekit
storekitagent [com.apple.storekit:Default] [Default] products(with:receiver:reply:)
storekitagent [com.apple.storekit:Default] [Default] Running task with context: ([Client] org.nullecho.probe.storekit (NullechoStoreKitProbe) XcodeTest(file:///<user>/Library/Caches/com.apple.storekitagent/Octane/org.nullecho.probe.storekit/))
storekitagent [com.apple.storekit:Default] Requesting Media API product batch ["org.nullecho.tip.large", "org.nullecho.tip.medium", "org.nullecho.tip.small"]
storekitagent [com.apple.AppleMediaServices:url-loading] AMSURLRequestEncoder: Encoding request for URL: http://localhost:<port>/v1/catalog/US/in-app-purchasables?REDACTED
storekitagent [com.apple.network:connection] [C3 … tcp, bundle id: org.nullecho.probe.storekit, …] … interface: lo0
storekitagent [com.apple.storekit:Purchase] [BFEA8D9A_SK2] Running payment for <private>
storekitagent [com.apple.storekit:Purchase] [BFEA8D9A_SK2] Payment complete
storekitagent [com.apple.storekit:Default] [14278aa0_SK2] finishTransaction(_:reply:)
storekitagent [com.apple.storekit:Default] [14278aa0_SK2] Finishing transaction <private> for org.nullecho.probe.storekit
```

This is the structural fact behind the verdict: the HTTP request for the product catalogue and the payment
run inside `storekitagent`, a system process, on behalf of the sandboxed client. In the Xcode test
environment ("Octane") the agent's request goes to a loopback test server on `lo0`; the app process issues no
network request in either environment, which is why its lack of `network.client` is irrelevant to StoreKit.

### 3.4 `Transaction.updates` on macOS

- The app's own `purchase()` was **not** echoed on `Transaction.updates` within 3 s (both runs). This matches
  Apple's documentation of `updates` as the stream for transactions that happen outside the app or on other
  devices, with same-device purchases delivered through the `purchase()` result (section 6, item 5).
- `SKTestSession.buyProduct(identifier:)` — the StoreKitTest way to simulate an outside purchase — threw
  `StoreKitError.unknown` (code 2) in **every** macOS run, with and without `network.client`; the probe's log
  shows `(Foundation) Off-device purchase of org.nullecho.tip.medium failed: Unable to Complete Request` and
  `Received error that does not have a corresponding StoreKit Error: Error Domain=ASOctaneSupportXPCService.TransactionError Code=3`,
  while `storekitagent` logged `Error Domain=NSOSStatusErrorDomain Code=-10814 "kLSApplicationNotFoundErr"`
  for the probe's bundle id on every push-style action (the ad-hoc app in a scratch folder is not a
  LaunchServices-registered app). **Unverified** which of the two is the cause; it is not a sandbox-network
  effect (identical in the control), and the same test passes on the iOS Simulator (section 4). For the tip
  jar this means: the `Transaction.updates` listener itself runs fine in the sandbox (it registered, the daemon
  logged `Registering for 'transactionsupdated' daemon notification` and answered its query with 0
  transactions), but the macOS *automated* check of an outside purchase will need either a LaunchServices-
  registered build or Xcode's Transaction Manager by hand. Leave it in `TIP-JAR.md` as an open rig item.

---

## 4. Measurement on the iOS 27 Simulator

Device `NE-D-StoreKit-iPhone` (iPhone 17, runtime iOS 27.0 24A434), created for this run, shut down
afterwards and left in place for the tip-jar verification (no other simulator was touched).

**First attempt (SKTestSession only, no scheme attachment): purchase left the test environment.** Products
loaded under the Xcode test context, but `purchase()` never returned; the Simulator displayed a system
"Sign in to Apple Account" sheet. Daemon log (`storekitd` in the Simulator):

```
storekitd [com.apple.storekit:XcodeTest] Fetching the Octane server port is no longer supported
storekitd [com.apple.storekit:Purchase] StoreKitServiceConnection(60773): [B9C12A44_SK2] Adding payment for org.nullecho.tip.small and quantity 1
storekitd [com.apple.AppleMediaServices:url-loading] AMSURLRequestEncoder: Encoding request for URL: https://sandbox.itunes.apple.com/WebObjects/MZInit.woa/wa/initiateSession?RED…
storekitd [com.apple.storekit:Default] [B9C12A44_SK2] [AccountManager] Starting [Client] org.nullecho.probe.storekit (NullechoStoreKitProbe) Sandbox authentication
storekitd [com.apple.storekit:Default] [B9C12A44_SK2] Authenticating with no active account for sandbox
```

Nothing was typed into that sheet; `xcodebuild` was killed and the app terminated. (Why this differs from
macOS 26.6, whose agent still answers the legacy `xcodeTestServerPort` call, is **unverified**; the line
"no longer supported" suggests the iOS 27 daemon dropped the SKTestSession-only route for purchases.)

**Second attempt: `.storekit` also attached to the scheme's Run action** (`StoreKitConfigurationFileReference`
in the `.xcscheme`, which is how `TIP-JAR.md` already plans to run the real schemes). Everything passes:

```
PROBE os = Version 27.0 (Build 24A434)
Test Case '-[ProbeiOSTests.ProbeTests testA_HostProcessPosture]' passed (0.003 seconds).
PROBE URLSession GET https://www.apple.com/library/test/success.html -> SUCCEEDED: HTTP 200, 68 bytes (0.32s)
Test Case '-[ProbeiOSTests.ProbeTests testB_PlainURLSessionToPublicHost]' passed (0.328 seconds).
PROBE Product.products(for:) returned 3 products
PROBE product id=org.nullecho.tip.small type=Consumable displayName="Small tip" displayPrice=$1.99 price=1.99
PROBE product id=org.nullecho.tip.medium type=Consumable displayName="Medium tip" displayPrice=$4.99 price=4.99
PROBE product id=org.nullecho.tip.large type=Consumable displayName="Large tip" displayPrice=$9.99 price=9.99
PROBE purchase -> .success(.verified): txid=0 product=org.nullecho.tip.small type=Consumable environment=Xcode storefront=USA revoked=false
PROBE transaction 0 finished
PROBE Transaction.updates during this app's own purchase(): not delivered within 3s
Test Case '-[ProbeiOSTests.ProbeTests testC_StoreKit2ProductsAndPurchase]' passed (3.644 seconds).
PROBE SKTestSession.buyProduct(identifier:) -> txid=1 product=org.nullecho.tip.medium
PROBE Transaction.updates -> verified txid=1 product=org.nullecho.tip.medium environment=Xcode
Test Case '-[ProbeiOSTests.ProbeTests testD_TransactionUpdatesFromOutsideThisApp]' passed (0.701 seconds).
	 Executed 4 tests, with 0 failures (0 unexpected) in 4.675 (4.678) seconds
** TEST SUCCEEDED **
```

(iOS has no `network.client` concept; A only records, B asserts the Simulator can reach the network. The
second attempt also carried a 45 s timeout guard around `purchase()`, which did not trigger. Whether the scheme
attachment alone fixed it, or the configuration the first session had already saved in the daemon contributed,
was not bisected; the rig to keep is "SKTestSession **and** scheme-attached configuration".)

---

## 5. What is proven, what is not

Proven on this machine:

1. A macOS process that is sandboxed and has no `network.client` (entitlement read from the live process,
   DNS denied by the kernel sandbox, `URLSession` failing in 0.03 s) can use StoreKit 2 through
   `StoreKit.framework`: product lookup, purchase, verification result, finish. Ad-hoc signing is enough for the
   sandbox to be enforced in a local run.
2. StoreKit's network I/O happens in `storekitagent`, not in the app, and the App Sandbox profile admits the
   StoreKit Mach services unconditionally. These two facts are independent of the StoreKit testing environment.
3. The negative control behaves as expected, so the sandbox assertion is not vacuous.

Not proven:

4. **The production path end to end.** The daemon's HTTP request went to a loopback test server because the
   configuration was active; against Apple's servers the agent's *own* networking, account state and signing
   are involved. Nothing in that chain runs in the app process or is subject to the app's entitlements, but it
   was not exercised (would need a team, an App Store Connect record and a sandbox Apple Account; owner's step
   after TestFlight per `TIP-JAR.md`). Classify as **unverified; expected to work for the reasons in 2 and 6**.
5. Any StoreKit **view** (`ProductView`, `StoreView`, `SubscriptionStoreView`): not used by the probe. They render
   through the same framework and daemon, but if the tip jar adopts them, re-run this probe with one of them in
   the sandboxed host before trusting it.
6. `Transaction.updates` receiving an outside purchase on macOS in automation (3.4).
7. Hardened runtime + library validation under a real Developer ID / App Store signature (test host was ad-hoc).

---

## 6. What Apple's documentation says (fetched 2026-10-07)

1. **`com.apple.security.network.client`** — https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client
   Paraphrase: the key lets a *sandboxed app* connect to a server process, on another machine or the same one;
   for TCP it restricts only the initiation of a connection; added in Xcode via App Sandbox → Network →
   Outgoing Connections (Client). It is defined in terms of what the app process itself may initiate; it says
   nothing about work other processes do for the app.
2. **App Sandbox** — https://developer.apple.com/documentation/security/app-sandbox and
   https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox
   Paraphrase: the sandbox limits the app's access to resources requested through entitlements; it is required
   for Mac App Store distribution; apps needing network connections must add the relevant entitlement. Neither
   page lists StoreKit or In-App Purchase among things that need an entitlement or among restricted activities
   (the "incompatible with App Sandbox" list in
   https://developer.apple.com/documentation/security/protecting-user-data-with-app-sandbox is authorization
   services, assistive accessibility APIs, Apple Events to arbitrary apps, kernel extensions, etc.).
3. **In-App Purchase overview** — https://developer.apple.com/documentation/storekit/in-app-purchase
   The one direct quotation in this document: "The StoreKit framework connects to the App Store on your app's
   behalf" (the sentence continues: to prompt for and securely process payments, then notifies the app). This is
   the production-path statement: the framework, not the app's code, performs the App Store communication;
   section 3.3 shows that on macOS the framework delegates it to the `storekitagent` process.
4. **Setting up StoreKit Testing in Xcode** — https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode
   Paraphrase: a local test environment that needs no connection to App Store servers; when a configuration is
   active the app gets StoreKit data from the test environment instead of App Store Connect or the sandbox
   server; it is enabled per scheme under Run → Options → StoreKit Configuration; the local product data never
   reaches App Store Connect or App Store-signed builds. This is the honest limit of section 3: the measurement
   proves the client-to-agent path, with the agent fed by local data.
5. **`Transaction.updates`** — https://developer.apple.com/documentation/storekit/transaction/updates
   Paraphrase: emits transactions created or updated outside the app or on other devices (Ask to Buy, offer
   codes, App Store purchases); after a successful purchase on the same device the transaction comes back
   through `success(_:)`; keep a listening `Task` from launch. Consistent with the "not delivered within 3s"
   observation in C.
6. **StoreKitTest / `SKTestSession`** — https://developer.apple.com/documentation/storekittest and
   https://developer.apple.com/documentation/storekittest/sktestsession
   Paraphrase: the framework makes StoreKit testing available to unit and CI tests; one shared test
   environment, run tests serially; a configuration file is required; `disableDialogs = true` runs without UI.
   Apple engineer on the developer forums (https://developer.apple.com/forums/thread/666008, 2020): for the
   configuration to be used by unit tests you must create and keep a reference to an `SKTestSession`. (The iOS 27
   Simulator additionally needed the scheme attachment, section 4; the thread predates it.)
7. **Testing at all stages** — https://developer.apple.com/documentation/storekit/testing-at-all-stages-of-development-with-xcode-and-the-sandbox
   Paraphrase: StoreKit Testing in Xcode works without a network connection, in Simulator or on devices; the
   sandbox environment (sandbox Apple Account) and TestFlight exercise App Store Connect data end to end.
8. **Analogous Apple statement on frameworks that network out of process** —
   https://developer.apple.com/forums/thread/744961 (DTS engineer, 2024, about MapKit, *not* StoreKit):
   paraphrase — MapKit does its work in a separate process that the app's sandbox configuration does not
   affect, hence no outgoing-connections entitlement is needed for it. Cited only as Apple describing the
   same mechanism the logs in 3.3 show for StoreKit; no Apple statement specific to StoreKit and
   `network.client` was found (searched developer.apple.com/forums and documentation).

---

## 7. Consequences for Nullecho

1. **Entitlement: unchanged.** Keep `ENABLE_OUTGOING_NETWORK_CONNECTIONS = NO` (and `INCOMING … = NO`) on the
   macOS app target. `check-container.mjs` keeps asserting it; the `no-network` symbol list does not need to
   learn about StoreKit because StoreKit adds no `URLSession`/`NWConnection` code. Suggested addition to that
   check when the tip jar lands: assert `import StoreKit` appears only in the tip-jar file and that no
   `Network`/`URLSession` symbol appears anywhere, so the posture remains "StoreKit only, via the system".
2. **Wording.** "This app opens no network connections" remains true of the app process after the tip jar, and
   the sandbox keeps enforcing it. It would nevertheless read as evasive next to a purchase button, because a
   tip plainly reaches the App Store. Proposed replacement for the `network.slash` fact's detail in
   `ContentView.swift` (owner's call on the final words):

   > "No account, no analytics, no crash reports, no server. This app opens no network connections of its own;
   > the two links below are handed to your browser, and a tip is handled by the App Store's own purchase
   > service, not by this app."

   The NullechoApp.swift header comment (line 5) carries the same sentence and should change in step.
3. **Privacy label.** Nothing in this measurement changes the "Data Not Collected" question; the purchase is
   processed by Apple's system service and the app keeps no record. That item in `TIP-JAR.md` still needs its
   own check against Apple's App Privacy Details before the label is confirmed.
4. **Test rig to carry into the tip-jar build** (from sections 3.4 and 4): hosted XCTest + `SKTestSession` **and**
   the `.storekit` attached to each scheme's Run action; macOS checks of outside purchases are a known gap;
   both `ProbeMac`/`ProbeiOS` schemes in appendix C are a working template.

---

## Appendix A — files produced (all outside the repo, under `<scratch>/d-storekit/`)

`NullechoStoreKitProbe/` (xcodegen `project.yml`, `App/ProbeApp.swift`, `Tests/ProbeTests.swift`,
`Tests/Probe.storekit`, generated `.xcodeproj`), `dd/` `dd-control/` `dd-ios/` (DerivedData),
`logs/mac-01-build-for-testing.log`, `logs/mac-0{2,3,8}-test-sandboxed*.log` + `.xcresult`,
`logs/mac-04-test-control.log` + `.xcresult`, `logs/mac-0{1,4,8}-entitlements*.txt`,
`logs/mac-02-logstream-sandboxed.txt` (unified log for all macOS runs), `logs/ios-0{5,6,7}-test.log`,
`logs/ios-06-screen.png` (the sign-in sheet), `docs/apple-docs-dump.txt` (documentation text as fetched).
Side effects left on the machine: the sandbox container `~/Library/Containers/org.nullecho.probe.storekit`
(created by the system on first launch of the probe), the StoreKit test configuration cache the agent keeps
under `~/Library/Caches/com.apple.storekitagent/Octane/org.nullecho.probe.storekit/`, and the shut-down
simulator `NE-D-StoreKit-iPhone`. All are safe to delete.

## Appendix B — xcodebuild runs (eight in total)

| # | Target | Settings | Result |
|---|---|---|---|
| 01 | macOS build-for-testing | Nullecho posture, ad-hoc | TEST BUILD SUCCEEDED |
| 02 | macOS test-without-building | Nullecho posture | A B C pass, D fails (`buyProduct` unknown) |
| 03 | macOS test | Nullecho posture, compile-time expectation | A B C pass, D fails |
| 04 | macOS test | `ENABLE_OUTGOING_NETWORK_CONNECTIONS=YES`, `PROBE_CONTROL` | A B C pass (URLSession HTTP 200), D fails |
| 05 | iOS Simulator test | — | compile error (SecTask is macOS-only), fixed |
| 06 | iOS Simulator test | SKTestSession only | hung in `purchase()` on a sandbox sign-in sheet; aborted |
| 07 | iOS Simulator test | + scheme-attached `.storekit`, 45 s guard | **all four pass** |
| 08 | macOS test | Nullecho posture, + scheme-attached `.storekit` | A B C pass, D fails (same error) |

## Appendix C — probe sources (verbatim, final state)

`project.yml` (xcodegen 2.46.0):

```yaml
name: NullechoStoreKitProbe
options:
  bundleIdPrefix: org.nullecho.probe
  deploymentTarget:
    macOS: "15.4"
    iOS: "18.4"
  createIntermediateGroups: true
settings:
  base:
    SWIFT_VERSION: "5.0"
    CODE_SIGN_STYLE: Manual
    CODE_SIGN_IDENTITY: "-"
    DEVELOPMENT_TEAM: ""
    PROVISIONING_PROFILE_SPECIFIER: ""
    GENERATE_INFOPLIST_FILE: YES
    CURRENT_PROJECT_VERSION: "1"
    MARKETING_VERSION: "0.1"
    ENABLE_USER_SCRIPT_SANDBOXING: YES
targets:
  ProbeMac:
    type: application
    platform: macOS
    sources: [App]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: org.nullecho.probe.storekit
        PRODUCT_NAME: NullechoStoreKitProbe
        # Same posture as Nullecho's macOS app target (safari/xcode/Nullecho.xcodeproj):
        ENABLE_APP_SANDBOX: YES
        ENABLE_HARDENED_RUNTIME: YES
        ENABLE_INCOMING_NETWORK_CONNECTIONS: NO
        ENABLE_OUTGOING_NETWORK_CONNECTIONS: NO
        INFOPLIST_KEY_NSPrincipalClass: NSApplication
        INFOPLIST_KEY_LSApplicationCategoryType: public.app-category.utilities
        COMBINE_HIDPI_IMAGES: YES
        LD_RUNPATH_SEARCH_PATHS: "$(inherited) @executable_path/../Frameworks"
  ProbeMacTests:
    type: bundle.unit-test
    platform: macOS
    sources: [Tests]
    dependencies:
      - target: ProbeMac
      - sdk: StoreKitTest.framework
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: org.nullecho.probe.storekit.tests
        TEST_HOST: "$(BUILT_PRODUCTS_DIR)/NullechoStoreKitProbe.app/Contents/MacOS/NullechoStoreKitProbe"
  ProbeiOS:
    type: application
    platform: iOS
    sources: [App]
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: org.nullecho.probe.storekit
        PRODUCT_NAME: NullechoStoreKitProbe
        INFOPLIST_KEY_UIApplicationSceneManifest_Generation: YES
        INFOPLIST_KEY_UILaunchScreen_Generation: YES
        TARGETED_DEVICE_FAMILY: "1,2"
        SUPPORTED_PLATFORMS: "iphoneos iphonesimulator"
        CODE_SIGN_IDENTITY: "-"
  ProbeiOSTests:
    type: bundle.unit-test
    platform: iOS
    sources: [Tests]
    dependencies:
      - target: ProbeiOS
      - sdk: StoreKitTest.framework
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: org.nullecho.probe.storekit.tests
        CODE_SIGN_IDENTITY: "-"
        TEST_HOST: "$(BUILT_PRODUCTS_DIR)/NullechoStoreKitProbe.app/NullechoStoreKitProbe"
schemes:
  ProbeMac:
    build:
      targets:
        ProbeMac: all
        ProbeMacTests: [test]
    run:
      storeKitConfiguration: Tests/Probe.storekit
    test:
      targets: [ProbeMacTests]
  ProbeiOS:
    build:
      targets:
        ProbeiOS: all
        ProbeiOSTests: [test]
    run:
      storeKitConfiguration: Tests/Probe.storekit
    test:
      targets: [ProbeiOSTests]
```

`App/ProbeApp.swift`:

```swift
import SwiftUI

@main
struct ProbeApp: App {
    var body: some Scene {
        WindowGroup {
            Text("Nullecho StoreKit probe (test host)")
                .padding(40)
        }
    }
}
```

`Tests/Probe.storekit` (format version 3; the other two products differ only in `internalID`, `productID`,
`referenceName`, `displayName`, `description` and `displayPrice` 4.99 / 9.99):

```json
{
  "identifier" : "5A3F1C2E",
  "nonRenewingSubscriptions" : [ ],
  "products" : [
    {
      "displayPrice" : "1.99",
      "familyShareable" : false,
      "internalID" : "70A1B2C3",
      "localizations" : [
        { "description" : "A small thank-you to the people who build Nullecho.",
          "displayName" : "Small tip", "locale" : "en_US" }
      ],
      "productID" : "org.nullecho.tip.small",
      "referenceName" : "Small tip",
      "type" : "Consumable"
    }
  ],
  "settings" : {
    "_failTransactionsEnabled" : false,
    "_locale" : "en_US",
    "_storefront" : "USA",
    "_storeKitErrors" : [ ]
  },
  "subscriptionGroups" : [ ],
  "version" : { "major" : 3, "minor" : 0 }
}
```

`Tests/ProbeTests.swift`:

```swift
import XCTest
import Foundation
import Security
import StoreKit
import StoreKitTest

// Every observation is printed with a "PROBE " prefix so it can be grepped out of the xcodebuild log.
final class ProbeTests: XCTestCase {

    static let productIDs = ["org.nullecho.tip.small", "org.nullecho.tip.medium", "org.nullecho.tip.large"]

    // MARK: - Helpers

    /// Reads an entitlement of the *running host process* (not of a file on disk).
    func entitlement(_ key: String) -> Any? {
        #if os(macOS)
        guard let task = SecTaskCreateFromSelf(nil) else { return nil }
        var err: Unmanaged<CFError>?
        guard let value = SecTaskCopyValueForEntitlement(task, key as CFString, &err) else { return nil }
        return value
        #else
        return nil // SecTask entitlement reads are macOS-only; iOS has no network-client entitlement concept.
        #endif
    }

    var hostHasNetworkClient: Bool {
        (entitlement("com.apple.security.network.client") as? Bool) ?? false
    }

    func log(_ s: String) {
        print("PROBE \(s)")
    }

    /// One SKTestSession per process: a second live session in the same process is a source of
    /// StoreKitTest "unknown" errors, so tests C and D share it and only clear transactions.
    nonisolated(unsafe) static var sharedSession: SKTestSession?
    func testSession() throws -> SKTestSession {
        if let s = Self.sharedSession {
            s.clearTransactions()
            return s
        }
        let s = try SKTestSession(configurationFileNamed: "Probe")
        s.resetToDefaultState()
        s.disableDialogs = true
        s.askToBuyEnabled = false
        s.clearTransactions()
        Self.sharedSession = s
        return s
    }

    // MARK: - A. Who is the host process, and what is its sandbox posture?

    func testA_HostProcessPosture() {
        let env = ProcessInfo.processInfo.environment
        let bid = Bundle.main.bundleIdentifier ?? "nil"
        let container = env["APP_SANDBOX_CONTAINER_ID"] ?? "nil"
        let sandbox = entitlement("com.apple.security.app-sandbox")
        let netClient = entitlement("com.apple.security.network.client")
        let netServer = entitlement("com.apple.security.network.server")
        let taskAllow = entitlement("com.apple.security.get-task-allow")
        log("host bundle id = \(bid)")
        log("host executable = \(Bundle.main.executableURL?.lastPathComponent ?? "nil")")
        log("APP_SANDBOX_CONTAINER_ID = \(container)")
        log("entitlement com.apple.security.app-sandbox = \(String(describing: sandbox))")
        log("entitlement com.apple.security.network.client = \(String(describing: netClient))")
        log("entitlement com.apple.security.network.server = \(String(describing: netServer))")
        log("entitlement com.apple.security.get-task-allow = \(String(describing: taskAllow))")
        log("os = \(ProcessInfo.processInfo.operatingSystemVersionString)")

        XCTAssertEqual(bid, "org.nullecho.probe.storekit", "tests are not hosted in the probe app")
        #if os(macOS)
        XCTAssertNotEqual(container, "nil", "host process is NOT sandboxed (APP_SANDBOX_CONTAINER_ID unset)")
        XCTAssertEqual(sandbox as? Bool, true, "host process lacks com.apple.security.app-sandbox")
        XCTAssertNil(netServer, "host unexpectedly has com.apple.security.network.server")
        // The expected network.client state is fixed at compile time: the control build passes
        // SWIFT_ACTIVE_COMPILATION_CONDITIONS=PROBE_CONTROL together with ENABLE_OUTGOING_NETWORK_CONNECTIONS=YES.
        #if PROBE_CONTROL
        log("build flavour = CONTROL (expects network.client present)")
        XCTAssertEqual(netClient as? Bool, true, "control run: expected network.client to be present")
        #else
        log("build flavour = NULLECHO POSTURE (expects NO network.client)")
        XCTAssertNil(netClient, "sandboxed run: expected NO network.client entitlement")
        #endif
        #endif
    }

    // MARK: - B. Is the "no network" posture real? A plain URLSession request to a public host.

    func testB_PlainURLSessionToPublicHost() async {
        let url = URL(string: "https://www.apple.com/library/test/success.html")!
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 25
        let session = URLSession(configuration: config)

        var succeeded = false
        var outcome = ""
        let started = Date()
        do {
            let (data, response) = try await session.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            outcome = "SUCCEEDED: HTTP \(code), \(data.count) bytes"
            succeeded = true
        } catch {
            let ns = error as NSError
            let underlying = (ns.userInfo[NSUnderlyingErrorKey] as? NSError).map { "\($0.domain) \($0.code) \($0.localizedDescription)" } ?? "nil"
            outcome = "FAILED: domain=\(ns.domain) code=\(ns.code) description=\"\(ns.localizedDescription)\" underlying=[\(underlying)]"
        }
        let elapsed = String(format: "%.2f", Date().timeIntervalSince(started))
        log("URLSession GET \(url.absoluteString) -> \(outcome) (\(elapsed)s)")

        #if os(macOS)
        if hostHasNetworkClient {
            XCTAssertTrue(succeeded, "control: network.client present but URLSession failed: \(outcome)")
        } else {
            XCTAssertFalse(succeeded, "no network.client entitlement but URLSession SUCCEEDED; sandbox is not effective")
        }
        #else
        XCTAssertTrue(succeeded, "iOS Simulator: URLSession should reach the network: \(outcome)")
        #endif
    }

    // MARK: - C. StoreKit 2 in the same process: products, purchase, verify, finish.

    func testC_StoreKit2ProductsAndPurchase() async throws {
        let session = try testSession()
        log("SKTestSession ready; storefront=\(session.storefront) locale=\(session.locale.identifier)")

        let products = try await Product.products(for: Self.productIDs)
        log("Product.products(for:) returned \(products.count) products")
        for p in products.sorted(by: { $0.price < $1.price }) {
            log("product id=\(p.id) type=\(p.type.rawValue) displayName=\"\(p.displayName)\" displayPrice=\(p.displayPrice) price=\(p.price)")
        }
        XCTAssertEqual(products.count, 3)
        XCTAssertEqual(Set(products.map(\.id)), Set(Self.productIDs))
        for p in products {
            XCTAssertEqual(p.type, .consumable)
            XCTAssertFalse(p.displayPrice.isEmpty)
            XCTAssertGreaterThan(p.price, 0)
        }

        // Observation only (no assertion): does Transaction.updates also see this app's own purchase?
        // Apple documents Transaction.updates as the stream for transactions that occur *outside* the app,
        // so the result of purchase() is the authoritative delivery; this just records what happens.
        final class Seen: @unchecked Sendable { var text = "not delivered within 3s" }
        let seen = Seen()
        let observer = Task.detached {
            for await update in Transaction.updates {
                if case .verified(let tx) = update { seen.text = "delivered: txid=\(tx.id) product=\(tx.productID)" }
                else { seen.text = "delivered: unverified" }
                return
            }
        }
        try await Task.sleep(nanoseconds: 300_000_000)

        let small = try XCTUnwrap(products.first { $0.id == "org.nullecho.tip.small" })
        // Guard: a purchase that falls out of the Xcode test environment can block on a system sign-in sheet.
        struct PurchaseTimedOut: Error {}
        let result: Product.PurchaseResult = try await withThrowingTaskGroup(of: Product.PurchaseResult.self) { group in
            group.addTask { try await small.purchase() }
            group.addTask { try await Task.sleep(nanoseconds: 45_000_000_000); throw PurchaseTimedOut() }
            defer { group.cancelAll() }
            guard let first = try await group.next() else { throw PurchaseTimedOut() }
            return first
        }
        switch result {
        case .success(let verification):
            switch verification {
            case .verified(let tx):
                log("purchase -> .success(.verified): txid=\(tx.id) product=\(tx.productID) type=\(tx.productType.rawValue) environment=\(tx.environment.rawValue) storefront=\(tx.storefront.countryCode) revoked=\(tx.revocationDate != nil)")
                XCTAssertEqual(tx.productID, small.id)
                XCTAssertEqual(tx.productType, .consumable)
                XCTAssertEqual(tx.environment, .xcode)
                await tx.finish()
                log("transaction \(tx.id) finished")
            case .unverified(let tx, let verificationError):
                XCTFail("purchase returned .unverified for txid=\(tx.id): \(verificationError)")
            }
        case .userCancelled:
            XCTFail("purchase -> .userCancelled")
        case .pending:
            XCTFail("purchase -> .pending")
        @unknown default:
            XCTFail("purchase -> unknown result")
        }

        let all = session.allTransactions()
        log("SKTestSession.allTransactions() count=\(all.count) states=\(all.map { "\($0.productIdentifier):\($0.state.rawValue)" })")
        XCTAssertEqual(all.count, 1)

        try await Task.sleep(nanoseconds: 3_000_000_000)
        observer.cancel()
        log("Transaction.updates during this app's own purchase(): \(seen.text)")
    }

    // MARK: - D. Transaction.updates receives a purchase made *outside* the app (SKTestSession.buyProduct).

    func testD_TransactionUpdatesFromOutsideThisApp() async throws {
        let session = try testSession()

        let delivered = expectation(description: "Transaction.updates delivered the external purchase")
        final class Box: @unchecked Sendable { var text = "nothing received" }
        let box = Box()
        let listener = Task.detached {
            for await update in Transaction.updates {
                switch update {
                case .verified(let tx):
                    box.text = "verified txid=\(tx.id) product=\(tx.productID) environment=\(tx.environment.rawValue)"
                    await tx.finish()
                case .unverified(let tx, let err):
                    box.text = "UNVERIFIED txid=\(tx.id) error=\(err)"
                }
                delivered.fulfill()
                return
            }
        }
        // Load the products in this session first (the daemon resolves the external purchase against them),
        // and give the listener a moment to subscribe before the external purchase is injected.
        let loaded = try await Product.products(for: Self.productIDs)
        log("testD preloaded \(loaded.count) products")
        try await Task.sleep(nanoseconds: 500_000_000)
        let external: Transaction
        do {
            external = try await session.buyProduct(identifier: "org.nullecho.tip.medium")
        } catch {
            let ns = error as NSError
            log("SKTestSession.buyProduct(identifier:) THREW: \(error) domain=\(ns.domain) code=\(ns.code) userInfo=\(ns.userInfo)")
            throw error
        }
        log("SKTestSession.buyProduct(identifier:) -> txid=\(external.id) product=\(external.productID)")
        await fulfillment(of: [delivered], timeout: 30)
        listener.cancel()
        log("Transaction.updates -> \(box.text)")
        XCTAssertTrue(box.text.hasPrefix("verified "), "Transaction.updates did not deliver a verified transaction: \(box.text)")
        XCTAssertTrue(box.text.contains("org.nullecho.tip.medium"))
    }
}
```
