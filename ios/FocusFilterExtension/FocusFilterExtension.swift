import AppIntents
import Foundation

// MARK: - Aura Focus Filter

/// Focus Filter that automatically switches Aura Safari themes when iOS Focus modes change.
/// Users configure mappings in the Aura app (e.g., Work → Dark Mode, Sleep → Ocean).
/// When a Focus mode activates, iOS calls this extension to apply the mapped theme.
@available(iOS 16.0, *)
struct AuraFocusFilter: SetFocusFilterIntent {
    static var title: LocalizedStringResource = "Set Aura Theme"
    static var description: IntentDescription? = IntentDescription("Automatically apply a Safari theme when this Focus mode is active.")

    /// The theme ID or name to apply when this Focus mode activates
    @Parameter(title: "Theme")
    var presetName: String?

    var displayRepresentation: DisplayRepresentation {
        if let presetName = presetName {
            return DisplayRepresentation(stringLiteral: "Apply \(presetName) theme")
        }
        return DisplayRepresentation(stringLiteral: "Apply Aura theme")
    }

    func perform() async throws -> some IntentResult {
        let appGroupID = "group.com.alexmartens.tint"
        let themeDataKey = "tintThemeData"

        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return .result()
        }

        // Force synchronize to get latest data
        defaults.synchronize()

        // Read current theme data from App Group
        var themeData: [String: Any] = [:]

        if let dict = defaults.dictionary(forKey: themeDataKey) {
            themeData = dict
        } else if let jsonString = defaults.string(forKey: themeDataKey),
                  let jsonData = jsonString.data(using: .utf8),
                  let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any] {
            themeData = parsed
        }

        // Determine which theme to apply
        var themeID: String? = nil

        if let name = presetName, !name.isEmpty {
            // Use the theme name/ID from the intent parameter
            themeID = name.lowercased()
        }

        guard let themeID = themeID else {
            return .result()
        }

        // Look up the theme definition (built-in or custom)
        if let theme = AuraPresetDefinitions.getTheme(byID: themeID) {
            applyTheme(theme, to: &themeData)
            saveThemeData(themeData, defaults: defaults, key: themeDataKey)
        } else if let theme = AuraPresetDefinitions.getTheme(byName: themeID) {
            applyTheme(theme, to: &themeData)
            saveThemeData(themeData, defaults: defaults, key: themeDataKey)
        }

        return .result()
    }

    private func applyTheme(_ theme: AuraPresetDefinitions.ThemeDefinition, to themeData: inout [String: Any]) {
        // Update globalTheme (Safari)
        var globalTheme = themeData["globalTheme"] as? [String: Any] ?? [:]
        globalTheme["background"] = theme.theme.background
        globalTheme["text"] = theme.theme.text
        globalTheme["link"] = theme.theme.link
        globalTheme["enabled"] = true
        globalTheme["backgroundType"] = theme.theme.backgroundType ?? "color"
        if let gradient = theme.theme.backgroundGradient {
            globalTheme["backgroundGradient"] = gradient
        } else {
            globalTheme.removeValue(forKey: "backgroundGradient")
        }
        themeData["globalTheme"] = globalTheme

        // Update metadata
        themeData["_lastSaved"] = Int(Date().timeIntervalSince1970 * 1000)
        let saveCount = themeData["_saveCount"] as? Int ?? 0
        themeData["_saveCount"] = saveCount + 1
        let version = themeData["_version"] as? Int ?? 0
        themeData["_version"] = version + 1
    }

    private func saveThemeData(_ themeData: [String: Any], defaults: UserDefaults, key: String) {
        defaults.set(themeData, forKey: key)
        defaults.synchronize()
    }
}
