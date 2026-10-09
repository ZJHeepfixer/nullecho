// The tip jar under Xcode's StoreKit test environment (Nullecho.storekit, a resource of this bundle).
//
// These tests run inside the real app (TEST_HOST) and drive the real TipJar model, using
// Product.purchase() where the view uses the SwiftUI PurchaseAction (which only exists inside a view).
//
// Rig (measured, safari/VERIFY-TIP-JAR.md): `xcodebuild test` does not push the scheme's StoreKit
// configuration into the Simulator; only the SKTestSession below does, and the daemon keeps it for the app's
// bundle id. The app's own StoreKit client is created at launch (the Transaction.updates listener), before
// any test runs, so on a freshly erased Simulator the FIRST test process still talks to the sandbox App Store
// and every product load fails; from the second launch on, the saved configuration applies at launch. Run the
// suite once to prime a fresh Simulator, then run it for real (Scripts/test-tipjar.sh does both).
// Every observation is printed with a "TIPJAR " prefix so it can be grepped out of the xcodebuild log.

import XCTest
import StoreKit
import StoreKitTest
@testable import Nullecho

final class TipJarTests: XCTestCase {

    // MARK: - Rig

    /// One SKTestSession per process: all instances control the same environment, and a second live one
    /// is a source of StoreKitTest "unknown" errors. Each test resets it and clears its transactions.
    nonisolated(unsafe) private static var sharedSession: SKTestSession?

    private func freshSession() async throws -> SKTestSession {
        let session: SKTestSession
        if let existing = Self.sharedSession {
            session = existing
        } else {
            session = try SKTestSession(configurationFileNamed: "Nullecho")
            Self.sharedSession = session
        }
        session.resetToDefaultState()
        session.disableDialogs = true
        session.askToBuyEnabled = false
        try await session.setSimulatedError(nil, forAPI: .purchase)
        try await session.setSimulatedError(nil, forAPI: .verification)
        try await session.setSimulatedError(nil, forAPI: .loadProducts)
        session.clearTransactions()
        return session
    }

    private func log(_ s: String) { print("TIPJAR \(s)") }

    /// Product.purchase() with a guard: a purchase that falls out of the test environment blocks on a
    /// system sign-in sheet forever, which should fail the test, not hang the run.
    private func purchase(_ product: Product) async throws -> Product.PurchaseResult {
        struct PurchaseTimedOut: Error {}
        return try await withThrowingTaskGroup(of: Product.PurchaseResult.self) { group in
            group.addTask { try await product.purchase() }
            group.addTask { try await Task.sleep(nanoseconds: 45_000_000_000); throw PurchaseTimedOut() }
            defer { group.cancelAll() }
            guard let first = try await group.next() else { throw PurchaseTimedOut() }
            return first
        }
    }

    /// Every transaction StoreKit still considers unfinished for this app, verified or not (a simulated
    /// verification failure makes the listing itself come back `.unverified`, and those count too).
    private func unfinished() async -> [StoreKit.Transaction] {
        var out: [StoreKit.Transaction] = []
        for await result in StoreKit.Transaction.unfinished { out.append(result.unsafePayloadValue) }
        return out
    }

    /// Every transaction StoreKit lists for this app (a regression guard; in Xcode's test environment it did
    /// not list a never-finished consumable either, see the verified-tip test).
    private func allTransactions() async -> [StoreKit.Transaction] {
        var out: [StoreKit.Transaction] = []
        for await result in StoreKit.Transaction.all { out.append(result.unsafePayloadValue) }
        return out
    }

    /// `finish()` returns before the daemon's unfinished list catches up (tens of seconds on a loaded Mac);
    /// poll until it empties. Returns the remaining list and logs how long the wait took.
    private func unfinishedAfterSettling(seconds: Double = 30) async -> [StoreKit.Transaction] {
        let started = Date()
        var open = await unfinished()
        while !open.isEmpty, Date().timeIntervalSince(started) < seconds {
            try? await Task.sleep(nanoseconds: 250_000_000)
            open = await unfinished()
        }
        log(String(format: "unfinished list %@ after %.1fs", open.isEmpty ? "empty" : "still \(open.map(\.productID))", Date().timeIntervalSince(started)))
        return open
    }

