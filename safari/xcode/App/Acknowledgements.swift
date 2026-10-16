// Credits for the tracker lists, and the licence texts bundled with the app (App/Licences/: NOTICE.txt,
// LICENSE.txt, GPL-3.0.txt). Entries in Nullecho's lists were checked against GPL- and CC-licensed lists,
// and GPL-3.0 §4 asks that every recipient get a copy of the licence, so the texts ship inside the app and
// are shown in a sheet: read from the app's own bundle, offline, no browser, nothing fetched. The wording of
// the summary and the NOTICE follows the licence review (H-LICENSE-REVIEW §7.2 and §8).

import SwiftUI

enum Acknowledgements {
    /// The one-paragraph credit shown under "What it does".
    static let summary = "Tracker lists: Nullecho’s own selection, checked against EasyPrivacy and EasyList (© The EasyList authors, GPL-3.0 or CC BY-SA 3.0) and AdGuard filters (© AdGuard, GPL-3.0). The lists were converted to Safari’s rule format and trimmed. Not endorsed by these projects."

    struct Document: Identifiable {
        /// The resource name (`NOTICE`, `LICENSE`, `GPL-3.0`).
        let id: String
        let title: String
        let text: String
    }

    /// Resource name and heading, in display order: the credits first, then the licences they point to.
    static let resources: [(name: String, title: String)] = [
        ("NOTICE", "Credits (NOTICE)"),
        ("LICENSE", "MIT License — Nullecho’s code"),
        ("GPL-3.0", "GNU General Public License, version 3 — the list sources"),
    ]

    /// The bundled texts, verbatim. A missing file is reported in place rather than hidden: copying these
    /// resources is the build's job, and the unit tests check that it did.
    static func documents(in bundle: Bundle = .main) -> [Document] {
        resources.map { res in
            let url = bundle.url(forResource: res.name, withExtension: "txt")
                ?? bundle.url(forResource: res.name, withExtension: "txt", subdirectory: "Licences")
            let text = url.flatMap { try? String(contentsOf: $0, encoding: .utf8) }
                ?? "\(res.name).txt is missing from this build."
            return Document(id: res.name, title: res.title, text: text)
        }
    }

    /// Hard-wrapped plain text, reflowed for a proportional font: the lines of a paragraph are joined with
    /// single spaces and blank lines keep paragraphs apart. A line starting with "- " opens a bullet, and inside
    /// a bullet each indented line is a field of its own (NOTICE lists a source's copyright, licence and use on
    /// separate lines). The words and their order are unchanged; the bundled file is what ships, this only
    /// lays it out.
    static func reflow(_ text: String) -> String {
        var paragraphs: [String] = []
        var current = ""
        var inBullet = false
        func flush() {
            if !current.isEmpty { paragraphs.append(current); current = "" }
        }
        for raw in text.components(separatedBy: "\n") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flush()
                inBullet = false
                if paragraphs.last != "" { paragraphs.append("") }
            } else if line.hasPrefix("- ") {
                flush()
                inBullet = true
                current = line
            } else if inBullet && raw.hasPrefix("  ") {
                flush()
                current = line
            } else {
                current = current.isEmpty ? line : current + " " + line
            }
        }
        flush()
        while paragraphs.last == "" { paragraphs.removeLast() }
        return paragraphs.joined(separator: "\n")
    }
}

/// The "Acknowledgements" row: a disclosure under "What it does" with the credit paragraph and a button that
/// opens the bundled credits and licence texts.
struct AcknowledgementsRow: View {
    @State private var showingLicences = false

    var body: some View {
        DisclosureGroup {
            Text(Acknowledgements.summary)
                .font(.callout)
                .foregroundStyle(.secondary)
            Button {
                showingLicences = true
            } label: {
                Label("Full credits and licence texts", systemImage: "doc.plaintext")
            }
            .sheet(isPresented: $showingLicences) {
                LicencesSheet()
            }
        } label: {
            Text("Acknowledgements")
        }
    }
}

/// The three texts, one under the other. A plain stack, not a lazy one: all of them exist from the start, for
/// VoiceOver and for Find. Selectable, so a line can be copied. The sheet wraps this in a scroll view.
struct LicencesContent: View {
    private let documents = Acknowledgements.documents()

    var body: some View {
        VStack(alignment: .leading, spacing: 24) {
            ForEach(documents) { doc in
                VStack(alignment: .leading, spacing: 8) {
                    Text(doc.title)
                        .font(.headline)
                    Text(Acknowledgements.reflow(doc.text))
                        .font(.footnote)
                        .textSelection(.enabled)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// NOTICE, then the MIT and GPL-3.0 texts, read from the app bundle.
struct LicencesSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LicencesContent()
            }
            .navigationTitle("Credits and licences")
#if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
#else
            .safeAreaInset(edge: .bottom) {
                HStack {
                    Spacer()
                    Button("Done") { dismiss() }
                        .keyboardShortcut(.cancelAction)
                }
                .padding()
                .background(.bar)
            }
#endif
        }
#if os(macOS)
        .frame(minWidth: 560, idealWidth: 640, minHeight: 600, idealHeight: 720)
#endif
    }
}
