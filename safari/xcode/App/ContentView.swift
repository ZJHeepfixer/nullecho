// The one screen. Copy rules: docs/THREAT-MODEL.md (banned phrases) and the HONEST LIMITS block at
// the top of ext/src/gpc.js. Say less and be right.

import SwiftUI
#if os(macOS)
import Combine
#endif

/// The only URLs this app knows. Both are opened by the system browser, never loaded in-app.
enum ExternalLink {
    static let privacyPolicy = URL(string: "https://nullecho.org/privacy/")!
    static let sourceCode = URL(string: "https://github.com/ZJHeepfixer/nullecho")!
}

struct ContentView: View {
    private let embedded = EmbeddedExtension.load()

    var body: some View {
        NavigationStack {
            List {
                HeaderSection(embedded: embedded)
#if os(macOS)
                MacSetupSection(extensionIdentifier: embedded.bundleIdentifier)
#else
                IOSSetupSection()
#endif
                WhatItDoesSection(embedded: embedded)
                LimitsSection()
                SiteTroubleSection()
                LinksSection()
            }
#if os(iOS)
            .listStyle(.insetGrouped)
            .navigationTitle("Nullecho")
            .navigationBarTitleDisplayMode(.inline)
#else
            .listStyle(.inset)
            .frame(minWidth: 440, minHeight: 480)
#endif
        }
    }
}

// MARK: - Header

