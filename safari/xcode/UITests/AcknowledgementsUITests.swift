// Renders the Acknowledgements row the way a person meets it: scroll to it, open it, read the credit, open
// "Full credits and licence texts", see NOTICE and the licence texts in the sheet, close it. Screenshots are
// attached to the result bundle (export with `xcrun xcresulttool export attachments`).

import XCTest

final class AcknowledgementsUITests: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func scroll(_ app: XCUIApplication, until element: XCUIElement, attempts: Int = 30) {
        for _ in 0..<attempts {
            if element.exists && element.isHittable { return }
            let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
            let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.40))
            from.press(forDuration: 0.05, thenDragTo: to)
        }
    }

    private func attach(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(data: app.screenshot().pngRepresentation, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testAcknowledgementsRowOpensAndShowsTheBundledTexts() throws {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.wait(for: .runningForeground, timeout: 30))

        let row = app.staticTexts["Acknowledgements"].firstMatch
        scroll(app, until: row)
        XCTAssertTrue(row.waitForExistence(timeout: 10), "no Acknowledgements row")
        row.tap()

        let credit = app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'checked against EasyPrivacy and EasyList'")).firstMatch
        XCTAssertTrue(credit.waitForExistence(timeout: 10), "the credit paragraph did not appear after opening the row")
        let button = app.buttons["Full credits and licence texts"].firstMatch
        scroll(app, until: button, attempts: 6)
        XCTAssertTrue(button.waitForExistence(timeout: 5))
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        attach(app, "ack-1-row-open")

        button.tap()
        // The sheet lays out three long texts; on a loaded machine the first accessibility snapshot of it took
        // over ten seconds (measured 2026-10-15), so wait generously and keep a picture of whatever is there.
        let noticeHeading = app.staticTexts["Credits (NOTICE)"].firstMatch
        let opened = noticeHeading.waitForExistence(timeout: 40)
        if !opened { attach(app, "ack-2-sheet-missing") }
        XCTAssertTrue(opened, "the licences sheet did not open (see ack-2-sheet-missing)")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'The EasyList authors'")).firstMatch.exists, "NOTICE text not shown")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'MIT License'")).firstMatch.exists, "MIT text not shown")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'GNU GENERAL PUBLIC LICENSE'")).firstMatch.exists, "GPL text not shown")
        RunLoop.current.run(until: Date().addingTimeInterval(0.8))
        attach(app, "ack-2-sheet")

        app.buttons["Done"].firstMatch.tap()
        XCTAssertTrue(noticeHeading.waitForNonExistence(timeout: 5), "the sheet did not close")
        // Right after the sheet's dismissal the iOS 27 Simulator briefly answers "cannot request screenshot data
        // because it does not exist" for the app element (measured 2026-10-15); the closed-state picture is a
        // courtesy, the assertion above is the proof, so give it a moment and skip it rather than fail on it.
        RunLoop.current.run(until: Date().addingTimeInterval(1.5))
        if app.wait(for: .runningForeground, timeout: 5), app.exists { attach(app, "ack-3-closed") }
    }
}
