// The credits and licence texts the app ships (App/Licences/), checked from inside the built app: the
// resources are present, the GPL text is the canonical one byte for byte, the display reflow changes no
// word, and the credit paragraph names what it should and nothing it should not.

import XCTest
import CryptoKit
@testable import Nullecho

final class AcknowledgementsTests: XCTestCase {

    /// sha256 of https://www.gnu.org/licenses/gpl-3.0.txt (fetched 2026-10-15); check-container asserts the same of the source file.
    private let gplSHA256 = "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986"

    func testBundledTextsArePresentAndVerbatim() throws {
        let docs = Acknowledgements.documents()
        XCTAssertEqual(docs.map(\.id), ["NOTICE", "LICENSE", "GPL-3.0"])
        for doc in docs {
            XCTAssertFalse(doc.text.contains("is missing from this build"), "\(doc.id).txt did not ship in the app bundle")
        }
        let notice = docs[0].text
        for must in ["EasyPrivacy", "EasyList", "https://easylist.to/pages/licence.html", "AdGuard",
                     "https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE", "GPL-3.0", "MIT License",
                     "DuckDuckGo", "No DuckDuckGo data file is redistributed"] {
            XCTAssertTrue(notice.contains(must), "NOTICE.txt lacks \"\(must)\"")
        }
        XCTAssertTrue(docs[1].text.hasPrefix("MIT License"), "LICENSE.txt is not the MIT licence")
        XCTAssertTrue(docs[1].text.contains("Permission is hereby granted, free of charge"))
        let gpl = docs[2].text
        XCTAssertTrue(gpl.contains("GNU GENERAL PUBLIC LICENSE") && gpl.contains("Version 3, 29 June 2007"))
        let digest = SHA256.hash(data: Data(gpl.utf8)).map { String(format: "%02x", $0) }.joined()
        XCTAssertEqual(digest, gplSHA256, "GPL-3.0.txt is not the canonical text")
    }

    func testReflowKeepsEveryWordInOrder() {
        for doc in Acknowledgements.documents() {
            let before = doc.text.split(whereSeparator: \.isWhitespace)
            let after = Acknowledgements.reflow(doc.text).split(whereSeparator: \.isWhitespace)
            XCTAssertEqual(before, after, "\(doc.id): reflow changed the words")
        }
        // Paragraphs stay apart, hard wraps inside a paragraph go, a bullet's indented lines are fields of their own.
        let sample = "  TITLE\n\nfirst line\n  second line\n\n- one\n  field a\n  field b\n- two\n\n\nend\n"
        XCTAssertEqual(Acknowledgements.reflow(sample), "TITLE\n\nfirst line second line\n\n- one\nfield a\nfield b\n- two\n\nend")
    }

    func testSummaryNamesTheSourcesAndTheirLicencesOnly() {
        let s = Acknowledgements.summary
        for must in ["EasyPrivacy", "EasyList", "AdGuard", "GPL-3.0", "CC BY-SA 3.0", "Not endorsed"] {
            XCTAssertTrue(s.contains(must), "summary lacks \"\(must)\"")
        }
        // DuckDuckGo data is a research reference credited in NOTICE.txt, not a shipped list source.
        XCTAssertFalse(s.contains("DuckDuckGo"))
    }
}
