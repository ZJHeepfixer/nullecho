// Nullecho for Safari — container app entry point.
//
// The app exists because Safari web extensions ship inside an app. It has one job: tell the
// user plainly what the extension does and does not do in Safari, show how to turn it on, and
// (on macOS) show whether it is on. It opens no network connections; the two links it offers
// are handed to the system browser.

import SwiftUI

@main
struct NullechoApp: App {
#if os(macOS)
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
#endif

    var body: some Scene {
#if os(macOS)
        Window("Nullecho", id: "main") {
            ContentView()
        }
        .defaultSize(width: 560, height: 760)
        .windowResizability(.contentMinSize)
#else
        WindowGroup {
            ContentView()
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
