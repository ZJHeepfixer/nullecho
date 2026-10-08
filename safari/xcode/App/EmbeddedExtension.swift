// Facts about the Safari web extension embedded in this app, read from the app's own bundle.
//
// Everything here is a local file read inside Nullecho.app (the .appex under PlugIns). Nothing
// touches the network. The point is that the app describes the build it actually contains:
// the version comes from the extension's manifest, the rule counts from the bundled rule files.

import Foundation

struct EmbeddedExtension {
    struct RuleList: Identifiable {
        let id: String
        let enabledByDefault: Bool
        /// Rules whose action is `block`.
        let blockRules: Int
        /// Every rule in the file, whatever its action.
        let totalRules: Int
    }

    /// Bundle identifier of the embedded extension, as Safari sees it.
    let bundleIdentifier: String
    /// `version` from the extension's manifest.json, or nil if it could not be read.
    let version: String?
    /// The manifest's `declarative_net_request.rule_resources`, with counts from the files.
    let ruleLists: [RuleList]

    /// Block rules in the lists Safari loads by default. A list that ships off (tier B,
    /// `fingerprinting-strict`) blocks nothing until it is turned on, so it is not counted here.
    var activeBlockRules: Int { ruleLists.filter(\.enabledByDefault).reduce(0) { $0 + $1.blockRules } }

    /// Used only if the embedded extension cannot be located, which would itself be a build error.
    static var fallbackBundleIdentifier: String {
        (Bundle.main.bundleIdentifier ?? "org.nullecho.app") + ".extension"
    }

    static func load() -> EmbeddedExtension {
        guard let appex = embeddedExtensionBundle() else {
            return EmbeddedExtension(bundleIdentifier: fallbackBundleIdentifier, version: nil, ruleLists: [])
        }
        let identifier = appex.bundleIdentifier ?? fallbackBundleIdentifier
        guard let resources = appex.resourceURL,
              let manifest = readJSONObject(at: resources.appendingPathComponent("manifest.json")) else {
            return EmbeddedExtension(bundleIdentifier: identifier, version: nil, ruleLists: [])
        }

        let version = manifest["version"] as? String
        var lists: [RuleList] = []
        if let dnr = manifest["declarative_net_request"] as? [String: Any],
           let resourcesList = dnr["rule_resources"] as? [[String: Any]] {
            for entry in resourcesList {
                guard let id = entry["id"] as? String, let path = entry["path"] as? String else { continue }
                let enabled = (entry["enabled"] as? Bool) ?? true
                let rules = readJSONArray(at: resources.appendingPathComponent(path)) ?? []
                let blocks = rules.filter { rule in
                    let action = rule["action"] as? [String: Any]
                    return (action?["type"] as? String) == "block"
                }.count
                lists.append(RuleList(id: id, enabledByDefault: enabled, blockRules: blocks, totalRules: rules.count))
            }
        }
        return EmbeddedExtension(bundleIdentifier: identifier, version: version, ruleLists: lists)
    }

    // MARK: - Bundle plumbing

    private static func embeddedExtensionBundle() -> Bundle? {
        guard let plugIns = Bundle.main.builtInPlugInsURL,
              let entries = try? FileManager.default.contentsOfDirectory(at: plugIns, includingPropertiesForKeys: nil) else {
            return nil
        }
        for url in entries where url.pathExtension == "appex" {
            if let bundle = Bundle(url: url) { return bundle }
        }
        return nil
    }

    private static func readJSONObject(at url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static func readJSONArray(at url: URL) -> [[String: Any]]? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]]
    }
}
