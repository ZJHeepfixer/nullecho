// macOS render of the licences sheet and the Acknowledgements row, drawn off-screen inside the hosted test
// (an NSHostingView in a window that is never shown), and attached as PNGs. The macOS scheme has no UI-test
// target, and the Mac's window may sit on a Space a capture cannot see, so this is how the Mac layout of
// Acknowledgements.swift (the bottom Done bar, the sheet's minimum size) gets looked at. Export with
// `xcrun xcresulttool export attachments`.

import XCTest
#if os(macOS)
import SwiftUI
import AppKit
@testable import Nullecho

@MainActor
final class LicencesSheetRenderTests: XCTestCase {

    private func render<V: View>(_ view: V, size: NSSize, name: String) throws -> NSBitmapImageRep {
        let host = NSHostingView(rootView: view)
        host.frame = NSRect(origin: .zero, size: size)
        let window = NSWindow(contentRect: host.frame, styleMask: [.titled], backing: .buffered, defer: false)
        window.contentView = host
        host.layoutSubtreeIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.5))   // let SwiftUI settle its layout passes
        let rep = try XCTUnwrap(host.bitmapImageRepForCachingDisplay(in: host.bounds))
        host.cacheDisplay(in: host.bounds, to: rep)
        let png = try XCTUnwrap(rep.representation(using: .png, properties: [:]))
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        return rep
    }

    func testLicencesSheetRendersAllThreeTextsOnMac() throws {
        // The sheet's chrome (title, bottom Done bar). In a window that is never shown, the scroll view's
        // content does not get a layout pass, so the texts themselves are rendered below with ImageRenderer.
        let rep = try render(LicencesSheet(), size: NSSize(width: 640, height: 720), name: "mac-licences-sheet-chrome")
        XCTAssertGreaterThan(rep.pixelsWide, 0)
        // The sheet reads the same bundle the app does; the texts must be there, not the "missing" placeholder.
        for doc in Acknowledgements.documents() {
            XCTAssertFalse(doc.text.contains("is missing from this build"), "\(doc.id).txt missing from the Mac bundle")
        }
        // The content as the sheet lays it out (Mac fonts, 640 pt wide), top part only: the GPL text is long.
        let renderer = ImageRenderer(content: LicencesContent().frame(width: 640).background(Color(nsColor: .windowBackgroundColor)))
        renderer.scale = 2
        let image = try XCTUnwrap(renderer.cgImage, "ImageRenderer produced no image for LicencesContent")
        XCTAssertGreaterThan(image.height, 2000, "the three texts should be far taller than one screen")
        let top = try XCTUnwrap(image.cropping(to: CGRect(x: 0, y: 0, width: image.width, height: min(image.height, 2400))))
        let png = try XCTUnwrap(NSBitmapImageRep(cgImage: top).representation(using: .png, properties: [:]))
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = "mac-licences-content-top"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testAcknowledgementsRowRendersInAListOnMac() throws {
        let view = List { Section("What it does") { AcknowledgementsRow() } }.frame(width: 560, height: 160)
        let rep = try render(view, size: NSSize(width: 560, height: 160), name: "mac-acknowledgements-row")
        XCTAssertGreaterThan(rep.pixelsWide, 0)
    }
}
#endif
