// The tip jar: three consumable in-app purchases through StoreKit 2. Nothing is gated behind them.
//
// What this file keeps true (safari/TIP-JAR.md, safari/audit/05-tip-jar-rules.md):
// - A tip changes one thing, a thank-you line that lasts until the app quits. No UserDefaults, no file,
//   no keychain item, no appAccountToken: once the thank-you is gone, the only record is Apple's.
// - Only a .verified transaction is thanked and finished. An .unverified one gets neither; nothing is at
//   stake, and a thank-you for a transaction StoreKit could not verify would not be honest.
// - .pending (Ask to Buy) shows one quiet line. The thank-you then comes from the Transaction.updates
//   listener when the purchase completes, possibly on a later launch, which is why the listener starts
//   at launch and not when the section appears.
// - Prices are the App Store's displayPrice, never typed here. Product order is by price, because the
//   order Product.products(for:) returns is not documented.
// - This is the only file that imports StoreKit (check-container.mjs asserts it). StoreKit's network
//   traffic happens in the system's StoreKit agent, not in this process; the app keeps its no-network
//   entitlement (safari/audit/04-storekit-sandbox.md).

import StoreKit
import SwiftUI

@MainActor
@Observable
final class TipJar {
    /// The three tips, smallest first. Nullecho.storekit (local testing) carries the same three, and these
    /// are the ids to create in App Store Connect; product ids are immutable there, so confirm them first.
    static let productIDs = [
        "org.nullecho.tip.small",
        "org.nullecho.tip.medium",
        "org.nullecho.tip.large",
    ]

    enum Products: Equatable {
        case loading
        case available([Product])
        /// The App Store returned nothing or an error. Shown without fuss; nothing else depends on it.
        case unavailable
    }

    enum Outcome: Equatable {
        case none
        /// `.pending`: Ask to Buy or a similar hold. The listener thanks when it completes.
        case waitingForApproval
        case thanked
    }

    // The whole state. Both reset when the app quits; nothing is written anywhere.
    private(set) var products: Products = .loading
    private(set) var outcome: Outcome = .none

    /// The Transaction.updates listener, alive for as long as this object is.
    @ObservationIgnored nonisolated(unsafe) private var listener: Task<Void, Never>?

    /// HIG: show the store only when people can make payments (Screen Time, MDM). Read live, not stored.
    var canMakePayments: Bool { AppStore.canMakePayments }

    /// Creating the jar starts the listener; NullechoApp creates it once, at launch.
    init() {
        listener = Task { [weak self] in
            for await update in StoreKit.Transaction.updates {
                guard let self else { return }
                await self.receive(update)
            }
        }
    }

    deinit {
        listener?.cancel()
    }

    /// Asks the App Store for the three products. Called when the section appears; safe to call again.
    func loadProducts() async {
        if case .available = products { return }
        products = .loading
        do {
            let found = try await Product.products(for: Self.productIDs)
            let sorted = found.sorted { $0.price < $1.price }
            products = sorted.isEmpty ? .unavailable : .available(sorted)
        } catch is CancellationError {
            // The row scrolled away mid-request; it will ask again when it comes back.
        } catch {
            products = .unavailable
        }
    }

    /// Runs one tip through `purchase` (the SwiftUI PurchaseAction in the app, `Product.purchase()` in
    /// tests) and applies the result. Every outcome except a verified transaction leaves the jar as it was.
    func tip(_ product: Product, using purchase: (Product) async throws -> Product.PurchaseResult) async {
        let result: Product.PurchaseResult
        do {
            result = try await purchase(product)
        } catch {
            // StoreKit already showed the person what happened; there is nothing to add and nothing to undo.
            return
        }
        switch result {
        case .success(let verification):
            await receive(verification)
        case .pending:
            outcome = .waitingForApproval
        case .userCancelled:
            break
        @unknown default:
            break
        }
    }

    /// Every transaction passes through here, whether it came back from `purchase()` or arrived on
    /// Transaction.updates (Ask to Buy approvals, purchases finished on another device, refunds).
    private func receive(_ verification: VerificationResult<StoreKit.Transaction>) async {
        switch verification {
        case .verified(let transaction):
            // A refund arrives as a revoked transaction: finish it, but it earns no thank-you.
            if transaction.revocationDate == nil, Self.productIDs.contains(transaction.productID) {
                outcome = .thanked
            }
            await transaction.finish()
        case .unverified:
            break
        }
    }
}

// MARK: - The section

/// "Support the project": the explanatory line, the tiers, and the one line that follows a tip.
struct SupportSection: View {
    @Environment(TipJar.self) private var tipJar
    @Environment(\.purchase) private var purchase

    var body: some View {
        Section {
            Text("Nothing unlocks; this is a thank-you to the people who build Nullecho.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .task { await tipJar.loadProducts() }

            switch tipJar.products {
            case .loading:
                HStack(spacing: 10) {
                    ProgressView().controlSize(.small)
                    Text("Asking the App Store…").foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            case .unavailable:
                Text("The tips are not available right now. Nothing else is affected.")
                    .foregroundStyle(.secondary)
            case .available(let products):
                ForEach(products) { product in
                    TipRow(product: product) {
                        Task { await tipJar.tip(product) { try await purchase($0) } }
                    }
                }
            }

            switch tipJar.outcome {
            case .none:
                EmptyView()
            case .waitingForApproval:
                Label("Waiting for approval.", systemImage: "clock")
                    .foregroundStyle(.secondary)
            case .thanked:
                Label {
                    Text("Thank you. Nothing has changed, and that’s the point.")
                } icon: {
                    Image(systemName: "heart.fill").foregroundStyle(.pink)
                }
            }
        } header: {
            Text("Support the project")
        }
    }
}

/// One tier: the App Store's name on the left, its price as the button on the right.
private struct TipRow: View {
    let product: Product
    let action: () -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: 8) {
                name
                price
            }
            .padding(.vertical, 2)
        } else {
            HStack(spacing: 12) {
                name
                Spacer()
                price
            }
        }
    }

    private var name: some View {
        Text(product.displayName)
            .accessibilityHidden(true) // the button's label carries the name
    }

    private var price: some View {
        Button(product.displayPrice, action: action)
            .buttonStyle(.bordered)
            .buttonBorderShape(.capsule)
            .font(.subheadline.weight(.semibold).monospacedDigit())
            .accessibilityLabel("\(product.displayName), \(product.displayPrice)")
            .accessibilityHint("Opens the App Store’s purchase sheet.")
    }
}
