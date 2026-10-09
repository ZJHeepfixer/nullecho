// Nullecho for Safari — container app entry point.
//
// The app exists because Safari web extensions ship inside an app. It has one job: tell the
// user plainly what the extension does and does not do in Safari, show how to turn it on, and
// (on macOS) show whether it is on. It opens no network connections of its own: the two links it
// offers are handed to the system browser, and a tip is handled by the App Store's own purchase
// service, not by this app (TipJar.swift).

import SwiftUI

@main
struct NullechoApp: App {
#if os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
#endif

    /// One tip jar for the whole app, created at launch. Creating it starts the Transaction.updates
    /// listener, so a tip approved later (Ask to Buy) is thanked and finished whenever it arrives, even
    /// on a later launch and before the person scrolls to the section.
    @State private var tipJar = TipJar()

    var body: some Scene {
#if os(macOS)
        Window("Nullecho", id: "main") {
            ContentView()
                .environment(tipJar)
        }
        .defaultSize(width: 560, height: 760)
        .windowResizability(.contentMinSize)
#else
        WindowGroup {
            ContentView()
                .environment(tipJar)
        }
#endif
    }
}

#if os(macOS)
final class AppDelegate: NSObject, NSApplicationDelegate {
    /// A single-window utility: closing the window quits, like the Apple template.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
#endif