private struct HeaderSection: View {
    let embedded: EmbeddedExtension
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Section {
            AdaptiveStack(vertical: typeSize.isAccessibilitySize, spacing: 14) {
                Image("LargeIcon")
                    .resizable()
                    .frame(width: 64, height: 64)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Nullecho for Safari")
                        .font(.title2.weight(.semibold))
                    Text("Blocks known trackers and asks sites not to sell or share your data. It collects nothing: there is no server to send anything to.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.vertical, 6)
            .listRowSeparator(.hidden)

            if let version = embedded.version {
                LabeledContent("Extension version", value: version)
            } else {
                LabeledContent("Extension version", value: "not found in this build")
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Setup (iOS / iPadOS)

#if os(iOS)
private struct IOSSetupSection: View {
    var body: some View {
        Section {
            Step(1, "Open Settings, then Apps, Safari, Extensions.")
            Step(2, "Tap Nullecho and turn on Allow Extension. Tracker blocking starts on every site right away.")
            Step(3, "To send Global Privacy Control as well, under Permissions set All Websites to Allow. Blocking does not need this; the privacy signal does.")
        } header: {
            Text("Turn it on in Safari")
        } footer: {
            Text("The same path applies on iPhone and iPad. From inside Safari, Manage Extensions is in the page menu beside the address bar on iPhone, and behind the Extensions button in the address bar on iPad.")
        }
    }
}
#endif

// MARK: - Setup (macOS)

#if os(macOS)
private struct MacSetupSection: View {
    @StateObject private var status: SafariExtensionStatus

    init(extensionIdentifier: String) {
        _status = StateObject(wrappedValue: SafariExtensionStatus(extensionIdentifier: extensionIdentifier))
    }

    var body: some View {
        Section {
            HStack(spacing: 10) {
                statusIcon
                VStack(alignment: .leading, spacing: 2) {
                    Text(statusTitle).font(.headline)
                    Text(statusDetail).font(.subheadline).foregroundStyle(.secondary)
                }
                Spacer()
                Button("Refresh", systemImage: "arrow.clockwise") { status.refresh() }
                    .labelStyle(.iconOnly)
                    .buttonStyle(.borderless)
                    .help("Ask Safari again")
            }
            .padding(.vertical, 4)

            Button("Open Safari Extensions Settings…") {
                status.openSafariExtensionSettings()
            }
            .keyboardShortcut(.defaultAction)

            if let error = status.openSettingsError {
                Text(error).font(.footnote).foregroundStyle(.red)
            }
        } header: {
            Text("Turn it on in Safari")
        } footer: {
            Text("In Safari’s Settings, open the Extensions tab and tick Nullecho. Tracker blocking starts on every site right away. To send Global Privacy Control as well, also allow Nullecho on every website; blocking does not need that, the privacy signal does.")
        }
        .onAppear { status.refresh() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            status.refresh()
        }
    }

    private var statusTitle: String {
        switch status.state {
        case .checking: return "Checking with Safari…"
        case .enabled: return "Nullecho is on in Safari"
        case .disabled: return "Nullecho is off in Safari"
        case .unavailable: return "Safari did not answer"
        }
    }

    private var statusDetail: String {
        switch status.state {
        case .checking: return "This takes a moment."
        case .enabled: return "Trackers on the bundled lists are being blocked."
        case .disabled: return "Nothing is blocked until you turn it on."
        case .unavailable(let reason): return reason
        }
    }

    @ViewBuilder private var statusIcon: some View {
        switch status.state {
        case .checking:
            ProgressView().controlSize(.small)
        case .enabled:
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.title2)
        case .disabled:
            Image(systemName: "circle").foregroundStyle(.secondary).font(.title2)
        case .unavailable:
            Image(systemName: "questionmark.circle").foregroundStyle(.orange).font(.title2)
        }
    }
}
#endif

// MARK: - What it does

private struct WhatItDoesSection: View {
    let embedded: EmbeddedExtension

    var body: some View {
        Section {
            Fact(symbol: "hand.raised.fill", tint: .green,
                 title: "Blocks requests to known trackers",
                 detail: "Ad, analytics, social-pixel and fingerprinting-vendor domains from published lists (DuckDuckGo Tracker Radar, EasyPrivacy, AdGuard). Applies on every site as soon as the extension is on, before any website permission is granted.")

            Fact(symbol: "envelope.badge.shield.half.filled", tint: .blue,
                 title: "Sends Global Privacy Control on the sites you allow",
                 detail: "Asks sites not to sell or share your data. Legally meaningful in some US states, honoured inconsistently. It is a request, not a block, and nobody can see from a browser whether a site complied.")

            Fact(symbol: "safari", tint: .secondary,
                 title: "About Safari’s limits",
                 detail: "Safari attaches the GPC header only to image and script requests, never to the page itself, and only on sites you have allowed. A site’s own scripts still see the signal (navigator.globalPrivacyControl is true). This is a Safari limit, not a setting.")

            if !embedded.ruleLists.isEmpty {
                DisclosureGroup {
                    ForEach(embedded.ruleLists) { list in
                        LabeledContent(list.id) {
                            Text(ruleSummary(list))
                                .foregroundStyle(.secondary)
                        }
                        .font(.callout)
                    }
                } label: {
                    LabeledContent("Rule lists in this build", value: "\(embedded.activeBlockRules) block rules on")
                }
            }
        } header: {
            Text("What it does")
        } footer: {
            if !embedded.ruleLists.isEmpty {
                Text("Counted from the rule files inside this app, not typed in.")
            }
        }
    }

    private func ruleSummary(_ list: EmbeddedExtension.RuleList) -> String {
        var parts: [String] = []
        if list.blockRules > 0 { parts.append("\(list.blockRules) block") }
        let other = list.totalRules - list.blockRules
        if other > 0 { parts.append("\(other) other") }
        if parts.isEmpty { parts.append("0 rules") }
        if !list.enabledByDefault { parts.append("off by default") }
        return parts.joined(separator: ", ")
    }
}

// MARK: - What it does not do

private struct LimitsSection: View {
    var body: some View {
        Section {
            Fact(symbol: "person.crop.circle.badge.questionmark", tint: .secondary,
                 title: "No fingerprint disguise",
                 detail: "The Safari build does not change what a site can read about your device. The per-site device profile Nullecho offers in Chrome is not part of this extension.")
            Fact(symbol: "network.slash", tint: .secondary,
                 title: "Does not hide your IP address",
                 detail: "Nullecho does not route your traffic anywhere. On Apple devices, hiding your IP address is the job of iCloud Private Relay, part of iCloud+.")
            Fact(symbol: "lock.shield", tint: .secondary,
                 title: "Collects nothing",
                 detail: "No account, no analytics, no crash reports, no server. This app opens no network connections; the two links below are handed to your browser.")
        } header: {
            Text("What it does not do in Safari")
        } footer: {
            Text("Safari’s own protections stay as they are. Nullecho adds to them and cannot switch them off.")
        }
    }
}

// MARK: - If a site misbehaves

private struct SiteTroubleSection: View {
    var body: some View {
        Section {
#if os(iOS)
            Text("Take away Nullecho’s access to that one site. Settings, Apps, Safari, Extensions, Nullecho lists every website you have answered Safari’s permission prompt for; set the site to Deny. If you allowed all websites instead, no single site is listed: set All Websites to Ask, and Safari will ask on each site, with Always Allow on This Website as one of the choices.")
#else
            Text("Take away Nullecho’s access to that one site: in Safari’s Settings, open Extensions, select Nullecho, click Edit Websites… and set the site to Deny.")
#endif
            Text("Denying a site stops the privacy signal there. Tracker blocking is not per-site: it stays on everywhere until you turn the extension off.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Text("Some sites break when they see the GPC signal rather than honour it. The extension already leaves it off on the sites known to do that; if you find another, please report it at the source link below.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        } header: {
            Text("If a site misbehaves")
        }
    }
}

// MARK: - Links

private struct LinksSection: View {
    var body: some View {
        Section {
            Link(destination: ExternalLink.privacyPolicy) {
                Label("Privacy policy", systemImage: "doc.text")
            }
            Link(destination: ExternalLink.sourceCode) {
                Label("Source code and issues", systemImage: "chevron.left.forwardslash.chevron.right")
            }
        } header: {
            Text("More")
        } footer: {
            Text("Both open in your browser. Nullecho is open source under the MIT licence.")
        }
    }
}

// MARK: - Building blocks

private struct Step: View {
    let number: Int
    let text: String
    @Environment(\.dynamicTypeSize) private var typeSize

    init(_ number: Int, _ text: String) {
        self.number = number
        self.text = text
    }

    var body: some View {
        AdaptiveStack(vertical: typeSize.isAccessibilitySize, spacing: 12) {
            Text("\(number)")
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.white)
                .padding(8)
                .background(Circle().fill(Color.accentColor))
                .accessibilityHidden(true)
            Text(text)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(text)")
    }
}

private struct Fact: View {
    let symbol: String
    let tint: Color
    let title: String
    let detail: String
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        AdaptiveStack(vertical: typeSize.isAccessibilitySize, spacing: 12) {
            Image(systemName: symbol)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(minWidth: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

/// Horizontal normally; vertical at accessibility text sizes so nothing gets squeezed.
private struct AdaptiveStack<Content: View>: View {
    let vertical: Bool
    let spacing: CGFloat
    @ViewBuilder let content: () -> Content

    var body: some View {
        if vertical {
            VStack(alignment: .leading, spacing: spacing, content: content)
        } else {
            HStack(alignment: .top, spacing: spacing, content: content)
        }
    }
}

#Preview {
    ContentView()
}