    /// Loads through the model; on failure, asks StoreKit directly so the failure names its cause.
    @MainActor
    private func loadedProducts(_ jar: TipJar) async throws -> [Product] {
        await jar.loadProducts()
        guard case .available(let products) = jar.products else {
            var cause = "Product.products(for:) returned no products"
            do { cause += " (\(try await Product.products(for: TipJar.productIDs).count) on retry)" } catch { cause = "Product.products(for:) threw \(error)" }
            struct ProductsUnavailable: Error, CustomStringConvertible { let description: String }
            XCTFail("products did not load: jar.products=\(jar.products); \(cause). Is Nullecho.storekit attached to the scheme's Run action and a resource of this test bundle?")
            throw ProductsUnavailable(description: cause)
        }
        return products
    }

    /// Polls `condition` on the main actor until it holds or `seconds` pass.
    @MainActor
    private func eventually(_ seconds: Double = 15, _ condition: @MainActor () -> Bool) async -> Bool {
        let deadline = Date().addingTimeInterval(seconds)
        while Date() < deadline {
            if condition() { return true }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        return condition()
    }

    override func setUpWithError() throws {
        try super.setUpWithError()
        XCTAssertEqual(Bundle.main.bundleIdentifier, "org.nullecho.app", "tests are not hosted in the Nullecho app")
    }

    // MARK: - Products

    @MainActor
    func testProductsLoadSortedByPriceWithDisplayPrices() async throws {
        _ = try await freshSession()
        let jar = TipJar()
        XCTAssertEqual(jar.products, .loading)
        let products = try await loadedProducts(jar)
        for p in products { log("product id=\(p.id) type=\(p.type.rawValue) displayName=\"\(p.displayName)\" displayPrice=\(p.displayPrice) price=\(p.price)") }

        XCTAssertEqual(products.count, 3)
        XCTAssertEqual(products.map(\.id), TipJar.productIDs, "products must be sorted by price, smallest first")
        XCTAssertEqual(products.map(\.price), products.map(\.price).sorted())
        for p in products {
            XCTAssertEqual(p.type, .consumable, p.id)
            XCTAssertFalse(p.displayPrice.isEmpty, p.id)
            XCTAssertFalse(p.displayName.isEmpty, p.id)
            XCTAssertLessThanOrEqual(p.displayName.count, 30, "App Store Connect display-name limit")
            XCTAssertLessThanOrEqual(p.description.count, 45, "App Store Connect description limit")
        }
        XCTAssertEqual(jar.outcome, .none, "loading products must not thank anyone")
    }

    // MARK: - Verified tips

    @MainActor
    func testVerifiedTipOfEachTierIsThankedAndFinished() async throws {
        let session = try await freshSession()
        for id in TipJar.productIDs {
            let jar = TipJar()
            let loaded = try await loadedProducts(jar)
            let product = try XCTUnwrap(loaded.first { $0.id == id })

            await jar.tip(product) { try await self.purchase($0) }

            XCTAssertEqual(jar.outcome, .thanked, "no thank-you after a verified tip of \(id)")
            let open = await unfinishedAfterSettling()
            XCTAssertTrue(open.isEmpty, "transaction left unfinished after \(id): \(open.map { "\($0.id):\($0.productID)" })")
            // Honest limit, measured 2026-10-08 against a build with finish() removed: in Xcode's test
            // environment Transaction.unfinished AND Transaction.all stayed empty for all three tiers (0.3 s,
            // 15 s, 42 s and 355 s after the purchase), so neither listing can catch a missing finish() here.
            // The assertions stay as regression guards for what they do see; finish() itself is covered by
            // review and by the owner's sandbox pass (safari/VERIFY-TIP-JAR.md).
            let lingering = await allTransactions().filter { $0.productID == id && $0.revocationDate == nil }
            XCTAssertTrue(lingering.isEmpty, "a consumable is still listed in Transaction.all after \(id): \(lingering.map(\.id))")
            let purchased = session.allTransactions().filter { $0.productIdentifier == id && $0.state == .purchased }
            XCTAssertEqual(purchased.count, 1, "expected exactly one purchased transaction for \(id)")
            log("tip \(id) -> outcome=\(jar.outcome) unfinished=\(open.count) inTransactionAll=\(lingering.count) purchased=\(purchased.count)")
        }
    }

    // MARK: - Nothing happens on cancel, failure or an unverified result

    @MainActor
    func testCancelledTipLeavesNoTrace() async throws {
        let session = try await freshSession()
        let jar = TipJar()
        let loaded = try await loadedProducts(jar)
        let product = try XCTUnwrap(loaded.first)

        // The result the sheet produces when the person dismisses it.
        await jar.tip(product) { _ in .userCancelled }
        XCTAssertEqual(jar.outcome, .none, "a cancelled tip must not be thanked")

        // The same through StoreKit: the test environment answers purchase() with userCancelled.
        try await session.setSimulatedError(.generic(.userCancelled), forAPI: .purchase)
        defer { Task { try? await session.setSimulatedError(nil, forAPI: .purchase) } }
        var observed = "no result"
        await jar.tip(product) { p in
            do {
                let r = try await self.purchase(p)
                observed = "returned \(r)"
                return r
            } catch {
                observed = "threw \(error)"
                throw error
            }
        }
        log("purchase() with simulated StoreKitError.userCancelled \(observed)")
        XCTAssertEqual(jar.outcome, .none)
        let open = await unfinishedAfterSettling()
        XCTAssertTrue(open.isEmpty, "unfinished after cancel: \(open.map(\.productID))")
        XCTAssertTrue(session.allTransactions().filter { $0.state == .purchased }.isEmpty, "a cancelled tip must not purchase anything")
    }

    @MainActor
    func testFailedTipLeavesNoTrace() async throws {
        let session = try await freshSession()
        let jar = TipJar()
        let loaded = try await loadedProducts(jar)
        let product = try XCTUnwrap(loaded.first)

        session.failTransactionsEnabled = true
        var observed = "no result"
        await jar.tip(product) { p in
            do {
                let r = try await self.purchase(p)
                observed = "returned \(r)"
                return r
            } catch {
                observed = "threw \(error)"
                throw error
            }
        }
        log("purchase() with failTransactionsEnabled \(observed)")
        XCTAssertEqual(jar.outcome, .none, "a failed tip must not be thanked")
        let open = await unfinishedAfterSettling()
        XCTAssertTrue(open.isEmpty, "unfinished after failure: \(open.map(\.productID))")
        XCTAssertTrue(session.allTransactions().filter { $0.state == .purchased }.isEmpty, "a failed tip must not purchase anything")
    }

    @MainActor
    func testUnverifiedTipIsNeitherThankedNorFinished() async throws {
        let session = try await freshSession()
        let jar = TipJar()
        let loaded = try await loadedProducts(jar)
        let product = try XCTUnwrap(loaded.first)

        // 1. The test environment itself fails verification of what purchase() returns.
        try await session.setSimulatedError(.verification(.invalidSignature), forAPI: .verification)
        var observed = "no result"
        await jar.tip(product) { p in
            let r = try await self.purchase(p)
            if case .success(let v) = r, case .unverified(_, let why) = v { observed = "returned .success(.unverified: \(why))" } else { observed = "returned \(r)" }
            return r
        }
        try await session.setSimulatedError(nil, forAPI: .verification)
        log("purchase() with simulated verification failure \(observed)")
        XCTAssertEqual(jar.outcome, .none, "an unverified transaction must not be thanked")
        var open = await unfinished()
        XCTAssertFalse(open.isEmpty, "the unverified transaction must be left unfinished (nothing is open)")
        for tx in open { await tx.finish() } // clean up what the model rightly refused to finish

        // 2. The same, constructed: a real verified transaction re-presented as failing verification.
        guard case .success(.verified(let tx)) = try await purchase(product) else {
            return XCTFail("could not obtain a verified transaction to wrap")
        }
        defer { Task { await tx.finish() } }

        await jar.tip(product) { _ in .success(.unverified(tx, .invalidSignature)) }

        XCTAssertEqual(jar.outcome, .none, "an unverified transaction must not be thanked")
        open = await unfinished()
        XCTAssertTrue(open.contains { $0.id == tx.id }, "an unverified transaction must be left unfinished (ids open: \(open.map(\.id)))")
        log("unverified (constructed) -> outcome=\(jar.outcome) still unfinished=\(open.contains { $0.id == tx.id })")
    }

    // MARK: - Ask to Buy: pending, then thanked by the listener

    @MainActor
    func testAskToBuyIsPendingThenThankedByTheListener() async throws {
        let session = try await freshSession()
        session.askToBuyEnabled = true
        let jar = TipJar()
        let loaded = try await loadedProducts(jar)
        let product = try XCTUnwrap(loaded.first { $0.id == "org.nullecho.tip.medium" })

        await jar.tip(product) { try await self.purchase($0) }
        XCTAssertEqual(jar.outcome, .waitingForApproval, "Ask to Buy must show the waiting line, not a thank-you")

        let pending = try XCTUnwrap(session.allTransactions().first { $0.pendingAskToBuyConfirmation }, "no pending Ask to Buy transaction in the test environment")
        log("ask to buy pending: transaction \(pending.identifier) for \(pending.productIdentifier)")
        try session.approveAskToBuyTransaction(identifier: pending.identifier)

        let thanked = await eventually { jar.outcome == .thanked }
        XCTAssertTrue(thanked, "the listener did not thank after approval (outcome=\(jar.outcome))")
        let open = await unfinishedAfterSettling()
        XCTAssertTrue(open.isEmpty, "approved Ask to Buy transaction left unfinished: \(open.map(\.productID))")
        log("ask to buy approved -> outcome=\(jar.outcome) unfinished=\(open.count)")
    }

    // MARK: - A tip changes nothing else

    @MainActor
    func testModelHoldsOnlyTransientState() throws {
        let jar = TipJar()
        let labels = Set(Mirror(reflecting: jar).children.compactMap(\.label))
        log("TipJar stored properties: \(labels.sorted())")
        // products and outcome are the UI state; listener is the Transaction.updates task; the registrar is
        // @Observable's. Anything else is a field a tip could leave behind, and must not exist.
        XCTAssertEqual(labels, ["_products", "_outcome", "listener", "_$observationRegistrar"])
    }

    @MainActor
    func testTipLeavesDefaultsAndContainerUntouched() async throws {
        _ = try await freshSession()
        let jar = TipJar()
        let loaded = try await loadedProducts(jar)
        let product = try XCTUnwrap(loaded.first { $0.id == "org.nullecho.tip.large" })

        let defaultsBefore = UserDefaults.standard.dictionaryRepresentation()
        let filesBefore = containerListing()

        await jar.tip(product) { try await self.purchase($0) }
        XCTAssertEqual(jar.outcome, .thanked)

        let defaultsAfter = UserDefaults.standard.dictionaryRepresentation()
        XCTAssertEqual(Set(defaultsBefore.keys), Set(defaultsAfter.keys), "a tip must not write to UserDefaults")
        for key in defaultsBefore.keys {
            XCTAssertEqual(String(describing: defaultsBefore[key]), String(describing: defaultsAfter[key]), "UserDefaults[\(key)] changed across a tip")
        }
        let filesAfter = containerListing()
        XCTAssertEqual(filesBefore, filesAfter, "a tip must not write a file in the app's container")
        log("after a tip: defaults keys=\(defaultsAfter.count) container entries=\(filesAfter.count), both unchanged")
    }

    /// Everything the app could write to on its own: Documents, Library (Preferences, Application Support,
    /// Caches) and tmp, listed recursively. StoreKit's own caches live in the system daemons, not here.
    private func containerListing() -> Set<String> {
        let home = URL(fileURLWithPath: NSHomeDirectory())
        var out = Set<String>()
        for dir in ["Documents", "Library", "tmp"] {
            let root = home.appendingPathComponent(dir)
            guard let e = FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil) else { continue }
            for case let url as URL in e { out.insert(url.path.replacingOccurrences(of: home.path, with: "")) }
        }
        return out
    }
}
