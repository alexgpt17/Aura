import Foundation

/// Content Blocker Extension that provides Safari with blocking rules.
/// Safari compiles these rules and applies them automatically on every page load.
/// The user configures which categories to block in the Aura app, and this handler
/// merges the enabled category rule sets at runtime.
class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {

    private let appGroupID = "group.com.alexmartens.tint"
    private let themeDataKey = "tintThemeData"

    func beginRequest(with context: NSExtensionContext) {
        // Read content blocker settings from App Group
        let settings = loadContentBlockerSettings()

        // Build combined block list from enabled categories
        var allRules: [[String: Any]] = []

        if settings.ads {
            allRules.append(contentsOf: loadRules(from: "blocklist-ads"))
        }
        if settings.trackers {
            allRules.append(contentsOf: loadRules(from: "blocklist-trackers"))
        }
        if settings.socialWidgets {
            allRules.append(contentsOf: loadRules(from: "blocklist-social"))
        }
        if settings.annoyances {
            allRules.append(contentsOf: loadRules(from: "blocklist-annoyances"))
        }

        // If no rules are enabled or content blocking is disabled, provide an empty rule set
        // Safari requires at least one rule, so provide a no-op rule
        if allRules.isEmpty {
            allRules = [
                [
                    "trigger": ["url-filter": "^$"] as [String: Any],
                    "action": ["type": "block"] as [String: Any]
                ]
            ]
        }

        // Serialize to JSON
        guard let jsonData = try? JSONSerialization.data(withJSONObject: allRules, options: []) else {
            context.cancelRequest(withError: NSError(domain: "com.alexmartens.tint.contentblocker", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to serialize block rules"]))
            return
        }

        let attachment = NSItemProvider(item: jsonData as NSData, typeIdentifier: "public.json")
        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }

    // MARK: - Private Helpers

    private struct ContentBlockerCategories {
        let ads: Bool
        let trackers: Bool
        let socialWidgets: Bool
        let annoyances: Bool
    }

    private func loadContentBlockerSettings() -> ContentBlockerCategories {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return ContentBlockerCategories(ads: true, trackers: true, socialWidgets: false, annoyances: true)
        }

        defaults.synchronize()

        var themeData: [String: Any]?
        if let dict = defaults.dictionary(forKey: themeDataKey) {
            themeData = dict
        } else if let jsonString = defaults.string(forKey: themeDataKey),
                  let jsonData = jsonString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            themeData = parsed
        }

        guard let data = themeData,
              let cbSettings = data["contentBlockerSettings"] as? [String: Any],
              let enabled = cbSettings["enabled"] as? Bool, enabled,
              let categories = cbSettings["categories"] as? [String: Any] else {
            // Default: block ads, trackers, and annoyances
            return ContentBlockerCategories(ads: true, trackers: true, socialWidgets: false, annoyances: true)
        }

        return ContentBlockerCategories(
            ads: categories["ads"] as? Bool ?? true,
            trackers: categories["trackers"] as? Bool ?? true,
            socialWidgets: categories["socialWidgets"] as? Bool ?? false,
            annoyances: categories["annoyances"] as? Bool ?? true
        )
    }

    private func loadRules(from filename: String) -> [[String: Any]] {
        guard let url = Bundle.main.url(forResource: filename, withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let rules = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return rules
    }
}
