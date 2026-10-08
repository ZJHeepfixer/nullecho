// macOS only: Safari tells a container app whether its extension is enabled, and can open its
// Extensions settings pane. iOS has no equivalent API, so the iOS screen shows the steps instead.

#if os(macOS)
import Combine
import Foundation
import SafariServices

@MainActor
final class SafariExtensionStatus: ObservableObject {
    enum State: Equatable {
        case checking
        case enabled
        case disabled
        case unavailable(String)
    }

    @Published private(set) var state: State = .checking
    @Published private(set) var openSettingsError: String?

    let extensionIdentifier: String

    init(extensionIdentifier: String) {
        self.extensionIdentifier = extensionIdentifier
    }

    func refresh() {
        state = .checking
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionIdentifier) { state, error in
            let next: State
            if let state {
                next = state.isEnabled ? .enabled : .disabled
            } else {
                next = .unavailable(error?.localizedDescription ?? "Safari did not report a state.")
            }
            Task { @MainActor in self.state = next }
        }
    }

    func openSafariExtensionSettings() {
        openSettingsError = nil
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionIdentifier) { error in
            guard let error else { return }
            Task { @MainActor in self.openSettingsError = error.localizedDescription }
        }
    }
}
#endif
