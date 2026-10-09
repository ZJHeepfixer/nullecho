// Renders the tip jar the way a person meets it: launch, scroll to "Support the project", tap a tier,
// see the App Store's own purchase sheet, confirm, see the thank-you. Screenshots go to the folder named
// by the TEST_RUNNER_NE_SHOT_DIR environment variable (and into the test result as attachments), prefixed
// by TEST_RUNNER_NE_SHOT_PREFIX; TEST_RUNNER_NE_TEXT_SIZE launches at a Dynamic Type size, e.g.
// UICTContentSizeCategoryAccessibilityL. Light/dark is the Simulator's setting (xcrun simctl ui … appearance).
//
// The purchase sheet exists only under Xcode's StoreKit test environment, which the scheme supplies
// (Nullecho.storekit on the Run action); outside it the section shows "not available right now".

import XCTest
import StoreKitTest

final class TipJarUITests: XCTestCase {

    private let env = ProcessInfo.processInfo.environment
    private var prefix: String { env["NE_SHOT_PREFIX"] ?? "tipjar" }

    private let tierLabelPrefix = "Small tip, "
    private let thankYou = "Thank you. Nothing has changed, and that’s the point."
    private let explanation = "Nothing unlocks; this is a thank-you to the people who build Nullecho."

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchApp() -> XCUIApplication {
        let app = XCUIApplication()
        if let size = env["NE_TEXT_SIZE"], !size.isEmpty {
            app.launchArguments += ["-UIPreferredContentSizeCategoryName", size]
        }
        app.launch()
        return app
    }

