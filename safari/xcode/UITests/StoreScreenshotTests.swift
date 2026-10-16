// App Store screenshots, reproducible from code: launch the app, scroll each store section to the top of
// the screen, and save a full-resolution PNG of the device. Apple wants screenshots of the app in use, with
// no frames or overlays (Review Guideline 2.3.3); the raw simulator screenshot of an iPhone with Dynamic
// Island (medium display) is 1206×2622 and of an iPad 13-inch is 2064×2752, both accepted as-is.
//
// The PNGs are attached to the test result (lifetime keepAlways); export them with
// `xcrun xcresulttool export attachments --path <bundle> --output-path <dir>`, where each file's
// suggestedHumanReadableName starts with the names below. Light appearance, the 9:41 status bar and the
// StoreKit test configuration (so the tip section shows prices) are the caller's job: see
// safari/STORE-LISTING.md §7 for the exact commands. Run it on its own with
//   xcodebuild test … -only-testing:"Nullecho UI Tests (iOS)/StoreScreenshotTests" -resultBundlePath <bundle>
// (environment variables do not reach the UI-test runner through xcodebuild here, so there is no opt-in flag;
// in a full suite run this test just adds up to four attachments). A shot is skipped when the page has not
// moved since the previous one: on the 13-inch iPad the page ends inside shot 3, so a fourth shot would
// repeat it (the two frames differ only by the fading scroll indicator, measured 2026-10-15).

import XCTest

final class StoreScreenshotTests: XCTestCase {

    /// Each screenshot: file suffix and the section header that should sit at the top of the screen.
    /// `nil` means "as launched" (the app's own heading is already at the top).
    private let shots: [(String, String?)] = [
        ("1-top", nil),
        ("2-what-it-does", "What it does"),
        ("3-limits", "What it does not do in Safari"),
        ("4-support", "Support the project"),
    ]

    func testCaptureStoreScreenshots() throws {
        // Named by Apple's screenshot class: the medium-display iPhone (1206×2622) or the 13-inch iPad (2064×2752).
        let prefix = UIDevice.current.userInterfaceIdiom == .pad ? "ipad-13" : "iphone-63"
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30), "the app did not reach the foreground")
        // The extension facts (version, rule counts) are read at launch; give them a moment before the first shot.
        XCTAssertTrue(app.staticTexts["Nullecho for Safari"].waitForExistence(timeout: 20))
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))

        // The previous shot's header and where it sat: if it has not moved, the page has not scrolled.
        var anchor: (element: XCUIElement, y: CGFloat)? = nil
        for (suffix, header) in shots {
            if let header {
                bringToTop(app, headerTitled: header)
                if header == "Support the project" {
                    // The list is lazy: the tip rows exist only once scrolled to, and their prices arrive from
                    // StoreKit a moment later. Wait for the first tier so the shot shows prices, not a spinner.
                    let tier = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Small tip, '")).firstMatch
                    XCTAssertTrue(tier.waitForExistence(timeout: 20), "the tip tiers did not load (is the StoreKit test configuration planted on this simulator?)")
                }
            }
            RunLoop.current.run(until: Date().addingTimeInterval(1.5))   // settle scroll, animations, the scroll indicator
            if let anchor, anchor.element.exists, anchor.element.frame.minY == anchor.y {
                print("STORESHOT \(prefix)-\(suffix) skipped: the page did not move since the previous shot (it ended)")
                continue
            }
            let marker = app.staticTexts[header ?? "Nullecho for Safari"].firstMatch
            anchor = marker.exists ? (marker, marker.frame.minY) : nil
            // The app element, not XCUIScreen: on the iOS 27 Simulator a screen capture through the test daemon
            // was followed by "Application … is not running" on the next query (measured 2026-10-15); the app
            // fills the screen, so its own screenshot is the same image at full device resolution.
            attach(app.screenshot().pngRepresentation, name: "\(prefix)-\(suffix)")
        }
    }

    /// Short drags until the header exists and sits in the top part of the screen (just under the nav bar).
    /// The last section cannot reach the top — the page ends — so a header that stops moving while on
    /// screen counts as placed; only a header that never appears is a failure.
    private func bringToTop(_ app: XCUIApplication, headerTitled title: String) {
        let header = app.staticTexts[title].firstMatch
        let height = app.frame.height
        var lastY: CGFloat = -1
        for _ in 0..<40 {
            if header.exists, header.frame.minY >= 0, header.frame.minY < height * 0.22 { return }
            if header.exists, header.frame.minY >= 0, header.frame.minY < height, header.frame.minY == lastY { return }
            lastY = header.exists ? header.frame.minY : -1
            // Drag up by a quarter of the screen; smaller steps keep the target from overshooting.
            let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.70))
            let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45))
            from.press(forDuration: 0.05, thenDragTo: to)
        }
        XCTFail("could not bring \"\(title)\" onto the screen")
    }

    private func attach(_ png: Data, name: String) {
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