    /// Full-screen PNG: the sheet is system UI, so the screen, not the app, is what gets captured.
    private func shot(_ name: String) {
        let screenshot = XCUIScreen.main.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "\(prefix)-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = env["NE_SHOT_DIR"], !dir.isEmpty {
            let url = URL(fileURLWithPath: dir).appendingPathComponent("\(prefix)-\(name).png")
            do {
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                try screenshot.pngRepresentation.write(to: url)
            } catch {
                XCTFail("could not write screenshot \(url.path): \(error)")
            }
        }
    }

    /// Short drags, not flicks, until the element is on screen and hittable.
    private func scroll(_ app: XCUIApplication, until element: XCUIElement, attempts: Int = 20) {
        for _ in 0..<attempts {
            if element.exists && element.isHittable { return }
            let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
            let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.35))
            from.press(forDuration: 0.05, thenDragTo: to)
        }
    }

    /// The purchase sheet is drawn by the system, outside the app's process. Look for its confirm button in
    /// the app (remote view content is often exposed there), on SpringBoard and in the StoreKit UI service.
    private func purchaseSheetButton(timeout: TimeInterval) -> (XCUIElement, String)? {
        let hosts: [(String, XCUIApplication)] = [
            ("app", XCUIApplication()),
            ("springboard", XCUIApplication(bundleIdentifier: "com.apple.springboard")),
            ("storekituiservice", XCUIApplication(bundleIdentifier: "com.apple.ios.StoreKitUIService")),
        ]
        let labels = ["Purchase", "Buy", "Pay", "Subscribe"]
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            for (name, host) in hosts {
                for label in labels {
                    let button = host.buttons[label].firstMatch
                    if button.exists { return (button, "\(name) buttons[\(label)]") }
                }
                // Some sheets expose the confirm control as a static text inside a button-like cell.
                let predicate = NSPredicate(format: "label == 'Purchase' OR label == 'Buy'")
                let any = host.descendants(matching: .any).matching(predicate).firstMatch
                if any.exists && any.isHittable { return (any, "\(name) any[Purchase|Buy]") }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.5))
        }
        return nil
    }

    private func dismissConfirmation() {
        // After a purchase the sheet shows a confirmation ("You're all set.") with a Done/OK button.
        let hosts = [XCUIApplication(), XCUIApplication(bundleIdentifier: "com.apple.springboard")]
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            for host in hosts {
                for label in ["Done", "OK"] {
                    let b = host.buttons[label].firstMatch
                    if b.exists && b.isHittable { b.tap(); return }
                }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.3))
        }
    }

    // MARK: - The flow

    func testTipFlowRendersSheetAndThankYou() throws {
        let app = launchApp()

        let header = app.staticTexts["Support the project"]
        let tier = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", tierLabelPrefix)).firstMatch
        scroll(app, until: header)
        XCTAssertTrue(header.waitForExistence(timeout: 10), "the Support the project section is missing")
        XCTAssertTrue(app.staticTexts[explanation].exists, "the explanatory line is missing")
        // The list is lazy: at accessibility text sizes the tiers sit a screen below the header and do not
        // exist until scrolled to, so scroll first (more attempts, the page is long) and then wait.
        scroll(app, until: tier, attempts: 40)
        XCTAssertTrue(tier.waitForExistence(timeout: 30), "the tiers did not load (is the StoreKit configuration attached to the scheme?)")
        scroll(app, until: tier)

        // Every tier shows the App Store's name and price; nothing is typed in the app.
        let tiers = app.buttons.matching(NSPredicate(format: "label ENDSWITH 'tip, $1.99' OR label ENDSWITH 'tip, $4.99' OR label ENDSWITH 'tip, $9.99'"))
        XCTAssertEqual(tiers.count, 3, "expected three tier buttons labelled '<name>, <price>', found \(tiers.count)")
        XCTAssertFalse(app.staticTexts[thankYou].exists, "a thank-you before any tip")
        shot("1-section")

        tier.tap()
        let thanks = app.staticTexts[thankYou]
        if let (confirm, where_) = purchaseSheetButton(timeout: 25) {
            print("TIPJAR purchase sheet confirm button found at \(where_)")
            RunLoop.current.run(until: Date().addingTimeInterval(1.0)) // let the sheet finish animating
            shot("2-sheet")
            confirm.tap()
            dismissConfirmation()
        } else if thanks.exists {
            // The test environment's dialogs are off (an SKTestSession's `disableDialogs = true` is kept by the
            // Simulator's StoreKit daemon per bundle id), so the purchase completed with no sheet. The thank-you
            // path is still exercised; the sheet itself is not rendered in this run, and the log says so.
            print("TIPJAR purchase completed without a sheet: dialogs are disabled in this Simulator's test environment; the sheet render is UNVERIFIED in this run")
            shot("2-no-sheet-dialogs-disabled")
        } else {
            shot("2-sheet-not-found")
            XCTFail("UNVERIFIED: neither the purchase sheet nor a thank-you appeared after tapping a tier; see the screenshot")
            return
        }

        XCTAssertTrue(thanks.waitForExistence(timeout: 30), "no thank-you after confirming the purchase")
        scroll(app, until: thanks)
        shot("3-thanks")
        // The tiers are still there: a repeat tip is normal for a consumable, and nothing else changed.
        XCTAssertEqual(tiers.count, 3)
    }

    /// Two behaviours in one flow: a purchase made outside the app (an Ask-to-Buy approval, another device)
    /// reaches the Transaction.updates listener and is thanked; and a relaunch shows no thank-you by itself.
    ///
    /// What this does NOT prove, measured 2026-10-08 against a build with `finish()` removed: Xcode's StoreKit
    /// test environment showed that never-finished consumable in neither `Transaction.unfinished` nor
    /// `Transaction.all`, and did not re-deliver it on relaunch either, so this test passed on the broken build
    /// too. `finish()` is covered by code review (`TipJar.receive`) and by the owner's sandbox pass, where a
    /// tip that reappears on relaunch is the symptom to look for (safari/VERIFY-TIP-JAR.md).
    @MainActor
    func testFinishedTipDoesNotResurfaceOnRelaunch() async throws {
        let session = try SKTestSession(configurationFileNamed: "Nullecho")
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        defer { session.clearTransactions() }

        var app = launchApp()
        let header = app.staticTexts["Support the project"]
        scroll(app, until: header)
        XCTAssertTrue(header.waitForExistence(timeout: 10), "the Support the project section is missing")

        // A purchase made outside the app arrives on Transaction.updates; the listener thanks and finishes.
        try await session.buyProduct(identifier: "org.nullecho.tip.small") // UI tests cannot import the app module; check-container keeps the ids aligned
        let thanks = app.staticTexts[thankYou]
        XCTAssertTrue(thanks.waitForExistence(timeout: 30), "the listener did not thank an outside purchase")
        shot("6-thanks-from-listener")

        app.terminate()
        app = launchApp()
        scroll(app, until: app.staticTexts["Support the project"])
        // Give an unfinished transaction every chance to be re-delivered and thanked before judging.
        RunLoop.current.run(until: Date().addingTimeInterval(8.0))
        shot("7-after-relaunch")
        XCTAssertFalse(app.staticTexts[thankYou].exists,
                       "the thank-you came back on relaunch with nobody tipping: the transaction was never finished")
    }

    /// Negative render: with the test environment set to fail every transaction, no thank-you appears.
    /// The SKTestSession here lives in the test runner; whether it governs the app under test is itself
    /// measured by this test, so a wrong-way result is reported as UNVERIFIED rather than hidden.
    func testFailedPurchaseShowsNoThankYou() throws {
        let session = try SKTestSession(configurationFileNamed: "Nullecho")
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = false
        session.failTransactionsEnabled = true
        defer { session.failTransactionsEnabled = false }

        let app = launchApp()
        let tier = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", tierLabelPrefix)).firstMatch
        scroll(app, until: app.staticTexts["Support the project"])
        XCTAssertTrue(tier.waitForExistence(timeout: 30), "the tiers did not load")
        scroll(app, until: tier)
        tier.tap()

        if let (confirm, where_) = purchaseSheetButton(timeout: 20) {
            print("TIPJAR (fail run) confirm button at \(where_)")
            RunLoop.current.run(until: Date().addingTimeInterval(1.0))
            confirm.tap()
        }
        // Whatever the system shows (an error alert, or nothing), the app must not thank.
        RunLoop.current.run(until: Date().addingTimeInterval(4.0))
        shot("4-failed-purchase")
        let hosts = [app, XCUIApplication(bundleIdentifier: "com.apple.springboard")]
        for host in hosts {
            for label in ["OK", "Done", "Cancel"] {
                let b = host.buttons[label].firstMatch
                if b.exists && b.isHittable { b.tap() }
            }
        }
        RunLoop.current.run(until: Date().addingTimeInterval(1.0))
        shot("5-after-failed-purchase")
        XCTAssertFalse(app.staticTexts[thankYou].exists, "UNVERIFIED-OR-BUG: a thank-you appeared although the test environment was set to fail transactions (either the runner's SKTestSession does not govern the app, or the model thanks a failed purchase)")
        let purchased = session.allTransactions().filter { $0.state == .purchased }
        print("TIPJAR (fail run) purchased transactions in the test environment: \(purchased.count)")
    }
}
